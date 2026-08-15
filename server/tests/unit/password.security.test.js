'use strict';

const {
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
} = require('../../src/services/password.service');
const {
  PASSWORD_POLICY,
  ARGON2_CONFIG,
  PASSWORD_ALGORITHM,
} = require('../../src/shared/constants');
const AppError = require('../../src/core/errors/AppError');

describe('Password Security (Sprint 2.3)', () => {
  const validPassword = 'CorrectHorseBatteryStaple1!';

  describe('Password Security Constants', () => {
    it('should expose immutable PASSWORD_POLICY with expected constraints', () => {
      expect(PASSWORD_POLICY).toBeDefined();
      expect(PASSWORD_POLICY.MIN_LENGTH).toBe(8);
      expect(PASSWORD_POLICY.MAX_LENGTH).toBe(128);
      expect(PASSWORD_POLICY.REQUIRE_UPPERCASE).toBe(true);
      expect(PASSWORD_POLICY.REQUIRE_LOWERCASE).toBe(true);
      expect(PASSWORD_POLICY.REQUIRE_NUMBER).toBe(true);
      expect(PASSWORD_POLICY.REQUIRE_SPECIAL).toBe(true);
      expect(PASSWORD_ALGORITHM).toBe('argon2id');
      expect(ARGON2_CONFIG.memoryCost).toBe(65536);
    });
  });

  describe('Password Policy Validation (validatePasswordPolicy)', () => {
    it('should approve a password meeting all complexity criteria', () => {
      const result = validatePasswordPolicy(validPassword);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject empty, null, undefined, or non-string inputs', () => {
      expect(validatePasswordPolicy('').isValid).toBe(false);
      expect(validatePasswordPolicy(null).isValid).toBe(false);
      expect(validatePasswordPolicy(undefined).isValid).toBe(false);
      expect(validatePasswordPolicy(12345678).isValid).toBe(false);
      expect(validatePasswordPolicy({}).isValid).toBe(false);
    });

    it('should reject passwords shorter than MIN_LENGTH (8 characters)', () => {
      const result = validatePasswordPolicy('Ab1!xyz');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long`
      );
    });

    it('should reject passwords exceeding MAX_LENGTH (128 characters)', () => {
      const longPassword = 'A1!' + 'a'.repeat(126);
      const result = validatePasswordPolicy(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Password cannot exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`
      );
    });

    it('should reject passwords lacking uppercase characters', () => {
      const result = validatePasswordPolicy('lowercase123!@#');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter (A-Z)'
      );
    });

    it('should reject passwords lacking lowercase characters', () => {
      const result = validatePasswordPolicy('UPPERCASE123!@#');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter (a-z)'
      );
    });

    it('should reject passwords lacking numeric characters', () => {
      const result = validatePasswordPolicy('NoNumbersHere!@#');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number (0-9)'
      );
    });

    it('should reject passwords lacking special characters', () => {
      const result = validatePasswordPolicy('NoSpecialChars1234');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Password must contain at least one special character (${PASSWORD_POLICY.ALLOWED_SPECIAL_CHARS})`
      );
    });

    it('should accept diverse supported special characters', () => {
      const specials = [
        '@',
        '$',
        '!',
        '%',
        '*',
        '?',
        '&',
        '#',
        '^',
        '~',
        '_',
        '-',
      ];
      specials.forEach((char) => {
        const pass = `ValidPass123${char}`;
        const result = validatePasswordPolicy(pass);
        expect(result.isValid).toBe(true);
      });
    });

    it('should NOT silently trim passwords and must preserve raw character representation', () => {
      const passwordWithSpaces = '  ValidPassword123!  ';
      // Leading/trailing spaces are preserved as part of the raw secret
      const result = validatePasswordPolicy(passwordWithSpaces);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Password Hashing (hashPassword)', () => {
    it('should hash a valid password using Argon2id', async () => {
      const hash = await hashPassword(validPassword);
      expect(typeof hash).toBe('string');
      expect(hash.startsWith('$argon2id$')).toBe(true);
      expect(hash).not.toBe(validPassword);
      expect(hash.includes(validPassword)).toBe(false);
    });

    it('should produce unique hashes for identical passwords due to distinct salts', async () => {
      const hash1 = await hashPassword(validPassword);
      const hash2 = await hashPassword(validPassword);

      expect(hash1).not.toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(typeof hash2).toBe('string');
    });

    it('should throw AppError when attempting to hash a password violating policy', async () => {
      await expect(hashPassword('short')).rejects.toThrow(AppError);
      await expect(hashPassword('')).rejects.toThrow(AppError);
    });
  });

  describe('Password Verification (verifyPassword)', () => {
    let storedHash;

    beforeAll(async () => {
      storedHash = await hashPassword(validPassword);
    });

    it('should return true when verifying the correct password against its hash', async () => {
      const isMatch = await verifyPassword(validPassword, storedHash);
      expect(isMatch).toBe(true);
    });

    it('should return false for an incorrect password', async () => {
      const isMatch = await verifyPassword('WrongPassword123!', storedHash);
      expect(isMatch).toBe(false);
    });

    it('should return false when case does not match (case-sensitivity)', async () => {
      const isMatch = await verifyPassword(
        validPassword.toLowerCase(),
        storedHash
      );
      expect(isMatch).toBe(false);
    });

    it('should return false safely when password or hash is empty or missing', async () => {
      expect(await verifyPassword('', storedHash)).toBe(false);
      expect(await verifyPassword(validPassword, '')).toBe(false);
      expect(await verifyPassword(null, storedHash)).toBe(false);
      expect(await verifyPassword(validPassword, null)).toBe(false);
      expect(await verifyPassword(undefined, undefined)).toBe(false);
    });

    it('should handle malformed or corrupted hashes safely without throwing', async () => {
      const isMatch = await verifyPassword(
        validPassword,
        'invalid_non_argon_hash_string'
      );
      expect(isMatch).toBe(false);
    });

    it('should verify both independently generated hashes for the same password', async () => {
      const hashA = await hashPassword(validPassword);
      const hashB = await hashPassword(validPassword);

      expect(await verifyPassword(validPassword, hashA)).toBe(true);
      expect(await verifyPassword(validPassword, hashB)).toBe(true);
      expect(hashA).not.toBe(hashB);
    });
  });

  describe('Security & Zero-Leakage Invariants', () => {
    it('should not leak plaintext password or hash in errors or metadata', async () => {
      try {
        await hashPassword('weak');
      } catch (err) {
        expect(err.message).not.toContain('weak');
        expect(JSON.stringify(err)).not.toContain('weak');
      }
    });
  });
});
