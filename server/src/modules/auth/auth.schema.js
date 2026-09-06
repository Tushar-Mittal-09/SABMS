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

/**
 * General OTP Resend Validation Contract (Sprint 2.15).
 *
 * Supported fields:
 * - type: string ('email' | 'phone' | 'email_verification' | 'phone_verification')
 * - purpose: string (alternative alias for type)
 * - email: valid email (required when type/purpose is email)
 * - phone: E.164 phone string (required when type/purpose is phone)
 *
 * Security Boundary:
 * - Strict schema (.strict()) rejects unknown fields.
 * - Enforces mutual exclusion: generic resend ONLY handles registration email/phone verification.
 * - Explicitly rejects password reset codes to prevent mixing OTP purposes.
 */
const resendOtpSchema = z
  .object({
    type: z.string().optional(),
    purpose: z.string().optional(),
    email: email({ required: false }),
    phone: phone({ required: false }),
  })
  .strict()
  .superRefine((data, ctx) => {
    const raw = data.type || data.purpose;
    if (!raw || typeof raw !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OTP type or purpose is required (must be "email" or "phone")',
        path: ['type'],
      });
      return;
    }

    const normalized = raw.toLowerCase().trim();
    if (
      normalized !== 'email' &&
      normalized !== 'phone' &&
      normalized !== 'email_verification' &&
      normalized !== 'phone_verification'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Invalid OTP purpose. Generic resend only supports "email" and "phone" verification',
        path: ['type'],
      });
      return;
    }

    if (
      (normalized === 'email' || normalized === 'email_verification') &&
      !data.email
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email address is required for email verification OTP resend',
        path: ['email'],
      });
    }

    if (
      (normalized === 'phone' || normalized === 'phone_verification') &&
      !data.phone
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone number is required for phone verification OTP resend',
        path: ['phone'],
      });
    }
  });

/**
 * Account Unlock Validation Contract (Sprint 2.17 / SD-14).
 *
 * Accepted fields:
 * - email: valid email (required)
 */
const unlockAccountSchema = z
  .object({
    email: email({ required: true }),
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
  resendOtpSchema,
  unlockAccountSchema,
};
