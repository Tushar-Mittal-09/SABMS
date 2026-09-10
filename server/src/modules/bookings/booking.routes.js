'use strict';

const express = require('express');
const { authenticate } = require('../../core/middleware/auth.middleware');
const bookingController = require('./booking.controller');

const router = express.Router();

/**
 * GET /api/v1/bookings/:bookingId/ticket
 *
 * Retrieves the secure QR ticket and event details for an authoritative booking.
 * Protected by JWT authentication and strict student ownership check.
 */
router.get('/:bookingId/ticket', authenticate, bookingController.getTicket);

module.exports = {
  bookingsRouter: router,
  bookingRouter: router,
  router,
};
