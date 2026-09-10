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
});
