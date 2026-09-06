'use strict';

const request = require('supertest');
const app = require('../../src/app/app');
const {
  sanitizeXssString,
  sanitizeXssObject,
  xssSanitizer,
  EXCLUDED_FIELDS,
} = require('../../src/core/middleware/xss.middleware');

describe('Sprint 2.19 — Cross-Site Scripting (XSS) Protection & Content Security', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. UNIT TESTING: STRING SANITIZATION PRIMITIVE
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. sanitizeXssString Primitive', () => {
    it('1.1 strips executable <script>...</script> tags completely', () => {
      const malicious = '<script>alert("xss")</script>';
      expect(sanitizeXssString(malicious)).toBe('');

      const multiLine =
        '<script type="text/javascript">\nconsole.log(document.cookie);\n</script>';
      expect(sanitizeXssString(multiLine)).toBe('');
    });

    it('1.2 neutralizes javascript: and vbscript: pseudo-protocol URIs', () => {
      const jsUri = 'javascript:evil()';
      expect(sanitizeXssString(jsUri)).toBe('x-javascript:evil()');

      const vbUri = 'vbscript:msgbox(1)';
      expect(sanitizeXssString(vbUri)).toBe('x-vbscript:msgbox(1)');
    });

    it('1.3 strips inline DOM event handlers (e.g. onerror=, onload=, onclick=)', () => {
      const imgPayload = '<img src="invalid" onerror=alert(1)>';
      const sanitized = sanitizeXssString(imgPayload);
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).toContain('&lt;img');
      expect(sanitized).toContain('&gt;');
    });

    it('1.4 encodes standalone HTML delimiters (< and >) to entity equivalents', () => {
      const tag = '<b>Important Notice</b>';
      expect(sanitizeXssString(tag)).toBe(
        '&lt;b&gt;Important Notice&lt;/b&gt;'
      );
    });

    it('1.5 leaves benign strings and non-string inputs unaltered', () => {
      expect(sanitizeXssString('Normal User Name 123')).toBe(
        'Normal User Name 123'
      );
      expect(sanitizeXssString(12345)).toBe(12345);
      expect(sanitizeXssString(true)).toBe(true);
      expect(sanitizeXssString(null)).toBe(null);
      expect(sanitizeXssString(undefined)).toBe(undefined);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. UNIT TESTING: RECURSIVE OBJECT SANITIZATION & CREDENTIAL PRESERVATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. sanitizeXssObject & Excluded Credential Invariants', () => {
    it('2.1 defines standard excluded credential fields', () => {
      expect(EXCLUDED_FIELDS.has('password')).toBe(true);
      expect(EXCLUDED_FIELDS.has('newPassword')).toBe(true);
      expect(EXCLUDED_FIELDS.has('currentPassword')).toBe(true);
      expect(EXCLUDED_FIELDS.has('confirmPassword')).toBe(true);
      expect(EXCLUDED_FIELDS.has('token')).toBe(true);
      expect(EXCLUDED_FIELDS.has('refreshToken')).toBe(true);
      expect(EXCLUDED_FIELDS.has('accessToken')).toBe(true);
    });

    it('2.2 sanitizes nested objects and arrays while preserving sensitive password fields', () => {
      const rawPayload = {
        name: 'Dr. Jane <script>alert(1)</script>Doe',
        department: '<img src=x onerror=alert(1)>Computer Science',
        password: 'Complex<Password>123!&',
        currentPassword: 'Old<Pass>456!&',
        newPassword: 'Brand<New>789!&',
        details: {
          bio: '<script>steal()</script>Faculty Member',
          tags: ['<b>AI</b>', 'Systems'],
        },
      };

      const sanitized = sanitizeXssObject(rawPayload);

      // Malicious content sanitized
      expect(sanitized.name).toBe('Dr. Jane Doe');
      expect(sanitized.department).not.toContain('onerror=');
      expect(sanitized.department).toContain('&lt;img');
      expect(sanitized.details.bio).toBe('Faculty Member');
      expect(sanitized.details.tags[0]).toBe('&lt;b&gt;AI&lt;/b&gt;');
      expect(sanitized.details.tags[1]).toBe('Systems');

      // CRITICAL SECURITY INVARIANT: Passwords must NEVER be altered or entity-encoded
      expect(sanitized.password).toBe('Complex<Password>123!&');
      expect(sanitized.currentPassword).toBe('Old<Pass>456!&');
      expect(sanitized.newPassword).toBe('Brand<New>789!&');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. HTTP INTEGRATION: XSS SANITIZER & SECURITY HEADERS
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. HTTP Request Sanitization & Content-Security-Policy', () => {
    it('3.1 enforces enterprise Content-Security-Policy (CSP) with base-uri and frame-ancestors', async () => {
      const res = await request(app).get('/live');

      expect(res.status).toBe(200);
      const csp = res.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    });

    it('3.2 sanitizes request body fields before schema validation / processing', async () => {
      const req = {
        body: {
          name: 'Jane <script>bad()</script>Smith',
          department: '<img src="x" onerror="evil()">IT',
          password: 'Plain<Text>Password123!',
        },
        query: {
          search: '<script>alert("query")</script>auditorium',
        },
        params: {
          id: 'test<script></script>',
        },
      };
      const res = {};
      const next = jest.fn();

      xssSanitizer(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.name).toBe('Jane Smith');
      expect(req.body.department).not.toContain('onerror=');
      expect(req.body.password).toBe('Plain<Text>Password123!');
      expect(req.query.search).toBe('auditorium');
      expect(req.params.id).toBe('test');
    });
  });
});
