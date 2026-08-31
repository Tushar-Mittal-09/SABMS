'use strict';

const config = require('../../config/env.config');
const AppError = require('../../core/errors/AppError');
const catchAsync = require('../../shared/utils/catchAsync');
const authService = require('./auth.service');
const { COOKIE_KEYS } = require('./auth.constants');
const { getRefreshTokenCookieOptions } = require('./auth.helper');
const {
  formatRegistrationResponse,
  formatVerifyEmailResponse,
  formatVerifyPhoneResponse,
  formatLoginResponse,
} = require('./auth.response');

/**
 * Authentication HTTP Controller (Sprint 2.4, Sprint 2.5, Sprint 2.6, Sprint 2.7, Sprint 2.8 & Sprint 2.9).
 *
 * Responsibilities:
 * - Extracts request payload from Express request.
 * - Delegates execution to AuthService.
 * - Formats sanitized domain response via auth.response.js.
 * - Dispatches standardized HTTP responses.
 * - Issues HttpOnly cookies for long-lived refresh tokens upon successful authentication.
 * - Contains NO direct database/Mongoose access, NO Redis operations, and NO OTP generation.
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
   * User Login Endpoint Handler (Sprint 2.7, Sprint 2.8 & Sprint 2.9).
   * POST /api/v1/auth/login
   */
  login = catchAsync(async (req, res) => {
    const loginResult = await authService.login(req.body);
    const user = loginResult.user || loginResult;

    // Issue HttpOnly Refresh Token Cookie (Sprint 2.9)
    if (loginResult.refreshToken) {
      const cookieName =
        config.jwt?.refreshCookieName || COOKIE_KEYS.REFRESH_TOKEN;
      const cookieOptions = getRefreshTokenCookieOptions();
      res.cookie(cookieName, loginResult.refreshToken, cookieOptions);
    }

    const responseData = formatLoginResponse(user, {
      accessToken: loginResult.accessToken,
      tokenType: loginResult.tokenType || 'Bearer',
      expiresIn: loginResult.expiresIn,
    });
    return res.success(responseData, 'Authentication successful.');
  });

  /**
   * Access Token Refresh & Single-Use Rotation Endpoint Handler (Sprint 2.9 & Sprint 2.10).
   * POST /api/v1/auth/refresh
   *
   * Security Boundaries:
   * - Reads refresh token strictly from HttpOnly cookie (req.cookies / req.signedCookies).
   * - Ignores/rejects tokens provided in request body, Authorization headers, or query parameters.
   * - Replaces the HttpOnly refresh token cookie with the newly rotated single-use token (Sprint 2.10).
   * - Never returns the refresh token in JSON response payload.
   * - Clears the refresh token cookie upon reuse detection.
   */
  refresh = catchAsync(async (req, res) => {
    const cookieName =
      config.jwt?.refreshCookieName || COOKIE_KEYS.REFRESH_TOKEN;
    const refreshToken =
      req.cookies?.[cookieName] || req.signedCookies?.[cookieName];

    if (!refreshToken) {
      throw AppError.unauthorized('Refresh token is required');
    }

    try {
      const refreshResult = await authService.refreshAccessToken(refreshToken);
      const user = refreshResult.user || refreshResult;

      // Replace HttpOnly Refresh Token Cookie with newly rotated token (Sprint 2.10)
      if (refreshResult.refreshToken) {
        const cookieOptions = getRefreshTokenCookieOptions();
        res.cookie(cookieName, refreshResult.refreshToken, cookieOptions);
      }

      const responseData = formatLoginResponse(user, {
        accessToken: refreshResult.accessToken,
        tokenType: refreshResult.tokenType || 'Bearer',
        expiresIn: refreshResult.expiresIn,
      });

      return res.success(responseData, 'Access token refreshed successfully.');
    } catch (err) {
      if (err.isTokenReuse) {
        const cookieOptions = getRefreshTokenCookieOptions();
        res.clearCookie(cookieName, cookieOptions);
      }
      throw err;
    }
  });
}

const authControllerInstance = new AuthController();

module.exports = authControllerInstance;
module.exports.AuthController = AuthController;
module.exports.authController = authControllerInstance;
