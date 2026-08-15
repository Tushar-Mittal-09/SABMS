'use strict';

const crypto = require('crypto');
const { Buffer } = require('buffer');
const config = require('../../config/env.config');
const {
  EMAIL_OTP_LENGTH,
  OTP_REDIS_KEY_PREFIX,
  OTP_COOLDOWN_KEY_PREFIX,
  OTP_RESEND_KEY_PREFIX,
  EMAIL_OTP_HASH_ALGORITHM,
} = require('./auth.constants');

/**
 * Authentication Helper Functions.
 *
 * Provides utility methods for request metadata extraction,
 * client device parsing, email normalization, cryptographic OTP generation,
 * Redis key generation, and timing-safe OTP verification.
 */

/**
 * Extracts client IP address from incoming Express request.
 * @param {import('express').Request} req
 * @returns {string} Client IP address or 'unknown'
 */
const extractClientIp = (req) => {
  if (!req) return 'unknown';
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
};

/**
 * Extracts user-agent string from incoming Express request.
 * @param {import('express').Request} req
 * @returns {string} User-Agent header value or 'unknown'
 */
const extractUserAgent = (req) => {
  if (!req || !req.headers) return 'unknown';
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Formats basic device metadata from request.
 * @param {import('express').Request} req
 * @returns {{ ip: string, userAgent: string }}
 */
const extractClientMetadata = (req) => ({
  ip: extractClientIp(req),
  userAgent: extractUserAgent(req),
});

/**
 * Normalizes email address by trimming whitespace and converting to lowercase.
 * @param {string} email
 * @returns {string}
 */
const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

/**
 * Generates a cryptographically secure numeric OTP of configured length.
 * Uses crypto.randomInt to guarantee uniform randomness and supports leading zeroes.
 *
 * @param {number} [length=6]
 * @returns {string} Exact length numeric OTP string
 */
const generateEmailOtp = (length = EMAIL_OTP_LENGTH) => {
  const max = Math.pow(10, length);
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(length, '0');
};

/**
 * Creates canonical Redis key for email OTP storage.
 * @param {string} email
 * @returns {string}
 */
const createOtpRedisKey = (email) => {
  return `${OTP_REDIS_KEY_PREFIX}${normalizeEmail(email)}`;
};

/**
 * Creates canonical Redis key for OTP resend cooldown tracking.
 * @param {string} email
 * @returns {string}
 */
const createOtpCooldownRedisKey = (email) => {
  return `${OTP_COOLDOWN_KEY_PREFIX}${normalizeEmail(email)}`;
};

/**
 * Creates canonical Redis key for OTP resend attempts counter.
 * @param {string} email
 * @returns {string}
 */
const createOtpResendCountRedisKey = (email) => {
  return `${OTP_RESEND_KEY_PREFIX}${normalizeEmail(email)}`;
};

/**
 * Computes a cryptographically secure HMAC hash of the OTP.
 *
 * @param {string} otp - Plaintext 6-digit numeric OTP.
 * @param {string} [secret] - HMAC secret key.
 * @returns {string} Hex-encoded HMAC hash.
 */
const hashEmailOtp = (otp, secret = config.otp?.secret) => {
  if (!otp || typeof otp !== 'string') {
    throw new Error('OTP string is required for hashing');
  }
  const hmacSecret = secret || config.otp?.secret || 'default-sabms-otp-secret';
  return crypto
    .createHmac(EMAIL_OTP_HASH_ALGORITHM, hmacSecret)
    .update(otp)
    .digest('hex');
};

/**
 * Verifies a candidate OTP against a stored HMAC hash using timing-safe comparison.
 *
 * @param {string} candidateOtp - Plaintext OTP provided by user.
 * @param {string} storedHash - Stored HMAC hash from Redis.
 * @param {string} [secret] - HMAC secret key.
 * @returns {boolean} True if candidate OTP matches stored hash, false otherwise.
 */
const verifyEmailOtpHash = (
  candidateOtp,
  storedHash,
  secret = config.otp?.secret
) => {
  if (!candidateOtp || !storedHash) return false;

  try {
    const computedHash = hashEmailOtp(candidateOtp, secret);
    const computedBuf = Buffer.from(computedHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (computedBuf.length !== storedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch {
    return false;
  }
};

module.exports = {
  extractClientIp,
  extractUserAgent,
  extractClientMetadata,
  normalizeEmail,
  generateEmailOtp,
  createOtpRedisKey,
  createOtpCooldownRedisKey,
  createOtpResendCountRedisKey,
  hashEmailOtp,
  verifyEmailOtpHash,
};
