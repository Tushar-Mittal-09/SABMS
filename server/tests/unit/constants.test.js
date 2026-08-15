'use strict';

const {
  USER_ROLES,
  USER_ROLE_VALUES,
  USER_ROLE_LABELS,
  DEFAULT_USER_ROLE,
  isValidUserRole,
  ACCOUNT_STATUSES,
  ACCOUNT_STATUS_VALUES,
  DEFAULT_ACCOUNT_STATUS,
  isValidAccountStatus,
} = require('../../src/constants');
const {
  userRole,
  accountStatus,
} = require('../../src/validations/reusableValidators');

describe('Role & Account Status Constants (Sprint 2.2.3 Corrected)', () => {
  describe('USER_ROLES Constants', () => {
    it('should define all canonical SABMS user roles with exact string values', () => {
      expect(USER_ROLES.STUDENT).toBe('STUDENT');
      expect(USER_ROLES.FACULTY).toBe('FACULTY');
      expect(USER_ROLES.CLUB_MEMBER).toBe('CLUB_MEMBER');
      expect(USER_ROLES.EVENT_ORGANIZER).toBe('EVENT_ORGANIZER');
      expect(USER_ROLES.ADMIN).toBe('ADMIN');
      expect(USER_ROLES.VENUE_MANAGER).toBeUndefined();
    });

    it('should provide correct display labels', () => {
      expect(USER_ROLE_LABELS.STUDENT).toBe('Student');
      expect(USER_ROLE_LABELS.FACULTY).toBe('Faculty');
      expect(USER_ROLE_LABELS.CLUB_MEMBER).toBe('Club Member');
      expect(USER_ROLE_LABELS.EVENT_ORGANIZER).toBe('Event Organizer');
      expect(USER_ROLE_LABELS.ADMIN).toBe('Admin');
    });

    it('should be immutable (frozen object and frozen array)', () => {
      expect(Object.isFrozen(USER_ROLES)).toBe(true);
      expect(Object.isFrozen(USER_ROLE_VALUES)).toBe(true);
      expect(Object.isFrozen(USER_ROLE_LABELS)).toBe(true);

      expect(() => {
        USER_ROLES.NEW_ROLE = 'HACKER';
      }).toThrow();
    });

    it('should have DEFAULT_USER_ROLE set to STUDENT', () => {
      expect(DEFAULT_USER_ROLE).toBe(USER_ROLES.STUDENT);
    });

    it('should validate roles correctly via isValidUserRole', () => {
      expect(isValidUserRole('STUDENT')).toBe(true);
      expect(isValidUserRole('FACULTY')).toBe(true);
      expect(isValidUserRole('CLUB_MEMBER')).toBe(true);
      expect(isValidUserRole('EVENT_ORGANIZER')).toBe(true);
      expect(isValidUserRole('ADMIN')).toBe(true);
      expect(isValidUserRole('VENUE_MANAGER')).toBe(false);
      expect(isValidUserRole('SUPER_ADMIN')).toBe(false);
      expect(isValidUserRole('MANAGER')).toBe(false);
      expect(isValidUserRole('')).toBe(false);
      expect(isValidUserRole(null)).toBe(false);
    });
  });

  describe('ACCOUNT_STATUSES Constants', () => {
    it('should define all canonical account lifecycle statuses with exact string values', () => {
      expect(ACCOUNT_STATUSES.PENDING).toBe('PENDING');
      expect(ACCOUNT_STATUSES.ACTIVE).toBe('ACTIVE');
      expect(ACCOUNT_STATUSES.SUSPENDED).toBe('SUSPENDED');
      expect(ACCOUNT_STATUSES.INACTIVE).toBe('INACTIVE');
    });

    it('should be immutable (frozen object and frozen array)', () => {
      expect(Object.isFrozen(ACCOUNT_STATUSES)).toBe(true);
      expect(Object.isFrozen(ACCOUNT_STATUS_VALUES)).toBe(true);

      expect(() => {
        ACCOUNT_STATUSES.LOCKED = 'LOCKED';
      }).toThrow();
    });

    it('should have DEFAULT_ACCOUNT_STATUS set to PENDING', () => {
      expect(DEFAULT_ACCOUNT_STATUS).toBe(ACCOUNT_STATUSES.PENDING);
    });

    it('should validate statuses correctly via isValidAccountStatus', () => {
      expect(isValidAccountStatus('PENDING')).toBe(true);
      expect(isValidAccountStatus('ACTIVE')).toBe(true);
      expect(isValidAccountStatus('SUSPENDED')).toBe(true);
      expect(isValidAccountStatus('INACTIVE')).toBe(true);
      expect(isValidAccountStatus('LOCKED')).toBe(false);
      expect(isValidAccountStatus('DELETED')).toBe(false);
      expect(isValidAccountStatus('')).toBe(false);
      expect(isValidAccountStatus(null)).toBe(false);
    });
  });

  describe('Zod Reusable Validators Integration', () => {
    it('should validate user roles with Zod userRole schema and reject VENUE_MANAGER', () => {
      const roleSchema = userRole();
      expect(roleSchema.safeParse('STUDENT').success).toBe(true);
      expect(roleSchema.safeParse('FACULTY').success).toBe(true);
      expect(roleSchema.safeParse('CLUB_MEMBER').success).toBe(true);
      expect(roleSchema.safeParse('EVENT_ORGANIZER').success).toBe(true);
      expect(roleSchema.safeParse('ADMIN').success).toBe(true);
      expect(roleSchema.safeParse('VENUE_MANAGER').success).toBe(false);
      expect(roleSchema.safeParse('SUPER_ADMIN').success).toBe(false);
      expect(roleSchema.safeParse('MANAGER').success).toBe(false);
    });

    it('should validate account statuses with Zod accountStatus schema', () => {
      const statusSchema = accountStatus();
      expect(statusSchema.safeParse('PENDING').success).toBe(true);
      expect(statusSchema.safeParse('ACTIVE').success).toBe(true);
      expect(statusSchema.safeParse('SUSPENDED').success).toBe(true);
      expect(statusSchema.safeParse('INACTIVE').success).toBe(true);
      expect(statusSchema.safeParse('LOCKED').success).toBe(false);
    });
  });
});
