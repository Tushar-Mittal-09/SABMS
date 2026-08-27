'use strict';

const userRepository = require('../users/user.repository');
const authRepository = require('./auth.repository');
const {
  hashPassword,
  verifyPassword,
} = require('../../services/password.service');
const emailService = require('../../services/email.service');
const smsService = require('../../services/sms.service');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../shared/constants');
const {
  EMAIL_OTP_LENGTH,
  EMAIL_OTP_TTL_SECONDS,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_MAX_RESENDS,
  PHONE_OTP_LENGTH,
  PHONE_OTP_TTL_SECONDS,
  PHONE_OTP_RESEND_COOLDOWN_SECONDS,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_MAX_RESENDS,
} = require('./auth.constants');
const {
  normalizeEmail,
  normalizePhone,
  generateEmailOtp,
  generatePhoneOtp,
  hashEmailOtp,
  hashPhoneOtp,
  verifyEmailOtpHash,
  verifyPhoneOtpHash,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('./auth.helper');
const config = require('../../config/env.config');
const AppError = require('../../core/errors/AppError');
const logger = require('../../core/logger');

/**
 * Authentication Business Service (Sprint 2.4, Sprint 2.5 & Sprint 2.6).
 *
 * Responsibilities:
 * - Orchestrates user registration business rules and data normalization.
 * - Enforces application-level duplicate email checks.
 * - Delegates password hashing to isolated cryptographic security service.
 * - Enforces server-controlled canonical defaults (STUDENT role, PENDING status, unverified).
 * - Manages Email OTP verification lifecycle.
 * - Manages Phone OTP verification lifecycle (generation, hashing, Redis storage, SMS dispatch, verification, resend limits).
 * - Has no Express req/res or HTTP protocol dependencies.
 */
class AuthService {
  /**
   * @param {Object} [options]
   * @param {import('../users/user.repository').UserRepository} [options.userRepo]
   * @param {import('./auth.repository').AuthRepository} [options.authRepo]
   * @param {Object} [options.emailService]
   * @param {Object} [options.smsService]
   */
  constructor(options = {}) {
    this._userRepository = options.userRepo || userRepository;
    this._authRepository = options.authRepo || authRepository;
    this._emailService = options.emailService || emailService;
    this._smsService = options.smsService || smsService;
  }

  /**
   * Registers a new user account.
   *
   * @param {Object} registrationData - Validated user registration input.
   * @param {string} registrationData.name - User's full name.
   * @param {string} registrationData.email - User's email address.
   * @param {string} [registrationData.phone] - User's contact phone number.
   * @param {string} registrationData.password - Plaintext password candidate.
   * @param {string} [registrationData.department] - Academic or administrative department.
   * @returns {Promise<import('mongoose').Document>} Persisted user document.
   * @throws {AppError} 409 Conflict if email is already registered, or 422 if password violates policy.
   */
  async register(registrationData) {
    const { name, email, phone, password, department } = registrationData;

    // 1. Normalize email address
    const normalizedEmail = normalizeEmail(email);

    // 2. Application-level duplicate email check
    const emailExists =
      await this._userRepository.existsByEmail(normalizedEmail);
    if (emailExists) {
      throw AppError.conflict('An account with this email already exists');
    }

    // 3. Cryptographically hash password using Argon2id (enforces complexity policy)
    const passwordHash = await hashPassword(password);

    // 4. Construct domain persistence payload with canonical server-controlled attributes
    const userPayload = {
      name: name ? name.trim() : '',
      email: normalizedEmail,
      phone:
        phone && typeof phone === 'string' && phone.trim().length > 0
          ? phone.trim()
          : null,
      department:
        department &&
        typeof department === 'string' &&
        department.trim().length > 0
          ? department.trim()
          : null,
      passwordHash,
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUSES.PENDING,
      isEmailVerified: false,
      isPhoneVerified: false,
    };

    // 5. Persist via User Repository with database duplicate key safety
    let createdUser;
    try {
      createdUser = await this._userRepository.create(userPayload);
    } catch (err) {
      if (err.code === 11000) {
        throw AppError.conflict('An account with this email already exists');
      }
      throw err;
    }

    // 6. Automatically dispatch initial email verification OTP
    try {
      await this.sendEmailVerificationOtp(createdUser);
    } catch (otpErr) {
      logger.warn(
        `Failed to automatically dispatch initial email verification OTP: ${otpErr.message}`,
        {
          context: 'AuthService',
          recipient: normalizedEmail,
        }
      );
    }

    return createdUser;
  }

  /**
   * Generates and dispatches an Email Verification OTP.
   *
   * @param {string|Object} emailOrUser - Target user email address or persisted user object.
   * @returns {Promise<{ email: string, message: string }>} Sanitized success result.
   */
  async sendEmailVerificationOtp(emailOrUser) {
    let user;
    let normalizedEmail;

    if (typeof emailOrUser === 'object' && emailOrUser !== null) {
      user = emailOrUser;
      normalizedEmail = normalizeEmail(user.email);
    } else {
      normalizedEmail = normalizeEmail(emailOrUser);
      if (!normalizedEmail) {
        throw AppError.badRequest('Valid email address is required');
      }

      // 2. Find user
      user = await this._authRepository.findByEmail(normalizedEmail);
      if (!user) {
        throw AppError.notFound('No account found with this email address');
      }
    }

    // 3. Check if already verified
    if (user.isEmailVerified) {
      throw AppError.conflict('This email address is already verified');
    }

    // 4. Check resend cooldown
    const { inCooldown, ttlRemaining } =
      await this._authRepository.getResendCooldown(normalizedEmail);
    if (inCooldown) {
      throw AppError.tooManyRequests(
        `Please wait ${ttlRemaining} seconds before requesting another verification code`
      );
    }

    // 5. Check resend limits
    const resendCount =
      await this._authRepository.getResendCount(normalizedEmail);
    if (resendCount >= EMAIL_OTP_MAX_RESENDS) {
      throw AppError.tooManyRequests(
        'Maximum verification code resend limit reached. Please try again later.'
      );
    }

    // 6. Generate cryptographically secure 6-digit OTP
    const otp = generateEmailOtp(EMAIL_OTP_LENGTH);

    // 7. Hash OTP using HMAC
    const otpHash = hashEmailOtp(otp);

    // 8. Construct metadata & store in Redis with TTL
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + EMAIL_OTP_TTL_SECONDS * 1000
    ).toISOString();

    const otpData = {
      otpHash,
      attempts: 0,
      createdAt: now.toISOString(),
      expiresAt,
    };

    try {
      await this._authRepository.storeEmailOtp(
        normalizedEmail,
        otpData,
        EMAIL_OTP_TTL_SECONDS
      );

      // 9. Update cooldown and resend counter
      await this._authRepository.setResendCooldown(
        normalizedEmail,
        EMAIL_OTP_RESEND_COOLDOWN_SECONDS
      );
      await this._authRepository.incrementResendCount(
        normalizedEmail,
        EMAIL_OTP_TTL_SECONDS
      );
    } catch (redisError) {
      logger.error(
        `Redis operation failed during OTP generation: ${redisError.message}`,
        {
          context: 'AuthService',
        }
      );
      throw AppError.internal('Temporary service error. Please try again.');
    }

    // 10. Send verification email
    const emailResult = await this._emailService.sendEmailVerificationOtp({
      to: normalizedEmail,
      name: user.name,
      otp,
    });

    if (!emailResult.success) {
      logger.error('Failed to dispatch verification email', {
        context: 'AuthService',
        recipient: normalizedEmail,
      });
      throw AppError.internal(
        'Failed to send verification email. Please try again.'
      );
    }

    // 11. Return sanitized success result (NEVER return the OTP or hash)
    return {
      email: normalizedEmail,
      message: 'Verification code sent successfully',
    };
  }

  /**
   * Verifies an Email OTP and transitions account to ACTIVE status.
   *
   * @param {string} email - User email address.
   * @param {string} otp - Candidate 6-digit numeric OTP.
   * @returns {Promise<import('mongoose').Document>} Updated user document.
   */
  async verifyEmailOtp(email, otp) {
    // 1. Normalize email & validate candidate OTP format
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw AppError.badRequest('Valid email address is required');
    }

    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      throw AppError.badRequest('Verification code must be exactly 6 digits');
    }
    const cleanOtp = otp.trim();

    // 2. Find user in MongoDB
    const user = await this._authRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw AppError.notFound('No account found with this email address');
    }

    // 3. Check if already verified
    if (user.isEmailVerified) {
      throw AppError.conflict('This email address is already verified');
    }

    // 4. Retrieve stored OTP record from Redis
    let otpRecord;
    try {
      otpRecord = await this._authRepository.getEmailOtp(normalizedEmail);
    } catch (redisError) {
      logger.error(`Redis error fetching OTP: ${redisError.message}`, {
        context: 'AuthService',
      });
      throw AppError.internal('Temporary service error. Please try again.');
    }

    if (!otpRecord) {
      throw AppError.badRequest(
        'Verification code has expired or is invalid. Please request a new code.'
      );
    }

    // 5. Check if attempt limit has already been exceeded
    if (otpRecord.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      await this._authRepository.deleteEmailOtp(normalizedEmail);
      throw AppError.tooManyRequests(
        'Maximum verification attempts exceeded. Please request a new code.'
      );
    }

    // 6. Timing-safe verification of supplied OTP against stored hash
    const isOtpValid = verifyEmailOtpHash(cleanOtp, otpRecord.otpHash);

    if (!isOtpValid) {
      // Increment attempt counter in Redis
      const updateResult =
        await this._authRepository.incrementEmailOtpAttempts(normalizedEmail);
      const currentAttempts = updateResult
        ? updateResult.attempts
        : (otpRecord.attempts || 0) + 1;

      if (currentAttempts >= EMAIL_OTP_MAX_ATTEMPTS) {
        await this._authRepository.deleteEmailOtp(normalizedEmail);
        throw AppError.tooManyRequests(
          'Maximum verification attempts exceeded. Please request a new code.'
        );
      }

      throw AppError.badRequest(
        'Invalid verification code. Please check and try again.'
      );
    }

    // 7. Atomic User Account State Transition in MongoDB
    // Transition: isEmailVerified = true, status = ACTIVE
    const userId = user._id || user.id;
    const updatedUser = await this._authRepository.updateUserById(userId, {
      isEmailVerified: true,
      status: ACCOUNT_STATUSES.ACTIVE,
    });

    if (!updatedUser) {
      throw AppError.internal('Failed to update user verification status');
    }

    // Automatically trigger initial Phone OTP if user registered a phone number
    if (updatedUser.phone && !updatedUser.isPhoneVerified) {
      try {
        await this.sendPhoneVerificationOtp(updatedUser);
      } catch (phoneErr) {
        logger.warn(
          `Failed to automatically dispatch initial phone OTP for ${updatedUser.phone}: ${phoneErr.message}`,
          { context: 'AuthService' }
        );
      }
    }

    // 8. Invalidate Redis OTP & resend state to prevent replay attacks
    try {
      await this._authRepository.clearAllOtpState(normalizedEmail);
    } catch (err) {
      logger.warn(
        `Failed to clean up OTP Redis state after verification: ${err.message}`,
        {
          context: 'AuthService',
        }
      );
    }

    logger.info(`Email successfully verified for user: ${normalizedEmail}`, {
      context: 'AuthService',
      userId: updatedUser._id ? updatedUser._id.toString() : updatedUser.id,
    });

    return updatedUser;
  }

  /**
   * Resends a fresh verification OTP to the user's email.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<{ email: string, message: string }>} Sanitized success result.
   */
  async resendEmailVerificationOtp(email) {
    return this.sendEmailVerificationOtp(email);
  }

  // ─── Phone OTP Verification Methods (Sprint 2.6) ─────────────────────

  /**
   * Generates and dispatches a Phone Verification OTP via SMS.
   *
   * @param {string|Object} phoneOrUser - Target user phone number in E.164 format or user object.
   * @returns {Promise<{ phone: string, message: string }>} Sanitized success result.
   */
  async sendPhoneVerificationOtp(phoneOrUser) {
    let user;
    let normalizedPhone;

    if (typeof phoneOrUser === 'object' && phoneOrUser !== null) {
      user = phoneOrUser;
      normalizedPhone = normalizePhone(user.phone);
    } else {
      normalizedPhone = normalizePhone(phoneOrUser);
      if (!normalizedPhone) {
        throw AppError.badRequest('Valid phone number is required');
      }

      // 2. Find user by phone
      user = await this._authRepository.findByPhone(normalizedPhone);
      if (!user) {
        throw AppError.notFound('No account found with this phone number');
      }
    }

    // 3. Check if phone is already verified
    if (user.isPhoneVerified) {
      throw AppError.conflict('This phone number is already verified');
    }

    // 4. Check resend cooldown
    const { inCooldown, ttlRemaining } =
      await this._authRepository.getPhoneOtpCooldown(normalizedPhone);
    if (inCooldown) {
      throw AppError.tooManyRequests(
        `Please wait ${ttlRemaining} seconds before requesting another verification code`
      );
    }

    // 5. Check resend limits
    const resendCount =
      await this._authRepository.getPhoneOtpResendCount(normalizedPhone);
    if (resendCount >= PHONE_OTP_MAX_RESENDS) {
      throw AppError.tooManyRequests(
        'Maximum verification code resend limit reached. Please try again later.'
      );
    }

    // 6. Generate cryptographically secure 6-digit OTP
    const otp = generatePhoneOtp(PHONE_OTP_LENGTH);

    // 7. Hash OTP using HMAC
    const otpHash = hashPhoneOtp(otp);

    // 8. Construct metadata & store in Redis with TTL
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + PHONE_OTP_TTL_SECONDS * 1000
    ).toISOString();

    const otpData = {
      otpHash,
      attempts: 0,
      createdAt: now.toISOString(),
      expiresAt,
    };

    try {
      await this._authRepository.storePhoneOtp(
        normalizedPhone,
        otpData,
        PHONE_OTP_TTL_SECONDS
      );

      // Update cooldown and resend counter
      await this._authRepository.setPhoneOtpCooldown(
        normalizedPhone,
        PHONE_OTP_RESEND_COOLDOWN_SECONDS
      );
      await this._authRepository.incrementPhoneOtpResendCount(
        normalizedPhone,
        PHONE_OTP_TTL_SECONDS
      );
    } catch (redisError) {
      logger.error(
        `Redis operation failed during Phone OTP generation: ${redisError.message}`,
        {
          context: 'AuthService',
        }
      );
      throw AppError.internal('Temporary service error. Please try again.');
    }

    // 9. Send verification SMS
    const smsResult = await this._smsService.sendPhoneVerificationOtp({
      to: normalizedPhone,
      otp,
    });

    if (!smsResult.success) {
      logger.error('Failed to dispatch verification SMS', {
        context: 'AuthService',
        recipient: normalizedPhone,
      });
      throw AppError.internal(
        'Failed to send verification SMS. Please try again.'
      );
    }

    // 10. Return sanitized success result (NEVER return the OTP or hash)
    return {
      phone: normalizedPhone,
      message: 'Verification code sent successfully',
    };
  }

  /**
   * Verifies a Phone OTP and updates isPhoneVerified to true.
   * NOTE: Account status and email verification status remain unchanged.
   *
   * @param {string} phone - User phone number.
   * @param {string} otp - Candidate 6-digit numeric OTP.
   * @returns {Promise<import('mongoose').Document>} Updated user document.
   */
  async verifyPhoneOtp(phone, otp) {
    // 1. Normalize phone & validate candidate OTP format
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      throw AppError.badRequest('Valid phone number is required');
    }

    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      throw AppError.badRequest('Verification code must be exactly 6 digits');
    }
    const cleanOtp = otp.trim();

    // 2. Find user in MongoDB
    const user = await this._authRepository.findByPhone(normalizedPhone);
    if (!user) {
      throw AppError.notFound('No account found with this phone number');
    }

    // 3. Check if already verified
    if (user.isPhoneVerified) {
      throw AppError.conflict('This phone number is already verified');
    }

    // 4. Retrieve stored OTP record from Redis
    let otpRecord;
    try {
      otpRecord = await this._authRepository.getPhoneOtp(normalizedPhone);
    } catch (redisError) {
      logger.error(`Redis error fetching Phone OTP: ${redisError.message}`, {
        context: 'AuthService',
      });
      throw AppError.internal('Temporary service error. Please try again.');
    }

    if (!otpRecord) {
      throw AppError.badRequest(
        'Verification code has expired or is invalid. Please request a new code.'
      );
    }

    // 5. Check if attempt limit has already been exceeded
    if (otpRecord.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
      await this._authRepository.deletePhoneOtp(normalizedPhone);
      throw AppError.tooManyRequests(
        'Maximum verification attempts exceeded. Please request a new code.'
      );
    }

    // 6. Timing-safe verification of supplied OTP against stored hash
    const isOtpValid = verifyPhoneOtpHash(cleanOtp, otpRecord.otpHash);

    if (!isOtpValid) {
      // Increment attempt counter in Redis
      const updateResult =
        await this._authRepository.incrementPhoneOtpAttempts(normalizedPhone);
      const currentAttempts = updateResult
        ? updateResult.attempts
        : (otpRecord.attempts || 0) + 1;

      if (currentAttempts >= PHONE_OTP_MAX_ATTEMPTS) {
        await this._authRepository.deletePhoneOtp(normalizedPhone);
        throw AppError.tooManyRequests(
          'Maximum verification attempts exceeded. Please request a new code.'
        );
      }

      throw AppError.badRequest(
        'Invalid verification code. Please check and try again.'
      );
    }

    // 7. Atomic User Account State Transition in MongoDB
    // Transition ONLY isPhoneVerified = true.
    // Account status and isEmailVerified are NOT modified.
    const userId = user._id || user.id;
    const updatedUser = await this._authRepository.updateUserById(userId, {
      isPhoneVerified: true,
    });

    if (!updatedUser) {
      throw AppError.internal('Failed to update user verification status');
    }

    // 8. Invalidate Redis OTP & resend state to prevent replay attacks
    try {
      await this._authRepository.clearAllPhoneOtpState(normalizedPhone);
    } catch (err) {
      logger.warn(
        `Failed to clean up Phone OTP Redis state after verification: ${err.message}`,
        {
          context: 'AuthService',
        }
      );
    }

    logger.info(`Phone successfully verified for user: ${normalizedPhone}`, {
      context: 'AuthService',
      userId: updatedUser._id ? updatedUser._id.toString() : updatedUser.id,
    });

    return updatedUser;
  }

  /**
   * Resends a fresh verification OTP to the user's phone.
   *
   * @param {string} phone - Target user phone number.
   * @returns {Promise<{ phone: string, message: string }>} Sanitized success result.
   */
  async resendPhoneVerificationOtp(phone) {
    return this.sendPhoneVerificationOtp(phone);
  }

  // ─── User Login Workflow (Sprint 2.7) ────────────────────────────────

  /**
   * Authenticates user credentials and returns the validated user entity (Sprint 2.7).
   *
   * Workflow:
   * 1. Normalize email address.
   * 2. Query user entity including password hash.
   * 3. Validate existence & credentials using constant-time verification.
   *    (Generic error message prevents account enumeration).
   * 4. Enforce account status and verification constraints:
   *    - SUSPENDED / INACTIVE -> 403 Forbidden ('Your account has been deactivated. Please contact support.')
   *    - Unverified (isEmailVerified === false or status === PENDING) -> 403 Forbidden ('Account not verified. Please verify your email with the OTP code.')
   * 5. Record successful login timestamp (lastLoginAt).
   * 6. Return persisted user entity.
   *
   * @param {Object} credentials - Validated login input.
   * @param {string} credentials.email - User email.
   * @param {string} credentials.password - Raw plaintext password candidate.
   * @returns {Promise<import('mongoose').Document>} Authenticated user document.
   * @throws {AppError} 401 Unauthorized on invalid credentials, 403 Forbidden on disabled/unverified account.
   */
  async login({ email, password }) {
    // 1. Normalize email address
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password || typeof password !== 'string') {
      throw AppError.unauthorized('Invalid email or password.');
    }

    // 2. Look up user by email explicitly including passwordHash
    const user =
      await this._authRepository.findByEmailWithPasswordHash(normalizedEmail);

    // 3. Prevent account enumeration: if user does not exist, return generic 401
    if (!user || !user.passwordHash) {
      throw AppError.unauthorized('Invalid email or password.');
    }

    // 4. Verify password against stored Argon2id hash (constant-time)
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid email or password.');
    }

    // 5. Account state rules:
    // a. Check if account has been suspended or deactivated by an administrator
    if (
      user.status === ACCOUNT_STATUSES.SUSPENDED ||
      user.status === ACCOUNT_STATUSES.INACTIVE
    ) {
      throw AppError.forbidden(
        'Your account has been deactivated. Please contact support.'
      );
    }

    // b. Check if email verification is completed
    if (!user.isEmailVerified || user.status === ACCOUNT_STATUSES.PENDING) {
      throw AppError.forbidden(
        'Account not verified. Please verify your email with the OTP code.'
      );
    }

    // 6. Record last login timestamp in MongoDB
    const userId = user._id || user.id;
    const updatedUser = await this._authRepository.updateLastLogin(
      userId,
      new Date()
    );

    const resultUser = updatedUser || user;

    // 7. Generate cryptographically signed JWT access token (Sprint 2.8) & refresh token (Sprint 2.9)
    const accessToken = generateAccessToken(resultUser);
    const refreshToken = generateRefreshToken(resultUser);

    logger.info(`User logged in successfully: ${normalizedEmail}`, {
      context: 'AuthService',
      userId: resultUser._id ? resultUser._id.toString() : resultUser.id,
      role: resultUser.role,
    });

    const rawUser =
      typeof resultUser.toObject === 'function'
        ? resultUser.toObject()
        : resultUser;

    return {
      ...rawUser,
      user: resultUser,
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: config.jwt?.accessExpiresIn || config.jwt?.expiresIn || '15m',
    };
  }

  // ─── Refresh Token Workflow (Sprint 2.9) ────────────────────────────

  /**
   * Validates a refresh token and issues a new access token (Sprint 2.9).
   *
   * Workflow:
   * 1. Validate refresh token existence and format.
   * 2. Cryptographically verify signature, algorithm, issuer, audience, and type ('refresh').
   * 3. Extract subject (user ID) from token payload.
   * 4. Retrieve user entity from repository.
   * 5. Enforce account status and verification constraints:
   *    - Non-existent user -> 401 Unauthorized ('Invalid or expired refresh token.')
   *    - SUSPENDED / INACTIVE -> 403 Forbidden ('Your account has been deactivated. Please contact support.')
   *    - Unverified (isEmailVerified === false or status === PENDING) -> 403 Forbidden ('Account not verified. Please verify your email with the OTP code.')
   * 6. Issue a NEW cryptographically signed JWT access token.
   * 7. Return sanitized result containing new access token and user profile.
   *
   * Note: Sprint 2.9 does NOT rotate the refresh token.
   *
   * @param {string} refreshToken - Raw refresh token extracted from HttpOnly cookie.
   * @returns {Promise<Object>} Object containing new accessToken, tokenType, expiresIn, and user entity.
   * @throws {AppError} 401 Unauthorized on invalid/expired token, 403 Forbidden on disabled/unverified account.
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw AppError.unauthorized('Refresh token is required.');
    }

    // 1. Cryptographically verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        throw AppError.unauthorized(
          'Your refresh token has expired. Please log in again.'
        );
      }
      throw AppError.unauthorized(
        'Invalid refresh token. Please log in again.'
      );
    }

    if (!decoded || !decoded.sub) {
      throw AppError.unauthorized('Invalid refresh token payload.');
    }

    // 2. Retrieve user by ID from MongoDB
    const userId = decoded.sub;
    const user = await this._authRepository.findById(userId);

    if (!user) {
      throw AppError.unauthorized('Invalid or expired refresh token.');
    }

    // 3. Enforce current account state rules
    // a. Check if account is suspended or inactive
    if (
      user.status === ACCOUNT_STATUSES.SUSPENDED ||
      user.status === ACCOUNT_STATUSES.INACTIVE
    ) {
      throw AppError.forbidden(
        'Your account has been deactivated. Please contact support.'
      );
    }

    // b. Check if email verification is completed
    if (!user.isEmailVerified || user.status === ACCOUNT_STATUSES.PENDING) {
      throw AppError.forbidden(
        'Account not verified. Please verify your email with the OTP code.'
      );
    }

    // 4. Generate NEW cryptographically signed JWT access token
    const accessToken = generateAccessToken(user);

    logger.info(`Access token refreshed successfully for user ID: ${userId}`, {
      context: 'AuthService',
      userId: user._id ? user._id.toString() : user.id,
      role: user.role,
    });

    const rawUser =
      typeof user.toObject === 'function' ? user.toObject() : user;

    return {
      ...rawUser,
      user,
      accessToken,
      tokenType: 'Bearer',
      expiresIn: config.jwt?.accessExpiresIn || config.jwt?.expiresIn || '15m',
    };
  }
}

const authServiceInstance = new AuthService();

module.exports = authServiceInstance;
module.exports.AuthService = AuthService;
module.exports.authService = authServiceInstance;
