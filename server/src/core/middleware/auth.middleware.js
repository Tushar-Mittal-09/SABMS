'use strict';

const { verifyAccessToken } = require('../../modules/auth/auth.helper');
const AppError = require('../errors/AppError');

/**
 * Authentication Guard Middleware (Sprint 2.8 / Sprint 2.14).
 *
 * Security Boundary & Validation:
 * - Requires Authorization: Bearer <accessToken> header.
 * - Cryptographically verifies access token signature, issuer, audience, and algorithm.
 * - Strictly rejects expired, malformed, or missing tokens with 401 Unauthorized.
 * - Injects verified user context into req.user.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      AppError.unauthorized('Access denied. No authentication token provided.')
    );
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(
      AppError.unauthorized('Access denied. No authentication token provided.')
    );
  }

  try {
    const payload = verifyAccessToken(token);
    if (!payload || (!payload.sub && !payload.id)) {
      return next(AppError.unauthorized('Invalid token. Please log in again.'));
    }

    req.user = {
      id: payload.sub || payload.id,
      sub: payload.sub || payload.id,
      role: payload.role,
      email: payload.email,
      ...payload,
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(
        AppError.unauthorized(
          'Your session has expired. Please refresh your token or log in again.'
        )
      );
    }
    return next(AppError.unauthorized('Invalid token. Please log in again.'));
  }
};

module.exports = {
  authenticate,
};
