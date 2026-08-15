'use strict';

const catchAsync = require('../../shared/utils/catchAsync');
const authService = require('./auth.service');
const { formatRegistrationResponse } = require('./auth.response');

/**
 * Authentication HTTP Controller (Sprint 2.4).
 *
 * Responsibilities:
 * - Extracts request payload from Express request.
 * - Delegates execution to AuthService.
 * - Formats sanitized domain response via auth.response.js.
 * - Dispatches standardized HTTP 201 response.
 * - Contains NO business logic, NO direct database/Mongoose access, and NO password hashing.
 */
class AuthController {
  /**
   * Public User Registration Endpoint Handler.
   * POST /api/v1/auth/register
   */
  register = catchAsync(async (req, res) => {
    const user = await authService.register(req.body);
    const responseData = formatRegistrationResponse(user);
    return res.created(responseData, 'User registered successfully');
  });
}

const authControllerInstance = new AuthController();

module.exports = authControllerInstance;
module.exports.AuthController = AuthController;
module.exports.authController = authControllerInstance;
