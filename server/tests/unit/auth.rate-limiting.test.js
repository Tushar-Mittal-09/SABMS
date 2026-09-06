'use strict';

const request = require('supertest');
const argon2 = require('argon2');
const app = require('../../src/app/app');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const authRepository = require('../../src/modules/auth/auth.repository');
const authService = require('../../src/modules/auth/auth.service');
const emailService = require('../../src/services/email.service');
const {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_LOCKOUT_TTL_SECONDS,
  ACCOUNT_LOCKOUT_REDIS_KEY_PREFIX,
  REGISTER_MAX_REQUESTS,
  REGISTER_WINDOW_SECONDS,
} = require('../../src/modules/auth/auth.constants');
const {
  createAccountLockoutRedisKey,
  createRegisterRateLimitRedisKey,
  generateAccessToken,
} = require('../../src/modules/auth/auth.helper');

describe('Sprint 2.17 — Global Rate Limiting & Account Lockout', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Security Admin',
    email: 'admin@university.edu',
    role: USER_ROLES.ADMIN,
    status: ACCOUNT_STATUSES.ACTIVE,
    isEmailVerified: true,
    isPhoneVerified: true,
  };

  const mockTargetUser = {
    _id: '507f1f77bcf86cd799439022',
    name: 'Target Student',
    email: 'student@university.edu',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUSES.ACTIVE,
    isEmailVerified: true,
    isPhoneVerified: true,
  };

  const getAdminAccessToken = () => {
    return generateAccessToken(mockUser);
  };

  const getStudentAccessToken = () => {
    return generateAccessToken(mockTargetUser);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. RATE LIMITING & LOCKOUT CONSTANTS & KEY HELPERS
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Key Helpers and Security Constants', () => {
    it('1.1 exports standard security constants matching SD-13 and SD-14', () => {
      expect(LOGIN_MAX_ATTEMPTS).toBe(5);
      expect(LOGIN_LOCKOUT_TTL_SECONDS).toBe(900); // 15 minutes
      expect(ACCOUNT_LOCKOUT_REDIS_KEY_PREFIX).toBe('lockout:');
      expect(REGISTER_MAX_REQUESTS).toBe(10);
      expect(REGISTER_WINDOW_SECONDS).toBe(3600); // 1 hour
    });

    it('1.2 createAccountLockoutRedisKey constructs normalized Redis lockout key', () => {
      expect(createAccountLockoutRedisKey('USER@Example.COM ')).toBe(
        'lockout:user@example.com'
      );
      expect(createAccountLockoutRedisKey('')).toBe('');
      expect(createAccountLockoutRedisKey(null)).toBe('');
    });

    it('1.3 createRegisterRateLimitRedisKey constructs registration rate limit key', () => {
      expect(createRegisterRateLimitRedisKey('192.168.1.50')).toBe(
        'rl:reg:192.168.1.50'
      );
      expect(createRegisterRateLimitRedisKey('')).toBe('');
      expect(createRegisterRateLimitRedisKey(null)).toBe('');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. REPOSITORY ACCOUNT LOCKOUT OPERATIONS
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Repository Account Lockout Operations', () => {
    it('2.1 getAccountLockout returns unlocked status when key does not exist', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        ttl: jest.fn().mockResolvedValue(-2),
      };
      jest.spyOn(authRepository, '_getRedis').mockReturnValue(mockRedis);
      jest.spyOn(authRepository, '_isRedisUsable').mockReturnValue(true);

      const status = await authRepository.getAccountLockout(
        'test@university.edu'
      );
      expect(status.locked).toBe(false);
      expect(status.attempts).toBe(0);
      expect(status.remainingTtl).toBe(0);
      expect(mockRedis.get).toHaveBeenCalledWith('lockout:test@university.edu');
    });

    it('2.2 recordFailedLoginAttempt sets expiration on first failure and locks on 5th', async () => {
      const mockRedis = {
        incr: jest
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(5),
        expire: jest.fn().mockResolvedValue(1),
        ttl: jest.fn().mockResolvedValue(900),
      };
      jest.spyOn(authRepository, '_getRedis').mockReturnValue(mockRedis);
      jest.spyOn(authRepository, '_isRedisUsable').mockReturnValue(true);

      // Attempt 1: should set expire
      const attempt1 = await authRepository.recordFailedLoginAttempt(
        'test@university.edu'
      );
      expect(attempt1.attempts).toBe(1);
      expect(attempt1.locked).toBe(false);
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'lockout:test@university.edu',
        900
      );

      // Attempt 2: does not reset expire
      const attempt2 = await authRepository.recordFailedLoginAttempt(
        'test@university.edu'
      );
      expect(attempt2.attempts).toBe(2);
      expect(attempt2.locked).toBe(false);

      // Attempt 5: re-applies full lockout TTL
      const attempt5 = await authRepository.recordFailedLoginAttempt(
        'test@university.edu'
      );
      expect(attempt5.attempts).toBe(5);
      expect(attempt5.locked).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledTimes(2);
    });

    it('2.3 clearAccountLockout deletes the Redis lockout key', async () => {
      const mockRedis = {
        del: jest.fn().mockResolvedValue(1),
      };
      jest.spyOn(authRepository, '_getRedis').mockReturnValue(mockRedis);
      jest.spyOn(authRepository, '_isRedisUsable').mockReturnValue(true);

      const result = await authRepository.clearAccountLockout(
        'test@university.edu'
      );
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('lockout:test@university.edu');
    });

    it('2.4 handles offline or unavailable Redis gracefully without throwing', async () => {
      jest.spyOn(authRepository, '_isRedisUsable').mockReturnValue(false);

      const status = await authRepository.getAccountLockout(
        'test@university.edu'
      );
      expect(status.locked).toBe(false);

      const record = await authRepository.recordFailedLoginAttempt(
        'test@university.edu'
      );
      expect(record.locked).toBe(false);

      const clear = await authRepository.clearAccountLockout(
        'test@university.edu'
      );
      expect(clear).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. ACCOUNT LOCKOUT POLICY IN LOGIN (SD-13)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Account Lockout Policy in Login Workflow (SD-13)', () => {
    it('3.1 rejects login immediately with 429 when account is already locked', async () => {
      jest.spyOn(authRepository, 'getAccountLockout').mockResolvedValue({
        attempts: 5,
        locked: true,
        remainingTtl: 840,
      });
      const findSpy = jest.spyOn(authRepository, 'findByEmailWithPasswordHash');

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'student@university.edu',
        password: 'CorrectPassword123!',
      });

      expect(res.status).toBe(429);
      expect(res.body.message).toMatch(
        /Account is temporarily locked due to multiple failed login attempts/
      );
      // Fails fast before database lookup
      expect(findSpy).not.toHaveBeenCalled();
    });

    it('3.2 records failed login attempts and triggers lockout + security email alert on 5th attempt', async () => {
      const passwordHash = await argon2.hash('CorrectPassword123!');
      const targetUser = {
        ...mockTargetUser,
        passwordHash,
      };

      jest.spyOn(authRepository, 'getAccountLockout').mockResolvedValue({
        attempts: 0,
        locked: false,
        remainingTtl: 0,
      });
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(targetUser);

      // Attempts 1 to 4: record attempt and return 401
      jest.spyOn(authRepository, 'recordFailedLoginAttempt').mockResolvedValue({
        attempts: 4,
        locked: false,
        remainingTtl: 850,
      });

      const res1 = await request(app).post('/api/v1/auth/login').send({
        email: 'student@university.edu',
        password: 'WrongPassword!',
      });

      expect(res1.status).toBe(401);
      expect(res1.body.message).toBe('Invalid email or password.');

      // Attempt 5: triggers lockout and email alert
      jest.spyOn(authRepository, 'recordFailedLoginAttempt').mockResolvedValue({
        attempts: 5,
        locked: true,
        remainingTtl: 900,
      });
      const alertSpy = jest
        .spyOn(emailService, 'sendAccountLockoutAlert')
        .mockResolvedValue({ success: true });

      const res5 = await request(app).post('/api/v1/auth/login').send({
        email: 'student@university.edu',
        password: 'WrongPassword!',
      });

      expect(res5.status).toBe(429);
      expect(res5.body.message).toMatch(/Account is temporarily locked/);
      expect(alertSpy).toHaveBeenCalledWith({
        to: targetUser.email,
        name: targetUser.name,
        unlockMinutes: 15,
      });
    });

    it('3.3 records failed attempts even for non-existent users to defend against email enumeration / brute-force', async () => {
      jest.spyOn(authRepository, 'getAccountLockout').mockResolvedValue({
        attempts: 0,
        locked: false,
        remainingTtl: 0,
      });
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(null);

      const recordSpy = jest
        .spyOn(authRepository, 'recordFailedLoginAttempt')
        .mockResolvedValue({
          attempts: 5,
          locked: true,
          remainingTtl: 900,
        });
      const alertSpy = jest.spyOn(emailService, 'sendAccountLockoutAlert');

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@university.edu',
        password: 'SomePassword123!',
      });

      expect(res.status).toBe(429);
      expect(recordSpy).toHaveBeenCalledWith('nonexistent@university.edu');
      // Should NOT attempt to send email since user does not exist
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('3.4 clears account lockout state on successful authentication', async () => {
      const passwordHash = await argon2.hash('CorrectPassword123!');
      const targetUser = {
        ...mockTargetUser,
        passwordHash,
      };

      jest.spyOn(authRepository, 'getAccountLockout').mockResolvedValue({
        attempts: 0,
        locked: false,
        remainingTtl: 0,
      });
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(targetUser);
      jest
        .spyOn(authRepository, 'updateLastLogin')
        .mockResolvedValue(targetUser);
      jest.spyOn(authRepository, 'createRefreshToken').mockResolvedValue({});
      jest.spyOn(authRepository, 'storeSessionCache').mockResolvedValue();

      const clearSpy = jest
        .spyOn(authRepository, 'clearAccountLockout')
        .mockResolvedValue(true);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'student@university.edu',
        password: 'CorrectPassword123!',
      });

      expect(res.status).toBe(200);
      expect(clearSpy).toHaveBeenCalledWith('student@university.edu');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. ADMINISTRATIVE ACCOUNT UNLOCK (SD-14)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Administrative Account Unlock Workflow (SD-14)', () => {
    it('4.1 rejects unlock request without authentication token with 401', async () => {
      const res = await request(app).post('/api/v1/auth/unlock').send({
        email: 'student@university.edu',
      });

      expect(res.status).toBe(401);
    });

    it('4.2 rejects unlock request from non-admin user (e.g. STUDENT) with 403 Forbidden', async () => {
      const studentToken = getStudentAccessToken();

      const res = await request(app)
        .post('/api/v1/auth/unlock')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          email: 'student@university.edu',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access denied/);
    });

    it('4.3 allows ADMIN user to unlock locked account and clears Redis lockout key', async () => {
      const adminToken = getAdminAccessToken();
      const clearSpy = jest
        .spyOn(authRepository, 'clearAccountLockout')
        .mockResolvedValue(true);

      const res = await request(app)
        .post('/api/v1/auth/unlock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'student@university.edu',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unlocked).toBe(true);
      expect(clearSpy).toHaveBeenCalledWith('student@university.edu');
    });

    it('4.4 validates request payload strictly (requires valid email)', async () => {
      const adminToken = getAdminAccessToken();

      const res = await request(app)
        .post('/api/v1/auth/unlock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'invalid-email-string',
        });

      expect(res.status).toBe(422);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. REGISTRATION RATE LIMITING
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Registration Rate Limiter', () => {
    it('5.1 registers rate limiter middleware on /register endpoint', async () => {
      // Send valid mock registration payload
      jest.spyOn(authService, 'register').mockResolvedValue(mockTargetUser);

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'New Registered Student',
        email: 'newstudent@university.edu',
        password: 'ComplexPassword123!',
      });

      expect(res.status).toBe(201);
      expect(res.headers).toHaveProperty('ratelimit-limit');
      expect(Number(res.headers['ratelimit-limit'])).toBe(
        REGISTER_MAX_REQUESTS
      );
    });

    it('5.2 sends account lockout alert email via emailService correctly', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-lockout-123' }),
      };
      jest
        .spyOn(emailService, 'getTransporter')
        .mockReturnValue(mockTransporter);

      const res = await emailService.sendAccountLockoutAlert({
        to: 'lockeduser@university.edu',
        name: 'Locked User',
        unlockMinutes: 15,
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('msg-lockout-123');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'lockeduser@university.edu',
          subject: expect.stringContaining('Security Alert'),
        })
      );
    });
  });
});
