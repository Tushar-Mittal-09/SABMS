const path = require('path');
const config = require('../config/env.config');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { healthRouter } = require('./health.routes');
const {
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
} = require('./routeAggregator');
const {
  API_VERSIONS,
  CURRENT_VERSION,
  SUPPORTED_VERSIONS,
} = require('../constants/apiVersions');

const MODULES_DIR = path.resolve(__dirname, '../modules');

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
