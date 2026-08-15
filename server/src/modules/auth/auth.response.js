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

module.exports = {
  formatRegistrationResponse,
  formatVerifyEmailResponse,
};
