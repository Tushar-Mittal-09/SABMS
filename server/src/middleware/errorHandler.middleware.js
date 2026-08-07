const { StatusCodes } = require('http-status-codes');
const config = require('../config/env.config');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// ─── Mongoose / JWT Error Normalizers ───────────────────────────────────────

/**
 * Handle Mongoose CastError (invalid ObjectId, type mismatch).
 * Example: GET /api/v1/users/invalid-id
 */
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return AppError.badRequest(message);
};

/**
 * Handle Mongoose ValidationError (schema-level validation failures).
 * Extracts field-level error messages into a structured array.
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => ({
    field: el.path,
    message: el.message,
    value: el.value,
  }));
  const message = `Validation failed: ${errors.map((e) => e.message).join('. ')}`;
  return AppError.validationError(message, errors);
};

/**
 * Handle Mongoose duplicate key error (unique constraint violation).
 * MongoDB error code 11000.
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue || {}).join(', ');
  const value = Object.values(err.keyValue || {}).join(', ');
  const message = `Duplicate field value: ${field} = "${value}". Please use another value.`;
  return AppError.conflict(message);
};

/**
 * Handle JWT JsonWebTokenError (malformed, tampered, or invalid token).
 */
const handleJWTError = () => {
  return AppError.unauthorized('Invalid token. Please log in again.');
};

/**
 * Handle JWT TokenExpiredError.
 */
const handleJWTExpiredError = () => {
  return AppError.unauthorized('Your token has expired. Please log in again.');
};

// ─── Response Formatters ────────────────────────────────────────────────────

/**
 * Development error response.
 * Exposes full error details including stack trace for debugging.
 */
const sendDevError = (err, req, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    requestId: req.id,
    stack: err.stack,
    ...(err.errors && { errors: err.errors }),
  });
};

/**
 * Production error response.
 * - Operational errors: expose message to the client.
 * - Programming errors: return generic message (leak nothing).
 */
const sendProdError = (err, req, res) => {
  if (err.isOperational) {
    // Operational (trusted) error → send message to client
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      requestId: req.id,
      ...(err.errors && { errors: err.errors }),
    });
  } else {
    // Programming (unknown) error → don't leak details
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Something went wrong. Please try again later.',
      requestId: req.id,
    });
  }
};

// ─── Global Error Handler Middleware ────────────────────────────────────────

/**
 * Express global error middleware.
 *
 * All errors thrown or passed via next(err) converge here.
 * The handler:
 * 1. Normalizes known third-party errors (Mongoose, JWT) into AppError instances.
 * 2. Logs every error through the Winston logger.
 * 3. Sends the appropriate response based on environment (dev vs prod).
 *
 * @param {Error}    err  - The error object.
 * @param {Object}   req  - Express request object.
 * @param {Object}   res  - Express response object.
 * @param {Function} next - Express next function (required for Express to recognize this as error middleware).
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Ensure defaults
  err.statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  err.status = err.status || 'error';

  // ── Log the error ──────────────────────────────────────────────────
  logger.error(err.message, {
    context: 'ErrorHandler',
    statusCode: err.statusCode,
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    stack: err.stack,
    isOperational: err.isOperational || false,
  });

  // ── Development: full details ──────────────────────────────────────
  if (config.isDevelopment) {
    return sendDevError(err, req, res);
  }

  // ── Production: normalize known errors ─────────────────────────────
  let normalizedError = { ...err, message: err.message, stack: err.stack };

  if (err.name === 'CastError') normalizedError = handleCastError(err);
  if (err.name === 'ValidationError')
    normalizedError = handleValidationError(err);
  if (err.code === 11000) normalizedError = handleDuplicateKeyError(err);
  if (err.name === 'JsonWebTokenError') normalizedError = handleJWTError();
  if (err.name === 'TokenExpiredError')
    normalizedError = handleJWTExpiredError();

  return sendProdError(normalizedError, req, res);
};

module.exports = errorHandler;
