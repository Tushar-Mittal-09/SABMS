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
  PASSWORD_RESET_OTP_LENGTH,
  PASSWORD_RESET_OTP_TTL_SECONDS,
  PASSWORD_RESET_OTP_COOLDOWN_SECONDS,
  PASSWORD_RESET_OTP_MAX_ATTEMPTS,
  PASSWORD_RESET_OTP_MAX_REQUESTS,
  PASSWORD_RESET_OTP_RATE_WINDOW_SECONDS,
  REFRESH_TOKEN_STATUSES,
  REFRESH_TOKEN_REVOCATION_REASONS,
  JWT_POLICY,
} = require('./auth.constants');
const {
  normalizeEmail,
  normalizePhone,
  generateEmailOtp,
  generatePhoneOtp,
  generatePasswordResetOtp,
  hashEmailOtp,
  hashPhoneOtp,
  hashPasswordResetOtp,
  verifyEmailOtpHash,
  verifyPhoneOtpHash,
  verifyPasswordResetOtpHash,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateJti,
  generateFamilyId,
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

  // ─── User Login Workflow (Sprint 2.7, Sprint 2.8, Sprint 2.9 & Sprint 2.10) ───

  /**
   * Authenticates user credentials and returns the validated user entity and tokens.
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
   * 6. Create a NEW refresh token family (familyId) and unique token ID (jti) (Sprint 2.10).
   * 7. Persist the initial refresh token state as ACTIVE in MongoDB.
   * 8. Generate cryptographically signed JWT access token & refresh token.
   * 9. Return persisted user entity, access token, and refresh token (for HttpOnly cookie).
   *
   * @param {Object} credentials - Validated login input.
   * @param {string} credentials.email - User email.
   * @param {string} credentials.password - Raw plaintext password candidate.
   * @returns {Promise<Object>} Authenticated user payload with tokens.
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

    // 7. Initialize a brand-new token family & persistent token record (Sprint 2.10)
    const familyId = generateFamilyId();
    const jti = generateJti();
    const refreshExpiresAt = new Date(
      Date.now() +
        (JWT_POLICY.REFRESH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000)
    );

    await this._authRepository.createRefreshToken({
      jti,
      familyId,
      userId: resultUser._id || resultUser.id,
      status: REFRESH_TOKEN_STATUSES.ACTIVE,
      issuedAt: new Date(),
      expiresAt: refreshExpiresAt,
    });

    // 8. Generate cryptographically signed JWT access token & refresh token
    const accessToken = generateAccessToken(resultUser);
    const refreshToken = generateRefreshToken(resultUser, { jti, familyId });

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

  // ─── Single-Use Refresh Token Rotation & Reuse Detection (Sprint 2.10) ──

  /**
   * Rotates a single-use refresh token, enforces reuse detection, and issues a new access token + replacement refresh token.
   *
   * Workflow:
   * 1. Validate refresh token existence and format.
   * 2. Cryptographically verify signature, algorithm (HS256 pinned), issuer, audience, and type ('refresh').
   * 3. Extract subject (user ID), jti, and familyId from token payload.
   * 4. Retrieve user entity from repository and enforce current account state:
   *    - Non-existent user -> 401 Unauthorized ('Invalid or expired refresh token.')
   *    - SUSPENDED / INACTIVE -> 403 Forbidden ('Your account has been deactivated. Please contact support.')
   *    - Unverified (isEmailVerified === false or status === PENDING) -> 403 Forbidden ('Account not verified. Please verify your email with the OTP code.')
   * 5. Query persistent token state in MongoDB by jti:
   *    - Token not found / owner mismatch / family mismatch -> 401 Unauthorized ('Invalid refresh token. Please log in again.')
   *    - Token already CONSUMED or REUSED -> REUSE DETECTED!
   *      - Mark token as REUSED.
   *      - Revoke entire family (revokeTokenFamily).
   *      - Throw 401 Unauthorized ('Refresh token reuse detected. Please authenticate again.').
   *    - Token REVOKED -> 401 Unauthorized ('Refresh token has been revoked. Please log in again.').
   *    - Token not ACTIVE or Expired -> 401 Unauthorized ('Invalid or expired refresh token. Please log in again.').
   * 6. Generate new replacement jti and signed refresh token within the SAME family.
   * 7. Atomically transition old token from ACTIVE to CONSUMED (linking replacedByTokenId).
   *    - If atomic update returns null (concurrent race), detect replay and revoke family.
   * 8. Persist new replacement refresh token as ACTIVE in MongoDB.
   * 9. Generate fresh cryptographically signed JWT access token.
   * 10. Return sanitized result containing new access token, replacement refresh token, and user profile.
   *
   * @param {string} refreshToken - Raw refresh token extracted from HttpOnly cookie.
   * @returns {Promise<Object>} Object containing new accessToken, replacement refreshToken, tokenType, expiresIn, and user entity.
   * @throws {AppError} 401 Unauthorized on invalid/expired/reused token, 403 Forbidden on disabled/unverified account.
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

    if (!decoded || !decoded.sub || !decoded.jti || !decoded.familyId) {
      throw AppError.unauthorized('Invalid refresh token payload.');
    }

    const { jti, familyId, sub: userId } = decoded;

    // 2. Retrieve user by ID from MongoDB and enforce current account state
    const user = await this._authRepository.findById(userId);

    if (!user) {
      throw AppError.unauthorized('Invalid or expired refresh token.');
    }

    if (
      user.status === ACCOUNT_STATUSES.SUSPENDED ||
      user.status === ACCOUNT_STATUSES.INACTIVE
    ) {
      throw AppError.forbidden(
        'Your account has been deactivated. Please contact support.'
      );
    }

    if (!user.isEmailVerified || user.status === ACCOUNT_STATUSES.PENDING) {
      throw AppError.forbidden(
        'Account not verified. Please verify your email with the OTP code.'
      );
    }

    // 3. Retrieve persistent token record from MongoDB
    const storedToken = await this._authRepository.findRefreshTokenByJti(jti);

    if (!storedToken) {
      throw AppError.unauthorized(
        'Invalid refresh token. Please log in again.'
      );
    }

    const storedUserId = storedToken.userId?._id
      ? storedToken.userId._id.toString()
      : storedToken.userId?.toString();
    const expectedUserId = user._id ? user._id.toString() : user.id?.toString();

    if (storedUserId !== expectedUserId || storedToken.familyId !== familyId) {
      throw AppError.unauthorized(
        'Invalid refresh token. Please log in again.'
      );
    }

    // 4. Reuse Detection: Check if token has already been consumed or replayed
    if (
      storedToken.status === REFRESH_TOKEN_STATUSES.CONSUMED ||
      storedToken.status === REFRESH_TOKEN_STATUSES.REUSED
    ) {
      // Security Event: Token theft / replay detected!
      await this._authRepository.markTokenAsReused(jti);
      await this._authRepository.revokeTokenFamily(
        familyId,
        'Refresh token reuse detected'
      );

      logger.warn(
        `Refresh token reuse detected for user ID: ${expectedUserId}`,
        {
          context: 'AuthService',
          userId: expectedUserId,
          event: 'REFRESH_TOKEN_REUSE_DETECTED',
        }
      );

      const reuseError = AppError.unauthorized(
        'Refresh token reuse detected. Please authenticate again.'
      );
      reuseError.isTokenReuse = true;
      throw reuseError;
    }

    // Check if token or family is revoked
    if (storedToken.status === REFRESH_TOKEN_STATUSES.REVOKED) {
      throw AppError.unauthorized(
        'Refresh token has been revoked. Please log in again.'
      );
    }

    if (storedToken.status !== REFRESH_TOKEN_STATUSES.ACTIVE) {
      throw AppError.unauthorized(
        'Invalid refresh token. Please log in again.'
      );
    }

    if (new Date(storedToken.expiresAt) <= new Date()) {
      throw AppError.unauthorized(
        'Your refresh token has expired. Please log in again.'
      );
    }

    // 5. Prepare replacement refresh token in the SAME family
    const newJti = generateJti();
    const newRefreshToken = generateRefreshToken(user, {
      jti: newJti,
      familyId,
    });
    const newExpiresAt = new Date(
      Date.now() +
        (JWT_POLICY.REFRESH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000)
    );

    // 6. Atomically consume the old token (ensures race-condition safety)
    const consumedOldToken = await this._authRepository.consumeRefreshToken(
      jti,
      familyId,
      newJti
    );

    if (!consumedOldToken) {
      // Concurrency race: Another request consumed this token simultaneously!
      const currentTokenState =
        await this._authRepository.findRefreshTokenByJti(jti);
      if (
        currentTokenState &&
        (currentTokenState.status === REFRESH_TOKEN_STATUSES.CONSUMED ||
          currentTokenState.status === REFRESH_TOKEN_STATUSES.REUSED)
      ) {
        await this._authRepository.markTokenAsReused(jti);
        await this._authRepository.revokeTokenFamily(
          familyId,
          'Concurrent refresh token reuse detected'
        );
        const reuseErr = AppError.unauthorized(
          'Refresh token reuse detected. Please authenticate again.'
        );
        reuseErr.isTokenReuse = true;
        throw reuseErr;
      }
      throw AppError.unauthorized(
        'Invalid or revoked refresh token. Please log in again.'
      );
    }

    // 7. Persist replacement token as ACTIVE in MongoDB
    await this._authRepository.createRefreshToken({
      jti: newJti,
      familyId,
      userId: user._id || user.id,
      status: REFRESH_TOKEN_STATUSES.ACTIVE,
      issuedAt: new Date(),
      expiresAt: newExpiresAt,
    });

    // 8. Generate fresh cryptographically signed JWT access token
    const accessToken = generateAccessToken(user);

    logger.info(
      `Access token rotated successfully for user ID: ${expectedUserId}`,
      {
        context: 'AuthService',
        userId: expectedUserId,
        role: user.role,
      }
    );

    const rawUser =
      typeof user.toObject === 'function' ? user.toObject() : user;

    return {
      ...rawUser,
      user,
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: config.jwt?.accessExpiresIn || config.jwt?.expiresIn || '15m',
    };
  }

  // ─── User Logout & Family-Wide Revocation (Sprint 2.11) ─────────────────

  /**
   * Invalidates a refresh token family upon user logout.
   *
   * Security Invariants & Behavior:
   * - Publicly callable / Idempotent: safe against missing, already-revoked, expired, or malformed tokens.
   * - Never trusts unverified claims: Cryptographically verifies the refresh JWT before performing any database operations.
   * - Revokes the ENTIRE refresh token family (ACTIVE and CONSUMED sibling tokens become REVOKED).
   * - Preserves historical audit records (REUSED tokens remain marked REUSED).
   * - Never modifies User account state (roles, verification flags, password hash, status).
   * - Never logs sensitive identifiers, tokens, secrets, jti, or familyId.
   * - Does not maintain or modify access-token blacklists (access tokens expire naturally).
   *
   * @param {string|Object} [tokenOrPayload] - Raw refresh token string or object containing refreshToken.
   * @returns {Promise<{ loggedOut: boolean }>} Safe domain logout result.
   */
  async logout(tokenOrPayload) {
    const refreshToken =
      typeof tokenOrPayload === 'object' && tokenOrPayload !== null
        ? tokenOrPayload.refreshToken
        : tokenOrPayload;

    // 1. Missing or non-string token: idempotent safe return without mutation
    if (!refreshToken || typeof refreshToken !== 'string') {
      return { loggedOut: true };
    }

    // 2. Cryptographically verify signature, algorithm, issuer, audience, type, jti, and familyId
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      // If token is expired, malformed, invalid signature, or wrong type:
      // We do NOT trust unverified claims for database mutation.
      // Idempotently return safe success.
      return { loggedOut: true };
    }

    if (!decoded || !decoded.jti || !decoded.familyId) {
      return { loggedOut: true };
    }

    const { jti, familyId, sub: userId } = decoded;

    // 3. Locate the persistent token record in MongoDB
    const storedToken = await this._authRepository.findRefreshTokenByJti(jti);

    if (!storedToken) {
      // Token not found in database: safe return
      return { loggedOut: true };
    }

    // 4. Revoke the entire refresh-token family
    const targetFamilyId = storedToken.familyId || familyId;
    const revocationReason =
      REFRESH_TOKEN_REVOCATION_REASONS?.LOGOUT || 'USER_LOGOUT';

    await this._authRepository.revokeTokenFamily(
      targetFamilyId,
      revocationReason
    );

    logger.info('User logged out successfully', {
      context: 'AuthService',
      ...(userId ? { userId: String(userId) } : {}),
    });

    return { loggedOut: true };
  }

  /**
   * Initiates the password recovery flow (Sprint 2.12).
   *
   * Security & Anti-Enumeration Invariants:
   * - Normalizes the email address consistently before any lookup.
   * - Applies transient cooldown and rate limiting across all candidate emails.
   * - Does NOT expose whether the account exists in database or Redis.
   * - If user exists: generates cryptographically secure 6-digit OTP, computes HMAC-SHA256 hash,
   *   stores ONLY the hashed OTP in Redis (`auth:otp:reset:<email>`) with 5m TTL,
   *   records cooldown & rate counters, and dispatches the OTP via emailService.
   * - If user does NOT exist: records cooldown & rate counters in Redis, does NOT send email,
   *   does NOT create reset OTP state, and returns successful result identically.
   * - If email dispatch fails: immediately cleans up the stored reset OTP from Redis and throws
   *   a safe internal error without leaking credentials, OTPs, or database/Redis keys.
   * - Never returns or logs the plaintext OTP.
   * - Never mutates user passwords or sessions.
   *
   * @param {string} email - Candidate user email address.
   * @returns {Promise<{ success: boolean }>} Generic success result.
   */
  async forgotPassword(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw AppError.badRequest('Valid email address is required');
    }

    // 1. Check transient request cooldown in Redis
    const { inCooldown } =
      await this._authRepository.getPasswordResetCooldown(normalizedEmail);
    if (inCooldown) {
      throw AppError.tooManyRequests(
        'Too many password reset requests. Please try again later.'
      );
    }

    // 2. Check transient hourly rate limit in Redis
    const requestCount =
      await this._authRepository.getPasswordResetRequestCount(normalizedEmail);
    if (requestCount >= PASSWORD_RESET_OTP_MAX_REQUESTS) {
      throw AppError.tooManyRequests(
        'Too many password reset requests. Please try again later.'
      );
    }

    // 3. Look up user by normalized email in MongoDB
    const user = await this._authRepository.findByEmail(normalizedEmail);

    // 4. Non-existing account branch: enforce cooldown/rate limit without leaking account state
    if (!user) {
      try {
        await Promise.all([
          this._authRepository.setPasswordResetCooldown(
            normalizedEmail,
            PASSWORD_RESET_OTP_COOLDOWN_SECONDS
          ),
          this._authRepository.incrementPasswordResetRequestCount(
            normalizedEmail,
            PASSWORD_RESET_OTP_RATE_WINDOW_SECONDS
          ),
        ]);
      } catch (redisError) {
        logger.error(
          `Redis operation failed during forgot password: ${redisError.message}`,
          { context: 'AuthService' }
        );
        throw AppError.internal('Temporary service error. Please try again.');
      }

      logger.info('Password reset requested for non-existent account', {
        context: 'AuthService',
      });

      return { success: true };
    }

    // 5. Existing account branch: generate secure 6-digit numeric OTP
    const otp = generatePasswordResetOtp(PASSWORD_RESET_OTP_LENGTH);

    // 6. Compute HMAC-SHA256 hash (never persist plaintext OTP)
    const otpHash = hashPasswordResetOtp(otp);

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + PASSWORD_RESET_OTP_TTL_SECONDS * 1000
    ).toISOString();

    const otpData = {
      otpHash,
      attempts: 0,
      createdAt: now.toISOString(),
      expiresAt,
    };

    // 7. Store hashed OTP and update cooldown/rate counters in Redis
    try {
      await Promise.all([
        this._authRepository.storePasswordResetOtp(
          normalizedEmail,
          otpData,
          PASSWORD_RESET_OTP_TTL_SECONDS
        ),
        this._authRepository.setPasswordResetCooldown(
          normalizedEmail,
          PASSWORD_RESET_OTP_COOLDOWN_SECONDS
        ),
        this._authRepository.incrementPasswordResetRequestCount(
          normalizedEmail,
          PASSWORD_RESET_OTP_RATE_WINDOW_SECONDS
        ),
      ]);
    } catch (redisError) {
      logger.error(
        `Redis operation failed during forgot password: ${redisError.message}`,
        { context: 'AuthService' }
      );
      throw AppError.internal('Temporary service error. Please try again.');
    }

    // 8. Dispatch password reset OTP email
    const emailResult = await this._emailService.sendPasswordResetOtp({
      to: normalizedEmail,
      name: user.name,
      otp,
    });

    if (!emailResult.success) {
      // Clean up stored OTP state in Redis so no orphan/unusable OTP remains active
      await this._authRepository.deletePasswordResetOtp(normalizedEmail);
      logger.error('Failed to dispatch password reset email', {
        context: 'AuthService',
        recipient: normalizedEmail,
      });
      throw AppError.internal(
        'Failed to process password reset request. Please try again.'
      );
    }

    logger.info('Password reset OTP dispatched successfully', {
      context: 'AuthService',
      recipient: normalizedEmail,
    });

    return { success: true };
  }

  /**
   * Finalizes password recovery via OTP verification and updates credentials (Sprint 2.13).
   *
   * Security Guarantees:
   * - Strict normalization and formatting of inputs.
   * - Enforces password complexity policy before any cryptographic hashing.
   * - Hashes new password with memory-hard Argon2id.
   * - Verifies OTP using timing-safe comparison (crypto.timingSafeEqual via verifyPasswordResetOtpHash).
   * - Tracks verification failure attempts; deletes OTP and throws 429 after 5 failed attempts.
   * - On success: immediately deletes reset OTP and all reset state from Redis (one-time use & anti-replay).
   * - Atomically updates password in MongoDB.
   * - Globally terminates all existing refresh token families / sessions across devices.
   * - Never logs plaintext passwords, hashes, or OTPs.
   * - Never returns passwords, hashes, or tokens in response payload.
   *
   * @param {Object} params
   * @param {string} params.email - Recipient email address.
   * @param {string} params.otp - 6-digit numeric OTP.
   * @param {string} params.newPassword - New plaintext password adhering to complexity policy.
   * @returns {Promise<{ success: boolean }>}
   */
  async resetPassword({ email, otp, newPassword }) {
    // 1. Normalize email & validate candidate OTP format
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw AppError.badRequest('Valid email address is required');
    }

    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      throw AppError.badRequest('Verification code must be exactly 6 digits');
    }
    const cleanOtp = otp.trim();

    if (!newPassword || typeof newPassword !== 'string') {
      throw AppError.badRequest('New password is required');
    }

    // 2. Query user in MongoDB
    const user = await this._authRepository.findByEmail(normalizedEmail);
    if (!user) {
      // Invariant: Return consistent error without leaking account existence
      throw AppError.badRequest(
        'Verification code has expired or is invalid. Please request a new code.'
      );
    }

    // 3. Fetch stored reset OTP record from Redis
    let otpRecord;
    try {
      otpRecord =
        await this._authRepository.getPasswordResetOtp(normalizedEmail);
    } catch (redisError) {
      logger.error(
        `Redis error fetching password reset OTP: ${redisError.message}`,
        { context: 'AuthService' }
      );
      throw AppError.internal('Temporary service error. Please try again.');
    }

    if (!otpRecord) {
      throw AppError.badRequest(
        'Verification code has expired or is invalid. Please request a new code.'
      );
    }

    // 4. Check if attempt limit has already been exceeded
    if ((otpRecord.attempts || 0) >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
      await this._authRepository.deletePasswordResetOtp(normalizedEmail);
      throw AppError.tooManyRequests(
        'Maximum verification attempts exceeded. Code invalidated. Please request a new one.'
      );
    }

    // 5. Timing-safe verification of supplied OTP against stored HMAC hash
    const isOtpValid = verifyPasswordResetOtpHash(cleanOtp, otpRecord.otpHash);

    if (!isOtpValid) {
      const updateResult =
        await this._authRepository.incrementPasswordResetOtpAttempts(
          normalizedEmail
        );
      const currentAttempts = updateResult
        ? updateResult.attempts
        : (otpRecord.attempts || 0) + 1;

      if (currentAttempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
        await this._authRepository.deletePasswordResetOtp(normalizedEmail);
        throw AppError.tooManyRequests(
          'Maximum verification attempts exceeded. Code invalidated. Please request a new one.'
        );
      }

      throw AppError.badRequest(
        'Invalid verification code. Please check and try again.'
      );
    }

    // 6. Cryptographically hash new password with Argon2id
    const passwordHash = await hashPassword(newPassword);

    // 7. Update user's passwordHash in MongoDB
    const userId = user._id ? user._id.toString() : user.id;
    const updatedUser = await this._authRepository.updateUserById(userId, {
      passwordHash,
    });

    if (!updatedUser) {
      throw AppError.internal('Failed to update password');
    }

    // 8. Invalidate reset OTP and clear all reset state in Redis (prevent replay)
    try {
      await this._authRepository.clearAllPasswordResetOtpState(normalizedEmail);
    } catch (cleanupErr) {
      logger.warn(
        `Failed to clear reset state in Redis for ${normalizedEmail}: ${cleanupErr.message}`,
        { context: 'AuthService' }
      );
    }

    // 9. Globally terminate all existing refresh token sessions across all devices
    try {
      await this._authRepository.revokeAllUserTokens(
        userId,
        REFRESH_TOKEN_REVOCATION_REASONS.PASSWORD_RESET || 'Password reset'
      );
    } catch (revokeErr) {
      logger.warn(
        `Failed to revoke existing user token families for ${userId}: ${revokeErr.message}`,
        { context: 'AuthService' }
      );
    }

    // 10. Send security confirmation email if email service supports it
    try {
      if (
        typeof this._emailService.sendPasswordResetConfirmation === 'function'
      ) {
        await this._emailService.sendPasswordResetConfirmation({
          to: normalizedEmail,
          name: user.name,
        });
      }
    } catch (emailErr) {
      logger.warn(
        `Failed to dispatch password reset confirmation email to ${normalizedEmail}: ${emailErr.message}`,
        { context: 'AuthService' }
      );
    }

    logger.info(
      'Password reset completed successfully and all active sessions terminated',
      {
        context: 'AuthService',
        userId,
      }
    );

    return { success: true };
  }

  /**
   * Updates an authenticated user's password (Sprint 2.14).
   *
   * Security Guarantees:
   * - Requires authenticated user identity (userId).
   * - Verifies current password using timing-safe Argon2id verification.
   * - Validates new password against complexity policy before hashing.
   * - Hashes new password with Argon2id with unique salt.
   * - Atomically updates user in MongoDB.
   * - If logoutOtherDevices is true, revokes all active refresh tokens for this user.
   * - Never logs plaintext passwords or password hashes.
   * - Never returns passwords or tokens in response payload.
   *
   * @param {Object} params
   * @param {string} params.userId - Authenticated user identifier.
   * @param {string} params.currentPassword - Plaintext current password.
   * @param {string} params.newPassword - Plaintext new password adhering to policy.
   * @param {boolean} [params.logoutOtherDevices=false] - Whether to revoke other active sessions.
   * @returns {Promise<{ success: boolean }>}
   */
  async changePassword({
    userId,
    currentPassword,
    newPassword,
    logoutOtherDevices = false,
  }) {
    if (!userId) {
      throw AppError.unauthorized(
        'Access denied. No authentication token provided.'
      );
    }

    if (!currentPassword || typeof currentPassword !== 'string') {
      throw AppError.badRequest('Current password is required');
    }

    if (!newPassword || typeof newPassword !== 'string') {
      throw AppError.badRequest('New password is required');
    }

    // 1. Fetch user by ID from MongoDB
    const user = await this._authRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    // 2. Verify current password against stored hash using timing-safe comparison
    const isCurrentPasswordValid = await verifyPassword(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      throw AppError.unauthorized('Invalid current password.');
    }

    // 3. Prevent reuse of identical password
    if (currentPassword === newPassword) {
      throw AppError.badRequest(
        'New password must be different from current password'
      );
    }

    // 4. Hash new password with Argon2id (validates password policy internally)
    const passwordHash = await hashPassword(newPassword);

    // 5. Update user's password in MongoDB
    const updatedUser = await this._authRepository.updateUserById(userId, {
      passwordHash,
    });

    if (!updatedUser) {
      throw AppError.internal('Failed to update password');
    }

    // 6. If requested, revoke all active sessions / token families across other devices
    if (logoutOtherDevices) {
      try {
        await this._authRepository.revokeAllUserTokens(
          userId,
          REFRESH_TOKEN_REVOCATION_REASONS.PASSWORD_RESET ||
            'Password changed - other devices terminated'
        );
      } catch (err) {
        logger.warn(
          `Failed to revoke user tokens on password change for ${userId}: ${err.message}`,
          { context: 'AuthService' }
        );
      }
    }

    // 7. Send security notice email
    try {
      if (
        typeof this._emailService.sendPasswordResetConfirmation === 'function'
      ) {
        await this._emailService.sendPasswordResetConfirmation({
          to: user.email,
          name: user.name,
        });
      }
    } catch (emailErr) {
      logger.warn(
        `Failed to dispatch password change confirmation email: ${emailErr.message}`,
        { context: 'AuthService' }
      );
    }

    logger.info('Password successfully changed for user', {
      context: 'AuthService',
      userId,
    });

    return { success: true };
  }
}

const authServiceInstance = new AuthService();

module.exports = authServiceInstance;
module.exports.AuthService = AuthService;
module.exports.authService = authServiceInstance;
