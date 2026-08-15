'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { StatusCodes } = require('http-status-codes');
const { z } = require('zod');

const config = require('../config/env.config');
const { getDbState } = require('../config/database');
const logger = require('../core/logger');
const AppError = require('../core/errors/AppError');
const { ApiResponse } = require('../core/response/apiResponse');
const catchAsync = require('../shared/utils/catchAsync');
const {
  validateQuery,
} = require('../core/middleware/validateRequest.middleware');
const {
  API_VERSIONS,
  CURRENT_VERSION,
  SUPPORTED_VERSIONS,
  VERSION_HEADERS,
  buildVersionPath,
  buildCurrentVersionPath,
  isSupportedVersion,
} = require('../shared/constants/apiVersions');

const MODULES_DIR = path.resolve(__dirname, '../modules');

// ─── Health / System Router ──────────────────────────────────────────────────

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

const healthRouter = express.Router();

healthRouter.get(
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

healthRouter.get(
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

healthRouter.get(
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

healthRouter.get(
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

// ─── Route Aggregator & Versioning Utilities ─────────────────────────────────

const createVersionedRouter = (version, options = {}) => {
  const { caseSensitive = false, strict = false } = options;

  if (!isSupportedVersion(version)) {
    throw new Error(
      `Unsupported API version: ${version}. Supported: ${SUPPORTED_VERSIONS.join(', ')}`
    );
  }

  const router = express.Router({ caseSensitive, strict });
  router._apiVersion = version;
  router._mountPath = buildVersionPath(version, '', config.apiPrefix);

  router.use((req, res, next) => {
    req.apiVersion = version;
    next();
  });

  return router;
};

const createRouter = (options = {}) => {
  const { caseSensitive = false, strict = false, prefix = '' } = options;
  return express.Router({ caseSensitive, strict, prefix });
};

const mountRoutes = (app, routes, options = {}) => {
  const { prefix = config.apiBaseUrl, logger: enableLogging = true } = options;

  const mounted = [];

  routes.forEach(({ path: routePath, router, version, middlewares = [] }) => {
    let fullPath;

    if (version) {
      fullPath = buildVersionPath(version, routePath, config.apiPrefix);
    } else if (routePath.startsWith('/')) {
      fullPath = routePath;
    } else {
      fullPath = `${prefix}/${routePath}`;
    }

    if (enableLogging) {
      logger.info('Mounting route', {
        path: fullPath,
        version: version || 'unversioned',
        hasMiddlewares: middlewares.length > 0,
      });
    }

    if (middlewares.length > 0) {
      app.use(fullPath, ...middlewares, router);
    } else {
      app.use(fullPath, router);
    }

    mounted.push({ path: fullPath, version: version || null });
  });

  return mounted;
};

const versionRouter = (routersByVersion) => {
  const rootRouter = express.Router({ mergeParams: true });

  SUPPORTED_VERSIONS.forEach((version) => {
    const versionRouterInstance = routersByVersion[version];
    if (versionRouterInstance) {
      const versionPath = buildVersionPath(
        version,
        '',
        config.apiPrefix
      ).replace(config.apiPrefix, '');
      rootRouter.use(versionPath, versionRouterInstance);
    }
  });

  if (routersByVersion[CURRENT_VERSION]) {
    rootRouter.use(
      buildCurrentVersionPath('', config.apiPrefix).replace(
        config.apiPrefix,
        ''
      ),
      (req, res, next) => {
        res.set(VERSION_HEADERS.API_VERSION, CURRENT_VERSION);
        if (CURRENT_VERSION !== API_VERSIONS.V1) {
          res.set(VERSION_HEADERS.DEPRECATED, 'true');
        }
        next();
      },
      routersByVersion[CURRENT_VERSION]
    );
  }

  return rootRouter;
};

const moduleDirectoryExists = (modulePath) => {
  try {
    return fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory();
  } catch {
    return false;
  }
};

const discoverModuleRoutes = (basePath, version = CURRENT_VERSION) => {
  const discovered = [];
  const modulesDir = path.resolve(basePath);

  if (!moduleDirectoryExists(modulesDir)) {
    logger.warn('Modules directory not found, skipping module discovery', {
      path: modulesDir,
    });
    return discovered;
  }

  const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
  const moduleFolders = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  moduleFolders.forEach((moduleName) => {
    const moduleDir = path.join(modulesDir, moduleName);
    const singularName = moduleName.replace(/s$/, '');

    const candidateFiles = [
      path.join(moduleDir, `${moduleName}.routes.js`),
      path.join(moduleDir, `${singularName}.routes.js`),
      path.join(moduleDir, version, `${moduleName}.routes.js`),
      path.join(moduleDir, version, `${singularName}.routes.js`),
    ];

    let routeFilePath = null;
    for (const file of candidateFiles) {
      if (fs.existsSync(file)) {
        routeFilePath = file;
        break;
      }
    }

    if (routeFilePath) {
      try {
        const moduleExports = require(routeFilePath);

        const routerExport =
          moduleExports.router ||
          moduleExports[`${moduleName}Router`] ||
          moduleExports[`${singularName}Router`] ||
          moduleExports.default;

        if (routerExport && typeof routerExport === 'function') {
          discovered.push({
            module: moduleName,
            path: `/${moduleName}`,
            router: routerExport,
            version,
            source: routeFilePath,
          });
          logger.info('Discovered module route', {
            module: moduleName,
            version,
            path: `/${moduleName}`,
          });
        } else {
          logger.warn('Module routes file found but no valid router export', {
            module: moduleName,
            file: routeFilePath,
          });
        }
      } catch (error) {
        logger.error('Failed to load module routes', {
          module: moduleName,
          file: routeFilePath,
          error: error.message,
        });
      }
    }
  });

  return discovered;
};

const registerModuleRoutes = (
  rootRouter,
  modulesDir,
  version = CURRENT_VERSION
) => {
  const discovered = discoverModuleRoutes(modulesDir, version);
  const mounted = [];

  discovered.forEach(({ module: moduleName, path: routePath, router }) => {
    rootRouter.use(routePath, router);
    mounted.push({ module: moduleName, path: routePath, version });
  });

  return mounted;
};

const buildVersionedModuleTree = (modulesDir) => {
  const tree = {};

  SUPPORTED_VERSIONS.forEach((version) => {
    tree[version] = createVersionedRouter(version);
    const mounted = registerModuleRoutes(tree[version], modulesDir, version);
    if (mounted.length === 0) {
      logger.debug('No modules discovered for API version', { version });
    }
  });

  return tree;
};

const ROUTE_MODULES = Object.freeze({
  AUTH: 'auth',
  USERS: 'users',
  VENUES: 'venues',
  BOOKINGS: 'bookings',
  EVENTS: 'events',
  APPROVALS: 'approvals',
  NOTIFICATIONS: 'notifications',
  ANALYTICS: 'analytics',
});

const SUGGESTION_THRESHOLD = 3;

const computeLevenshtein = (a, b) => {
  const matrix = [];
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  for (let i = 0; i <= lenB; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenA; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenB; i++) {
    for (let j = 1; j <= lenA; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[lenB][lenA];
};

const findSimilarRoutes = (targetPath, knownPaths, maxSuggestions = 3) => {
  const normalizedTarget = targetPath.toLowerCase().replace(/\/+$/, '');
  const targetSegments = normalizedTarget.split('/').filter(Boolean);

  const scored = knownPaths
    .map((known) => {
      const normalizedKnown = known.toLowerCase().replace(/\/+$/, '');
      const distance = computeLevenshtein(normalizedTarget, normalizedKnown);
      const maxLen = Math.max(
        normalizedTarget.length,
        normalizedKnown.length,
        1
      );
      const similarity = 1 - distance / maxLen;

      let segmentMatches = 0;
      const knownSegments = normalizedKnown.split('/').filter(Boolean);
      targetSegments.forEach((seg) => {
        if (knownSegments.includes(seg)) segmentMatches++;
      });
      const segmentScore = targetSegments.length
        ? segmentMatches / targetSegments.length
        : 0;

      const combinedScore = similarity * 0.6 + segmentScore * 0.4;

      return { path: known, score: combinedScore, distance };
    })
    .filter((s) => s.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);

  return scored.map((s) => s.path);
};

const versionMiddleware = (req, res, next) => {
  const headerVersion = req.get('X-API-Version') || req.get('Accept-Version');

  if (headerVersion && !isSupportedVersion(headerVersion)) {
    return next(
      AppError.badRequest(
        `Unsupported API version header. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`
      )
    );
  }

  const urlMatch = req.originalUrl.match(/\/api\/(v\d+)\//);
  const urlVersion = urlMatch ? urlMatch[1] : null;

  if (urlVersion && !isSupportedVersion(urlVersion)) {
    return next(
      AppError.badRequest(
        `Unsupported API version in URL. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`
      )
    );
  }

  req.apiVersion = urlVersion || headerVersion || CURRENT_VERSION;
  next();
};

const findRouterStack = (app) => {
  if (!app) return null;

  if (
    app._router &&
    Array.isArray(app._router.stack) &&
    app._router.stack.length > 0
  ) {
    return app._router.stack;
  }

  if (Array.isArray(app.stack) && app.stack.length > 0) {
    return app.stack;
  }

  if (
    app._router &&
    app._router._router &&
    Array.isArray(app._router._router.stack)
  ) {
    return app._router._router.stack;
  }

  if (typeof app.lazyrouter === 'function') {
    try {
      app.lazyrouter();
      if (app._router && Array.isArray(app._router.stack)) {
        return app._router.stack;
      }
    } catch {
      /* ignore */
    }
  }

  const candidates = ['_router', 'router', '__router', '_internalRouter'];
  for (const key of candidates) {
    const candidate = app[key];
    if (
      candidate &&
      Array.isArray(candidate.stack) &&
      candidate.stack.length > 0
    ) {
      return candidate.stack;
    }
  }

  return null;
};

const extractRoutePaths = (app) => {
  const paths = new Set();

  const extract = (stack, parentPath = '') => {
    stack.forEach((layer) => {
      if (layer && layer.route) {
        const fullPath = parentPath + layer.route.path;
        const cleanPath =
          fullPath.replace(/\/:[^/]+/g, '/{param}').replace(/\/*$/, '') || '/';
        paths.add(cleanPath);
      } else if (layer && layer.handle && typeof layer.handle === 'function') {
        const subStack =
          layer.handle.stack ||
          (layer.handle._router && layer.handle._router.stack);
        if (Array.isArray(subStack) && subStack.length > 0) {
          let prefix = '';
          if (layer.regexp) {
            prefix = String(layer.regexp)
              .replace(/\\\//g, '/')
              .replace(/\^|\$|\?.*|\\\.*$|\(.*\)/g, '')
              .replace(/\/+/g, '/');
          }
          if (layer.name === 'router' && layer._path) {
            prefix = layer._path;
          }
          prefix = prefix.startsWith('(?:') || prefix === '/' ? '' : prefix;
          const cleanParent = (parentPath + prefix).replace(/\/+/g, '/');
          extract(subStack, cleanParent);
        }
      } else if (
        layer &&
        layer.name === 'router' &&
        layer.handle &&
        layer.handle.stack
      ) {
        let prefix = layer.regexp
          ? String(layer.regexp)
              .replace(/\\\//g, '/')
              .replace(/\^|\$|\?.*|\\\.*$|\(.*\)/g, '')
          : '';
        prefix = prefix.startsWith('(?:') ? '' : prefix;
        extract(layer.handle.stack, parentPath + prefix);
      }
    });
  };

  const rootStack = findRouterStack(app);
  if (rootStack) {
    extract(rootStack);
  }

  return Array.from(paths);
};

const listRoutes = (app) => {
  const routes = [];

  const extract = (stack, parentPath = '') => {
    stack.forEach((layer) => {
      if (layer && layer.route) {
        const methods = Object.keys(layer.route.methods)
          .filter(Boolean)
          .map((m) => m.toUpperCase());
        routes.push({
          path: parentPath + layer.route.path,
          methods,
        });
      } else if (layer && layer.handle && typeof layer.handle === 'function') {
        const subStack =
          layer.handle.stack ||
          (layer.handle._router && layer.handle._router.stack);
        if (Array.isArray(subStack) && subStack.length > 0) {
          let prefix = '';
          if (layer.regexp) {
            prefix = String(layer.regexp)
              .replace(/\\\//g, '/')
              .replace(/\^|\$|\?.*|\\\.*$|\(.*\)/g, '')
              .replace(/\/+/g, '/');
          }
          if (layer.name === 'router' && layer._path) {
            prefix = layer._path;
          }
          prefix = prefix.startsWith('(?:') || prefix === '/' ? '' : prefix;
          const cleanParent = (parentPath + prefix).replace(/\/+/g, '/');
          extract(subStack, cleanParent);
        }
      } else if (
        layer &&
        layer.name === 'router' &&
        layer.handle &&
        layer.handle.stack
      ) {
        let prefix = layer.regexp
          ? String(layer.regexp)
              .replace(/\\\//g, '/')
              .replace(/\^|\$|\?.*|\\\.*$|\(.*\)/g, '')
          : '';
        prefix = prefix.startsWith('(?:') ? '' : prefix;
        extract(layer.handle.stack, parentPath + prefix);
      }
    });
  };

  const rootStack = findRouterStack(app);
  if (rootStack) {
    extract(rootStack);
  }

  return routes;
};

// ─── API & System Aggregators ────────────────────────────────────────────────

const buildApiRouter = () => {
  const apiRouter = createRouter({ prefix: config.apiPrefix });
  apiRouter.use(versionMiddleware);

  const versionedTree = buildVersionedModuleTree(MODULES_DIR);
  const healthV1 = createVersionedRouter(API_VERSIONS.V1);
  healthV1.use('/health', healthRouter);
  if (versionedTree[API_VERSIONS.V1]) {
    versionedTree[API_VERSIONS.V1].use('/health', healthRouter);
  }

  apiRouter.use('/', versionRouter(versionedTree));

  const moduleCount = Object.values(versionedTree).reduce(
    (acc, router) => acc + (router && router.stack ? router.stack.length : 0),
    0
  );
  logger.info('API router initialized', {
    prefix: config.apiPrefix,
    versions: SUPPORTED_VERSIONS,
    currentVersion: CURRENT_VERSION,
    modulesDiscovered: moduleCount,
  });

  return apiRouter;
};

const buildSystemRoutes = () => {
  const systemRouter = createRouter();

  systemRouter.use('/health', healthRouter);
  systemRouter.use('/', healthRouter);

  systemRouter.get('/routes', (req, res) => {
    const routes = listRoutes(req.app);
    res.success(
      {
        total: routes.length,
        routes,
        requestId: req.id,
      },
      'Registered routes'
    );
  });

  return systemRouter;
};

const notFoundHandler = (req, res, next) => {
  const knownPaths = extractRoutePaths(req.app);
  const suggestions = findSimilarRoutes(
    req.originalUrl,
    knownPaths,
    SUGGESTION_THRESHOLD
  );

  const method = req.method.toUpperCase();
  const url = req.originalUrl;

  const details = {
    method,
    url,
    requestId: req.id,
    apiVersion: req.apiVersion || CURRENT_VERSION,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    supportedVersions: SUPPORTED_VERSIONS,
    docsHint: config.isDevelopment
      ? 'GET /routes for endpoint listing'
      : undefined,
  };

  let message = `Cannot ${method} ${url}`;

  if (suggestions.length > 0) {
    message += `. Did you mean: ${suggestions.join(', ')}?`;
  }

  const error = AppError.notFound(message);
  if (suggestions.length > 0) {
    error.errors = [
      {
        field: 'url',
        message: `Similar routes available: ${suggestions.join(', ')}`,
        value: url,
      },
    ];
  }

  logger.warn('Route not found', {
    ...details,
    ip: req.ip,
  });

  next(error);
};

const mountAllRoutes = (app) => {
  if (!app || typeof app.use !== 'function') {
    throw new Error('mountAllRoutes requires a valid Express app instance');
  }

  const systemMounted = mountRoutes(
    app,
    [{ path: '/', router: buildSystemRoutes(), version: null }],
    { logger: true }
  );

  const apiRouter = buildApiRouter();
  app.use(config.apiPrefix, apiRouter);

  logger.info('Route system mounted', {
    systemRoutes: systemMounted.length,
    apiPrefix: config.apiPrefix,
  });

  app.use(notFoundHandler);

  return {
    systemMounted,
    apiPrefix: config.apiPrefix,
  };
};

module.exports = {
  buildApiRouter,
  buildSystemRoutes,
  mountAllRoutes,
  notFoundHandler,
  healthRouter,
  createRouter,
  createVersionedRouter,
  mountRoutes,
  versionRouter,
  discoverModuleRoutes,
  registerModuleRoutes,
  buildVersionedModuleTree,
  versionMiddleware,
  listRoutes,
  extractRoutePaths,
  findRouterStack,
  findSimilarRoutes,
  ROUTE_MODULES,
  SUGGESTION_THRESHOLD,
  buildVersionPath,
  buildCurrentVersionPath,
  API_VERSIONS,
  CURRENT_VERSION,
  SUPPORTED_VERSIONS,
  MODULES_DIR,
};
