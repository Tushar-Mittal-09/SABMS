'use strict';

const userRepository = require('../users/user.repository');

/**
 * Authentication Persistence Repository.
 *
 * Encapsulates authentication-specific persistence operations,
 * credential retrievals, and user lookups.
 */
class AuthRepository {
  constructor(userRepo = userRepository) {
    this._userRepository = userRepo;
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
   * Persist a new registered user.
   * @param {Object} userData
   * @returns {Promise<import('mongoose').Document>}
   */
  async create(userData) {
    return this._userRepository.create(userData);
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
}

const authRepositoryInstance = new AuthRepository();

module.exports = authRepositoryInstance;
module.exports.AuthRepository = AuthRepository;
module.exports.authRepository = authRepositoryInstance;
