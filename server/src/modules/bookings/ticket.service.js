'use strict';

const crypto = require('crypto');
const qrcode = require('qrcode');

/**
 * Generates a cryptographically secure, high-entropy ticket token.
 * Uses 256 bits (32 bytes) of cryptographic randomness from CSPRNG.
 *
 * Format: tkt_<64-hex-characters>
 *
 * @returns {string} 68-character opaque ticket token.
 */
const generateSecureTicketToken = () => {
  const entropy = crypto.randomBytes(32).toString('hex');
  return `tkt_${entropy}`;
};

/**
 * Builds the minimal, opaque QR payload for ticket validation.
 *
 * SECURITY:
 * Strictly encodes ONLY the opaque ticket token and public booking reference.
 * NEVER includes passwords, JWTs, student personal info, or database internals.
 *
 * @param {Object} params
 * @param {string} params.ticketToken - Opaque bearer ticket token.
 * @param {string} params.bookingReference - Public booking reference code.
 * @returns {string} Serialized JSON payload.
 */
const buildTicketPayload = ({ ticketToken, bookingReference }) => {
  return JSON.stringify({
    t: ticketToken,
    ref: bookingReference,
  });
};

/**
 * Generates authoritative 2D QR matrix images (DataURL and PNG Buffer).
 *
 * @param {string|Object} payload - Ticket payload string or object with ticketToken & bookingReference.
 * @returns {Promise<{ dataUrl: string, buffer: Buffer }>}
 */
const generateTicketQrCode = async (payload) => {
  const payloadString =
    typeof payload === 'string' ? payload : buildTicketPayload(payload);

  const qrOptions = {
    errorCorrectionLevel: 'M',
    type: 'png',
    margin: 2,
    width: 320,
    color: {
      dark: '#0f172a', // Deep slate navy for crisp contrast
      light: '#ffffff',
    },
  };

  const [dataUrl, buffer] = await Promise.all([
    qrcode.toDataURL(payloadString, qrOptions),
    qrcode.toBuffer(payloadString, qrOptions),
  ]);

  return {
    dataUrl,
    buffer,
  };
};

module.exports = {
  generateSecureTicketToken,
  buildTicketPayload,
  generateTicketQrCode,
};
