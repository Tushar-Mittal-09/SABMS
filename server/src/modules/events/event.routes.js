'use strict';

const express = require('express');
const { authenticate } = require('../../core/middleware/auth.middleware');
const {
  validateParams,
  validateQuery,
} = require('../../core/middleware/validateRequest.middleware');
const { eventIdParamSchema, listEventsQuerySchema } = require('./event.schema');
const eventController = require('./event.controller');

const router = express.Router();

// ─── Student Event Discovery Routes ─────────────────────────────────────────

/**
 * GET /api/v1/events
 *
 * Lists student-visible events (UPCOMING, ONGOING).
 * Requires authentication.
 * Supports pagination: ?page=1&limit=12
 * Supports filters: ?status=UPCOMING&auditorium=AUDITORIUM_1
 */
router.get(
  '/',
  authenticate,
  validateQuery(listEventsQuerySchema),
  eventController.listEvents
);

/**
 * GET /api/v1/events/:eventId
 *
 * Retrieves details of a specific student-visible event.
 * Requires authentication.
 * Returns 404 for completed, cancelled, or non-existent events.
 */
router.get(
  '/:eventId',
  authenticate,
  validateParams(eventIdParamSchema),
  eventController.getEventById
);

module.exports = {
  eventsRouter: router,
  eventRouter: router,
  router,
};
