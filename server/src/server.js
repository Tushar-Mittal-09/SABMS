const http = require('http');
const config = require('./config/env.config');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const app = require('./app');

const server = http.createServer(app);

const startServer = async () => {
  try {
    // 1. Establish MongoDB connection before accepting HTTP traffic
    await connectDatabase();

    // 2. Start HTTP server listener
    server.listen(config.port, () => {
      console.log(
        `[${config.appName}] Operational on port ${config.port} (${config.env} mode)`
      );
    });
  } catch (error) {
    console.error(`[Fatal] Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

// Graceful Shutdown lifecycle handler
const gracefulShutdown = (signal) => {
  console.log(
    `[SABMS Server] ${signal} signal received. Initiating graceful shutdown...`
  );

  server.close(async () => {
    console.log('[SABMS Server] HTTP server closed.');
    await disconnectDatabase();
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error(
    '[SABMS Server] Unhandled Rejection at:',
    promise,
    'reason:',
    reason
  );
});

process.on('uncaughtException', (error) => {
  console.error('[SABMS Server] Uncaught Exception:', error);
  process.exit(1);
});

startServer();
