'use strict';

const userRepository = require('../users/user.repository');
const RefreshToken = require('./refresh-token.model');
const { getRedisClient } = require('../../config/redis');
const {
  EMAIL_OTP_TTL_SECONDS,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  PHONE_OTP_TTL_SECONDS,
  PHONE_OTP_RESEND_COOLDOWN_SECONDS,
  PASSWORD_RESET_OTP_TTL_SECONDS,
  PASSWORD_RESET_OTP_COOLDOWN_SECONDS,
  PASSWORD_RESET_OTP_RATE_WINDOW_SECONDS,
  REFRESH_TOKEN_STATUSES,
} = require('./auth.constants');
const {
  createOtpRedisKey,
  createOtpCooldownRedisKey,
  createOtpResendCountRedisKey,
  createPhoneOtpRedisKey,
  createPhoneOtpCooldownRedisKey,
  createPhoneOtpResendCountRedisKey,
  createPasswordResetOtpRedisKey,
  createPasswordResetCooldownRedisKey,
  createPasswordResetRateRedisKey,
  normalizeEmail,
  normalizePhone,
} = require('./auth.helper');

/**
 * Authentication Persistence Repository.
 *
 * Encapsulates authentication-specific persistence operations,
 * credential retrievals, MongoDB user lookups, RefreshToken state tracking,
 * and Redis OTP operations.
 */
class AuthRepository {
  /**
   * @param {Object} [options]
   * @param {import('../users/user.repository').UserRepository} [options.userRepo]
   * @param {import('mongoose').Model} [options.refreshTokenModel]
   * @param {import('ioredis').Redis|Function} [options.redisClient]
   */
  constructor(options = {}) {
    this._userRepository = options.userRepo || userRepository;
    this._refreshTokenModel = options.refreshTokenModel || RefreshToken;
    this._redisClientGetter =
      typeof options.redisClient === 'function'
        ? options.redisClient
        : options.redisClient
          ? () => options.redisClient
          : getRedisClient;
  }

  /**
   * Helper to retrieve active Redis client.
   * @private
   * @returns {import('ioredis').Redis}
   */
  _getRedis() {
    return this._redisClientGetter();
  }

  // ─── User Persistence Operations (MongoDB) ───────────────────────────

  /**
   * Look up user by MongoDB ObjectId (safe lookup without password hash).
   * @param {string|import('mongoose').Types.ObjectId} id
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findById(id) {
    if (!id) return null;
    return this._userRepository.findById(id);
  }

  /**
   * Look up user by email address (without password hash).
   * @param {string} email
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByEmail(email) {
    return this._userRepository.findByEmail(email);
  }

  /**
   * Look up user by email address explicitly including password hash.
   * @param {string} email
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByEmailWithPasswordHash(email) {
    return this._userRepository.findByEmailWithPasswordHash(email);
  }

  /**
   * Check if user exists by email address.
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async existsByEmail(email) {
    return this._userRepository.existsByEmail(email);
  }

  /**
   * Look up user by phone number (without password hash).
   * @param {string} phone
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByPhone(phone) {
    if (!phone || typeof phone !== 'string') return null;
    return this._userRepository.findByPhone(normalizePhone(phone));
  }

  /**
   * Check if user exists by phone number.
   * @param {string} phone
   * @returns {Promise<boolean>}
   */
  async existsByPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    return this._userRepository.existsByPhone(normalizePhone(phone));
  }

  /**
   * Persist a new registered user.
   * @param {Object} userData
   * @returns {Promise<import('mongoose').Document>}
   */
  async create(userData) {
    return this._userRepository.create(userData);
  }

  /**
   * Update user document by ID.
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {Object} updateData
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async updateUserById(userId, updateData) {
    return this._userRepository.updateById(userId, updateData);
  }

  /**
   * Update user last login timestamp.
   * @param {string} userId
   * @param {Date} [timestamp]
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async updateLastLogin(userId, timestamp = new Date()) {
    return this._userRepository.updateById(userId, { lastLoginAt: timestamp });
  }

  // ─── Redis OTP Transient State Operations ────────────────────────────

  /**
   * Stores hashed OTP record in Redis with strict TTL.
   *
   * @param {string} email - Target user email.
   * @param {Object} otpData - OTP metadata payload (otpHash, attempts, createdAt, expiresAt).
   * @param {number} [ttlSeconds=EMAIL_OTP_TTL_SECONDS] - Expiry TTL in seconds.
   * @returns {Promise<'OK'|boolean>}
   */
  async storeEmailOtp(email, otpData, ttlSeconds = EMAIL_OTP_TTL_SECONDS) {
    const key = createOtpRedisKey(email);
    const redis = this._getRedis();
    const payload = JSON.stringify(otpData);
    return redis.set(key, payload, 'EX', ttlSeconds);
  }

  /**
   * Retrieves hashed OTP record from Redis.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<Object|null>} Parsed OTP data object or null if expired/non-existent.
   */
  async getEmailOtp(email) {
    const key = createOtpRedisKey(email);
    const redis = this._getRedis();
    const data = await redis.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Deletes OTP record from Redis immediately.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<number>} Number of keys removed (0 or 1).
   */
  async deleteEmailOtp(email) {
    const key = createOtpRedisKey(email);
    const redis = this._getRedis();
    return redis.del(key);
  }

  /**
   * Atomically increments the failed attempt count for the active OTP.
   * Preserves the remaining TTL on the key.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<{ attempts: number, otpData: Object }|null>}
   */
  async incrementEmailOtpAttempts(email) {
    const key = createOtpRedisKey(email);
    const redis = this._getRedis();
    const data = await redis.get(key);
    if (!data) return null;

    try {
      const otpData = JSON.parse(data);
      otpData.attempts = (otpData.attempts || 0) + 1;

      const ttl = await redis.ttl(key);
      if (ttl > 0) {
        await redis.set(key, JSON.stringify(otpData), 'EX', ttl);
      } else {
        await redis.del(key);
        return null;
      }

      return { attempts: otpData.attempts, otpData };
    } catch {
      return null;
    }
  }

  /**
   * Sets resend cooldown lock in Redis.
   *
   * @param {string} email - Target user email.
   * @param {number} [cooldownSeconds=EMAIL_OTP_RESEND_COOLDOWN_SECONDS] - Cooldown period in seconds.
   * @returns {Promise<'OK'|boolean>}
   */
  async setResendCooldown(
    email,
    cooldownSeconds = EMAIL_OTP_RESEND_COOLDOWN_SECONDS
  ) {
    const key = createOtpCooldownRedisKey(email);
    const redis = this._getRedis();
    return redis.set(key, '1', 'EX', cooldownSeconds);
  }

  /**
   * Checks if an email is currently within the resend cooldown window.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<{ inCooldown: boolean, ttlRemaining: number }>}
   */
  async getResendCooldown(email) {
    const key = createOtpCooldownRedisKey(email);
    const redis = this._getRedis();
    const ttl = await redis.ttl(key);
    return {
      inCooldown: ttl > 0,
      ttlRemaining: Math.max(ttl, 0),
    };
  }

  /**
   * Retrieves the current resend count for an email.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<number>}
   */
  async getResendCount(email) {
    const key = createOtpResendCountRedisKey(email);
    const redis = this._getRedis();
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  /**
   * Increments the resend count for an email with sliding or fixed TTL.
   *
   * @param {string} email - Target user email.
   * @param {number} [ttlSeconds=EMAIL_OTP_TTL_SECONDS]
   * @returns {Promise<number>} New resend count.
   */
  async incrementResendCount(email, ttlSeconds = EMAIL_OTP_TTL_SECONDS) {
    const key = createOtpResendCountRedisKey(email);
    const redis = this._getRedis();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  }

  /**
   * Cleans up all OTP and resend tracking state for an email upon successful verification.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<void>}
   */
  async clearAllOtpState(email) {
    const redis = this._getRedis();
    const normalized = normalizeEmail(email);
    await Promise.all([
      redis.del(createOtpRedisKey(normalized)),
      redis.del(createOtpCooldownRedisKey(normalized)),
      redis.del(createOtpResendCountRedisKey(normalized)),
    ]);
  }

  // ─── Redis Phone OTP Transient State Operations ──────────────────────

  /**
   * Stores hashed Phone OTP record in Redis with strict TTL.
   *
   * @param {string} phone - Target user phone number.
   * @param {Object} otpData - OTP metadata payload (otpHash, attempts, createdAt, expiresAt).
   * @param {number} [ttlSeconds=PHONE_OTP_TTL_SECONDS] - Expiry TTL in seconds.
   * @returns {Promise<'OK'|boolean>}
   */
  async storePhoneOtp(phone, otpData, ttlSeconds = PHONE_OTP_TTL_SECONDS) {
    const key = createPhoneOtpRedisKey(phone);
    const redis = this._getRedis();
    const payload = JSON.stringify(otpData);
    return redis.set(key, payload, 'EX', ttlSeconds);
  }

  /**
   * Retrieves hashed Phone OTP record from Redis.
   *
   * @param {string} phone - Target user phone number.
   * @returns {Promise<Object|null>} Parsed OTP data object or null if expired/non-existent.
   */
  async getPhoneOtp(phone) {
    const key = createPhoneOtpRedisKey(phone);
    const redis = this._getRedis();
    const data = await redis.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Deletes Phone OTP record from Redis immediately.
   *
   * @param {string} phone - Target user phone number.
   * @returns {Promise<number>} Number of keys removed (0 or 1).
   */
  async deletePhoneOtp(phone) {
    const key = createPhoneOtpRedisKey(phone);
    const redis = this._getRedis();
    return redis.del(key);
  }

  /**
   * Atomically increments the failed attempt count for the active Phone OTP.
   * Preserves the remaining TTL on the key.
   *
   * @param {string} phone - Target user phone number.
   * @returns {Promise<{ attempts: number, otpData: Object }|null>}
   */
  async incrementPhoneOtpAttempts(phone) {
    const key = createPhoneOtpRedisKey(phone);
    const redis = this._getRedis();
    const data = await redis.get(key);
    if (!data) return null;

    try {
      const otpData = JSON.parse(data);
      otpData.attempts = (otpData.attempts || 0) + 1;

      const ttl = await redis.ttl(key);
      if (ttl > 0) {
        await redis.set(key, JSON.stringify(otpData), 'EX', ttl);
      } else {
        await redis.del(key);
        return null;
      }

      return { attempts: otpData.attempts, otpData };
    } catch {
      return null;
    }
  }

  /**
   * Sets phone OTP resend cooldown lock in Redis.
   *
   * @param {string} phone - Target user phone number.
   * @param {number} [cooldownSeconds=PHONE_OTP_RESEND_COOLDOWN_SECONDS] - Cooldown period in seconds.
   * @returns {Promise<'OK'|boolean>}
   */
  async setPhoneOtpCooldown(
    phone,
    cooldownSeconds = PHONE_OTP_RESEND_COOLDOWN_SECONDS
  ) {
    const key = createPhoneOtpCooldownRedisKey(phone);
    const redis = this._getRedis();
    return redis.set(key, '1', 'EX', cooldownSeconds);
  }

  /**
   * Checks if a phone number is currently within the resend cooldown window.
   *
   * @param {string} phone - Target user phone number.
   * @returns {Promise<{ inCooldown: boolean, ttlRemaining: number }>}
   */
  async getPhoneOtpCooldown(phone) {
    const key = createPhoneOtpCooldownRedisKey(phone);
    const redis = this._getRedis();
    const ttl = await redis.ttl(key);
    return {
      inCooldown: ttl > 0,
      ttlRemaining: Math.max(ttl, 0),
    };
  }

  /**
   * Retrieves the current resend count for a phone number.
   *
   * @param {string} phone - Target user phone number.
   * @returns {Promise<number>}
   */
  async getPhoneOtpResendCount(phone) {
    const key = createPhoneOtpResendCountRedisKey(phone);
    const redis = this._getRedis();
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  /**
   * Increments the resend count for a phone number with sliding or fixed TTL.
   *
   * @param {string} phone - Target user phone number.
   * @param {number} [ttlSeconds=PHONE_OTP_TTL_SECONDS]
   * @returns {Promise<number>} New resend count.
   */
  async incrementPhoneOtpResendCount(
    phone,
    ttlSeconds = PHONE_OTP_TTL_SECONDS
  ) {
    const key = createPhoneOtpResendCountRedisKey(phone);
    const redis = this._getRedis();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  }

  /**
   * Cleans up all Phone OTP and resend tracking state for a phone upon successful verification.
   *
   * @param {string} phone - Target user phone number.
   * @returns {Promise<void>}
   */
  async clearAllPhoneOtpState(phone) {
    const redis = this._getRedis();
    const normalized = normalizePhone(phone);
    await Promise.all([
      redis.del(createPhoneOtpRedisKey(normalized)),
      redis.del(createPhoneOtpCooldownRedisKey(normalized)),
      redis.del(createPhoneOtpResendCountRedisKey(normalized)),
    ]);
  }

  // ─── Redis Password Reset OTP Transient State Operations (Sprint 2.12) ─

  /**
   * Stores hashed Password Reset OTP record in Redis with strict TTL.
   *
   * @param {string} email - Target user email.
   * @param {Object} otpData - OTP metadata payload (otpHash, attempts, createdAt, expiresAt).
   * @param {number} [ttlSeconds=PASSWORD_RESET_OTP_TTL_SECONDS] - Expiry TTL in seconds.
   * @returns {Promise<'OK'|boolean>}
   */
  async storePasswordResetOtp(
    email,
    otpData,
    ttlSeconds = PASSWORD_RESET_OTP_TTL_SECONDS
  ) {
    const key = createPasswordResetOtpRedisKey(email);
    const redis = this._getRedis();
    const payload = JSON.stringify(otpData);
    return redis.set(key, payload, 'EX', ttlSeconds);
  }

  /**
   * Retrieves hashed Password Reset OTP record from Redis.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<Object|null>} Parsed OTP data object or null if expired/non-existent.
   */
  async getPasswordResetOtp(email) {
    const key = createPasswordResetOtpRedisKey(email);
    const redis = this._getRedis();
    const data = await redis.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Deletes Password Reset OTP record from Redis immediately.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<number>} Number of keys removed (0 or 1).
   */
  async deletePasswordResetOtp(email) {
    const key = createPasswordResetOtpRedisKey(email);
    const redis = this._getRedis();
    return redis.del(key);
  }

  /**
   * Sets password reset cooldown lock in Redis.
   *
   * @param {string} email - Target user email.
   * @param {number} [cooldownSeconds=PASSWORD_RESET_OTP_COOLDOWN_SECONDS] - Cooldown period in seconds.
   * @returns {Promise<'OK'|boolean>}
   */
  async setPasswordResetCooldown(
    email,
    cooldownSeconds = PASSWORD_RESET_OTP_COOLDOWN_SECONDS
  ) {
    const key = createPasswordResetCooldownRedisKey(email);
    const redis = this._getRedis();
    return redis.set(key, '1', 'EX', cooldownSeconds);
  }

  /**
   * Checks if an email is currently within the password reset cooldown window.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<{ inCooldown: boolean, ttlRemaining: number }>}
   */
  async getPasswordResetCooldown(email) {
    const key = createPasswordResetCooldownRedisKey(email);
    const redis = this._getRedis();
    const ttl = await redis.ttl(key);
    return {
      inCooldown: ttl > 0,
      ttlRemaining: Math.max(ttl, 0),
    };
  }

  /**
   * Retrieves the current hourly password reset request count for an email.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<number>}
   */
  async getPasswordResetRequestCount(email) {
    const key = createPasswordResetRateRedisKey(email);
    const redis = this._getRedis();
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  /**
   * Increments the hourly password reset request count for an email.
   * Sets TTL on first increment.
   *
   * @param {string} email - Target user email.
   * @param {number} [ttlSeconds=PASSWORD_RESET_OTP_RATE_WINDOW_SECONDS]
   * @returns {Promise<number>} New request count.
   */
  async incrementPasswordResetRequestCount(
    email,
    ttlSeconds = PASSWORD_RESET_OTP_RATE_WINDOW_SECONDS
  ) {
    const key = createPasswordResetRateRedisKey(email);
    const redis = this._getRedis();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  }

  /**
   * Cleans up all Password Reset OTP, cooldown, and rate limit tracking state for an email.
   *
   * @param {string} email - Target user email.
   * @returns {Promise<void>}
   */
  async clearAllPasswordResetOtpState(email) {
    const redis = this._getRedis();
    const normalized = normalizeEmail(email);
    await Promise.all([
      redis.del(createPasswordResetOtpRedisKey(normalized)),
      redis.del(createPasswordResetCooldownRedisKey(normalized)),
      redis.del(createPasswordResetRateRedisKey(normalized)),
    ]);
  }

  // ─── Refresh Token Persistence Operations (Sprint 2.10) ───────────────

  /**
   * Persists a new refresh token entity.
   *
   * @param {Object} tokenData
   * @param {string} tokenData.jti - Cryptographically unique JWT ID.
   * @param {string} tokenData.familyId - Cryptographically unique family ID.
   * @param {string|import('mongoose').Types.ObjectId} tokenData.userId - Owner user ID.
   * @param {string} [tokenData.status=ACTIVE] - Initial token status.
   * @param {Date} tokenData.expiresAt - Expiration timestamp.
   * @param {Date} [tokenData.issuedAt] - Issuance timestamp.
   * @returns {Promise<import('mongoose').Document>}
   */
  async createRefreshToken(tokenData) {
    return this._refreshTokenModel.create(tokenData);
  }

  /**
   * Finds a refresh token by its unique JWT ID (jti).
   *
   * @param {string} jti
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findRefreshTokenByJti(jti) {
    if (!jti || typeof jti !== 'string') return null;
    return this._refreshTokenModel.findOne({ jti });
  }

  /**
   * Finds an active refresh token by its jti and optional familyId.
   *
   * @param {string} jti
   * @param {string} [familyId]
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findActiveRefreshToken(jti, familyId) {
    if (!jti || typeof jti !== 'string') return null;
    const query = { jti, status: REFRESH_TOKEN_STATUSES.ACTIVE };
    if (familyId) query.familyId = familyId;
    return this._refreshTokenModel.findOne(query);
  }

  /**
   * Atomically transitions a refresh token from ACTIVE to CONSUMED.
   * Ensures single-use semantics and concurrency safety.
   *
   * @param {string} jti - Token ID to consume.
   * @param {string} familyId - Token family identifier.
   * @param {string} [replacedByTokenId] - Successor token identifier.
   * @param {Date} [now=new Date()] - Consumption timestamp.
   * @returns {Promise<import('mongoose').Document|null>} Updated document if successfully consumed, null if not active.
   */
  async consumeRefreshToken(
    jti,
    familyId,
    replacedByTokenId = null,
    now = new Date()
  ) {
    if (!jti || !familyId) return null;
    return this._refreshTokenModel.findOneAndUpdate(
      {
        jti,
        familyId,
        status: REFRESH_TOKEN_STATUSES.ACTIVE,
      },
      {
        $set: {
          status: REFRESH_TOKEN_STATUSES.CONSUMED,
          consumedAt: now,
          replacedByTokenId,
        },
      },
      { new: true }
    );
  }

  /**
   * Marks a token record as REUSED upon replay detection.
   * Preserves historical evidence for audit trails.
   *
   * @param {string} jti - Reused token identifier.
   * @param {Date} [reuseDetectedAt=new Date()] - Detection timestamp.
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async markTokenAsReused(jti, reuseDetectedAt = new Date()) {
    if (!jti) return null;
    return this._refreshTokenModel.findOneAndUpdate(
      { jti },
      {
        $set: {
          status: REFRESH_TOKEN_STATUSES.REUSED,
          reuseDetectedAt,
        },
      },
      { new: true }
    );
  }

  /**
   * Revokes all active/non-reused tokens belonging to an entire family upon theft/reuse detection.
   *
   * @param {string} familyId - Family identifier to revoke.
   * @param {string} [reason='Refresh token reuse detected'] - Revocation reason.
   * @param {Date} [revokedAt=new Date()] - Revocation timestamp.
   * @returns {Promise<import('mongodb').UpdateResult>}
   */
  async revokeTokenFamily(
    familyId,
    reason = 'Refresh token reuse detected',
    revokedAt = new Date()
  ) {
    if (!familyId) return { modifiedCount: 0 };
    return this._refreshTokenModel.updateMany(
      {
        familyId,
        status: { $ne: REFRESH_TOKEN_STATUSES.REUSED },
      },
      {
        $set: {
          status: REFRESH_TOKEN_STATUSES.REVOKED,
          revokedAt,
          revokedReason: reason,
        },
      }
    );
  }

  /**
   * Retrieves all token records for a given family (for audit and inspection).
   *
   * @param {string} familyId
   * @returns {Promise<Array<import('mongoose').Document>>}
   */
  async getTokensByFamily(familyId) {
    if (!familyId) return [];
    return this._refreshTokenModel.find({ familyId }).sort({ issuedAt: 1 });
  }
}

const authRepositoryInstance = new AuthRepository();

module.exports = authRepositoryInstance;
module.exports.AuthRepository = AuthRepository;
module.exports.authRepository = authRepositoryInstance;
