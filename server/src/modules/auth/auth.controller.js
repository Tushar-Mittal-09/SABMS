'use strict';

const catchAsync = require('../../shared/utils/catchAsync');
const authService = require('./auth.service');
const {
  formatRegistrationResponse,
  formatVerifyEmailResponse,
  formatVerifyPhoneResponse,
  formatLoginResponse,
} = require('./auth.response');

/**
 * Authentication HTTP Controller (Sprint 2.4, Sprint 2.5, Sprint 2.6 & Sprint 2.7).
 *
 * Responsibilities:
 * - Extracts request payload from Express request.
 * - Delegates execution to AuthService.
 * - Formats sanitized domain response via auth.response.js.
 * - Dispatches standardized HTTP responses.
 * - Contains NO business logic, NO direct database/Mongoose access, NO Redis operations, and NO OTP generation.
 */
class AuthController {
  /**
   * Public User Registration Endpoint Handler.
   * POST /api/v1/auth/register
   */
  register = catchAsync(async (req, res) => {
    const user = await authService.register(req.body);
    const responseData = formatRegistrationResponse(user);
    return res.created(responseData, 'User registered successfully');
  });

  /**
   * Email Verification OTP Submission Endpoint Handler.
   * POST /api/v1/auth/verify-email
   */
  verifyEmail = catchAsync(async (req, res) => {
    const { email, otp } = req.body;
    const user = await authService.verifyEmailOtp(email, otp);
    const responseData = formatVerifyEmailResponse(user);
    return res.success(responseData, 'Email verified successfully');
  });

  /**
   * Email Verification OTP Resend Endpoint Handler.
   * POST /api/v1/auth/resend-email-otp
   */
  resendEmailOtp = catchAsync(async (req, res) => {
    const { email } = req.body;
    const result = await authService.resendEmailVerificationOtp(email);
    return res.success(
      { email: result.email },
      'Verification code sent successfully'
    );
  });

  /**
   * Phone Verification OTP Submission Endpoint Handler.
   * POST /api/v1/auth/verify-phone
   */
  verifyPhone = catchAsync(async (req, res) => {
    const { phone, otp } = req.body;
    const user = await authService.verifyPhoneOtp(phone, otp);
    const responseData = formatVerifyPhoneResponse(user);
    return res.success(responseData, 'Phone verified successfully');
  });

  /**
   * Phone Verification OTP Resend Endpoint Handler.
   * POST /api/v1/auth/resend-phone-otp
   */
  resendPhoneOtp = catchAsync(async (req, res) => {
    const { phone } = req.body;
    const result = await authService.resendPhoneVerificationOtp(phone);
    return res.success(
      { phone: result.phone },
      'Verification code sent successfully'
    );
  });

  /**
   * User Login Endpoint Handler (Sprint 2.7 & Sprint 2.8).
   * POST /api/v1/auth/login
   */
  login = catchAsync(async (req, res) => {
    const loginResult = await authService.login(req.body);
    const user = loginResult.user || loginResult;
    const responseData = formatLoginResponse(user, {
      accessToken: loginResult.accessToken,
      tokenType: loginResult.tokenType || 'Bearer',
      expiresIn: loginResult.expiresIn,
    });
    return res.success(responseData, 'Authentication successful.');
  });
}

const authControllerInstance = new AuthController();

module.exports = authControllerInstance;
module.exports.AuthController = AuthController;
module.exports.authController = authControllerInstance;
