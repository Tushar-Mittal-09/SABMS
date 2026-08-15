'use strict';

/**
 * Async Error Wrapper (catchAsync)
 *
 * Higher-order function that wraps async Express route handlers
 * to automatically catch rejected promises and forward them
 * to the global error middleware via next(err).
 *
 * @param {Function} fn - Async Express route handler (req, res, next).
 * @returns {Function}  - Wrapped Express middleware that catches async errors.
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
