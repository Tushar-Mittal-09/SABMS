const argon2 = require('argon2');

const PASSWORD_POLICY = Object.freeze({
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  ALLOWED_SPECIAL_CHARS: '@$!%*?&#^~_-',
  SPECIAL_CHAR_REGEX: /[@$!%*?&#^~_-]/,
  UPPERCASE_REGEX: /[A-Z]/,
  LOWERCASE_REGEX: /[a-z]/,
  NUMBER_REGEX: /\d/,
});

const ARGON2_CONFIG = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 threads
});

const PASSWORD_ALGORITHM = 'argon2id';

module.exports = {
  PASSWORD_POLICY,
  ARGON2_CONFIG,
  PASSWORD_ALGORITHM,
};
