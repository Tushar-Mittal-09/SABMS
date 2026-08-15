const { User } = require('../models');

class UserRepository {
  /**
   * Find a user by MongoDB ObjectId (safe lookup without passwordHash)
   * @param {string|import('mongoose').Types.ObjectId} id
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findById(id) {
    return User.findById(id);
  }

  /**
   * Find a user by email (safe lookup without passwordHash)
   * @param {string} email
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const normalizedEmail = email.trim().toLowerCase();
    return User.findOne({ email: normalizedEmail });
  }

  /**
   * Find a user by email explicitly including passwordHash for credential validation
   * @param {string} email
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByEmailWithPasswordHash(email) {
    if (!email || typeof email !== 'string') return null;
    const normalizedEmail = email.trim().toLowerCase();
    return User.findOne({ email: normalizedEmail }).select('+passwordHash');
  }

  /**
   * Find a user by phone (safe lookup without passwordHash)
   * @param {string} phone
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByPhone(phone) {
    if (!phone || typeof phone !== 'string') return null;
    const normalizedPhone = phone.trim();
    return User.findOne({ phone: normalizedPhone });
  }

  /**
   * Check whether a user with the given email exists
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async existsByEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const normalizedEmail = email.trim().toLowerCase();
    const result = await User.exists({ email: normalizedEmail });
    return result !== null;
  }

  /**
   * Check whether a user with the given phone exists
   * @param {string} phone
   * @returns {Promise<boolean>}
   */
  async existsByPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const normalizedPhone = phone.trim();
    const result = await User.exists({ phone: normalizedPhone });
    return result !== null;
  }

  /**
   * Persist a new User document
   * @param {Object} userData
   * @returns {Promise<import('mongoose').Document>}
   */
  async create(userData) {
    const user = new User(userData);
    return user.save();
  }

  /**
   * Update a User document by ID with validator execution
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {Object} updateData
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async updateById(id, updateData) {
    return User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }
}

const userRepositoryInstance = new UserRepository();

module.exports = userRepositoryInstance;
module.exports.UserRepository = UserRepository;
