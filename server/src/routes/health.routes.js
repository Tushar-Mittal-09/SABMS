const express = require('express');
const os = require('os');
const { StatusCodes } = require('http-status-codes');
const { ApiResponse } = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/env.config');
const { getDbState } = require('../config/database');
const { validateQuery } = require('../validations');
const { z } = require('../validations');

const router = express.Router();

const SERVICE_STATUS = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
});

const getMemoryUsage = () => {
  const mem = process.memoryUsage();
  return {
    rssBytes: mem.rss,
    heapTotalBytes: mem.heapTotal,
    heapUsedBytes: mem.heapUsed,
    externalBytes: mem.external || 0,
    heapUsedPercent: mem.heapTotal
      ? Number(((mem.heapUsed / mem.heapTotal) * 100).toFixed(2))
      : 0,
  };
};

const getSystemInfo = () => ({
  hostname: os.hostname(),
  platform: os.platform(),
  arch: os.arch(),
  cpus: os.cpus().length,
  loadAverage: os.loadavg(),
  totalMemoryBytes: os.totalmem(),
  freeMemoryBytes: os.freemem(),
  memoryUsedPercent: Number(
    (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2)
  ),
  uptimeSeconds: os.uptime(),
  processId: process.pid,
  nodeVersion: process.version,
  runtime: 'Node.js',
});

const buildBaseHealth = (req) => {
  const dbHealth = getDbState();
  const overallStatus = dbHealth.isConnected
    ? SERVICE_STATUS.HEALTHY
    : SERVICE_STATUS.DEGRADED;

  return {
    status: overallStatus,
    requestId: req.id,
    app: {
      name: config.appName,
      version: config.apiBaseUrl,
      environment: config.env,
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      startedAt: new Date(
        Date.now() - Math.floor(process.uptime() * 1000)
      ).toISOString(),
      timestamp: new Date().toISOString(),
    },
    services: {
      database: {
        ...dbHealth,
        status: dbHealth.isConnected
          ? SERVICE_STATUS.HEALTHY
          : SERVICE_STATUS.UNHEALTHY,
      },
    },
  };
};

router.get(
  '/',
  validateQuery(
    z.object({
      format: z.enum(['full', 'minimal']).default('minimal').optional(),
    })
  ),
  catchAsync(async (req, res) => {
    const format = req.query.format || 'minimal';
    const health = buildBaseHealth(req);

    if (format === 'minimal') {
      const data = {
        status: health.status,
        timestamp: health.app.timestamp,
        uptimeSeconds: health.app.uptimeSeconds,
        requestId: health.requestId,
        services: {
          database: {
            status: health.services.database.status,
          },
        },
      };

      if (health.status === SERVICE_STATUS.HEALTHY) {
        return res.success(data, 'System operational');
      }

      return ApiResponse.send(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        ApiResponse.formatError('Service degraded', data)
      );
    }

    if (format === 'full') {
      const data = {
        ...health,
        system: getSystemInfo(),
        memory: getMemoryUsage(),
      };

      if (health.status === SERVICE_STATUS.HEALTHY) {
        return res.success(data, 'System operational (full)');
      }

      return ApiResponse.send(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        ApiResponse.formatError('Service degraded (full)', data)
      );
    }
  })
);

router.get(
  '/ready',
  catchAsync(async (req, res) => {
    const dbHealth = getDbState();
    const data = {
      ready: dbHealth.isConnected,
      timestamp: new Date().toISOString(),
      requestId: req.id,
      checks: {
        database: dbHealth.isConnected,
      },
    };

    if (data.ready) {
      return res.success(data, 'Service ready');
    }

    return ApiResponse.send(
      res,
      StatusCodes.SERVICE_UNAVAILABLE,
      ApiResponse.formatError('Service not ready', data)
    );
  })
);

router.get(
  '/live',
  catchAsync(async (req, res) => {
    return res.success(
      {
        live: true,
        timestamp: new Date().toISOString(),
        requestId: req.id,
      },
      'Service live'
    );
  })
);

router.get(
  '/info',
  catchAsync(async (req, res) => {
    return res.success(
      {
        appName: config.appName,
        apiVersion: config.apiBaseUrl,
        environment: config.env,
        nodeVersion: process.version,
        processId: process.pid,
        platform: process.platform,
        hostname: os.hostname(),
        requestId: req.id,
        timestamp: new Date().toISOString(),
      },
      'Service information'
    );
  })
);

module.exports = {
  healthRouter: router,
  SERVICE_STATUS,
  buildBaseHealth,
  getMemoryUsage,
  getSystemInfo,
};
