const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { StatusCodes } = require('http-status-codes');

const logger = require('./utils/logger');

const config = require('./config/env.config');
const { getDbState } = require('./config/database');
const requestId = require('./middleware/requestId.middleware');

const app = express();

// 1. Trust Proxy Configuration for Reverse Proxies (NGINX/Cloudflare)
app.set('trust proxy', config.isProduction ? 1 : false);

// 2. Request Correlation ID Middleware
app.use(requestId);

// 3. HTTP Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'", config.clientUrl],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 4. Cross-Origin Resource Sharing (CORS)
app.use(
  cors({
    origin: config.clientUrl || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
  })
);

// 5. HTTP Request Logging (Morgan → Winston stream with Correlation ID token)
morgan.token('req-id', (req) => req.id || 'N/A');
const morganFormat = config.isProduction
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - [reqId: :req-id] - :response-time ms'
  : ':method :url :status :response-time ms - reqId: :req-id';

app.use(morgan(morganFormat, { stream: logger.stream }));

// 6. Response Compression (gzip/brotli)
app.use(compression());

// 7. Cookie Parser
app.use(cookieParser());

// 8. Body Parsers (JSON & URL-encoded with payload limits)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 9. Base System Health Check Endpoint
app.get('/health', (req, res) => {
  const dbHealth = getDbState();
  const httpStatus = dbHealth.isConnected
    ? StatusCodes.OK
    : StatusCodes.SERVICE_UNAVAILABLE;

  res.status(httpStatus).json({
    status: dbHealth.isConnected ? 'success' : 'degraded',
    appName: config.appName,
    environment: config.env,
    apiVersion: config.apiBaseUrl,
    requestId: req.id,
    database: dbHealth,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 10. Resource Not Found (404) Fallback Handler
app.use((req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    status: 'fail',
    message: `Cannot find ${req.method} ${req.originalUrl} on this server`,
    requestId: req.id,
  });
});

// 11. Global Error Handler Placeholder
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    requestId: req.id,
    ...(config.isDevelopment && { stack: err.stack }),
  });
});

module.exports = app;
