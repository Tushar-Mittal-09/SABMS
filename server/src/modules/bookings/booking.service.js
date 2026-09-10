'use strict';

const Event = require('../events/event.model');
const { EVENT_STATUS } = require('../events/event.constants');
const {
  AUDITORIUM_LABELS,
  STUDENT_BOOKABLE_AUDITORIUM_CODES,
  AUDITORIUM_LAYOUT_DISCLAIMER,
  generateAuditoriumSeatMap,
  validateAuditoriumSeat,
} = require('../../shared/constants/auditoriumConfig');
const {
  findConfirmedBookingsForEvent,
  findConfirmedBookingByUserAndEvent,
  createBookingWithRetry,
} = require('./booking.repository');
const { BOOKING_STATUS, SEAT_STATE } = require('./booking.constants');
const AppError = require('../../core/errors/AppError');

/**
 * Combines an event date and start time string (HH:mm) into a Date object.
 *
 * @param {Date|string} eventDate - Event date.
 * @param {string} startTime - 'HH:mm' format start time.
 * @returns {Date} Date representing the event start.
 */
const getEventStartDateTime = (eventDate, startTime) => {
  const d = new Date(eventDate);
  const dateStr = d.toISOString().split('T')[0];
  const [hours, minutes] = (startTime || '00:00').split(':').map(Number);
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return new Date(`${dateStr}T${hh}:${mm}:00.000Z`);
};

/**
 * Retrieves the seat map for an event.
 *
 * Seat states returned:
 * - RESERVED (Faculty/Organizer rows A & B)
 * - BOOKED (Confirmed booking exists)
 * - AVAILABLE (Available student seat)
 *
 * @param {string} eventId - Target event ID.
 * @returns {Promise<Object>} Seat map and event metadata.
 */
const getEventSeatMap = async (eventId) => {
  const event = await Event.findById(eventId).lean();

  if (!event) {
    throw AppError.notFound('Event not found or is no longer available.');
  }

  // Only student-visible events (UPCOMING, ONGOING) are viewable
  if (
    event.status === EVENT_STATUS.COMPLETED ||
    event.status === EVENT_STATUS.CANCELLED
  ) {
    throw AppError.notFound('Event not found or is no longer available.');
  }

  // Reject venues outside student-bookable auditoriums (e.g. Conference Room)
  if (!STUDENT_BOOKABLE_AUDITORIUM_CODES.includes(event.auditorium)) {
    throw AppError.validationError(
      `Auditorium '${event.auditorium}' is not a student-bookable auditorium.`
    );
  }

  // Check event start time window
  const eventStart = getEventStartDateTime(event.date, event.startTime);
  const now = Date.now();
  const isPastStart = now >= eventStart.getTime();
  const isBookingClosed = isPastStart || event.status !== EVENT_STATUS.UPCOMING;

  // Retrieve confirmed bookings for event
  const confirmedBookings = await findConfirmedBookingsForEvent(eventId);
  const bookedSeatSet = new Set(confirmedBookings.map((b) => b.seatId));

  // Generate template seat map (360 seats total)
  const templateSeats = generateAuditoriumSeatMap(event.auditorium);

  // Apply authoritative booking state
  const seats = templateSeats.map((seat) => {
    if (seat.isReserved) {
      return {
        ...seat,
        status: SEAT_STATE.RESERVED,
      };
    }
    if (bookedSeatSet.has(seat.seatId)) {
      return {
        ...seat,
        status: SEAT_STATE.BOOKED,
      };
    }
    return {
      ...seat,
      status: SEAT_STATE.AVAILABLE,
    };
  });

  const totalFacultySeats = 48;
  const totalStudentSeats = 312;
  const bookedStudentSeats = bookedSeatSet.size;
  const availableStudentSeats = Math.max(
    0,
    totalStudentSeats - bookedStudentSeats
  );

  return {
    event: {
      id: event._id,
      name: event.name,
      description: event.description,
      auditorium: event.auditorium,
      auditoriumName: AUDITORIUM_LABELS[event.auditorium] || event.auditorium,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      status: event.status,
      isBookingClosed,
    },
    auditorium: {
      code: event.auditorium,
      name: AUDITORIUM_LABELS[event.auditorium] || event.auditorium,
      disclaimer: AUDITORIUM_LAYOUT_DISCLAIMER,
      columns: 4,
      rows: 15,
      facultyReservedRows: 2,
      studentSeatsPerRow: 6,
      seatsPerRow: 24,
      totalSeats: 360,
      totalFacultySeats,
      totalStudentSeats,
    },
    seats,
    summary: {
      totalSeats: 360,
      totalFacultySeats,
      totalStudentSeats,
      bookedStudentSeats,
      availableStudentSeats,
      isFullyBooked: availableStudentSeats <= 0,
    },
  };
};

/**
 * Atomically books one seat for an event.
 *
 * Requirements:
 * - User must be authenticated student.
 * - Event must exist and be bookable.
 * - Current server time must be strictly before event start time (now < start).
 * - Seat must exist and not be reserved.
 * - Seat must not be booked (guaranteed by compound unique index).
 * - User must not already have a confirmed seat for this event (guaranteed by compound unique index).
 * - Auditorium is strictly derived from event.auditorium.
 *
 * @param {Object} params - Booking parameters.
 * @param {string} params.eventId - Target event ID.
 * @param {string} params.userId - Authenticated student user ID.
 * @param {string} params.seatId - Requested seat identifier (e.g. 'C-04').
 * @param {number} [params.now] - Optional timestamp for testing time boundary.
 * @returns {Promise<Object>} Created booking confirmation data.
 */
const bookSeat = async ({ eventId, userId, seatId, now = Date.now() }) => {
  const event = await Event.findById(eventId);

  if (!event) {
    throw AppError.notFound('Event not found or is no longer available.');
  }

  // Lifecycle status checks
  if (event.status === EVENT_STATUS.CANCELLED) {
    throw AppError.conflict('Cannot book a seat for a cancelled event.');
  }

  if (event.status === EVENT_STATUS.COMPLETED) {
    throw AppError.conflict('Cannot book a seat for a completed event.');
  }

  if (event.status === EVENT_STATUS.ONGOING) {
    throw AppError.conflict('Booking is closed for ongoing events.');
  }

  // Time boundary cutoff check: strictly now < eventStartDateTime
  const eventStart = getEventStartDateTime(event.date, event.startTime);
  const currentTime = typeof now === 'number' ? now : Date.now();

  if (currentTime >= eventStart.getTime()) {
    throw AppError.conflict('Booking window has closed for this event.');
  }

  // Auditorium check: must be student-bookable
  if (!STUDENT_BOOKABLE_AUDITORIUM_CODES.includes(event.auditorium)) {
    throw AppError.validationError(
      `Auditorium '${event.auditorium}' is not a student-bookable auditorium.`
    );
  }

  // Validate seat against authoritative auditorium layout
  const seatValidation = validateAuditoriumSeat(event.auditorium, seatId);

  if (!seatValidation.isValid) {
    throw AppError.validationError(
      seatValidation.error ||
        `Seat '${seatId}' does not exist in this auditorium layout.`
    );
  }

  if (seatValidation.isReserved) {
    throw AppError.validationError(
      'Faculty and organizer reserved seats cannot be booked by students.'
    );
  }

  // Preliminary check for friendly conflict response (database index remains final authority)
  const existingBooking = await findConfirmedBookingByUserAndEvent(
    eventId,
    userId
  );
  if (existingBooking) {
    throw AppError.conflict(
      'You already have a confirmed booking for this event.'
    );
  }

  // Atomically persist booking with auditorium derived exclusively from event.auditorium
  const booking = await createBookingWithRetry({
    eventId: event._id,
    user: userId,
    auditorium: event.auditorium, // SERVER-DERIVED
    seatId: seatValidation.seatId,
    seatLabel: seatValidation.label,
    status: BOOKING_STATUS.CONFIRMED,
  });

  return {
    id: booking._id,
    bookingReference: booking.bookingReference,
    eventId: event._id,
    eventName: event.name,
    auditorium: event.auditorium,
    auditoriumName: AUDITORIUM_LABELS[event.auditorium] || event.auditorium,
    seatId: booking.seatId,
    seatLabel: booking.seatLabel,
    status: booking.status,
    eventDate: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    createdAt: booking.createdAt,
  };
};

module.exports = {
  getEventStartDateTime,
  getEventSeatMap,
  bookSeat,
};
