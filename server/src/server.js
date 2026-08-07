require('dotenv').config();
const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const startServer = () => {
  server.listen(PORT, () => {
    console.log(`[SABMS Server] Operational on port ${PORT} (${process.env.NODE_ENV || 'development'} mode)`);
  });
};

// Graceful Shutdown lifecycle handler
const gracefulShutdown = (signal) => {
  console.log(`[SABMS Server] ${signal} signal received. Initiating graceful shutdown...`);
  server.close(() => {
    console.log('[SABMS Server] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SABMS Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[SABMS Server] Uncaught Exception:', error);
  process.exit(1);
});

startServer();
