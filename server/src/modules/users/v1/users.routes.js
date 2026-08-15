const express = require('express');
const catchAsync = require('../../../utils/catchAsync');
const { validateParams, userIdParamSchema } = require('../../../validations');

const router = express.Router();

router.get(
  '/',
  catchAsync(async (req, res) => {
    return res.success(
      {
        users: [],
        pagination: { page: 1, limit: 10, total: 0 },
        requestId: req.id,
      },
      'Users retrieved successfully'
    );
  })
);

router.get(
  '/:id',
  validateParams(userIdParamSchema),
  catchAsync(async (req, res) => {
    return res.success(
      {
        id: req.params.id,
        requestId: req.id,
        apiVersion: req.apiVersion,
      },
      'User retrieved successfully'
    );
  })
);

router.post(
  '/',
  catchAsync(async (req, res) => {
    return res.created(
      {
        id: 'pending_implementation',
        requestId: req.id,
      },
      'User created (placeholder)'
    );
  })
);

module.exports = {
  usersRouter: router,
  router,
};
