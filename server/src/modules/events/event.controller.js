'use strict';

const catchAsync = require('../../shared/utils/catchAsync');
const AppError = require('../../core/errors/AppError');
const eventRepository = require('./event.repository');
const logger = require('../../core/logger');

/**
 * Event Controller — HTTP Request Handlers
 *
 * Uses existing response envelope (res.success / res.notFound)
 * and error handling conventions (catchAsync + AppError).
 */

/**
 * GET /api/v1/events
 *
 * Lists student-visible events with pagination.
 * Query params: page, limit, status, auditorium
 */
const listEvents = catchAsync(async (req, res) => {
  const { page, limit, status, auditorium } = req.query;

  const result = await eventRepository.findVisibleEvents({
    page,
    limit,
    status,
    auditorium,
  });

  logger.debug('Events listed', {
    userId: req.user?.id,
    page,
    limit,
    total: result.pagination.total,
    requestId: req.id,
  });

  return res.success(
    {
      events: result.events,
      pagination: result.pagination,
    },
    'Events retrieved successfully'
  );
});

/**
 * GET /api/v1/events/:eventId
 *
 * Retrieves a single event by ID.
 * Returns 404 for non-existent or non-student-visible events.
 */
const getEventById = catchAsync(async (req, res) => {
  const { eventId } = req.params;

  const event = await eventRepository.findEventById(eventId);

  if (!event) {
    throw AppError.notFound('Event not found or is no longer available.');
  }

  logger.debug('Event details retrieved', {
    userId: req.user?.id,
    eventId,
    requestId: req.id,
  });

  return res.success({ event }, 'Event retrieved successfully');
});

module.exports = {
  listEvents,
  getEventById,
};
