'use strict';

/**
 * Authentication Helper Functions.
 *
 * Provides utility methods for request metadata extraction,
 * client device parsing, and authentication formatting.
 */

/**
 * Extracts client IP address from incoming Express request.
 * @param {import('express').Request} req
 * @returns {string} Client IP address or 'unknown'
 */
const extractClientIp = (req) => {
  if (!req) return 'unknown';
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
};

/**
 * Extracts user-agent string from incoming Express request.
 * @param {import('express').Request} req
 * @returns {string} User-Agent header value or 'unknown'
 */
const extractUserAgent = (req) => {
  if (!req || !req.headers) return 'unknown';
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Formats basic device metadata from request.
 * @param {import('express').Request} req
 * @returns {{ ip: string, userAgent: string }}
 */
const extractClientMetadata = (req) => ({
  ip: extractClientIp(req),
  userAgent: extractUserAgent(req),
});

module.exports = {
  extractClientIp,
  extractUserAgent,
  extractClientMetadata,
};
