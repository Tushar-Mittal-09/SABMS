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
