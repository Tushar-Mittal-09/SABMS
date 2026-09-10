'use strict';

const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const eventIdParamSchema = z
  .object({
    eventId: z
      .string({ required_error: 'Event ID is required' })
      .trim()
      .regex(objectIdRegex, 'Invalid event ID format'),
  })
  .strict();

const createBookingSchema = z
  .object({
    seatId: z
      .string({ required_error: 'Seat ID is required' })
      .trim()
      .min(2, 'Seat ID must be at least 2 characters')
      .max(20, 'Seat ID cannot exceed 20 characters'),
  })
  .strict({ message: 'Unrecognized fields in booking request body' });

module.exports = {
  eventIdParamSchema,
  createBookingSchema,
};
