'use strict';

const rateLimit = require('express-rate-limit');
const { ApiResponse } = require('../response/apiResponse');
const {
  REGISTER_MAX_REQUESTS,
  REGISTER_WINDOW_SECONDS,
} = require('../../modules/auth/auth.constants');

/**
 * Public User Registration Rate Limiter (Sprint 2.17).
 *
 * Restricts registration attempts to 10 requests per hour per IP.
 * Defends against mass bot account creation and registration flooding.
 */
const registerRateLimiter = rateLimit({
  windowMs: (REGISTER_WINDOW_SECONDS || 3600) * 1000,
  max: REGISTER_MAX_REQUESTS || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    return ApiResponse.send(
      res,
      429,
      ApiResponse.formatError(
        'Too many registration attempts from this IP, please try again after an hour.',
        {
          windowMs: options.windowMs,
          max: options.max,
        }
      )
    );
  },
});

module.exports = {
  registerRateLimiter,
};
