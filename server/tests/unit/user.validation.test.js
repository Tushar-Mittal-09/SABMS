'use strict';

const {
  createUserSchema,
  adminCreateUserSchema,
  updateUserSchema,
  adminUpdateUserSchema,
  userIdParamSchema,
  userFilterQuerySchema,
  validators,
} = require('../../src/validations');

describe('User Credential Validation Contracts (Sprint 2.2.5)', () => {
  describe('Name Validation', () => {
    const nameSchema = validators.nameField({ required: true });

    it('should accept valid names between 2 and 100 characters and trim whitespace', () => {
      expect(nameSchema.parse('  Jane Doe  ')).toBe('Jane Doe');
      expect(nameSchema.parse('AB')).toBe('AB');
      expect(nameSchema.parse("O'Connor")).toBe("O'Connor");
      expect(nameSchema.parse('Dr. Mary-Jane')).toBe('Dr. Mary-Jane');
      expect(nameSchema.parse('A'.repeat(100))).toHaveLength(100);
    });

    it('should reject names shorter than 2 or longer than 100 characters', () => {
      expect(() => nameSchema.parse('A')).toThrow();
      expect(() => nameSchema.parse('A'.repeat(101))).toThrow();
      expect(() => nameSchema.parse('')).toThrow();
    });
  });

  describe('Email Validation', () => {
    const emailSchema = validators.email({ required: true });

    it('should accept valid email and normalize to lowercase and trim', () => {
      expect(emailSchema.parse('  Jane.Doe@University.EDU  ')).toBe(
        'jane.doe@university.edu'
      );
    });

    it('should reject malformed or missing emails', () => {
      expect(() => emailSchema.parse('notanemail')).toThrow();
      expect(() => emailSchema.parse('@domain.com')).toThrow();
      expect(() => emailSchema.parse('')).toThrow();
    });
  });

  describe('Phone Validation', () => {
    const phoneSchema = validators.phone({ required: false });

    it('should accept valid E.164 phone numbers and trim whitespace', () => {
      expect(phoneSchema.parse('  +1234567890  ')).toBe('+1234567890');
      expect(phoneSchema.parse('+919876543210')).toBe('+919876543210');
    });

    it('should allow omitted phone number when optional', () => {
      expect(phoneSchema.parse(undefined)).toBeUndefined();
    });

    it('should reject invalid phone format strings', () => {
      expect(() => phoneSchema.parse('abc12345')).toThrow();
      expect(() => phoneSchema.parse('000-invalid')).toThrow();
    });
  });

  describe('Department Validation', () => {
    const deptSchema = validators.departmentField({ required: false });

    it('should accept free-form department string and trim whitespace', () => {
      expect(deptSchema.parse('  Computer Science & Engineering  ')).toBe(
        'Computer Science & Engineering'
      );
      expect(deptSchema.parse(undefined)).toBeUndefined();
    });

    it('should reject department exceeding 100 characters', () => {
      expect(() => deptSchema.parse('D'.repeat(101))).toThrow();
    });
  });

  describe('createUserSchema (Public Request Contract)', () => {
    it('should validate valid user registration payload', () => {
      const payload = {
        name: '  Jane Doe  ',
        email: 'Jane@University.edu',
        phone: '+1234567890',
        department: 'Physics',
      };

      const result = createUserSchema.parse(payload);
      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBe('jane@university.edu');
      expect(result.phone).toBe('+1234567890');
      expect(result.department).toBe('Physics');
    });

    it('should validate minimal registration payload without optional fields', () => {
      const minimal = {
        name: 'Jane Doe',
        email: 'jane@test.com',
      };

      const result = createUserSchema.parse(minimal);
      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBe('jane@test.com');
      expect(result.phone).toBeUndefined();
      expect(result.department).toBeUndefined();
    });

    it('should reject missing required fields', () => {
      expect(() => createUserSchema.parse({ name: 'Jane' })).toThrow();
      expect(() =>
        createUserSchema.parse({ email: 'jane@test.com' })
      ).toThrow();
    });
  });

  describe('adminCreateUserSchema (Administrative Request Contract)', () => {
    it('should accept canonical roles and statuses', () => {
      const adminPayload = {
        name: 'Faculty User',
        email: 'faculty@test.com',
        role: 'FACULTY',
        status: 'ACTIVE',
      };

      const result = adminCreateUserSchema.parse(adminPayload);
      expect(result.role).toBe('FACULTY');
      expect(result.status).toBe('ACTIVE');
    });

    it('should reject non-canonical roles and statuses in admin contract', () => {
      expect(() =>
        adminCreateUserSchema.parse({
          name: 'Jane',
          email: 'jane@test.com',
          role: 'VENUE_MANAGER',
        })
      ).toThrow();

      expect(() =>
        adminCreateUserSchema.parse({
          name: 'Jane',
          email: 'jane@test.com',
          status: 'LOCKED',
        })
      ).toThrow();
    });
  });

  describe('updateUserSchema (Self Profile Update Contract)', () => {
    it('should allow updating safe profile attributes', () => {
      const updateData = {
        name: 'Jane Smith',
        department: 'Mathematics',
      };

      const result = updateUserSchema.parse(updateData);
      expect(result.name).toBe('Jane Smith');
      expect(result.department).toBe('Mathematics');
    });

    it('should reject unrecognized/privileged attributes due to strict schema', () => {
      expect(() =>
        updateUserSchema.parse({
          name: 'Jane',
          role: 'ADMIN',
        })
      ).toThrow();

      expect(() =>
        updateUserSchema.parse({
          name: 'Jane',
          status: 'ACTIVE',
        })
      ).toThrow();

      expect(() =>
        updateUserSchema.parse({
          name: 'Jane',
          passwordHash: 'injected_hash',
        })
      ).toThrow();
    });
  });

  describe('adminUpdateUserSchema', () => {
    it('should allow updating role and status when submitted by admin', () => {
      const adminUpdate = {
        role: 'EVENT_ORGANIZER',
        status: 'SUSPENDED',
      };

      const result = adminUpdateUserSchema.parse(adminUpdate);
      expect(result.role).toBe('EVENT_ORGANIZER');
      expect(result.status).toBe('SUSPENDED');
    });
  });

  describe('userIdParamSchema & userFilterQuerySchema', () => {
    it('should validate valid 24-character hex ObjectId and reject invalid strings', () => {
      expect(
        userIdParamSchema.parse({ id: '507f1f77bcf86cd799439011' }).id
      ).toBe('507f1f77bcf86cd799439011');

      expect(() => userIdParamSchema.parse({ id: 'invalid-id' })).toThrow();
    });

    it('should parse user query filter params with pagination defaults', () => {
      const query = userFilterQuerySchema.parse({
        page: '2',
        limit: '20',
        role: 'STUDENT',
      });

      expect(query.page).toBe(2);
      expect(query.limit).toBe(20);
      expect(query.role).toBe('STUDENT');
    });
  });
});
