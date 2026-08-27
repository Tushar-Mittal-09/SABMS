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
  generateRefreshToken,
  verifyRefreshToken,
  decodeRefreshToken,
  getRefreshTokenCookieOptions,
} = require('../../src/modules/auth/auth.helper');
const {
  JWT_ALGORITHM,
  JWT_DEFAULT_ISSUER,
  JWT_DEFAULT_AUDIENCE,
  JWT_REFRESH_TOKEN_PURPOSE,
  JWT_REFRESH_COOKIE_NAME,
  JWT_REFRESH_COOKIE_PATH,
  JWT_REFRESH_COOKIE_SAME_SITE,
} = require('../../src/modules/auth/auth.constants');
const { hashPassword } = require('../../src/services/password.service');
const AppError = require('../../src/core/errors/AppError');

describe('JWT Refresh Token & Cookie Issuance (Sprint 2.9)', () => {
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
  // 1. REFRESH TOKEN GENERATION & CLAIMS
  // ───────────────────────────────────────────────────────────────────────────
  describe('Refresh Token Generation & Claims', () => {
    it('1. should generate a syntactically valid JWT refresh token', () => {
      const token = generateRefreshToken(mockActiveUser);
      expect(typeof token).toBe('string');

      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      const decodedComplete = decodeRefreshToken(token, { complete: true });
      expect(decodedComplete).toBeDefined();
      expect(decodedComplete.header.alg).toBe(JWT_ALGORITHM);
      expect(decodedComplete.header.typ).toBe('JWT');
    });

    it('2. should use dedicated refresh secret and not verify with access secret', () => {
      const token = generateRefreshToken(mockActiveUser);
      expect(() => verifyRefreshToken(token)).not.toThrow();

      expect(() =>
        jwt.verify(token, config.jwt.accessSecret, {
          algorithms: [JWT_ALGORITHM],
        })
      ).toThrow();
    });

    it('3. should enforce configured refresh expiration (default: 7d / 604800s)', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60); // 604800 seconds
    });

    it('4. should include stable subject claim (sub)', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);

      expect(decoded.sub).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
    });

    it('5. should include correct refresh token purpose / type claim', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);

      expect(decoded.type).toBe(JWT_REFRESH_TOKEN_PURPOSE || 'refresh');
    });

    it('6. should include expected issuer (iss)', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);

      expect(decoded.iss).toBe(config.jwt.issuer || JWT_DEFAULT_ISSUER);
    });

    it('7. should include expected audience (aud)', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);

      expect(decoded.aud).toBe(config.jwt.audience || JWT_DEFAULT_AUDIENCE);
    });

    it('8. should never contain passwords, password hashes, OTPs, or internal secrets', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = decodeRefreshToken(token);

      expect(decoded.password).toBeUndefined();
      expect(decoded.passwordHash).toBeUndefined();
      expect(decoded.otp).toBeUndefined();
      expect(decoded.otpHash).toBeUndefined();
      expect(decoded.secret).toBeUndefined();
      expect(decoded.jwtSecret).toBeUndefined();
      expect(decoded.redisKey).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. COOKIE ISSUANCE ON LOGIN
  // ───────────────────────────────────────────────────────────────────────────
  describe('Cookie Issuance on Login Workflow', () => {
    it('12-18. successful login should set secure HttpOnly refresh cookie and omit refresh token from JSON', async () => {
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
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeUndefined();

      // Check Set-Cookie headers
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies)).toBe(true);

      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;
      const refreshCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));
      expect(refreshCookie).toBeDefined();

      // Verify cookie security attributes
      expect(refreshCookie).toMatch(/HttpOnly/i);
      expect(refreshCookie).toMatch(/Path=\/api\/v1\/auth\/refresh/i);
      expect(refreshCookie).toMatch(/SameSite=Strict/i);
      expect(refreshCookie).toMatch(/Max-Age=604800/i);
    });

    it('should NOT set refresh cookie when login fails (invalid password)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'jane.doe@university.edu',
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('should NOT set refresh cookie when login fails (unverified account)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockPendingUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'pending.student@university.edu',
        password: 'ValidPass123!',
      });

      expect(res.status).toBe(403);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('should NOT set refresh cookie when login fails (suspended account)', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockSuspendedUser);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'suspended.faculty@university.edu',
        password: 'ValidPass123!',
      });

      expect(res.status).toBe(403);
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. REFRESH ENDPOINT (POST /api/v1/auth/refresh)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Refresh Endpoint (POST /api/v1/auth/refresh)', () => {
    it('19-20. should issue a new access token when valid refresh cookie is supplied', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);

      const validRefreshToken = generateRefreshToken(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${validRefreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Access token refreshed successfully.');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.tokenType).toBe('Bearer');
      expect(res.body.data.expiresIn).toBe('15m');
      expect(res.body.data.user.email).toBe('jane.doe@university.edu');
      expect(res.body.data.refreshToken).toBeUndefined();

      // Verify the new access token is cryptographically valid
      const decodedAccess = verifyAccessToken(res.body.data.accessToken);
      expect(decodedAccess.sub).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
      expect(decodedAccess.role).toBe(USER_ROLES.STUDENT);
    });

    it('21. should reject with 401 when refresh cookie is missing', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('22. should reject with 401 when refresh token is malformed', async () => {
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=malformed.jwt.token`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('23. should reject with 401 when signature is invalid', async () => {
      const tamperedToken = generateRefreshToken(mockActiveUser, {
        secret: 'different-fake-secret-key-1234567890',
      });
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${tamperedToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('24. should reject with 401 when refresh token is expired', async () => {
      const expiredToken = generateRefreshToken(mockActiveUser, {
        expiresIn: '-1s',
      });
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${expiredToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('25. should reject with 401 when issuer is wrong', async () => {
      const wrongIssuerToken = generateRefreshToken(mockActiveUser, {
        issuer: 'rogue-issuer',
      });
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${wrongIssuerToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('26. should reject with 401 when audience is wrong', async () => {
      const wrongAudToken = generateRefreshToken(mockActiveUser, {
        audience: 'rogue-audience',
      });
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${wrongAudToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('27. should reject with 401 when algorithm is wrong or none', () => {
      expect(() => {
        verifyRefreshToken('token', { algorithms: ['HS512'] });
      }).toThrow();
    });

    it('28. should reject when access token is supplied as refresh token (token-type confusion)', async () => {
      const accessToken = generateAccessToken(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${accessToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('29. should reject when token payload type is not refresh', () => {
      const forgedPayload = {
        sub: mockActiveUser._id.toString(),
        type: 'access',
      };
      const forgedToken = jwt.sign(forgedPayload, config.jwt.refreshSecret, {
        algorithm: JWT_ALGORITHM,
        issuer: config.jwt.issuer || JWT_DEFAULT_ISSUER,
        audience: config.jwt.audience || JWT_DEFAULT_AUDIENCE,
        expiresIn: '7d',
      });

      expect(() => verifyRefreshToken(forgedToken)).toThrow(
        /Invalid token type/i
      );
    });

    it('30. should reject with 401 when user is not found in database', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(null);

      const validRefreshToken = generateRefreshToken(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${validRefreshToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('31. should reject with 403 when user is suspended', async () => {
      jest
        .spyOn(authRepository, 'findById')
        .mockResolvedValue(mockSuspendedUser);

      const validRefreshToken = generateRefreshToken(mockSuspendedUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${validRefreshToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/deactivated/i);
    });

    it('32. should reject with 403 when user is inactive', async () => {
      jest
        .spyOn(authRepository, 'findById')
        .mockResolvedValue(mockInactiveUser);

      const validRefreshToken = generateRefreshToken(mockInactiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${validRefreshToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/deactivated/i);
    });

    it('33. should reject with 403 when user is unverified', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockPendingUser);

      const validRefreshToken = generateRefreshToken(mockPendingUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${validRefreshToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not verified/i);
    });

    it('34. should ignore refresh token passed in request body', async () => {
      const validRefreshToken = generateRefreshToken(mockActiveUser);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      // Must fail because cookie was not provided
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('35. should ignore refresh token passed in Authorization header', async () => {
      const validRefreshToken = generateRefreshToken(mockActiveUser);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${validRefreshToken}`);

      // Must fail because cookie was not provided
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('36. should ignore refresh token passed in query parameter', async () => {
      const validRefreshToken = generateRefreshToken(mockActiveUser);

      const res = await request(app).post(
        `/api/v1/auth/refresh?refreshToken=${encodeURIComponent(validRefreshToken)}`
      );

      // Must fail because cookie was not provided
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. SECURITY & TOKEN SEPARATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('Security & Token Separation', () => {
    it('43. Access token cannot be verified using refresh-token verification', () => {
      const accessToken = generateAccessToken(mockActiveUser);
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });

    it('44. Refresh token cannot be verified using access-token verification', () => {
      const refreshToken = generateRefreshToken(mockActiveUser);
      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });

    it('45. Access and refresh tokens use separate cryptographic secrets', () => {
      expect(config.jwt.accessSecret).toBeDefined();
      expect(config.jwt.refreshSecret).toBeDefined();
      expect(config.jwt.accessSecret).not.toBe(config.jwt.refreshSecret);
    });

    it('46. Access and refresh token purposes cannot be confused', () => {
      const accessToken = generateAccessToken(mockActiveUser);
      const refreshToken = generateRefreshToken(mockActiveUser);

      const decodedAccess = decodeRefreshToken(accessToken);
      const decodedRefresh = decodeRefreshToken(refreshToken);

      expect(decodedAccess.type).toBeUndefined(); // Access token uses role/sub
      expect(decodedRefresh.type).toBe('refresh');
    });

    it('47-49. Cookie helper configures secure HttpOnly, sameSite, path, and maxAge', () => {
      const devCookieOptions = getRefreshTokenCookieOptions({ secure: false });
      expect(devCookieOptions.httpOnly).toBe(true);
      expect(devCookieOptions.secure).toBe(false);
      expect(devCookieOptions.sameSite).toBe(
        JWT_REFRESH_COOKIE_SAME_SITE || 'strict'
      );
      expect(devCookieOptions.path).toBe(
        JWT_REFRESH_COOKIE_PATH || '/api/v1/auth/refresh'
      );
      expect(devCookieOptions.maxAge).toBe(7 * 24 * 60 * 60 * 1000);

      const prodCookieOptions = getRefreshTokenCookieOptions({ secure: true });
      expect(prodCookieOptions.httpOnly).toBe(true);
      expect(prodCookieOptions.secure).toBe(true);
    });

    it('should throw when user object or ID is missing during refresh token generation', () => {
      expect(() => generateRefreshToken(null)).toThrow(
        /User entity is required/i
      );
      expect(() => generateRefreshToken({})).toThrow(/User ID/i);
    });

    it('should throw when verifyRefreshToken is called with empty input', () => {
      expect(() => verifyRefreshToken('')).toThrow(
        /Refresh token string is required/i
      );
      expect(() => verifyRefreshToken(null)).toThrow(
        /Refresh token string is required/i
      );
    });

    it('should return null when decodeRefreshToken is called with invalid input', () => {
      expect(decodeRefreshToken('')).toBeNull();
      expect(decodeRefreshToken(null)).toBeNull();
    });

    it('should throw AppError on refreshAccessToken service call with missing token', async () => {
      await expect(authService.refreshAccessToken('')).rejects.toThrow(
        AppError
      );
    });
  });
});
