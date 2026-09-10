'use strict';

const crypto = require('crypto');
const Booking = require('./booking.model');
const {
  BOOKING_STATUS,
  MAX_BOOKING_REFERENCE_RETRIES,
} = require('./booking.constants');
const AppError = require('../../core/errors/AppError');
const logger = require('../../core/logger');

/**
 * Generates a cryptographically random, collision-resistant booking reference.
 * Format: BK-<timestamp36>-<hex> (e.g. BK-LMF8X2-A4B7C9)
 *
 * @returns {string} Unique uppercase booking reference.
 */
const generateBookingReference = () => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BK-${timestampPart}-${randomPart}`;
};

/**
 * Finds all active confirmed bookings for a specific event.
 *
 * @param {string|mongoose.Types.ObjectId} eventId - Target event ID.
 * @returns {Promise<Array<Object>>} Confirmed booking records.
 */
const findConfirmedBookingsForEvent = async (eventId) => {
  return Booking.find(
    { eventId, status: BOOKING_STATUS.CONFIRMED },
    'seatId seatLabel status createdAt'
  ).lean();
};

/**
 * Finds an active confirmed booking for a student and event combination.
 *
 * @param {string|mongoose.Types.ObjectId} eventId - Target event ID.
 * @param {string|mongoose.Types.ObjectId} userId - Student user ID.
 * @returns {Promise<Object|null>} Existing confirmed booking, or null.
 */
const findConfirmedBookingByUserAndEvent = async (eventId, userId) => {
  return Booking.findOne({
    eventId,
    user: userId,
    status: BOOKING_STATUS.CONFIRMED,
  }).lean();
};

/**
 * Creates a new booking document atomically with duplicate key collision handling.
 *
 * Collision Handling Rules:
 * - { eventId, seatId } duplicate -> 409 Conflict ("Seat is no longer available.")
 * - { eventId, user } duplicate -> 409 Conflict ("You already have a confirmed booking for this event.")
 * - { bookingReference } duplicate -> Retry with new reference (up to maxRetries)
 *
 * @param {Object} bookingData - Booking fields to persist.
 * @param {number} [maxRetries=3] - Maximum retry attempts for bookingReference collision.
 * @returns {Promise<Object>} Created booking document.
 */
const createBookingWithRetry = async (
  bookingData,
  maxRetries = MAX_BOOKING_REFERENCE_RETRIES
) => {
  let attempt = 0;
  let currentReference =
    bookingData.bookingReference || generateBookingReference();

  while (attempt < maxRetries) {
    attempt += 1;
    try {
      const booking = await Booking.create({
        ...bookingData,
        bookingReference: currentReference,
      });
      return booking;
    } catch (err) {
      // Check for MongoDB duplicate-key error (code 11000)
      const isDuplicateKey =
        err.code === 11000 ||
        (err.name === 'MongoServerError' && err.code === 11000);

      if (isDuplicateKey) {
        const keyPattern = err.keyPattern || {};
        const errMsg = err.message || '';

        // 1. Seat already booked collision -> Immediate 409 (Do NOT retry)
        if (
          keyPattern.seatId ||
          errMsg.includes('seatId') ||
          errMsg.includes('unique_active_event_seat')
        ) {
          logger.warn('Seat booking conflict detected (duplicate seatId)', {
            eventId: bookingData.eventId,
            seatId: bookingData.seatId,
          });
          throw AppError.conflict('Seat is no longer available.');
        }

        // 2. Student already has confirmed seat for event -> Immediate 409 (Do NOT retry)
        if (
          keyPattern.user ||
          errMsg.includes('user') ||
          errMsg.includes('unique_active_event_user')
        ) {
          logger.warn(
            'Student duplicate booking conflict detected (duplicate user for event)',
            {
              eventId: bookingData.eventId,
              user: bookingData.user,
            }
          );
          throw AppError.conflict(
            'You already have a confirmed booking for this event.'
          );
        }

        // 3. Booking reference collision -> Regenerate and retry
        if (
          keyPattern.bookingReference ||
          errMsg.includes('bookingReference')
        ) {
          logger.warn(
            'Booking reference collision; retrying with new reference',
            {
              attempt,
              maxRetries,
              collidedReference: currentReference,
            }
          );
          currentReference = generateBookingReference();
          continue;
        }

        // Fallback for compound index message match
        if (
          errMsg.includes('unique_active_event_seat') ||
          errMsg.includes('seatId_1')
        ) {
          throw AppError.conflict('Seat is no longer available.');
        }
        if (
          errMsg.includes('unique_active_event_user') ||
          errMsg.includes('user_1')
        ) {
          throw AppError.conflict(
            'You already have a confirmed booking for this event.'
          );
        }

        // Generic duplicate key fallback
        throw AppError.conflict(
          'A booking conflict occurred. Please try again.'
        );
      }

      // Non-duplicate error -> throw immediately
      throw err;
    }
  }

  throw AppError.internal(
    'Unable to generate unique booking reference. Please try again.'
  );
};

module.exports = {
  generateBookingReference,
  findConfirmedBookingsForEvent,
  findConfirmedBookingByUserAndEvent,
  createBookingWithRetry,
};
