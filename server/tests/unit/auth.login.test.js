'use strict';

const request = require('supertest');
const app = require('../../src/app/app');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const User = require('../../src/modules/users/user.model');
const authRepository = require('../../src/modules/auth/auth.repository');
const authService = require('../../src/modules/auth/auth.service');
const { loginSchema } = require('../../src/modules/auth/auth.schema');
const { formatLoginResponse } = require('../../src/modules/auth/auth.response');
const { hashPassword } = require('../../src/services/password.service');
const AppError = require('../../src/core/errors/AppError');

describe('User Login Authentication Workflow (Sprint 2.7)', () => {
  let validPasswordHash;
  let mockActiveUser;
  let mockPendingUser;
  let mockSuspendedUser;
  let mockInactiveUser;

  beforeAll(async () => {
    validPasswordHash = await hashPassword('ValidPass123!');
  });

  beforeEach(() => {
    mockActiveUser = new User({
      _id: '64a7f8e9c1d2e3f4a5b6c7d8',
      name: 'Jane Doe',
      email: 'jane.doe@university.edu',
      phone: '+919876543210',
      department: 'Computer Science',
      passwordHash: validPasswordHash,
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUSES.ACTIVE,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date('2026-08-15T12:00:00.000Z'),
    });

    mockPendingUser = new User({
      _id: '64a7f8e9c1d2e3f4a5b6c7d9',
      name: 'Unverified Student',
      email: 'pending.student@university.edu',
      passwordHash: validPasswordHash,
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUSES.PENDING,
      isEmailVerified: false,
      isPhoneVerified: false,
      createdAt: new Date('2026-08-15T12:00:00.000Z'),
    });

    mockSuspendedUser = new User({
      _id: '64a7f8e9c1d2e3f4a5b6c7da',
      name: 'Suspended Faculty',
      email: 'suspended.faculty@university.edu',
      passwordHash: validPasswordHash,
      role: USER_ROLES.FACULTY,
      status: ACCOUNT_STATUSES.SUSPENDED,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date('2026-08-15T12:00:00.000Z'),
    });

    mockInactiveUser = new User({
      _id: '64a7f8e9c1d2e3f4a5b6c7db',
      name: 'Inactive Admin',
      email: 'inactive.admin@university.edu',
      passwordHash: validPasswordHash,
      role: USER_ROLES.ADMIN,
      status: ACCOUNT_STATUSES.INACTIVE,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date('2026-08-15T12:00:00.000Z'),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ZOD SCHEMA VALIDATION (loginSchema)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Login Schema Validation (loginSchema)', () => {
    it('1. should validate and normalize a valid login payload', () => {
      const input = {
        email: '  STUDENT@University.EDU  ',
        password: 'ValidPass123!',
      };

      const parsed = loginSchema.parse(input);
      expect(parsed.email).toBe('student@university.edu');
      expect(parsed.password).toBe('ValidPass123!');
    });

    it('2. should NEVER silently trim or mutate the password string', () => {
      const input = {
        email: 'student@university.edu',
        password: '  SpacesInPassword123!  ',
      };

      const parsed = loginSchema.parse(input);
      expect(parsed.password).toBe('  SpacesInPassword123!  ');
    });

    it('3. should reject missing email', () => {
      const input = {
        password: 'ValidPass123!',
      };

      expect(() => loginSchema.parse(input)).toThrow();
    });

    it('4. should reject invalid email format', () => {
      const input = {
        email: 'not-an-email',
        password: 'ValidPass123!',
      };

      expect(() => loginSchema.parse(input)).toThrow();
    });

    it('5. should reject missing password', () => {
      const input = {
        email: 'student@university.edu',
      };

      expect(() => loginSchema.parse(input)).toThrow();
    });

    it('6. should reject empty password string', () => {
      const input = {
        email: 'student@university.edu',
        password: '',
      };

      expect(() => loginSchema.parse(input)).toThrow();
    });

    it('7. should strictly reject unknown fields (privilege escalation defense)', () => {
      const input = {
        email: 'student@university.edu',
        password: 'ValidPass123!',
        role: 'ADMIN',
      };

      expect(() => loginSchema.parse(input)).toThrow();
    });

    it('8. should strictly reject status injection attempts', () => {
      const input = {
        email: 'student@university.edu',
        password: 'ValidPass123!',
        status: 'ACTIVE',
      };

      expect(() => loginSchema.parse(input)).toThrow();
    });

    it('9. should strictly reject passwordHash injection attempts', () => {
      const input = {
        email: 'student@university.edu',
        password: 'ValidPass123!',
        passwordHash: '$argon2id$...',
      };

      expect(() => loginSchema.parse(input)).toThrow();
    });

    it('10. should strictly reject verification state injection attempts', () => {
      const input = {
        email: 'student@university.edu',
        password: 'ValidPass123!',
        isEmailVerified: true,
        isPhoneVerified: true,
      };

      expect(() => loginSchema.parse(input)).toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SAFE RESPONSE SERIALIZATION (auth.response.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Safe Domain Response Serialization (formatLoginResponse)', () => {
    it('11. should format user entity without password, passwordHash, or __v', () => {
      const response = formatLoginResponse(mockActiveUser);

      expect(response).toBeDefined();
      expect(response.id).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
      expect(response.name).toBe('Jane Doe');
      expect(response.email).toBe('jane.doe@university.edu');
      expect(response.phone).toBe('+919876543210');
      expect(response.department).toBe('Computer Science');
      expect(response.role).toBe(USER_ROLES.STUDENT);
      expect(response.status).toBe(ACCOUNT_STATUSES.ACTIVE);
      expect(response.isEmailVerified).toBe(true);
      expect(response.isPhoneVerified).toBe(true);

      // Security Invariants: No secrets or internal properties
      expect(response.password).toBeUndefined();
      expect(response.passwordHash).toBeUndefined();
      expect(response.__v).toBeUndefined();
      expect(response.otp).toBeUndefined();
      expect(response.otpHash).toBeUndefined();
      expect(response.accessToken).toBeUndefined(); // Scope constraint: No JWT in 2.7
    });

    it('12. should handle null user gracefully', () => {
      expect(formatLoginResponse(null)).toBeNull();
      expect(formatLoginResponse(undefined)).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. AUTH SERVICE BUSINESS WORKFLOW (auth.service.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthService.login Business Logic', () => {
    it('13. should authenticate valid active user and update lastLoginAt', async () => {
      const findSpy = jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);

      const updateLoginSpy = jest
        .spyOn(authRepository, 'updateLastLogin')
        .mockResolvedValue(
          new User({
            ...mockActiveUser.toObject(),
            lastLoginAt: new Date(),
          })
        );

      const user = await authService.login({
        email: 'JANE.DOE@UNIVERSITY.EDU',
        password: 'ValidPass123!',
      });

      expect(findSpy).toHaveBeenCalledWith('jane.doe@university.edu');
      expect(updateLoginSpy).toHaveBeenCalledWith(
        mockActiveUser._id,
        expect.any(Date)
      );
      expect(user).toBeDefined();
      expect(user.email).toBe('jane.doe@university.edu');
    });

    it('14. should reject non-existent user with generic 401 Unauthorized (anti-enumeration)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@university.edu',
          password: 'ValidPass123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.login({
          email: 'nonexistent@university.edu',
          password: 'ValidPass123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid email or password.');
      }
    });

    it('15. should reject incorrect password with generic 401 Unauthorized', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);

      await expect(
        authService.login({
          email: 'jane.doe@university.edu',
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.login({
          email: 'jane.doe@university.edu',
          password: 'WrongPassword123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid email or password.');
      }
    });

    it('16. should reject unverified email account with 403 Forbidden (AUTH_ACCOUNT_UNVERIFIED)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockPendingUser);

      await expect(
        authService.login({
          email: 'pending.student@university.edu',
          password: 'ValidPass123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.login({
          email: 'pending.student@university.edu',
          password: 'ValidPass123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe(
          'Account not verified. Please verify your email with the OTP code.'
        );
      }
    });

    it('17. should reject SUSPENDED account with 403 Forbidden (AUTH_ACCOUNT_DISABLED)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockSuspendedUser);

      await expect(
        authService.login({
          email: 'suspended.faculty@university.edu',
          password: 'ValidPass123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.login({
          email: 'suspended.faculty@university.edu',
          password: 'ValidPass123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe(
          'Your account has been deactivated. Please contact support.'
        );
      }
    });

    it('18. should reject INACTIVE account with 403 Forbidden (AUTH_ACCOUNT_DISABLED)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockInactiveUser);

      await expect(
        authService.login({
          email: 'inactive.admin@university.edu',
          password: 'ValidPass123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.login({
          email: 'inactive.admin@university.edu',
          password: 'ValidPass123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe(
          'Your account has been deactivated. Please contact support.'
        );
      }
    });

    it('19. should re-throw unexpected repository errors without leaking internal details', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockRejectedValue(new Error('MongoDB cluster unreachable'));

      await expect(
        authService.login({
          email: 'jane.doe@university.edu',
          password: 'ValidPass123!',
        })
      ).rejects.toThrow('MongoDB cluster unreachable');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. HTTP API ENDPOINT INTEGRATION (POST /api/v1/auth/login)
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/login HTTP Endpoint', () => {
    it('20. should return HTTP 200 with sanitized user envelope on successful login', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);
      jest
        .spyOn(authRepository, 'updateLastLogin')
        .mockResolvedValue(mockActiveUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'jane.doe@university.edu',
        password: 'ValidPass123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Authentication successful.');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
      expect(res.body.data.email).toBe('jane.doe@university.edu');
      expect(res.body.data.role).toBe(USER_ROLES.STUDENT);

      // Verify no sensitive fields leaked
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data.__v).toBeUndefined();
    });

    it('21. should return 422 Unprocessable Entity when request body contains unknown/injected fields', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'jane.doe@university.edu',
        password: 'ValidPass123!',
        role: 'ADMIN',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('22. should return 422 Unprocessable Entity when email is invalid', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'invalid-email',
        password: 'ValidPass123!',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('23. should return 422 Unprocessable Entity when password is empty', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'jane.doe@university.edu',
        password: '',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('24. should return 401 Unauthorized for incorrect credentials', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'jane.doe@university.edu',
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('25. should return 401 Unauthorized for non-existent account without enumeration', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(null);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'ghost@university.edu',
        password: 'ValidPass123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('26. should return 403 Forbidden for unverified account', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockPendingUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'pending.student@university.edu',
        password: 'ValidPass123!',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Account not verified. Please verify your email with the OTP code.'
      );
    });

    it('27. should return 403 Forbidden for suspended account', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockSuspendedUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'suspended.faculty@university.edu',
        password: 'ValidPass123!',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Your account has been deactivated. Please contact support.'
      );
    });
  });
});
