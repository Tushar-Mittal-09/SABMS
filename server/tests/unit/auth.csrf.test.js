'use strict';

const request = require('supertest');
const app = require('../../src/app/app');
const config = require('../../src/config/env.config');
const {
  generateCsrfToken,
  verifyCsrfTokenSignature,
  timingSafeTokenMatch,
  CSRF_COOKIE_NAME,
} = require('../../src/core/middleware/csrf.middleware');

describe('Sprint 2.18 — CSRF Protection & Double Submit Verification', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CRYPTOGRAPHIC TOKEN GENERATION & VERIFICATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Cryptographic Token Primitives', () => {
    it('1.1 generateCsrfToken generates a signed token (<randomHex>.<signature>)', () => {
      const token = generateCsrfToken();
      expect(typeof token).toBe('string');
      expect(token).toContain('.');

      const [randomHex, signature] = token.split('.');
      expect(randomHex.length).toBe(64); // 32 bytes in hex
      expect(signature.length).toBe(64); // sha256 hex
    });

    it('1.2 verifyCsrfTokenSignature verifies signature with correct secret and rejects forged token', () => {
      const token = generateCsrfToken();
      expect(verifyCsrfTokenSignature(token)).toBe(true);

      // Tampered random portion
      const [randomHex, signature] = token.split('.');
      const tamperedHex = 'a'.repeat(64);
      expect(verifyCsrfTokenSignature(`${tamperedHex}.${signature}`)).toBe(
        false
      );

      // Tampered signature
      const tamperedSig = 'b'.repeat(64);
      expect(verifyCsrfTokenSignature(`${randomHex}.${tamperedSig}`)).toBe(
        false
      );

      // Malformed inputs
      expect(verifyCsrfTokenSignature('')).toBe(false);
      expect(verifyCsrfTokenSignature('no-dot-token')).toBe(false);
      expect(verifyCsrfTokenSignature(null)).toBe(false);
      expect(verifyCsrfTokenSignature(undefined)).toBe(false);
    });

    it('1.3 timingSafeTokenMatch validates matching tokens in constant time and rejects mismatches', () => {
      const tokenA = generateCsrfToken();
      const tokenB = generateCsrfToken();

      expect(timingSafeTokenMatch(tokenA, tokenA)).toBe(true);
      expect(timingSafeTokenMatch(tokenA, tokenB)).toBe(false);
      expect(timingSafeTokenMatch(tokenA, 'short')).toBe(false);
      expect(timingSafeTokenMatch('', tokenA)).toBe(false);
      expect(timingSafeTokenMatch(null, tokenA)).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. CSRF TOKEN RETRIEVAL & COOKIE ISSUANCE
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Endpoint & Cookie Issuance (GET /api/v1/auth/csrf-token)', () => {
    it('2.1 returns 200 OK with signed CSRF token and issues XSRF-TOKEN cookie', async () => {
      const res = await request(app).get('/api/v1/auth/csrf-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('csrfToken');
      expect(verifyCsrfTokenSignature(res.body.data.csrfToken)).toBe(true);

      // Verify Set-Cookie header contains XSRF-TOKEN with secure flags
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const xsrfCookie = cookies.find((c) =>
        c.startsWith(`${CSRF_COOKIE_NAME}=`)
      );
      expect(xsrfCookie).toBeDefined();
      expect(xsrfCookie).toContain('SameSite=Strict');
      expect(xsrfCookie).toContain('Path=/');
      // Must NOT be HttpOnly so client JavaScript (e.g. Axios) can read it
      expect(xsrfCookie).not.toContain('HttpOnly');
    });

    it('2.2 safe GET requests set XSRF-TOKEN cookie if missing without blocking', async () => {
      const res = await request(app).get('/live');

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const xsrfCookie = cookies.find((c) =>
        c.startsWith(`${CSRF_COOKIE_NAME}=`)
      );
      expect(xsrfCookie).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. DOUBLE-SUBMIT COOKIE ENFORCEMENT ON STATE-MUTATING REQUESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Double-Submit Cookie Pattern Enforcement', () => {
    it('3.1 allows state-mutating request when matching XSRF-TOKEN cookie and X-XSRF-TOKEN header are provided', async () => {
      const validToken = generateCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/csrf-token') // Non-existent POST will hit 404 or method not allowed, but past CSRF
        .set('Cookie', [`${CSRF_COOKIE_NAME}=${validToken}`])
        .set('X-XSRF-TOKEN', validToken);

      // Since /csrf-token only has a GET handler, Express router returns 404 or routes to next,
      // confirming CSRF middleware passed (status is NOT 403 Forbidden)
      expect(res.status).not.toBe(403);
    });

    it('3.2 allows state-mutating request when matching X-CSRF-Token header is provided', async () => {
      const validToken = generateCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/csrf-token')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=${validToken}`])
        .set('X-CSRF-Token', validToken);

      expect(res.status).not.toBe(403);
    });

    it('3.3 rejects request with 403 Forbidden when XSRF-TOKEN cookie is present but CSRF header is missing', async () => {
      const validToken = generateCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=${validToken}`])
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/CSRF token missing in request headers/);
    });

    it('3.4 rejects request with 403 Forbidden when CSRF header does not match cookie', async () => {
      const validTokenA = generateCsrfToken();
      const validTokenB = generateCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=${validTokenA}`])
        .set('X-XSRF-TOKEN', validTokenB)
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Invalid or forged CSRF token/);
    });

    it('3.5 rejects request with 403 Forbidden when CSRF header has invalid cryptographic signature', async () => {
      const forgedToken = `${'c'.repeat(64)}.${'d'.repeat(64)}`;

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=${forgedToken}`])
        .set('X-XSRF-TOKEN', forgedToken)
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Invalid or forged CSRF token/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. ORIGIN & REFERER VERIFICATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Origin & Referer Verification', () => {
    it('4.1 rejects cross-site request from untrusted origin with 403 Forbidden', async () => {
      const validToken = generateCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'https://malicious-hacker-site.attacker.com')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=${validToken}`])
        .set('X-XSRF-TOKEN', validToken)
        .send({ email: 'victim@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(
        /Cross-Site Request Forgery \(CSRF\) detected: Untrusted origin/
      );
    });

    it('4.2 accepts request with trusted client origin matching config.clientUrl', async () => {
      const validToken = generateCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/csrf-token')
        .set('Origin', config.clientUrl || 'http://localhost:3000')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=${validToken}`])
        .set('X-XSRF-TOKEN', validToken);

      expect(res.status).not.toBe(403);
    });

    it('4.3 accepts request with localhost origins in development / test', async () => {
      const validToken = generateCsrfToken();

      const res = await request(app)
        .post('/api/v1/auth/csrf-token')
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=${validToken}`])
        .set('X-XSRF-TOKEN', validToken);

      expect(res.status).not.toBe(403);
    });
  });
});
