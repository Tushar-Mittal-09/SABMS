const crypto = require('crypto');

/**
 * Express middleware to attach a unique correlation Request ID to every incoming request.
 * If X-Request-ID header is present, it preserves it; otherwise generates a crypto UUID.
 */
const requestId = (req, res, next) => {
  const existingId = req.headers['x-request-id'];
  const correlationId = existingId || crypto.randomUUID();

  req.id = correlationId;
  res.setHeader('X-Request-ID', correlationId);

  next();
};

module.exports = requestId;
