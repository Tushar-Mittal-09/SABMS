'use strict';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app/app');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const authRepository = require('../../src/modules/auth/auth.repository');
const authService = require('../../src/modules/auth/auth.service');
const smsService = require('../../src/services/sms.service');
const logger = require('../../src/core/logger');
const {
  verifyPhoneSchema,
  resendPhoneOtpSchema,
} = require('../../src/modules/auth/auth.schema');
const {
  formatRegistrationResponse,
  formatVerifyPhoneResponse,
} = require('../../src/modules/auth/auth.response');
const {
  generatePhoneOtp,
  hashPhoneOtp,
  verifyPhoneOtpHash,
  normalizePhone,
  createPhoneOtpRedisKey,
  createPhoneOtpCooldownRedisKey,
  createPhoneOtpResendCountRedisKey,
} = require('../../src/modules/auth/auth.helper');
const {
  PHONE_OTP_LENGTH,
  PHONE_OTP_TTL_SECONDS,
  PHONE_OTP_RESEND_COOLDOWN_SECONDS,
  PHONE_OTP_MAX_RESENDS,
} = require('../../src/modules/auth/auth.constants');

describe('Phone OTP Verification Workflow (Sprint 2.6)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CRYPTOGRAPHIC PHONE OTP GENERATION & HELPERS (auth.helper.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Cryptographic Phone OTP Helpers', () => {
    it('1. should accept valid E.164 phone and normalize correctly', () => {
      const rawPhone = '  +919876543210  ';
      expect(normalizePhone(rawPhone)).toBe('+919876543210');
      expect(normalizePhone('')).toBe('');
      expect(normalizePhone(null)).toBe('');
      expect(normalizePhone(undefined)).toBe('');
    });

    it('2. should generate exactly 6-digit numeric Phone OTP', () => {
      for (let i = 0; i < 50; i++) {
        const otp = generatePhoneOtp(PHONE_OTP_LENGTH);
        expect(typeof otp).toBe('string');
        expect(otp).toHaveLength(6);
        expect(/^\d{6}$/.test(otp)).toBe(true);
      }
    });

    it('3. should use cryptographically secure randomness (crypto.randomInt)', () => {
      const randomIntSpy = jest.spyOn(crypto, 'randomInt');
      const otp = generatePhoneOtp(6);

      expect(randomIntSpy).toHaveBeenCalledWith(0, 1000000);
      expect(otp).toHaveLength(6);
    });

    it('4. should support leading zeroes with proper zero-padding', () => {
      jest.spyOn(crypto, 'randomInt').mockReturnValue(42);
      const otp = generatePhoneOtp(6);
      expect(otp).toBe('000042');
      expect(otp).toHaveLength(6);

      jest.spyOn(crypto, 'randomInt').mockReturnValue(0);
      const zeroOtp = generatePhoneOtp(6);
      expect(zeroOtp).toBe('000000');
    });

    it('5. should compute HMAC-SHA256 hash and verify timing-safe comparison correctly', () => {
      const otp = '582901';
      const secret = 'test-secret-key-12345';
      const hash = hashPhoneOtp(otp, secret);

      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64); // SHA-256 hex is 64 chars

      // Valid OTP matches
      expect(verifyPhoneOtpHash(otp, hash, secret)).toBe(true);

      // Wrong OTP fails
      expect(verifyPhoneOtpHash('582902', hash, secret)).toBe(false);
      expect(verifyPhoneOtpHash('000000', hash, secret)).toBe(false);
      expect(verifyPhoneOtpHash('', hash, secret)).toBe(false);
      expect(verifyPhoneOtpHash(null, hash, secret)).toBe(false);
    });

    it('6. should safely reject malformed or different length hashes without throwing', () => {
      expect(verifyPhoneOtpHash('123456', 'short-invalid-hash')).toBe(false);
      expect(verifyPhoneOtpHash('123456', null)).toBe(false);
      expect(verifyPhoneOtpHash('123456', undefined)).toBe(false);
    });

    it('7. should construct canonical Phone Redis keys with normalized phone numbers', () => {
      const rawPhone = '  +919876543210  ';
      expect(createPhoneOtpRedisKey(rawPhone)).toBe(
        'auth:otp:phone:+919876543210'
      );
      expect(createPhoneOtpCooldownRedisKey(rawPhone)).toBe(
        'auth:otp:phone:cooldown:+919876543210'
      );
      expect(createPhoneOtpResendCountRedisKey(rawPhone)).toBe(
        'auth:otp:phone:resend:+919876543210'
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ZOD SCHEMAS & BOUNDARY PROTECTION (auth.schema.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Zod Schema Validation & Boundary Protection', () => {
    describe('verifyPhoneSchema', () => {
      it('8. should validate and normalize valid verify-phone payload', () => {
        const valid = {
          phone: '  +919876543210  ',
          otp: '582901',
        };
        const result = verifyPhoneSchema.parse(valid);
        expect(result.phone).toBe('+919876543210');
        expect(result.otp).toBe('582901');
      });

      it('9. should reject invalid phone formats in verifyPhoneSchema', () => {
        const invalidPhones = ['notaphone', '000-invalid', 'abcdefghij', ''];
        invalidPhones.forEach((badPhone) => {
          expect(() =>
            verifyPhoneSchema.parse({ phone: badPhone, otp: '123456' })
          ).toThrow();
        });
      });

      it('10. should reject invalid OTP formats (non-digits, length != 6)', () => {
        const invalidOtps = [
          '12345',
          '1234567',
          'abcdef',
          '12345a',
          '12 456',
          '',
        ];

        invalidOtps.forEach((badOtp) => {
          expect(() =>
            verifyPhoneSchema.parse({
              phone: '+919876543210',
              otp: badOtp,
            })
          ).toThrow();
        });
      });

      it('11. should strictly reject privilege escalation & unknown fields in verifyPhoneSchema', () => {
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
            verifyPhoneSchema.parse({
              phone: '+919876543210',
              otp: '123456',
              ...field,
            })
          ).toThrow();
        });
      });
    });

    describe('resendPhoneOtpSchema', () => {
      it('12. should validate valid resend phone payload', () => {
        const valid = { phone: '  +919876543210  ' };
        const result = resendPhoneOtpSchema.parse(valid);
        expect(result.phone).toBe('+919876543210');
      });

      it('13. should strictly reject unknown fields in resendPhoneOtpSchema', () => {
        expect(() =>
          resendPhoneOtpSchema.parse({
            phone: '+919876543210',
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
    it('14. should format user entity after phone verification without leaking secrets', () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Jane Doe',
        email: 'jane.doe@university.edu',
        phone: '+919876543210',
        department: 'Computer Science',
        role: USER_ROLES.STUDENT,
        status: ACCOUNT_STATUSES.PENDING,
        isEmailVerified: false,
        isPhoneVerified: true,
        passwordHash: '$argon2id$v=19$...',
        __v: 0,
        createdAt: new Date('2026-08-15T12:00:00.000Z'),
      };

      const result = formatVerifyPhoneResponse(mockUser);

      expect(result.id).toBe('507f1f77bcf86cd799439011');
      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBe('jane.doe@university.edu');
      expect(result.phone).toBe('+919876543210');
      expect(result.role).toBe('STUDENT');
      expect(result.status).toBe('PENDING'); // Status remains PENDING until email is verified
      expect(result.isEmailVerified).toBe(false);
      expect(result.isPhoneVerified).toBe(true);

      // Sensitive fields must NOT exist
      expect(result.password).toBeUndefined();
      expect(result.passwordHash).toBeUndefined();
      expect(result.__v).toBeUndefined();
      expect(result.otp).toBeUndefined();
      expect(result.otpHash).toBeUndefined();
    });

    it('15. should handle null user gracefully', () => {
      expect(formatVerifyPhoneResponse(null)).toBeNull();
      expect(formatRegistrationResponse(null)).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. SMS SERVICE (sms.service.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('SMS Transport Service (sms.service.js)', () => {
    it('16. should dispatch phone verification OTP with formatted message', async () => {
      const sendMock = jest.fn().mockResolvedValue({
        messageId: 'sms_test_12345',
      });

      smsService.setSmsProvider({ send: sendMock });

      const result = await smsService.sendPhoneVerificationOtp({
        to: '+919876543210',
        otp: '582901',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('sms_test_12345');
      expect(sendMock).toHaveBeenCalledTimes(1);

      const callArgs = sendMock.mock.calls[0][0];
      expect(callArgs.to).toBe('+919876543210');
      expect(callArgs.message).toContain('582901');
      expect(callArgs.message).toContain('This code expires in 10 minutes.');
      expect(callArgs.message).toContain('Do not share this code with anyone.');

      smsService.setSmsProvider(null);
    });

    it('17. should NEVER log plaintext OTP in logger when sending SMS', async () => {
      const loggerInfoSpy = jest.spyOn(logger, 'info');
      const sendMock = jest.fn().mockResolvedValue({ messageId: 'sms_safe_1' });

      smsService.setSmsProvider({ send: sendMock });

      await smsService.sendPhoneVerificationOtp({
        to: '+919876543210',
        otp: '998877',
      });

      loggerInfoSpy.mock.calls.forEach((call) => {
        const fullLogStr = JSON.stringify(call);
        expect(fullLogStr).not.toContain('998877');
      });

      smsService.setSmsProvider(null);
    });

    it('18. should handle SMS provider failure safely without crashing', async () => {
      smsService.setSmsProvider({
        send: jest.fn().mockRejectedValue(new Error('SMS Gateway unreachable')),
      });

      const result = await smsService.sendPhoneVerificationOtp({
        to: '+919876543210',
        otp: '123456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMS Gateway unreachable');

      smsService.setSmsProvider(null);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. AUTH SERVICE PHONE OTP BUSINESS WORKFLOW (auth.service.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthService Phone OTP Business Workflow', () => {
    const mockPendingUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Jane Doe',
      email: 'jane.doe@university.edu',
      phone: '+919876543210',
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUSES.PENDING,
      isEmailVerified: false,
      isPhoneVerified: false,
    };

    describe('sendPhoneVerificationOtp', () => {
      it('19. should successfully generate OTP, hash it, store in Redis with 600s TTL, and dispatch SMS', async () => {
        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getPhoneOtpCooldown')
          .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
        jest
          .spyOn(authRepository, 'getPhoneOtpResendCount')
          .mockResolvedValue(0);

        const storeOtpSpy = jest
          .spyOn(authRepository, 'storePhoneOtp')
          .mockResolvedValue('OK');
        const setCooldownSpy = jest
          .spyOn(authRepository, 'setPhoneOtpCooldown')
          .mockResolvedValue('OK');
        const incrResendSpy = jest
          .spyOn(authRepository, 'incrementPhoneOtpResendCount')
          .mockResolvedValue(1);
        const smsSpy = jest
          .spyOn(smsService, 'sendPhoneVerificationOtp')
          .mockResolvedValue({ success: true, messageId: 'msg-1' });

        const result =
          await authService.sendPhoneVerificationOtp('+919876543210');

        expect(result.phone).toBe('+919876543210');
        expect(result.message).toBe('Verification code sent successfully');
        expect(result.otp).toBeUndefined(); // NEVER return OTP

        expect(storeOtpSpy).toHaveBeenCalledTimes(1);
        const [storedPhone, storedData, storedTtl] = storeOtpSpy.mock.calls[0];
        expect(storedPhone).toBe('+919876543210');
        expect(storedTtl).toBe(PHONE_OTP_TTL_SECONDS);
        expect(storedData.otpHash).toHaveLength(64);
        expect(storedData.attempts).toBe(0);
        expect(storedData.otp).toBeUndefined(); // Plaintext OTP NEVER in Redis payload

        expect(setCooldownSpy).toHaveBeenCalledWith(
          '+919876543210',
          PHONE_OTP_RESEND_COOLDOWN_SECONDS
        );
        expect(incrResendSpy).toHaveBeenCalledWith(
          '+919876543210',
          PHONE_OTP_TTL_SECONDS
        );
        expect(smsSpy).toHaveBeenCalledTimes(1);
      });

      it('20. should reject send if user with phone does not exist (404 Not Found)', async () => {
        jest.spyOn(authRepository, 'findByPhone').mockResolvedValue(null);

        await expect(
          authService.sendPhoneVerificationOtp('+919876543210')
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 404,
            message: 'No account found with this phone number',
          })
        );
      });

      it('21. should reject send if phone is already verified (409 Conflict)', async () => {
        jest.spyOn(authRepository, 'findByPhone').mockResolvedValue({
          ...mockPendingUser,
          isPhoneVerified: true,
        });

        await expect(
          authService.sendPhoneVerificationOtp('+919876543210')
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 409,
            message: 'This phone number is already verified',
          })
        );
      });

      it('22. should enforce resend cooldown (429 Too Many Requests)', async () => {
        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getPhoneOtpCooldown')
          .mockResolvedValue({ inCooldown: true, ttlRemaining: 45 });

        await expect(
          authService.sendPhoneVerificationOtp('+919876543210')
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 429,
            message:
              'Please wait 45 seconds before requesting another verification code',
          })
        );
      });

      it('23. should enforce maximum resend limits (429 Too Many Requests)', async () => {
        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getPhoneOtpCooldown')
          .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
        jest
          .spyOn(authRepository, 'getPhoneOtpResendCount')
          .mockResolvedValue(PHONE_OTP_MAX_RESENDS);

        await expect(
          authService.sendPhoneVerificationOtp('+919876543210')
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 429,
            message:
              'Maximum verification code resend limit reached. Please try again later.',
          })
        );
      });

      it('24. should handle SMS delivery failure gracefully (500 Internal Error)', async () => {
        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getPhoneOtpCooldown')
          .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
        jest
          .spyOn(authRepository, 'getPhoneOtpResendCount')
          .mockResolvedValue(0);
        jest.spyOn(authRepository, 'storePhoneOtp').mockResolvedValue('OK');
        jest
          .spyOn(authRepository, 'setPhoneOtpCooldown')
          .mockResolvedValue('OK');
        jest
          .spyOn(authRepository, 'incrementPhoneOtpResendCount')
          .mockResolvedValue(1);

        jest.spyOn(smsService, 'sendPhoneVerificationOtp').mockResolvedValue({
          success: false,
          error: 'SMS Network error',
        });

        await expect(
          authService.sendPhoneVerificationOtp('+919876543210')
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 500,
            message: 'Failed to send verification SMS. Please try again.',
          })
        );
      });

      it('25. should handle Redis failure gracefully during send (500 Internal Error)', async () => {
        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getPhoneOtpCooldown')
          .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
        jest
          .spyOn(authRepository, 'getPhoneOtpResendCount')
          .mockResolvedValue(0);
        jest
          .spyOn(authRepository, 'storePhoneOtp')
          .mockRejectedValue(new Error('Redis connection refused'));

        await expect(
          authService.sendPhoneVerificationOtp('+919876543210')
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 500,
            message: 'Temporary service error. Please try again.',
          })
        );
      });
    });

    describe('verifyPhoneOtp', () => {
      it('26. should successfully verify correct OTP, set isPhoneVerified=true, keep email/status/role unchanged, and delete Redis OTP state', async () => {
        const correctOtp = '582901';
        const otpHash = hashPhoneOtp(correctOtp);

        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getPhoneOtp').mockResolvedValue({
          otpHash,
          attempts: 0,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        });

        const updateSpy = jest
          .spyOn(authRepository, 'updateUserById')
          .mockResolvedValue({
            ...mockPendingUser,
            isPhoneVerified: true,
          });

        const clearStateSpy = jest
          .spyOn(authRepository, 'clearAllPhoneOtpState')
          .mockResolvedValue();

        const result = await authService.verifyPhoneOtp(
          '+919876543210',
          correctOtp
        );

        expect(result.isPhoneVerified).toBe(true);
        expect(result.isEmailVerified).toBe(false); // Email remains unverified
        expect(result.status).toBe(ACCOUNT_STATUSES.PENDING); // Account status remains PENDING!
        expect(result.role).toBe(USER_ROLES.STUDENT);

        expect(updateSpy).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
          isPhoneVerified: true,
        });
        expect(clearStateSpy).toHaveBeenCalledWith('+919876543210');
      });

      it('27. should reject verification if OTP expired or not found in Redis (400 Bad Request)', async () => {
        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getPhoneOtp').mockResolvedValue(null);

        await expect(
          authService.verifyPhoneOtp('+919876543210', '123456')
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 400,
            message:
              'Verification code has expired or is invalid. Please request a new code.',
          })
        );
      });

      it('28. should reject wrong OTP and increment attempt counter (400 Bad Request)', async () => {
        const correctOtp = '582901';
        const otpHash = hashPhoneOtp(correctOtp);

        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getPhoneOtp').mockResolvedValue({
          otpHash,
          attempts: 1,
        });

        const incrementSpy = jest
          .spyOn(authRepository, 'incrementPhoneOtpAttempts')
          .mockResolvedValue({
            attempts: 2,
            otpData: { otpHash, attempts: 2 },
          });

        await expect(
          authService.verifyPhoneOtp('+919876543210', '999999')
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 400,
            message: 'Invalid verification code. Please check and try again.',
          })
        );

        expect(incrementSpy).toHaveBeenCalledWith('+919876543210');
      });

      it('29. should invalidate OTP and reject with 429 when maximum attempts exceeded', async () => {
        const correctOtp = '582901';
        const otpHash = hashPhoneOtp(correctOtp);

        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getPhoneOtp').mockResolvedValue({
          otpHash,
          attempts: 4,
        });

        jest
          .spyOn(authRepository, 'incrementPhoneOtpAttempts')
          .mockResolvedValue({
            attempts: 5,
            otpData: { otpHash, attempts: 5 },
          });
        const deleteOtpSpy = jest
          .spyOn(authRepository, 'deletePhoneOtp')
          .mockResolvedValue(1);

        await expect(
          authService.verifyPhoneOtp('+919876543210', '999999')
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 429,
            message:
              'Maximum verification attempts exceeded. Please request a new code.',
          })
        );

        expect(deleteOtpSpy).toHaveBeenCalledWith('+919876543210');
      });

      it('30. should reject immediately with 429 if active OTP already reached max attempts', async () => {
        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest.spyOn(authRepository, 'getPhoneOtp').mockResolvedValue({
          otpHash: 'somehash',
          attempts: 5,
        });

        const deleteOtpSpy = jest
          .spyOn(authRepository, 'deletePhoneOtp')
          .mockResolvedValue(1);

        await expect(
          authService.verifyPhoneOtp('+919876543210', '123456')
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 429,
            message:
              'Maximum verification attempts exceeded. Please request a new code.',
          })
        );

        expect(deleteOtpSpy).toHaveBeenCalledWith('+919876543210');
      });

      it('31. should prevent OTP replay after successful verification', async () => {
        const correctOtp = '582901';
        const otpHash = hashPhoneOtp(correctOtp);

        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValueOnce(mockPendingUser)
          .mockResolvedValueOnce({
            ...mockPendingUser,
            isPhoneVerified: true,
          });

        jest
          .spyOn(authRepository, 'getPhoneOtp')
          .mockResolvedValueOnce({
            otpHash,
            attempts: 0,
          })
          .mockResolvedValueOnce(null);

        jest.spyOn(authRepository, 'updateUserById').mockResolvedValue({
          ...mockPendingUser,
          isPhoneVerified: true,
        });
        jest.spyOn(authRepository, 'clearAllPhoneOtpState').mockResolvedValue();

        // First verification succeeds
        const firstResult = await authService.verifyPhoneOtp(
          '+919876543210',
          correctOtp
        );
        expect(firstResult.isPhoneVerified).toBe(true);

        // Replay attempt fails (already verified)
        await expect(
          authService.verifyPhoneOtp('+919876543210', correctOtp)
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: 409,
            message: 'This phone number is already verified',
          })
        );
      });
    });

    describe('resendPhoneVerificationOtp', () => {
      it('32. should delegate to sendPhoneVerificationOtp and issue a new OTP with refreshed TTL', async () => {
        const sendSpy = jest
          .spyOn(authService, 'sendPhoneVerificationOtp')
          .mockResolvedValue({
            phone: '+919876543210',
            message: 'Verification code sent successfully',
          });

        const result =
          await authService.resendPhoneVerificationOtp('+919876543210');

        expect(sendSpy).toHaveBeenCalledWith('+919876543210');
        expect(result.phone).toBe('+919876543210');
        expect(result.otp).toBeUndefined();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. HTTP API ENDPOINTS INTEGRATION (/api/v1/auth/verify-phone & resend)
  // ───────────────────────────────────────────────────────────────────────────
  describe('HTTP API Endpoints', () => {
    const mockPendingUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Jane Doe',
      email: 'jane.doe@university.edu',
      phone: '+919876543210',
      department: 'Computer Science',
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUSES.PENDING,
      isEmailVerified: false,
      isPhoneVerified: false,
      createdAt: new Date('2026-08-15T12:00:00.000Z'),
    };

    describe('POST /api/v1/auth/verify-phone', () => {
      it('33. should return 200 OK and sanitized user payload upon successful verification', async () => {
        jest.spyOn(authService, 'verifyPhoneOtp').mockResolvedValue({
          ...mockPendingUser,
          isPhoneVerified: true,
        });

        const response = await request(app)
          .post('/api/v1/auth/verify-phone')
          .send({
            phone: '+919876543210',
            otp: '582901',
          })
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Phone verified successfully');
        expect(response.body.data.id).toBe('507f1f77bcf86cd799439011');
        expect(response.body.data.phone).toBe('+919876543210');
        expect(response.body.data.isPhoneVerified).toBe(true);
        expect(response.body.data.isEmailVerified).toBe(false);
        expect(response.body.data.status).toBe('PENDING'); // Status remains PENDING
        expect(response.body.data.role).toBe('STUDENT');

        // Verify zero secret leakage
        expect(response.body.data.password).toBeUndefined();
        expect(response.body.data.passwordHash).toBeUndefined();
        expect(response.body.data.otp).toBeUndefined();
        expect(response.body.data.otpHash).toBeUndefined();
      });

      it('34. should return 422 Unprocessable Entity when request body contains unknown/injected fields', async () => {
        const response = await request(app)
          .post('/api/v1/auth/verify-phone')
          .send({
            phone: '+919876543210',
            otp: '582901',
            role: 'ADMIN',
          })
          .expect(422);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });

      it('35. should return 422 Unprocessable Entity when phone is invalid E.164', async () => {
        const response = await request(app)
          .post('/api/v1/auth/verify-phone')
          .send({
            phone: 'not-a-phone',
            otp: '582901',
          })
          .expect(422);

        expect(response.body.success).toBe(false);
      });

      it('36. should return 422 Unprocessable Entity when OTP is invalid format', async () => {
        const response = await request(app)
          .post('/api/v1/auth/verify-phone')
          .send({
            phone: '+919876543210',
            otp: 'abc123',
          })
          .expect(422);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/auth/resend-phone-otp', () => {
      it('37. should return 200 OK and sanitized phone payload upon successful OTP resend', async () => {
        jest
          .spyOn(authService, 'resendPhoneVerificationOtp')
          .mockResolvedValue({
            phone: '+919876543210',
            message: 'Verification code sent successfully',
          });

        const response = await request(app)
          .post('/api/v1/auth/resend-phone-otp')
          .send({
            phone: '+919876543210',
          })
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe(
          'Verification code sent successfully'
        );
        expect(response.body.data.phone).toBe('+919876543210');
        expect(response.body.data.otp).toBeUndefined(); // NEVER return OTP
      });

      it('38. should return 422 Unprocessable Entity when resend request has unknown fields', async () => {
        const response = await request(app)
          .post('/api/v1/auth/resend-phone-otp')
          .send({
            phone: '+919876543210',
            injectedField: 'hack',
          })
          .expect(422);

        expect(response.body.success).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // M-01 AUDIT REGRESSION: ATOMIC PHONE OTP ATTEMPT COUNTERS
    // ─────────────────────────────────────────────────────────────────────────
    describe('M-01 Audit Regression: Atomic Phone OTP Attempt Counters', () => {
      it('M-01.1 incrementPhoneOtpAttempts atomically calls Redis INCR and sets TTL on first increment', async () => {
        const mockRedis = {
          exists: jest.fn().mockResolvedValue(1),
          incr: jest.fn().mockResolvedValue(1),
          ttl: jest.fn().mockResolvedValue(550),
          expire: jest.fn().mockResolvedValue(1),
        };
        jest.spyOn(authRepository, '_getRedis').mockReturnValue(mockRedis);

        const result =
          await authRepository.incrementPhoneOtpAttempts('+919876543210');

        expect(result).toEqual({ attempts: 1, otpData: { attempts: 1 } });
        expect(mockRedis.incr).toHaveBeenCalledWith(
          'auth:otp:phone:attempts:+919876543210'
        );
        expect(mockRedis.expire).toHaveBeenCalledWith(
          'auth:otp:phone:attempts:+919876543210',
          550
        );
      });

      it('M-01.2 Concurrent invalid phone OTP attempts atomically exhaust attempts without race bypass', async () => {
        let atomicAttempts = 0;
        let otpActive = true;

        jest
          .spyOn(authRepository, 'findByPhone')
          .mockResolvedValue(mockPendingUser);
        jest
          .spyOn(authRepository, 'getPhoneOtp')
          .mockImplementation(async () => {
            if (!otpActive) return null;
            return {
              otpHash: 'valid-phone-otp-hash-string',
              attempts: atomicAttempts,
              createdAt: new Date(),
            };
          });
        jest
          .spyOn(authRepository, 'getPhoneOtpAttempts')
          .mockImplementation(async () => atomicAttempts);
        jest
          .spyOn(authRepository, 'incrementPhoneOtpAttempts')
          .mockImplementation(async () => {
            if (!otpActive) return null;
            atomicAttempts += 1;
            return {
              attempts: atomicAttempts,
              otpData: { attempts: atomicAttempts },
            };
          });
        jest
          .spyOn(authRepository, 'deletePhoneOtp')
          .mockImplementation(async () => {
            otpActive = false;
            return 1;
          });

        // Fire 10 concurrent requests
        const requests = Array.from({ length: 10 }).map(() =>
          request(app).post('/api/v1/auth/verify-phone').send({
            phone: '+919876543210',
            otp: '999999', // wrong OTP
          })
        );

        const responses = await Promise.all(requests);
        const statusCodes = responses.map((r) => r.status);

        const badRequests = statusCodes.filter((s) => s === 400);
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
