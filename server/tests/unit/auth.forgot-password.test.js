'use strict';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app/app');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const authRepository = require('../../src/modules/auth/auth.repository');
const authService = require('../../src/modules/auth/auth.service');
const emailService = require('../../src/services/email.service');
const logger = require('../../src/core/logger');
const { forgotPasswordSchema } = require('../../src/modules/auth/auth.schema');
const {
  generatePasswordResetOtp,
  hashPasswordResetOtp,
  verifyPasswordResetOtpHash,
  normalizeEmail,
  createPasswordResetOtpRedisKey,
  createPasswordResetCooldownRedisKey,
  createPasswordResetRateRedisKey,
} = require('../../src/modules/auth/auth.helper');
const {
  PASSWORD_RESET_OTP_LENGTH,
  PASSWORD_RESET_OTP_TTL_SECONDS,
  PASSWORD_RESET_OTP_COOLDOWN_SECONDS,
  PASSWORD_RESET_OTP_MAX_REQUESTS,
  PASSWORD_RESET_OTP_RATE_WINDOW_SECONDS,
} = require('../../src/modules/auth/auth.constants');
const AppError = require('../../src/core/errors/AppError');

describe('Sprint 2.12 — Forgot Password Workflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockExistingUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Jane Doe',
    email: 'jane.doe@university.edu',
    phone: '+1234567890',
    department: 'Computer Science',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUSES.ACTIVE,
    isEmailVerified: true,
    isPhoneVerified: true,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$hashvalue',
    createdAt: new Date('2026-08-15T12:00:00.000Z'),
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CRYPTOGRAPHIC OTP GENERATION & HELPERS (auth.helper.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Cryptographic OTP Generation & Helpers', () => {
    it('1. should generate exactly 6-digit numeric OTP', () => {
      for (let i = 0; i < 50; i++) {
        const otp = generatePasswordResetOtp(PASSWORD_RESET_OTP_LENGTH);
        expect(typeof otp).toBe('string');
        expect(otp).toHaveLength(6);
        expect(/^\d{6}$/.test(otp)).toBe(true);
      }
    });

    it('2. should use cryptographically secure randomness (crypto.randomInt)', () => {
      const randomIntSpy = jest.spyOn(crypto, 'randomInt');
      const otp = generatePasswordResetOtp(6);

      expect(randomIntSpy).toHaveBeenCalledWith(0, 1000000);
      expect(otp).toHaveLength(6);
    });

    it('3. should support leading zeroes with proper zero-padding', () => {
      jest.spyOn(crypto, 'randomInt').mockReturnValue(42);
      const otp = generatePasswordResetOtp(6);
      expect(otp).toBe('000042');
      expect(otp).toHaveLength(6);

      jest.spyOn(crypto, 'randomInt').mockReturnValue(0);
      const zeroOtp = generatePasswordResetOtp(6);
      expect(zeroOtp).toBe('000000');
    });

    it('4. should compute HMAC-SHA256 hash and verify timing-safe comparison correctly', () => {
      const otp = '719302';
      const secret = 'test-secret-key-12345';
      const hash = hashPasswordResetOtp(otp, secret);

      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64);

      // Correct OTP matches
      expect(verifyPasswordResetOtpHash(otp, hash, secret)).toBe(true);

      // Wrong OTP fails
      expect(verifyPasswordResetOtpHash('719303', hash, secret)).toBe(false);
      expect(verifyPasswordResetOtpHash('000000', hash, secret)).toBe(false);
      expect(verifyPasswordResetOtpHash('', hash, secret)).toBe(false);
      expect(verifyPasswordResetOtpHash(null, hash, secret)).toBe(false);
    });

    it('5. should safely reject malformed or invalid hashes without throwing', () => {
      expect(verifyPasswordResetOtpHash('123456', 'short-invalid-hash')).toBe(
        false
      );
      expect(verifyPasswordResetOtpHash('123456', null)).toBe(false);
      expect(verifyPasswordResetOtpHash('123456', undefined)).toBe(false);
    });

    it('6. should construct dedicated password reset Redis keys', () => {
      const rawEmail = '  Jane.Doe@University.EDU  ';
      expect(normalizeEmail(rawEmail)).toBe('jane.doe@university.edu');

      expect(createPasswordResetOtpRedisKey(rawEmail)).toBe(
        'auth:otp:reset:jane.doe@university.edu'
      );
      expect(createPasswordResetCooldownRedisKey(rawEmail)).toBe(
        'auth:otp:reset:cooldown:jane.doe@university.edu'
      );
      expect(createPasswordResetRateRedisKey(rawEmail)).toBe(
        'auth:otp:reset:rate:jane.doe@university.edu'
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SCHEMA VALIDATION & BOUNDARY PROTECTION (auth.schema.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Zod Schema Validation & Boundary Protection', () => {
    it('7. should validate and normalize valid email', () => {
      const parsed = forgotPasswordSchema.parse({
        email: '  Jane.Doe@University.EDU  ',
      });
      expect(parsed.email).toBe('jane.doe@university.edu');
    });

    it('8. should reject invalid email format', () => {
      expect(() =>
        forgotPasswordSchema.parse({ email: 'not-an-email' })
      ).toThrow();
      expect(() => forgotPasswordSchema.parse({ email: '' })).toThrow();
      expect(() => forgotPasswordSchema.parse({})).toThrow();
    });

    it('9. should strictly reject unexpected fields (password, otp, resetToken, etc.)', () => {
      const maliciousBodies = [
        { email: 'user@example.com', password: 'Password123!' },
        { email: 'user@example.com', otp: '123456' },
        { email: 'user@example.com', newPassword: 'NewPassword123!' },
        { email: 'user@example.com', role: 'ADMIN' },
        { email: 'user@example.com', resetToken: 'some-token' },
      ];

      maliciousBodies.forEach((body) => {
        expect(() => forgotPasswordSchema.parse(body)).toThrow();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. EMAIL DISPATCH SERVICE (email.service.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Email Dispatch Service for Password Reset', () => {
    it('10. should dispatch password reset OTP email with proper content and expiry note', async () => {
      const sendMailMock = jest.fn().mockResolvedValue({
        messageId: '<reset-message-id-98765@sabms.edu>',
      });

      jest.spyOn(emailService, 'getTransporter').mockReturnValue({
        sendMail: sendMailMock,
      });

      const result = await emailService.sendPasswordResetOtp({
        to: 'jane.doe@university.edu',
        name: 'Jane Doe',
        otp: '654321',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<reset-message-id-98765@sabms.edu>');
      expect(sendMailMock).toHaveBeenCalledTimes(1);

      const callArgs = sendMailMock.mock.calls[0][0];
      expect(callArgs.to).toBe('jane.doe@university.edu');
      expect(callArgs.subject).toBe('Reset your SABMS password');
      expect(callArgs.text).toContain('654321');
      expect(callArgs.text).toContain('5 minutes');
      expect(callArgs.html).toContain('654321');
      expect(callArgs.html).toContain('Jane Doe');
      expect(callArgs.html).toContain('5 minutes');
    });

    it('11. should NEVER log plaintext OTP in logger when sending reset email', async () => {
      const loggerInfoSpy = jest.spyOn(logger, 'info');
      const sendMailMock = jest
        .fn()
        .mockResolvedValue({ messageId: 'msg-reset-1' });

      jest.spyOn(emailService, 'getTransporter').mockReturnValue({
        sendMail: sendMailMock,
      });

      await emailService.sendPasswordResetOtp({
        to: 'jane.doe@university.edu',
        name: 'Jane Doe',
        otp: '887766',
      });

      loggerInfoSpy.mock.calls.forEach((call) => {
        const fullLogStr = JSON.stringify(call);
        expect(fullLogStr).not.toContain('887766');
      });
    });

    it('12. should handle email service failure safely and return error object', async () => {
      jest.spyOn(emailService, 'getTransporter').mockReturnValue({
        sendMail: jest
          .fn()
          .mockRejectedValue(new Error('SMTP connection timed out')),
      });

      const result = await emailService.sendPasswordResetOtp({
        to: 'jane.doe@university.edu',
        name: 'Jane Doe',
        otp: '112233',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection timed out');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. BUSINESS LOGIC & ENUMERATION PROTECTION (auth.service.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthService.forgotPassword Business Logic', () => {
    it('13. should handle existing user: generate OTP, hash it, store in Redis with 300s TTL, and dispatch email', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(0);
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);

      const storeOtpSpy = jest
        .spyOn(authRepository, 'storePasswordResetOtp')
        .mockResolvedValue('OK');
      const setCooldownSpy = jest
        .spyOn(authRepository, 'setPasswordResetCooldown')
        .mockResolvedValue('OK');
      const incrRateSpy = jest
        .spyOn(authRepository, 'incrementPasswordResetRequestCount')
        .mockResolvedValue(1);
      const emailSpy = jest
        .spyOn(emailService, 'sendPasswordResetOtp')
        .mockResolvedValue({ success: true, messageId: 'msg-reset-ok' });

      const result = await authService.forgotPassword(
        '  Jane.Doe@University.EDU  '
      );

      expect(result).toEqual({ success: true });
      expect(storeOtpSpy).toHaveBeenCalledTimes(1);

      const [storedEmail, storedData, storedTtl] = storeOtpSpy.mock.calls[0];
      expect(storedEmail).toBe('jane.doe@university.edu');
      expect(storedTtl).toBe(PASSWORD_RESET_OTP_TTL_SECONDS); // 300
      expect(storedData.otpHash).toBeDefined();
      expect(storedData.otpHash).toHaveLength(64);
      // Plaintext OTP must NOT be stored
      expect(storedData.otp).toBeUndefined();
      expect(storedData.attempts).toBe(0);

      expect(setCooldownSpy).toHaveBeenCalledWith(
        'jane.doe@university.edu',
        PASSWORD_RESET_OTP_COOLDOWN_SECONDS
      );
      expect(incrRateSpy).toHaveBeenCalledWith(
        'jane.doe@university.edu',
        PASSWORD_RESET_OTP_RATE_WINDOW_SECONDS
      );

      expect(emailSpy).toHaveBeenCalledTimes(1);
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane.doe@university.edu',
          name: 'Jane Doe',
          otp: expect.stringMatching(/^\d{6}$/),
        })
      );
    });

    it('14. should handle non-existing user: return generic success WITHOUT generating OTP or sending email', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(0);
      jest.spyOn(authRepository, 'findByEmail').mockResolvedValue(null);

      const storeOtpSpy = jest.spyOn(authRepository, 'storePasswordResetOtp');
      const setCooldownSpy = jest
        .spyOn(authRepository, 'setPasswordResetCooldown')
        .mockResolvedValue('OK');
      const incrRateSpy = jest
        .spyOn(authRepository, 'incrementPasswordResetRequestCount')
        .mockResolvedValue(1);
      const emailSpy = jest.spyOn(emailService, 'sendPasswordResetOtp');

      const result = await authService.forgotPassword(
        'nonexistent@university.edu'
      );

      expect(result).toEqual({ success: true });
      // Crucial security invariants:
      expect(storeOtpSpy).not.toHaveBeenCalled();
      expect(emailSpy).not.toHaveBeenCalled();
      // Cooldown and rate limit must still be recorded to prevent enumeration
      expect(setCooldownSpy).toHaveBeenCalledWith(
        'nonexistent@university.edu',
        PASSWORD_RESET_OTP_COOLDOWN_SECONDS
      );
      expect(incrRateSpy).toHaveBeenCalledWith(
        'nonexistent@university.edu',
        PASSWORD_RESET_OTP_RATE_WINDOW_SECONDS
      );
    });

    it('15. should enforce 60s request cooldown with generic 429 Too Many Requests', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: true,
        ttlRemaining: 42,
      });

      await expect(
        authService.forgotPassword('jane.doe@university.edu')
      ).rejects.toThrow(AppError);

      try {
        await authService.forgotPassword('jane.doe@university.edu');
      } catch (err) {
        expect(err.statusCode).toBe(429);
        expect(err.message).toBe(
          'Too many password reset requests. Please try again later.'
        );
        // Must NOT leak seconds remaining or account existence
        expect(err.message).not.toContain('42');
        expect(err.message).not.toContain('account');
      }
    });

    it('16. should enforce hourly rate limit (max 3 requests) with generic 429 Too Many Requests', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(PASSWORD_RESET_OTP_MAX_REQUESTS);

      await expect(
        authService.forgotPassword('jane.doe@university.edu')
      ).rejects.toThrow(AppError);

      try {
        await authService.forgotPassword('jane.doe@university.edu');
      } catch (err) {
        expect(err.statusCode).toBe(429);
        expect(err.message).toBe(
          'Too many password reset requests. Please try again later.'
        );
      }
    });

    it('17. should cleanup stored OTP in Redis if email dispatch fails', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(0);
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'storePasswordResetOtp')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'setPasswordResetCooldown')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'incrementPasswordResetRequestCount')
        .mockResolvedValue(1);

      const deleteOtpSpy = jest
        .spyOn(authRepository, 'deletePasswordResetOtp')
        .mockResolvedValue(1);

      jest.spyOn(emailService, 'sendPasswordResetOtp').mockResolvedValue({
        success: false,
        error: 'SMTP relay connection refused',
      });

      await expect(
        authService.forgotPassword('jane.doe@university.edu')
      ).rejects.toThrow(AppError);

      // Stored OTP must be deleted on failure
      expect(deleteOtpSpy).toHaveBeenCalledWith('jane.doe@university.edu');

      try {
        await authService.forgotPassword('jane.doe@university.edu');
      } catch (err) {
        expect(err.statusCode).toBe(500);
        // Must NOT leak internal SMTP error to the user
        expect(err.message).not.toContain('SMTP');
        expect(err.message).toBe(
          'Failed to process password reset request. Please try again.'
        );
      }
    });

    it('18. should handle Redis failure safely and throw 500 internal error', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(0);
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'storePasswordResetOtp')
        .mockRejectedValue(new Error('Redis connection lost'));
      jest
        .spyOn(authRepository, 'setPasswordResetCooldown')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'incrementPasswordResetRequestCount')
        .mockResolvedValue(1);

      await expect(
        authService.forgotPassword('jane.doe@university.edu')
      ).rejects.toThrow(AppError);

      try {
        await authService.forgotPassword('jane.doe@university.edu');
      } catch (err) {
        expect(err.statusCode).toBe(500);
        expect(err.message).toBe('Temporary service error. Please try again.');
        expect(err.message).not.toContain('Redis');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. HTTP ENDPOINT TESTS: POST /api/v1/auth/forgot-password
  // ───────────────────────────────────────────────────────────────────────────
  describe('HTTP Endpoint: POST /api/v1/auth/forgot-password', () => {
    it('19. should return HTTP 200 with identical generic response for existing user', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(0);
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'storePasswordResetOtp')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'setPasswordResetCooldown')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'incrementPasswordResetRequestCount')
        .mockResolvedValue(1);
      jest
        .spyOn(emailService, 'sendPasswordResetOtp')
        .mockResolvedValue({ success: true, messageId: 'msg-1' });

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'jane.doe@university.edu' })
        .expect(200);

      expect(res.body).toEqual({
        success: true,
        message:
          'If an account exists with this email, a reset code has been sent.',
        data: null,
        meta: null,
      });

      // Strict anti-leakage checks
      expect(res.body.otp).toBeUndefined();
      expect(res.body.userExists).toBeUndefined();
      expect(res.body.emailSent).toBeUndefined();
    });

    it('20. should return EXACTLY identical HTTP 200 generic response for non-existing user (Zero Enumeration)', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(0);
      jest.spyOn(authRepository, 'findByEmail').mockResolvedValue(null);
      jest
        .spyOn(authRepository, 'setPasswordResetCooldown')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'incrementPasswordResetRequestCount')
        .mockResolvedValue(1);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'unknown.ghost@university.edu' })
        .expect(200);

      expect(res.body).toEqual({
        success: true,
        message:
          'If an account exists with this email, a reset code has been sent.',
        data: null,
        meta: null,
      });

      expect(res.body.otp).toBeUndefined();
      expect(res.body.userExists).toBeUndefined();
      expect(res.body.emailSent).toBeUndefined();
    });

    it('21. should reject invalid email with HTTP 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-a-valid-email' })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('22. should reject missing email with HTTP 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({})
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('23. should reject request with extra properties with HTTP 422 Unprocessable Entity (.strict())', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'jane.doe@university.edu',
          password: 'AttemptedPasswordChange!',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('24. should return 429 when cooldown is active without leaking account existence', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: true,
        ttlRemaining: 55,
      });

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'jane.doe@university.edu' })
        .expect(429);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Too many password reset requests. Please try again later.'
      );
      expect(JSON.stringify(res.body)).not.toContain('55');
    });

    it('25. should return 429 when hourly rate limit is exceeded without leaking account existence', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(PASSWORD_RESET_OTP_MAX_REQUESTS);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'jane.doe@university.edu' })
        .expect(429);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Too many password reset requests. Please try again later.'
      );
    });

    it('26. should normalize email with whitespace and uppercase characters', async () => {
      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(0);
      const findByEmailSpy = jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'storePasswordResetOtp')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'setPasswordResetCooldown')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'incrementPasswordResetRequestCount')
        .mockResolvedValue(1);
      jest
        .spyOn(emailService, 'sendPasswordResetOtp')
        .mockResolvedValue({ success: true, messageId: 'msg-norm' });

      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: '  JANE.DOE@UNIVERSITY.EDU  ' })
        .expect(200);

      expect(findByEmailSpy).toHaveBeenCalledWith('jane.doe@university.edu');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. INVARIANT CHECKS: USER & PASSWORD STATE NEVER MUTATED
  // ───────────────────────────────────────────────────────────────────────────
  describe('Security Invariants: Zero Mutation & Boundary Preservation', () => {
    it('27. should NOT mutate existing user data or passwordHash in MongoDB', async () => {
      const originalPasswordHash = mockExistingUser.passwordHash;

      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(0);
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue({ ...mockExistingUser });
      jest
        .spyOn(authRepository, 'storePasswordResetOtp')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'setPasswordResetCooldown')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'incrementPasswordResetRequestCount')
        .mockResolvedValue(1);
      jest
        .spyOn(emailService, 'sendPasswordResetOtp')
        .mockResolvedValue({ success: true, messageId: 'msg-1' });

      const updateUserSpy = jest.spyOn(authRepository, 'updateUserById');

      await authService.forgotPassword('jane.doe@university.edu');

      // Database user update must NOT be called
      expect(updateUserSpy).not.toHaveBeenCalled();
      expect(mockExistingUser.passwordHash).toBe(originalPasswordHash);
    });

    it('28. should NOT revoke refresh tokens or touch sessions during forgot-password', async () => {
      const revokeTokenSpy = jest.spyOn(authRepository, 'revokeTokenFamily');

      jest.spyOn(authRepository, 'getPasswordResetCooldown').mockResolvedValue({
        inCooldown: false,
        ttlRemaining: 0,
      });
      jest
        .spyOn(authRepository, 'getPasswordResetRequestCount')
        .mockResolvedValue(0);
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'storePasswordResetOtp')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'setPasswordResetCooldown')
        .mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'incrementPasswordResetRequestCount')
        .mockResolvedValue(1);
      jest
        .spyOn(emailService, 'sendPasswordResetOtp')
        .mockResolvedValue({ success: true, messageId: 'msg-1' });

      await authService.forgotPassword('jane.doe@university.edu');

      expect(revokeTokenSpy).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. AUTH REPOSITORY REDIS PERSISTENCE OPERATIONS (auth.repository.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthRepository Password Reset Redis Operations', () => {
    let mockRedis;
    let repo;

    beforeEach(() => {
      mockRedis = {
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn(),
        del: jest.fn().mockResolvedValue(1),
        ttl: jest.fn().mockResolvedValue(45),
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
      };
      repo = new authRepository.constructor({ redisClient: () => mockRedis });
    });

    it('29. should store reset OTP with correct namespace, serialization, and TTL', async () => {
      const otpData = { otpHash: 'hash123', attempts: 0 };
      await repo.storePasswordResetOtp('jane.doe@university.edu', otpData, 300);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'auth:otp:reset:jane.doe@university.edu',
        JSON.stringify(otpData),
        'EX',
        300
      );
    });

    it('30. should get and parse reset OTP from Redis', async () => {
      const otpData = { otpHash: 'hash123', attempts: 0 };
      mockRedis.get.mockImplementation((key) => {
        if (key === 'auth:otp:reset:jane.doe@university.edu') {
          return Promise.resolve(JSON.stringify(otpData));
        }
        if (key === 'auth:otp:reset:attempts:jane.doe@university.edu') {
          return Promise.resolve('0');
        }
        return Promise.resolve(null);
      });

      const res = await repo.getPasswordResetOtp('jane.doe@university.edu');
      expect(res).toEqual(otpData);
      expect(mockRedis.get).toHaveBeenCalledWith(
        'auth:otp:reset:jane.doe@university.edu'
      );
    });

    it('31. should return null if reset OTP does not exist or JSON parse fails', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(
        await repo.getPasswordResetOtp('jane.doe@university.edu')
      ).toBeNull();

      mockRedis.get.mockResolvedValue('invalid-json');
      expect(
        await repo.getPasswordResetOtp('jane.doe@university.edu')
      ).toBeNull();
    });

    it('32. should delete reset OTP from Redis', async () => {
      await repo.deletePasswordResetOtp('jane.doe@university.edu');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'auth:otp:reset:jane.doe@university.edu',
        'auth:otp:reset:attempts:jane.doe@university.edu'
      );
    });

    it('33. should set and get cooldown status', async () => {
      await repo.setPasswordResetCooldown('jane.doe@university.edu', 60);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'auth:otp:reset:cooldown:jane.doe@university.edu',
        '1',
        'EX',
        60
      );

      mockRedis.ttl.mockResolvedValue(45);
      const cooldown = await repo.getPasswordResetCooldown(
        'jane.doe@university.edu'
      );
      expect(cooldown).toEqual({ inCooldown: true, ttlRemaining: 45 });

      mockRedis.ttl.mockResolvedValue(-2);
      const expiredCooldown = await repo.getPasswordResetCooldown(
        'jane.doe@university.edu'
      );
      expect(expiredCooldown).toEqual({ inCooldown: false, ttlRemaining: 0 });
    });

    it('34. should get and increment hourly request count', async () => {
      mockRedis.get.mockResolvedValue('2');
      expect(
        await repo.getPasswordResetRequestCount('jane.doe@university.edu')
      ).toBe(2);

      mockRedis.incr.mockResolvedValue(1);
      const newCount = await repo.incrementPasswordResetRequestCount(
        'jane.doe@university.edu',
        3600
      );
      expect(newCount).toBe(1);
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'auth:otp:reset:rate:jane.doe@university.edu',
        3600
      );
    });

    it('35. should clear all password reset state keys simultaneously', async () => {
      await repo.clearAllPasswordResetOtpState('jane.doe@university.edu');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'auth:otp:reset:jane.doe@university.edu'
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'auth:otp:reset:cooldown:jane.doe@university.edu'
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'auth:otp:reset:rate:jane.doe@university.edu'
      );
    });
  });
});
