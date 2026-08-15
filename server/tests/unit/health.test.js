const request = require('supertest');
const app = require('../../src/app/app');

describe('System Health Probes & Infrastructure Smoke Tests', () => {
  describe('GET /health', () => {
    it('should return health status with valid envelope and request correlation ID', async () => {
      const res = await request(app).get('/health');

      // Status will be 200 (if db connected) or 503 (if db disconnected in isolated test mode)
      expect([200, 503]).toContain(res.status);

      // Verify standardized API envelope
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('message');

      // Verify request correlation ID in header and response
      expect(res.headers['x-request-id']).toBeDefined();
      expect(typeof res.headers['x-request-id']).toBe('string');
      expect(res.headers['x-request-id'].length).toBeGreaterThan(0);

      // Verify database health contract representation
      if (res.body.success) {
        expect(res.body.data).toBeDefined();
        expect(res.body.data.services).toBeDefined();
        expect(res.body.data.services.database).toBeDefined();
        expect(res.body.data.services.database.status).toBe('healthy');
      } else {
        expect(res.body.error).toBeDefined();
        expect(res.body.error.services).toBeDefined();
        expect(res.body.error.services.database).toBeDefined();
        expect(res.body.error.services.database.status).toBe('unhealthy');
      }
    });

    it('should support full format query parameter', async () => {
      const res = await request(app).get('/health?format=full');

      expect([200, 503]).toContain(res.status);
      const payload = res.body.data || res.body.error;
      expect(payload).toHaveProperty('system');
      expect(payload).toHaveProperty('memory');
      expect(payload.system).toHaveProperty('hostname');
      expect(payload.system).toHaveProperty('runtime', 'Node.js');
    });
  });

  describe('GET /live', () => {
    it('should return 200 OK with liveness confirmation', async () => {
      const res = await request(app).get('/live');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('live', true);
      expect(res.body.data).toHaveProperty('requestId');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('GET /ready', () => {
    it('should report readiness based on database state', async () => {
      const res = await request(app).get('/ready');

      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('success');
      const payload = res.body.data || res.body.error;
      expect(payload).toHaveProperty('ready');
      expect(payload).toHaveProperty('checks');
      expect(payload.checks).toHaveProperty('database');
    });
  });

  describe('GET /info', () => {
    it('should return system metadata', async () => {
      const res = await request(app).get('/info');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('appName');
      expect(res.body.data).toHaveProperty('apiVersion');
      expect(res.body.data).toHaveProperty('environment');
    });
  });

  describe('404 Not Found Handling', () => {
    it('should return standardized 404 error with suggestions and correlation ID', async () => {
      const res = await request(app).get('/api/v1/non-existent-endpoint');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain(
        'Cannot GET /api/v1/non-existent-endpoint'
      );
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should enforce Helmet security headers', async () => {
      const res = await request(app).get('/live');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-download-options']).toBe('noopen');
    });
  });

  describe('NoSQL Injection Sanitization', () => {
    it('should safely sanitize request bodies without crashing Express 5', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: { $gt: '' },
          password: 'password123',
        });

      // Endpoint should not throw a 500 error from query getter overwrite
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
