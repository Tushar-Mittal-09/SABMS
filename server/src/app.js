const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { StatusCodes } = require('http-status-codes');
const config = require('./config/env.config');

const app = express();

// Security & Utility Middleware
app.use(helmet());
app.use(cors({ origin: config.clientUrl || '*' }));
app.use(morgan(config.isProduction ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Base System Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(StatusCodes.OK).json({
    status: 'success',
    appName: config.appName,
    environment: config.env,
    apiVersion: config.apiBaseUrl,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Resource Not Found (404) Fallback Handler
app.use((req, res, next) => {
  res.status(StatusCodes.NOT_FOUND).json({
    status: 'fail',
    message: `Cannot find ${req.originalUrl} on this server`,
  });
});

// Global Error Handler Placeholder
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(config.isDevelopment && { stack: err.stack }),
  });
});

module.exports = app;
