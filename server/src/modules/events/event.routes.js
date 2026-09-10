'use strict';

const express = require('express');
const {
  authenticate,
  authorize,
} = require('../../core/middleware/auth.middleware');
const {
  validateParams,
  validateQuery,
  validateBody,
} = require('../../core/middleware/validateRequest.middleware');
const { USER_ROLES } = require('../../shared/constants');
const { eventIdParamSchema, listEventsQuerySchema } = require('./event.schema');
const { createBookingSchema } = require('../bookings/booking.schema');
const eventController = require('./event.controller');
const bookingController = require('../bookings/booking.controller');

const router = express.Router();

// ─── Student Event Discovery Routes ─────────────────────────────────────────

/**
 * GET /api/v1/events
 *
 * Lists student-visible events (UPCOMING, ONGOING).
 * Requires student authentication and authorization.
 * Supports pagination: ?page=1&limit=12
 * Supports filters: ?auditorium=AUDITORIUM_1
 */
router.get(
  '/',
  authenticate,
  authorize(USER_ROLES.STUDENT),
  validateQuery(listEventsQuerySchema),
  eventController.listEvents
);

/**
 * GET /api/v1/events/:eventId
 *
 * Retrieves details of a specific student-visible event.
 * Requires student authentication and authorization.
 * Returns 404 for completed, cancelled, or non-existent events.
 */
router.get(
  '/:eventId',
  authenticate,
  authorize(USER_ROLES.STUDENT),
  validateParams(eventIdParamSchema),
  eventController.getEventById
);

// ─── Seat Selection & Booking Routes ────────────────────────────────────────

/**
 * GET /api/v1/events/:eventId/seats
 *
 * Retrieves the seat map with authoritative availability for the selected event.
 * Requires student authentication and authorization.
 */
router.get(
  '/:eventId/seats',
  authenticate,
  authorize(USER_ROLES.STUDENT),
  validateParams(eventIdParamSchema),
  bookingController.getEventSeats
);

/**
 * POST /api/v1/events/:eventId/bookings
 *
 * Atomically reserves one seat for an event.
 * Derives user ID strictly from req.user.
 * Derives auditorium strictly from event record.
 * Requires student authentication and authorization.
 */
router.post(
  '/:eventId/bookings',
  authenticate,
  authorize(USER_ROLES.STUDENT),
  validateParams(eventIdParamSchema),
  validateBody(createBookingSchema),
  bookingController.createBooking
);

module.exports = {
  eventsRouter: router,
  eventRouter: router,
  router,
};
