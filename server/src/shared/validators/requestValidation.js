'use strict';

const {
  formatZodError,
  formatValidationErrors,
} = require('./validationFormatter');
const AppError = require('../../core/errors/AppError');

const safeValidate = (schema, data, options = {}) => {
  const { strict = false, stripUnknown = true } = options;

  const result = schema.safeParse(data, { strict, stripUnknown });

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: null,
    };
  }

  const appError = formatZodError(result.error);

  return {
    success: false,
    data: null,
    errors: appError.errors || appError.message,
    error: appError,
  };
};

const safeValidateAsync = async (schema, data, options = {}) => {
  const { strict = false, stripUnknown = true } = options;

  try {
    const validated = await schema.parseAsync(data, { strict, stripUnknown });
    return {
      success: true,
      data: validated,
      errors: null,
    };
  } catch (err) {
    const appError = formatZodError(err);
    return {
      success: false,
      data: null,
      errors: appError.errors || appError.message,
      error: appError,
    };
  }
};

const validateOrThrow = (schema, data, options = {}) => {
  const result = safeValidate(schema, data, options);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
};

const validateOrThrowAsync = async (schema, data, options = {}) => {
  const result = await safeValidateAsync(schema, data, options);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
};

const validateBody = (schema, body, options) => {
  const result = safeValidate(schema, body, options);
  if (!result.success) {
    result.error.validationTarget = 'body';
  }
  return result;
};

const validateQuery = (schema, query, options) => {
  const result = safeValidate(schema, query, options);
  if (!result.success) {
    result.error.validationTarget = 'query';
  }
  return result;
};

const validateParams = (schema, params, options) => {
  const result = safeValidate(schema, params, options);
  if (!result.success) {
    result.error.validationTarget = 'params';
  }
  return result;
};

const validateHeaders = (schema, headers, options) => {
  const result = safeValidate(schema, headers, options);
  if (!result.success) {
    result.error.validationTarget = 'headers';
  }
  return result;
};

const validateCookies = (schema, cookies, options) => {
  const result = safeValidate(schema, cookies, options);
  if (!result.success) {
    result.error.validationTarget = 'cookies';
  }
  return result;
};

const validateRequest = (schemas, req, options = {}) => {
  const sectionResults = [];
  const validated = { ...req };

  const sectionMap = [
    { key: 'params', schema: schemas.params },
    { key: 'query', schema: schemas.query },
    { key: 'body', schema: schemas.body },
    { key: 'headers', schema: schemas.headers },
    { key: 'cookies', schema: schemas.cookies },
  ];

  for (const { key, schema } of sectionMap) {
    if (!schema) continue;

    const result = safeValidate(schema, req[key] || {}, options);

    if (!result.success) {
      sectionResults.push({
        target: key,
        error: result.error,
      });
    } else {
      validated[key] = result.data;
    }
  }

  if (sectionResults.length === 0) {
    return {
      success: true,
      data: validated,
      errors: null,
    };
  }

  const combinedIssues = [];

  sectionResults.forEach(({ target, error }) => {
    if (error.errors && Array.isArray(error.errors)) {
      error.errors.forEach((e) => {
        combinedIssues.push({
          field: `${target}.${e.field}`,
          message: e.message,
          value: e.value,
        });
      });
    }
  });

  const summary =
    sectionResults.length === 1
      ? sectionResults[0].error.message
      : `${sectionResults.length} request section(s) failed validation`;

  const multiError = AppError.validationError(summary, combinedIssues);
  multiError.validationTargets = sectionResults.map((r) => r.target);

  return {
    success: false,
    data: null,
    errors: combinedIssues,
    error: multiError,
  };
};

const isValid = (schema, data, options) => {
  return schema.safeParse(data, options).success;
};

const extractErrors = (schema, data, options) => {
  const result = schema.safeParse(data, options);
  if (result.success) return [];

  const appError = formatZodError(result.error);
  return (
    appError.errors || [
      { field: 'root', message: appError.message, value: null },
    ]
  );
};

const partialValidate = (schema, data, fields, options = {}) => {
  const pickSchema = schema.pick(
    fields.reduce((acc, field) => {
      acc[field] = true;
      return acc;
    }, {})
  );
  return safeValidate(pickSchema, data, options);
};

module.exports = {
  safeValidate,
  safeValidateAsync,
  validateOrThrow,
  validateOrThrowAsync,
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  validateCookies,
  validateRequest,
  isValid,
  extractErrors,
  partialValidate,
  formatValidationErrors,
};
