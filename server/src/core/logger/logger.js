'use strict';

const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('../../config/env.config');

// ─── Custom Log Levels & Colors ─────────────────────────────────────────────
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// ─── Log Directory ──────────────────────────────────────────────────────────
const LOG_DIR = path.resolve(__dirname, '../../../logs');

// ─── Format Utilities ───────────────────────────────────────────────────────

/**
 * Base timestamp format shared across all transports.
 */
const timestampFormat = winston.format.timestamp({
  format: 'YYYY-MM-DD HH:mm:ss.SSS',
});

/**
 * Development Console Format
 * Colorized output with timestamp, level, requestId (when present), and message.
 */
const devConsoleFormat = winston.format.combine(
  timestampFormat,
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const reqIdTag = requestId ? ` [reqId: ${requestId}]` : '';
    const metaStr =
      Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} ${level}:${reqIdTag} ${message}${metaStr}`;
  })
);

/**
 * Production JSON Format
 * Structured JSON logs for log aggregation systems (ELK, CloudWatch, etc.).
 */
const prodJsonFormat = winston.format.combine(
  timestampFormat,
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ─── Transports ─────────────────────────────────────────────────────────────
const transports = [];

/**
 * Console Transport
 * Active in development and test environments.
 * Uses colorized human-readable format.
 */
if (!config.isProduction) {
  transports.push(
    new winston.transports.Console({
      format: devConsoleFormat,
    })
  );
}

/**
 * Combined Daily Rotate File Transport
 * Captures all log levels for general application activity.
 * Rotates daily, max 20MB per file, retains 14 days of history.
 */
if (!config.isTest) {
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
      format: prodJsonFormat,
    })
  );

  /**
   * Error Daily Rotate File Transport
   * Captures only error-level logs for critical issue investigation.
   * Rotates daily, max 20MB per file, retains 30 days of history.
   */
  transports.push(
    new winston.transports.DailyRotateFile({
      level: 'error',
      filename: path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
      format: prodJsonFormat,
    })
  );
}

// ─── Core Winston Logger Instance ───────────────────────────────────────────
const logger = winston.createLogger({
  level: config.logLevel || 'debug',
  levels,
  defaultMeta: { service: config.appName },
  transports,
  exitOnError: false,
});

// ─── Morgan Stream Integration ──────────────────────────────────────────────

/**
 * Write stream that pipes Morgan HTTP request logs into Winston's `http` level.
 * Morgan appends a newline character that must be trimmed.
 */
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// ─── Audit Logger ───────────────────────────────────────────────────────────

/**
 * Dedicated Audit Daily Rotate File Transport
 * Captures security and compliance audit events.
 * Isolated from application logs to support independent retention policies.
 * Rotates daily, retains 90 days of history.
 */
const auditTransports = [];
if (!config.isTest) {
  auditTransports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      zippedArchive: true,
      format: prodJsonFormat,
    })
  );
} else {
  auditTransports.push(new winston.transports.Console({ silent: true }));
}

const auditLogger = winston.createLogger({
  level: 'info',
  levels,
  defaultMeta: { service: `${config.appName}-audit` },
  transports: auditTransports,
  exitOnError: false,
});

/**
 * Audit log helper
 * Logs security-sensitive and compliance events to the dedicated audit stream.
 *
 * @param {string} action  - The audit action identifier (e.g., 'USER_LOGIN', 'ROLE_CHANGE').
 * @param {Object} details - Contextual metadata for the audit event.
 */
logger.audit = (action, details = {}) => {
  auditLogger.info({
    action,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Gracefully closes all Winston transports for clean test teardown.
 */
const closeLogger = () => {
  logger.transports.forEach((t) => {
    if (typeof t.close === 'function') {
      t.close();
    }
  });
  logger.close();

  auditLogger.transports.forEach((t) => {
    if (typeof t.close === 'function') {
      t.close();
    }
  });
  auditLogger.close();
};

logger.closeLogger = closeLogger;

module.exports = logger;
