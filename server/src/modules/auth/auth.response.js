'use strict';

/**
 * Transforms a User document or raw user entity into a safe public domain response.
 *
 * Security Invariants:
 * - Never returns password or passwordHash
 * - Never returns OTP, OTP hashes, or transient tokens
 * - Excludes internal MongoDB fields like __v
 * - Exposes only non-sensitive domain attributes
 *
 * @param {Object|import('mongoose').Document} user - The persisted user entity.
 * @returns {Object|null} The sanitized user response payload.
 */
const formatRegistrationResponse = (user) => {
  if (!user) return null;

  const rawUser = typeof user.toObject === 'function' ? user.toObject() : user;

  return {
    id: rawUser._id ? rawUser._id.toString() : rawUser.id,
    name: rawUser.name,
    email: rawUser.email,
    phone: rawUser.phone !== undefined ? rawUser.phone : null,
    department: rawUser.department !== undefined ? rawUser.department : null,
    role: rawUser.role,
    status: rawUser.status,
    isEmailVerified: Boolean(rawUser.isEmailVerified),
    isPhoneVerified: Boolean(rawUser.isPhoneVerified),
    createdAt: rawUser.createdAt,
  };
};

/**
 * Formats a sanitized response payload for successful email verification.
 *
 * @param {Object|import('mongoose').Document} user
 * @returns {Object|null}
 */
const formatVerifyEmailResponse = (user) => {
  return formatRegistrationResponse(user);
};

/**
 * Formats a sanitized response payload for successful phone verification.
 *
 * @param {Object|import('mongoose').Document} user
 * @returns {Object|null}
 */
const formatVerifyPhoneResponse = (user) => {
  return formatRegistrationResponse(user);
};

/**
 * Formats a sanitized response payload for successful user login (Sprint 2.7 & Sprint 2.8).
 *
 * Security Invariants:
 * - Excludes password, passwordHash, and __v
 * - Excludes OTP, OTP hashes, Redis keys, and internal secrets
 * - Emits secure JWT access token, tokenType, and expiresIn metadata when issued (Sprint 2.8)
 * - Exposes safe user domain profile including lastLoginAt
 *
 * @param {Object|import('mongoose').Document} user
 * @param {Object} [tokenData]
 * @param {string} [tokenData.accessToken]
 * @param {string} [tokenData.tokenType='Bearer']
 * @param {string} [tokenData.expiresIn]
 * @returns {Object|null}
 */
const formatLoginResponse = (
  user,
  { accessToken, tokenType = 'Bearer', expiresIn } = {}
) => {
  if (!user) return null;

  const rawUser = typeof user.toObject === 'function' ? user.toObject() : user;

  const sanitizedUser = {
    id: rawUser._id ? rawUser._id.toString() : rawUser.id,
    name: rawUser.name,
    email: rawUser.email,
    phone: rawUser.phone !== undefined ? rawUser.phone : null,
    department: rawUser.department !== undefined ? rawUser.department : null,
    role: rawUser.role,
    status: rawUser.status,
    isEmailVerified: Boolean(rawUser.isEmailVerified),
    isPhoneVerified: Boolean(rawUser.isPhoneVerified),
    lastLoginAt: rawUser.lastLoginAt !== undefined ? rawUser.lastLoginAt : null,
    createdAt: rawUser.createdAt,
  };

  const response = {
    ...sanitizedUser,
    user: sanitizedUser,
  };

  if (accessToken) {
    response.accessToken = accessToken;
    response.tokenType = tokenType;
    if (expiresIn !== undefined) {
      response.expiresIn = expiresIn;
    }
  }

  return response;
};

module.exports = {
  formatRegistrationResponse,
  formatVerifyEmailResponse,
  formatVerifyPhoneResponse,
  formatLoginResponse,
};
