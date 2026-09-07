'use strict';

const request = require('supertest');
const argon2 = require('argon2');
const app = require('../../src/app/app');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const authRepository = require('../../src/modules/auth/auth.repository');
const authService = require('../../src/modules/auth/auth.service');
const emailService = require('../../src/services/email.service');
const { resetPasswordSchema } = require('../../src/modules/auth/auth.schema');
const { hashPasswordResetOtp } = require('../../src/modules/auth/auth.helper');
const {
  REFRESH_TOKEN_STATUSES,
} = require('../../src/modules/auth/auth.constants');

describe('Sprint 2.13 — Reset Password Workflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockExistingUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Jane Doe',
    email: 'jane.doe@university.edu',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUSES.ACTIVE,
    passwordHash:
      '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQ$qU8sQh4j9oW9PjH0GZ7A==',
    isEmailVerified: true,
    isPhoneVerified: true,
  };

  const validOtp = '719302';
  const validNewPassword = 'NewSuperPassword2026!';
  const hashedOtp = hashPasswordResetOtp(validOtp);

  const mockOtpRecord = {
    otpHash: hashedOtp,
    attempts: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300000).toISOString(),
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ZOD SCHEMA VALIDATION (resetPasswordSchema)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Zod Schema Validation & Boundary Protection', () => {
    it('1. should validate valid email, 6-digit OTP, and strong new password', () => {
      const result = resetPasswordSchema.safeParse({
        email: '  JANE.DOE@UNIVERSITY.EDU  ',
        otp: '719302',
        newPassword: 'NewSuperPassword2026!',
      });
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('jane.doe@university.edu');
      expect(result.data.otp).toBe('719302');
      expect(result.data.newPassword).toBe('NewSuperPassword2026!');
    });

    it('2. should reject invalid email', () => {
      const result = resetPasswordSchema.safeParse({
        email: 'invalid-email',
        otp: '719302',
        newPassword: 'NewSuperPassword2026!',
      });
      expect(result.success).toBe(false);
    });

    it('3. should reject non-6-digit OTPs (letters, short, long)', () => {
      expect(
        resetPasswordSchema.safeParse({
          email: 'jane.doe@university.edu',
          otp: '12345',
          newPassword: 'NewSuperPassword2026!',
        }).success
      ).toBe(false);

      expect(
        resetPasswordSchema.safeParse({
          email: 'jane.doe@university.edu',
          otp: '1234567',
          newPassword: 'NewSuperPassword2026!',
        }).success
      ).toBe(false);

      expect(
        resetPasswordSchema.safeParse({
          email: 'jane.doe@university.edu',
          otp: 'abcdef',
          newPassword: 'NewSuperPassword2026!',
        }).success
      ).toBe(false);
    });

    it('4. should reject weak new passwords failing complexity requirements', () => {
      // Missing uppercase
      expect(
        resetPasswordSchema.safeParse({
          email: 'jane.doe@university.edu',
          otp: '719302',
          newPassword: 'newpassword2026!',
        }).success
      ).toBe(false);

      // Missing lowercase
      expect(
        resetPasswordSchema.safeParse({
          email: 'jane.doe@university.edu',
          otp: '719302',
          newPassword: 'NEWPASSWORD2026!',
        }).success
      ).toBe(false);

      // Missing number
      expect(
        resetPasswordSchema.safeParse({
          email: 'jane.doe@university.edu',
          otp: '719302',
          newPassword: 'NewPassword!',
        }).success
      ).toBe(false);

      // Missing special character
      expect(
        resetPasswordSchema.safeParse({
          email: 'jane.doe@university.edu',
          otp: '719302',
          newPassword: 'NewPassword2026',
        }).success
      ).toBe(false);

      // Too short (< 8 chars)
      expect(
        resetPasswordSchema.safeParse({
          email: 'jane.doe@university.edu',
          otp: '719302',
          newPassword: 'P@1',
        }).success
      ).toBe(false);
    });

    it('5. should strictly reject unexpected fields (.strict())', () => {
      const result = resetPasswordSchema.safeParse({
        email: 'jane.doe@university.edu',
        otp: '719302',
        newPassword: 'NewSuperPassword2026!',
        role: 'ADMIN',
        status: 'ACTIVE',
        arbitrary: 'attack',
      });
      expect(result.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. AUTHSERVICE.RESETPASSWORD BUSINESS LOGIC
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthService.resetPassword Business Logic', () => {
    it('6. should successfully reset password, hash with Argon2id, update DB, clear Redis, and revoke tokens', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'getPasswordResetOtp')
        .mockResolvedValue({ ...mockOtpRecord });
      const clearStateSpy = jest
        .spyOn(authRepository, 'clearAllPasswordResetOtpState')
        .mockResolvedValue();
      const revokeTokensSpy = jest
        .spyOn(authRepository, 'revokeAllUserTokens')
        .mockResolvedValue({ modifiedCount: 2 });
      const updateUserSpy = jest
        .spyOn(authRepository, 'updateUserById')
        .mockImplementation(async (id, data) => ({
          ...mockExistingUser,
          passwordHash: data.passwordHash,
        }));
      const emailNoticeSpy = jest
        .spyOn(emailService, 'sendPasswordResetConfirmation')
        .mockResolvedValue({ success: true });

      const result = await authService.resetPassword({
        email: 'jane.doe@university.edu',
        otp: validOtp,
        newPassword: validNewPassword,
      });

      expect(result).toEqual({ success: true });
      expect(updateUserSpy).toHaveBeenCalled();
      const updatedData = updateUserSpy.mock.calls[0][1];
      expect(updatedData.passwordHash).toBeDefined();
      expect(updatedData.passwordHash.startsWith('$argon2id$')).toBe(true);

      // Verify that the new password actually verifies with the new hash
      const isNewPasswordValid = await argon2.verify(
        updatedData.passwordHash,
        validNewPassword
      );
      expect(isNewPasswordValid).toBe(true);

      expect(clearStateSpy).toHaveBeenCalledWith('jane.doe@university.edu');
      expect(revokeTokensSpy).toHaveBeenCalledWith(
        mockExistingUser._id,
        'PASSWORD_RESET'
      );
      expect(emailNoticeSpy).toHaveBeenCalled();
    });

    it('7. should fail if OTP in Redis has expired or does not exist', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest.spyOn(authRepository, 'getPasswordResetOtp').mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          email: 'jane.doe@university.edu',
          otp: validOtp,
          newPassword: validNewPassword,
        })
      ).rejects.toThrow(
        'Verification code has expired or is invalid. Please request a new code.'
      );
    });

    it('8. should increment attempt counter and throw 400 Bad Request on wrong OTP', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'getPasswordResetOtp')
        .mockResolvedValue({ ...mockOtpRecord, attempts: 1 });
      const incrementSpy = jest
        .spyOn(authRepository, 'incrementPasswordResetOtpAttempts')
        .mockResolvedValue({ attempts: 2 });

      await expect(
        authService.resetPassword({
          email: 'jane.doe@university.edu',
          otp: '000000',
          newPassword: validNewPassword,
        })
      ).rejects.toThrow(
        'Invalid verification code. Please check and try again.'
      );

      expect(incrementSpy).toHaveBeenCalledWith('jane.doe@university.edu');
    });

    it('9. should delete OTP and throw 429 when max attempts (5) are reached', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'getPasswordResetOtp')
        .mockResolvedValue({ ...mockOtpRecord, attempts: 4 });
      jest
        .spyOn(authRepository, 'incrementPasswordResetOtpAttempts')
        .mockResolvedValue({ attempts: 5 });
      const deleteOtpSpy = jest
        .spyOn(authRepository, 'deletePasswordResetOtp')
        .mockResolvedValue(1);

      await expect(
        authService.resetPassword({
          email: 'jane.doe@university.edu',
          otp: '999999',
          newPassword: validNewPassword,
        })
      ).rejects.toThrow(
        'Maximum verification attempts exceeded. Code invalidated. Please request a new one.'
      );

      expect(deleteOtpSpy).toHaveBeenCalledWith('jane.doe@university.edu');
    });

    it('10. should immediately delete OTP and throw 429 if already at max attempts before check', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'getPasswordResetOtp')
        .mockResolvedValue({ ...mockOtpRecord, attempts: 5 });
      const deleteOtpSpy = jest
        .spyOn(authRepository, 'deletePasswordResetOtp')
        .mockResolvedValue(1);

      await expect(
        authService.resetPassword({
          email: 'jane.doe@university.edu',
          otp: validOtp,
          newPassword: validNewPassword,
        })
      ).rejects.toThrow(
        'Maximum verification attempts exceeded. Code invalidated. Please request a new one.'
      );

      expect(deleteOtpSpy).toHaveBeenCalledWith('jane.doe@university.edu');
    });

    it('11. should prevent OTP replay attack (OTP deleted after first successful reset)', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      let redisOtp = { ...mockOtpRecord };
      jest
        .spyOn(authRepository, 'getPasswordResetOtp')
        .mockImplementation(async () => redisOtp);
      jest
        .spyOn(authRepository, 'clearAllPasswordResetOtpState')
        .mockImplementation(async () => {
          redisOtp = null;
        });
      jest.spyOn(authRepository, 'revokeAllUserTokens').mockResolvedValue();
      jest
        .spyOn(authRepository, 'updateUserById')
        .mockResolvedValue(mockExistingUser);

      // 1st reset: success
      const firstAttempt = await authService.resetPassword({
        email: 'jane.doe@university.edu',
        otp: validOtp,
        newPassword: validNewPassword,
      });
      expect(firstAttempt.success).toBe(true);

      // 2nd replay attempt with same OTP: fails with expired/invalid
      await expect(
        authService.resetPassword({
          email: 'jane.doe@university.edu',
          otp: validOtp,
          newPassword: 'AnotherPassword2026!',
        })
      ).rejects.toThrow(
        'Verification code has expired or is invalid. Please request a new code.'
      );
    });

    it('12. should handle non-existing user safely without crashing or leaking details', async () => {
      jest.spyOn(authRepository, 'findByEmail').mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          email: 'nonexistent@university.edu',
          otp: validOtp,
          newPassword: validNewPassword,
        })
      ).rejects.toThrow(
        'Verification code has expired or is invalid. Please request a new code.'
      );
    });

    it('13. should handle Redis failure safely and throw 500 internal error', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'getPasswordResetOtp')
        .mockRejectedValue(new Error('Redis connection drop'));

      await expect(
        authService.resetPassword({
          email: 'jane.doe@university.edu',
          otp: validOtp,
          newPassword: validNewPassword,
        })
      ).rejects.toThrow('Temporary service error. Please try again.');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. HTTP ENDPOINT: POST /api/v1/auth/reset-password
  // ───────────────────────────────────────────────────────────────────────────
  describe('HTTP Endpoint: POST /api/v1/auth/reset-password', () => {
    it('14. should return 200 OK with standardized envelope on successful reset', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'getPasswordResetOtp')
        .mockResolvedValue({ ...mockOtpRecord });
      jest
        .spyOn(authRepository, 'clearAllPasswordResetOtpState')
        .mockResolvedValue();
      jest
        .spyOn(authRepository, 'revokeAllUserTokens')
        .mockResolvedValue({ modifiedCount: 1 });
      jest
        .spyOn(authRepository, 'updateUserById')
        .mockResolvedValue(mockExistingUser);

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'jane.doe@university.edu',
        otp: validOtp,
        newPassword: validNewPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        'Password reset successful. All active sessions have been terminated. Please log in.'
      );
      expect(res.body.data).toBeNull();
      // Zero leakage check
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('otp');
    });

    it('15. should reject missing fields with 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: 'jane.doe@university.edu' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('16. should reject extra unexpected properties with 422 Unprocessable Entity', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'jane.doe@university.edu',
        otp: validOtp,
        newPassword: validNewPassword,
        injectedField: 'malicious',
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('17. should reject invalid OTP format with 422 Unprocessable Entity', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'jane.doe@university.edu',
        otp: '123',
        newPassword: validNewPassword,
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('18. should return 400 when OTP is wrong', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'getPasswordResetOtp')
        .mockResolvedValue({ ...mockOtpRecord, attempts: 0 });
      jest
        .spyOn(authRepository, 'incrementPasswordResetOtpAttempts')
        .mockResolvedValue({ attempts: 1 });

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'jane.doe@university.edu',
        otp: '000000',
        newPassword: validNewPassword,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid verification code');
    });

    it('19. should return 429 when max attempts exceeded', async () => {
      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'getPasswordResetOtp')
        .mockResolvedValue({ ...mockOtpRecord, attempts: 4 });
      jest
        .spyOn(authRepository, 'incrementPasswordResetOtpAttempts')
        .mockResolvedValue({ attempts: 5 });
      jest.spyOn(authRepository, 'deletePasswordResetOtp').mockResolvedValue(1);

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'jane.doe@university.edu',
        otp: '000000',
        newPassword: validNewPassword,
      });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain(
        'Maximum verification attempts exceeded'
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. REPOSITORY METHOD TESTS (auth.repository.js)
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthRepository Reset Password & Session Invalidation Methods', () => {
    it('20. should increment attempts and set TTL on first attempt in incrementPasswordResetOtpAttempts', async () => {
      const mockRedis = {
        exists: jest.fn().mockResolvedValue(1),
        incr: jest.fn().mockResolvedValue(1),
        ttl: jest.fn().mockResolvedValue(250),
        expire: jest.fn().mockResolvedValue(1),
      };
      jest.spyOn(authRepository, '_getRedis').mockReturnValue(mockRedis);

      const result =
        await authRepository.incrementPasswordResetOtpAttempts('jane@edu.com');
      expect(result).toEqual({
        attempts: 1,
        otpData: { attempts: 1 },
      });
      expect(mockRedis.incr).toHaveBeenCalledWith(
        'auth:otp:reset:attempts:jane@edu.com'
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'auth:otp:reset:attempts:jane@edu.com',
        250
      );
    });

    it('21. should return null if key does not exist in incrementPasswordResetOtpAttempts', async () => {
      const mockRedis = {
        exists: jest.fn().mockResolvedValue(0),
        incr: jest.fn(),
        del: jest.fn(),
      };
      jest.spyOn(authRepository, '_getRedis').mockReturnValue(mockRedis);

      const result =
        await authRepository.incrementPasswordResetOtpAttempts('jane@edu.com');
      expect(result).toBeNull();
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it('M-01.3 Concurrent invalid password reset OTP attempts atomically exhaust attempts without race-condition bypass', async () => {
      let atomicAttempts = 0;
      let otpActive = true;

      jest
        .spyOn(authRepository, 'findByEmail')
        .mockResolvedValue(mockExistingUser);
      jest
        .spyOn(authRepository, 'getPasswordResetOtp')
        .mockImplementation(async () => {
          if (!otpActive) return null;
          return {
            otpHash: 'valid-otp-hash-string-that-will-not-match',
            attempts: atomicAttempts,
          };
        });
      jest
        .spyOn(authRepository, 'getPasswordResetOtpAttempts')
        .mockImplementation(async () => atomicAttempts);
      jest
        .spyOn(authRepository, 'incrementPasswordResetOtpAttempts')
        .mockImplementation(async () => {
          if (!otpActive) return null;
          atomicAttempts += 1;
          return {
            attempts: atomicAttempts,
            otpData: { attempts: atomicAttempts },
          };
        });
      jest
        .spyOn(authRepository, 'deletePasswordResetOtp')
        .mockImplementation(async () => {
          otpActive = false;
          return 1;
        });

      // Fire 10 concurrent requests
      const requests = Array.from({ length: 10 }).map(() =>
        request(app).post('/api/v1/auth/reset-password').send({
          email: 'jane.doe@university.edu',
          otp: '999999', // wrong OTP
          newPassword: validNewPassword,
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

    it('22. should revoke all refresh tokens for a user in revokeAllUserTokens', async () => {
      const mockModel = {
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
      };
      authRepository._refreshTokenModel = mockModel;

      const result = await authRepository.revokeAllUserTokens(
        '507f1f77bcf86cd799439011'
      );
      expect(result.modifiedCount).toBe(3);
      expect(mockModel.updateMany).toHaveBeenCalledWith(
        {
          userId: '507f1f77bcf86cd799439011',
          status: { $ne: REFRESH_TOKEN_STATUSES.REVOKED },
        },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: REFRESH_TOKEN_STATUSES.REVOKED,
            revokedReason: 'Password reset',
          }),
        })
      );
    });
  });
});
