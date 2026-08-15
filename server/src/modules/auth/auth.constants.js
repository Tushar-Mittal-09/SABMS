'use strict';

/**
 * Authentication Module Constants.
 *
 * Scoped to authentication orchestration, token configuration,
 * cookie parameters, and security rate boundaries.
 */
const AUTH_CONSTANTS = Object.freeze({
  TOKEN_TYPES: Object.freeze({
    ACCESS: 'ACCESS',
    REFRESH: 'REFRESH',
    EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
    PASSWORD_RESET: 'PASSWORD_RESET',
  }),
  COOKIE_KEYS: Object.freeze({
    REFRESH_TOKEN: 'refreshToken',
    SESSION_ID: 'sessionId',
  }),
  RATE_LIMITS: Object.freeze({
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    OTP_MAX_ATTEMPTS: 3,
    OTP_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
  }),
});

module.exports = {
  AUTH_CONSTANTS,
  TOKEN_TYPES: AUTH_CONSTANTS.TOKEN_TYPES,
  COOKIE_KEYS: AUTH_CONSTANTS.COOKIE_KEYS,
  RATE_LIMITS: AUTH_CONSTANTS.RATE_LIMITS,
};
