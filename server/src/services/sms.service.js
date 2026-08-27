'use strict';

const config = require('../config/env.config');
const logger = require('../core/logger');

let customProvider = null;

/**
 * Creates or retrieves the active SMS provider transport/adapter.
 * Default implementation provides a secure console/mock provider in non-production,
 * or delegates to a configured vendor adapter.
 *
 * @returns {Object} SMS provider instance with a send method.
 */
const getSmsProvider = () => {
  if (customProvider) {
    return customProvider;
  }

  const twilioSid =
    config.sms.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth =
    config.sms.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
  const twilioServiceSid =
    config.sms.twilioMessagingServiceSid ||
    process.env.TWILIO_MESSAGING_SERVICE_SID;
  const twilioFrom =
    config.sms.twilioPhoneNumber ||
    config.sms.from ||
    process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioAuth && (twilioFrom || twilioServiceSid)) {
    return {
      send: async ({ to, message }) => {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const payload = {
          To: to,
          Body: message,
        };

        if (twilioServiceSid) {
          payload.MessagingServiceSid = twilioServiceSid;
        } else if (twilioFrom.startsWith('MG')) {
          payload.MessagingServiceSid = twilioFrom;
        } else {
          payload.From = twilioFrom.startsWith('+')
            ? twilioFrom
            : `+${twilioFrom}`;
        }

        const params = new URLSearchParams(payload);
        const authHeader = `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64')}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: authHeader,
          },
          body: params.toString(),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.message || `Twilio SMS error (${response.status})`
          );
        }

        return { success: true, messageId: data.sid };
      },
    };
  }

  return {
    /**
     * Fallback when no real SMS provider is configured.
     */
    send: async () => {
      throw new Error(
        'SMS service is not configured. Please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env to dispatch real SMS messages.'
      );
    },
  };
};

/**
 * Sets a custom SMS provider (useful for unit/integration testing mocks or custom vendor adapters).
 * @param {Object|null} provider
 */
const setSmsProvider = (provider) => {
  customProvider = provider;
};

/**
 * Builds the standard verification SMS text.
 *
 * @param {string} otp - 6-digit numeric OTP code.
 * @returns {string} Plain-text SMS message.
 */
const buildVerificationSmsText = (otp) => {
  return `SABMS verification code: ${otp}.\nThis code expires in 10 minutes.\nDo not share this code with anyone.`;
};

/**
 * Sends a generic SMS message via the configured SMS provider.
 *
 * Security: NEVER logs the message content if it might contain an OTP or credentials.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient phone number (E.164 format).
 * @param {string} options.message - Text message to send.
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendSms = async ({ to, message }) => {
  if (!to || typeof to !== 'string' || !to.trim()) {
    return { success: false, error: 'Recipient phone number is required' };
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return { success: false, error: 'SMS message content is required' };
  }

  try {
    const provider = module.exports.getSmsProvider();
    const result = await provider.send({ to: to.trim(), message });

    logger.info('SMS message dispatched successfully', {
      context: 'SmsService',
      recipient: to.trim(),
      messageId: result?.messageId,
    });

    return {
      success: true,
      messageId: result?.messageId,
    };
  } catch (error) {
    logger.error('Failed to dispatch SMS message', {
      context: 'SmsService',
      recipient: to.trim(),
      error: error.message,
    });
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Sends a phone verification OTP to the target phone number.
 *
 * Security: NEVER logs the OTP.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient phone number (E.164 format).
 * @param {string} options.otp - 6-digit numeric OTP code.
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendPhoneVerificationOtp = async ({ to, otp }) => {
  if (!to || !otp) {
    return {
      success: false,
      error: 'Recipient phone number and OTP are required',
    };
  }

  const message = buildVerificationSmsText(otp);
  return sendSms({ to, message });
};

module.exports = {
  sendPhoneVerificationOtp,
  sendSms,
  getSmsProvider,
  setSmsProvider,
  buildVerificationSmsText,
};
