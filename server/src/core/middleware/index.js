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

module.exports = {
  authenticate,
  authorize,
  registerRateLimiter,
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
