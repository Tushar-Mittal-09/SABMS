'use strict';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app/app');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const User = require('../../src/modules/users/user.model');
const authRepository = require('../../src/modules/auth/auth.repository');
const authService = require('../../src/modules/auth/auth.service');
const emailService = require('../../src/services/email.service');
const logger = require('../../src/core/logger');
const {
  verifyEmailSchema,
  resendEmailOtpSchema,
} = require('../../src/modules/auth/auth.schema');
const {
  formatRegistrationResponse,
  formatVerifyEmailResponse,
} = require('../../src/modules/auth/auth.response');
const {
  generateEmailOtp,
  hashEmailOtp,
  verifyEmailOtpHash,
  normalizeEmail,
  createOtpRedisKey,
  createOtpCooldownRedisKey,
  createOtpResendCountRedisKey,
} = require('../../src/modules/auth/auth.helper');
const {
  EMAIL_OTP_LENGTH,
  EMAIL_OTP_TTL_SECONDS,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  EMAIL_OTP_MAX_RESENDS,
} = require('../../src/modules/auth/auth.constants');
const AppError = require('../../src/core/errors/AppError');

describe('Email OTP Verification Workflow (Sprint 2.5)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CRYPTOGRAPHIC OTP GENERATION & HELPERS (auth.helper.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Cryptographic OTP Helpers', () => {
    it('1. should generate exactly 6-digit numeric OTP', () => {
      for (let i = 0; i < 50; i++) {
        const otp = generateEmailOtp(EMAIL_OTP_LENGTH);
        expect(typeof otp).toBe('string');
        expect(otp).toHaveLength(6);
        expect(/^\d{6}$/.test(otp)).toBe(true);
      }
    });

    it('2. should use cryptographically secure randomness (crypto.randomInt)', () => {
      const randomIntSpy = jest.spyOn(crypto, 'randomInt');
      const otp = generateEmailOtp(6);

      expect(randomIntSpy).toHaveBeenCalledWith(0, 1000000);
      expect(otp).toHaveLength(6);
    });

    it('3. should support leading zeroes with proper zero-padding', () => {
      jest.spyOn(crypto, 'randomInt').mockReturnValue(42);
      const otp = generateEmailOtp(6);
      expect(otp).toBe('000042');
      expect(otp).toHaveLength(6);

      jest.spyOn(crypto, 'randomInt').mockReturnValue(0);
      const zeroOtp = generateEmailOtp(6);
      expect(zeroOtp).toBe('000000');
    });

    it('4. should compute HMAC-SHA256 hash and verify timing-safe comparison correctly', () => {
      const otp = '582901';
      const secret = 'test-secret-key-12345';
      const hash = hashEmailOtp(otp, secret);

      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64); // SHA-256 hex is 64 chars

      // Valid OTP matches
      expect(verifyEmailOtpHash(otp, hash, secret)).toBe(true);

      // Wrong OTP fails
      expect(verifyEmailOtpHash('582902', hash, secret)).toBe(false);
      expect(verifyEmailOtpHash('000000', hash, secret)).toBe(false);
      expect(verifyEmailOtpHash('', hash, secret)).toBe(false);
      expect(verifyEmailOtpHash(null, hash, secret)).toBe(false);
    });

    it('5. should safely reject malformed or different length hashes without throwing', () => {
      expect(verifyEmailOtpHash('123456', 'short-invalid-hash')).toBe(false);
      expect(verifyEmailOtpHash('123456', null)).toBe(false);
      expect(verifyEmailOtpHash('123456', undefined)).toBe(false);
    });

    it('6. should correctly normalize emails and construct canonical Redis keys', () => {
      const rawEmail = '  Jane.Doe@University.EDU  ';
      expect(normalizeEmail(rawEmail)).toBe('jane.doe@university.edu');
      expect(normalizeEmail('')).toBe('');
      expect(normalizeEmail(null)).toBe('');

      expect(createOtpRedisKey(rawEmail)).toBe(
        'auth:otp:email:jane.doe@university.edu'
      );
      expect(createOtpCooldownRedisKey(rawEmail)).toBe(
        'auth:otp:cooldown:jane.doe@university.edu'
      );
      expect(createOtpResendCountRedisKey(rawEmail)).toBe(
        'auth:otp:resend:jane.doe@university.edu'
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ZOD SCHEMAS & BOUNDARY PROTECTION (auth.schema.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Zod Schema Validation & Boundary Protection', () => {
    describe('verifyEmailSchema', () => {
      it('7. should validate and normalize valid verify-email payload', () => {
        const valid = {
          email: '  Jane.Doe@University.EDU  ',
          otp: '582901',
        };
        const result = verifyEmailSchema.parse(valid);
        expect(result.email).toBe('jane.doe@university.edu');
        expect(result.otp).toBe('582901');
      });

      it('8. should reject invalid email in verifyEmailSchema', () => {
        expect(() =>
          verifyEmailSchema.parse({ email: 'notanemail', otp: '123456' })
        ).toThrow();
        expect(() =>
          verifyEmailSchema.parse({ email: '', otp: '123456' })
        ).toThrow();
      });

      it('9. should reject invalid OTP formats (non-digits, length != 6)', () => {
        const invalidOtps = [
          '12345', // 5 digits
          '1234567', // 7 digits
          'abcdef', // letters
          '12345a', // alphanumeric
          '12 456', // space inside
          '', // empty
        ];

        invalidOtps.forEach((badOtp) => {
          expect(() =>
            verifyEmailSchema.parse({
              email: 'jane.doe@university.edu',
              otp: badOtp,
            })
          ).toThrow();
        });
      });

      it('10. should strictly reject privilege escalation & unknown fields in verifyEmailSchema', () => {
        const maliciousFields = [
          { role: 'ADMIN' },
          { status: 'ACTIVE' },
          { isEmailVerified: true },
          { isPhoneVerified: true },
          { passwordHash: '$argon2id$v=19$...' },
          { unknownField: 'exploit' },
        ];

        maliciousFields.forEach((field) => {
          expect(() =>
            verifyEmailSchema.parse({
              email: 'jane.doe@university.edu',
              otp: '123456',
              ...field,
            })
          ).toThrow();
        });
      });
    });

    describe('resendEmailOtpSchema', () => {
      it('11. should validate valid resend payload', () => {
        const valid = { email: '  Jane.Doe@University.EDU  ' };
        const result = resendEmailOtpSchema.parse(valid);
        expect(result.email).toBe('jane.doe@university.edu');
      });

      it('12. should strictly reject unknown fields in resendEmailOtpSchema', () => {
        expect(() =>
          resendEmailOtpSchema.parse({
            email: 'jane.doe@university.edu',
            role: 'ADMIN',
          })
        ).toThrow();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. SAFE DOMAIN SERIALIZATION (auth.response.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Safe Domain Serialization (auth.response.js)', () => {
    it('13. should format user entity without password, passwordHash, OTP, or Redis internals', () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Jane Doe',
        email: 'jane.doe@university.edu',
        phone: '+1234567890',
        department: 'Computer Science',
        role: USER_ROLES.STUDENT,
        status: ACCOUNT_STATUSES.ACTIVE,
        isEmailVerified: true,
        isPhoneVerified: false,
        passwordHash: '$argon2id$v=19$...',
        __v: 0,
        createdAt: new Date('2026-08-15T12:00:00.000Z'),
      };

      const result = formatVerifyEmailResponse(mockUser);

      expect(result.id).toBe('507f1f77bcf86cd799439011');
      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBe('jane.doe@university.edu');
      expect(result.role).toBe('STUDENT');
      expect(result.status).toBe('ACTIVE');
      expect(result.isEmailVerified).toBe(true);
      expect(result.isPhoneVerified).toBe(false);

      // Sensitive fields must NOT exist
      expect(result.password).toBeUndefined();
      expect(result.passwordHash).toBeUndefined();
      expect(result.__v).toBeUndefined();
      expect(result.otp).toBeUndefined();
      expect(result.otpHash).toBeUndefined();
    });

    it('14. should handle null user gracefully', () => {
      expect(formatRegistrationResponse(null)).toBeNull();
      expect(formatVerifyEmailResponse(null)).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. EMAIL SERVICE (email.service.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Email Transport Service (email.service.js)', () => {
    it('15. should dispatch email verification OTP with correct subject and body', async () => {
      const sendMailMock = jest.fn().mockResolvedValue({
        messageId: '<test-message-id-12345@sabms.edu>',
      });

      jest.spyOn(emailService, 'getTransporter').mockReturnValue({
        sendMail: sendMailMock,
      });

      const result = await emailService.sendEmailVerificationOtp({
        to: 'jane.doe@university.edu',
        name: 'Jane Doe',
        otp: '582901',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<test-message-id-12345@sabms.edu>');
      expect(sendMailMock).toHaveBeenCalledTimes(1);

      const callArgs = sendMailMock.mock.calls[0][0];
      expect(callArgs.to).toBe('jane.doe@university.edu');
      expect(callArgs.subject).toBe('Verify your SABMS account');
      expect(callArgs.text).toContain('582901');
      expect(callArgs.text).toContain('This OTP expires in 10 minutes.');
      expect(callArgs.html).toContain('582901');
      expect(callArgs.html).toContain('Jane Doe');
    });

    it('16. should NEVER log plaintext OTP in logger when sending email', async () => {
      const loggerInfoSpy = jest.spyOn(logger, 'info');
      const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'msg-1' });

      jest.spyOn(emailService, 'getTransporter').mockReturnValue({
        sendMail: sendMailMock,
      });

      await emailService.sendEmailVerificationOtp({
        to: 'jane.doe@university.edu',
        name: 'Jane Doe',
        otp: '998877',
      });

      // Verify no logged string or metadata object contains the OTP
      loggerInfoSpy.mock.calls.forEach((call) => {
        const fullLogStr = JSON.stringify(call);
        expect(fullLogStr).not.toContain('998877');
      });
    });

    it('17. should handle email delivery failure safely without crashing', async () => {
      jest.spyOn(emailService, 'getTransporter').mockReturnValue({
        sendMail: jest
          .fn()
          .mockRejectedValue(new Error('SMTP Connection timeout')),
      });

      const result = await emailService.sendEmailVerificationOtp({
        to: 'jane.doe@university.edu',
        name: 'Jane Doe',
        otp: '123456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP Connection timeout');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. AUTH SERVICE OTP LIFECYCLE (auth.service.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthService OTP Business Workflow', () => {
    const mockPendingUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Jane Doe',
      email: 'jane.doe@university.edu',
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUSES.PENDING,
      isEmailVerified: false,
      isPhoneVerified: false,
    };

    describe('sendEmailVerificationOtp', () => {
      it('18. should successfully generate OTP, hash it, store in Redis with 600s TTL, and dispatch email', async () => {
        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getResendCooldown')
          .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
        jest.spyOn(authRepository, 'getResendCount').mockResolvedValue(0);

        const storeOtpSpy = jest
          .spyOn(authRepository, 'storeEmailOtp')
          .mockResolvedValue('OK');
        const setCooldownSpy = jest
          .spyOn(authRepository, 'setResendCooldown')
          .mockResolvedValue('OK');
        const incrResendSpy = jest
          .spyOn(authRepository, 'incrementResendCount')
          .mockResolvedValue(1);
        const emailSpy = jest
          .spyOn(emailService, 'sendEmailVerificationOtp')
          .mockResolvedValue({ success: true, messageId: 'msg-1' });

        const result = await authService.sendEmailVerificationOtp(
          'jane.doe@university.edu'
        );

        expect(result.email).toBe('jane.doe@university.edu');
        expect(result.message).toBe('Verification code sent successfully');
        // OTP must NEVER be returned in service result
        expect(result.otp).toBeUndefined();
        expect(result.otpHash).toBeUndefined();

        // Verify Redis persistence
        expect(storeOtpSpy).toHaveBeenCalledTimes(1);
        const [storedEmail, storedData, storedTtl] = storeOtpSpy.mock.calls[0];
        expect(storedEmail).toBe('jane.doe@university.edu');
        expect(storedTtl).toBe(EMAIL_OTP_TTL_SECONDS); // 600 seconds
        expect(storedData.otpHash).toBeDefined();
        expect(storedData.attempts).toBe(0);
        expect(storedData.createdAt).toBeDefined();
        expect(storedData.expiresAt).toBeDefined();

        // Verify cooldown & resend limit
        expect(setCooldownSpy).toHaveBeenCalledWith(
          'jane.doe@university.edu',
          EMAIL_OTP_RESEND_COOLDOWN_SECONDS
        );
        expect(incrResendSpy).toHaveBeenCalledWith(
          'jane.doe@university.edu',
          EMAIL_OTP_TTL_SECONDS
        );

        // Verify email was dispatched
        expect(emailSpy).toHaveBeenCalledTimes(1);
      });

      it('19. should throw 404 if email does not belong to any account', async () => {
        jest.spyOn(authRepository, 'findByEmail').mockResolvedValue(null);

        await expect(
          authService.sendEmailVerificationOtp('nonexistent@university.edu')
        ).rejects.toThrow(AppError);

        try {
          await authService.sendEmailVerificationOtp(
            'nonexistent@university.edu'
          );
        } catch (err) {
          expect(err.statusCode).toBe(404);
        }
      });

      it('20. should throw 409 Conflict if email is already verified', async () => {
        jest.spyOn(authRepository, 'findByEmail').mockResolvedValue({
          ...mockPendingUser,
          isEmailVerified: true,
          status: ACCOUNT_STATUSES.ACTIVE,
        });

        await expect(
          authService.sendEmailVerificationOtp('jane.doe@university.edu')
        ).rejects.toThrow(AppError);

        try {
          await authService.sendEmailVerificationOtp('jane.doe@university.edu');
        } catch (err) {
          expect(err.statusCode).toBe(409);
        }
      });

      it('21. should enforce 60-second resend cooldown with 429 Too Many Requests', async () => {
        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getResendCooldown')
          .mockResolvedValue({ inCooldown: true, ttlRemaining: 45 });

        await expect(
          authService.sendEmailVerificationOtp('jane.doe@university.edu')
        ).rejects.toThrow(AppError);

        try {
          await authService.sendEmailVerificationOtp('jane.doe@university.edu');
        } catch (err) {
          expect(err.statusCode).toBe(429);
          expect(err.message).toContain('Please wait 45 seconds');
        }
      });

      it('22. should enforce maximum resend limit (5) with 429 Too Many Requests', async () => {
        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getResendCooldown')
          .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
        jest
          .spyOn(authRepository, 'getResendCount')
          .mockResolvedValue(EMAIL_OTP_MAX_RESENDS); // 5

        await expect(
          authService.sendEmailVerificationOtp('jane.doe@university.edu')
        ).rejects.toThrow(AppError);

        try {
          await authService.sendEmailVerificationOtp('jane.doe@university.edu');
        } catch (err) {
          expect(err.statusCode).toBe(429);
          expect(err.message).toContain(
            'Maximum verification code resend limit reached'
          );
        }
      });

      it('23. should handle email dispatch failure with 500 internal error', async () => {
        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getResendCooldown')
          .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
        jest.spyOn(authRepository, 'getResendCount').mockResolvedValue(0);
        jest.spyOn(authRepository, 'storeEmailOtp').mockResolvedValue('OK');
        jest.spyOn(authRepository, 'setResendCooldown').mockResolvedValue('OK');
        jest.spyOn(authRepository, 'incrementResendCount').mockResolvedValue(1);
        jest
          .spyOn(emailService, 'sendEmailVerificationOtp')
          .mockResolvedValue({ success: false, error: 'SMTP unavailable' });

        await expect(
          authService.sendEmailVerificationOtp('jane.doe@university.edu')
        ).rejects.toThrow(AppError);
      });
    });

    describe('verifyEmailOtp', () => {
      it('24. should successfully verify correct OTP, transition user to ACTIVE & isEmailVerified: true', async () => {
        const correctOtp = '582901';
        const validHash = hashEmailOtp(correctOtp);

        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getEmailOtp').mockResolvedValue({
          otpHash: validHash,
          attempts: 0,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        });

        const updateSpy = jest
          .spyOn(authRepository, 'updateUserById')
          .mockResolvedValue(
            new User({
              ...mockPendingUser,
              isEmailVerified: true,
              status: ACCOUNT_STATUSES.ACTIVE,
            })
          );

        const clearStateSpy = jest
          .spyOn(authRepository, 'clearAllOtpState')
          .mockResolvedValue();

        const updatedUser = await authService.verifyEmailOtp(
          'jane.doe@university.edu',
          correctOtp
        );

        expect(updatedUser.isEmailVerified).toBe(true);
        expect(updatedUser.status).toBe(ACCOUNT_STATUSES.ACTIVE);
        expect(updatedUser.role).toBe(USER_ROLES.STUDENT);
        expect(updatedUser.isPhoneVerified).toBe(false);

        expect(updateSpy).toHaveBeenCalledWith(mockPendingUser._id, {
          isEmailVerified: true,
          status: ACCOUNT_STATUSES.ACTIVE,
        });

        // OTP must be deleted from Redis upon success
        expect(clearStateSpy).toHaveBeenCalledWith('jane.doe@university.edu');
      });

      it('25. should throw 400 Bad Request on wrong OTP and increment attempt counter', async () => {
        const correctOtp = '582901';
        const wrongOtp = '123456';
        const validHash = hashEmailOtp(correctOtp);

        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getEmailOtp').mockResolvedValue({
          otpHash: validHash,
          attempts: 1,
          createdAt: new Date().toISOString(),
        });

        const incrSpy = jest
          .spyOn(authRepository, 'incrementEmailOtpAttempts')
          .mockResolvedValue({
            attempts: 2,
            otpData: { attempts: 2 },
          });

        await expect(
          authService.verifyEmailOtp('jane.doe@university.edu', wrongOtp)
        ).rejects.toThrow(AppError);

        try {
          await authService.verifyEmailOtp('jane.doe@university.edu', wrongOtp);
        } catch (err) {
          expect(err.statusCode).toBe(400);
          expect(err.message).toBe(
            'Invalid verification code. Please check and try again.'
          );
        }

        expect(incrSpy).toHaveBeenCalledWith('jane.doe@university.edu');
      });

      it('26. should delete OTP and throw 429 when attempt limit (5) is exceeded', async () => {
        const validHash = hashEmailOtp('582901');

        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getEmailOtp').mockResolvedValue({
          otpHash: validHash,
          attempts: 4, // 4 previous attempts
        });

        // 5th failed attempt triggers deletion
        jest
          .spyOn(authRepository, 'incrementEmailOtpAttempts')
          .mockResolvedValue({
            attempts: 5,
            otpData: { attempts: 5 },
          });

        const delSpy = jest
          .spyOn(authRepository, 'deleteEmailOtp')
          .mockResolvedValue(1);

        await expect(
          authService.verifyEmailOtp('jane.doe@university.edu', '000000')
        ).rejects.toThrow(AppError);

        try {
          await authService.verifyEmailOtp('jane.doe@university.edu', '000000');
        } catch (err) {
          expect(err.statusCode).toBe(429);
          expect(err.message).toContain(
            'Maximum verification attempts exceeded'
          );
        }

        expect(delSpy).toHaveBeenCalledWith('jane.doe@university.edu');
      });

      it('27. should throw 400 Bad Request if OTP has expired or does not exist in Redis', async () => {
        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getEmailOtp').mockResolvedValue(null);

        await expect(
          authService.verifyEmailOtp('jane.doe@university.edu', '582901')
        ).rejects.toThrow(AppError);

        try {
          await authService.verifyEmailOtp('jane.doe@university.edu', '582901');
        } catch (err) {
          expect(err.statusCode).toBe(400);
          expect(err.message).toContain('expired or is invalid');
        }
      });

      it('28. should preserve atomicity: if updating MongoDB fails, throw error without deleting OTP prematurely', async () => {
        const correctOtp = '582901';
        const validHash = hashEmailOtp(correctOtp);

        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getEmailOtp').mockResolvedValue({
          otpHash: validHash,
          attempts: 0,
        });

        jest
          .spyOn(authRepository, 'updateUserById')
          .mockRejectedValue(new Error('MongoDB connection failure'));

        const clearStateSpy = jest.spyOn(authRepository, 'clearAllOtpState');

        await expect(
          authService.verifyEmailOtp('jane.doe@university.edu', correctOtp)
        ).rejects.toThrow('MongoDB connection failure');

        expect(clearStateSpy).not.toHaveBeenCalled();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. HTTP ROUTE & INTEGRATION PIPELINE TESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('HTTP Endpoints Integration Pipeline', () => {
    const mockPendingUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Jane Doe',
      email: 'jane.doe@university.edu',
      phone: '+1234567890',
      department: 'Computer Science',
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUSES.PENDING,
      isEmailVerified: false,
      isPhoneVerified: false,
      createdAt: new Date('2026-08-15T12:00:00.000Z'),
    };

    describe('POST /api/v1/auth/verify-email', () => {
      it('29. should return HTTP 200 with sanitized envelope on successful OTP verification', async () => {
        const correctOtp = '582901';
        const validHash = hashEmailOtp(correctOtp);

        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getEmailOtp').mockResolvedValue({
          otpHash: validHash,
          attempts: 0,
          createdAt: new Date().toISOString(),
        });
        jest.spyOn(authRepository, 'updateUserById').mockResolvedValue(
          new User({
            ...mockPendingUser,
            isEmailVerified: true,
            status: ACCOUNT_STATUSES.ACTIVE,
          })
        );
        jest.spyOn(authRepository, 'clearAllOtpState').mockResolvedValue();

        const res = await request(app)
          .post('/api/v1/auth/verify-email')
          .send({
            email: 'jane.doe@university.edu',
            otp: correctOtp,
          })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Email verified successfully');
        expect(res.body.data).toBeDefined();
        expect(res.body.data.id).toBe('507f1f77bcf86cd799439011');
        expect(res.body.data.email).toBe('jane.doe@university.edu');
        expect(res.body.data.status).toBe('ACTIVE');
        expect(res.body.data.isEmailVerified).toBe(true);
        expect(res.body.data.isPhoneVerified).toBe(false);
        expect(res.body.data.role).toBe('STUDENT');

        // Zero sensitive data leakage
        expect(res.body.data.password).toBeUndefined();
        expect(res.body.data.passwordHash).toBeUndefined();
        expect(res.body.data.otp).toBeUndefined();
        expect(res.body.data.otpHash).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain('$argon2id$');
        expect(JSON.stringify(res.body)).not.toContain(validHash);
      });

      it('30. should return HTTP 422 Unprocessable Entity when OTP is malformed', async () => {
        const res = await request(app)
          .post('/api/v1/auth/verify-email')
          .send({
            email: 'jane.doe@university.edu',
            otp: '123', // Too short
          })
          .expect(422);

        expect(res.body.success).toBe(false);
        expect(res.body.error).toBeDefined();
      });

      it('31. should return HTTP 422 Unprocessable Entity when extra/privilege escalation fields are present', async () => {
        const res = await request(app)
          .post('/api/v1/auth/verify-email')
          .send({
            email: 'jane.doe@university.edu',
            otp: '123456',
            role: 'ADMIN',
          })
          .expect(422);

        expect(res.body.success).toBe(false);
      });

      it('32. should return HTTP 400 Bad Request when OTP is incorrect', async () => {
        const validHash = hashEmailOtp('582901');

        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getEmailOtp').mockResolvedValue({
          otpHash: validHash,
          attempts: 0,
        });
        jest
          .spyOn(authRepository, 'incrementEmailOtpAttempts')
          .mockResolvedValue({ attempts: 1, otpData: { attempts: 1 } });

        const res = await request(app)
          .post('/api/v1/auth/verify-email')
          .send({
            email: 'jane.doe@university.edu',
            otp: '999999',
          })
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe(
          'Invalid verification code. Please check and try again.'
        );
      });

      it('33. should return HTTP 409 Conflict when attempting to verify already verified account', async () => {
        jest.spyOn(authRepository, 'findByEmail').mockResolvedValue({
          ...mockPendingUser,
          isEmailVerified: true,
          status: ACCOUNT_STATUSES.ACTIVE,
        });

        const res = await request(app)
          .post('/api/v1/auth/verify-email')
          .send({
            email: 'jane.doe@university.edu',
            otp: '123456',
          })
          .expect(409);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('This email address is already verified');
      });
    });

    describe('POST /api/v1/auth/resend-email-otp', () => {
      it('34. should return HTTP 200 on successful OTP resend', async () => {
        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getResendCooldown')
          .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
        jest.spyOn(authRepository, 'getResendCount').mockResolvedValue(1);
        jest.spyOn(authRepository, 'storeEmailOtp').mockResolvedValue('OK');
        jest.spyOn(authRepository, 'setResendCooldown').mockResolvedValue('OK');
        jest.spyOn(authRepository, 'incrementResendCount').mockResolvedValue(2);
        jest
          .spyOn(emailService, 'sendEmailVerificationOtp')
          .mockResolvedValue({ success: true, messageId: 'msg-resend' });

        const res = await request(app)
          .post('/api/v1/auth/resend-email-otp')
          .send({
            email: 'jane.doe@university.edu',
          })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Verification code sent successfully');
        expect(res.body.data.email).toBe('jane.doe@university.edu');
        expect(res.body.data.otp).toBeUndefined();
        expect(res.body.data.otpHash).toBeUndefined();
      });

      it('35. should return HTTP 429 when resend is attempted during cooldown', async () => {
        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getResendCooldown')
          .mockResolvedValue({ inCooldown: true, ttlRemaining: 50 });

        const res = await request(app)
          .post('/api/v1/auth/resend-email-otp')
          .send({
            email: 'jane.doe@university.edu',
          })
          .expect(429);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Please wait 50 seconds');
      });

      it('36. should return HTTP 429 when max resends limit has been reached', async () => {
        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getResendCooldown')
          .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
        jest
          .spyOn(authRepository, 'getResendCount')
          .mockResolvedValue(EMAIL_OTP_MAX_RESENDS);

        const res = await request(app)
          .post('/api/v1/auth/resend-email-otp')
          .send({
            email: 'jane.doe@university.edu',
          })
          .expect(429);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain(
          'Maximum verification code resend limit reached'
        );
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // M-01 AUDIT REGRESSION: ATOMIC ATTEMPT COUNTERS & CONCURRENCY
    // ─────────────────────────────────────────────────────────────────────────
    describe('M-01 Audit Regression: Atomic Email OTP Attempt Counters', () => {
      it('M-01.1 incrementEmailOtpAttempts atomically calls Redis INCR and sets TTL on first increment', async () => {
        const mockRedis = {
          exists: jest.fn().mockResolvedValue(1),
          incr: jest.fn().mockResolvedValue(1),
          ttl: jest.fn().mockResolvedValue(550),
          expire: jest.fn().mockResolvedValue(1),
        };
        jest.spyOn(authRepository, '_getRedis').mockReturnValue(mockRedis);

        const result = await authRepository.incrementEmailOtpAttempts(
          'jane.doe@university.edu'
        );

        expect(result).toEqual({ attempts: 1, otpData: { attempts: 1 } });
        expect(mockRedis.incr).toHaveBeenCalledWith(
          'auth:otp:email:attempts:jane.doe@university.edu'
        );
        expect(mockRedis.expire).toHaveBeenCalledWith(
          'auth:otp:email:attempts:jane.doe@university.edu',
          550
        );
      });

      it('M-01.2 incrementEmailOtpAttempts does NOT reset TTL on subsequent increments', async () => {
        const mockRedis = {
          exists: jest.fn().mockResolvedValue(1),
          incr: jest.fn().mockResolvedValue(2),
          ttl: jest.fn().mockResolvedValue(500),
          expire: jest.fn(),
        };
        jest.spyOn(authRepository, '_getRedis').mockReturnValue(mockRedis);

        const result = await authRepository.incrementEmailOtpAttempts(
          'jane.doe@university.edu'
        );

        expect(result).toEqual({ attempts: 2, otpData: { attempts: 2 } });
        expect(mockRedis.incr).toHaveBeenCalledWith(
          'auth:otp:email:attempts:jane.doe@university.edu'
        );
        expect(mockRedis.expire).not.toHaveBeenCalled();
      });

      it('M-01.3 Concurrent invalid OTP attempts atomically exhaust attempts without race-condition bypass', async () => {
        // Simulate atomic Redis state
        let atomicAttempts = 0;
        let otpActive = true;

        jest
          .spyOn(authRepository, 'findByEmail')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getEmailOtp')
          .mockImplementation(async () => {
            if (!otpActive) return null;
            return {
              otpHash: 'valid-otp-hash-string-that-will-not-match',
              attempts: atomicAttempts,
              createdAt: new Date(),
            };
          });
        jest
          .spyOn(authRepository, 'getEmailOtpAttempts')
          .mockImplementation(async () => atomicAttempts);
        jest
          .spyOn(authRepository, 'incrementEmailOtpAttempts')
          .mockImplementation(async () => {
            if (!otpActive) return null;
            atomicAttempts += 1;
            return {
              attempts: atomicAttempts,
              otpData: { attempts: atomicAttempts },
            };
          });
        jest
          .spyOn(authRepository, 'deleteEmailOtp')
          .mockImplementation(async () => {
            otpActive = false;
            return 1;
          });

        // Fire 10 concurrent requests
        const requests = Array.from({ length: 10 }).map(() =>
          request(app).post('/api/v1/auth/verify-email').send({
            email: 'jane.doe@university.edu',
            otp: '999999', // wrong OTP
          })
        );

        const responses = await Promise.all(requests);
        const statusCodes = responses.map((r) => r.status);

        // Exactly 4 requests should return 400 (attempts 1 to 4)
        const badRequests = statusCodes.filter((s) => s === 400);
        // At least 1 request should return 429 (attempt 5 hits maximum threshold)
        const tooManyRequests = statusCodes.filter((s) => s === 429);

        expect(badRequests.length).toBeGreaterThanOrEqual(4);
        expect(tooManyRequests.length).toBeGreaterThanOrEqual(1);
        expect(badRequests.length + tooManyRequests.length).toBe(10);
        expect(atomicAttempts).toBe(5);
        expect(otpActive).toBe(false);
      });
    });
  });
});
