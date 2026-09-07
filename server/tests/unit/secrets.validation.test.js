'use strict';

const config = require('../../src/config/env.config');
const { hashOtp } = require('../../src/modules/auth/auth.helper');
const {
  generateCsrfToken,
  verifyCsrfTokenSignature,
} = require('../../src/core/middleware/csrf.middleware');

describe('M-04 Audit Remediation: Production Secrets Validation & Fail-Fast', () => {
  const baseValidProdEnv = {
    NODE_ENV: 'production',
    PORT: '5000',
    MONGODB_URI: 'mongodb://localhost:27017/sabms-test',
    JWT_ACCESS_SECRET: 'a-very-secure-custom-production-access-secret-32-chars',
    JWT_REFRESH_SECRET:
      'a-very-secure-custom-production-refresh-secret-32-chars',
    OTP_HASH_SECRET: 'a-very-secure-custom-production-otp-secret-32-chars',
    COOKIE_SECRET: 'a-very-secure-custom-production-cookie-secret-32-chars',
  };

  describe('envSchema Production Validation', () => {
    it('1. should successfully validate when all production secrets are explicitly configured and strong', () => {
      const result = config.envSchema.safeParse(baseValidProdEnv);
      expect(result.success).toBe(true);
      expect(result.data.COOKIE_SECRET).toBe(baseValidProdEnv.COOKIE_SECRET);
      expect(result.data.OTP_HASH_SECRET).toBe(
        baseValidProdEnv.OTP_HASH_SECRET
      );
    });

    it('2. should reject default COOKIE_SECRET in production', () => {
      const env = {
        ...baseValidProdEnv,
        COOKIE_SECRET: 'sabms-enterprise-secure-cookie-secret-key-2026',
      };
      const result = config.envSchema.safeParse(env);
      expect(result.success).toBe(false);
      const errors = result.error.format();
      expect(errors.COOKIE_SECRET._errors[0]).toContain(
        'COOKIE_SECRET must be explicitly configured with a secure non-default secret in production'
      );
    });

    it('3. should reject default OTP_HASH_SECRET in production', () => {
      const env = {
        ...baseValidProdEnv,
        OTP_HASH_SECRET: 'sabms-enterprise-otp-hmac-secret-2026',
      };
      const result = config.envSchema.safeParse(env);
      expect(result.success).toBe(false);
      const errors = result.error.format();
      expect(errors.OTP_HASH_SECRET._errors[0]).toContain(
        'OTP_HASH_SECRET must be explicitly configured with a secure non-default secret in production'
      );
    });

    it('4. should reject default or known weak JWT secrets in production', () => {
      const env = {
        ...baseValidProdEnv,
        JWT_ACCESS_SECRET: 'sabms-default-jwt-access-secret-32-chars!',
      };
      const result = config.envSchema.safeParse(env);
      expect(result.success).toBe(false);
      const errors = result.error.format();
      expect(errors.JWT_ACCESS_SECRET._errors[0]).toContain(
        'JWT_ACCESS_SECRET must not use a default development secret in production'
      );
    });

    it('5. should allow default secrets in development mode', () => {
      const devEnv = {
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://localhost:27017/sabms-dev',
        JWT_ACCESS_SECRET: 'dev-jwt-access-secret-minimum-16-chars',
        JWT_REFRESH_SECRET: 'dev-jwt-refresh-secret-minimum-16-chars',
      };
      const result = config.envSchema.safeParse(devEnv);
      expect(result.success).toBe(true);
      expect(result.data.COOKIE_SECRET).toBe(
        'sabms-enterprise-secure-cookie-secret-key-2026'
      );
      expect(result.data.OTP_HASH_SECRET).toBe(
        'sabms-enterprise-otp-hmac-secret-2026'
      );
    });
  });

  describe('In-Code Secret Enforcements', () => {
    it('6. should throw an error in hashOtp if secret is missing or null', () => {
      expect(() => hashOtp('123456', '')).toThrow(
        'OTP HMAC secret is required for hashing'
      );
      expect(() => hashOtp('123456', null)).toThrow(
        'OTP HMAC secret is required for hashing'
      );
    });

    it('7. should throw an error in generateCsrfToken if secret is missing or null', () => {
      expect(() => generateCsrfToken('')).toThrow(
        'Cookie secret is required for CSRF token generation'
      );
      expect(() => generateCsrfToken(null)).toThrow(
        'Cookie secret is required for CSRF token generation'
      );
    });

    it('8. should return false in verifyCsrfTokenSignature if secret is missing or null', () => {
      const validToken = generateCsrfToken(
        'custom-secret-key-for-test-32-bytes'
      );
      expect(verifyCsrfTokenSignature(validToken, '')).toBe(false);
      expect(verifyCsrfTokenSignature(validToken, null)).toBe(false);
    });
  });
});
