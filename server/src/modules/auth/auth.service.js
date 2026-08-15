'use strict';

const userRepository = require('../users/user.repository');
const { hashPassword } = require('../../services/password.service');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../shared/constants');
const AppError = require('../../core/errors/AppError');

/**
 * Authentication Business Service (Sprint 2.4).
 *
 * Responsibilities:
 * - Orchestrates user registration business rules and data normalization.
 * - Enforces application-level duplicate email checks.
 * - Delegates password hashing to isolated cryptographic security service.
 * - Enforces server-controlled canonical defaults (STUDENT role, PENDING status, unverified).
 * - Persists records exclusively through UserRepository.
 * - Has no Express req/res or HTTP protocol dependencies.
 */
class AuthService {
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
    const normalizedEmail = email ? email.trim().toLowerCase() : '';

    // 2. Application-level duplicate email check
    const emailExists = await userRepository.existsByEmail(normalizedEmail);
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
      return await userRepository.create(userPayload);
    } catch (err) {
      if (err.code === 11000) {
        throw AppError.conflict('An account with this email already exists');
      }
      throw err;
    }
  }
}

const authServiceInstance = new AuthService();

module.exports = authServiceInstance;
module.exports.AuthService = AuthService;
module.exports.authService = authServiceInstance;
