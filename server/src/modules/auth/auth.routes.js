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
} = require('./auth.schema');
const authController = require('./auth.controller');

const router = express.Router();

// ─── Registration & Email Verification Routes (Sprint 2.4 & Sprint 2.5) ───────

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

// ─── Placeholders for Future Sprints (Preserved) ─────────────────────────────

router.post(
  '/login',
  catchAsync(async (req, res) => {
    return res.success(
      {
        token: 'placeholder_token',
        requestId: req.id,
        apiVersion: req.apiVersion,
      },
      'Login successful (placeholder)'
    );
  })
);

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

router.post(
  '/refresh',
  catchAsync(async (req, res) => {
    return res.success(
      {
        token: 'placeholder_new_token',
        requestId: req.id,
      },
      'Token refreshed (placeholder)'
    );
  })
);

module.exports = {
  authRouter: router,
  router,
};
