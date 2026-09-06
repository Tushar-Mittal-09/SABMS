'use strict';

const nodemailer = require('nodemailer');
const config = require('../config/env.config');
const logger = require('../core/logger');

let transporter = null;

/**
 * Creates or retrieves the cached Nodemailer transport instance.
 * @returns {import('nodemailer').Transporter}
 */
const getTransporter = () => {
  if (!transporter) {
    const smtpConfig = {
      host: config.smtp.host || 'smtp.mailtrap.io',
      port: config.smtp.port || 2525,
      secure: config.smtp.port === 465,
    };

    if (config.smtp.user && config.smtp.pass) {
      smtpConfig.auth = {
        user: config.smtp.user,
        pass: config.smtp.pass,
      };
    }

    transporter = nodemailer.createTransport(smtpConfig);
  }

  return transporter;
};

/**
 * Sets a custom transporter (useful for unit/integration testing mocks).
 * @param {import('nodemailer').Transporter|null} customTransporter
 */
const setTransporter = (customTransporter) => {
  transporter = customTransporter;
};

/**
 * Generates the HTML template for the email verification OTP.
 *
 * @param {string} name - Recipient's display name.
 * @param {string} otp - 6-digit numeric OTP.
 * @returns {string} Sanitized HTML email body.
 */
const buildVerificationEmailHtml = (name, otp) => {
  const recipientName = name ? String(name).trim() : 'User';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your SABMS account</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f8;
      margin: 0;
      padding: 0;
      color: #333333;
    }
    .email-container {
      max-width: 580px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border: 1px solid #e1e4e8;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      padding: 28px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 32px 28px;
    }
    .content p {
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 16px 0;
      color: #4b5563;
    }
    .otp-card {
      background: #f0fdf4;
      border: 2px dashed #22c55e;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #15803d;
      margin: 0;
      font-family: monospace;
    }
    .expiry-note {
      font-size: 13px;
      color: #6b7280;
      margin-top: 8px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 16px 24px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #f3f4f6;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Smart Auditorium Booking & Management System</h1>
    </div>
    <div class="content">
      <p>Hello <strong>${recipientName}</strong>,</p>
      <p>Your SABMS email verification OTP is:</p>
      <div class="otp-card">
        <div class="otp-code">${otp}</div>
        <div class="expiry-note">This OTP expires in 10 minutes.</div>
      </div>
      <p>If you did not create this account, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} SABMS. All rights reserved.
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Generates the plain-text template for the email verification OTP.
 *
 * @param {string} name - Recipient's display name.
 * @param {string} otp - 6-digit numeric OTP.
 * @returns {string} Plain-text email body.
 */
const buildVerificationEmailText = (name, otp) => {
  const recipientName = name ? String(name).trim() : 'User';
  return `
Hello ${recipientName},

Your SABMS email verification OTP is:

${otp}

This OTP expires in 10 minutes.

If you did not create this account, you can safely ignore this email.
  `.trim();
};

/**
 * Sends an email verification OTP to the target recipient.
 *
 * Security: NEVER logs the OTP or SMTP credentials.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address.
 * @param {string} [options.name] - Recipient name.
 * @param {string} options.otp - 6-digit numeric OTP code.
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendEmailVerificationOtp = async ({ to, name, otp }) => {
  if (!to || !otp) {
    return { success: false, error: 'Recipient email and OTP are required' };
  }

  const mailOptions = {
    from: config.smtp.from || 'SABMS <noreply@sabms.edu>',
    to,
    subject: 'Verify your SABMS account',
    text: buildVerificationEmailText(name, otp),
    html: buildVerificationEmailHtml(name, otp),
  };

  try {
    const currentTransporter = module.exports.getTransporter();
    const info = await currentTransporter.sendMail(mailOptions);
    logger.info('Email verification OTP dispatched successfully', {
      context: 'EmailService',
      recipient: to,
      messageId: info.messageId,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to dispatch email verification OTP', {
      context: 'EmailService',
      recipient: to,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Generates the HTML template for the password reset OTP.
 *
 * @param {string} name - Recipient's display name.
 * @param {string} otp - 6-digit numeric OTP.
 * @returns {string} Sanitized HTML email body.
 */
const buildPasswordResetEmailHtml = (name, otp) => {
  const recipientName = name ? String(name).trim() : 'User';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your SABMS password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f8;
      margin: 0;
      padding: 0;
      color: #333333;
    }
    .email-container {
      max-width: 580px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border: 1px solid #e1e4e8;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      padding: 28px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 32px 28px;
    }
    .content p {
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 16px 0;
      color: #4b5563;
    }
    .otp-card {
      background: #fef2f2;
      border: 2px dashed #ef4444;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #b91c1c;
      margin: 0;
      font-family: monospace;
    }
    .expiry-note {
      font-size: 13px;
      color: #6b7280;
      margin-top: 8px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 16px 24px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #f3f4f6;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Smart Auditorium Booking & Management System</h1>
    </div>
    <div class="content">
      <p>Hello <strong>${recipientName}</strong>,</p>
      <p>We received a request to reset the password for your SABMS account. Your 6-digit password reset code is:</p>
      <div class="otp-card">
        <div class="otp-code">${otp}</div>
        <div class="expiry-note">This code expires in 5 minutes.</div>
      </div>
      <p>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} SABMS. All rights reserved.
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Generates the plain-text template for the password reset OTP.
 *
 * @param {string} name - Recipient's display name.
 * @param {string} otp - 6-digit numeric OTP.
 * @returns {string} Plain-text email body.
 */
const buildPasswordResetEmailText = (name, otp) => {
  const recipientName = name ? String(name).trim() : 'User';
  return `
Hello ${recipientName},

We received a request to reset the password for your SABMS account. Your 6-digit password reset code is:

${otp}

This code expires in 5 minutes.

If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
  `.trim();
};

/**
 * Sends a password reset OTP to the target recipient.
 *
 * Security: NEVER logs the OTP or SMTP credentials.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address.
 * @param {string} [options.name] - Recipient name.
 * @param {string} options.otp - 6-digit numeric OTP code.
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendPasswordResetOtp = async ({ to, name, otp }) => {
  if (!to || !otp) {
    return { success: false, error: 'Recipient email and OTP are required' };
  }

  const mailOptions = {
    from: config.smtp.from || 'SABMS <noreply@sabms.edu>',
    to,
    subject: 'Reset your SABMS password',
    text: buildPasswordResetEmailText(name, otp),
    html: buildPasswordResetEmailHtml(name, otp),
  };

  try {
    const currentTransporter = module.exports.getTransporter();
    const info = await currentTransporter.sendMail(mailOptions);
    logger.info('Password reset OTP email dispatched successfully', {
      context: 'EmailService',
      recipient: to,
      messageId: info.messageId,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to dispatch password reset OTP email', {
      context: 'EmailService',
      recipient: to,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
  getTransporter,
  setTransporter,
  buildVerificationEmailHtml,
  buildVerificationEmailText,
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
};
