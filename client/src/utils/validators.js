/**
 * SABMS Frontend Validation Utilities.
 * Strictly aligned with server reusableValidators and Zod schemas.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
export const SPECIAL_CHAR_REGEX = /[@$!%*?&#^~_!-]/;

/**
 * Validates full name (2-100 chars).
 */
export const validateName = (name) => {
  if (!name || !name.trim()) return 'Full name is required';
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Name must be at least 2 characters';
  if (trimmed.length > 100) return 'Name cannot exceed 100 characters';
  return null;
};

/**
 * Validates email address.
 */
export const validateEmail = (email) => {
  if (!email || !email.trim()) return 'University email is required';
  if (!EMAIL_REGEX.test(email.trim().toLowerCase())) {
    return 'Please enter a valid email address (e.g., you@university.edu)';
  }
  return null;
};

/**
 * Validates phone number (optional, but if provided must match E.164).
 */
export const validatePhone = (phone, required = false) => {
  if (!phone || !phone.trim()) {
    return required ? 'Phone number is required' : null;
  }
  const cleanPhone = phone.trim();
  if (!PHONE_REGEX.test(cleanPhone)) {
    return 'Must be a valid phone number with country code (e.g. +91 9876543210)';
  }
  return null;
};

/**
 * Evaluates password requirements and live strength.
 * Note: Password is NEVER trimmed.
 */
export const checkPasswordRequirements = (password = '') => {
  const pwd = String(password || '');
  return {
    length: pwd.length >= 8 && pwd.length <= 128,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    number: /\d/.test(pwd),
    special: SPECIAL_CHAR_REGEX.test(pwd),
  };
};

/**
 * Calculates password strength score and label.
 */
export const getPasswordStrength = (password = '') => {
  if (!password) {
    return {
      score: 0,
      label: 'Empty',
      colorClass: 'bg-slate-200 dark:bg-slate-700',
      textClass: 'text-slate-400',
      checks: checkPasswordRequirements(''),
    };
  }

  const checks = checkPasswordRequirements(password);
  const passedCount = Object.values(checks).filter(Boolean).length;

  if (passedCount <= 2 || !checks.length) {
    return {
      score: 1,
      label: 'Weak',
      colorClass: 'bg-red-500',
      textClass: 'text-red-600 dark:text-red-400',
      checks,
    };
  }
  if (passedCount <= 4) {
    return {
      score: 2,
      label: 'Fair',
      colorClass: 'bg-amber-500',
      textClass: 'text-amber-600 dark:text-amber-400',
      checks,
    };
  }
  return {
    score: 3,
    label: 'Strong',
    colorClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    checks,
  };
};

/**
 * Validates password value against full complexity policy.
 */
export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password cannot exceed 128 characters';
  if (!/[A-Z]/.test(password))
    return 'Password must contain at least one uppercase letter (A-Z)';
  if (!/[a-z]/.test(password))
    return 'Password must contain at least one lowercase letter (a-z)';
  if (!/\d/.test(password))
    return 'Password must contain at least one number (0-9)';
  if (!SPECIAL_CHAR_REGEX.test(password)) {
    return 'Password must contain at least one special character (@$!%*?&#^~_-)';
  }
  return null;
};

/**
 * Validates confirm password against password candidate.
 */
export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
};

/**
 * Masks an email for privacy display (e.g., "t******@university.edu").
 */
export const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [username, domain] = parts;
  if (username.length <= 2) {
    return `${username[0]}*@${domain}`;
  }
  const visible = username.slice(0, 1);
  const masked = '*'.repeat(Math.min(username.length - 1, 6));
  return `${visible}${masked}@${domain}`;
};

/**
 * Masks a phone number for privacy display (e.g., "+91 ******3210").
 */
export const maskPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  const clean = phone.trim();
  if (clean.length <= 5) return clean;
  const prefix = clean.slice(0, 3);
  const suffix = clean.slice(-4);
  return `${prefix} ******${suffix}`;
};
