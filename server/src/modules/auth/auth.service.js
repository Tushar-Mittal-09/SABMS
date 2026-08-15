'use strict';

const userRepository = require('../users/user.repository');
const authRepository = require('./auth.repository');
const { hashPassword } = require('../../services/password.service');
const emailService = require('../../services/email.service');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../shared/constants');
const {
  EMAIL_OTP_LENGTH,
  EMAIL_OTP_TTL_SECONDS,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_MAX_RESENDS,
} = require('./auth.constants');
const {
  normalizeEmail,
  generateEmailOtp,
  hashEmailOtp,
  verifyEmailOtpHash,
} = require('./auth.helper');
const AppError = require('../../core/errors/AppError');
const logger = require('../../core/logger');

/**
 * Authentication Business Service (Sprint 2.4 & Sprint 2.5).
 *
 * Responsibilities:
 * - Orchestrates user registration business rules and data normalization.
 * - Enforces application-level duplicate email checks.
 * - Delegates password hashing to isolated cryptographic security service.
 * - Enforces server-controlled canonical defaults (STUDENT role, PENDING status, unverified).
 * - Manages Email OTP verification lifecycle (generation, hashing, Redis storage, email dispatch, verification, resend limits).
 * - Has no Express req/res or HTTP protocol dependencies.
 */
class AuthService {
  /**
   * @param {Object} [options]
   * @param {import('../users/user.repository').UserRepository} [options.userRepo]
   * @param {import('./auth.repository').AuthRepository} [options.authRepo]
   * @param {Object} [options.emailService]
   */
  constructor(options = {}) {
    this._userRepository = options.userRepo || userRepository;
    this._authRepository = options.authRepo || authRepository;
    this._emailService = options.emailService || emailService;
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
    try {
      return await this._userRepository.create(userPayload);
    } catch (err) {
      if (err.code === 11000) {
        throw AppError.conflict('An account with this email already exists');
      }
      throw err;
    }
  }

  /**
   * Generates and dispatches an Email Verification OTP.
   *
   * @param {string} email - Target user email address.
   * @returns {Promise<{ email: string, message: string }>} Sanitized success result.
   */
  async sendEmailVerificationOtp(email) {
    // 1. Normalize email
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw AppError.badRequest('Valid email address is required');
    }

    // 2. Find user
    const user = await this._authRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw AppError.notFound('No account found with this email address');
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
}

const authServiceInstance = new AuthService();

module.exports = authServiceInstance;
module.exports.AuthService = AuthService;
module.exports.authService = authServiceInstance;
