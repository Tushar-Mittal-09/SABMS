'use strict';

const express = require('express');
const {
  validateBody,
} = require('../../core/middleware/validateRequest.middleware');
const { authenticate } = require('../../core/middleware/auth.middleware');
const {
  registerSchema,
  verifyEmailSchema,
  resendEmailOtpSchema,
  verifyPhoneSchema,
  resendPhoneOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  resendOtpSchema,
} = require('./auth.schema');
const authController = require('./auth.controller');

const router = express.Router();

// ─── Registration, Email/Phone Verification & Login Routes (Sprint 2.4 - 2.7) ───

router.post('/register', validateBody(registerSchema), authController.register);

router.post(
  '/verify-email',
  validateBody(verifyEmailSchema),
  authController.verifyEmail
);

router.post(
  '/resend-email-otp',
  validateBody(resendEmailOtpSchema),
  authController.resendEmailOtp
);

router.post(
  '/verify-phone',
  validateBody(verifyPhoneSchema),
  authController.verifyPhone
);

router.post(
  '/resend-phone-otp',
  validateBody(resendPhoneOtpSchema),
  authController.resendPhoneOtp
);

router.post('/login', validateBody(loginSchema), authController.login);

// ─── Token Refresh Route (Sprint 2.9 & Sprint 2.10) ─────────────────────────

router.post('/refresh', authController.refresh);

// ─── User Logout Route (Sprint 2.11) ────────────────────────────────────────

router.post('/logout', authController.logout);

// ─── Forgot Password Route (Sprint 2.12) ────────────────────────────────────

router.post(
  '/forgot-password',
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);

// ─── Reset Password Route (Sprint 2.13) ─────────────────────────────────────

router.post(
  '/reset-password',
  validateBody(resetPasswordSchema),
  authController.resetPassword
);

// ─── Change Password Route (Sprint 2.14) ────────────────────────────────────

router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePassword
);

// ─── General OTP Resend Route (Sprint 2.15) ─────────────────────────────────

router.post(
  '/resend-otp',
  validateBody(resendOtpSchema),
  authController.resendOtp
);

// ─── Session Security & Management Routes (Sprint 2.16) ───────────────────

router.get('/sessions', authenticate, authController.getSessions);
router.delete(
  '/sessions/:sessionId',
  authenticate,
  authController.revokeSession
);
router.delete('/sessions', authenticate, authController.revokeAllOtherSessions);

module.exports = {
  authRouter: router,
  router,
};
