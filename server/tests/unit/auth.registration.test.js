'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/constants');
const { User } = require('../../src/modules/users/models');
const userRepository = require('../../src/modules/users/repositories/User.repository');
const authService = require('../../src/modules/auth/auth.service');
const { registerSchema } = require('../../src/modules/auth/auth.schema');
const {
  formatRegistrationResponse,
} = require('../../src/modules/auth/auth.response');
const {
  verifyPassword,
} = require('../../src/modules/auth/security/password.security');
const AppError = require('../../src/utils/AppError');

describe('User Registration Workflow (Sprint 2.4)', () => {
  const validRegistrationPayload = {
    name: '  Jane Doe  ',
    email: '  Jane.Doe@University.EDU  ',
    phone: '  +1234567890  ',
    password: 'SecurePassword123!',
    department: '  Computer Science  ',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ZOD SCHEMA & VALIDATION CONTRACT TESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('Registration Schema Validation (registerSchema)', () => {
    it('1. should validate and normalize a complete valid registration payload', () => {
      const result = registerSchema.parse(validRegistrationPayload);

      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBe('jane.doe@university.edu');
      expect(result.phone).toBe('+1234567890');
      expect(result.department).toBe('Computer Science');
      // Password must be strictly preserved without silent trimming or mutation
      expect(result.password).toBe('SecurePassword123!');
    });

    it('2. should validate minimal registration payload omitting optional phone and department', () => {
      const minimal = {
        name: 'John Smith',
        email: 'john.smith@university.edu',
        password: 'ValidPassword123!',
      };

      const result = registerSchema.parse(minimal);
      expect(result.name).toBe('John Smith');
      expect(result.email).toBe('john.smith@university.edu');
      expect(result.phone).toBeUndefined();
      expect(result.department).toBeUndefined();
    });

    it('3. should reject missing name (Test Case 2)', () => {
      const missingName = {
        email: 'test@university.edu',
        password: 'ValidPassword123!',
      };
      expect(() => registerSchema.parse(missingName)).toThrow();
    });

    it('4. should reject names shorter than 2 characters or longer than 100 characters', () => {
      expect(() =>
        registerSchema.parse({
          name: 'A',
          email: 'test@university.edu',
          password: 'ValidPassword123!',
        })
      ).toThrow();

      expect(() =>
        registerSchema.parse({
          name: 'A'.repeat(101),
          email: 'test@university.edu',
          password: 'ValidPassword123!',
        })
      ).toThrow();
    });

    it('5. should reject invalid email formats (Test Case 3)', () => {
      const invalidEmails = [
        'notanemail',
        '@missinguser.com',
        'missingdomain@',
        'spaces in@email.com',
        '',
      ];

      invalidEmails.forEach((email) => {
        expect(() =>
          registerSchema.parse({
            name: 'Jane Doe',
            email,
            password: 'ValidPassword123!',
          })
        ).toThrow();
      });
    });

    it('6. should reject invalid phone formats (Test Case 5)', () => {
      const invalidPhones = [
        'abc12345',
        '000-invalid',
        '++1234567',
        'phone123',
      ];

      invalidPhones.forEach((phone) => {
        expect(() =>
          registerSchema.parse({
            name: 'Jane Doe',
            email: 'jane@test.com',
            password: 'ValidPassword123!',
            phone,
          })
        ).toThrow();
      });
    });

    it('7. should reject weak passwords missing complexity requirements (Test Case 6)', () => {
      const weakPasswords = [
        'short1!', // < 8 chars
        'alllowercase123!', // No uppercase
        'ALLUPPERCASE123!', // No lowercase
        'NoNumbersHere!@#', // No number
        'NoSpecialChars1234', // No special char
      ];

      weakPasswords.forEach((password) => {
        expect(() =>
          registerSchema.parse({
            name: 'Jane Doe',
            email: 'jane@test.com',
            password,
          })
        ).toThrow();
      });
    });

    it('8. should reject passwords exceeding 128 characters (Test Case 7)', () => {
      const longPassword = 'A1!' + 'a'.repeat(126);
      expect(() =>
        registerSchema.parse({
          name: 'Jane Doe',
          email: 'jane@test.com',
          password: longPassword,
        })
      ).toThrow();
    });

    it('9. should reject role privilege escalation attempts (Test Case 8)', () => {
      expect(() =>
        registerSchema.parse({
          ...validRegistrationPayload,
          role: 'ADMIN',
        })
      ).toThrow();

      expect(() =>
        registerSchema.parse({
          ...validRegistrationPayload,
          role: 'FACULTY',
        })
      ).toThrow();
    });

    it('10. should reject status privilege escalation attempts (Test Case 9)', () => {
      expect(() =>
        registerSchema.parse({
          ...validRegistrationPayload,
          status: 'ACTIVE',
        })
      ).toThrow();
    });

    it('11. should reject passwordHash injection attempts (Test Case 10)', () => {
      expect(() =>
        registerSchema.parse({
          ...validRegistrationPayload,
          passwordHash: 'injected_precomputed_hash',
        })
      ).toThrow();
    });

    it('12. should reject isEmailVerified / isPhoneVerified / lastLoginAt injections', () => {
      expect(() =>
        registerSchema.parse({
          ...validRegistrationPayload,
          isEmailVerified: true,
        })
      ).toThrow();

      expect(() =>
        registerSchema.parse({
          ...validRegistrationPayload,
          isPhoneVerified: true,
        })
      ).toThrow();

      expect(() =>
        registerSchema.parse({
          ...validRegistrationPayload,
          lastLoginAt: new Date().toISOString(),
        })
      ).toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. RESPONSE SERIALIZATION UNIT TESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('Safe Response Serialization (formatRegistrationResponse)', () => {
    it('13. should format user entity without password, passwordHash, or __v (Test Cases 16 & 17)', () => {
      const mockUserDoc = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Jane Doe',
        email: 'jane.doe@university.edu',
        phone: '+1234567890',
        department: 'Computer Science',
        role: USER_ROLES.STUDENT,
        status: ACCOUNT_STATUSES.PENDING,
        isEmailVerified: false,
        isPhoneVerified: false,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
        __v: 0,
        createdAt: new Date('2026-08-15T12:00:00.000Z'),
        updatedAt: new Date('2026-08-15T12:00:00.000Z'),
      };

      const response = formatRegistrationResponse(mockUserDoc);

      expect(response).toEqual({
        id: '507f1f77bcf86cd799439011',
        name: 'Jane Doe',
        email: 'jane.doe@university.edu',
        phone: '+1234567890',
        department: 'Computer Science',
        role: 'STUDENT',
        status: 'PENDING',
        isEmailVerified: false,
        isPhoneVerified: false,
        createdAt: new Date('2026-08-15T12:00:00.000Z'),
      });

      expect(response.password).toBeUndefined();
      expect(response.passwordHash).toBeUndefined();
      expect(response.__v).toBeUndefined();
    });

    it('14. should handle null user gracefully', () => {
      expect(formatRegistrationResponse(null)).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. AUTH SERVICE UNIT TESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthService Registration Logic', () => {
    it('15. should create new user with STUDENT role and PENDING status (Test Cases 1, 11, 12, 13, 14, 15, 18)', async () => {
      jest.spyOn(userRepository, 'existsByEmail').mockResolvedValue(false);

      let capturedPayload = null;
      jest
        .spyOn(userRepository, 'create')
        .mockImplementation(async (payload) => {
          capturedPayload = payload;
          return new User({
            _id: '507f1f77bcf86cd799439011',
            ...payload,
            createdAt: new Date(),
          });
        });

      const user = await authService.register({
        name: 'Jane Doe',
        email: 'JANE.DOE@UNIVERSITY.EDU',
        phone: '+1234567890',
        password: 'SecurePassword123!',
        department: 'Computer Science',
      });

      expect(user).toBeDefined();
      expect(capturedPayload).toBeDefined();

      // Email normalized
      expect(capturedPayload.email).toBe('jane.doe@university.edu');

      // Canonical defaults enforced
      expect(capturedPayload.role).toBe(USER_ROLES.STUDENT);
      expect(capturedPayload.status).toBe(ACCOUNT_STATUSES.PENDING);
      expect(capturedPayload.isEmailVerified).toBe(false);
      expect(capturedPayload.isPhoneVerified).toBe(false);

      // Repository receives hashed password only (Test Case 18)
      expect(capturedPayload.password).toBeUndefined();
      expect(capturedPayload.passwordHash).toBeDefined();
      expect(capturedPayload.passwordHash.startsWith('$argon2id$')).toBe(true);

      // Argon2id verification succeeds with original plaintext (Test Case 15)
      const isArgon2Valid = await verifyPassword(
        'SecurePassword123!',
        capturedPayload.passwordHash
      );
      expect(isArgon2Valid).toBe(true);
    });

    it('16. should throw 409 Conflict if email already exists (Test Case 4)', async () => {
      jest.spyOn(userRepository, 'existsByEmail').mockResolvedValue(true);
      const createSpy = jest.spyOn(userRepository, 'create');

      await expect(
        authService.register({
          name: 'Jane Doe',
          email: 'existing@university.edu',
          password: 'SecurePassword123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.register({
          name: 'Jane Doe',
          email: 'existing@university.edu',
          password: 'SecurePassword123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(409);
        expect(err.message).toBe('An account with this email already exists');
      }

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('17. should normalize MongoDB duplicate key error code 11000 to 409 Conflict (Test Case 19)', async () => {
      jest.spyOn(userRepository, 'existsByEmail').mockResolvedValue(false);

      const duplicateError = new Error('E11000 duplicate key error collection');
      duplicateError.code = 11000;
      jest.spyOn(userRepository, 'create').mockRejectedValue(duplicateError);

      await expect(
        authService.register({
          name: 'Jane Doe',
          email: 'concurrent@university.edu',
          password: 'SecurePassword123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.register({
          name: 'Jane Doe',
          email: 'concurrent@university.edu',
          password: 'SecurePassword123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(409);
        expect(err.message).toBe('An account with this email already exists');
      }
    });

    it('18. should re-throw unexpected repository errors without modification', async () => {
      jest.spyOn(userRepository, 'existsByEmail').mockResolvedValue(false);

      const dbError = new Error('Database connection lost');
      jest.spyOn(userRepository, 'create').mockRejectedValue(dbError);

      await expect(
        authService.register({
          name: 'Jane Doe',
          email: 'test@university.edu',
          password: 'SecurePassword123!',
        })
      ).rejects.toThrow('Database connection lost');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. HTTP ROUTE & INTEGRATION PIPELINE TESTS (POST /api/v1/auth/register)
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/register HTTP Endpoint', () => {
    it('19. should return HTTP 201 with standardized envelope on successful registration (Test Cases 1, 20)', async () => {
      jest.spyOn(userRepository, 'existsByEmail').mockResolvedValue(false);
      jest
        .spyOn(userRepository, 'create')
        .mockImplementation(async (payload) => {
          return new User({
            _id: '507f1f77bcf86cd799439011',
            ...payload,
            createdAt: new Date('2026-08-15T12:00:00.000Z'),
          });
        });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegistrationPayload)
        .expect(201);

      // Verify Standardized Response Envelope
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data).toBeDefined();

      // Verify payload data
      const data = response.body.data;
      expect(data.id).toBe('507f1f77bcf86cd799439011');
      expect(data.name).toBe('Jane Doe');
      expect(data.email).toBe('jane.doe@university.edu');
      expect(data.phone).toBe('+1234567890');
      expect(data.department).toBe('Computer Science');
      expect(data.role).toBe('STUDENT');
      expect(data.status).toBe('PENDING');
      expect(data.isEmailVerified).toBe(false);
      expect(data.isPhoneVerified).toBe(false);
      expect(data.createdAt).toBeDefined();

      // Verify ZERO sensitive data leakage in response (Test Cases 16 & 17)
      expect(data.password).toBeUndefined();
      expect(data.passwordHash).toBeUndefined();
      expect(data.__v).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('SecurePassword123!');
      expect(JSON.stringify(response.body)).not.toContain('$argon2id$');
    });

    it('20. should succeed with minimal payload omitting phone and department', async () => {
      jest.spyOn(userRepository, 'existsByEmail').mockResolvedValue(false);
      jest
        .spyOn(userRepository, 'create')
        .mockImplementation(async (payload) => {
          return new User({
            _id: '507f1f77bcf86cd799439012',
            ...payload,
            createdAt: new Date('2026-08-15T12:00:00.000Z'),
          });
        });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Alex Smith',
          email: 'alex.smith@university.edu',
          password: 'ValidPassword123!',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Alex Smith');
      expect(response.body.data.email).toBe('alex.smith@university.edu');
      expect(response.body.data.phone).toBeNull();
      expect(response.body.data.department).toBeNull();
      expect(response.body.data.role).toBe('STUDENT');
      expect(response.body.data.status).toBe('PENDING');
    });

    it('21. should return 422 Unprocessable Entity when name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@university.edu',
          password: 'ValidPassword123!',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('22. should return 422 Unprocessable Entity when email is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'invalid-email-format',
          password: 'ValidPassword123!',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('23. should return 422 Unprocessable Entity when password violates complexity policy', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@test.com',
          password: 'weakpassword',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('24. should return 422 Unprocessable Entity when privilege escalation is attempted (role: ADMIN)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegistrationPayload,
          role: 'ADMIN',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('25. should return 422 Unprocessable Entity when status privilege escalation is attempted', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegistrationPayload,
          status: 'ACTIVE',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('26. should return 422 Unprocessable Entity when passwordHash injection is attempted', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegistrationPayload,
          passwordHash: 'injected_hash',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('27. should return 409 Conflict when registering with duplicate email', async () => {
      jest.spyOn(userRepository, 'existsByEmail').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegistrationPayload)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        'An account with this email already exists'
      );
    });

    it('28. should preserve placeholder endpoints for login, logout, and refresh without regression', async () => {
      await request(app).post('/api/v1/auth/login').expect(200);
      await request(app).post('/api/v1/auth/logout').expect(200);
      await request(app).post('/api/v1/auth/refresh').expect(200);
    });
  });
});
