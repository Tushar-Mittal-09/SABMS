'use strict';

const mongoose = require('mongoose');
const { EVENT_STATUS_VALUES, EVENT_STATUS } = require('./event.constants');
const {
  STUDENT_BOOKABLE_AUDITORIUM_CODES,
  getStudentSeatsForAuditorium,
} = require('../../shared/constants');

/**
 * Event Schema
 *
 * Represents a bookable auditorium event in the SABMS system.
 *
 * IMPORTANT DESIGN NOTE:
 * - `totalSeats` is derived from auditorium configuration at event creation time.
 * - `availableSeats` is a DENORMALIZED DISPLAY COUNTER only.
 *   It provides fast read access for event listing cards.
 *   Actual seat availability MUST be derived from booked seats
 *   when performing real booking operations (Step 3).
 *   This counter will be decremented during booking but is NOT
 *   the authoritative booking state.
 */
const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      minlength: [3, 'Event name must be at least 3 characters'],
      maxlength: [200, 'Event name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
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
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        'Start time must be in HH:mm format',
      ],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        'End time must be in HH:mm format',
      ],
    },
    status: {
      type: String,
      enum: {
        values: EVENT_STATUS_VALUES,
        message: '{VALUE} is not a valid event status',
      },
      default: EVENT_STATUS.UPCOMING,
      required: true,
    },
    image: {
      type: String,
      default: null,
      trim: true,
    },
    /**
     * Total student-bookable seats, derived from auditorium configuration.
     * Set at event creation time via getStudentSeatsForAuditorium().
     */
    totalSeats: {
      type: Number,
      required: true,
      min: [0, 'Total seats cannot be negative'],
    },
    /**
     * DENORMALIZED COUNTER — for display performance only.
     * NOT the authoritative booking state.
     * True availability must be derived from booked seats (Step 3).
     */
    availableSeats: {
      type: Number,
      required: true,
      min: [0, 'Available seats cannot be negative'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'events',
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.__v;
        delete ret.createdBy;
        return ret;
      },
    },
    toObject: {
      transform: function (_doc, ret) {
        delete ret.__v;
        delete ret.createdBy;
        return ret;
      },
    },
  }
);

// ─── Pre-save hook: auto-calculate totalSeats from auditorium config ─────────
eventSchema.pre('validate', function (next) {
  if (this.isNew && this.auditorium) {
    try {
      const seats = getStudentSeatsForAuditorium(this.auditorium);
      if (!this.totalSeats) {
        this.totalSeats = seats;
      }
      if (this.availableSeats === undefined || this.availableSeats === null) {
        this.availableSeats = this.totalSeats;
      }
    } catch (err) {
      if (typeof next === 'function') return next(err);
      throw err;
    }
  }
  if (typeof next === 'function') {
    next();
  }
});

// ─── Database Indexes ────────────────────────────────────────────────────────
eventSchema.index({ status: 1, date: 1 });
eventSchema.index({ auditorium: 1 });

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

module.exports = Event;
