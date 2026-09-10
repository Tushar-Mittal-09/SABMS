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

/**
 * Sends a security notice informing the user that their password was updated.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email.
 * @param {string} [options.name] - Recipient name.
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendPasswordResetConfirmation = async ({ to, name }) => {
  if (!to) {
    return { success: false, error: 'Recipient email is required' };
  }

  const recipientName = name ? String(name).trim() : 'User';
  const mailOptions = {
    from: config.smtp.from || 'SABMS <noreply@sabms.edu>',
    to,
    subject: 'Your SABMS password has been changed',
    text: `Hello ${recipientName},\n\nYour SABMS account password was successfully updated. All active sessions have been terminated.\n\nIf you did not make this change, please contact an administrator immediately.\n\nSABMS Security Team`,
    html: `<p>Hello <strong>${recipientName}</strong>,</p><p>Your SABMS account password was successfully updated. All active sessions have been terminated.</p><p>If you did not make this change, please contact an administrator immediately.</p><p>SABMS Security Team</p>`,
  };

  try {
    const currentTransporter = module.exports.getTransporter();
    const info = await currentTransporter.sendMail(mailOptions);
    logger.info('Password reset confirmation email dispatched successfully', {
      context: 'EmailService',
      recipient: to,
      messageId: info.messageId,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to dispatch password reset confirmation email', {
      context: 'EmailService',
      recipient: to,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Sends a security notice informing the user that their account was locked due to failed login attempts.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email.
 * @param {string} [options.name] - Recipient name.
 * @param {number} [options.unlockMinutes=15] - Duration of temporary lockout.
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendAccountLockoutAlert = async ({ to, name, unlockMinutes = 15 }) => {
  if (!to) {
    return { success: false, error: 'Recipient email is required' };
  }

  const recipientName = name ? String(name).trim() : 'User';
  const mailOptions = {
    from: config.smtp.from || 'SABMS <noreply@sabms.edu>',
    to,
    subject: 'Security Alert: Your SABMS account has been temporarily locked',
    text: `Hello ${recipientName},\n\nYour SABMS account has been temporarily locked for ${unlockMinutes} minutes due to multiple failed login attempts.\n\nIf you did not attempt to log in, your credentials may be under attack. Please contact security or an administrator immediately.\n\nSABMS Security Team`,
    html: `<p>Hello <strong>${recipientName}</strong>,</p><p>Your SABMS account has been temporarily locked for <strong>${unlockMinutes} minutes</strong> due to multiple failed login attempts.</p><p>If you did not attempt to log in, your credentials may be under attack. Please contact an administrator immediately.</p><p>SABMS Security Team</p>`,
  };

  try {
    const currentTransporter = module.exports.getTransporter();
    const info = await currentTransporter.sendMail(mailOptions);
    logger.info('Account lockout alert email dispatched successfully', {
      context: 'EmailService',
      recipient: to,
      messageId: info.messageId,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to dispatch account lockout alert email', {
      context: 'EmailService',
      recipient: to,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Generates the HTML template for booking confirmation with embedded CID QR image.
 *
 * @param {Object} params
 * @param {string} params.name - Recipient name.
 * @param {Object} params.booking - Booking metadata.
 * @param {Object} params.event - Event metadata.
 * @returns {string} Sanitized HTML email body.
 */
const buildBookingConfirmationEmailHtml = ({ name, booking, event }) => {
  const recipientName = name ? String(name).trim() : 'Student';
  const eventDate = event.date
    ? new Date(event.date).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your auditorium booking is confirmed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      color: #1e293b;
    }
    .email-container {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 22px;
      font-weight: 700;
    }
    .header p {
      margin: 0;
      font-size: 14px;
      color: #93c5fd;
    }
    .content {
      padding: 32px 28px;
    }
    .intro {
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 20px;
      color: #334155;
    }
    .ticket-card {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .ticket-row {
      margin-bottom: 12px;
      font-size: 14px;
      line-height: 1.5;
    }
    .ticket-label {
      color: #64748b;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ticket-value {
      font-weight: 600;
      color: #0f172a;
      font-size: 15px;
    }
    .qr-section {
      text-align: center;
      padding: 20px 0;
      background: #ffffff;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      margin-top: 16px;
    }
    .qr-caption {
      font-size: 12px;
      color: #64748b;
      margin-top: 8px;
    }
    .notice {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 12px 16px;
      font-size: 13px;
      color: #1e40af;
      margin-bottom: 24px;
      border-radius: 4px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Smart Auditorium Booking System</h1>
      <p>Booking Confirmation &amp; E-Ticket</p>
    </div>
    <div class="content">
      <p class="intro">Hello <strong>${recipientName}</strong>,</p>
      <p class="intro">Your auditorium booking is confirmed. Below are your event and seating details:</p>

      <div class="ticket-card">
        <div class="ticket-row">
          <div class="ticket-label">Booking Reference</div>
          <div class="ticket-value" style="font-family: monospace; font-size: 16px; color: #1d4ed8;">${booking.bookingReference}</div>
        </div>
        <div class="ticket-row">
          <div class="ticket-label">Event</div>
          <div class="ticket-value">${event.name}</div>
        </div>
        <div class="ticket-row">
          <div class="ticket-label">Auditorium</div>
          <div class="ticket-value">${booking.auditoriumName || event.auditorium}</div>
        </div>
        <div class="ticket-row">
          <div class="ticket-label">Seat</div>
          <div class="ticket-value" style="color: #047857;">${booking.seatLabel} (${booking.seatId})</div>
        </div>
        <div class="ticket-row">
          <div class="ticket-label">Date &amp; Time</div>
          <div class="ticket-value">${eventDate} • ${event.startTime}${event.endTime ? ` - ${event.endTime}` : ''}</div>
        </div>
        <div class="ticket-row">
          <div class="ticket-label">Status</div>
          <div class="ticket-value" style="color: #059669;">${booking.status || 'CONFIRMED'}</div>
        </div>

        <div class="qr-section">
          <img src="cid:booking-ticket-qr" alt="Booking QR Ticket" width="220" height="220" style="display: block; margin: 0 auto; border-radius: 4px;" />
          <div class="qr-caption">Scan this secure QR code at the auditorium entrance for entry.</div>
        </div>
      </div>

      <div class="notice">
        Please arrive at least 15 minutes before the event start time with this digital ticket ready.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Smart Auditorium Booking &amp; Management System (SABMS). All rights reserved.
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Generates the plain-text template for booking confirmation.
 *
 * @param {Object} params
 * @param {string} params.name - Recipient name.
 * @param {Object} params.booking - Booking metadata.
 * @param {Object} params.event - Event metadata.
 * @returns {string} Plain-text email body.
 */
const buildBookingConfirmationEmailText = ({ name, booking, event }) => {
  const recipientName = name ? String(name).trim() : 'Student';
  const eventDate = event.date
    ? new Date(event.date).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return `
Smart Auditorium Booking & Management System
Booking Confirmation & E-Ticket
=============================================

Hello ${recipientName},

Your auditorium booking is confirmed!

BOOKING DETAILS:
- Booking Reference: ${booking.bookingReference}
- Event: ${event.name}
- Auditorium: ${booking.auditoriumName || event.auditorium}
- Seat: ${booking.seatLabel} (${booking.seatId})
- Date: ${eventDate}
- Time: ${event.startTime}${event.endTime ? ` - ${event.endTime}` : ''}
- Status: ${booking.status || 'CONFIRMED'}

Your secure QR ticket is attached to this email. Please have it ready on your device when entering the auditorium.

Thank you,
SABMS Team
  `.trim();
};

/**
 * Dispatches a booking confirmation email with embedded QR code attachment.
 *
 * RESILIENCE:
 * Safe execution that never throws. Returns success status and messageId or error.
 * Never logs raw ticket tokens, passwords, or SMTP secrets.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email.
 * @param {string} [options.name] - Recipient name.
 * @param {Object} options.booking - Authoritative booking document.
 * @param {Object} options.event - Authoritative event document.
 * @param {Buffer} [options.qrBuffer] - Raw PNG buffer of QR code.
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, notConfigured?: boolean }>}
 */
const sendBookingConfirmationEmail = async ({
  to,
  name,
  booking,
  event,
  qrBuffer,
}) => {
  if (!to || !booking || !event) {
    return {
      success: false,
      error: 'Recipient email, booking data, and event data are required',
    };
  }

  // Check if SMTP is configured (credentials present)
  if (!config.smtp.user || !config.smtp.pass) {
    logger.warn('SMTP credentials not configured; skipping email dispatch', {
      context: 'EmailService',
      recipient: to,
      bookingReference: booking.bookingReference,
    });
    return {
      success: false,
      notConfigured: true,
      error: 'Email provider not configured',
    };
  }

  const mailOptions = {
    from: config.smtp.from || 'SABMS <noreply@sabms.edu>',
    to,
    subject: `Booking Confirmed: ${event.name} [${booking.bookingReference}]`,
    text: buildBookingConfirmationEmailText({ name, booking, event }),
    html: buildBookingConfirmationEmailHtml({ name, booking, event }),
    attachments: qrBuffer
      ? [
          {
            filename: `ticket-${booking.bookingReference}.png`,
            content: qrBuffer,
            cid: 'booking-ticket-qr',
          },
        ]
      : [],
  };

  try {
    const currentTransporter = module.exports.getTransporter();
    const info = await currentTransporter.sendMail(mailOptions);
    logger.info('Booking confirmation email dispatched successfully', {
      context: 'EmailService',
      recipient: to,
      bookingReference: booking.bookingReference,
      messageId: info.messageId,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to dispatch booking confirmation email', {
      context: 'EmailService',
      recipient: to,
      bookingReference: booking.bookingReference,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
  sendPasswordResetConfirmation,
  sendAccountLockoutAlert,
  sendBookingConfirmationEmail,
  getTransporter,
  setTransporter,
  buildVerificationEmailHtml,
  buildVerificationEmailText,
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
  buildBookingConfirmationEmailHtml,
  buildBookingConfirmationEmailText,
};
