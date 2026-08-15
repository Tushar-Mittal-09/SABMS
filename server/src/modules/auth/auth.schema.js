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

/**
 * Email OTP Verification Validation Contract (Sprint 2.5).
 *
 * Accepted fields:
 * - email: valid email (trimmed, lowercased, required)
 * - otp: exactly 6 numeric digits (required)
 *
 * Security Boundary:
 * - Strict schema (.strict()) strictly rejects unexpected fields and privilege escalation attempts.
 */
const verifyEmailSchema = z
  .object({
    email: email({ required: true }),
    otp: z
      .string({ required_error: 'OTP is required' })
      .trim()
      .regex(/^\d{6}$/, 'OTP must be exactly 6 numeric digits'),
  })
  .strict();

/**
 * Email OTP Resend Validation Contract (Sprint 2.5).
 *
 * Accepted fields:
 * - email: valid email (trimmed, lowercased, required)
 *
 * Security Boundary:
 * - Strict schema (.strict()) rejects unknown fields.
 */
const resendEmailOtpSchema = z
  .object({
    email: email({ required: true }),
  })
  .strict();

module.exports = {
  registerSchema,
  verifyEmailSchema,
  resendEmailOtpSchema,
};
