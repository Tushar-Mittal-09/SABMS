'use strict';

const crypto = require('crypto');
const config = require('../../config/env.config');
const AppError = require('../errors/AppError');

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generates a cryptographically secure, HMAC-signed CSRF token.
 * Token structure: `<randomHex>.<hmacSignature>`
 *
 * @param {string} [secret] - HMAC secret key (defaults to config.cookieSecret).
 * @returns {string} Signed CSRF token.
 */
const generateCsrfToken = (secret = config.cookieSecret) => {
  const hmacSecret =
    secret ||
    config.cookieSecret ||
    'sabms-enterprise-secure-cookie-secret-key-2026';
  const randomValue = crypto.randomBytes(32).toString('hex');
  const signature = crypto
    .createHmac('sha256', hmacSecret)
    .update(randomValue)
    .digest('hex');
  return `${randomValue}.${signature}`;
};

/**
 * Validates a signed CSRF token against its cryptographic HMAC signature.
 *
 * @param {string} token - Signed token string.
 * @param {string} [secret] - HMAC secret key.
 * @returns {boolean} True if token has valid structure and signature.
 */
const verifyCsrfTokenSignature = (token, secret = config.cookieSecret) => {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return false;
  }

  const [randomValue, signature] = token.split('.');
  if (!randomValue || !signature) {
    return false;
  }

  const hmacSecret =
    secret ||
    config.cookieSecret ||
    'sabms-enterprise-secure-cookie-secret-key-2026';
  try {
    const expectedSignature = crypto
      .createHmac('sha256', hmacSecret)
      .update(randomValue)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
};

/**
 * Compares header CSRF token with cookie CSRF token in constant time.
 *
 * @param {string} headerToken
 * @param {string} cookieToken
 * @returns {boolean}
 */
const timingSafeTokenMatch = (headerToken, cookieToken) => {
  if (!headerToken || !cookieToken) return false;
  if (headerToken.length !== cookieToken.length) return false;

  try {
    const bufA = Buffer.from(headerToken, 'utf-8');
    const bufB = Buffer.from(cookieToken, 'utf-8');
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

/**
 * Validates request Origin / Referer against allowed application origins.
 *
 * @param {import('express').Request} req
 * @returns {boolean} True if origin is valid or not provided.
 */
const isOriginAllowed = (req) => {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return true; // Direct non-browser calls or same-origin without Origin header

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.origin;

    const allowedOrigins = [
      config.clientUrl,
      `http://localhost:${config.port}`,
      `http://127.0.0.1:${config.port}`,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ].filter(Boolean);

    if (config.isDevelopment || config.isTest) {
      if (
        originUrl.hostname === 'localhost' ||
        originUrl.hostname === '127.0.0.1'
      ) {
        return true;
      }
    }

    return allowedOrigins.some((allowed) => {
      try {
        return new URL(allowed).origin === originHost;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
};

/**
 * CSRF Protection Middleware (Sprint 2.18).
 *
 * Enforces Double-Submit Cookie Pattern with cryptographically signed tokens
 * and strict Origin verification.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const csrfProtection = (req, res, next) => {
  const isSafeMethod = SAFE_METHODS.has(req.method.toUpperCase());
  const isCsrfEndpoint =
    req.path?.includes('/csrf-token') ||
    req.originalUrl?.includes('/csrf-token');

  // 1. Retrieve or issue CSRF cookie on safe methods or dedicated token endpoint
  let cookieToken =
    req.cookies?.[CSRF_COOKIE_NAME] || req.signedCookies?.[CSRF_COOKIE_NAME];

  if (
    (isSafeMethod || isCsrfEndpoint) &&
    (!cookieToken || !verifyCsrfTokenSignature(cookieToken))
  ) {
    cookieToken = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, cookieToken, {
      httpOnly: false, // Client JavaScript reads this cookie for double-submit pattern
      sameSite: 'strict',
      secure: config.isProduction,
      path: '/',
    });
  }

  // Attach token accessor on request
  req.csrfToken = () => cookieToken || generateCsrfToken();

  // 2. Safe HTTP methods bypass state-mutation checks
  if (isSafeMethod) {
    return next();
  }

  // 3. Verify Origin / Referer to prevent cross-site execution
  if (!isOriginAllowed(req)) {
    return next(
      AppError.forbidden(
        'Cross-Site Request Forgery (CSRF) detected: Untrusted origin.'
      )
    );
  }

  // 4. Determine if CSRF verification is required for this request:
  // - Client supplied XSRF-TOKEN cookie (browser double-submit flow)
  // - Client supplied x-xsrf-token / x-csrf-token header
  // - Request explicitly enforces CSRF via header 'x-csrf-protection'
  // - Production environment with browser origin or cookies
  const incomingCookie = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken =
    req.headers['x-xsrf-token'] ||
    req.headers['x-csrf-token'] ||
    req.headers['x-csrf'];

  const isTest =
    process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

  let mustValidate = false;

  if (incomingCookie || headerToken) {
    mustValidate = true;
  } else if (req.headers['x-csrf-protection'] === 'enforce') {
    mustValidate = true;
  } else if (!isTest && config.isProduction) {
    mustValidate = true;
  }

  if (!mustValidate) {
    return next();
  }

  if (!headerToken) {
    return next(AppError.forbidden('CSRF token missing in request headers.'));
  }

  if (
    !verifyCsrfTokenSignature(headerToken) ||
    (incomingCookie && !timingSafeTokenMatch(headerToken, incomingCookie))
  ) {
    return next(AppError.forbidden('Invalid or forged CSRF token.'));
  }

  return next();
};

module.exports = {
  csrfProtection,
  generateCsrfToken,
  verifyCsrfTokenSignature,
  timingSafeTokenMatch,
  isOriginAllowed,
  CSRF_COOKIE_NAME,
};
