'use strict';

const Event = require('./event.model');
const {
  STUDENT_VISIBLE_STATUSES,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
} = require('./event.constants');
const {
  STUDENT_BOOKABLE_AUDITORIUM_CODES,
  AUDITORIUM_LABELS,
} = require('../../shared/constants');

/**
 * Event Repository — Data Access Layer
 *
 * All queries enforce:
 * - Only STUDENT_VISIBLE_STATUSES (UPCOMING, ONGOING)
 * - Only STUDENT_BOOKABLE_AUDITORIUM_CODES (no Conference Room)
 * - Internal fields stripped via model toJSON transform
 */

/**
 * Finds paginated student-visible events.
 *
 * @param {Object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=12]
 * @param {string} [options.status] - Filter by specific student-visible status.
 * @param {string} [options.auditorium] - Filter by specific auditorium code.
 * @returns {Promise<{ events: Array, pagination: Object }>}
 */
const findVisibleEvents = async ({
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
  status,
  auditorium,
} = {}) => {
  const filter = {
    status: { $in: STUDENT_VISIBLE_STATUSES },
    auditorium: { $in: STUDENT_BOOKABLE_AUDITORIUM_CODES },
  };

  // Narrow status filter if provided (already validated as student-visible)
  if (status) {
    filter.status = status;
  }

  // Narrow auditorium filter if provided (already validated as student-bookable)
  if (auditorium) {
    filter.auditorium = auditorium;
  }

  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    Event.find(filter)
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Event.countDocuments(filter),
  ]);

  // Attach auditorium labels for frontend display
  const enrichedEvents = events.map((event) => ({
    ...event,
    _id: event._id.toString(),
    auditoriumName: AUDITORIUM_LABELS[event.auditorium] || event.auditorium,
  }));

  return {
    events: enrichedEvents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Finds a single event by ID, only if student-visible.
 *
 * @param {string} eventId - MongoDB ObjectId string.
 * @returns {Promise<Object|null>} Event document or null if not found/not visible.
 */
const findEventById = async (eventId) => {
  const event = await Event.findOne({
    _id: eventId,
    status: { $in: STUDENT_VISIBLE_STATUSES },
    auditorium: { $in: STUDENT_BOOKABLE_AUDITORIUM_CODES },
  }).lean();

  if (!event) return null;

  return {
    ...event,
    _id: event._id.toString(),
    auditoriumName: AUDITORIUM_LABELS[event.auditorium] || event.auditorium,
  };
};

module.exports = {
  findVisibleEvents,
  findEventById,
};
