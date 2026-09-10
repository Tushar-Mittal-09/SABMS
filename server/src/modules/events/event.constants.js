'use strict';

/**
 * Event Module Constants
 *
 * Defines event lifecycle statuses and query defaults
 * for the student event discovery flow.
 */

const EVENT_STATUS = Object.freeze({
  UPCOMING: 'UPCOMING',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const EVENT_STATUS_VALUES = Object.freeze(Object.values(EVENT_STATUS));

/**
 * Only UPCOMING and ONGOING events are visible to students.
 * COMPLETED and CANCELLED events must never be exposed as bookable.
 */
const STUDENT_VISIBLE_STATUSES = Object.freeze([
  EVENT_STATUS.UPCOMING,
  EVENT_STATUS.ONGOING,
]);

/**
 * Pagination defaults and safety bounds.
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MIN_PAGE = 1;
const MIN_LIMIT = 1;

module.exports = {
  EVENT_STATUS,
  EVENT_STATUS_VALUES,
  STUDENT_VISIBLE_STATUSES,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_PAGE,
  MIN_LIMIT,
};
