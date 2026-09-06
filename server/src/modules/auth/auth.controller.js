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

  /**
   * User Logout Endpoint Handler (Sprint 2.11).
   * POST /api/v1/auth/logout
   *
   * Security Boundaries:
   * - Reads refresh token strictly from HttpOnly cookie (req.cookies / req.signedCookies).
   * - Ignores/rejects tokens provided in request body, Authorization headers, or query parameters.
   * - Cryptographically validates the refresh token and invalidates the entire associated token family.
   * - Strictly clears the HttpOnly refresh token cookie matching configured attributes (HttpOnly, SameSite, Path, Secure).
   * - Idempotent: Returns safe successful response if cookie is absent, expired, or already revoked.
   * - Never returns sensitive credentials, JWT secrets, passwords, or tokens in JSON payload.
   */
  logout = catchAsync(async (req, res) => {
    const cookieName =
      config.jwt?.refreshCookieName || COOKIE_KEYS.REFRESH_TOKEN;
    const refreshToken =
      req.cookies?.[cookieName] || req.signedCookies?.[cookieName];

    await authService.logout(refreshToken);

    const cookieOptions = getRefreshTokenCookieOptions();
    res.clearCookie(cookieName, cookieOptions);

    return res.success(null, 'Logged out successfully');
  });

  /**
   * Password Reset Initiation Endpoint Handler (Sprint 2.12).
   * POST /api/v1/auth/forgot-password
   *
   * Security Boundaries:
   * - Validates email strictly via forgotPasswordSchema.
   * - Returns identical HTTP 200 generic message for both existing and non-existing accounts.
   * - Never exposes user existence, registration status, OTP, or Redis state.
   */
  forgotPassword = catchAsync(async (req, res) => {
    const { email } = req.body;
    await authService.forgotPassword(email);
    return res.success(
      null,
      'If an account exists with this email, a reset code has been sent.'
    );
  });

  /**
   * Password Reset Finalization Endpoint Handler (Sprint 2.13).
   * POST /api/v1/auth/reset-password
   *
   * Security Boundaries:
   * - Validates email, OTP, and newPassword strictly via resetPasswordSchema.
   * - Hashes new password with memory-hard Argon2id.
   * - Invalidates reset OTP immediately upon successful verification.
   * - Revokes all active refresh tokens for the user account.
   * - Never exposes user data, passwords, or tokens in response.
   */
  resetPassword = catchAsync(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    await authService.resetPassword({ email, otp, newPassword });
    return res.success(
      null,
      'Password reset successful. All active sessions have been terminated. Please log in.'
    );
  });

  /**
   * Authenticated Password Change Endpoint Handler (Sprint 2.14).
   * POST /api/v1/auth/change-password
   *
   * Security Boundaries:
   * - Requires authenticated access token (req.user).
   * - Validates currentPassword and newPassword strictly via changePasswordSchema.
   * - Verifies current password before updating.
   * - Hashes new password with Argon2id.
   * - Optionally revokes other active sessions if logoutOtherDevices is set.
   * - Never exposes passwords or tokens in response.
   */
  changePassword = catchAsync(async (req, res) => {
    const userId = req.user?.id || req.user?.sub;
    const { currentPassword, newPassword, logoutOtherDevices } = req.body;
    await authService.changePassword({
      userId,
      currentPassword,
      newPassword,
      logoutOtherDevices: Boolean(logoutOtherDevices),
    });
    return res.success(null, 'Password updated successfully.');
  });

  /**
   * General OTP Resend Endpoint Handler (Sprint 2.15).
   * POST /api/v1/auth/resend-otp
   */
  resendOtp = catchAsync(async (req, res) => {
    const { type, purpose, email, phone } = req.body;
    const result = await authService.resendOtp({
      type: type || purpose,
      email,
      phone,
    });
    return res.success(result, 'Verification code sent successfully');
  });
}

const authControllerInstance = new AuthController();

module.exports = authControllerInstance;
module.exports.AuthController = AuthController;
module.exports.authController = authControllerInstance;
