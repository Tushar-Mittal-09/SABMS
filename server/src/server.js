const http = require('http');
const config = require('./config/env.config');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const logger = require('./utils/logger');
const app = require('./app');

const server = http.createServer(app);

const startServer = async () => {
  try {
    // 1. Establish MongoDB connection before accepting HTTP traffic
    await connectDatabase();

    // 2. Start HTTP server listener
    server.listen(config.port, () => {
      logger.info(
        `${config.appName} operational on port ${config.port} (${config.env} mode)`,
        { context: 'Server' }
      );
    });
  } catch (error) {
    logger.error(`Server startup failed: ${error.message}`, {
      context: 'Server',
      stack: error.stack,
    });
    process.exit(1);
  }
};

// Graceful Shutdown lifecycle handler
const gracefulShutdown = (signal) => {
  logger.info(`${signal} signal received. Initiating graceful shutdown...`, {
    context: 'Server',
  });

  server.close(async () => {
    logger.info('HTTP server closed.', { context: 'Server' });
    await disconnectDatabase();
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    context: 'Server',
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, {
    context: 'Server',
    stack: error.stack,
  });
  process.exit(1);
});

startServer();
