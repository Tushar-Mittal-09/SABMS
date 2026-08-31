'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app/app');
const config = require('../../src/config/env.config');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const User = require('../../src/modules/users/user.model');
const authRepository = require('../../src/modules/auth/auth.repository');
const {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  decodeRefreshToken,
  generateJti,
  generateFamilyId,
  getRefreshTokenCookieOptions,
} = require('../../src/modules/auth/auth.helper');
const {
  JWT_DEFAULT_ISSUER,
  JWT_DEFAULT_AUDIENCE,
  JWT_REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_STATUSES,
} = require('../../src/modules/auth/auth.constants');
const { hashPassword } = require('../../src/services/password.service');

describe('Single-Use Refresh Token Rotation & Reuse Detection (Sprint 2.10)', () => {
  let validPasswordHash;
  let mockActiveUser;
  let mockPendingUser;
  let mockSuspendedUser;
  let mockInactiveUser;
  let inMemoryTokenMap;

  beforeAll(async () => {
    validPasswordHash = await hashPassword('ValidPass123!');
  });

  beforeEach(() => {
    inMemoryTokenMap = new Map();

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

    // In-memory simulation of RefreshToken repository operations
    jest
      .spyOn(authRepository, 'createRefreshToken')
      .mockImplementation(async (tokenData) => {
        const record = {
          _id: `id-${tokenData.jti}`,
          ...tokenData,
          status: tokenData.status || REFRESH_TOKEN_STATUSES.ACTIVE,
          issuedAt: tokenData.issuedAt || new Date(),
          consumedAt: null,
          revokedAt: null,
          revokedReason: null,
          replacedByTokenId: null,
          reuseDetectedAt: null,
          toObject: function () {
            return { ...this };
          },
        };
        inMemoryTokenMap.set(tokenData.jti, record);
        return record;
      });

    jest
      .spyOn(authRepository, 'findRefreshTokenByJti')
      .mockImplementation(async (jti) => {
        if (!jti) return null;
        return inMemoryTokenMap.get(jti) || null;
      });

    jest
      .spyOn(authRepository, 'findActiveRefreshToken')
      .mockImplementation(async (jti, familyId) => {
        const token = inMemoryTokenMap.get(jti);
        if (!token) return null;
        if (token.status !== REFRESH_TOKEN_STATUSES.ACTIVE) return null;
        if (familyId && token.familyId !== familyId) return null;
        return token;
      });

    jest
      .spyOn(authRepository, 'consumeRefreshToken')
      .mockImplementation(
        async (jti, familyId, replacedByTokenId = null, now = new Date()) => {
          const token = inMemoryTokenMap.get(jti);
          if (
            !token ||
            token.status !== REFRESH_TOKEN_STATUSES.ACTIVE ||
            token.familyId !== familyId
          ) {
            return null;
          }
          token.status = REFRESH_TOKEN_STATUSES.CONSUMED;
          token.consumedAt = now;
          token.replacedByTokenId = replacedByTokenId;
          return token;
        }
      );

    jest
      .spyOn(authRepository, 'markTokenAsReused')
      .mockImplementation(async (jti, reuseDetectedAt = new Date()) => {
        const token = inMemoryTokenMap.get(jti);
        if (!token) return null;
        token.status = REFRESH_TOKEN_STATUSES.REUSED;
        token.reuseDetectedAt = reuseDetectedAt;
        return token;
      });

    jest
      .spyOn(authRepository, 'revokeTokenFamily')
      .mockImplementation(
        async (
          familyId,
          reason = 'Refresh token reuse detected',
          revokedAt = new Date()
        ) => {
          let count = 0;
          for (const token of inMemoryTokenMap.values()) {
            if (
              token.familyId === familyId &&
              token.status !== REFRESH_TOKEN_STATUSES.REUSED
            ) {
              token.status = REFRESH_TOKEN_STATUSES.REVOKED;
              token.revokedAt = revokedAt;
              token.revokedReason = reason;
              count++;
            }
          }
          return { modifiedCount: count };
        }
      );

    jest
      .spyOn(authRepository, 'getTokensByFamily')
      .mockImplementation(async (familyId) => {
        const tokens = [];
        for (const token of inMemoryTokenMap.values()) {
          if (token.familyId === familyId) tokens.push(token);
        }
        return tokens;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // A. JWT GENERATION & CLAIMS
  // ───────────────────────────────────────────────────────────────────────────
  describe('A. JWT Generation & Claims', () => {
    it('1. Refresh token contains unique jti', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);
      expect(decoded.jti).toBeDefined();
      expect(typeof decoded.jti).toBe('string');
      expect(decoded.jti.length).toBeGreaterThan(10);
    });

    it('2. Refresh token contains familyId', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);
      expect(decoded.familyId).toBeDefined();
      expect(typeof decoded.familyId).toBe('string');
      expect(decoded.familyId.length).toBeGreaterThan(10);
    });

    it('3. Refresh token contains type=refresh', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);
      expect(decoded.type).toBe('refresh');
    });

    it('4. Refresh token contains sub (user ID)', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);
      expect(decoded.sub).toBe('64a7f8e9c1d2e3f4a5b6c7d8');
    });

    it('5. Refresh token contains iat', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);
      expect(decoded.iat).toBeDefined();
      expect(typeof decoded.iat).toBe('number');
    });

    it('6. Refresh token contains exp', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('7. Refresh token contains iss', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);
      expect(decoded.iss).toBe(config.jwt.issuer || JWT_DEFAULT_ISSUER);
    });

    it('8. Refresh token contains aud', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = verifyRefreshToken(token);
      expect(decoded.aud).toBe(config.jwt.audience || JWT_DEFAULT_AUDIENCE);
    });

    it('9. Refresh token does not contain password', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = decodeRefreshToken(token);
      expect(decoded.password).toBeUndefined();
    });

    it('10. Refresh token does not contain passwordHash', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = decodeRefreshToken(token);
      expect(decoded.passwordHash).toBeUndefined();
    });

    it('11. Refresh token does not contain OTP', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = decodeRefreshToken(token);
      expect(decoded.otp).toBeUndefined();
    });

    it('12. Refresh token does not contain OTP hash', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = decodeRefreshToken(token);
      expect(decoded.otpHash).toBeUndefined();
    });

    it('13. Refresh token does not contain JWT secret', () => {
      const token = generateRefreshToken(mockActiveUser);
      const decoded = decodeRefreshToken(token);
      expect(decoded.secret).toBeUndefined();
      expect(decoded.jwtSecret).toBeUndefined();
    });

    it('14. jti is cryptographically random and unique across generations', () => {
      const jti1 = generateJti();
      const jti2 = generateJti();
      expect(jti1).not.toBe(jti2);
      expect(typeof jti1).toBe('string');
      expect(typeof jti2).toBe('string');
    });

    it('15. familyId is cryptographically random and unique across generations', () => {
      const family1 = generateFamilyId();
      const family2 = generateFamilyId();
      expect(family1).not.toBe(family2);
      expect(typeof family1).toBe('string');
      expect(typeof family2).toBe('string');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B. LOGIN FAMILY CREATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('B. Login Family Creation', () => {
    it('16. Successful login creates a new refresh-token family', async () => {
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
      expect(inMemoryTokenMap.size).toBe(1);

      const storedToken = Array.from(inMemoryTokenMap.values())[0];
      expect(storedToken.familyId).toBeDefined();
      expect(storedToken.jti).toBeDefined();
      expect(storedToken.status).toBe(REFRESH_TOKEN_STATUSES.ACTIVE);
    });

    it('17. Successful login persists the initial refresh token as ACTIVE', async () => {
      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(mockActiveUser);
      jest
        .spyOn(authRepository, 'updateLastLogin')
        .mockResolvedValue(mockActiveUser);

      await request(app).post('/api/v1/auth/login').send({
        email: 'jane.doe@university.edu',
        password: 'ValidPass123!',
      });

      const storedToken = Array.from(inMemoryTokenMap.values())[0];
      expect(storedToken.status).toBe('ACTIVE');
      expect(storedToken.consumedAt).toBeNull();
      expect(storedToken.revokedAt).toBeNull();
    });

    it('18. Login response does not expose refresh token', async () => {
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

      expect(res.body.data.refreshToken).toBeUndefined();
    });

    it('19. Login response does not expose jti', async () => {
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

      expect(res.body.data.jti).toBeUndefined();
      expect(res.body.data.tokenId).toBeUndefined();
    });

    it('20. Login response does not expose familyId', async () => {
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

      expect(res.body.data.familyId).toBeUndefined();
    });

    it('21. Refresh cookie is HttpOnly', async () => {
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

      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/HttpOnly/i);
    });

    it('22. Refresh cookie has correct SameSite', async () => {
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

      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/SameSite=Strict/i);
    });

    it('23. Refresh cookie has correct path (/api/v1/auth/refresh)', async () => {
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

      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/Path=\/api\/v1\/auth\/refresh/i);
    });

    it('24. Refresh cookie is secure in production configuration', () => {
      const prodOptions = getRefreshTokenCookieOptions({ secure: true });
      expect(prodOptions.secure).toBe(true);

      const devOptions = getRefreshTokenCookieOptions({ secure: false });
      expect(devOptions.secure).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // C. NORMAL ROTATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('C. Normal Single-Use Rotation', () => {
    it('25-33. Valid refresh token rotates: issues new access token, sets replacement cookie, marks old as CONSUMED, persists new as ACTIVE in same family with distinct jti', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);

      // 1. Setup initial active token in family F1
      const jti1 = 'jti-initial-1';
      const familyId1 = 'family-f1';
      const token1 = generateRefreshToken(mockActiveUser, {
        jti: jti1,
        familyId: familyId1,
      });

      await authRepository.createRefreshToken({
        jti: jti1,
        familyId: familyId1,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // 2. Perform rotation request
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token1}`]);

      // 25. Valid refresh token returns new access token
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      // 26. Valid refresh token returns a new refresh cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const newCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));
      expect(newCookie).toBeDefined();

      const newRawToken = newCookie.split(';')[0].split('=')[1];
      expect(newRawToken).not.toBe(token1);

      const decodedNew = verifyRefreshToken(newRawToken);

      // 27. Old refresh token becomes CONSUMED
      const oldStored = inMemoryTokenMap.get(jti1);
      expect(oldStored.status).toBe(REFRESH_TOKEN_STATUSES.CONSUMED);
      expect(oldStored.consumedAt).toBeInstanceOf(Date);
      expect(oldStored.replacedByTokenId).toBe(decodedNew.jti);

      // 28. New refresh token becomes ACTIVE in persistent storage
      const newStored = inMemoryTokenMap.get(decodedNew.jti);
      expect(newStored).toBeDefined();
      expect(newStored.status).toBe(REFRESH_TOKEN_STATUSES.ACTIVE);

      // 29. New token belongs to SAME family
      expect(decodedNew.familyId).toBe(familyId1);
      expect(newStored.familyId).toBe(familyId1);

      // 30. New token has a different jti
      expect(decodedNew.jti).not.toBe(jti1);

      // 31. New token has a different JWT string
      expect(newRawToken).not.toBe(token1);

      // 32. Access token is cryptographically valid
      const decodedAccess = verifyAccessToken(res.body.data.accessToken);
      expect(decodedAccess.sub).toBe('64a7f8e9c1d2e3f4a5b6c7d8');

      // 33. Refresh token is never returned in JSON
      expect(res.body.data.refreshToken).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // D. SINGLE-USE ENFORCEMENT & REUSE DETECTION
  // ───────────────────────────────────────────────────────────────────────────
  describe('D. Single-Use Enforcement & Reuse Detection', () => {
    it('34-40. Replaying a consumed token triggers reuse detection, revokes the entire family, clears cookie, and returns 401', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);

      // 1. Initial State: R1 in family F1
      const jti1 = 'jti-replay-1';
      const familyId = 'family-reuse-test';
      const token1 = generateRefreshToken(mockActiveUser, {
        jti: jti1,
        familyId,
      });

      await authRepository.createRefreshToken({
        jti: jti1,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // 2. Legitimate Refresh R1 -> R2
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;
      const res1 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token1}`]);

      expect(res1.status).toBe(200);

      const cookieHeader = res1.headers['set-cookie'][0];
      const token2 = cookieHeader.split(';')[0].split('=')[1];
      const decoded2 = verifyRefreshToken(token2);
      const jti2 = decoded2.jti;

      // Invariant: R1 is now CONSUMED, R2 is ACTIVE
      expect(inMemoryTokenMap.get(jti1).status).toBe(
        REFRESH_TOKEN_STATUSES.CONSUMED
      );
      expect(inMemoryTokenMap.get(jti2).status).toBe(
        REFRESH_TOKEN_STATUSES.ACTIVE
      );

      // 3. ATTACKER REPLAYS CONSUMED R1!
      const replayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token1}`]);

      // 36. Reuse detection returns 401 Unauthorized
      expect(replayRes.status).toBe(401);
      expect(replayRes.body.success).toBe(false);
      expect(replayRes.body.message).toMatch(
        /Refresh token reuse detected\. Please authenticate again\./i
      );

      // 37. Does not issue an access token
      expect(replayRes.body.data).toBeUndefined();
      expect(replayRes.body.accessToken).toBeUndefined();

      // 38. Does not issue a replacement refresh token
      // 81. Clears refresh cookie on reuse
      const replayCookies = replayRes.headers['set-cookie'];
      expect(replayCookies).toBeDefined();
      const clearedCookie = replayCookies.find((c) =>
        c.startsWith(`${cookieName}=;`)
      );
      expect(clearedCookie).toBeDefined();

      // 39. Revokes the entire family F1
      const replayedTokenRecord = inMemoryTokenMap.get(jti1);
      expect(replayedTokenRecord.status).toBe(REFRESH_TOKEN_STATUSES.REUSED);
      expect(replayedTokenRecord.reuseDetectedAt).toBeInstanceOf(Date);

      // 40. All active family tokens (R2) become REVOKED
      const legitimateToken2Record = inMemoryTokenMap.get(jti2);
      expect(legitimateToken2Record.status).toBe(
        REFRESH_TOKEN_STATUSES.REVOKED
      );
      expect(legitimateToken2Record.revokedAt).toBeInstanceOf(Date);
      expect(legitimateToken2Record.revokedReason).toMatch(/reuse detected/i);

      // Subsequent attempt using legitimate R2 must also now be rejected
      const attemptWithR2 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token2}`]);

      expect(attemptWithR2.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // E. ROTATION CHAIN (R1 -> R2 -> R3)
  // ───────────────────────────────────────────────────────────────────────────
  describe('E. Multi-Step Rotation Chain (R1 -> R2 -> R3)', () => {
    it('41-45. Chains rotations correctly: R1->R2->R3; previous tokens are consumed; only the leaf token remains active', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      // 1. Seed R1
      const jti1 = 'chain-jti-1';
      const familyId = 'chain-family-123';
      const token1 = generateRefreshToken(mockActiveUser, {
        jti: jti1,
        familyId,
      });

      await authRepository.createRefreshToken({
        jti: jti1,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // 41. R1 -> R2
      const res1 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token1}`]);

      expect(res1.status).toBe(200);
      const token2 = res1.headers['set-cookie'][0].split(';')[0].split('=')[1];
      const jti2 = verifyRefreshToken(token2).jti;

      expect(inMemoryTokenMap.get(jti1).status).toBe(
        REFRESH_TOKEN_STATUSES.CONSUMED
      );
      expect(inMemoryTokenMap.get(jti2).status).toBe(
        REFRESH_TOKEN_STATUSES.ACTIVE
      );

      // 42. R2 -> R3
      const res2 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token2}`]);

      expect(res2.status).toBe(200);
      const token3 = res2.headers['set-cookie'][0].split(';')[0].split('=')[1];
      const jti3 = verifyRefreshToken(token3).jti;

      expect(inMemoryTokenMap.get(jti1).status).toBe(
        REFRESH_TOKEN_STATUSES.CONSUMED
      );
      expect(inMemoryTokenMap.get(jti2).status).toBe(
        REFRESH_TOKEN_STATUSES.CONSUMED
      );
      expect(inMemoryTokenMap.get(jti3).status).toBe(
        REFRESH_TOKEN_STATUSES.ACTIVE
      );

      // 43. R1 cannot be used after R2/R3 was issued (triggers reuse)
      const resReplayR1 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token1}`]);

      expect(resReplayR1.status).toBe(401);

      // 44. All tokens in the family are now revoked because R1 was replayed
      expect(inMemoryTokenMap.get(jti3).status).toBe(
        REFRESH_TOKEN_STATUSES.REVOKED
      );

      // 45. R3 cannot be used anymore because family was revoked
      const resR3 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token3}`]);
      expect(resR3.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // F. CONCURRENT ROTATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('F. Concurrent Rotation Race Protection', () => {
    it('46-50. Concurrent refresh requests on the same active token cannot both succeed; at most one consumes it, replay is detected, and family is protected', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const jti = 'concurrent-jti-1';
      const familyId = 'concurrent-family-1';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Dispatch 2 concurrent refresh requests with the EXACT same token
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', [`${cookieName}=${token}`]),
        request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', [`${cookieName}=${token}`]),
      ]);

      const statuses = [resA.status, resB.status];

      // 46. Two concurrent refresh requests cannot both succeed
      expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(1);

      // 47. At most one request consumes the token or reuse is detected
      const has401 = statuses.includes(401);
      expect(has401).toBe(true);

      // 48-50. Token in persistence is not in inconsistent state
      const finalState = inMemoryTokenMap.get(jti);
      expect(
        finalState.status === REFRESH_TOKEN_STATUSES.CONSUMED ||
          finalState.status === REFRESH_TOKEN_STATUSES.REUSED ||
          finalState.status === REFRESH_TOKEN_STATUSES.REVOKED
      ).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // G. FAMILY REVOCATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('G. Family Revocation', () => {
    it('51-55. Revoking a family invalidates all its tokens and preserves auditable evidence in persistence', async () => {
      const familyId = 'family-audit-test';
      const jtiA = 'token-a';
      const jtiB = 'token-b';

      await authRepository.createRefreshToken({
        jti: jtiA,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await authRepository.createRefreshToken({
        jti: jtiB,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Revoke family
      await authRepository.revokeTokenFamily(
        familyId,
        'Administrative session termination'
      );

      // 51. Invalidate all active tokens
      const tokens = await authRepository.getTokensByFamily(familyId);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].status).toBe(REFRESH_TOKEN_STATUSES.REVOKED);
      expect(tokens[1].status).toBe(REFRESH_TOKEN_STATUSES.REVOKED);

      // 54. Revocation state persists
      expect(tokens[0].revokedAt).toBeInstanceOf(Date);
      expect(tokens[0].revokedReason).toBe(
        'Administrative session termination'
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // H. ACCOUNT STATE VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('H. Account State Validation', () => {
    it('56. Active verified user can refresh', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const jti = 'active-user-jti';
      const familyId = 'active-family';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('57. Unverified user cannot refresh (returns 403 Forbidden)', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockPendingUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const jti = 'unverified-user-jti';
      const familyId = 'unverified-family';
      const token = generateRefreshToken(mockPendingUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockPendingUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Account not verified/i);
    });

    it('58. Suspended user cannot refresh (returns 403 Forbidden)', async () => {
      jest
        .spyOn(authRepository, 'findById')
        .mockResolvedValue(mockSuspendedUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const jti = 'suspended-user-jti';
      const familyId = 'suspended-family';
      const token = generateRefreshToken(mockSuspendedUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockSuspendedUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/deactivated/i);
    });

    it('59. Inactive user cannot refresh (returns 403 Forbidden)', async () => {
      jest
        .spyOn(authRepository, 'findById')
        .mockResolvedValue(mockInactiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const jti = 'inactive-user-jti';
      const familyId = 'inactive-family';
      const token = generateRefreshToken(mockInactiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockInactiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/deactivated/i);
    });

    it('60. Deleted / non-existent user cannot refresh (returns 401 Unauthorized)', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(null);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const token = generateRefreshToken(mockActiveUser);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Invalid or expired refresh token/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // I. TOKEN VALIDATION & SECURITY
  // ───────────────────────────────────────────────────────────────────────────
  describe('I. Strict Token Validation & Pinning', () => {
    it('61. Expired refresh token rejected', async () => {
      const expiredToken = generateRefreshToken(mockActiveUser, {
        expiresIn: '-1s',
      });
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${expiredToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/expired/i);
    });

    it('62. Invalid signature rejected', async () => {
      const forgedToken = generateRefreshToken(mockActiveUser, {
        secret: 'invalid-attacker-secret-key-1234567',
      });
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${forgedToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Invalid refresh token/i);
    });

    it('63. Wrong secret rejected (access secret presented for refresh)', async () => {
      const accessSignedToken = generateRefreshToken(mockActiveUser, {
        secret: config.jwt.accessSecret,
      });
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${accessSignedToken}`]);

      expect(res.status).toBe(401);
    });

    it('64. Wrong issuer rejected', async () => {
      const wrongIssToken = generateRefreshToken(mockActiveUser, {
        issuer: 'untrusted-rogue-issuer',
      });
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${wrongIssToken}`]);

      expect(res.status).toBe(401);
    });

    it('65. Wrong audience rejected', async () => {
      const wrongAudToken = generateRefreshToken(mockActiveUser, {
        audience: 'untrusted-rogue-audience',
      });
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${wrongAudToken}`]);

      expect(res.status).toBe(401);
    });

    it('66. alg:none rejected', () => {
      const noneToken = jwt.sign(
        {
          sub: '64a7f8e9c1d2e3f4a5b6c7d8',
          jti: 'none-jti',
          familyId: 'none-family',
          type: 'refresh',
        },
        '',
        { algorithm: 'none' }
      );

      expect(() => verifyRefreshToken(noneToken)).toThrow();
    });

    it('67. HS384 rejected when HS256 is pinned', () => {
      const hs384Token = jwt.sign(
        {
          sub: '64a7f8e9c1d2e3f4a5b6c7d8',
          jti: 'hs384-jti',
          familyId: 'hs384-family',
          type: 'refresh',
        },
        config.jwt.refreshSecret,
        { algorithm: 'HS384' }
      );

      expect(() => verifyRefreshToken(hs384Token)).toThrow();
    });

    it('68. RS256 rejected when HS256 is pinned', () => {
      const invalidToken =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature';
      expect(() => verifyRefreshToken(invalidToken)).toThrow();
    });

    it('69. Access token presented as refresh token rejected', async () => {
      const accessToken = generateAccessToken(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${accessToken}`]);

      expect(res.status).toBe(401);
    });

    it('70. Wrong token type rejected (type=email_verification)', () => {
      const wrongTypeToken = jwt.sign(
        {
          sub: '64a7f8e9c1d2e3f4a5b6c7d8',
          jti: 'jti-1',
          familyId: 'family-1',
          type: 'EMAIL_VERIFICATION',
        },
        config.jwt.refreshSecret,
        {
          algorithm: 'HS256',
          issuer: config.jwt.issuer || JWT_DEFAULT_ISSUER,
          audience: config.jwt.audience || JWT_DEFAULT_AUDIENCE,
        }
      );

      expect(() => verifyRefreshToken(wrongTypeToken)).toThrow(
        /Invalid token type/i
      );
    });

    it('71. Missing jti in payload rejected', () => {
      const noJtiToken = jwt.sign(
        {
          sub: '64a7f8e9c1d2e3f4a5b6c7d8',
          familyId: 'family-1',
          type: 'refresh',
        },
        config.jwt.refreshSecret,
        {
          algorithm: 'HS256',
          issuer: config.jwt.issuer || JWT_DEFAULT_ISSUER,
          audience: config.jwt.audience || JWT_DEFAULT_AUDIENCE,
        }
      );

      expect(() => verifyRefreshToken(noJtiToken)).toThrow(/missing jti/i);
    });

    it('72. Missing familyId in payload rejected', () => {
      const noFamilyToken = jwt.sign(
        {
          sub: '64a7f8e9c1d2e3f4a5b6c7d8',
          jti: 'jti-1',
          type: 'refresh',
        },
        config.jwt.refreshSecret,
        {
          algorithm: 'HS256',
          issuer: config.jwt.issuer || JWT_DEFAULT_ISSUER,
          audience: config.jwt.audience || JWT_DEFAULT_AUDIENCE,
        }
      );

      expect(() => verifyRefreshToken(noFamilyToken)).toThrow(
        /missing.*familyId/i
      );
    });

    it('73. Malformed token rejected', () => {
      expect(() => verifyRefreshToken('not-a-real-jwt')).toThrow();
      expect(() => verifyRefreshToken('')).toThrow();
      expect(() => verifyRefreshToken(null)).toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // J. COOKIE SECURITY & TRANSPORT
  // ───────────────────────────────────────────────────────────────────────────
  describe('J. Cookie Security & Transport', () => {
    it('74. Refresh token is never placed in JSON on refresh', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const jti = 'cookie-check-jti';
      const familyId = 'cookie-check-family';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.refreshToken).toBeUndefined();
    });

    it('77. Cookie remains HttpOnly across rotation', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const jti = 'httponly-check-jti';
      const familyId = 'httponly-family';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/HttpOnly/i);
    });

    it('78. Cookie remains SameSite=Strict across rotation', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const jti = 'samesite-check-jti';
      const familyId = 'samesite-family';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/SameSite=Strict/i);
    });

    it('79. Cookie path remains /api/v1/auth/refresh', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const jti = 'path-check-jti';
      const familyId = 'path-family';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/Path=\/api\/v1\/auth\/refresh/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // K. INFORMATION DISCLOSURE PREVENTION
  // ───────────────────────────────────────────────────────────────────────────
  describe('K. Information Disclosure Prevention', () => {
    it('86. No jti or familyId in public responses', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const jti = 'info-check-jti';
      const familyId = 'info-family';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(res.body.data.jti).toBeUndefined();
      expect(res.body.data.familyId).toBeUndefined();
      expect(res.body.data.tokenId).toBeUndefined();
    });

    it('87. Database errors are masked in public error responses', async () => {
      jest
        .spyOn(authRepository, 'findById')
        .mockRejectedValue(new Error('MongoNetworkError: connection closed'));
      const cookieName =
        config.jwt.refreshCookieName || JWT_REFRESH_COOKIE_NAME;

      const token = generateRefreshToken(mockActiveUser);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(res.status).toBe(500);
      expect(res.body.message).not.toMatch(/MongoNetworkError/i);
      expect(res.body.message).not.toMatch(/connection closed/i);
    });
  });
});
