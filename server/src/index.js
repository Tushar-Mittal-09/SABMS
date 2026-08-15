'use strict';

/**
 * SABMS Server Main Process Entry Point.
 */
const { server, startServer } = require('./app/server');

module.exports = {
  server,
  startServer,
};
