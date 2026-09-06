'use strict';

/**
 * Disallowed HTTP methods that could be abused for Cross-Site Tracing (XST)
 * or HTTP request smuggling.
 */
const DISALLOWED_METHODS = new Set(['TRACE', 'TRACK']);

/**
 * Rejects disallowed HTTP methods with HTTP 405 Method Not Allowed.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const methodFilterMiddleware = (req, res, next) => {
  if (DISALLOWED_METHODS.has(req.method.toUpperCase())) {
    res.set('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    return res.status(405).json({
      success: false,
      message: `HTTP Method ${req.method} is not allowed on this server.`,
    });
  }
  next();
};

/**
 * Prevents HTTP caching of sensitive API responses (e.g. auth tokens, credentials, PII).
 * Enforces OWASP cache-control directives for sensitive and authenticated endpoints.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const noCacheMiddleware = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
  next();
};

/**
 * Defends against server fingerprinting and information disclosure.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const securityHardeningHeaders = (req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  next();
};

module.exports = {
  methodFilterMiddleware,
  noCacheMiddleware,
  securityHardeningHeaders,
  DISALLOWED_METHODS,
};
