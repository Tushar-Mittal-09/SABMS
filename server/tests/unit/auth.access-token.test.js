'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app/app');
const config = require('../../src/config/env.config');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const User = require('../../src/modules/users/user.model');
const authRepository = require('../../src/modules/auth/auth.repository');
const authService = require('../../src/modules/auth/auth.service');
const {
  generateAccessToken,
  verifyAccessToken,
  decodeAccessToken,
} = require('../../src/modules/auth/auth.helper');
const {
  JWT_ALGORITHM,
  JWT_ACCESS_TOKEN_TYPE,
  JWT_DEFAULT_ISSUER,
  JWT_DEFAULT_AUDIENCE,
} = require('../../src/modules/auth/auth.constants');
const { hashPassword } = require('../../src/services/password.service');
const AppError = require('../../src/core/errors/AppError');

describe('JWT Access Token Generation & Security (Sprint 2.8)', () => {
  let validPasswordHash;
  let mockActiveUser;
  let mockPendingUser;
  let mockSuspendedUser;
  let mockInactiveUser;

  beforeAll(async () => {
    validPasswordHash = await hashPassword('ValidPass123!');
  });

  beforeEach(() => {
    mockActiveUser = new User({
      _id: '64a7f8e9c1d2e3f4a5b6c7d8',
      name: 'Jane Doe',
      email: 'jane.doe@university.edu',
      phone: '+919876543210',
      department: 'Computer Science',
      passwordHash: validPasswordHash,
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUSES.ACTIVE,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date('2026-08-15T12:00:00.000Z'),
    });

    mockPendingUser = new User({
      _id: '64a7f8e9c1d2e3f4a5b6c7d9',
      name: 'Unverified Student',
      email: 'pending.student@university.edu',
      passwordHash: validPasswordHash,
      role: USER_ROLES.STUDENT,
      status: ACCOUNT_STATUSES.PENDING,
      isEmailVerified: false,
      isPhoneVerified: false,
      createdAt: new Date('2026-08-15T12:00:00.000Z'),
    });

    mockSuspendedUser = new User({
      _id: '64a7f8e9c1d2e3f4a5b6c7da',
      name: 'Suspended Faculty',
      email: 'suspended.faculty@university.edu',
      passwordHash: validPasswordHash,
      role: USER_ROLES.FACULTY,
      status: ACCOUNT_STATUSES.SUSPENDED,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date('2026-08-15T12:00:00.000Z'),
    });

    mockInactiveUser = new User({
      _id: '64a7f8e9c1d2e3f4a5b6c7db',
      name: 'Inactive Admin',
      email: 'inactive.admin@university.edu',
      passwordHash: validPasswordHash,
      role: USER_ROLES.ADMIN,
      status: ACCOUNT_STATUSES.INACTIVE,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date('2026-08-15T12:00:00.000Z'),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. JWT STRUCTURE, SYNTAX & CLAIMS VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('JWT Access Token Structure & Claims', () => {
    it('1. should generate a syntactically valid JWT with header, payload, and signature', () => {
      const token = generateAccessToken(mockActiveUser);
      expect(typeof token).toBe('string');

      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      const decodedComplete = decodeAccessToken(token, { complete: true });
      expect(decodedComplete).toBeDefined();
      expect(decodedComplete.header).toBeDefined();
      expect(decodedComplete.header.alg).toBe(JWT_ALGORITHM);
      expect(decodedComplete.header.typ).toBe('JWT');
    });

    it('2. should contain the correct subject/user ID claim (sub)', () => {
      const token = generateAccessToken(mockActiveUser);
      const decoded = verifyAccessToken(token);

      expect(decoded.sub).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
    });

    it('3. should contain issued-at timestamp (iat)', () => {
      const token = generateAccessToken(mockActiveUser);
      const decoded = verifyAccessToken(token);

      expect(decoded.iat).toBeDefined();
      expect(typeof decoded.iat).toBe('number');
      expect(decoded.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it('4. should contain expiration timestamp (exp) according to configured policy', () => {
      const token = generateAccessToken(mockActiveUser);
      const decoded = verifyAccessToken(token);

      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
      // Default 15m is 900 seconds
      expect(decoded.exp - decoded.iat).toBe(900);
    });

    it('5. should contain expected issuer claim (iss)', () => {
      const token = generateAccessToken(mockActiveUser);
      const decoded = verifyAccessToken(token);

      expect(decoded.iss).toBe(config.jwt.issuer || JWT_DEFAULT_ISSUER);
    });

    it('6. should contain expected audience claim (aud)', () => {
      const token = generateAccessToken(mockActiveUser);
      const decoded = verifyAccessToken(token);

      expect(decoded.aud).toBe(config.jwt.audience || JWT_DEFAULT_AUDIENCE);
    });

    it('7. should contain user role claim', () => {
      const token = generateAccessToken(mockActiveUser);
      const decoded = verifyAccessToken(token);

      expect(decoded.role).toBe(USER_ROLES.STUDENT);
    });

    it('8. should support plain user object or user ID string', () => {
      const tokenFromObj = generateAccessToken({
        id: '64a7f8e9c1d2e3f4a5b6c7d8',
        role: USER_ROLES.FACULTY,
      });
      const decodedObj = verifyAccessToken(tokenFromObj);
      expect(decodedObj.sub).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
      expect(decodedObj.role).toBe(USER_ROLES.FACULTY);

      const tokenFromStr = generateAccessToken('64a7f8e9c1d2e3f4a5b6c7d8');
      const decodedStr = verifyAccessToken(tokenFromStr);
      expect(decodedStr.sub).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
    });

    it('9. should throw error if user entity or ID is missing', () => {
      expect(() => generateAccessToken(null)).toThrow(
        'User entity is required to generate an access token'
      );
      expect(() => generateAccessToken({})).toThrow(
        'User ID (sub) is required to generate an access token'
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SENSITIVE DATA EXCLUSION & CLAIMS SECURITY
  // ───────────────────────────────────────────────────────────────────────────
  describe('Sensitive Claims & Data Exclusion', () => {
    it('10. should NEVER include plaintext password in JWT claims', () => {
      const token = generateAccessToken({
        _id: '64a7f8e9c1d2e3f4a5b6c7d8',
        password: 'SuperSecretPassword123!',
      });
      const decoded = verifyAccessToken(token);
      expect(decoded.password).toBeUndefined();
    });

    it('11. should NEVER include passwordHash in JWT claims', () => {
      const token = generateAccessToken(mockActiveUser);
      const decoded = verifyAccessToken(token);
      expect(decoded.passwordHash).toBeUndefined();
    });

    it('12. should NEVER include OTP in JWT claims', () => {
      const token = generateAccessToken({
        _id: '64a7f8e9c1d2e3f4a5b6c7d8',
        otp: '123456',
      });
      const decoded = verifyAccessToken(token);
      expect(decoded.otp).toBeUndefined();
    });

    it('13. should NEVER include OTP hash in JWT claims', () => {
      const token = generateAccessToken({
        _id: '64a7f8e9c1d2e3f4a5b6c7d8',
        otpHash: 'a1b2c3d4e5f6...',
      });
      const decoded = verifyAccessToken(token);
      expect(decoded.otpHash).toBeUndefined();
    });

    it('14. should NEVER include JWT secret in JWT claims', () => {
      const token = generateAccessToken(mockActiveUser);
      const decoded = verifyAccessToken(token);
      expect(decoded.secret).toBeUndefined();
      expect(decoded.jwtSecret).toBeUndefined();
    });

    it('15. should NEVER include Redis keys or database connection strings in JWT claims', () => {
      const token = generateAccessToken({
        _id: '64a7f8e9c1d2e3f4a5b6c7d8',
        redisKey: 'auth:otp:email:test@sabms.edu',
        dbUri: 'mongodb://...',
      });
      const decoded = verifyAccessToken(token);
      expect(decoded.redisKey).toBeUndefined();
      expect(decoded.dbUri).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. CRYPTOGRAPHIC SIGNATURE & ALGORITHM SECURITY
  // ───────────────────────────────────────────────────────────────────────────
  describe('Cryptographic Signature & Algorithm Security', () => {
    it('16. should reject token verified with an incorrect secret key', () => {
      const token = generateAccessToken(mockActiveUser);

      expect(() => {
        verifyAccessToken(token, {
          secret: 'completely-wrong-secret-key-that-should-fail-verification',
        });
      }).toThrow(jwt.JsonWebTokenError);
    });

    it('17. should reject token with a tampered signature', () => {
      const token = generateAccessToken(mockActiveUser);
      const tamperedToken = `${token.slice(0, -5)}abcde`;

      expect(() => {
        verifyAccessToken(tamperedToken);
      }).toThrow(jwt.JsonWebTokenError);
    });

    it('18. should reject token with a tampered payload', () => {
      const token = generateAccessToken(mockActiveUser);
      const [header, , signature] = token.split('.');

      // Attacker attempts privilege escalation to ADMIN
      const forgedPayload = Buffer.from(
        JSON.stringify({
          sub: '64a7f8e9c1d2e3f4a5b6c7d8',
          role: USER_ROLES.ADMIN,
        })
      ).toString('base64url');

      const tamperedToken = `${header}.${forgedPayload}.${signature}`;

      expect(() => {
        verifyAccessToken(tamperedToken);
      }).toThrow(jwt.JsonWebTokenError);
    });

    it('19. should reject algorithm confusion (e.g. none algorithm)', () => {
      const [, payload] = generateAccessToken(mockActiveUser).split('.');
      const noneHeader = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' })
      ).toString('base64url');

      const noneToken = `${noneHeader}.${payload}.`;

      expect(() => {
        verifyAccessToken(noneToken);
      }).toThrow();
    });

    it('20. should reject algorithm mismatch (e.g. RS256 token presented when HS256 expected)', () => {
      const customToken = jwt.sign(
        { sub: '64a7f8e9c1d2e3f4a5b6c7d8' },
        'secret-key-with-minimum-length-32-chars-long',
        {
          algorithm: 'HS384',
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
        }
      );

      expect(() => {
        // Enforcing pinned HS256 algorithm rejects HS384
        verifyAccessToken(customToken, {
          algorithms: ['HS256'],
          secret: 'secret-key-with-minimum-length-32-chars-long',
        });
      }).toThrow(jwt.JsonWebTokenError);
    });

    it('21. should reject token with invalid issuer', () => {
      const tokenWithWrongIssuer = jwt.sign(
        { sub: '64a7f8e9c1d2e3f4a5b6c7d8' },
        config.jwt.accessSecret,
        {
          algorithm: 'HS256',
          issuer: 'rogue-unauthorized-issuer',
          audience: config.jwt.audience,
        }
      );

      expect(() => {
        verifyAccessToken(tokenWithWrongIssuer);
      }).toThrow(jwt.JsonWebTokenError);
    });

    it('22. should reject token with invalid audience', () => {
      const tokenWithWrongAudience = jwt.sign(
        { sub: '64a7f8e9c1d2e3f4a5b6c7d8' },
        config.jwt.accessSecret,
        {
          algorithm: 'HS256',
          issuer: config.jwt.issuer,
          audience: 'rogue-unauthorized-client',
        }
      );

      expect(() => {
        verifyAccessToken(tokenWithWrongAudience);
      }).toThrow(jwt.JsonWebTokenError);
    });

    it('23. should reject expired token', () => {
      const expiredToken = jwt.sign(
        { sub: '64a7f8e9c1d2e3f4a5b6c7d8' },
        config.jwt.accessSecret,
        {
          algorithm: 'HS256',
          expiresIn: '-1s',
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
        }
      );

      expect(() => {
        verifyAccessToken(expiredToken);
      }).toThrow(jwt.TokenExpiredError);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. AUTH SERVICE LOGIN INTEGRATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuthService.login JWT Token Generation', () => {
    it('24. should authenticate valid active user and return signed access token', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);
      jest.spyOn(authRepository, 'updateLastLogin').mockResolvedValue(
        new User({
          ...mockActiveUser.toObject(),
          lastLoginAt: new Date(),
        })
      );

      const result = await authService.login({
        email: 'jane.doe@university.edu',
        password: 'ValidPass123!',
      });

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(result.tokenType).toBe(JWT_ACCESS_TOKEN_TYPE);
      expect(result.expiresIn).toBe(config.jwt.accessExpiresIn || '15m');

      // Verify returned token is cryptographically valid
      const decoded = verifyAccessToken(result.accessToken);
      expect(decoded.sub).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
      expect(decoded.role).toBe(USER_ROLES.STUDENT);
    });

    it('25. should maintain all login security checks (non-existent account -> 401)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'ghost@university.edu',
          password: 'ValidPass123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.login({
          email: 'ghost@university.edu',
          password: 'ValidPass123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid email or password.');
      }
    });

    it('26. should maintain all login security checks (wrong password -> 401)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);

      await expect(
        authService.login({
          email: 'jane.doe@university.edu',
          password: 'IncorrectPassword123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.login({
          email: 'jane.doe@university.edu',
          password: 'IncorrectPassword123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid email or password.');
      }
    });

    it('27. should maintain all login security checks (unverified account -> 403)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockPendingUser);

      await expect(
        authService.login({
          email: 'pending.student@university.edu',
          password: 'ValidPass123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.login({
          email: 'pending.student@university.edu',
          password: 'ValidPass123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe(
          'Account not verified. Please verify your email with the OTP code.'
        );
      }
    });

    it('28. should maintain all login security checks (suspended account -> 403)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockSuspendedUser);

      await expect(
        authService.login({
          email: 'suspended.faculty@university.edu',
          password: 'ValidPass123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.login({
          email: 'suspended.faculty@university.edu',
          password: 'ValidPass123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe(
          'Your account has been deactivated. Please contact support.'
        );
      }
    });

    it('29. should maintain all login security checks (inactive account -> 403)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockInactiveUser);

      await expect(
        authService.login({
          email: 'inactive.admin@university.edu',
          password: 'ValidPass123!',
        })
      ).rejects.toThrow(AppError);

      try {
        await authService.login({
          email: 'inactive.admin@university.edu',
          password: 'ValidPass123!',
        });
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe(
          'Your account has been deactivated. Please contact support.'
        );
      }
    });

    it('30. should update lastLoginAt and preserve user role and verification invariants', async () => {
      const updateLoginSpy = jest
        .spyOn(authRepository, 'updateLastLogin')
        .mockResolvedValue(
          new User({
            ...mockActiveUser.toObject(),
            lastLoginAt: new Date(),
          })
        );
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);

      const result = await authService.login({
        email: 'jane.doe@university.edu',
        password: 'ValidPass123!',
      });

      expect(updateLoginSpy).toHaveBeenCalledWith(
        mockActiveUser._id,
        expect.any(Date)
      );
      expect(result.role).toBe(USER_ROLES.STUDENT);
      expect(result.isEmailVerified).toBe(true);
      expect(result.isPhoneVerified).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. HTTP ENDPOINT INTEGRATION (POST /api/v1/auth/login)
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/login with Access Token', () => {
    it('31. should return HTTP 200 with accessToken, tokenType, expiresIn, and sanitized user', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);
      jest
        .spyOn(authRepository, 'updateLastLogin')
        .mockResolvedValue(mockActiveUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'jane.doe@university.edu',
        password: 'ValidPass123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Authentication successful.');
      expect(res.body.data).toBeDefined();

      // Access Token assertions
      expect(res.body.data.accessToken).toBeDefined();
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.tokenType).toBe(JWT_ACCESS_TOKEN_TYPE);
      expect(res.body.data.expiresIn).toBe(config.jwt.accessExpiresIn || '15m');

      // Verify the returned JWT is valid
      const decoded = verifyAccessToken(res.body.data.accessToken);
      expect(decoded.sub).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
      expect(decoded.role).toBe(USER_ROLES.STUDENT);

      // Verify sanitized user fields in data
      expect(res.body.data.id).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
      expect(res.body.data.name).toBe('Jane Doe');
      expect(res.body.data.email).toBe('jane.doe@university.edu');
      expect(res.body.data.role).toBe(USER_ROLES.STUDENT);
      expect(res.body.data.status).toBe(ACCOUNT_STATUSES.ACTIVE);
      expect(res.body.data.isEmailVerified).toBe(true);
      expect(res.body.data.isPhoneVerified).toBe(true);

      // Security Invariants: No secrets leaked in response
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data.__v).toBeUndefined();
      expect(res.body.data.otp).toBeUndefined();
      expect(res.body.data.otpHash).toBeUndefined();
    });

    it('32. should NOT return refreshToken in JSON response body', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);
      jest
        .spyOn(authRepository, 'updateLastLogin')
        .mockResolvedValue(mockActiveUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'jane.doe@university.edu',
        password: 'ValidPass123!',
      });

      expect(res.status).toBe(200);

      // Scope Invariants: Refresh token is NEVER returned in JSON response body
      expect(res.body.data.refreshToken).toBeUndefined();
    });

    it('33. should return 401 Unauthorized for invalid login credentials', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'jane.doe@university.edu',
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
      expect(res.body.data).toBeUndefined();
      expect(res.body.accessToken).toBeUndefined();
    });

    it('34. should return 403 Forbidden for unverified account without emitting token', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockPendingUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'pending.student@university.edu',
        password: 'ValidPass123!',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Account not verified. Please verify your email with the OTP code.'
      );
      expect(res.body.data).toBeUndefined();
      expect(res.body.accessToken).toBeUndefined();
    });
  });
});
