'use strict';

const request = require('supertest');
const app = require('../../src/app/app');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const authRepository = require('../../src/modules/auth/auth.repository');
const authService = require('../../src/modules/auth/auth.service');
const emailService = require('../../src/services/email.service');
const smsService = require('../../src/services/sms.service');
const { resendOtpSchema } = require('../../src/modules/auth/auth.schema');
const {
  EMAIL_OTP_MAX_RESENDS,
  PHONE_OTP_MAX_RESENDS,
} = require('../../src/modules/auth/auth.constants');

describe('Sprint 2.15 — General OTP Resend Workflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockPendingUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Jane Doe',
    email: 'jane.doe@university.edu',
    phone: '+1234567890',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUSES.PENDING,
    isEmailVerified: false,
    isPhoneVerified: false,
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ZOD SCHEMA VALIDATION (resendOtpSchema)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Zod Schema Validation & Boundary Protection', () => {
    it('1. should validate valid email resend request', () => {
      const result = resendOtpSchema.safeParse({
        type: 'email',
        email: 'jane.doe@university.edu',
      });
      expect(result.success).toBe(true);
    });

    it('2. should validate valid phone resend request', () => {
      const result = resendOtpSchema.safeParse({
        type: 'phone',
        phone: '+1234567890',
      });
      expect(result.success).toBe(true);
    });

    it('3. should accept "purpose" alias for type', () => {
      const result = resendOtpSchema.safeParse({
        purpose: 'email',
        email: 'jane.doe@university.edu',
      });
      expect(result.success).toBe(true);
    });

    it('4. should reject missing type/purpose', () => {
      const result = resendOtpSchema.safeParse({
        email: 'jane.doe@university.edu',
      });
      expect(result.success).toBe(false);
    });

    it('5. should reject password reset as purpose (prevent mixing OTP purposes)', () => {
      const result = resendOtpSchema.safeParse({
        type: 'password_reset',
        email: 'jane.doe@university.edu',
      });
      expect(result.success).toBe(false);
    });

    it('6. should reject invalid or unknown purposes', () => {
      const result = resendOtpSchema.safeParse({
        type: 'magic_link',
        email: 'jane.doe@university.edu',
      });
      expect(result.success).toBe(false);
    });

    it('7. should reject missing email when type is email', () => {
      const result = resendOtpSchema.safeParse({
        type: 'email',
      });
      expect(result.success).toBe(false);
    });

    it('8. should reject missing phone when type is phone', () => {
      const result = resendOtpSchema.safeParse({
        type: 'phone',
      });
      expect(result.success).toBe(false);
    });

    it('9. should strictly reject unexpected fields (.strict())', () => {
      const result = resendOtpSchema.safeParse({
        type: 'email',
        email: 'jane.doe@university.edu',
        unexpectedField: 'malicious',
      });
      expect(result.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. AUTHSERVICE.RESENDOTP BUSINESS LOGIC
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthService.resendOtp Business Logic', () => {
    it('10. should resend email OTP, update Redis TTL, set cooldown, and dispatch email', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockPendingUser);
      jest
        .spyOn(authRepository, 'getResendCooldown')
        .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
      jest.spyOn(authRepository, 'getResendCount').mockResolvedValue(1);
      const storeEmailOtpSpy = jest
        .spyOn(authRepository, 'storeEmailOtp')
        .mockResolvedValue('OK');
      const setCooldownSpy = jest
        .spyOn(authRepository, 'setResendCooldown')
        .mockResolvedValue('OK');
      const incCountSpy = jest
        .spyOn(authRepository, 'incrementResendCount')
        .mockResolvedValue(2);
      const emailSpy = jest
        .spyOn(emailService, 'sendEmailVerificationOtp')
        .mockResolvedValue({ success: true, messageId: 'msg-general-resend' });

      const result = await authService.resendOtp({
        type: 'email',
        email: 'jane.doe@university.edu',
      });

      expect(result).toEqual({
        type: 'email',
        recipient: 'jane.doe@university.edu',
      });
      expect(storeEmailOtpSpy).toHaveBeenCalled();
      expect(setCooldownSpy).toHaveBeenCalled();
      expect(incCountSpy).toHaveBeenCalled();
      expect(emailSpy).toHaveBeenCalled();
    });

    it('11. should resend phone OTP, update Redis TTL, set cooldown, and dispatch SMS', async () => {
      jest
        .spyOn(authRepository, 'findByPhone')
        .mockResolvedValue(mockPendingUser);
      jest
        .spyOn(authRepository, 'getPhoneOtpCooldown')
        .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
      jest.spyOn(authRepository, 'getPhoneOtpResendCount').mockResolvedValue(1);
      const storePhoneOtpSpy = jest
        .spyOn(authRepository, 'storePhoneOtp')
        .mockResolvedValue('OK');
      const setPhoneCooldownSpy = jest
        .spyOn(authRepository, 'setPhoneOtpCooldown')
        .mockResolvedValue('OK');
      const incPhoneCountSpy = jest
        .spyOn(authRepository, 'incrementPhoneOtpResendCount')
        .mockResolvedValue(2);
      const smsSpy = jest
        .spyOn(smsService, 'sendPhoneVerificationOtp')
        .mockResolvedValue({ success: true, sid: 'sms-general-resend' });

      const result = await authService.resendOtp({
        type: 'phone',
        phone: '+1234567890',
      });

      expect(result).toEqual({
        type: 'phone',
        recipient: '+1234567890',
      });
      expect(storePhoneOtpSpy).toHaveBeenCalled();
      expect(setPhoneCooldownSpy).toHaveBeenCalled();
      expect(incPhoneCountSpy).toHaveBeenCalled();
      expect(smsSpy).toHaveBeenCalled();
    });

    it('12. should enforce cooldown and reject with 429 when cooldown is active for email', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockPendingUser);
      jest
        .spyOn(authRepository, 'getResendCooldown')
        .mockResolvedValue({ inCooldown: true, ttlRemaining: 45 });

      await expect(
        authService.resendOtp({
          type: 'email',
          email: 'jane.doe@university.edu',
        })
      ).rejects.toThrow('Please wait 45 seconds');
    });

    it('13. should enforce maximum resends and reject with 429 when max count reached for email', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockPendingUser);
      jest
        .spyOn(authRepository, 'getResendCooldown')
        .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
      jest
        .spyOn(authRepository, 'getResendCount')
        .mockResolvedValue(EMAIL_OTP_MAX_RESENDS);

      await expect(
        authService.resendOtp({
          type: 'email',
          email: 'jane.doe@university.edu',
        })
      ).rejects.toThrow('Maximum verification code resend limit reached');
    });

    it('13b. should enforce maximum resends and reject with 429 when max count reached for phone', async () => {
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
        authService.resendOtp({
          type: 'phone',
          phone: '+1234567890',
        })
      ).rejects.toThrow('Maximum verification code resend limit reached');
    });

    it('14. should preserve enumeration protection on nonexistent account', async () => {
      jest.spyOn(authRepository, 'findByEmail').mockResolvedValue(null);

      const result = await authService.resendOtp({
        type: 'email',
        email: 'nonexistent@university.edu',
      });

      expect(result).toEqual({
        type: 'email',
        recipient: 'nonexistent@university.edu',
      });
    });

    it('15. should reject already verified email with 409 Conflict', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue({ ...mockPendingUser, isEmailVerified: true });

      await expect(
        authService.resendOtp({
          type: 'email',
          email: 'jane.doe@university.edu',
        })
      ).rejects.toThrow('This email address is already verified');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. HTTP ENDPOINT: POST /api/v1/auth/resend-otp
  // ───────────────────────────────────────────────────────────────────────────
  describe('HTTP Endpoint: POST /api/v1/auth/resend-otp', () => {
    it('16. should return 200 OK for email resend with standardized response', async () => {
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
        .mockResolvedValue({ success: true, messageId: 'msg-resend' });

      const res = await request(app).post('/api/v1/auth/resend-otp').send({
        type: 'email',
        email: 'jane.doe@university.edu',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Verification code sent successfully');
      expect(res.body.data.recipient).toBe('jane.doe@university.edu');
      // Zero leakage
      expect(res.body.data).not.toHaveProperty('otp');
      expect(res.body.data).not.toHaveProperty('otpHash');
    });

    it('17. should return 200 OK for phone resend with standardized response', async () => {
      jest
        .spyOn(authRepository, 'findByPhone')
        .mockResolvedValue(mockPendingUser);
      jest
        .spyOn(authRepository, 'getPhoneOtpCooldown')
        .mockResolvedValue({ inCooldown: false, ttlRemaining: 0 });
      jest.spyOn(authRepository, 'getPhoneOtpResendCount').mockResolvedValue(0);
      jest.spyOn(authRepository, 'storePhoneOtp').mockResolvedValue('OK');
      jest.spyOn(authRepository, 'setPhoneOtpCooldown').mockResolvedValue('OK');
      jest
        .spyOn(authRepository, 'incrementPhoneOtpResendCount')
        .mockResolvedValue(1);
      jest
        .spyOn(smsService, 'sendPhoneVerificationOtp')
        .mockResolvedValue({ success: true, sid: 'sms-resend' });

      const res = await request(app).post('/api/v1/auth/resend-otp').send({
        type: 'phone',
        phone: '+1234567890',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Verification code sent successfully');
      expect(res.body.data.recipient).toBe('+1234567890');
      // Zero leakage
      expect(res.body.data).not.toHaveProperty('otp');
      expect(res.body.data).not.toHaveProperty('otpHash');
    });

    it('18. should reject invalid purpose with 422 Unprocessable Entity', async () => {
      const res = await request(app).post('/api/v1/auth/resend-otp').send({
        type: 'password_reset',
        email: 'jane.doe@university.edu',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('19. should reject missing required identifier with 422 Unprocessable Entity', async () => {
      const res = await request(app).post('/api/v1/auth/resend-otp').send({
        type: 'email',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('20. should return 429 when cooldown is active via HTTP', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockPendingUser);
      jest
        .spyOn(authRepository, 'getResendCooldown')
        .mockResolvedValue({ inCooldown: true, ttlRemaining: 30 });

      const res = await request(app).post('/api/v1/auth/resend-otp').send({
        type: 'email',
        email: 'jane.doe@university.edu',
      });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Please wait 30 seconds');
    });
  });
});
