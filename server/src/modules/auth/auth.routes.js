'use strict';

const express = require('express');
const catchAsync = require('../../shared/utils/catchAsync');
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

// ─── Token Refresh Route (Sprint 2.9) ───────────────────────────────────────

router.post('/refresh', authController.refresh);

// ─── Placeholders for Future Sprints (Preserved) ─────────────────────────────

router.post(
  '/logout',
  catchAsync(async (req, res) => {
    return res.success(
      {
        loggedOut: true,
        requestId: req.id,
      },
      'Logged out successfully (placeholder)'
    );
  })
);

module.exports = {
  authRouter: router,
  router,
};
