'use strict';

const request = require('supertest');
const argon2 = require('argon2');
const app = require('../../src/app/app');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const authRepository = require('../../src/modules/auth/auth.repository');
const authService = require('../../src/modules/auth/auth.service');
const emailService = require('../../src/services/email.service');
const { changePasswordSchema } = require('../../src/modules/auth/auth.schema');
const { generateAccessToken } = require('../../src/modules/auth/auth.helper');

describe('Sprint 2.14 — Change Password Workflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const originalPassword = 'OldSecurePassword123!';
  let initialPasswordHash;

  beforeAll(async () => {
    initialPasswordHash = await argon2.hash(originalPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  });

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Jane Doe',
    email: 'jane.doe@university.edu',
    role: USER_ROLES.STUDENT,
    status: ACCOUNT_STATUSES.ACTIVE,
    isEmailVerified: true,
    isPhoneVerified: true,
  };

  const getValidToken = (userId = mockUser._id) => {
    return generateAccessToken({
      _id: userId,
      role: mockUser.role,
      email: mockUser.email,
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ZOD SCHEMA VALIDATION (changePasswordSchema)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Zod Schema Validation & Boundary Protection', () => {
    it('1. should validate valid current and new password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldSecurePassword123!',
        newPassword: 'NewSuperPassword2026!',
        logoutOtherDevices: true,
      });
      expect(result.success).toBe(true);
      expect(result.data.logoutOtherDevices).toBe(true);
    });

    it('2. should default logoutOtherDevices to false if omitted', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldSecurePassword123!',
        newPassword: 'NewSuperPassword2026!',
      });
      expect(result.success).toBe(true);
      expect(result.data.logoutOtherDevices).toBe(false);
    });

    it('3. should reject missing currentPassword', () => {
      const result = changePasswordSchema.safeParse({
        newPassword: 'NewSuperPassword2026!',
      });
      expect(result.success).toBe(false);
    });

    it('4. should reject weak new passwords failing complexity requirements', () => {
      // Missing uppercase
      expect(
        changePasswordSchema.safeParse({
          currentPassword: 'OldSecurePassword123!',
          newPassword: 'newpassword2026!',
        }).success
      ).toBe(false);

      // Missing number
      expect(
        changePasswordSchema.safeParse({
          currentPassword: 'OldSecurePassword123!',
          newPassword: 'NewPassword!',
        }).success
      ).toBe(false);

      // Missing special char
      expect(
        changePasswordSchema.safeParse({
          currentPassword: 'OldSecurePassword123!',
          newPassword: 'NewPassword2026',
        }).success
      ).toBe(false);

      // Too short (< 8 chars)
      expect(
        changePasswordSchema.safeParse({
          currentPassword: 'OldSecurePassword123!',
          newPassword: 'P@1',
        }).success
      ).toBe(false);
    });

    it('5. should strictly reject unexpected fields (.strict())', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldSecurePassword123!',
        newPassword: 'NewSuperPassword2026!',
        role: 'ADMIN',
        unauthorizedField: 'attack',
      });
      expect(result.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. AUTHSERVICE.CHANGEPASSWORD BUSINESS LOGIC
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthService.changePassword Business Logic', () => {
    it('6. should successfully change password, hash with Argon2id, and update DB', async () => {
      const userWithHash = { ...mockUser, passwordHash: initialPasswordHash };
      jest.spyOn(authRepository, 'findById').mockResolvedValue(userWithHash);
      const updateSpy = jest
        .spyOn(authRepository, 'updateUserById')
        .mockImplementation(async (id, data) => ({
          ...userWithHash,
          passwordHash: data.passwordHash,
        }));
      const emailSpy = jest
        .spyOn(emailService, 'sendPasswordResetConfirmation')
        .mockResolvedValue({ success: true });

      const result = await authService.changePassword({
        userId: mockUser._id,
        currentPassword: originalPassword,
        newPassword: 'NewSuperPassword2026!',
        logoutOtherDevices: false,
      });

      expect(result).toEqual({ success: true });
      expect(updateSpy).toHaveBeenCalled();
      const updatedHash = updateSpy.mock.calls[0][1].passwordHash;
      expect(updatedHash.startsWith('$argon2id$')).toBe(true);

      // Old password should fail against new hash
      const oldVerify = await argon2.verify(updatedHash, originalPassword);
      expect(oldVerify).toBe(false);

      // New password should succeed against new hash
      const newVerify = await argon2.verify(
        updatedHash,
        'NewSuperPassword2026!'
      );
      expect(newVerify).toBe(true);

      expect(emailSpy).toHaveBeenCalled();
    });

    it('7. should revoke other device sessions when logoutOtherDevices is true', async () => {
      const userWithHash = { ...mockUser, passwordHash: initialPasswordHash };
      jest.spyOn(authRepository, 'findById').mockResolvedValue(userWithHash);
      jest
        .spyOn(authRepository, 'updateUserById')
        .mockResolvedValue(userWithHash);
      const revokeSpy = jest
        .spyOn(authRepository, 'revokeAllUserTokens')
        .mockResolvedValue({ modifiedCount: 3 });

      await authService.changePassword({
        userId: mockUser._id,
        currentPassword: originalPassword,
        newPassword: 'NewSuperPassword2026!',
        logoutOtherDevices: true,
      });

      expect(revokeSpy).toHaveBeenCalledWith(mockUser._id, 'PASSWORD_RESET');
    });

    it('8. should NOT revoke sessions when logoutOtherDevices is false', async () => {
      const userWithHash = { ...mockUser, passwordHash: initialPasswordHash };
      jest.spyOn(authRepository, 'findById').mockResolvedValue(userWithHash);
      jest
        .spyOn(authRepository, 'updateUserById')
        .mockResolvedValue(userWithHash);
      const revokeSpy = jest
        .spyOn(authRepository, 'revokeAllUserTokens')
        .mockResolvedValue({ modifiedCount: 0 });

      await authService.changePassword({
        userId: mockUser._id,
        currentPassword: originalPassword,
        newPassword: 'NewSuperPassword2026!',
        logoutOtherDevices: false,
      });

      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('9. should reject when current password does not match stored hash', async () => {
      const userWithHash = { ...mockUser, passwordHash: initialPasswordHash };
      jest.spyOn(authRepository, 'findById').mockResolvedValue(userWithHash);

      await expect(
        authService.changePassword({
          userId: mockUser._id,
          currentPassword: 'WrongPassword999!',
          newPassword: 'NewSuperPassword2026!',
        })
      ).rejects.toThrow('Invalid current password.');
    });

    it('10. should reject when new password is identical to current password', async () => {
      const userWithHash = { ...mockUser, passwordHash: initialPasswordHash };
      jest.spyOn(authRepository, 'findById').mockResolvedValue(userWithHash);

      await expect(
        authService.changePassword({
          userId: mockUser._id,
          currentPassword: originalPassword,
          newPassword: originalPassword,
        })
      ).rejects.toThrow('New password must be different from current password');
    });

    it('11. should reject when user is not found in database', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(null);

      await expect(
        authService.changePassword({
          userId: 'nonexistent-user-id',
          currentPassword: originalPassword,
          newPassword: 'NewSuperPassword2026!',
        })
      ).rejects.toThrow('User account not found');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. HTTP ENDPOINT: POST /api/v1/auth/change-password
  // ───────────────────────────────────────────────────────────────────────────
  describe('HTTP Endpoint: POST /api/v1/auth/change-password', () => {
    it('12. should reject unauthenticated request (missing Authorization header) with 401', async () => {
      const res = await request(app).post('/api/v1/auth/change-password').send({
        currentPassword: originalPassword,
        newPassword: 'NewSuperPassword2026!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });

    it('13. should reject malformed or invalid token with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', 'Bearer invalid.token.value')
        .send({
          currentPassword: originalPassword,
          newPassword: 'NewSuperPassword2026!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid token');
    });

    it('14. should successfully change password and return 200 OK with valid bearer token', async () => {
      const token = getValidToken(mockUser._id);
      const userWithHash = { ...mockUser, passwordHash: initialPasswordHash };
      jest.spyOn(authRepository, 'findById').mockResolvedValue(userWithHash);
      jest
        .spyOn(authRepository, 'updateUserById')
        .mockResolvedValue(userWithHash);

      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: originalPassword,
          newPassword: 'NewSuperPassword2026!',
          logoutOtherDevices: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Password updated successfully.');
      expect(res.body.data).toBeNull();
      // Zero leakage
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('15. should return 401 when current password verification fails', async () => {
      const token = getValidToken(mockUser._id);
      const userWithHash = { ...mockUser, passwordHash: initialPasswordHash };
      jest.spyOn(authRepository, 'findById').mockResolvedValue(userWithHash);

      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'IncorrectPassword!',
          newPassword: 'NewSuperPassword2026!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid current password');
    });

    it('16. should reject invalid new password with 422 Unprocessable Entity', async () => {
      const token = getValidToken(mockUser._id);

      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: originalPassword,
          newPassword: 'short',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('17. should reject unexpected properties with 422 Unprocessable Entity', async () => {
      const token = getValidToken(mockUser._id);

      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: originalPassword,
          newPassword: 'NewSuperPassword2026!',
          adminFlag: true,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });
});
