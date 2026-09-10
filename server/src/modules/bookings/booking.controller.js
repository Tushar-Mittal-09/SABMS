'use strict';

const catchAsync = require('../../shared/utils/catchAsync');
const bookingService = require('./booking.service');

/**
 * GET /api/v1/events/:eventId/seats
 *
 * Retrieves the seat map for an event with authoritative availability.
 */
const getEventSeats = catchAsync(async (req, res) => {
  const { eventId } = req.params;
  const result = await bookingService.getEventSeatMap(eventId);
  return res.success(result, 'Seat map retrieved successfully');
});

/**
 * POST /api/v1/events/:eventId/bookings
 *
 * Books a single seat for an event atomically.
 * Derives student ID strictly from req.user.
 * Derives auditorium strictly from the Event record.
 */
const createBooking = catchAsync(async (req, res) => {
  const { eventId } = req.params;
  const { seatId } = req.body;
  const userId = req.user.id || req.user.sub;

  const booking = await bookingService.bookSeat({
    eventId,
    userId,
    user: req.user,
    seatId,
  });

  return res.created({ booking }, 'Seat booked successfully');
});

/**
 * GET /api/v1/bookings/:bookingId/ticket
 *
 * Retrieves the ticket details and secure QR code for a confirmed booking.
 * Enforces authenticated ownership (IDOR protection).
 */
const getTicket = catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user.id || req.user.sub;
  const userRole = req.user.role;

  const result = await bookingService.getBookingTicket(
    bookingId,
    userId,
    userRole
  );

  return res.success(result, 'Ticket retrieved successfully');
});

module.exports = {
  getEventSeats,
  createBooking,
  getTicket,
};
