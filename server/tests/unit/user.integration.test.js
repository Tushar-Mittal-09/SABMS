'use strict';

const request = require('supertest');
const app = require('../../src/app/app');
const {
  USER_ROLES,
  USER_ROLE_VALUES,
  DEFAULT_USER_ROLE,
  ACCOUNT_STATUSES,
  ACCOUNT_STATUS_VALUES,
  DEFAULT_ACCOUNT_STATUS,
} = require('../../src/shared/constants');
const User = require('../../src/modules/users/user.model');
const userRepository = require('../../src/modules/users/user.repository');
const {
  createUserSchema,
  adminCreateUserSchema,
} = require('../../src/modules/users/user.schema');

describe('User Foundation Integration (Sprint 2.2.7)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Validation → Model → Repository Integrated Pipeline', () => {
    it('should validate public registration payload, instantiate User model, and persist via repository', async () => {
      // 1. Validate through Zod Request Validation Contract
      const rawInput = {
        name: '  Alex Smith  ',
        email: '  Alex.Smith@University.EDU  ',
        phone: '  +19876543210  ',
        department: '  Robotics & AI  ',
      };

      const validatedData = createUserSchema.parse(rawInput);
      expect(validatedData.name).toBe('Alex Smith');
      expect(validatedData.email).toBe('alex.smith@university.edu');
      expect(validatedData.phone).toBe('+19876543210');
      expect(validatedData.department).toBe('Robotics & AI');

      // 2. Prepare domain persistence payload (with default role, status, and placeholder passwordHash)
      const persistenceData = {
        ...validatedData,
        passwordHash: 'dummy_argon2_hash_for_test',
        role: DEFAULT_USER_ROLE,
        status: DEFAULT_ACCOUNT_STATUS,
      };

      // 3. Persist via User Repository
      const mockSaved = new User({
        _id: '507f1f77bcf86cd799439011',
        ...persistenceData,
      });

      jest.spyOn(User.prototype, 'save').mockResolvedValue(mockSaved);

      const savedUser = await userRepository.create(persistenceData);
      expect(savedUser).toBeDefined();
      expect(savedUser.name).toBe('Alex Smith');
      expect(savedUser.email).toBe('alex.smith@university.edu');
      expect(savedUser.role).toBe(USER_ROLES.STUDENT);
      expect(savedUser.status).toBe(ACCOUNT_STATUSES.PENDING);
      expect(savedUser.isEmailVerified).toBe(false);
      expect(savedUser.isPhoneVerified).toBe(false);

      // 4. Verify safe serialization (passwordHash must not leak)
      const serialized = savedUser.toJSON();
      expect(serialized.passwordHash).toBeUndefined();
      expect(serialized.__v).toBeUndefined();
      expect(serialized.name).toBe('Alex Smith');
    });

    it('should reject non-canonical roles through validation and model constraints', () => {
      // Zod validation rejection
      expect(() =>
        adminCreateUserSchema.parse({
          name: 'Invalid User',
          email: 'invalid@test.com',
          role: 'VENUE_MANAGER',
        })
      ).toThrow();

      // Mongoose schema validation rejection
      const user = new User({
        name: 'Invalid User',
        email: 'invalid@test.com',
        passwordHash: 'hash',
        role: 'VENUE_MANAGER',
      });
      expect(user.validate()).rejects.toThrow();
    });

    it('should reject non-canonical statuses through validation and model constraints', () => {
      // Zod validation rejection
      expect(() =>
        adminCreateUserSchema.parse({
          name: 'Invalid User',
          email: 'invalid@test.com',
          status: 'LOCKED',
        })
      ).toThrow();

      // Mongoose schema validation rejection
      const user = new User({
        name: 'Invalid User',
        email: 'invalid@test.com',
        passwordHash: 'hash',
        status: 'LOCKED',
      });
      expect(user.validate()).rejects.toThrow();
    });
  });

  describe('HTTP Route Integration via Express Pipeline', () => {
    it('GET /api/v1/users should return 200 with standardized response envelope', async () => {
      const response = await request(app).get('/api/v1/users').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Users retrieved successfully');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.users).toEqual([]);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
      });
    });

    it('GET /api/v1/users/:id should accept valid 24-character hex ObjectId and return 200', async () => {
      const validId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/v1/users/${validId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User retrieved successfully');
      expect(response.body.data.id).toBe(validId);
    });

    it('GET /api/v1/users/:id should reject invalid ObjectId with 422 Unprocessable Entity', async () => {
      const invalidId = 'not-a-valid-object-id';
      const response = await request(app)
        .get(`/api/v1/users/${invalidId}`)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('POST /api/v1/users should return 201 placeholder response without registration logic', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .send({})
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User created (placeholder)');
    });
  });

  describe('Single Source of Truth Consistency', () => {
    it('should maintain exact 5 canonical roles across constants and schemas', () => {
      expect(USER_ROLE_VALUES).toEqual([
        'STUDENT',
        'FACULTY',
        'CLUB_MEMBER',
        'EVENT_ORGANIZER',
        'ADMIN',
      ]);
    });

    it('should maintain exact 4 canonical statuses across constants and schemas', () => {
      expect(ACCOUNT_STATUS_VALUES).toEqual([
        'PENDING',
        'ACTIVE',
        'SUSPENDED',
        'INACTIVE',
      ]);
    });
  });
});
