'use strict';

const Redis = require('ioredis');
const config = require('./env.config');
const logger = require('../core/logger');

let redisClient = null;
let isConnecting = false;

/**
 * Builds Redis client options based on application configuration
 */
const buildRedisOptions = () => {
  const options = {
    host: config.redis.host || 'localhost',
    port: config.redis.port || 6379,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    showFriendlyErrorStack: !config.isProduction,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  };

  if (config.redis.password) {
    options.password = config.redis.password;
  }

  return options;
};

/**
 * Retrieves the singleton Redis client instance.
 * Lazily initializes the client if not already created.
 *
 * @returns {import('ioredis').Redis}
 */
const getRedisClient = () => {
  if (!redisClient) {
    const redisOptions = buildRedisOptions();

    if (config.redis.url && config.redis.url.startsWith('redis://')) {
      redisClient = new Redis(config.redis.url, redisOptions);
    } else {
      redisClient = new Redis(redisOptions);
    }

    redisClient.on('connect', () => {
      logger.info('Redis client connected', { context: 'Redis' });
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready to process commands', {
        context: 'Redis',
      });
    });

    redisClient.on('error', (err) => {
      logger.error(`Redis connection error: ${err.message}`, {
        context: 'Redis',
      });
    });

    redisClient.on('close', () => {
      logger.warn('Redis client connection closed', { context: 'Redis' });
    });

    redisClient.on('reconnecting', (delay) => {
      logger.info(`Redis reconnecting in ${delay}ms`, { context: 'Redis' });
    });
  }

  return redisClient;
};

/**
 * Connects to Redis with error handling.
 * Safe for startup orchestration.
 *
 * @returns {Promise<import('ioredis').Redis|null>}
 */
const connectRedis = async () => {
  if (isConnecting) return redisClient;

  try {
    isConnecting = true;
    const client = getRedisClient();
    if (
      client.status === 'ready' ||
      client.status === 'connecting' ||
      client.status === 'connect'
    ) {
      return client;
    }
    await client.connect();
    return client;
  } catch (error) {
    logger.error(`Failed to connect to Redis: ${error.message}`, {
      context: 'Redis',
    });
    return null;
  } finally {
    isConnecting = false;
  }
};

/**
 * Gracefully disconnects the Redis client.
 *
 * @returns {Promise<void>}
 */
const disconnectRedis = async () => {
  if (redisClient) {
    try {
      if (redisClient.status !== 'end') {
        await redisClient.quit();
      }
      logger.info('Redis connection closed gracefully', { context: 'Redis' });
    } catch (error) {
      logger.error(`Error closing Redis connection: ${error.message}`, {
        context: 'Redis',
      });
      try {
        redisClient.disconnect();
      } catch {
        /* ignore */
      }
    } finally {
      redisClient = null;
    }
  }
};

/**
 * Gets the current Redis connection health state.
 *
 * @returns {{ isConnected: boolean, status: string, host: string|null, port: number|null }}
 */
const getRedisState = () => {
  if (!redisClient) {
    return {
      isConnected: false,
      status: 'uninitialized',
      host: config.redis.host || null,
      port: config.redis.port || null,
    };
  }

  const isConnected = redisClient.status === 'ready';
  return {
    isConnected,
    status: redisClient.status,
    host: config.redis.host || null,
    port: config.redis.port || null,
  };
};

module.exports = {
  getRedisClient,
  connectRedis,
  disconnectRedis,
  getRedisState,
  get redisClient() {
    return getRedisClient();
  },
};
