'use strict';

const request = require('supertest');
const app = require('../../src/app/app');
const {
  methodFilterMiddleware,
  noCacheMiddleware,
  securityHardeningHeaders,
  DISALLOWED_METHODS,
} = require('../../src/core/middleware/hardening.middleware');

describe('Sprint 2.20 — Final Security Hardening & Information Disclosure Defense', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. HTTP METHOD FILTERING & REJECTION (XST MITIGATION)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. HTTP Method Filtering & Rejection', () => {
    it('1.1 defines standard disallowed HTTP methods (TRACE, TRACK)', () => {
      expect(DISALLOWED_METHODS.has('TRACE')).toBe(true);
      expect(DISALLOWED_METHODS.has('TRACK')).toBe(true);
    });

    it('1.2 rejects TRACE request with 405 Method Not Allowed and Allow header', async () => {
      const res = await request(app).trace('/live');

      expect(res.status).toBe(405);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Method TRACE is not allowed/i);
      expect(res.headers.allow).toContain('GET');
      expect(res.headers.allow).toContain('POST');
    });

    it('1.3 unit test methodFilterMiddleware directly', () => {
      const req = { method: 'TRACK' };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      methodFilterMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.set).toHaveBeenCalledWith(
        'Allow',
        expect.stringContaining('GET')
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('1.4 allows valid standard methods through to next()', () => {
      const req = { method: 'GET' };
      const res = {};
      const next = jest.fn();

      methodFilterMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ANTI-CACHING HEADERS ON SENSITIVE AUTH ENDPOINTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Anti-Caching Headers on Authentication Endpoints', () => {
    it('2.1 enforces no-store, no-cache, must-revalidate on auth endpoints', async () => {
      const res = await request(app).get('/api/v1/auth/csrf-token');

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe(
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      expect(res.headers.pragma).toBe('no-cache');
      expect(res.headers.expires).toBe('0');
      expect(res.headers['surrogate-control']).toBe('no-store');
    });

    it('2.2 unit test noCacheMiddleware sets all OWASP anti-caching headers', () => {
      const req = {};
      const res = { set: jest.fn() };
      const next = jest.fn();

      noCacheMiddleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith({
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store',
      });
      expect(next).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. INFORMATION DISCLOSURE MITIGATION (HEADERS & ERROR DETAILS)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Information Disclosure Mitigation', () => {
    it('3.1 disables X-Powered-By header across all HTTP responses', async () => {
      const res = await request(app).get('/live');

      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('3.2 enforces no-sniff and clickjacking frameguard on responses', async () => {
      const res = await request(app).get('/live');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('3.3 unit test securityHardeningHeaders removes sensitive headers', () => {
      const req = {};
      const res = { removeHeader: jest.fn() };
      const next = jest.fn();

      securityHardeningHeaders(req, res, next);

      expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(res.removeHeader).toHaveBeenCalledWith('Server');
      expect(next).toHaveBeenCalled();
    });
  });
});
