'use strict';

/**
 * Booking Module Constants
 *
 * Defines booking lifecycle statuses and seat map states for SABMS.
 */

const BOOKING_STATUS = Object.freeze({
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
});

const BOOKING_STATUS_VALUES = Object.freeze(Object.values(BOOKING_STATUS));

/**
 * Seat map states returned by the backend.
 * Note: 'SELECTED' is strictly client-side transient state and is never returned by the backend.
 */
const SEAT_STATE = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  BOOKED: 'BOOKED',
  RESERVED: 'RESERVED',
});

const SEAT_STATE_VALUES = Object.freeze(Object.values(SEAT_STATE));

const MAX_BOOKING_REFERENCE_RETRIES = 3;

module.exports = {
  BOOKING_STATUS,
  BOOKING_STATUS_VALUES,
  SEAT_STATE,
  SEAT_STATE_VALUES,
  MAX_BOOKING_REFERENCE_RETRIES,
};
