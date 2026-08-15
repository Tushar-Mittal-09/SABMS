'use strict';

const ApiResponse = require('../response/apiResponse').ApiResponse;

/**
 * Middleware that attaches standardized API response helpers to Express `res` object.
 *
 * Usage in controllers:
 *   res.success(data, message, meta)
 *   res.created(data, message, meta)
 *   res.noContent()
 *   res.badRequest(message, error)
 *   res.unauthorized(message, error)
 *   res.forbidden(message, error)
 *   res.notFound(message, error)
 *   res.validationError(message, error)
 *   res.internalServerError(message, error)
 */
const responseHandler = (req, res, next) => {
  res.success = (arg1, arg2, arg3) =>
    ApiResponse.success(res, arg1, arg2, arg3);
  res.created = (arg1, arg2, arg3) =>
    ApiResponse.created(res, arg1, arg2, arg3);
  res.noContent = () => ApiResponse.noContent(res);
  res.badRequest = (arg1, arg2) => ApiResponse.badRequest(res, arg1, arg2);
  res.unauthorized = (arg1, arg2) => ApiResponse.unauthorized(res, arg1, arg2);
  res.forbidden = (arg1, arg2) => ApiResponse.forbidden(res, arg1, arg2);
  res.notFound = (arg1, arg2) => ApiResponse.notFound(res, arg1, arg2);
  res.validationError = (arg1, arg2) =>
    ApiResponse.validationError(res, arg1, arg2);
  res.internalServerError = (arg1, arg2) =>
    ApiResponse.internalServerError(res, arg1, arg2);

  next();
};

module.exports = responseHandler;
