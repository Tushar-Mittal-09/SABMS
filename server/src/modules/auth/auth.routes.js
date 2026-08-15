const express = require('express');
const { StatusCodes } = require('http-status-codes');
const catchAsync = require('../../utils/catchAsync');

const router = express.Router();

router.post(
  '/login',
  catchAsync(async (req, res) => {
    return res.success(
      {
        token: 'placeholder_token',
        requestId: req.id,
        apiVersion: req.apiVersion,
      },
      'Login successful (placeholder)'
    );
  })
);

router.post(
  '/register',
  catchAsync(async (req, res) => {
    return res.status(StatusCodes.CREATED).success(
      {
        id: 'pending_implementation',
        requestId: req.id,
      },
      'Registration successful (placeholder)'
    );
  })
);

router.post(
  '/logout',
  catchAsync(async (req, res) => {
    return res.success(
      {
        loggedOut: true,
        requestId: req.id,
      },
      'Logged out successfully (placeholder)'
    );
  })
);

router.post(
  '/refresh',
  catchAsync(async (req, res) => {
    return res.success(
      {
        token: 'placeholder_new_token',
        requestId: req.id,
      },
      'Token refreshed (placeholder)'
    );
  })
);

module.exports = {
  authRouter: router,
  router,
};
