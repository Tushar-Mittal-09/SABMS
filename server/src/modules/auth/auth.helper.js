'use strict';

const crypto = require('crypto');
const { Buffer } = require('buffer');
const jwt = require('jsonwebtoken');
const config = require('../../config/env.config');
const {
  EMAIL_OTP_LENGTH,
  OTP_REDIS_KEY_PREFIX,
  OTP_COOLDOWN_KEY_PREFIX,
  OTP_RESEND_KEY_PREFIX,
  EMAIL_OTP_HASH_ALGORITHM,
  PHONE_OTP_LENGTH,
  PHONE_OTP_REDIS_KEY_PREFIX,
  PHONE_OTP_COOLDOWN_KEY_PREFIX,
  PHONE_OTP_RESEND_KEY_PREFIX,
  PHONE_OTP_HASH_ALGORITHM,
  JWT_POLICY,
} = require('./auth.constants');

/**
 * Authentication Helper Functions.
 *
 * Provides utility methods for request metadata extraction,
 * client device parsing, email & phone normalization, cryptographic OTP generation,
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
 * Normalizes phone number by trimming surrounding whitespace while preserving E.164 leading +.
 * @param {string} phone
 * @returns {string}
 */
const normalizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  return phone.trim();
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
 * Generates a cryptographically secure numeric Phone OTP of configured length.
 * Uses crypto.randomInt to guarantee uniform randomness and supports leading zeroes.
 *
 * @param {number} [length=6]
 * @returns {string} Exact length numeric OTP string
 */
const generatePhoneOtp = (length = PHONE_OTP_LENGTH) => {
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
 * Creates canonical Redis key for phone OTP storage.
 * @param {string} phone
 * @returns {string}
 */
const createPhoneOtpRedisKey = (phone) => {
  return `${PHONE_OTP_REDIS_KEY_PREFIX}${normalizePhone(phone)}`;
};

/**
 * Creates canonical Redis key for phone OTP resend cooldown tracking.
 * @param {string} phone
 * @returns {string}
 */
const createPhoneOtpCooldownRedisKey = (phone) => {
  return `${PHONE_OTP_COOLDOWN_KEY_PREFIX}${normalizePhone(phone)}`;
};

/**
 * Creates canonical Redis key for phone OTP resend attempts counter.
 * @param {string} phone
 * @returns {string}
 */
const createPhoneOtpResendCountRedisKey = (phone) => {
  return `${PHONE_OTP_RESEND_KEY_PREFIX}${normalizePhone(phone)}`;
};

/**
 * Computes a cryptographically secure HMAC hash of an OTP.
 *
 * @param {string} otp - Plaintext 6-digit numeric OTP.
 * @param {string} [secret] - HMAC secret key.
 * @param {string} [algorithm='sha256'] - Hash algorithm.
 * @returns {string} Hex-encoded HMAC hash.
 */
const hashOtp = (
  otp,
  secret = config.otp?.secret,
  algorithm = EMAIL_OTP_HASH_ALGORITHM
) => {
  if (!otp || typeof otp !== 'string') {
    throw new Error('OTP string is required for hashing');
  }
  const hmacSecret = secret || config.otp?.secret || 'default-sabms-otp-secret';
  return crypto.createHmac(algorithm, hmacSecret).update(otp).digest('hex');
};

/**
 * Computes a cryptographically secure HMAC hash of the Email OTP.
 *
 * @param {string} otp - Plaintext 6-digit numeric OTP.
 * @param {string} [secret] - HMAC secret key.
 * @returns {string} Hex-encoded HMAC hash.
 */
const hashEmailOtp = (otp, secret = config.otp?.secret) => {
  return hashOtp(otp, secret, EMAIL_OTP_HASH_ALGORITHM);
};

/**
 * Computes a cryptographically secure HMAC hash of the Phone OTP.
 *
 * @param {string} otp - Plaintext 6-digit numeric OTP.
 * @param {string} [secret] - HMAC secret key.
 * @returns {string} Hex-encoded HMAC hash.
 */
const hashPhoneOtp = (otp, secret = config.otp?.secret) => {
  return hashOtp(otp, secret, PHONE_OTP_HASH_ALGORITHM);
};

/**
 * Verifies a candidate OTP against a stored HMAC hash using timing-safe comparison.
 *
 * @param {string} candidateOtp - Plaintext OTP provided by user.
 * @param {string} storedHash - Stored HMAC hash from Redis.
 * @param {string} [secret] - HMAC secret key.
 * @param {string} [algorithm='sha256'] - Hash algorithm.
 * @returns {boolean} True if candidate OTP matches stored hash, false otherwise.
 */
const verifyOtpHash = (
  candidateOtp,
  storedHash,
  secret = config.otp?.secret,
  algorithm = EMAIL_OTP_HASH_ALGORITHM
) => {
  if (!candidateOtp || !storedHash) return false;

  try {
    const computedHash = hashOtp(candidateOtp, secret, algorithm);
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

/**
 * Verifies an Email OTP candidate against stored hash using timing-safe comparison.
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
  return verifyOtpHash(
    candidateOtp,
    storedHash,
    secret,
    EMAIL_OTP_HASH_ALGORITHM
  );
};

/**
 * Verifies a Phone OTP candidate against stored hash using timing-safe comparison.
 *
 * @param {string} candidateOtp - Plaintext OTP provided by user.
 * @param {string} storedHash - Stored HMAC hash from Redis.
 * @param {string} [secret] - HMAC secret key.
 * @returns {boolean} True if candidate OTP matches stored hash, false otherwise.
 */
const verifyPhoneOtpHash = (
  candidateOtp,
  storedHash,
  secret = config.otp?.secret
) => {
  return verifyOtpHash(
    candidateOtp,
    storedHash,
    secret,
    PHONE_OTP_HASH_ALGORITHM
  );
};

// ─── JWT Access Token Helpers (Sprint 2.8) ───────────────────────────

/**
 * Generates a short-lived, cryptographically signed JWT access token for an authenticated user.
 *
 * Security Invariants:
 * - Contains ONLY minimal safe claims (sub, role, iat, exp, iss, aud).
 * - Never includes passwords, password hashes, OTPs, OTP hashes, Redis keys, or secrets.
 * - Algorithm is strictly pinned to configured HMAC algorithm (default: HS256).
 *
 * @param {Object|import('mongoose').Document} user - Authenticated user entity or object with id/role.
 * @param {Object} [options={}] - Custom overrides for testing/configuration.
 * @param {string} [options.secret] - Optional secret override.
 * @param {string} [options.expiresIn] - Optional expiration override.
 * @param {string} [options.issuer] - Optional issuer override.
 * @param {string} [options.audience] - Optional audience override.
 * @param {string} [options.algorithm] - Optional algorithm override.
 * @returns {string} Signed JWT access token.
 */
const generateAccessToken = (user, options = {}) => {
  if (!user) {
    throw new Error('User entity is required to generate an access token');
  }

  const rawUser = typeof user.toObject === 'function' ? user.toObject() : user;
  const userId = rawUser._id
    ? rawUser._id.toString()
    : rawUser.id || (typeof user === 'string' ? user : null);

  if (!userId) {
    throw new Error('User ID (sub) is required to generate an access token');
  }

  const payload = {
    sub: String(userId),
    ...(rawUser.role ? { role: rawUser.role } : {}),
  };

  const secret =
    options.secret || config.jwt?.accessSecret || config.jwt?.secret;

  if (!secret) {
    throw new Error('JWT access secret is required for signing');
  }

  const signOptions = {
    algorithm: options.algorithm || JWT_POLICY.ALGORITHM,
    expiresIn:
      options.expiresIn ||
      config.jwt?.accessExpiresIn ||
      config.jwt?.expiresIn ||
      JWT_POLICY.DEFAULT_ACCESS_EXPIRES_IN,
    issuer:
      options.issuer !== undefined
        ? options.issuer
        : config.jwt?.issuer || JWT_POLICY.DEFAULT_ISSUER,
    audience:
      options.audience !== undefined
        ? options.audience
        : config.jwt?.audience || JWT_POLICY.DEFAULT_AUDIENCE,
  };

  return jwt.sign(payload, secret, signOptions);
};

/**
 * Verifies and decodes a JWT access token against cryptographic signature, algorithm, issuer, and audience.
 *
 * @param {string} token - Raw JWT string.
 * @param {Object} [options={}] - Verification options.
 * @param {string} [options.secret] - Secret key override.
 * @param {string[]} [options.algorithms] - Approved algorithms list (defaults to pinned HS256).
 * @param {string|boolean} [options.issuer] - Expected issuer (defaults to configured issuer).
 * @param {string|boolean} [options.audience] - Expected audience (defaults to configured audience).
 * @param {boolean} [options.ignoreExpiration=false] - If true, ignores expiration check.
 * @returns {Object} Decoded token payload.
 */
const verifyAccessToken = (token, options = {}) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Access token string is required for verification');
  }

  const secret =
    options.secret || config.jwt?.accessSecret || config.jwt?.secret;

  if (!secret) {
    throw new Error('JWT access secret is required for verification');
  }

  const verifyOptions = {
    algorithms: options.algorithms || [JWT_POLICY.ALGORITHM],
    ...(options.ignoreExpiration ? { ignoreExpiration: true } : {}),
  };

  if (options.issuer !== undefined) {
    if (options.issuer !== false) {
      verifyOptions.issuer = options.issuer;
    }
  } else if (config.jwt?.issuer || JWT_POLICY.DEFAULT_ISSUER) {
    verifyOptions.issuer = config.jwt?.issuer || JWT_POLICY.DEFAULT_ISSUER;
  }

  if (options.audience !== undefined) {
    if (options.audience !== false) {
      verifyOptions.audience = options.audience;
    }
  } else if (config.jwt?.audience || JWT_POLICY.DEFAULT_AUDIENCE) {
    verifyOptions.audience =
      config.jwt?.audience || JWT_POLICY.DEFAULT_AUDIENCE;
  }

  return jwt.verify(token, secret, verifyOptions);
};

/**
 * Decodes a JWT token without verification.
 *
 * @param {string} token - Raw JWT string.
 * @param {Object} [options={}] - Options (e.g. { complete: true }).
 * @returns {Object|null} Decoded payload or token object.
 */
const decodeAccessToken = (token, options = {}) => {
  if (!token || typeof token !== 'string') return null;
  return jwt.decode(token, { complete: options.complete || false });
};

// ─── JWT Refresh Token Helpers (Sprint 2.9 & Sprint 2.10) ────────────

/**
 * Generates a cryptographically secure random JWT ID (jti).
 * @returns {string} UUID v4 string
 */
const generateJti = () => {
  return crypto.randomUUID();
};

/**
 * Generates a cryptographically secure random token family identifier.
 * @returns {string} UUID v4 string
 */
const generateFamilyId = () => {
  return crypto.randomUUID();
};

/**
 * Generates a long-lived, cryptographically signed JWT refresh token for an authenticated user.
 *
 * Security Invariants:
 * - Contains ONLY minimal safe claims (sub, jti, familyId, type: 'refresh', iat, exp, iss, aud).
 * - Never includes passwords, password hashes, OTPs, OTP hashes, Redis keys, or secrets.
 * - Algorithm is strictly pinned to configured HMAC algorithm (default: HS256).
 * - Signed with dedicated refresh secret (JWT_REFRESH_SECRET), completely distinct from access secret.
 *
 * @param {Object|import('mongoose').Document|string} user - Authenticated user entity or object with id/sub.
 * @param {Object} [options={}] - Custom overrides for testing/configuration.
 * @param {string} [options.jti] - Optional explicit jti.
 * @param {string} [options.familyId] - Optional explicit familyId.
 * @param {string} [options.secret] - Optional secret override.
 * @param {string} [options.expiresIn] - Optional expiration override.
 * @param {string} [options.issuer] - Optional issuer override.
 * @param {string} [options.audience] - Optional audience override.
 * @param {string} [options.algorithm] - Optional algorithm override.
 * @returns {string} Signed JWT refresh token.
 */
const generateRefreshToken = (user, options = {}) => {
  if (!user) {
    throw new Error('User entity is required to generate a refresh token');
  }

  const rawUser = typeof user.toObject === 'function' ? user.toObject() : user;
  const userId = rawUser._id
    ? rawUser._id.toString()
    : rawUser.id || rawUser.sub || (typeof user === 'string' ? user : null);

  if (!userId) {
    throw new Error('User ID (sub) is required to generate a refresh token');
  }

  const jti = options.jti || generateJti();
  const familyId = options.familyId || generateFamilyId();

  const payload = {
    sub: String(userId),
    jti,
    familyId,
    type: JWT_POLICY.REFRESH_TOKEN_PURPOSE || 'refresh',
  };

  const secret = options.secret || config.jwt?.refreshSecret;

  if (!secret) {
    throw new Error('JWT refresh secret is required for signing');
  }

  const signOptions = {
    algorithm: options.algorithm || JWT_POLICY.ALGORITHM,
    expiresIn:
      options.expiresIn ||
      config.jwt?.refreshExpiresIn ||
      JWT_POLICY.DEFAULT_REFRESH_EXPIRES_IN,
    issuer:
      options.issuer !== undefined
        ? options.issuer
        : config.jwt?.issuer || JWT_POLICY.DEFAULT_ISSUER,
    audience:
      options.audience !== undefined
        ? options.audience
        : config.jwt?.audience || JWT_POLICY.DEFAULT_AUDIENCE,
  };

  return jwt.sign(payload, secret, signOptions);
};

/**
 * Verifies and decodes a JWT refresh token against cryptographic signature, algorithm, issuer, audience, and token type.
 *
 * Security Invariants:
 * - Enforces separate JWT_REFRESH_SECRET.
 * - Enforces token purpose/type claim ('refresh') to eliminate token-type confusion attacks.
 * - Enforces presence of unique jti and familyId.
 * - Rejects expired, tampered, or malformed tokens.
 *
 * @param {string} token - Raw JWT refresh token string.
 * @param {Object} [options={}] - Verification options.
 * @param {string} [options.secret] - Secret key override.
 * @param {string[]} [options.algorithms] - Approved algorithms list (defaults to pinned HS256).
 * @param {string|boolean} [options.issuer] - Expected issuer.
 * @param {string|boolean} [options.audience] - Expected audience.
 * @param {boolean} [options.ignoreExpiration=false] - If true, ignores expiration check.
 * @returns {Object} Decoded token payload.
 */
const verifyRefreshToken = (token, options = {}) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Refresh token string is required for verification');
  }

  const secret = options.secret || config.jwt?.refreshSecret;

  if (!secret) {
    throw new Error('JWT refresh secret is required for verification');
  }

  const verifyOptions = {
    algorithms: options.algorithms || [JWT_POLICY.ALGORITHM],
    ...(options.ignoreExpiration ? { ignoreExpiration: true } : {}),
  };

  if (options.issuer !== undefined) {
    if (options.issuer !== false) {
      verifyOptions.issuer = options.issuer;
    }
  } else if (config.jwt?.issuer || JWT_POLICY.DEFAULT_ISSUER) {
    verifyOptions.issuer = config.jwt?.issuer || JWT_POLICY.DEFAULT_ISSUER;
  }

  if (options.audience !== undefined) {
    if (options.audience !== false) {
      verifyOptions.audience = options.audience;
    }
  } else if (config.jwt?.audience || JWT_POLICY.DEFAULT_AUDIENCE) {
    verifyOptions.audience =
      config.jwt?.audience || JWT_POLICY.DEFAULT_AUDIENCE;
  }

  const decoded = jwt.verify(token, secret, verifyOptions);

  const expectedType = JWT_POLICY.REFRESH_TOKEN_PURPOSE || 'refresh';
  if (decoded.type !== expectedType) {
    const error = new Error('Invalid token type. Expected refresh token.');
    error.name = 'JsonWebTokenError';
    throw error;
  }

  if (
    !decoded.jti ||
    typeof decoded.jti !== 'string' ||
    !decoded.familyId ||
    typeof decoded.familyId !== 'string'
  ) {
    const error = new Error(
      'Invalid refresh token payload: missing jti or familyId.'
    );
    error.name = 'JsonWebTokenError';
    throw error;
  }

  return decoded;
};

/**
 * Decodes a JWT refresh token without verification.
 *
 * @param {string} token - Raw JWT string.
 * @param {Object} [options={}] - Options (e.g. { complete: true }).
 * @returns {Object|null} Decoded payload or token object.
 */
const decodeRefreshToken = (token, options = {}) => {
  if (!token || typeof token !== 'string') return null;
  return jwt.decode(token, { complete: options.complete || false });
};

/**
 * Generates secure Express cookie options for HttpOnly Refresh Token issuance.
 *
 * Security Invariants:
 * - httpOnly is strictly true (never exposed to client-side JS / document.cookie).
 * - secure is true in production environment (HTTPS only).
 * - sameSite is strict (or configured) to defend against cross-site request forgery.
 * - path is strictly scoped to the refresh endpoint.
 * - maxAge is configured to matching refresh token lifetime.
 *
 * @param {Object} [options={}] - Custom overrides.
 * @returns {import('express').CookieOptions}
 */
const getRefreshTokenCookieOptions = (options = {}) => {
  const isProduction =
    options.secure !== undefined ? options.secure : config.isProduction;

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite:
      options.sameSite ||
      config.jwt?.refreshCookieSameSite ||
      JWT_POLICY.REFRESH_COOKIE_SAME_SITE ||
      'strict',
    path:
      options.path ||
      config.jwt?.refreshCookiePath ||
      JWT_POLICY.REFRESH_COOKIE_PATH ||
      '/api/v1/auth/refresh',
    maxAge:
      options.maxAge !== undefined
        ? options.maxAge
        : JWT_POLICY.REFRESH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000,
  };
};

module.exports = {
  extractClientIp,
  extractUserAgent,
  extractClientMetadata,
  normalizeEmail,
  normalizePhone,
  generateEmailOtp,
  generatePhoneOtp,
  createOtpRedisKey,
  createOtpCooldownRedisKey,
  createOtpResendCountRedisKey,
  createPhoneOtpRedisKey,
  createPhoneOtpCooldownRedisKey,
  createPhoneOtpResendCountRedisKey,
  hashOtp,
  hashEmailOtp,
  hashPhoneOtp,
  verifyOtpHash,
  verifyEmailOtpHash,
  verifyPhoneOtpHash,
  generateAccessToken,
  verifyAccessToken,
  decodeAccessToken,
  generateJti,
  generateFamilyId,
  generateRefreshToken,
  verifyRefreshToken,
  decodeRefreshToken,
  getRefreshTokenCookieOptions,
};
