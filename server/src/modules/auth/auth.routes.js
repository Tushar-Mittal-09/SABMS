'use strict';

const express = require('express');
const catchAsync = require('../../utils/catchAsync');
const { validateBody } = require('../../validations');
const { registerSchema } = require('./auth.schema');
const authController = require('./auth.controller');

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

router.post('/register', validateBody(registerSchema), authController.register);

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
