const mongoose = require('mongoose');
const config = require('./env.config');

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
    console.log(
      `[Database] Mongoose connected to MongoDB cluster at ${db.host}:${db.port}/${db.name}`
    );
  });

  db.on('error', (err) => {
    console.error(`[Database] Mongoose connection error: ${err.message}`);
  });

  db.on('disconnected', () => {
    console.warn('[Database] Mongoose connection disconnected.');
  });

  db.on('reconnected', () => {
    console.log('[Database] Mongoose successfully reconnected to MongoDB.');
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
    console.error(
      `[Database] Connection attempt ${retryCount + 1} failed: ${error.message}`
    );

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_INTERVAL_MS * Math.pow(2, retryCount);
      console.log(`[Database] Retrying connection in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectDatabase(retryCount + 1);
    }

    console.error(
      `[Database] Failed to connect to MongoDB after ${MAX_RETRIES} attempts.`
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
    console.log('[Database] Mongoose connection closed gracefully.');
  } catch (error) {
    console.error(
      `[Database] Error closing Mongoose connection: ${error.message}`
    );
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
