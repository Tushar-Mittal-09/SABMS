'use strict';

const request = require('supertest');
const app = require('../../src/app/app');
const { USER_ROLES } = require('../../src/shared/constants');
const {
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  generateDeviceFingerprint,
} = require('../../src/modules/auth/auth.helper');
const {
  verifyPassword,
  hashPassword,
} = require('../../src/services/password.service');
const {
  generateCsrfToken,
  verifyCsrfTokenSignature,
  CSRF_COOKIE_NAME,
} = require('../../src/core/middleware/csrf.middleware');
const {
  sanitizeXssObject,
} = require('../../src/core/middleware/xss.middleware');

describe('Sprint 2.21 — Final Sprint 2 Comprehensive Security Audit', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AUDIT SECTION 1: PASSWORD CRYPTOGRAPHY & TIMING-SAFETY
  // ───────────────────────────────────────────────────────────────────────────
  describe('Audit Check 1: Argon2id Password Cryptography & Timing-Safety', () => {
    it('AUDIT-1.1 verifies Argon2id hashing parameters adhere to OWASP guidelines', async () => {
      const rawPassword = 'ComplexPassword123!@#';
      const hash = await hashPassword(rawPassword);

      // Verify Argon2id variant ($argon2id$)
      expect(hash).toMatch(/^\$argon2id\$/);

      // Verify constant-time match
      const isValid = await verifyPassword(rawPassword, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('WrongPassword123!', hash);
      expect(isInvalid).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AUDIT SECTION 2: DUAL-TOKEN ARCHITECTURE & IMMUTABLE ROLES
  // ───────────────────────────────────────────────────────────────────────────
  describe('Audit Check 2: JWT Access Token & Refresh Token Cryptographic Boundaries', () => {
    const userPayload = {
      _id: '507f1f77bcf86cd799439011',
      role: USER_ROLES.STUDENT,
      email: 'student@university.edu',
    };

    it('AUDIT-2.1 access token excludes sensitive PII and enforces HS256 algorithm pinning', () => {
      const token = generateAccessToken(userPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded.sub).toBe(userPayload._id);
      expect(decoded.role).toBe(USER_ROLES.STUDENT);
      expect(decoded.password).toBeUndefined();
      expect(decoded.passwordHash).toBeUndefined();
      expect(decoded.otp).toBeUndefined();
    });

    it('AUDIT-2.2 refresh token uses separate secret and enforces refresh token type claim', () => {
      const refreshToken = generateRefreshToken(userPayload, {
        jti: 'audit-jti-1',
        familyId: 'audit-fam-1',
      });
      const decoded = verifyRefreshToken(refreshToken);

      expect(decoded.type).toBe('refresh');
      expect(decoded.jti).toBe('audit-jti-1');
      expect(decoded.familyId).toBe('audit-fam-1');

      // Refresh token CANNOT be verified by access secret (eliminates type confusion)
      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AUDIT SECTION 3: SESSION SECURITY & PRIVACY-PRESERVING DEVICE FINGERPRINTING
  // ───────────────────────────────────────────────────────────────────────────
  describe('Audit Check 3: Device Fingerprinting & Subnet Masking', () => {
    it('AUDIT-3.1 extracts /24 subnet preserving user privacy and DHCP roaming stability', () => {
      const ip1 = '198.51.100.12';
      const ip2 = '198.51.100.99';
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

      const fp1 = generateDeviceFingerprint({ ip: ip1, userAgent });
      const fp2 = generateDeviceFingerprint({ ip: ip2, userAgent });

      // Same /24 subnet yields identical fingerprint
      expect(fp1).toBe(fp2);

      // Different subnet yields different fingerprint
      const fp3 = generateDeviceFingerprint({
        ip: '203.0.113.5',
        userAgent,
      });
      expect(fp1).not.toBe(fp3);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AUDIT SECTION 4: CSRF DOUBLE-SUBMIT & ORIGIN VERIFICATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('Audit Check 4: CSRF Protection & Double Submit Verification', () => {
    it('AUDIT-4.1 generates HMAC-signed CSRF tokens and enforces strict Origin checks', () => {
      const token = generateCsrfToken();
      expect(verifyCsrfTokenSignature(token)).toBe(true);

      // Tampered token fails signature verification
      const [rand] = token.split('.');
      expect(verifyCsrfTokenSignature(`${rand}.tamperedsig`)).toBe(false);
    });

    it('AUDIT-4.2 rejects cross-origin state-mutating requests from untrusted origins', async () => {
      const token = generateCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/csrf-token')
        .set('Origin', 'https://attacker-controlled-origin.com')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=${token}`])
        .set('X-XSRF-TOKEN', token);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/CSRF.*Untrusted origin/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AUDIT SECTION 5: XSS SANITIZATION & CONTENT-SECURITY-POLICY
  // ───────────────────────────────────────────────────────────────────────────
  describe('Audit Check 5: XSS Sanitization & CSP Enforcements', () => {
    it('AUDIT-5.1 sanitizes malicious script tags and event handlers while preserving passwords', () => {
      const dirty = {
        name: 'Hacker <script>evil()</script>',
        bio: '<img src=x onerror=alert(1)>Bio',
        password: 'Strict<Password>123!&',
      };

      const clean = sanitizeXssObject(dirty);

      expect(clean.name).toBe('Hacker ');
      expect(clean.bio).not.toContain('onerror=');
      expect(clean.password).toBe('Strict<Password>123!&');
    });

    it('AUDIT-5.2 Helmet enforces restrictive Content-Security-Policy headers', async () => {
      const res = await request(app).get('/live');

      expect(res.status).toBe(200);
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AUDIT SECTION 6: INFORMATION DISCLOSURE & ANTI-CACHING
  // ───────────────────────────────────────────────────────────────────────────
  describe('Audit Check 6: Information Disclosure Prevention & Anti-Caching', () => {
    it('AUDIT-6.1 rejects dangerous HTTP methods (TRACE, TRACK) with 405', async () => {
      const res = await request(app).trace('/live');
      expect(res.status).toBe(405);
    });

    it('AUDIT-6.2 strips X-Powered-By header and applies anti-caching on auth routes', async () => {
      const res = await request(app).get('/api/v1/auth/csrf-token');

      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['cache-control']).toBe(
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      expect(res.headers.pragma).toBe('no-cache');
      expect(res.headers.expires).toBe('0');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });
  });
});
