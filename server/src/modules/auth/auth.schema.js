'use strict';

const { z } = require('zod');
const {
  nameField,
  email,
  phone,
  password,
  departmentField,
} = require('../../shared/validators/reusableValidators');

/**
 * Public User Registration Validation Contract (Sprint 2.4).
 *
 * Accepted fields:
 * - name: string (2-100 chars, trimmed, required)
 * - email: valid email (trimmed, lowercased, required)
 * - phone: E.164 phone string (optional, trimmed)
 * - password: valid password adhering to complexity policy (8-128 chars, required)
 * - department: string (optional, max 100 chars, trimmed)
 *
 * Security Boundary:
 * - Strict schema (.strict()) explicitly rejects unexpected fields including
 *   privilege escalation attempts (role, status, passwordHash, isEmailVerified, etc.).
 * - Passwords are NEVER silently trimmed or mutated.
 */
const registerSchema = z
  .object({
    name: nameField({ required: true }),
    email: email({ required: true }),
    phone: phone({ required: false }),
    password: password({ required: true }),
    department: departmentField({ required: false }),
  })
  .strict();

module.exports = {
  registerSchema,
};
