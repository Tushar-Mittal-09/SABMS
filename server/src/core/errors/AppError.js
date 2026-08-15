'use strict';

const { StatusCodes, ReasonPhrases } = require('http-status-codes');

/**
 * Custom Application Error Class
 *
 * Extends native Error class to include:
 * - HTTP status code mapping
 * - Operational vs programming error classification
 * - Static factory methods for common HTTP error types
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description.
   * @param {number} statusCode - HTTP status code (default 500).
   * @param {Object} options - Additional error options.
   * @param {boolean} [options.isOperational=true] - Whether this is an expected/operational error.
   * @param {Array} [options.errors] - Field-level validation errors array.
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

    Error.captureStackTrace(this, this.constructor);
  }

  // ─── Static Factory Methods ─────────────────────────────────────────

  static badRequest(message = ReasonPhrases.BAD_REQUEST) {
    return new AppError(message, StatusCodes.BAD_REQUEST);
  }

  static unauthorized(message = ReasonPhrases.UNAUTHORIZED) {
    return new AppError(message, StatusCodes.UNAUTHORIZED);
  }

  static forbidden(message = ReasonPhrases.FORBIDDEN) {
    return new AppError(message, StatusCodes.FORBIDDEN);
  }

  static notFound(message = ReasonPhrases.NOT_FOUND) {
    return new AppError(message, StatusCodes.NOT_FOUND);
  }

  static conflict(message = ReasonPhrases.CONFLICT) {
    return new AppError(message, StatusCodes.CONFLICT);
  }

  static validationError(message = 'Validation failed', errors = []) {
    return new AppError(message, StatusCodes.UNPROCESSABLE_ENTITY, { errors });
  }

  static tooManyRequests(message = ReasonPhrases.TOO_MANY_REQUESTS) {
    return new AppError(message, StatusCodes.TOO_MANY_REQUESTS);
  }

  static internal(message = ReasonPhrases.INTERNAL_SERVER_ERROR) {
    return new AppError(message, StatusCodes.INTERNAL_SERVER_ERROR, {
      isOperational: false,
    });
  }
}

module.exports = AppError;
