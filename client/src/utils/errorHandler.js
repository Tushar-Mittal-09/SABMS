/**
 * Sanitizes and normalizes API error responses into user-friendly messages.
 * Strips away stack traces, database codes, Redis errors, and internal implementation details.
 */
export const normalizeApiError = (axiosError) => {
  if (!axiosError) {
    return {
      status: 0,
      message: 'An unexpected error occurred. Please try again.',
      fieldErrors: {},
    };
  }

  // Network / Connection failure
  if (!axiosError.response) {
    if (axiosError.code === 'ECONNABORTED') {
      return {
        status: 408,
        message:
          'Request timed out. Please check your network connection and try again.',
        fieldErrors: {},
      };
    }
    return {
      status: 0,
      message:
        'Unable to connect to SABMS servers. Please ensure the backend is running.',
      fieldErrors: {},
    };
  }

  const { status, data } = axiosError.response;
  let message =
    data?.message || 'Request failed. Please check your input and try again.';
  const fieldErrors = {};

  // Extract field-level validation errors (Zod / Mongoose)
  const errorDetails = data?.error;
  if (Array.isArray(errorDetails)) {
    errorDetails.forEach((err) => {
      if (err.field && err.message) {
        fieldErrors[err.field] = sanitizeMessage(err.message);
      }
    });
  } else if (errorDetails?.details && Array.isArray(errorDetails.details)) {
    errorDetails.details.forEach((err) => {
      if (err.field && err.message) {
        fieldErrors[err.field] = sanitizeMessage(err.message);
      }
    });
  }

  // Contextual HTTP status code mappings
  if (status === 400) {
    message =
      sanitizeMessage(message) ||
      'Invalid request. Please verify the provided details.';
  } else if (status === 404) {
    message = sanitizeMessage(message) || 'Requested resource was not found.';
  } else if (status === 409) {
    message =
      sanitizeMessage(message) ||
      'An account with this information already exists.';
  } else if (status === 422) {
    message =
      sanitizeMessage(message) || 'Please correct the highlighted fields.';
  } else if (status === 429) {
    message =
      sanitizeMessage(message) ||
      'Too many attempts. Please wait before trying again.';
  } else if (status >= 500) {
    message =
      'A temporary server error occurred. Please try again in a few moments.';
  }

  return {
    status,
    message,
    fieldErrors,
  };
};

/**
 * Strips internal technical keywords from user messages.
 */
function sanitizeMessage(msg) {
  if (typeof msg !== 'string') return '';
  return msg
    .replace(/MongoError:[^;]+/gi, '')
    .replace(
      /E11000 duplicate key error/gi,
      'An account with this value already exists.'
    )
    .replace(/RedisError:[^;]+/gi, '')
    .replace(/at\s+\S+\s+\([^)]+\)/g, '')
    .trim();
}
