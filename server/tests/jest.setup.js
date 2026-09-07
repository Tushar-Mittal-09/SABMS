'use strict';

const { disconnectRedis } = require('../src/config/redis');
const logger = require('../src/core/logger');

afterAll(async () => {
  await disconnectRedis();
  if (typeof logger.closeLogger === 'function') {
    logger.closeLogger();
  }
});
