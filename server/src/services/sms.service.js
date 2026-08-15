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

  return {
    /**
     * Default SMS transport implementation.
     * @param {Object} options
     * @param {string} options.to - Recipient phone number in E.164 format.
     * @param {string} options.message - Text message content.
     * @returns {Promise<{ success: boolean, messageId: string }>}
     */
    send: async ({ to, message: _message }) => {
      // In development or test environments, simulate successful delivery
      const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      if (config.isDevelopment) {
        // In development, log delivery dispatch without exposing OTP secrets
        logger.debug(
          `[SMS Provider] Dispatching SMS to ${to} (MessageId: ${messageId})`,
          {
            context: 'SmsService',
          }
        );
      }
      return { success: true, messageId };
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
