const User = require('../../src/modules/users/user.model');

describe('User Model (Sprint 2.2.2)', () => {
  it('should be a registered Mongoose model with collection name "users"', () => {
    expect(User).toBeDefined();
    expect(User.modelName).toBe('User');
    expect(User.collection.name).toBe('users');
  });

  describe('Schema Validation & Defaults', () => {
    it('should validate successfully with valid required fields and apply defaults', async () => {
      const validUserData = {
        name: 'Jane Doe',
        email: 'jane.doe@university.edu',
        passwordHash: 'argon2_hashed_value_placeholder',
      };

      const user = new User(validUserData);
      await expect(user.validate()).resolves.toBeUndefined();

      expect(user.name).toBe('Jane Doe');
      expect(user.email).toBe('jane.doe@university.edu');
      expect(user.role).toBe('STUDENT');
      expect(user.status).toBe('PENDING');
      expect(user.isEmailVerified).toBe(false);
      expect(user.isPhoneVerified).toBe(false);
      expect(user.phone).toBeNull();
      expect(user.department).toBeNull();
      expect(user.lastLoginAt).toBeNull();
    });

    it('should fail validation if required fields are missing', async () => {
      const emptyUser = new User({});
      let error;
      try {
        await emptyUser.validate();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.passwordHash).toBeDefined();
    });

    it('should fail validation if name is shorter than 2 characters or longer than 100 characters', async () => {
      const shortUser = new User({
        name: 'A',
        email: 'a@test.com',
        passwordHash: 'hash',
      });
      await expect(shortUser.validate()).rejects.toThrow();

      const longUser = new User({
        name: 'A'.repeat(101),
        email: 'long@test.com',
        passwordHash: 'hash',
      });
      await expect(longUser.validate()).rejects.toThrow();
    });

    it('should fail validation if email format is invalid', async () => {
      const invalidEmailUser = new User({
        name: 'Jane Doe',
        email: 'not-an-email',
        passwordHash: 'hash',
      });
      await expect(invalidEmailUser.validate()).rejects.toThrow();
    });

    it('should normalize email by trimming and converting to lowercase', () => {
      const user = new User({
        name: '  Jane Doe  ',
        email: '  Jane.Doe@University.EDU  ',
        passwordHash: 'hash',
        department: '  Computer Science  ',
      });

      expect(user.name).toBe('Jane Doe');
      expect(user.email).toBe('jane.doe@university.edu');
      expect(user.department).toBe('Computer Science');
    });

    it('should accept all valid role enums and reject invalid roles', async () => {
      const validRoles = [
        'STUDENT',
        'FACULTY',
        'CLUB_MEMBER',
        'EVENT_ORGANIZER',
        'ADMIN',
      ];

      for (const role of validRoles) {
        const user = new User({
          name: 'Jane Doe',
          email: `${role.toLowerCase()}@test.com`,
          passwordHash: 'hash',
          role,
        });
        await expect(user.validate()).resolves.toBeUndefined();
        expect(user.role).toBe(role);
      }

      const invalidRoles = ['SUPER_ADMIN', 'VENUE_MANAGER', 'MANAGER', 'GUEST'];
      for (const invalidRole of invalidRoles) {
        const invalidUser = new User({
          name: 'Jane Doe',
          email: 'invalid@test.com',
          passwordHash: 'hash',
          role: invalidRole,
        });
        await expect(invalidUser.validate()).rejects.toThrow();
      }
    });

    it('should accept all valid status enums and reject invalid statuses', async () => {
      const validStatuses = ['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE'];

      for (const status of validStatuses) {
        const user = new User({
          name: 'Jane Doe',
          email: `${status.toLowerCase()}@test.com`,
          passwordHash: 'hash',
          status,
        });
        await expect(user.validate()).resolves.toBeUndefined();
        expect(user.status).toBe(status);
      }

      const invalidUser = new User({
        name: 'Jane Doe',
        email: 'invalid@test.com',
        passwordHash: 'hash',
        status: 'LOCKED',
      });
      await expect(invalidUser.validate()).rejects.toThrow();
    });

    it('should allow optional phone number and trim whitespace', async () => {
      const userWithPhone = new User({
        name: 'Jane Doe',
        email: 'phone@test.com',
        passwordHash: 'hash',
        phone: '  +1234567890  ',
      });

      await expect(userWithPhone.validate()).resolves.toBeUndefined();
      expect(userWithPhone.phone).toBe('+1234567890');
    });
  });

  describe('Security & Serialization Protections', () => {
    it('should define passwordHash with select: false in schema', () => {
      const pathConfig = User.schema.path('passwordHash');
      expect(pathConfig.options.select).toBe(false);
    });

    it('should strip passwordHash and __v when serialized via toJSON and toObject', () => {
      const user = new User({
        name: 'Jane Doe',
        email: 'jane@test.com',
        passwordHash: 'sensitive_argon2_hash',
      });

      const jsonOutput = user.toJSON();
      expect(jsonOutput.passwordHash).toBeUndefined();
      expect(jsonOutput.__v).toBeUndefined();
      expect(jsonOutput.name).toBe('Jane Doe');
      expect(jsonOutput.email).toBe('jane@test.com');

      const objectOutput = user.toObject();
      expect(objectOutput.passwordHash).toBeUndefined();
      expect(objectOutput.__v).toBeUndefined();
    });
  });

  describe('Index & Schema Configurations', () => {
    it('should have timestamps enabled in schema options', () => {
      expect(User.schema.options.timestamps).toBe(true);
    });

    it('should define unique index on email', () => {
      const indexes = User.schema.indexes();
      const emailIndex = indexes.find(
        (idx) => idx[0].email === 1 && idx[1].unique === true
      );
      expect(emailIndex).toBeDefined();
      expect(emailIndex[1].sparse).toBeFalsy();
    });

    it('should define unique and sparse index on phone', () => {
      const indexes = User.schema.indexes();
      const phoneIndex = indexes.find(
        (idx) => idx[0].phone === 1 && idx[1].unique === true
      );
      expect(phoneIndex).toBeDefined();
      expect(phoneIndex[1].sparse).toBe(true);
    });

    it('should define standard index on role and contain no duplicate index definitions', () => {
      const indexes = User.schema.indexes();
      const roleIndex = indexes.find((idx) => idx[0].role === 1);
      expect(roleIndex).toBeDefined();

      // Verify no duplicate index definitions exist
      expect(indexes).toHaveLength(3);
      const emailIndexes = indexes.filter((idx) => idx[0].email !== undefined);
      const phoneIndexes = indexes.filter((idx) => idx[0].phone !== undefined);
      const roleIndexes = indexes.filter((idx) => idx[0].role !== undefined);
      expect(emailIndexes).toHaveLength(1);
      expect(phoneIndexes).toHaveLength(1);
      expect(roleIndexes).toHaveLength(1);
    });
  });
});
