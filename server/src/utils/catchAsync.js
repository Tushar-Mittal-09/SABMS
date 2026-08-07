/**
 * Async Error Wrapper (catchAsync)
 *
 * Higher-order function that wraps async Express route handlers
 * to automatically catch rejected promises and forward them
 * to the global error middleware via next(err).
 *
 * Eliminates repetitive try/catch blocks in every controller.
 *
 * Usage:
 *   const catchAsync = require('../utils/catchAsync');
 *
 *   exports.getUser = catchAsync(async (req, res, next) => {
 *     const user = await User.findById(req.params.id);
 *     res.status(200).json({ status: 'success', data: user });
 *   });
 *
 * @param {Function} fn - Async Express route handler (req, res, next).
 * @returns {Function}  - Wrapped Express middleware that catches async errors.
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
