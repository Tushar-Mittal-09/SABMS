const mongoose = require('mongoose');
const config = require('./env.config');
const logger = require('../utils/logger');

/**
 * Production-ready Mongoose Connection Options
 */
const mongooseOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
  autoIndex: !config.isProduction, // Disable auto-indexing in production for performance
};

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;

/**
 * Register Mongoose connection event listeners
 */
const setupConnectionEvents = () => {
  const db = mongoose.connection;

  db.on('connected', () => {
    logger.info(
      `Mongoose connected to MongoDB cluster at ${db.host}:${db.port}/${db.name}`,
      { context: 'Database' }
    );
  });

  db.on('error', (err) => {
    logger.error(`Mongoose connection error: ${err.message}`, {
      context: 'Database',
    });
  });

  db.on('disconnected', () => {
    logger.warn('Mongoose connection disconnected.', {
      context: 'Database',
    });
  });

  db.on('reconnected', () => {
    logger.info('Mongoose successfully reconnected to MongoDB.', {
      context: 'Database',
    });
  });
};

// Register events once on module load
setupConnectionEvents();

/**
 * Connect to MongoDB with exponential backoff retries
 */
const connectDatabase = async (retryCount = 0) => {
  try {
    await mongoose.connect(config.db.uri, mongooseOptions);
  } catch (error) {
    logger.error(
      `Connection attempt ${retryCount + 1} failed: ${error.message}`,
      { context: 'Database' }
    );

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_INTERVAL_MS * Math.pow(2, retryCount);
      logger.info(`Retrying connection in ${delay / 1000}s...`, {
        context: 'Database',
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectDatabase(retryCount + 1);
    }

    logger.error(
      `Failed to connect to MongoDB after ${MAX_RETRIES} attempts.`,
      { context: 'Database' }
    );
    throw error;
  }
};

/**
 * Gracefully close MongoDB connection
 */
const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close();
    logger.info('Mongoose connection closed gracefully.', {
      context: 'Database',
    });
  } catch (error) {
    logger.error(`Error closing Mongoose connection: ${error.message}`, {
      context: 'Database',
    });
  }
};

/**
 * Get current database health state
 */
const getDbState = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const readyState = mongoose.connection.readyState;
  const isConnected = readyState === 1;

  return {
    isConnected,
    readyState,
    status: states[readyState] || 'unknown',
    host: mongoose.connection.host || null,
    dbName: mongoose.connection.name || null,
  };
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDbState,
};
