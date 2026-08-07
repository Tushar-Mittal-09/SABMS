const { StatusCodes, ReasonPhrases } = require('http-status-codes');

/**
 * Custom Application Error Class
 *
 * Extends the native Error class to include:
 * - HTTP status code mapping
 * - Operational vs programming error classification
 * - Static factory methods for common HTTP error types
 *
 * Only operational errors (isOperational = true) expose their message
 * to clients in production. Programming errors return a generic response.
 */
class AppError extends Error {
  /**
   * @param {string} message   - Human-readable error description.
   * @param {number} statusCode - HTTP status code (default 500).
   * @param {Object} options    - Additional error options.
   * @param {boolean} [options.isOperational=true] - Whether this is an expected/operational error.
   * @param {Array}   [options.errors]             - Field-level validation errors array.
   */
  constructor(
    message,
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR,
    options = {}
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational =
      options.isOperational !== undefined ? options.isOperational : true;
    this.errors = options.errors || undefined;

    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }

  // ─── Static Factory Methods ─────────────────────────────────────────

  /**
   * 400 Bad Request
   * Use for malformed requests, missing required fields, invalid parameters.
   */
  static badRequest(message = ReasonPhrases.BAD_REQUEST) {
    return new AppError(message, StatusCodes.BAD_REQUEST);
  }

  /**
   * 401 Unauthorized
   * Use for missing or invalid authentication credentials.
   */
  static unauthorized(message = ReasonPhrases.UNAUTHORIZED) {
    return new AppError(message, StatusCodes.UNAUTHORIZED);
  }

  /**
   * 403 Forbidden
   * Use when the user is authenticated but lacks permission.
   */
  static forbidden(message = ReasonPhrases.FORBIDDEN) {
    return new AppError(message, StatusCodes.FORBIDDEN);
  }

  /**
   * 404 Not Found
   * Use when the requested resource does not exist.
   */
  static notFound(message = ReasonPhrases.NOT_FOUND) {
    return new AppError(message, StatusCodes.NOT_FOUND);
  }

  /**
   * 409 Conflict
   * Use for duplicate resource creation or state conflicts.
   */
  static conflict(message = ReasonPhrases.CONFLICT) {
    return new AppError(message, StatusCodes.CONFLICT);
  }

  /**
   * 422 Unprocessable Entity
   * Use for validation failures with field-level error details.
   * @param {string} message - Summary message.
   * @param {Array}  errors  - Array of field-level error objects.
   */
  static validationError(message = 'Validation failed', errors = []) {
    return new AppError(message, StatusCodes.UNPROCESSABLE_ENTITY, { errors });
  }

  /**
   * 429 Too Many Requests
   * Use for rate limiting responses.
   */
  static tooManyRequests(message = ReasonPhrases.TOO_MANY_REQUESTS) {
    return new AppError(message, StatusCodes.TOO_MANY_REQUESTS);
  }

  /**
   * 500 Internal Server Error
   * Use for unexpected server-side failures.
   * Marked as non-operational by default (programming error).
   */
  static internal(message = ReasonPhrases.INTERNAL_SERVER_ERROR) {
    return new AppError(message, StatusCodes.INTERNAL_SERVER_ERROR, {
      isOperational: false,
    });
  }
}

module.exports = AppError;
