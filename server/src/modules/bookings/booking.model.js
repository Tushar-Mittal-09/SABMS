'use strict';

const mongoose = require('mongoose');
const {
  BOOKING_STATUS_VALUES,
  BOOKING_STATUS,
  EMAIL_STATUS_VALUES,
  EMAIL_STATUS,
} = require('./booking.constants');
const { STUDENT_BOOKABLE_AUDITORIUM_CODES } = require('../../shared/constants');

/**
 * Booking Schema
 *
 * Represents an authoritative seat reservation for an auditorium event.
 *
 * ARCHITECTURAL RULE:
 * True seat availability is derived exclusively from auditorium configuration
 * MINUS confirmed Booking documents.
 *
 * DOUBLE-BOOKING PROTECTION:
 * Enforced via database-level partial unique indexes on:
 * 1. { eventId: 1, seatId: 1 } for status: 'CONFIRMED' (No two students can hold same seat)
 * 2. { eventId: 1, user: 1 } for status: 'CONFIRMED' (One seat per student per event)
 */
const bookingSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    auditorium: {
      type: String,
      required: [true, 'Auditorium is required'],
      enum: {
        values: STUDENT_BOOKABLE_AUDITORIUM_CODES,
        message:
          '{VALUE} is not a valid student-bookable auditorium. Valid: ' +
          STUDENT_BOOKABLE_AUDITORIUM_CODES.join(', '),
      },
    },
    seatId: {
      type: String,
      required: [true, 'Seat ID is required'],
      trim: true,
      uppercase: true,
      match: [
        /^[A-O]-(0[1-9]|1[0-9]|2[0-4])$/,
        'Invalid seat ID format (e.g. C-04)',
      ],
    },
    seatLabel: {
      type: String,
      required: [true, 'Seat label is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: BOOKING_STATUS_VALUES,
        message: '{VALUE} is not a valid booking status',
      },
      default: BOOKING_STATUS.CONFIRMED,
      required: true,
      index: true,
    },
    bookingReference: {
      type: String,
      required: [true, 'Booking reference is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    ticketToken: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
      trim: true,
      index: true,
    },
    ticketIssuedAt: {
      type: Date,
      default: null,
    },
    emailStatus: {
      type: String,
      enum: {
        values: EMAIL_STATUS_VALUES,
        message: '{VALUE} is not a valid email status',
      },
      default: EMAIL_STATUS.PENDING,
      index: true,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
    emailError: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'bookings',
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.ticketToken;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (_doc, ret) {
        delete ret.ticketToken;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Compound Partial Unique Indexes for Double-Booking Protection ────────────

// 1. Exactly one CONFIRMED booking per seat per event
bookingSchema.index(
  { eventId: 1, seatId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: BOOKING_STATUS.CONFIRMED },
    name: 'unique_active_event_seat',
  }
);

// 2. Exactly one CONFIRMED booking per student per event
bookingSchema.index(
  { eventId: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: { status: BOOKING_STATUS.CONFIRMED },
    name: 'unique_active_event_user',
  }
);

const Booking =
  mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

module.exports = Booking;
