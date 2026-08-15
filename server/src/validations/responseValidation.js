const config = require('../config/env.config');
const logger = require('../utils/logger');
const { safeValidate } = require('./requestValidation');

const RESPONSE_VALIDATION_MODE = {
  STRICT: 'strict',
  WARN: 'warn',
  DISABLED: 'disabled',
};

const getMode = (override) => {
  if (override) return override;
  if (config.isDevelopment) return RESPONSE_VALIDATION_MODE.WARN;
  return RESPONSE_VALIDATION_MODE.DISABLED;
};

const successResponse = (options = {}) => {
  const { z } = require('zod');
  const { dataSchema = z.any(), metaSchema = z.any() } = options;

  return z.object({
    success: z.literal(true),
    message: z.string(),
    data: dataSchema,
    meta: metaSchema.nullable().optional(),
  });
};

const errorResponse = (options = {}) => {
  const { z } = require('zod');
  const { errorSchema = z.any() } = options;

  return z.object({
    success: z.literal(false),
    message: z.string(),
    error: errorSchema.nullable().optional(),
  });
};

const paginationMeta = () => {
  const { z } = require('zod');
  return z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  });
};

const validateResponse = (schema, data, options = {}) => {
  const {
    mode: modeOverride,
    context = 'response',
    throwOnFail = false,
  } = options;

  const mode = getMode(modeOverride);

  if (mode === RESPONSE_VALIDATION_MODE.DISABLED) {
    return { passed: true, data, skipped: true };
  }

  const result = safeValidate(schema, data, { strict: false });

  if (result.success) {
    return { passed: true, data: result.data, skipped: false };
  }

  const details = result.errors;

  if (mode === RESPONSE_VALIDATION_MODE.STRICT || throwOnFail) {
    const err = new Error(`Response validation failed for ${context}`);
    err.validationErrors = details;
    err.isValidationError = true;
    throw err;
  }

  if (mode === RESPONSE_VALIDATION_MODE.WARN) {
    const errorList = Array.isArray(details)
      ? details.map((e) => `${e.field}: ${e.message}`).join('; ')
      : String(details);

    logger.warn(`[ResponseValidation] ${context}: ${errorList}`, {
      context: 'ResponseValidation',
      validationContext: context,
      errors: details,
    });
  }

  return {
    passed: false,
    data,
    errors: details,
    skipped: false,
  };
};

const validateResponseMiddleware = (schemas, options = {}) => {
  const { successSchema, errorSchema, mode: modeOverride } = schemas || {};

  const { context = 'endpoint' } = options;
  const mode = getMode(modeOverride);

  if (mode === RESPONSE_VALIDATION_MODE.DISABLED) {
    return (_req, _res, next) => next();
  }

  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      let schema = null;
      let validationContext = `${context}.${req.method}${req.path}`;

      if (body && body.success === true && successSchema) {
        schema = successSchema;
        validationContext += ' [success]';
      } else if (body && body.success === false && errorSchema) {
        schema = errorSchema;
        validationContext += ' [error]';
      }

      if (schema) {
        try {
          validateResponse(schema, body, {
            mode,
            context: validationContext,
          });
        } catch (err) {
          if (mode === RESPONSE_VALIDATION_MODE.STRICT) {
            logger.error(
              `[ResponseValidation] Strict mode failure for ${validationContext}`,
              {
                context: 'ResponseValidation',
                errors: err.validationErrors,
                method: req.method,
                path: req.path,
                requestId: req.id,
              }
            );
            return res.status(500).json({
              success: false,
              message: 'Response contract violation',
              error: config.isDevelopment ? err.validationErrors : null,
            });
          }
        }
      }

      return originalJson(body);
    };

    next();
  };
};

const validatePaginatedResponse = (itemSchema, options = {}) => {
  const { z } = require('zod');
  return successResponse({
    dataSchema: z.array(itemSchema),
    metaSchema: paginationMeta(),
    ...options,
  });
};

const validateSingleResponse = (itemSchema, options = {}) => {
  return successResponse({
    dataSchema: itemSchema,
    ...options,
  });
};

module.exports = {
  RESPONSE_VALIDATION_MODE,
  successResponse,
  errorResponse,
  paginationMeta,
  validateResponse,
  validateResponseMiddleware,
  validatePaginatedResponse,
  validateSingleResponse,
};
