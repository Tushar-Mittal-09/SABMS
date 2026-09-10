'use strict';

/**
 * Auditorium Seating Configuration — Single Source of Truth
 *
 * IMPORTANT: These values are TEMPORARY MVP DEVELOPMENT CONFIGURATION.
 * They are NOT official MIET specifications.
 * The architecture allows these to be replaced with official college data
 * without redesigning the booking system.
 *
 * Current MVP layout (all three auditoriums):
 * - 4 columns
 * - 15 rows per column
 * - Rows 1–2: Faculty / Organizer reserved
 * - Rows 3–15: Student seating (13 student rows)
 * - 6 student seats per row
 * - Student seats per auditorium: 4 × 13 × 6 = 312
 */

const AUDITORIUM_CODES = Object.freeze({
  AUDITORIUM_1: 'AUDITORIUM_1',
  AUDITORIUM_2: 'AUDITORIUM_2',
  AUDITORIUM_3: 'AUDITORIUM_3',
});

const AUDITORIUM_CODE_VALUES = Object.freeze(Object.values(AUDITORIUM_CODES));

/**
 * Full auditorium definitions with seating layout.
 * Conference Room is intentionally excluded from the student MVP scope.
 */
const AUDITORIUMS = Object.freeze({
  [AUDITORIUM_CODES.AUDITORIUM_1]: Object.freeze({
    code: AUDITORIUM_CODES.AUDITORIUM_1,
    name: 'Auditorium 1',
    type: 'auditorium',
    columns: 4,
    rows: 15,
    facultyReservedRows: 2,
    studentSeatsPerRow: 6,
  }),
  [AUDITORIUM_CODES.AUDITORIUM_2]: Object.freeze({
    code: AUDITORIUM_CODES.AUDITORIUM_2,
    name: 'Auditorium 2',
    type: 'auditorium',
    columns: 4,
    rows: 15,
    facultyReservedRows: 2,
    studentSeatsPerRow: 6,
  }),
  [AUDITORIUM_CODES.AUDITORIUM_3]: Object.freeze({
    code: AUDITORIUM_CODES.AUDITORIUM_3,
    name: 'Auditorium 3',
    type: 'auditorium',
    columns: 4,
    rows: 15,
    facultyReservedRows: 2,
    studentSeatsPerRow: 6,
  }),
});

/**
 * Calculates total student-bookable seats for an auditorium.
 *
 * Formula: columns × (rows − facultyReservedRows) × studentSeatsPerRow
 *
 * @param {Object} auditorium - An auditorium config object from AUDITORIUMS.
 * @returns {number} Total student-bookable seats.
 */
const calculateStudentSeats = (auditorium) => {
  if (!auditorium) {
    throw new Error('Auditorium configuration is required');
  }
  const studentRows = auditorium.rows - auditorium.facultyReservedRows;
  return auditorium.columns * studentRows * auditorium.studentSeatsPerRow;
};

/**
 * Student-bookable auditorium codes only.
 * Conference Room is intentionally excluded.
 */
const STUDENT_BOOKABLE_AUDITORIUM_CODES = Object.freeze([
  AUDITORIUM_CODES.AUDITORIUM_1,
  AUDITORIUM_CODES.AUDITORIUM_2,
  AUDITORIUM_CODES.AUDITORIUM_3,
]);

/**
 * Human-readable labels for auditorium codes.
 */
const AUDITORIUM_LABELS = Object.freeze({
  [AUDITORIUM_CODES.AUDITORIUM_1]: 'Auditorium 1',
  [AUDITORIUM_CODES.AUDITORIUM_2]: 'Auditorium 2',
  [AUDITORIUM_CODES.AUDITORIUM_3]: 'Auditorium 3',
});

/**
 * Returns the student seat capacity for a given auditorium code.
 *
 * @param {string} auditoriumCode - One of AUDITORIUM_CODES values.
 * @returns {number} Student-bookable seats for that auditorium.
 */
const getStudentSeatsForAuditorium = (auditoriumCode) => {
  const auditorium = AUDITORIUMS[auditoriumCode];
  if (!auditorium) {
    throw new Error(`Unknown auditorium code: ${auditoriumCode}`);
  }
  return calculateStudentSeats(auditorium);
};

module.exports = {
  AUDITORIUM_CODES,
  AUDITORIUM_CODE_VALUES,
  AUDITORIUMS,
  AUDITORIUM_LABELS,
  STUDENT_BOOKABLE_AUDITORIUM_CODES,
  calculateStudentSeats,
  getStudentSeatsForAuditorium,
};
