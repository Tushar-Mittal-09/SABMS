const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const config = require('../config/env.config');
const { ApiResponse } = require('../utils/apiResponse');
const requestId = require('./requestId.middleware');

/**
 * 1. Helmet Security Middleware
 * Enterprise HTTP Security Header configuration
 */
const helmetSecurity = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      connectSrc: ["'self'", config.clientUrl],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: config.isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: config.isProduction
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

/**
 * 2. CORS Middleware
 * Cross-Origin Resource Sharing control
 */
const corsSecurity = cors({
  origin: (origin, callback) => {
    if (!origin || config.isDevelopment || config.isTest) {
      return callback(null, true);
    }
    const allowedOrigins = [config.clientUrl].filter(Boolean);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(
      new Error(`CORS security policy violation: Origin ${origin} not allowed`)
    );
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'Accept',
    'X-Requested-With',
  ],
  exposedHeaders: ['X-Request-ID', 'Content-Range', 'X-Total-Count'],
  maxAge: 86400,
});

/**
 * 3. HPP (HTTP Parameter Pollution) Middleware
 * Prevents parameter pollution attacks while allowing whitelisted query arrays
 */
const hppSecurity = hpp({
  whitelist: [
    'sort',
    'fields',
    'page',
    'limit',
    'status',
    'category',
    'search',
    'date',
    'type',
    'role',
  ],
});

/**
 * 4. Mongo Sanitize Middleware
 * Prevents MongoDB NoSQL operator injection ($ and .) in Express 5
 * Sanitizes req.body, req.params, and properties in req.query in place
 * without overwriting the Express 5 read-only req.query getter.
 */
const mongoSanitizeSecurity = (req, res, next) => {
  const sanitizeOptions = {
    allowDots: false,
    replaceWith: '_',
  };

  if (req.body && typeof req.body === 'object') {
    mongoSanitize.sanitize(req.body, sanitizeOptions);
  }

  if (req.params && typeof req.params === 'object') {
    mongoSanitize.sanitize(req.params, sanitizeOptions);
  }

  if (req.query && typeof req.query === 'object') {
    mongoSanitize.sanitize(req.query, sanitizeOptions);
  }

  if (req.headers && typeof req.headers === 'object') {
    Object.keys(req.headers).forEach((headerKey) => {
      if (
        headerKey.startsWith('x-') &&
        typeof req.headers[headerKey] === 'object'
      ) {
        mongoSanitize.sanitize(req.headers[headerKey], sanitizeOptions);
      }
    });
  }

  next();
};

/**
 * 5. Rate Limiter Middleware
 * Protects endpoints against denial of service and brute force attacks
 */
const rateLimiterSecurity = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  handler: (req, res, next, options) => {
    return ApiResponse.send(
      res,
      429,
      ApiResponse.formatError(
        'Too many requests from this IP, please try again later.',
        {
          windowMs: options.windowMs,
          max: options.max,
        }
      )
    );
  },
});

const compressionSecurity = compression({
  filter: (req, res) => {
    const isTest =
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID !== undefined ||
      (Array.isArray(process.argv) &&
        process.argv.some(
          (arg) => typeof arg === 'string' && arg.includes('jest')
        ));

    if (req.headers['x-no-compression'] || isTest) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
});

/**
 * 7. Cookie Parser Middleware
 * Parses incoming cookies with secure signing key
 */
const cookieParserSecurity = cookieParser(config.cookieSecret);

/**
 * 8. Request Size Limits Middleware
 * Limits HTTP request body payload sizes to prevent DoS attacks
 */
const jsonBodyParser = express.json({ limit: config.payloadSizeLimit });
const urlencodedBodyParser = express.urlencoded({
  extended: true,
  limit: config.payloadSizeLimit,
});

/**
 * Applies all enterprise security middlewares in proper execution sequence.
 *
 * @param {import('express').Application} app
 */
const applySecurityMiddleware = (app) => {
  // 0. Extended Query Parser
  app.set('query parser', 'extended');

  // 1. Request correlation ID tracking
  app.use(requestId);

  // 2. HTTP Security Headers
  app.use(helmetSecurity);

  // 3. CORS
  app.use(corsSecurity);

  // 4. Rate Limiting
  app.use(rateLimiterSecurity);

  // 5. Response Compression
  app.use(compressionSecurity);

  // 6. Cookie Parser
  app.use(cookieParserSecurity);

  // 7. Request Body Parsers & Size Limits
  app.use(jsonBodyParser);
  app.use(urlencodedBodyParser);

  // 8. NoSQL Injection Sanitization
  app.use(mongoSanitizeSecurity);

  // 9. HTTP Parameter Pollution Defense
  app.use(hppSecurity);
};

module.exports = {
  applySecurityMiddleware,
  helmetSecurity,
  corsSecurity,
  hppSecurity,
  mongoSanitizeSecurity,
  rateLimiterSecurity,
  compressionSecurity,
  cookieParserSecurity,
  requestId,
  jsonBodyParser,
  urlencodedBodyParser,
};
