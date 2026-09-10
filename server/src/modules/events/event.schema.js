'use strict';

const { z } = require('zod');
const { STUDENT_BOOKABLE_AUDITORIUM_CODES } = require('../../shared/constants');
const { STUDENT_VISIBLE_STATUSES } = require('./event.constants');

/**
 * Validates MongoDB ObjectId format (24-character hex string).
 */
const mongoObjectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Event ID parameter schema.
 * Validates :eventId route parameter as a valid MongoDB ObjectId.
 */
const eventIdParamSchema = z.object({
  eventId: z
    .string()
    .regex(
      mongoObjectIdRegex,
      'Invalid event ID format. Must be a 24-character hex string.'
    ),
});

/**
 * List events query parameter schema.
 * Validates and sanitizes pagination and filter parameters.
 */
const listEventsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => {
      const num = parseInt(val, 10);
      return isNaN(num) || num < 1 ? 1 : num;
    }),
  limit: z
    .string()
    .optional()
    .default('12')
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1) return 12;
      return Math.min(num, 50);
    }),
  status: z.enum(STUDENT_VISIBLE_STATUSES).optional(),
  auditorium: z.enum(STUDENT_BOOKABLE_AUDITORIUM_CODES).optional(),
});

module.exports = {
  eventIdParamSchema,
  listEventsQuerySchema,
};
