'use strict';

const errorHandler = require('./errorHandler.middleware');
const requestId = require('./requestId.middleware');
const responseHandler = require('./responseHandler.middleware');
const {
  applySecurityMiddleware,
  ...securityMiddlewares
} = require('./security.middleware');
const {
  validate,
  validateParams,
  validateQuery,
  validateBody,
  validateHeaders,
  validateCookies,
  validateAsync,
} = require('./validateRequest.middleware');
const { authenticate, authorize } = require('./auth.middleware');
const { registerRateLimiter } = require('./rateLimiter.middleware');
const {
  csrfProtection,
  generateCsrfToken,
  verifyCsrfTokenSignature,
} = require('./csrf.middleware');
const {
  xssSanitizer,
  sanitizeXssString,
  sanitizeXssObject,
} = require('./xss.middleware');
const {
  methodFilterMiddleware,
  noCacheMiddleware,
  securityHardeningHeaders,
} = require('./hardening.middleware');

module.exports = {
  authenticate,
  authorize,
  registerRateLimiter,
  csrfProtection,
  generateCsrfToken,
  verifyCsrfTokenSignature,
  xssSanitizer,
  sanitizeXssString,
  sanitizeXssObject,
  methodFilterMiddleware,
  noCacheMiddleware,
  securityHardeningHeaders,
  errorHandler,
  requestId,
  responseHandler,
  applySecurityMiddleware,
  ...securityMiddlewares,
  validate,
  validateParams,
  validateQuery,
  validateBody,
  validateHeaders,
  validateCookies,
  validateAsync,
};
