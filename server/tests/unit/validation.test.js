const { z } = require('zod');
const {
  validate,
  validateBody,
  validateQuery,
  validateParams,
} = require('../../src/validations/validateRequest.middleware');
const { validateRequest } = require('../../src/validations/requestValidation');
const validators = require('../../src/validations/reusableValidators');

describe('Validation Framework & AppError Normalization', () => {
  describe('Single Section Validation Middleware', () => {
    it('should pass valid body data', () => {
      const middleware = validateBody(
        z.object({
          email: validators.email(),
        })
      );

      const req = { body: { email: 'user@example.com' } };
      const res = {};
      let nextCalledWith = null;

      middleware(req, res, (err) => {
        nextCalledWith = err;
      });

      expect(nextCalledWith).toBeUndefined();
      expect(req.body.email).toBe('user@example.com');
    });

    it('should return AppError for invalid body', () => {
      const middleware = validateBody(
        z.object({
          email: validators.email(),
        })
      );

      const req = { body: { email: 'invalid-email' } };
      const res = {};
      let nextCalledWith = null;

      middleware(req, res, (err) => {
        nextCalledWith = err;
      });

      expect(nextCalledWith).toBeDefined();
      expect(nextCalledWith.statusCode).toBe(422);
      expect(nextCalledWith.isOperational).toBe(true);
    });

    it('should return AppError for invalid query', () => {
      const middleware = validateQuery(
        z.object({
          page: z.coerce.number().positive(),
        })
      );

      const req = { query: { page: '-1' } };
      const res = {};
      let nextCalledWith = null;

      middleware(req, res, (err) => {
        nextCalledWith = err;
      });

      expect(nextCalledWith).toBeDefined();
      expect(nextCalledWith.statusCode).toBe(422);
    });

    it('should return AppError for invalid params', () => {
      const middleware = validateParams(
        z.object({
          id: validators.objectId(),
        })
      );

      const req = { params: { id: 'invalid-id' } };
      const res = {};
      let nextCalledWith = null;

      middleware(req, res, (err) => {
        nextCalledWith = err;
      });

      expect(nextCalledWith).toBeDefined();
      expect(nextCalledWith.statusCode).toBe(422);
    });
  });

  describe('Multiple Simultaneous Section Failures (Fix 2 Verification)', () => {
    it('should construct AppError without throwing when multiple sections fail in validate middleware', () => {
      const middleware = validate({
        params: z.object({ id: validators.objectId() }),
        query: z.object({ limit: z.coerce.number().positive() }),
        body: z.object({ title: z.string().min(3) }),
      });

      const req = {
        params: { id: 'bad-id' },
        query: { limit: '-5' },
        body: { title: 'a' },
      };
      const res = {};
      let nextCalledWith = null;

      middleware(req, res, (err) => {
        nextCalledWith = err;
      });

      expect(nextCalledWith).toBeDefined();
      expect(nextCalledWith.statusCode).toBe(422);
      expect(nextCalledWith.message).toContain('failed validation');
      expect(Array.isArray(nextCalledWith.errors)).toBe(true);
      expect(nextCalledWith.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle multi-section validation in validateRequest utility', () => {
      const schemas = {
        params: z.object({ id: validators.objectId() }),
        body: z.object({ email: validators.email() }),
      };

      const req = {
        params: { id: 'bad-id' },
        body: { email: 'not-an-email' },
      };

      const result = validateRequest(schemas, req);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.statusCode).toBe(422);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
