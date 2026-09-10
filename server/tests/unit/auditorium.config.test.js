'use strict';

const {
  AUDITORIUM_CODES,
  AUDITORIUM_CODE_VALUES,
  AUDITORIUMS,
  AUDITORIUM_LABELS,
  STUDENT_BOOKABLE_AUDITORIUM_CODES,
  calculateStudentSeats,
  getStudentSeatsForAuditorium,
} = require('../../src/shared/constants/auditoriumConfig');

/**
 * Auditorium Configuration Tests
 *
 * Validates the single source of truth for auditorium seating configuration.
 * Ensures correct student seat calculations and scope boundaries.
 */
describe('Auditorium Configuration', () => {
  describe('AUDITORIUM_CODES', () => {
    it('should define exactly 3 student-bookable auditoriums', () => {
      expect(AUDITORIUM_CODE_VALUES).toHaveLength(3);
      expect(AUDITORIUM_CODES.AUDITORIUM_1).toBe('AUDITORIUM_1');
      expect(AUDITORIUM_CODES.AUDITORIUM_2).toBe('AUDITORIUM_2');
      expect(AUDITORIUM_CODES.AUDITORIUM_3).toBe('AUDITORIUM_3');
    });

    it('should NOT include Conference Room', () => {
      const codes = Object.values(AUDITORIUM_CODES);
      expect(codes).not.toContain('CONFERENCE_ROOM');
      const keys = Object.keys(AUDITORIUM_CODES);
      keys.forEach((key) => {
        expect(key.toLowerCase()).not.toContain('conference');
      });
    });

    it('should be frozen and immutable', () => {
      expect(Object.isFrozen(AUDITORIUM_CODES)).toBe(true);
    });
  });

  describe('AUDITORIUMS configuration', () => {
    it('should have configuration for all 3 auditoriums', () => {
      expect(Object.keys(AUDITORIUMS)).toHaveLength(3);
      STUDENT_BOOKABLE_AUDITORIUM_CODES.forEach((code) => {
        expect(AUDITORIUMS[code]).toBeDefined();
      });
    });

    it('should have correct MVP seating layout for each auditorium', () => {
      Object.values(AUDITORIUMS).forEach((aud) => {
        expect(aud.columns).toBe(4);
        expect(aud.rows).toBe(15);
        expect(aud.facultyReservedRows).toBe(2);
        expect(aud.studentSeatsPerRow).toBe(6);
        expect(aud.type).toBe('auditorium');
      });
    });

    it('should have frozen individual auditorium objects', () => {
      Object.values(AUDITORIUMS).forEach((aud) => {
        expect(Object.isFrozen(aud)).toBe(true);
      });
    });
  });

  describe('calculateStudentSeats', () => {
    it('should calculate 312 student seats per auditorium with MVP config', () => {
      // Formula: columns × (rows - facultyReservedRows) × studentSeatsPerRow
      // 4 × (15 - 2) × 6 = 4 × 13 × 6 = 312
      Object.values(AUDITORIUMS).forEach((aud) => {
        expect(calculateStudentSeats(aud)).toBe(312);
      });
    });

    it('should correctly calculate with different configurations', () => {
      const customAud = {
        columns: 3,
        rows: 10,
        facultyReservedRows: 1,
        studentSeatsPerRow: 4,
      };
      // 3 × (10 - 1) × 4 = 3 × 9 × 4 = 108
      expect(calculateStudentSeats(customAud)).toBe(108);
    });

    it('should throw error for null/undefined auditorium', () => {
      expect(() => calculateStudentSeats(null)).toThrow(
        'Auditorium configuration is required'
      );
      expect(() => calculateStudentSeats(undefined)).toThrow(
        'Auditorium configuration is required'
      );
    });
  });

  describe('getStudentSeatsForAuditorium', () => {
    it('should return 312 for each student-bookable auditorium code', () => {
      STUDENT_BOOKABLE_AUDITORIUM_CODES.forEach((code) => {
        expect(getStudentSeatsForAuditorium(code)).toBe(312);
      });
    });

    it('should throw for unknown auditorium code', () => {
      expect(() => getStudentSeatsForAuditorium('CONFERENCE_ROOM')).toThrow(
        'Unknown auditorium code'
      );
      expect(() => getStudentSeatsForAuditorium('FAKE_ROOM')).toThrow(
        'Unknown auditorium code'
      );
    });
  });

  describe('STUDENT_BOOKABLE_AUDITORIUM_CODES', () => {
    it('should contain exactly 3 auditorium codes', () => {
      expect(STUDENT_BOOKABLE_AUDITORIUM_CODES).toHaveLength(3);
    });

    it('should NOT contain Conference Room', () => {
      expect(STUDENT_BOOKABLE_AUDITORIUM_CODES).not.toContain(
        'CONFERENCE_ROOM'
      );
    });

    it('should be frozen and immutable', () => {
      expect(Object.isFrozen(STUDENT_BOOKABLE_AUDITORIUM_CODES)).toBe(true);
    });
  });

  describe('AUDITORIUM_LABELS', () => {
    it('should provide human-readable labels for each auditorium', () => {
      expect(AUDITORIUM_LABELS[AUDITORIUM_CODES.AUDITORIUM_1]).toBe(
        'Auditorium 1'
      );
      expect(AUDITORIUM_LABELS[AUDITORIUM_CODES.AUDITORIUM_2]).toBe(
        'Auditorium 2'
      );
      expect(AUDITORIUM_LABELS[AUDITORIUM_CODES.AUDITORIUM_3]).toBe(
        'Auditorium 3'
      );
    });
  });

  describe('formatSeatId and parseSeatId', () => {
    const {
      formatSeatId,
      parseSeatId,
    } = require('../../src/shared/constants/auditoriumConfig');

    it('should format canonical seat ID with 2-digit zero-padding', () => {
      expect(formatSeatId('C', 4)).toBe('C-04');
      expect(formatSeatId('c', '12')).toBe('C-12');
      expect(formatSeatId('A', 1)).toBe('A-01');
      expect(formatSeatId('O', 24)).toBe('O-24');
    });

    it('should parse canonical seatId C-04', () => {
      const parsed = parseSeatId('C-04');
      expect(parsed).toEqual({
        row: 'C',
        number: 4,
        columnSection: 1,
        label: 'Row C, Seat 4',
        seatId: 'C-04',
      });
    });

    it('should parse unpadded seatId C-4 and normalize to C-04', () => {
      const parsed = parseSeatId('C-4');
      expect(parsed).toEqual({
        row: 'C',
        number: 4,
        columnSection: 1,
        label: 'Row C, Seat 4',
        seatId: 'C-04',
      });
    });

    it('should calculate correct column sections (1 to 4)', () => {
      expect(parseSeatId('C-01').columnSection).toBe(1);
      expect(parseSeatId('C-06').columnSection).toBe(1);
      expect(parseSeatId('C-07').columnSection).toBe(2);
      expect(parseSeatId('C-12').columnSection).toBe(2);
      expect(parseSeatId('C-13').columnSection).toBe(3);
      expect(parseSeatId('C-18').columnSection).toBe(3);
      expect(parseSeatId('C-19').columnSection).toBe(4);
      expect(parseSeatId('C-24').columnSection).toBe(4);
    });

    it('should return null for invalid row or seat number > 24', () => {
      expect(parseSeatId('P-01')).toBeNull();
      expect(parseSeatId('C-25')).toBeNull();
      expect(parseSeatId('C-00')).toBeNull();
      expect(parseSeatId('')).toBeNull();
      expect(parseSeatId(null)).toBeNull();
    });
  });

  describe('validateAuditoriumSeat', () => {
    const {
      validateAuditoriumSeat,
    } = require('../../src/shared/constants/auditoriumConfig');

    it('should validate available student seat', () => {
      const res = validateAuditoriumSeat('AUDITORIUM_1', 'C-04');
      expect(res.isValid).toBe(true);
      expect(res.isReserved).toBe(false);
      expect(res.seatId).toBe('C-04');
      expect(res.row).toBe('C');
      expect(res.number).toBe(4);
      expect(res.columnSection).toBe(1);
    });

    it('should validate faculty/organizer reserved rows (A and B)', () => {
      const resA = validateAuditoriumSeat('AUDITORIUM_1', 'A-01');
      expect(resA.isValid).toBe(true);
      expect(resA.isReserved).toBe(true);

      const resB = validateAuditoriumSeat('AUDITORIUM_1', 'B-24');
      expect(resB.isValid).toBe(true);
      expect(resB.isReserved).toBe(true);
    });

    it('should reject seat for invalid auditorium', () => {
      const res = validateAuditoriumSeat('CONFERENCE_ROOM', 'C-04');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('not a student-bookable auditorium');
    });

    it('should reject invalid seat format', () => {
      const res = validateAuditoriumSeat('AUDITORIUM_1', 'Z-99');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('does not exist');
    });
  });

  describe('generateAuditoriumSeatMap', () => {
    const {
      generateAuditoriumSeatMap,
    } = require('../../src/shared/constants/auditoriumConfig');

    it('should generate 360 total seats (48 reserved + 312 student)', () => {
      const map = generateAuditoriumSeatMap('AUDITORIUM_1');
      expect(map).toHaveLength(360);

      const reserved = map.filter((s) => s.isReserved);
      const student = map.filter((s) => !s.isReserved);

      expect(reserved).toHaveLength(48);
      expect(student).toHaveLength(312);
      expect(reserved.every((s) => s.status === 'RESERVED')).toBe(true);
      expect(student.every((s) => s.status === 'AVAILABLE')).toBe(true);
    });

    it('should throw for invalid auditorium code', () => {
      expect(() => generateAuditoriumSeatMap('FAKE_ROOM')).toThrow(
        'Invalid auditorium code'
      );
    });
  });
});
