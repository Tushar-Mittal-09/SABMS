'use strict';

const { StatusCodes, ReasonPhrases } = require('http-status-codes');

/**
 * Normalizes arguments for success responses.
 */
const parseSuccessArgs = (defaultMessage, arg1, arg2, arg3) => {
  let message = defaultMessage;
  let data = null;
  let meta = null;

  if (
    arg1 &&
    typeof arg1 === 'object' &&
    !Array.isArray(arg1) &&
    (arg1.message !== undefined ||
      arg1.data !== undefined ||
      arg1.meta !== undefined) &&
    arg2 === undefined
  ) {
    message = arg1.message || defaultMessage;
    data = arg1.data !== undefined ? arg1.data : null;
    meta = arg1.meta !== undefined ? arg1.meta : null;
    return { message, data, meta };
  }

  if (typeof arg1 === 'string') {
    message = arg1;
    data = arg2 !== undefined ? arg2 : null;
    meta = arg3 !== undefined ? arg3 : null;
    return { message, data, meta };
  }

  if (arg1 !== undefined) {
    data = arg1;
    if (typeof arg2 === 'string') {
      message = arg2;
      meta = arg3 !== undefined ? arg3 : null;
    } else {
      meta = arg2 !== undefined ? arg2 : null;
    }
  }

  return { message, data, meta };
};

/**
 * Normalizes arguments for error responses.
 */
const parseErrorArgs = (defaultMessage, arg1, arg2) => {
  let message = defaultMessage;
  let error = null;

  if (
    arg1 &&
    typeof arg1 === 'object' &&
    !(arg1 instanceof Error) &&
    !Array.isArray(arg1) &&
    (arg1.message !== undefined || arg1.error !== undefined) &&
    arg2 === undefined
  ) {
    message = arg1.message || defaultMessage;
    error = arg1.error !== undefined ? arg1.error : null;
    return { message, error };
  }

  if (typeof arg1 === 'string') {
    message = arg1;
    error = arg2 !== undefined ? arg2 : null;
    return { message, error };
  }

  if (arg1 instanceof Error) {
    message = arg1.message || defaultMessage;
    error = arg2 !== undefined ? arg2 : arg1;
    return { message, error };
  }

  if (arg1 !== undefined && arg1 !== null) {
    error = arg1;
    if (typeof arg2 === 'string') {
      message = arg2;
    }
  }

  return { message, error };
};

/**
 * Standardized API Response Helper Class
 */
class ApiResponse {
  static formatSuccess(message = ReasonPhrases.OK, data = null, meta = null) {
    return {
      success: true,
      message,
      data: data !== undefined ? data : null,
      meta: meta !== undefined ? meta : null,
    };
  }

  static formatError(message = 'An error occurred', error = null) {
    return {
      success: false,
      message,
      error: error !== undefined ? error : null,
    };
  }

  static send(res, statusCode, payload) {
    if (statusCode === StatusCodes.NO_CONTENT) {
      return res.status(StatusCodes.NO_CONTENT).send();
    }
    return res.status(statusCode).json(payload);
  }

  static success(res, arg1, arg2, arg3) {
    const { message, data, meta } = parseSuccessArgs(
      ReasonPhrases.OK,
      arg1,
      arg2,
      arg3
    );
    return ApiResponse.send(
      res,
      StatusCodes.OK,
      ApiResponse.formatSuccess(message, data, meta)
    );
  }

  static created(res, arg1, arg2, arg3) {
    const { message, data, meta } = parseSuccessArgs(
      ReasonPhrases.CREATED,
      arg1,
      arg2,
      arg3
    );
    return ApiResponse.send(
      res,
      StatusCodes.CREATED,
      ApiResponse.formatSuccess(message, data, meta)
    );
  }

  static noContent(res) {
    return ApiResponse.send(res, StatusCodes.NO_CONTENT, null);
  }

  static badRequest(res, arg1, arg2) {
    const { message, error } = parseErrorArgs(
      ReasonPhrases.BAD_REQUEST,
      arg1,
      arg2
    );
    return ApiResponse.send(
      res,
      StatusCodes.BAD_REQUEST,
      ApiResponse.formatError(message, error)
    );
  }

  static unauthorized(res, arg1, arg2) {
    const { message, error } = parseErrorArgs(
      ReasonPhrases.UNAUTHORIZED,
      arg1,
      arg2
    );
    return ApiResponse.send(
      res,
      StatusCodes.UNAUTHORIZED,
      ApiResponse.formatError(message, error)
    );
  }

  static forbidden(res, arg1, arg2) {
    const { message, error } = parseErrorArgs(
      ReasonPhrases.FORBIDDEN,
      arg1,
      arg2
    );
    return ApiResponse.send(
      res,
      StatusCodes.FORBIDDEN,
      ApiResponse.formatError(message, error)
    );
  }

  static notFound(res, arg1, arg2) {
    const { message, error } = parseErrorArgs(
      ReasonPhrases.NOT_FOUND,
      arg1,
      arg2
    );
    return ApiResponse.send(
      res,
      StatusCodes.NOT_FOUND,
      ApiResponse.formatError(message, error)
    );
  }

  static validationError(res, arg1, arg2) {
    const { message, error } = parseErrorArgs('Validation Failed', arg1, arg2);
    return ApiResponse.send(
      res,
      StatusCodes.UNPROCESSABLE_ENTITY,
      ApiResponse.formatError(message, error)
    );
  }

  static internalServerError(res, arg1, arg2) {
    const { message, error } = parseErrorArgs(
      ReasonPhrases.INTERNAL_SERVER_ERROR,
      arg1,
      arg2
    );
    return ApiResponse.send(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      ApiResponse.formatError(message, error)
    );
  }
}

const success = (res, arg1, arg2, arg3) =>
  ApiResponse.success(res, arg1, arg2, arg3);
const created = (res, arg1, arg2, arg3) =>
  ApiResponse.created(res, arg1, arg2, arg3);
const noContent = (res) => ApiResponse.noContent(res);
const badRequest = (res, arg1, arg2) => ApiResponse.badRequest(res, arg1, arg2);
const unauthorized = (res, arg1, arg2) =>
  ApiResponse.unauthorized(res, arg1, arg2);
const forbidden = (res, arg1, arg2) => ApiResponse.forbidden(res, arg1, arg2);
const notFound = (res, arg1, arg2) => ApiResponse.notFound(res, arg1, arg2);
const validationError = (res, arg1, arg2) =>
  ApiResponse.validationError(res, arg1, arg2);
const internalServerError = (res, arg1, arg2) =>
  ApiResponse.internalServerError(res, arg1, arg2);

module.exports = {
  ApiResponse,
  success,
  created,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  validationError,
  internalServerError,
};
