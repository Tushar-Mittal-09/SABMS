const http = require('http');
const config = require('./config/env.config');
const app = require('./app');

const server = http.createServer(app);

const startServer = () => {
  server.listen(config.port, () => {
    console.log(
      `[${config.appName}] Operational on port ${config.port} (${config.env} mode)`
    );
  });
};

// Graceful Shutdown lifecycle handler
const gracefulShutdown = (signal) => {
  console.log(
    `[SABMS Server] ${signal} signal received. Initiating graceful shutdown...`
  );
  server.close(() => {
    console.log('[SABMS Server] HTTP server closed.');
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
