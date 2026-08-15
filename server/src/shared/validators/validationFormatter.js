'use strict';

const { ZodError } = require('zod');
const AppError = require('../../core/errors/AppError');

const formatZodIssue = (issue) => {
  const field = issue.path.length ? issue.path.join('.') : 'root';
  const message = issue.message;
  const value = issue.data;

  return {
    field,
    message,
    value: value === undefined ? null : value,
  };
};

const flattenZodIssues = (formattedErrors, parentPath = '', result = []) => {
  Object.entries(formattedErrors).forEach(([key, value]) => {
    if (key === '_errors') return;

    const currentPath = parentPath ? `${parentPath}.${key}` : key;

    if (value._errors && value._errors.length) {
      value._errors.forEach((msg) => {
        result.push({
          field: currentPath,
          message: msg,
          value: null,
        });
      });
    }

    if (typeof value === 'object' && value !== null) {
      flattenZodIssues(value, currentPath, result);
    }
  });

  return result;
};

const formatZodError = (error) => {
  if (!(error instanceof ZodError)) {
    return AppError.badRequest('Invalid validation error format');
  }

  const issues = error.issues.map(formatZodIssue);

  const deduped = issues.reduce((acc, curr) => {
    const exists = acc.find(
      (e) => e.field === curr.field && e.message === curr.message
    );
    if (!exists) acc.push(curr);
    return acc;
  }, []);

  const summary =
    deduped.length === 1
      ? deduped[0].message
      : `${deduped.length} validation field(s) failed validation`;

  return AppError.validationError(summary, deduped);
};

const formatValidationErrors = (errors, options = {}) => {
  const { source = 'body' } = options;

  if (errors instanceof ZodError) {
    return formatZodError(errors);
  }

  if (Array.isArray(errors)) {
    const normalized = errors.map((e) => ({
      field: e.field || e.path || 'unknown',
      message: e.message || 'Invalid value',
      value: e.value !== undefined ? e.value : null,
    }));

    const summary =
      normalized.length === 1
        ? normalized[0].message
        : `${normalized.length} field(s) failed validation`;

    return AppError.validationError(summary, normalized);
  }

  if (errors && typeof errors === 'object') {
    const normalized = Object.entries(errors).map(([field, msg]) => ({
      field,
      message: typeof msg === 'string' ? msg : 'Invalid value',
      value: null,
    }));

    const summary =
      normalized.length === 1
        ? normalized[0].message
        : `${normalized.length} field(s) failed validation`;

    return AppError.validationError(summary, normalized);
  }

  return AppError.validationError(`Invalid ${source} data`);
};

module.exports = {
  formatZodError,
  formatValidationErrors,
  formatZodIssue,
  flattenZodIssues,
};
