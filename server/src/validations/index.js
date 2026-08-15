const { z, ZodError, ZodSchema } = require('zod');

const {
  formatZodError,
  formatValidationErrors,
  formatZodIssue,
  flattenZodIssues,
} = require('./validationFormatter');

const {
  validate,
  validateParams,
  validateQuery,
  validateBody,
  validateHeaders,
  validateCookies,
  validateAsync,
} = require('./validateRequest.middleware');

const validators = require('./reusableValidators');

const {
  safeValidate,
  safeValidateAsync,
  validateOrThrow,
  validateOrThrowAsync,
  validateBody: checkBody,
  validateQuery: checkQuery,
  validateParams: checkParams,
  validateHeaders: checkHeaders,
  validateCookies: checkCookies,
  validateRequest,
  isValid,
  extractErrors,
  partialValidate,
} = require('./requestValidation');

const {
  RESPONSE_VALIDATION_MODE,
  successResponse,
  errorResponse,
  paginationMeta,
  validateResponse,
  validateResponseMiddleware,
  validatePaginatedResponse,
  validateSingleResponse,
} = require('./responseValidation');

const userValidation = require('./userValidation');

module.exports = {
  z,
  ZodError,
  ZodSchema,

  formatZodError,
  formatValidationErrors,
  formatZodIssue,
  flattenZodIssues,

  validate,
  validateParams,
  validateQuery,
  validateBody,
  validateHeaders,
  validateCookies,
  validateAsync,

  v: validators,
  validators,
  userValidation,
  ...userValidation,

  safeValidate,
  safeValidateAsync,
  validateOrThrow,
  validateOrThrowAsync,
  checkBody,
  checkQuery,
  checkParams,
  checkHeaders,
  checkCookies,
  validateRequest,
  isValid,
  extractErrors,
  partialValidate,

  RESPONSE_VALIDATION_MODE,
  successResponse,
  errorResponse,
  paginationMeta,
  validateResponse,
  validateResponseMiddleware,
  validatePaginatedResponse,
  validateSingleResponse,
};
