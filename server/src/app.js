const express = require('express');
const morgan = require('morgan');

const logger = require('./utils/logger');
const config = require('./config/env.config');
const errorHandler = require('./middleware/errorHandler.middleware');
const responseHandler = require('./middleware/responseHandler.middleware');
const { applySecurityMiddleware } = require('./middleware/security.middleware');
const { mountAllRoutes, listRoutes } = require('./routes');

const app = express();

app.set('trust proxy', config.isProduction ? 1 : false);

app.use(responseHandler);

applySecurityMiddleware(app);

morgan.token('req-id', (req) => req.id || 'N/A');
const morganFormat = config.isProduction
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - [reqId: :req-id] - :response-time ms'
  : ':method :url :status :response-time ms - reqId: :req-id';

app.use(morgan(morganFormat, { stream: logger.stream }));

const mountInfo = mountAllRoutes(app);

if (config.isDevelopment) {
  const totalRoutes = listRoutes(app).length;
  logger.info('Route registration complete', {
    totalEndpoints: totalRoutes,
    apiPrefix: mountInfo.apiPrefix,
  });
}

app.use(errorHandler);

module.exports = app;
