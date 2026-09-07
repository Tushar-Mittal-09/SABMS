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
  generateRefreshToken,
  getRefreshTokenCookieOptions,
} = require('../../src/modules/auth/auth.helper');
const {
  JWT_DEFAULT_ISSUER,
  JWT_DEFAULT_AUDIENCE,
  JWT_REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_STATUSES,
  REFRESH_TOKEN_REVOCATION_REASONS,
} = require('../../src/modules/auth/auth.constants');
const { hashPassword } = require('../../src/services/password.service');
const AppError = require('../../src/core/errors/AppError');
const logger = require('../../src/core/logger');

describe('Logout & Token/Session Invalidation (Sprint 2.11)', () => {
  let validPasswordHash;
  let mockActiveUser;
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
        async (familyId, reason = 'USER_LOGOUT', revokedAt = new Date()) => {
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

    jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);

    jest
      .spyOn(authRepository, 'revokeAllUserSessionsExcept')
      .mockImplementation(async (userId, currentFamilyId) => {
        let count = 0;
        for (const token of inMemoryTokenMap.values()) {
          if (
            String(token.userId) === String(userId) &&
            token.familyId !== currentFamilyId &&
            token.status === REFRESH_TOKEN_STATUSES.ACTIVE
          ) {
            token.status = REFRESH_TOKEN_STATUSES.REVOKED;
            count++;
          }
        }
        return { modifiedCount: count };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const cookieName =
    config.jwt?.refreshCookieName || JWT_REFRESH_COOKIE_NAME || 'refreshToken';

  // ───────────────────────────────────────────────────────────────────────────
  // A. ROUTING
  // ───────────────────────────────────────────────────────────────────────────
  describe('A. Routing', () => {
    it('1. POST /api/v1/auth/logout route is mounted and accessible', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2. Correct controller handler is invoked for logout', async () => {
      const logoutSpy = jest.spyOn(authService, 'logout');
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });

    it('3. GET /api/v1/auth/logout is rejected (404 or 405)', async () => {
      const res = await request(app).get('/api/v1/auth/logout');
      expect(res.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B. MISSING COOKIE (IDEMPOTENT LOGOUT)
  // ───────────────────────────────────────────────────────────────────────────
  describe('B. Missing Cookie (Idempotent Logout)', () => {
    it('4. Logout without cookie succeeds with HTTP 200', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');
    });

    it('5. Clear-Cookie header is sent even when incoming cookie is absent', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cleared = cookies.find((c) => c.startsWith(`${cookieName}=;`));
      expect(cleared).toBeDefined();
    });

    it('6. No database mutation occurs when cookie is missing', async () => {
      const revokeSpy = jest.spyOn(authRepository, 'revokeTokenFamily');
      await request(app).post('/api/v1/auth/logout');
      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('7. No new token is generated on missing cookie logout', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.body.data).toBeNull();
      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // C. VALID TOKEN LOGOUT
  // ───────────────────────────────────────────────────────────────────────────
  describe('C. Valid Token Logout', () => {
    it('8-15. Valid refresh token in cookie revokes the family, clears cookie, and returns HTTP 200 envelope', async () => {
      const jti = 'jti-valid-logout-1';
      const familyId = 'family-valid-logout-1';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);

      // 8. Accepted
      // 14. HTTP 200 returned
      expect(res.status).toBe(200);

      // 15. Standard response envelope
      expect(res.body).toEqual({
        success: true,
        message: 'Logged out successfully',
        data: null,
        meta: null,
      });

      // 12. Correct family is revoked
      const stored = inMemoryTokenMap.get(jti);
      expect(stored.status).toBe(REFRESH_TOKEN_STATUSES.REVOKED);
      expect(stored.revokedReason).toBe('USER_LOGOUT');
      expect(stored.revokedAt).toBeInstanceOf(Date);

      // 13. Cookie is cleared
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cleared = cookies.find((c) => c.startsWith(`${cookieName}=;`));
      expect(cleared).toBeDefined();
    });

    it('9-11. Token is cryptographically verified and jti/familyId extracted only after verification', async () => {
      const jti = 'jti-verify-check';
      const familyId = 'family-verify-check';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const findSpy = jest.spyOn(authRepository, 'findRefreshTokenByJti');
      const revokeSpy = jest.spyOn(authRepository, 'revokeTokenFamily');

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(findSpy).toHaveBeenCalledWith(jti);
      expect(revokeSpy).toHaveBeenCalledWith(familyId, 'USER_LOGOUT');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // D. FAMILY REVOCATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('D. Family-Wide Revocation', () => {
    it('16-20. Revokes entire active family including consumed siblings and leaves unrelated families untouched', async () => {
      const family1 = 'family-chain-logout-1';
      const family2 = 'family-unrelated-2';

      // Family 1: T1 (consumed) -> T2 (consumed) -> T3 (active)
      const jti1 = 'chain-t1';
      const jti2 = 'chain-t2';
      const jti3 = 'chain-t3';

      await authRepository.createRefreshToken({
        jti: jti1,
        familyId: family1,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.CONSUMED,
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await authRepository.createRefreshToken({
        jti: jti2,
        familyId: family1,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.CONSUMED,
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await authRepository.createRefreshToken({
        jti: jti3,
        familyId: family1,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Family 2: Unrelated active token
      const jtiUnrelated = 'unrelated-t1';
      await authRepository.createRefreshToken({
        jti: jtiUnrelated,
        familyId: family2,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const token3 = generateRefreshToken(mockActiveUser, {
        jti: jti3,
        familyId: family1,
      });

      // Logout using leaf token T3
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token3}`]);

      expect(res.status).toBe(200);

      // 16. Active leaf T3 is revoked
      expect(inMemoryTokenMap.get(jti3).status).toBe(
        REFRESH_TOKEN_STATUSES.REVOKED
      );
      // 17. Consumed siblings T1, T2 are revoked
      expect(inMemoryTokenMap.get(jti1).status).toBe(
        REFRESH_TOKEN_STATUSES.REVOKED
      );
      expect(inMemoryTokenMap.get(jti2).status).toBe(
        REFRESH_TOKEN_STATUSES.REVOKED
      );
      // 20. Correct revocation reason stored
      expect(inMemoryTokenMap.get(jti3).revokedReason).toBe(
        REFRESH_TOKEN_REVOCATION_REASONS.LOGOUT
      );

      // 19. Unrelated family 2 remains ACTIVE
      expect(inMemoryTokenMap.get(jtiUnrelated).status).toBe(
        REFRESH_TOKEN_STATUSES.ACTIVE
      );
    });

    it('18. Sibling active token in the same family is revoked', async () => {
      const family = 'family-parallel-branch';
      const jtiA = 'token-sibling-a';
      const jtiB = 'token-sibling-b';

      await authRepository.createRefreshToken({
        jti: jtiA,
        familyId: family,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await authRepository.createRefreshToken({
        jti: jtiB,
        familyId: family,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const tokenA = generateRefreshToken(mockActiveUser, {
        jti: jtiA,
        familyId: family,
      });

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${tokenA}`]);

      expect(inMemoryTokenMap.get(jtiA).status).toBe(
        REFRESH_TOKEN_STATUSES.REVOKED
      );
      expect(inMemoryTokenMap.get(jtiB).status).toBe(
        REFRESH_TOKEN_STATUSES.REVOKED
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // E. IDEMPOTENCY
  // ───────────────────────────────────────────────────────────────────────────
  describe('E. Idempotency', () => {
    it('21. Logout with an already REVOKED token does not error and returns 200', async () => {
      const jti = 'jti-already-revoked';
      const familyId = 'family-already-revoked';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.REVOKED,
        revokedAt: new Date(),
        revokedReason: 'USER_LOGOUT',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');
    });

    it('22. Repeated sequential logout calls with same token succeed safely', async () => {
      const jti = 'jti-repeat-test';
      const familyId = 'family-repeat-test';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Call 1
      const res1 = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);
      expect(res1.status).toBe(200);

      // Call 2 (Repeat)
      const res2 = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);
      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);

      // Call 3 (Repeat)
      const res3 = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);
      expect(res3.status).toBe(200);
    });

    it('23. Cookie is cleared on repeated logout calls', async () => {
      const jti = 'jti-repeat-cookie';
      const familyId = 'family-repeat-cookie';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.REVOKED,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cleared = cookies.find((c) => c.startsWith(`${cookieName}=;`));
      expect(cleared).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // F. INVALID OR TAMPERED TOKENS
  // ───────────────────────────────────────────────────────────────────────────
  describe('F. Invalid or Tampered Tokens', () => {
    it('24. Malformed JWT string is handled safely (HTTP 200, cookie cleared)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=not.a.valid.jwt`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const cookies = res.headers['set-cookie'];
      expect(
        cookies.find((c) => c.startsWith(`${cookieName}=;`))
      ).toBeDefined();
    });

    it('25. Invalid signature token is handled safely without error or DB mutation', async () => {
      const forgedToken = jwt.sign(
        {
          sub: '64a7f8e9c1d2e3f4a5b6c7d8',
          jti: 'forged-jti',
          familyId: 'forged-family',
          type: 'refresh',
        },
        'wrong-secret-key-1234567890123456',
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      const revokeSpy = jest.spyOn(authRepository, 'revokeTokenFamily');

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${forgedToken}`]);

      expect(res.status).toBe(200);
      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('26. Expired token is handled safely and cookie is cleared', async () => {
      const expiredToken = jwt.sign(
        {
          sub: '64a7f8e9c1d2e3f4a5b6c7d8',
          jti: 'expired-jti',
          familyId: 'expired-family',
          type: 'refresh',
        },
        config.jwt.refreshSecret,
        {
          algorithm: 'HS256',
          expiresIn: '-10s',
          issuer: config.jwt.issuer || JWT_DEFAULT_ISSUER,
          audience: config.jwt.audience || JWT_DEFAULT_AUDIENCE,
        }
      );

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${expiredToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('27. Wrong issuer token is handled safely without mutation', async () => {
      const wrongIssToken = generateRefreshToken(mockActiveUser, {
        issuer: 'untrusted-issuer',
      });

      const revokeSpy = jest.spyOn(authRepository, 'revokeTokenFamily');

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${wrongIssToken}`]);

      expect(res.status).toBe(200);
      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('28. Wrong audience token is handled safely without mutation', async () => {
      const wrongAudToken = generateRefreshToken(mockActiveUser, {
        audience: 'untrusted-audience',
      });

      const revokeSpy = jest.spyOn(authRepository, 'revokeTokenFamily');

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${wrongAudToken}`]);

      expect(res.status).toBe(200);
      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('29. Wrong algorithm (e.g. none) token is rejected safely', async () => {
      const unsecureToken = jwt.sign(
        {
          sub: '64a7f8e9c1d2e3f4a5b6c7d8',
          jti: 'none-alg-jti',
          familyId: 'none-alg-family',
          type: 'refresh',
        },
        '',
        { algorithm: 'none' }
      );

      const revokeSpy = jest.spyOn(authRepository, 'revokeTokenFamily');

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${unsecureToken}`]);

      expect(res.status).toBe(200);
      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('30. Access token used in refresh cookie is rejected safely without family mutation', async () => {
      const accessToken = generateAccessToken(mockActiveUser);
      const revokeSpy = jest.spyOn(authRepository, 'revokeTokenFamily');

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${accessToken}`]);

      expect(res.status).toBe(200);
      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('31. Cookie is cleared when invalid token is provided', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=invalid-token-12345`]);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cleared = cookies.find((c) => c.startsWith(`${cookieName}=;`));
      expect(cleared).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // G. SECURITY & PRIVACY
  // ───────────────────────────────────────────────────────────────────────────
  describe('G. Security & Privacy', () => {
    it('32-34. Unverified JWT claims cannot trigger arbitrary familyId or jti revocation', async () => {
      const targetFamily = 'legitimate-target-family';
      const targetJti = 'legitimate-target-jti';

      // Seed legitimate victim token
      await authRepository.createRefreshToken({
        jti: targetJti,
        familyId: targetFamily,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Attacker creates a signed token with ATTACKER secret claiming victim's familyId
      const attackerToken = jwt.sign(
        {
          sub: '64a7f8e9c1d2e3f4a5b6c7d8',
          jti: targetJti,
          familyId: targetFamily,
          type: 'refresh',
        },
        'attacker-controlled-secret-123456',
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${attackerToken}`]);

      // Target family must NOT be revoked!
      const victimRecord = inMemoryTokenMap.get(targetJti);
      expect(victimRecord.status).toBe(REFRESH_TOKEN_STATUSES.ACTIVE);
    });

    it('35. Refresh token never appears in logout response JSON', async () => {
      const jti = 'jti-leak-check';
      const token = generateRefreshToken(mockActiveUser, { jti });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain(token);
      expect(res.body.refreshToken).toBeUndefined();
    });

    it('36. JWT secrets never appear in logout responses', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain(config.jwt.refreshSecret);
      expect(bodyStr).not.toContain(config.jwt.accessSecret);
    });

    it('37. Password or passwordHash never appear in response', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.body.password).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('38. No sensitive token value, jti, or familyId is logged during logout', async () => {
      const loggerSpy = jest.spyOn(logger, 'info');
      const jti = 'jti-sensitive-log-check';
      const familyId = 'family-sensitive-log-check';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);

      for (const call of loggerSpy.mock.calls) {
        const logStr = JSON.stringify(call);
        expect(logStr).not.toContain(token);
        expect(logStr).not.toContain(jti);
        expect(logStr).not.toContain(familyId);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // H. REFRESH AFTER LOGOUT
  // ───────────────────────────────────────────────────────────────────────────
  describe('H. Refresh Token Invalidation After Logout', () => {
    it('39-42. Subsequent refresh requests using a logged-out token fail with HTTP 401 and issue no new tokens', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);

      const jti = 'jti-refresh-after-logout';
      const familyId = 'family-refresh-after-logout';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // 1. Perform logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(logoutRes.status).toBe(200);
      expect(inMemoryTokenMap.get(jti).status).toBe(
        REFRESH_TOKEN_STATUSES.REVOKED
      );

      // 2. Attempt refresh with logged out token
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token}`]);

      // 39. 401 Unauthorized
      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body.success).toBe(false);
      expect(refreshRes.body.message).toMatch(
        /Refresh token has been revoked\. Please log in again\./i
      );

      // 41-42. No new access or refresh tokens issued
      expect(refreshRes.body.data).toBeUndefined();
      expect(refreshRes.body.accessToken).toBeUndefined();
    });

    it('40. Any sibling token in the revoked family also fails on subsequent refresh', async () => {
      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockActiveUser);

      const familyId = 'family-sibling-refresh-test';
      const jti1 = 'jti-sibling-1';
      const jti2 = 'jti-sibling-2';

      const token1 = generateRefreshToken(mockActiveUser, {
        jti: jti1,
        familyId,
      });
      const token2 = generateRefreshToken(mockActiveUser, {
        jti: jti2,
        familyId,
      });

      await authRepository.createRefreshToken({
        jti: jti1,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await authRepository.createRefreshToken({
        jti: jti2,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Logout with token 1
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token1}`]);

      // Refresh with sibling token 2
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${token2}`]);

      expect(refreshRes.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // I. COOKIE SECURITY
  // ───────────────────────────────────────────────────────────────────────────
  describe('I. Cookie Security Properties', () => {
    it('43. Cookie clear uses exact configured cookie name', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toMatch(new RegExp(`^${cookieName}=`));
    });

    it('44. Cookie clear path matches refresh cookie path (/api/v1/auth)', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/Path=\/api\/v1\/auth(;|$)/i);
    });

    it('45. Secure behavior is preserved in cookie options', () => {
      const prodOptions = getRefreshTokenCookieOptions({ secure: true });
      expect(prodOptions.secure).toBe(true);

      const devOptions = getRefreshTokenCookieOptions({ secure: false });
      expect(devOptions.secure).toBe(false);
    });

    it('46. SameSite policy is preserved (strict)', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/SameSite=Strict/i);
    });

    it('47. HttpOnly policy is preserved', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/HttpOnly/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // J. CONCURRENCY & DATABASE STATE INVARIANTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('J. Concurrency & Database State Invariants', () => {
    it('48. Concurrent logout calls with same token resolve cleanly to REVOKED family state', async () => {
      const jti = 'jti-concurrent-logout';
      const familyId = 'family-concurrent-logout';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', [`${cookieName}=${token}`]),
        request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', [`${cookieName}=${token}`]),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(inMemoryTokenMap.get(jti).status).toBe(
        REFRESH_TOKEN_STATUSES.REVOKED
      );
    });

    it('49-52. Logout never modifies User account fields (role, status, email/phone verification, passwordHash, lastLoginAt)', async () => {
      const updateUserSpy = jest.spyOn(authRepository, 'updateUserById');
      const updateLastLoginSpy = jest.spyOn(authRepository, 'updateLastLogin');

      const jti = 'jti-user-invariants';
      const familyId = 'family-user-invariants';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`${cookieName}=${token}`]);

      expect(res.status).toBe(200);

      // 49-52. No user updates
      expect(updateUserSpy).not.toHaveBeenCalled();
      expect(updateLastLoginSpy).not.toHaveBeenCalled();
    });

    it('53. AuthService.logout handles object payload { refreshToken } gracefully', async () => {
      const jti = 'jti-object-payload';
      const familyId = 'family-object-payload';
      const token = generateRefreshToken(mockActiveUser, { jti, familyId });

      await authRepository.createRefreshToken({
        jti,
        familyId,
        userId: mockActiveUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await authService.logout({ refreshToken: token });
      expect(result).toEqual({ loggedOut: true });
      expect(inMemoryTokenMap.get(jti).status).toBe(
        REFRESH_TOKEN_STATUSES.REVOKED
      );
    });

    // ─────────────────────────────────────────────────────────────────────────
    // H-01 AUDIT REGRESSION: BROWSER-EQUIVALENT COOKIE PATH (/api/v1/auth)
    // ─────────────────────────────────────────────────────────────────────────
    describe('H-01 Regression: Browser Cookie Path & Session Invalidation', () => {
      it('H-01.1 Login establishes Set-Cookie strictly scoped to Path=/api/v1/auth', async () => {
        jest
          .spyOn(authRepository, 'findByEmailWithPasswordHash')
          .mockResolvedValue(mockActiveUser);
        jest
          .spyOn(authRepository, 'updateLastLogin')
          .mockResolvedValue(mockActiveUser);

        const loginRes = await request(app).post('/api/v1/auth/login').send({
          email: 'jane.doe@university.edu',
          password: 'ValidPass123!',
        });

        expect(loginRes.status).toBe(200);
        const setCookieHeaders = loginRes.headers['set-cookie'];
        expect(setCookieHeaders).toBeDefined();

        const refreshCookie = setCookieHeaders.find((c) =>
          c.startsWith(`${cookieName}=`)
        );
        expect(refreshCookie).toBeDefined();
        expect(refreshCookie).toMatch(/Path=\/api\/v1\/auth(;|$)/i);
        expect(refreshCookie).not.toMatch(/Path=\/api\/v1\/auth\/refresh/i);
        expect(refreshCookie).toMatch(/HttpOnly/i);
        expect(refreshCookie).toMatch(/SameSite=Strict/i);
      });

      it('H-01.2 Browser-equivalent logout receives cookie, revokes family, and clears cookie with Path=/api/v1/auth', async () => {
        jest
          .spyOn(authRepository, 'findByEmailWithPasswordHash')
          .mockResolvedValue(mockActiveUser);
        jest
          .spyOn(authRepository, 'updateLastLogin')
          .mockResolvedValue(mockActiveUser);

        // 1. Login to establish cookie
        const loginRes = await request(app).post('/api/v1/auth/login').send({
          email: 'jane.doe@university.edu',
          password: 'ValidPass123!',
        });
        expect(loginRes.status).toBe(200);
        const setCookieHeader = loginRes.headers['set-cookie'][0];
        const rawCookie = setCookieHeader.split(';')[0]; // refreshToken=<jwt>

        // 2. Extract token and check inMemoryTokenMap
        const tokenVal = rawCookie.split('=')[1];
        const decoded = jwt.decode(tokenVal);
        const jti = decoded.jti;
        const familyId = decoded.familyId;

        expect(inMemoryTokenMap.get(jti)).toBeDefined();
        expect(inMemoryTokenMap.get(jti).status).toBe(
          REFRESH_TOKEN_STATUSES.ACTIVE
        );

        // 3. Browser sends cookie to POST /api/v1/auth/logout
        const logoutRes = await request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', [rawCookie]);

        expect(logoutRes.status).toBe(200);
        expect(logoutRes.body.success).toBe(true);

        // 4. Token family revoked
        expect(inMemoryTokenMap.get(jti).status).toBe(
          REFRESH_TOKEN_STATUSES.REVOKED
        );

        // 5. Subsequent refresh using revoked token fails
        await expect(authService.refreshAccessToken(tokenVal)).rejects.toThrow(
          AppError
        );

        // 6. Cookie is cleared with Path=/api/v1/auth
        const clearCookieHeaders = logoutRes.headers['set-cookie'];
        expect(clearCookieHeaders).toBeDefined();
        const clearedRefreshCookie = clearCookieHeaders.find((c) =>
          c.startsWith(`${cookieName}=`)
        );
        expect(clearedRefreshCookie).toBeDefined();
        expect(clearedRefreshCookie).toMatch(/Path=\/api\/v1\/auth(;|$)/i);
      });

      it('H-01.3 Browser-equivalent DELETE /api/v1/auth/sessions preserves current session and revokes other sessions', async () => {
        // Setup user with 2 active sessions in family 1 (current) and family 2 (other)
        const currentFamilyId = 'family-current-browser';
        const currentJti = 'jti-current-browser';
        const otherFamilyId = 'family-other-browser';
        const otherJti = 'jti-other-browser';

        const currentToken = generateRefreshToken(mockActiveUser, {
          jti: currentJti,
          familyId: currentFamilyId,
        });
        const otherToken = generateRefreshToken(mockActiveUser, {
          jti: otherJti,
          familyId: otherFamilyId,
        });

        await authRepository.createRefreshToken({
          jti: currentJti,
          familyId: currentFamilyId,
          userId: mockActiveUser._id,
          status: REFRESH_TOKEN_STATUSES.ACTIVE,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        await authRepository.createRefreshToken({
          jti: otherJti,
          familyId: otherFamilyId,
          userId: mockActiveUser._id,
          status: REFRESH_TOKEN_STATUSES.ACTIVE,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const accessToken = generateAccessToken(mockActiveUser);

        // DELETE /api/v1/auth/sessions with current cookie
        const res = await request(app)
          .delete('/api/v1/auth/sessions')
          .set('Authorization', `Bearer ${accessToken}`)
          .set('Cookie', [`${cookieName}=${currentToken}`]);

        expect(res.status).toBe(200);

        // Current session remains ACTIVE
        expect(inMemoryTokenMap.get(currentJti).status).toBe(
          REFRESH_TOKEN_STATUSES.ACTIVE
        );
        // Other session is REVOKED
        expect(inMemoryTokenMap.get(otherJti).status).toBe(
          REFRESH_TOKEN_STATUSES.REVOKED
        );
      });
    });
  });
});
