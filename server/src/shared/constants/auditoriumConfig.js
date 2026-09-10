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

// ─── Seat Topology & Identification Constants ────────────────────────────────

const AUDITORIUM_LAYOUT_DISCLAIMER = Object.freeze(
  'TEMPORARY DEVELOPMENT ASSUMPTION — PENDING OFFICIAL COLLEGE DATA'
);

const ROW_LETTERS = Object.freeze([
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
]);

const FACULTY_RESERVED_ROW_LETTERS = Object.freeze(['A', 'B']);
const STUDENT_ROW_LETTERS = Object.freeze(
  ROW_LETTERS.slice(FACULTY_RESERVED_ROW_LETTERS.length)
);

const SEATS_PER_ROW = 24; // 4 columns × 6 seats per section

/**
 * Formats row letter and seat number into a canonical seatId.
 * Example: ('C', 4) -> 'C-04'
 *
 * @param {string} rowLetter - Row letter ('A' to 'O').
 * @param {number} seatNumber - Seat number (1 to 24).
 * @returns {string} Canonical seat ID.
 */
const formatSeatId = (rowLetter, seatNumber) => {
  const cleanRow = String(rowLetter).trim().toUpperCase();
  const cleanNum = parseInt(seatNumber, 10);
  return `${cleanRow}-${String(cleanNum).padStart(2, '0')}`;
};

/**
 * Parses and normalizes a seatId.
 * Supports canonical 'C-04', unpadded 'C-4', or label 'Row C, Seat 4'.
 *
 * @param {string} seatIdInput - The seat identifier string.
 * @returns {{ row: string, number: number, columnSection: number, label: string, seatId: string } | null}
 */
const parseSeatId = (seatIdInput) => {
  if (!seatIdInput || typeof seatIdInput !== 'string') {
    return null;
  }

  const trimmed = seatIdInput.trim().toUpperCase();

  // Match canonical or unpadded: 'C-04' or 'C-4'
  const dashMatch = trimmed.match(/^([A-O])-?(\d{1,2})$/);
  if (dashMatch) {
    const row = dashMatch[1];
    const number = parseInt(dashMatch[2], 10);
    if (number >= 1 && number <= SEATS_PER_ROW) {
      const columnSection = Math.ceil(number / 6);
      return {
        row,
        number,
        columnSection,
        label: `Row ${row}, Seat ${number}`,
        seatId: formatSeatId(row, number),
      };
    }
    return null;
  }

  // Match human label: 'ROW C, SEAT 4' or 'ROW C SEAT 04'
  const labelMatch = trimmed.match(/^ROW\s+([A-O]),?\s+SEAT\s+(\d{1,2})$/i);
  if (labelMatch) {
    const row = labelMatch[1].toUpperCase();
    const number = parseInt(labelMatch[2], 10);
    if (number >= 1 && number <= SEATS_PER_ROW) {
      const columnSection = Math.ceil(number / 6);
      return {
        row,
        number,
        columnSection,
        label: `Row ${row}, Seat ${number}`,
        seatId: formatSeatId(row, number),
      };
    }
    return null;
  }

  return null;
};

/**
 * Validates a seatId against the authoritative auditorium configuration.
 *
 * @param {string} auditoriumCode - The auditorium code (e.g. AUDITORIUM_1).
 * @param {string} seatId - The seat identifier string.
 * @returns {{
 *   isValid: boolean,
 *   isReserved: boolean,
 *   seatId: string,
 *   row: string,
 *   number: number,
 *   columnSection: number,
 *   label: string,
 *   error?: string
 * }}
 */
const validateAuditoriumSeat = (auditoriumCode, seatId) => {
  if (!STUDENT_BOOKABLE_AUDITORIUM_CODES.includes(auditoriumCode)) {
    return {
      isValid: false,
      isReserved: false,
      error: `Auditorium '${auditoriumCode}' is not a student-bookable auditorium.`,
    };
  }

  const parsed = parseSeatId(seatId);
  if (!parsed) {
    return {
      isValid: false,
      isReserved: false,
      error: `Seat '${seatId}' does not exist in this auditorium layout.`,
    };
  }

  const isReserved = FACULTY_RESERVED_ROW_LETTERS.includes(parsed.row);

  return {
    isValid: true,
    isReserved,
    seatId: parsed.seatId,
    row: parsed.row,
    number: parsed.number,
    columnSection: parsed.columnSection,
    label: parsed.label,
  };
};

/**
 * Generates the deterministic template seat map for an auditorium.
 * Total seats = 15 rows × 24 = 360 (48 reserved, 312 student).
 *
 * @param {string} auditoriumCode - One of STUDENT_BOOKABLE_AUDITORIUM_CODES.
 * @returns {Array<Object>} Array of seat descriptor objects.
 */
const generateAuditoriumSeatMap = (auditoriumCode) => {
  if (!STUDENT_BOOKABLE_AUDITORIUM_CODES.includes(auditoriumCode)) {
    throw new Error(`Invalid auditorium code: ${auditoriumCode}`);
  }

  const seats = [];

  ROW_LETTERS.forEach((rowLetter) => {
    const isReserved = FACULTY_RESERVED_ROW_LETTERS.includes(rowLetter);
    const initialStatus = isReserved ? 'RESERVED' : 'AVAILABLE';

    for (let num = 1; num <= SEATS_PER_ROW; num += 1) {
      const columnSection = Math.ceil(num / 6);
      seats.push({
        seatId: formatSeatId(rowLetter, num),
        row: rowLetter,
        number: num,
        columnSection,
        label: `Row ${rowLetter}, Seat ${num}`,
        isReserved,
        status: initialStatus,
      });
    }
  });

  return seats;
};

module.exports = {
  AUDITORIUM_CODES,
  AUDITORIUM_CODE_VALUES,
  AUDITORIUMS,
  AUDITORIUM_LABELS,
  STUDENT_BOOKABLE_AUDITORIUM_CODES,
  AUDITORIUM_LAYOUT_DISCLAIMER,
  ROW_LETTERS,
  FACULTY_RESERVED_ROW_LETTERS,
  STUDENT_ROW_LETTERS,
  SEATS_PER_ROW,
  calculateStudentSeats,
  getStudentSeatsForAuditorium,
  formatSeatId,
  parseSeatId,
  validateAuditoriumSeat,
  generateAuditoriumSeatMap,
};
