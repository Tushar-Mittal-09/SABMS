'use strict';

const argon2 = require('argon2');
const {
  PASSWORD_POLICY,
  ARGON2_CONFIG,
} = require('../shared/constants/password.constants');
const AppError = require('../core/errors/AppError');

/**
 * Validates a plaintext password against the SABMS password security policy.
 *
 * Rules:
 * - Must be a string
 * - Minimum length: 8 characters
 * - Maximum length: 128 characters
 * - At least 1 uppercase letter ([A-Z])
 * - At least 1 lowercase letter ([a-z])
 * - At least 1 number ([0-9])
 * - At least 1 special character ([@$!%*?&#^~_-])
 *
 * NOTE: The input password is NEVER silently trimmed or mutated.
 *
 * @param {string} password - The plaintext password to validate.
 * @returns {{ isValid: boolean, errors: string[] }} Validation result.
 */
const validatePasswordPolicy = (password) => {
  const errors = [];

  if (typeof password !== 'string' || password.length === 0) {
    return {
      isValid: false,
      errors: ['Password is required and must be a non-empty string'],
    };
  }

  if (password.length < PASSWORD_POLICY.MIN_LENGTH) {
    errors.push(
      `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long`
    );
  }

  if (password.length > PASSWORD_POLICY.MAX_LENGTH) {
    errors.push(
      `Password cannot exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`
    );
  }

  if (
    PASSWORD_POLICY.REQUIRE_UPPERCASE &&
    !PASSWORD_POLICY.UPPERCASE_REGEX.test(password)
  ) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }

  if (
    PASSWORD_POLICY.REQUIRE_LOWERCASE &&
    !PASSWORD_POLICY.LOWERCASE_REGEX.test(password)
  ) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }

  if (
    PASSWORD_POLICY.REQUIRE_NUMBER &&
    !PASSWORD_POLICY.NUMBER_REGEX.test(password)
  ) {
    errors.push('Password must contain at least one number (0-9)');
  }

  if (
    PASSWORD_POLICY.REQUIRE_SPECIAL &&
    !PASSWORD_POLICY.SPECIAL_CHAR_REGEX.test(password)
  ) {
    errors.push(
      `Password must contain at least one special character (${PASSWORD_POLICY.ALLOWED_SPECIAL_CHARS})`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Cryptographically hashes a plaintext password using Argon2id with unique salt.
 *
 * Security guarantees:
 * - Enforces password policy before hashing.
 * - Never returns or logs the plaintext password or raw salt.
 * - Produces an encoded Argon2id hash containing algorithm parameters and salt.
 *
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} The encoded Argon2id hash string.
 * @throws {AppError} If password policy fails or password is invalid.
 */
const hashPassword = async (password) => {
  const policyCheck = validatePasswordPolicy(password);
  if (!policyCheck.isValid) {
    throw AppError.validationError(
      'Password does not meet security requirements',
      policyCheck.errors.map((msg) => ({ field: 'password', message: msg }))
    );
  }

  try {
    return await argon2.hash(password, ARGON2_CONFIG);
  } catch (_err) {
    throw AppError.internal('Failed to securely hash password');
  }
};

/**
 * Safely verifies a plaintext password against an encoded password hash.
 *
 * Security guarantees:
 * - Uses Argon2 native constant-time comparison to prevent side-channel timing attacks.
 * - Safely handles missing, invalid, or malformed hashes without crashing or leaking details.
 * - Never logs plaintext passwords or hash values.
 *
 * @param {string} password - The plaintext password candidate.
 * @param {string} passwordHash - The encoded Argon2id hash from persistent storage.
 * @returns {Promise<boolean>} True if the password matches the hash, false otherwise.
 */
const verifyPassword = async (password, passwordHash) => {
  if (
    typeof password !== 'string' ||
    typeof passwordHash !== 'string' ||
    password.length === 0 ||
    passwordHash.length === 0
  ) {
    return false;
  }

  try {
    return await argon2.verify(passwordHash, password);
  } catch (_err) {
    return false;
  }
};

module.exports = {
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
};
