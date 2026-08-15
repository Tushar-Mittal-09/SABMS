const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  API_VERSIONS,
  CURRENT_VERSION,
  SUPPORTED_VERSIONS,
  buildVersionPath,
  buildCurrentVersionPath,
  isSupportedVersion,
} = require('../constants/apiVersions');
const config = require('../config/env.config');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const createVersionedRouter = (version, options = {}) => {
  const { caseSensitive = false, strict = false } = options;

  if (!isSupportedVersion(version)) {
    throw new Error(
      `Unsupported API version: ${version}. Supported: ${SUPPORTED_VERSIONS.join(', ')}`
    );
  }

  const router = express.Router({ caseSensitive, strict });
  router._apiVersion = version;
  router._mountPath = buildVersionPath(version);

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

  routes.forEach(({ path, router, version, middlewares = [] }) => {
    let fullPath;

    if (version) {
      fullPath = buildVersionPath(version, path);
    } else if (path.startsWith('/')) {
      fullPath = path;
    } else {
      fullPath = `${prefix}/${path}`;
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
  const { VERSION_HEADERS } = require('../constants/apiVersions');

  SUPPORTED_VERSIONS.forEach((version) => {
    const versionRouterInstance = routersByVersion[version];
    if (versionRouterInstance) {
      const versionPath = buildVersionPath(version).replace(
        config.apiPrefix,
        ''
      );
      rootRouter.use(versionPath, versionRouterInstance);
    }
  });

  if (routersByVersion[CURRENT_VERSION]) {
    rootRouter.use(
      buildCurrentVersionPath('').replace(config.apiPrefix, ''),
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
    const versionsDir = path.join(moduleDir, version);
    const fallbackRouteFile = path.join(moduleDir, `${moduleName}.routes.js`);
    const versionedRouteFile = path.join(
      versionsDir,
      `${moduleName}.routes.js`
    );

    let routeFilePath = null;

    if (
      moduleDirectoryExists(versionsDir) &&
      fs.existsSync(versionedRouteFile)
    ) {
      routeFilePath = versionedRouteFile;
    } else if (fs.existsSync(fallbackRouteFile)) {
      routeFilePath = fallbackRouteFile;
    }

    if (routeFilePath) {
      try {
        const moduleExports = require(routeFilePath);

        const routerExport =
          moduleExports.router ||
          moduleExports[`${moduleName}Router`] ||
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
  AUDITORIUMS: 'auditoriums',
  BOOKINGS: 'bookings',
  EVENTS: 'events',
  PAYMENTS: 'payments',
  NOTIFICATIONS: 'notifications',
  ADMIN: 'admin',
  REPORTS: 'reports',
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

module.exports = {
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
};
