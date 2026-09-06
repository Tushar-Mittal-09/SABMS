'use strict';

const express = require('express');
const {
  validateBody,
} = require('../../core/middleware/validateRequest.middleware');
const {
  registerSchema,
  verifyEmailSchema,
  resendEmailOtpSchema,
  verifyPhoneSchema,
  resendPhoneOtpSchema,
  loginSchema,
  forgotPasswordSchema,
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

module.exports = {
  authRouter: router,
  router,
};
