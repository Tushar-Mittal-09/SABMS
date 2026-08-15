'use strict';

const { StatusCodes } = require('http-status-codes');
const { ZodError } = require('zod');
const config = require('../../config/env.config');
const logger = require('../logger');
const AppError = require('../errors/AppError');
const {
  formatZodError,
} = require('../../shared/validators/validationFormatter');

// ─── Mongoose / JWT / Zod Error Normalizers ─────────────────────────────────

/**
 * Handle ZodError (request/response validation failures).
 */
const handleZodError = (err) => {
  const appError = formatZodError(err);
  return appError;
};

/**
 * Handle Mongoose CastError (invalid ObjectId, type mismatch).
 */
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return AppError.badRequest(message);
};

/**
 * Handle Mongoose ValidationError (schema-level validation failures).
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
  const errorDetails = {
    name: err.name,
    statusCode: err.statusCode,
    requestId: req.id,
    stack: err.stack,
    ...(err.errors && { details: err.errors }),
  };

  res.status(err.statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: errorDetails,
  });
};

/**
 * Production error response.
 * - Operational errors: expose message and details to the client.
 * - Programming errors: return generic message without exposing internal details.
 */
const sendProdError = (err, req, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.errors || null,
    });
  } else {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: null,
    });
  }
};

// ─── Global Error Handler Middleware ────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  err.status = err.status || 'error';

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

  if (config.isDevelopment) {
    return sendDevError(err, req, res);
  }

  let normalizedError = { ...err, message: err.message, stack: err.stack };

  if (err instanceof ZodError) normalizedError = handleZodError(err);
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
