'use strict';

const request = require('supertest');
const argon2 = require('argon2');
const app = require('../../src/app/app');
const { USER_ROLES, ACCOUNT_STATUSES } = require('../../src/shared/constants');
const authRepository = require('../../src/modules/auth/auth.repository');
const authService = require('../../src/modules/auth/auth.service');
const {
  REFRESH_TOKEN_STATUSES,
  COOKIE_KEYS,
  JWT_POLICY,
} = require('../../src/modules/auth/auth.constants');
const {
  extractSubnet,
  generateDeviceFingerprint,
  verifyDeviceFingerprint,
  createSessionRedisKey,
  generateAccessToken,
  generateRefreshToken,
  generateFamilyId,
  generateJti,
} = require('../../src/modules/auth/auth.helper');
const RefreshToken = require('../../src/modules/auth/refresh-token.model');

describe('Sprint 2.16 — Session Security & Device Fingerprinting', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Dr. Jane Smith',
    email: 'jane.smith@university.edu',
    role: USER_ROLES.FACULTY,
    status: ACCOUNT_STATUSES.ACTIVE,
    isEmailVerified: true,
    isPhoneVerified: true,
  };

  const getValidAccessToken = (userId = mockUser._id) => {
    return generateAccessToken({
      _id: userId,
      role: mockUser.role,
      email: mockUser.email,
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. DEVICE FINGERPRINTING & SUBNET EXTRACTION HELPERS
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Device Fingerprinting & Subnet Extraction Helpers', () => {
    it('1.1 extracts /24 subnet for standard IPv4 addresses', () => {
      expect(extractSubnet('192.168.1.100')).toBe('192.168.1.0/24');
      expect(extractSubnet('10.0.5.42')).toBe('10.0.5.0/24');
      expect(extractSubnet('203.0.113.195')).toBe('203.0.113.0/24');
    });

    it('1.2 strips IPv4-mapped IPv6 prefixes and extracts /24 subnet', () => {
      expect(extractSubnet('::ffff:192.168.1.50')).toBe('192.168.1.0/24');
      expect(extractSubnet('::ffff:10.20.30.40')).toBe('10.20.30.0/24');
    });

    it('1.3 normalizes localhost addresses', () => {
      expect(extractSubnet('127.0.0.1')).toBe('127.0.0.0/8');
      expect(extractSubnet('::1')).toBe('127.0.0.0/8');
      expect(extractSubnet('localhost')).toBe('127.0.0.0/8');
    });

    it('1.4 extracts /64 prefix for standard IPv6 addresses', () => {
      const ipv6 = '2001:0db8:85a3:0042:0000:8a2e:0370:7334';
      expect(extractSubnet(ipv6)).toBe('2001:0db8:85a3:0042::/64');
    });

    it('1.5 handles unknown or missing IP gracefully', () => {
      expect(extractSubnet(null)).toBe('unknown');
      expect(extractSubnet('')).toBe('unknown');
      expect(extractSubnet('unknown')).toBe('unknown');
    });

    it('1.6 generates deterministic SHA-256 device fingerprint (64-char hex)', () => {
      const meta = {
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };
      const fp1 = generateDeviceFingerprint(meta);
      const fp2 = generateDeviceFingerprint(meta);

      expect(typeof fp1).toBe('string');
      expect(fp1).toHaveLength(64);
      expect(fp1).toMatch(/^[a-f0-9]{64}$/);
      expect(fp1).toBe(fp2);
    });

    it('1.7 generates identical fingerprints for different IPs in the SAME subnet', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const fp1 = generateDeviceFingerprint({
        ip: '192.168.1.10',
        userAgent: ua,
      });
      const fp2 = generateDeviceFingerprint({
        ip: '192.168.1.99',
        userAgent: ua,
      });

      expect(fp1).toBe(fp2);
    });

    it('1.8 generates different fingerprints for different subnets', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const fp1 = generateDeviceFingerprint({
        ip: '192.168.1.10',
        userAgent: ua,
      });
      const fp2 = generateDeviceFingerprint({
        ip: '192.168.2.10',
        userAgent: ua,
      });

      expect(fp1).not.toBe(fp2);
    });

    it('1.9 generates different fingerprints for different User-Agent strings', () => {
      const ip = '192.168.1.10';
      const fp1 = generateDeviceFingerprint({
        ip,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      });
      const fp2 = generateDeviceFingerprint({
        ip,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      });

      expect(fp1).not.toBe(fp2);
    });

    it('1.10 verifyDeviceFingerprint validates matching metadata and rejects mismatch', () => {
      const meta = {
        ip: '192.168.1.25',
        userAgent: 'Mozilla/5.0 Chrome/120.0',
      };
      const expectedHash = generateDeviceFingerprint(meta);

      expect(verifyDeviceFingerprint(meta, expectedHash)).toBe(true);

      // Same subnet, same UA -> true
      expect(
        verifyDeviceFingerprint(
          { ip: '192.168.1.200', userAgent: 'Mozilla/5.0 Chrome/120.0' },
          expectedHash
        )
      ).toBe(true);

      // Different UA -> false
      expect(
        verifyDeviceFingerprint(
          { ip: '192.168.1.25', userAgent: 'Mozilla/5.0 Firefox/120.0' },
          expectedHash
        )
      ).toBe(false);

      // Different subnet -> false
      expect(
        verifyDeviceFingerprint(
          { ip: '10.0.0.1', userAgent: 'Mozilla/5.0 Chrome/120.0' },
          expectedHash
        )
      ).toBe(false);

      // Invalid expected hash
      expect(verifyDeviceFingerprint(meta, null)).toBe(false);
      expect(verifyDeviceFingerprint(meta, 'invalid-hex')).toBe(false);
    });

    it('1.11 constructs Redis session key with configured prefix', () => {
      expect(createSessionRedisKey('session-abc')).toBe(
        'auth:session:session-abc'
      );
      expect(createSessionRedisKey('')).toBe('');
      expect(createSessionRedisKey(null)).toBe('');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. REFRESH TOKEN SCHEMA & SESSION METADATA PERSISTENCE
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Refresh Token Schema & Session Metadata Persistence', () => {
    it('2.1 RefreshToken model defines session metadata fields', () => {
      const paths = RefreshToken.schema.paths;
      expect(paths.ipAddress).toBeDefined();
      expect(paths.userAgent).toBeDefined();
      expect(paths.deviceHash).toBeDefined();
      expect(paths.lastActivityAt).toBeDefined();
    });

    it('2.2 AuthRepository.createRefreshToken persists session metadata', async () => {
      let createdDoc = null;
      jest
        .spyOn(authRepository._refreshTokenModel, 'create')
        .mockImplementation(async (data) => {
          createdDoc = { ...data };
          return createdDoc;
        });

      const tokenData = {
        jti: 'jti-test-1',
        familyId: 'family-test-1',
        userId: mockUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: '192.168.1.50',
        userAgent: 'Mozilla/5.0 TestBrowser',
        deviceHash: generateDeviceFingerprint({
          ip: '192.168.1.50',
          userAgent: 'Mozilla/5.0 TestBrowser',
        }),
        lastActivityAt: new Date(),
      };

      await authRepository.createRefreshToken(tokenData);

      expect(createdDoc).toBeDefined();
      expect(createdDoc.ipAddress).toBe('192.168.1.50');
      expect(createdDoc.userAgent).toBe('Mozilla/5.0 TestBrowser');
      expect(createdDoc.deviceHash).toBe(tokenData.deviceHash);
      expect(createdDoc.lastActivityAt).toBeInstanceOf(Date);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. LOGIN SESSION CREATION & REDIS SESSION CACHING
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Login Session Creation & Redis Session Caching', () => {
    it('3.1 Successful login captures client IP and User-Agent, creates deviceHash', async () => {
      const rawPassword = 'ValidPass123!';
      const passwordHash = await argon2.hash(rawPassword, {
        type: argon2.argon2id,
      });
      const userWithHash = { ...mockUser, passwordHash };

      jest
        .spyOn(authRepository, 'findByEmailWithPasswordHash')
        .mockResolvedValue(userWithHash);
      jest.spyOn(authRepository, 'updateLastLogin').mockResolvedValue(mockUser);

      let capturedTokenData = null;
      jest
        .spyOn(authRepository, 'createRefreshToken')
        .mockImplementation(async (data) => {
          capturedTokenData = data;
          return data;
        });

      const storeSessionSpy = jest
        .spyOn(authRepository, 'storeSessionCache')
        .mockResolvedValue('OK');

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'TestClient/2.0')
        .set('X-Forwarded-For', '203.0.113.50')
        .send({
          email: mockUser.email,
          password: rawPassword,
        });

      expect(res.status).toBe(200);
      expect(capturedTokenData).toBeDefined();
      expect(capturedTokenData.userAgent).toBe('TestClient/2.0');
      expect(capturedTokenData.ipAddress).toBe('203.0.113.50');
      expect(capturedTokenData.deviceHash).toBe(
        generateDeviceFingerprint({
          ip: '203.0.113.50',
          userAgent: 'TestClient/2.0',
        })
      );
      expect(storeSessionSpy).toHaveBeenCalledWith(
        capturedTokenData.familyId,
        expect.objectContaining({
          userId: mockUser._id,
          ipAddress: '203.0.113.50',
          userAgent: 'TestClient/2.0',
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. REFRESH TOKEN ROTATION & DEVICE MISMATCH (SESSION HIJACKING MITIGATION)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Refresh Token Rotation & Session Hijacking Mitigation', () => {
    it('4.1 allows token rotation when device fingerprint matches', async () => {
      const clientMeta = {
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0 GenuineBrowser',
      };
      const deviceHash = generateDeviceFingerprint(clientMeta);
      const familyId = generateFamilyId();
      const jti = generateJti();

      const validToken = generateRefreshToken(mockUser, { jti, familyId });

      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(authRepository, 'findRefreshTokenByJti').mockResolvedValue({
        jti,
        familyId,
        userId: mockUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deviceHash,
        ipAddress: clientMeta.ip,
        userAgent: clientMeta.userAgent,
      });

      jest
        .spyOn(authRepository, 'consumeRefreshToken')
        .mockResolvedValue({ jti, status: REFRESH_TOKEN_STATUSES.CONSUMED });
      jest.spyOn(authRepository, 'createRefreshToken').mockResolvedValue({});
      jest.spyOn(authRepository, 'storeSessionCache').mockResolvedValue('OK');

      const cookieName =
        app.get('env') === 'production'
          ? COOKIE_KEYS.REFRESH_TOKEN
          : JWT_POLICY.REFRESH_COOKIE_NAME;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${validToken}`])
        .set('User-Agent', clientMeta.userAgent)
        .set('X-Forwarded-For', clientMeta.ip);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('4.2 allows token rotation when IP shifts within the same subnet (e.g. mobile roaming / DHCP)', async () => {
      const originalMeta = {
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0 RoamingDevice',
      };
      const deviceHash = generateDeviceFingerprint(originalMeta);
      const familyId = generateFamilyId();
      const jti = generateJti();

      const validToken = generateRefreshToken(mockUser, { jti, familyId });

      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(authRepository, 'findRefreshTokenByJti').mockResolvedValue({
        jti,
        familyId,
        userId: mockUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deviceHash,
        ipAddress: originalMeta.ip,
        userAgent: originalMeta.userAgent,
      });

      jest
        .spyOn(authRepository, 'consumeRefreshToken')
        .mockResolvedValue({ jti, status: REFRESH_TOKEN_STATUSES.CONSUMED });
      jest.spyOn(authRepository, 'createRefreshToken').mockResolvedValue({});
      jest.spyOn(authRepository, 'storeSessionCache').mockResolvedValue('OK');

      const cookieName = JWT_POLICY.REFRESH_COOKIE_NAME;

      // Roaming to .199 in the same /24 subnet
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${validToken}`])
        .set('User-Agent', originalMeta.userAgent)
        .set('X-Forwarded-For', '192.168.1.199');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('4.3 revokes family and rejects with 401 when device fingerprint does not match (session hijacking)', async () => {
      const originalMeta = {
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0 VictimBrowser',
      };
      const deviceHash = generateDeviceFingerprint(originalMeta);
      const familyId = generateFamilyId();
      const jti = generateJti();

      const stolenToken = generateRefreshToken(mockUser, { jti, familyId });

      jest.spyOn(authRepository, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(authRepository, 'findRefreshTokenByJti').mockResolvedValue({
        jti,
        familyId,
        userId: mockUser._id,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deviceHash,
        ipAddress: originalMeta.ip,
        userAgent: originalMeta.userAgent,
      });

      const revokeFamilySpy = jest
        .spyOn(authRepository, 'revokeTokenFamily')
        .mockResolvedValue({ modifiedCount: 1 });

      const cookieName = JWT_POLICY.REFRESH_COOKIE_NAME;

      // Attacker presents token from completely different device/browser
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${cookieName}=${stolenToken}`])
        .set('User-Agent', 'HackerTool/1.0 (MaliciousOS)')
        .set('X-Forwarded-For', '10.99.88.77');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(
        /Session validation failed|Device mismatch/i
      );
      expect(revokeFamilySpy).toHaveBeenCalledWith(
        familyId,
        expect.stringMatching(/Session device mismatch detected/i)
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. SESSION LISTING (GET /api/v1/auth/sessions)
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Active Sessions Retrieval (GET /api/v1/auth/sessions)', () => {
    it('5.1 requires valid authentication token', async () => {
      const res = await request(app).get('/api/v1/auth/sessions');
      expect(res.status).toBe(401);
    });

    it('5.2 returns active sessions with correct schema and isCurrent flag', async () => {
      const token = getValidAccessToken();
      const currentFamilyId = 'family-session-curr';
      const otherFamilyId = 'family-session-other';

      const mockActiveSessions = [
        {
          familyId: currentFamilyId,
          ipAddress: '192.168.1.10',
          userAgent: 'Mozilla/5.0 CurrentDevice',
          issuedAt: new Date('2026-08-14T10:00:00.000Z'),
          lastActivityAt: new Date('2026-08-14T12:30:00.000Z'),
        },
        {
          familyId: otherFamilyId,
          ipAddress: '10.0.0.5',
          userAgent: 'Mozilla/5.0 MobileDevice',
          issuedAt: new Date('2026-08-13T08:00:00.000Z'),
          lastActivityAt: new Date('2026-08-13T09:00:00.000Z'),
        },
      ];

      jest
        .spyOn(authRepository, 'getActiveSessionsByUserId')
        .mockResolvedValue(mockActiveSessions);

      const currentRefreshToken = generateRefreshToken(mockUser, {
        jti: 'jti-curr',
        familyId: currentFamilyId,
      });

      const cookieName = JWT_POLICY.REFRESH_COOKIE_NAME;

      const res = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', [`${cookieName}=${currentRefreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Active sessions retrieved.');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);

      const [s1, s2] = res.body.data;
      expect(s1.sessionId).toBe(currentFamilyId);
      expect(s1.ipAddress).toBe('192.168.1.10');
      expect(s1.userAgent).toBe('Mozilla/5.0 CurrentDevice');
      expect(s1.isCurrent).toBe(true);

      expect(s2.sessionId).toBe(otherFamilyId);
      expect(s2.ipAddress).toBe('10.0.0.5');
      expect(s2.isCurrent).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. SPECIFIC SESSION REVOCATION (DELETE /api/v1/auth/sessions/:sessionId)
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Specific Session Revocation (DELETE /api/v1/auth/sessions/:sessionId)', () => {
    it('6.1 requires authentication', async () => {
      const res = await request(app).delete('/api/v1/auth/sessions/sess-123');
      expect(res.status).toBe(401);
    });

    it('6.2 revokes the target session family and deletes Redis cache', async () => {
      const token = getValidAccessToken();
      const targetSessionId = 'target-family-456';

      const revokeSpy = jest
        .spyOn(authRepository, 'revokeSessionByFamilyId')
        .mockResolvedValue({ modifiedCount: 1 });

      const res = await request(app)
        .delete(`/api/v1/auth/sessions/${targetSessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Session revoked successfully.');
      expect(revokeSpy).toHaveBeenCalledWith(
        mockUser._id,
        targetSessionId,
        expect.any(String)
      );
    });

    it('6.3 clears refresh cookie if revoking the current session', async () => {
      const token = getValidAccessToken();
      const currentFamilyId = 'curr-family-789';

      jest
        .spyOn(authRepository, 'revokeSessionByFamilyId')
        .mockResolvedValue({ modifiedCount: 1 });

      const currentRefreshToken = generateRefreshToken(mockUser, {
        jti: 'jti-curr',
        familyId: currentFamilyId,
      });

      const cookieName = JWT_POLICY.REFRESH_COOKIE_NAME;

      const res = await request(app)
        .delete(`/api/v1/auth/sessions/${currentFamilyId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', [`${cookieName}=${currentRefreshToken}`]);

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie[0]).toMatch(new RegExp(`${cookieName}=;`));
    });

    it('6.4 returns 404 when target session is not found or already terminated', async () => {
      const token = getValidAccessToken();
      jest
        .spyOn(authRepository, 'revokeSessionByFamilyId')
        .mockResolvedValue({ modifiedCount: 0 });

      const res = await request(app)
        .delete('/api/v1/auth/sessions/non-existent-session')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(
        /Session not found or already terminated/i
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. REVOKE ALL OTHER SESSIONS (DELETE /api/v1/auth/sessions)
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Revoke All Other Sessions (DELETE /api/v1/auth/sessions)', () => {
    it('7.1 requires authentication', async () => {
      const res = await request(app).delete('/api/v1/auth/sessions');
      expect(res.status).toBe(401);
    });

    it('7.2 revokes all other sessions except current session', async () => {
      const token = getValidAccessToken();
      const currentFamilyId = 'current-active-family';

      const currentRefreshToken = generateRefreshToken(mockUser, {
        jti: 'jti-curr',
        familyId: currentFamilyId,
      });

      const revokeOthersSpy = jest
        .spyOn(authRepository, 'revokeAllUserSessionsExcept')
        .mockResolvedValue({ modifiedCount: 3 });

      const cookieName = JWT_POLICY.REFRESH_COOKIE_NAME;

      const res = await request(app)
        .delete('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', [`${cookieName}=${currentRefreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('All other sessions revoked successfully.');
      expect(revokeOthersSpy).toHaveBeenCalledWith(
        mockUser._id,
        currentFamilyId,
        expect.any(String)
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. SESSION VALIDATION WORKFLOW (SD-15)
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Session Validation Workflow (SD-15)', () => {
    it('8.1 validates active session from Redis cache and updates lastActivityAt', async () => {
      const sessionId = 'session-sd15-test';
      const clientMeta = {
        ip: '192.168.1.15',
        userAgent: 'Mozilla/5.0 Agent',
      };
      const deviceHash = generateDeviceFingerprint(clientMeta);

      jest.spyOn(authRepository, 'getSessionCache').mockResolvedValue({
        userId: mockUser._id,
        familyId: sessionId,
        deviceHash,
      });

      const updateActivitySpy = jest
        .spyOn(authRepository, 'updateSessionCacheActivity')
        .mockResolvedValue(true);

      const result = await authService.validateSession({
        sessionId,
        ip: clientMeta.ip,
        userAgent: clientMeta.userAgent,
      });

      expect(result.valid).toBe(true);
      expect(updateActivitySpy).toHaveBeenCalledWith(sessionId);
    });

    it('8.2 rejects session when device fingerprint mismatch is detected in SD-15 validation', async () => {
      const sessionId = 'session-sd15-mismatch';
      const genuineMeta = {
        ip: '192.168.1.15',
        userAgent: 'Mozilla/5.0 GenuineAgent',
      };
      const deviceHash = generateDeviceFingerprint(genuineMeta);

      jest.spyOn(authRepository, 'getSessionCache').mockResolvedValue({
        userId: mockUser._id,
        familyId: sessionId,
        deviceHash,
      });

      const result = await authService.validateSession({
        sessionId,
        ip: '10.0.0.1',
        userAgent: 'Mozilla/5.0 Hijacker',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('DEVICE_FINGERPRINT_MISMATCH');
    });

    it('8.3 returns invalid when session is not found in cache or database', async () => {
      jest.spyOn(authRepository, 'getSessionCache').mockResolvedValue(null);
      jest.spyOn(authRepository, 'getTokensByFamily').mockResolvedValue([]);

      const result = await authService.validateSession({
        sessionId: 'non-existent-family',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SESSION_EXPIRED_OR_REVOKED');
    });
  });
});
