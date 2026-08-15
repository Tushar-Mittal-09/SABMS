'use strict';

const { z } = require('zod');
const {
  nameField,
  email,
  phone,
  departmentField,
  userRole,
  accountStatus,
  objectId,
  pagination,
  searchQuery,
} = require('../../shared/validators/reusableValidators');

/**
 * Public/client-facing user registration/creation validation contract.
 * Security Boundary:
 * - passwordHash is strictly excluded.
 * - status is server-controlled and strictly excluded (defaults to PENDING in database).
 * - role defaults to STUDENT; privileged roles (ADMIN) cannot be self-assigned.
 */
const createUserSchema = z.object({
  name: nameField({ required: true }),
  email: email({ required: true }),
  phone: phone({ required: false }),
  department: departmentField({ required: false }),
});

/**
 * Internal / Admin user creation validation contract.
 * Permits administrative assignment of canonical roles and statuses.
 */
const adminCreateUserSchema = z.object({
  name: nameField({ required: true }),
  email: email({ required: true }),
  phone: phone({ required: false }),
  department: departmentField({ required: false }),
  role: userRole({ required: false }),
  status: accountStatus({ required: false }),
});

/**
 * Public/self user profile update validation contract.
 * Security Boundary:
 * - email, role, status, passwordHash are strictly excluded from basic profile updates.
 */
const updateUserSchema = z
  .object({
    name: nameField({ required: false }),
    phone: phone({ required: false }),
    department: departmentField({ required: false }),
  })
  .strict();

/**
 * Admin user update validation contract.
 */
const adminUpdateUserSchema = z
  .object({
    name: nameField({ required: false }),
    phone: phone({ required: false }),
    department: departmentField({ required: false }),
    role: userRole({ required: false }),
    status: accountStatus({ required: false }),
  })
  .strict();

/**
 * User ID path parameter validation contract.
 */
const userIdParamSchema = z.object({
  id: objectId('User ID'),
});

/**
 * User list query filter validation contract.
 */
const userFilterQuerySchema = pagination().extend({
  role: userRole({ required: false }),
  status: accountStatus({ required: false }),
  department: departmentField({ required: false }),
  search: searchQuery({ required: false }),
});

module.exports = {
  createUserSchema,
  adminCreateUserSchema,
  updateUserSchema,
  adminUpdateUserSchema,
  userIdParamSchema,
  userFilterQuerySchema,
};
