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

/**
 * Phone OTP Verification Validation Contract (Sprint 2.6).
 *
 * Accepted fields:
 * - phone: E.164 phone string (required, trimmed)
 * - otp: exactly 6 numeric digits (required)
 *
 * Security Boundary:
 * - Strict schema (.strict()) strictly rejects unexpected fields and privilege escalation attempts.
 */
const verifyPhoneSchema = z
  .object({
    phone: phone({ required: true }),
    otp: z
      .string({ required_error: 'OTP is required' })
      .trim()
      .regex(/^\d{6}$/, 'OTP must be exactly 6 numeric digits'),
  })
  .strict();

/**
 * Phone OTP Resend Validation Contract (Sprint 2.6).
 *
 * Accepted fields:
 * - phone: E.164 phone string (required, trimmed)
 *
 * Security Boundary:
 * - Strict schema (.strict()) rejects unknown fields.
 */
const resendPhoneOtpSchema = z
  .object({
    phone: phone({ required: true }),
  })
  .strict();

/**
 * User Login Validation Contract (Sprint 2.7).
 *
 * Accepted fields:
 * - email: valid email (trimmed, lowercased, required)
 * - password: non-empty string (required, never trimmed/mutated)
 *
 * Security Boundary:
 * - Strict schema (.strict()) rejects unknown fields, role injections,
 *   and privilege escalation attempts.
 */
const loginSchema = z
  .object({
    email: email({ required: true }),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
  })
  .strict();

/**
 * Forgot Password Validation Contract (Sprint 2.12).
 *
 * Accepted fields:
 * - email: valid email (trimmed, lowercased, required)
 *
 * Security Boundary:
 * - Strict schema (.strict()) rejects unknown fields, privilege escalation
 *   attempts, passwords, OTPs, and reset tokens.
 */
const forgotPasswordSchema = z
  .object({
    email: email({ required: true }),
  })
  .strict();

/**
 * Reset Password Validation Contract (Sprint 2.13).
 *
 * Accepted fields:
 * - email: valid email (trimmed, lowercased, required)
 * - otp: exactly 6 numeric digits (required)
 * - newPassword: valid password adhering to complexity policy (8-128 chars, required)
 *
 * Security Boundary:
 * - Strict schema (.strict()) rejects unknown fields, role tampering, and raw token injection.
 * - Password is never silently trimmed or mutated.
 */
const resetPasswordSchema = z
  .object({
    email: email({ required: true }),
    otp: z
      .string({ required_error: 'OTP is required' })
      .trim()
      .regex(/^\d{6}$/, 'OTP must be exactly 6 numeric digits'),
    newPassword: password({ required: true }),
  })
  .strict();

/**
 * Change Password Validation Contract (Sprint 2.14).
 *
 * Accepted fields:
 * - currentPassword: string (required)
 * - newPassword: valid password adhering to complexity policy (8-128 chars, required)
 * - logoutOtherDevices: boolean (optional, default false)
 *
 * Security Boundary:
 * - Strict schema (.strict()) rejects unknown fields.
 * - Plaintext passwords are never trimmed or mutated.
 */
const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'Current password is required' })
      .min(1, 'Current password is required'),
    newPassword: password({ required: true }),
    logoutOtherDevices: z.boolean().optional().default(false),
  })
  .strict();

module.exports = {
  registerSchema,
  verifyEmailSchema,
  resendEmailOtpSchema,
  verifyPhoneSchema,
  resendPhoneOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
};
