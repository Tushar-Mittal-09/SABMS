'use strict';

/**
 * Field names that must NOT have their content sanitized or altered.
 * Passwords and hashes can legitimately contain special characters (<, >, &, etc.)
 * that must be hashed and verified exactly as entered.
 */
const EXCLUDED_FIELDS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
]);

/**
 * Sanitizes a single string value to prevent XSS.
 * - Strips <script>...</script> tags and malicious HTML constructs
 * - Neutralizes javascript: and vbscript: pseudo-protocol URIs
 * - Strips inline DOM event handlers (e.g. onerror=, onload=, onclick=)
 * - Encodes raw < and > to &lt; and &gt;
 *
 * @param {any} value
 * @returns {any} Sanitized value
 */
const sanitizeXssString = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  let sanitized = value;

  // 1. Strip script tags and their inner content
  sanitized = sanitized.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ''
  );

  // 2. Neutralize javascript: and vbscript: URIs
  sanitized = sanitized.replace(/(javascript|vbscript):/gi, 'x-$1:');

  // 3. Strip inline DOM event handlers (e.g. onload=, onerror=, onclick=)
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  // 4. Encode standalone < and > to HTML entities
  sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return sanitized;
};

/**
 * Recursively walks an object or array and sanitizes all string properties,
 * skipping explicitly excluded fields (e.g. passwords).
 *
 * @param {any} target - Target object, array, or primitive.
 * @param {Set<string>} [excludedFields=EXCLUDED_FIELDS]
 * @returns {any} Sanitized target.
 */
const sanitizeXssObject = (target, excludedFields = EXCLUDED_FIELDS) => {
  if (target === null || target === undefined) {
    return target;
  }

  if (typeof target === 'string') {
    return sanitizeXssString(target);
  }

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      target[i] = sanitizeXssObject(target[i], excludedFields);
    }
    return target;
  }

  if (typeof target === 'object') {
    const keys = Object.keys(target);
    for (const key of keys) {
      if (excludedFields.has(key)) {
        // Excluded sensitive credentials
        continue;
      }
      target[key] = sanitizeXssObject(target[key], excludedFields);
    }
    return target;
  }

  return target;
};

/**
 * Express Middleware for Cross-Site Scripting (XSS) Sanitization (Sprint 2.19).
 *
 * Sanitizes req.body, req.query, and req.params in-place while preserving
 * passwords and authentication tokens.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const xssSanitizer = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    sanitizeXssObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    sanitizeXssObject(req.query);
  }

  if (req.params && typeof req.params === 'object') {
    sanitizeXssObject(req.params);
  }

  next();
};

module.exports = {
  xssSanitizer,
  sanitizeXssString,
  sanitizeXssObject,
  EXCLUDED_FIELDS,
};
