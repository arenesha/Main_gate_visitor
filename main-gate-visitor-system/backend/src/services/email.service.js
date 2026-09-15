const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Validates if SMTP credentials are configured and not placeholders
 */
function isSmtpConfigured() {
  if (!env.SMTP_USER || !env.SMTP_PASSWORD) return false;
  if (env.isPlaceholder(env.SMTP_USER) || env.isPlaceholder(env.SMTP_PASSWORD)) return false;
  return true;
}

/**
 * Creates Nodemailer transporter using real SMTP credentials
 */
function createTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true for 465, false for 587 or others
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Verifies SMTP connection directly
 */
async function verifySmtpConnection() {
  if (!isSmtpConfigured()) {
    return {
      success: false,
      error: 'SMTP credentials missing or set to placeholder values in .env (SMTP_USER, SMTP_PASS)'
    };
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { success: true, message: 'SMTP server connection verified successfully' };
  } catch (err) {
    return {
      success: false,
      error: `SMTP verification failed: ${err.message}`
    };
  }
}

/**
 * Send independent test email
 */
async function sendTestEmail({ to, subject, body } = {}) {
  const targetEmail = to || env.MAIN_GATE_EMAIL;
  logger.info(`[EMAIL] Starting test email send to: ${targetEmail}`);

  if (!isSmtpConfigured()) {
    const reason = 'SMTP credentials not configured or placeholder values in .env';
    logger.error(`[EMAIL] FAILED: ${reason}`);
    return {
      success: false,
      status: 'FAILED',
      error: reason,
      diagnostics: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        userConfigured: Boolean(env.SMTP_USER && !env.isPlaceholder(env.SMTP_USER)),
        passConfigured: Boolean(env.SMTP_PASSWORD && !env.isPlaceholder(env.SMTP_PASSWORD)),
        targetEmail
      }
    };
  }

  const transporter = createTransporter();
  const emailSubject = subject || `[TEST] Main Gate Security Email Test - ${new Date().toISOString()}`;
  const textContent = body || `This is a test notification from the Main Gate Visitor Authorization System.\nSMTP Host: ${env.SMTP_HOST}\nTimestamp: ${new Date().toLocaleString()}`;

  try {
    logger.info(`[EMAIL] Connecting to SMTP server ${env.SMTP_HOST}:${env.SMTP_PORT}...`);
    const info = await transporter.sendMail({
      from: `Gatekeeper Security <${env.SMTP_USER}>`,
      to: targetEmail,
      subject: emailSubject,
      text: textContent
    });

    logger.info(`[EMAIL] SENT successfully. Message ID: ${info.messageId}`);
    return {
      success: true,
      status: 'SENT',
      messageId: info.messageId,
      recipient: targetEmail
    };
  } catch (err) {
    logger.error(`[EMAIL] FAILED: ${err.message}`);
    return {
      success: false,
      status: 'FAILED',
      error: err.message,
      code: err.code || 'SMTP_SEND_ERROR'
    };
  }
}

/**
 * Real authorization email dispatch
 * Returns: { success: boolean, status: 'SENT'|'FAILED', messageId?: string, error?: string }
 */
async function sendAuthorizationEmail({ authorizationId, visitorNames, createdAt }) {
  const targetEmail = env.MAIN_GATE_EMAIL;
  logger.info(`[EMAIL] Starting authorization email send for ${authorizationId} to ${targetEmail}`);

  if (!isSmtpConfigured()) {
    const reason = 'SMTP credentials not configured or placeholder values in .env (SMTP_USER, SMTP_PASS)';
    logger.warn(`[EMAIL] FAILED for ${authorizationId}: ${reason}`);
    return {
      success: false,
      status: 'FAILED',
      error: reason
    };
  }

  const transporter = createTransporter();
  const dateStr = new Date(createdAt).toLocaleDateString('en-GB');
  const timeStr = new Date(createdAt).toLocaleTimeString('en-GB');
  const namesStr = Array.isArray(visitorNames) ? visitorNames.join(', ') : visitorNames;

  const subject = `Main Gate Visitor Authorization - ${authorizationId}`;
  const textBody = `MAIN GATE VISITOR ENTRY AUTHORIZATION

Visitor Name(s):
${namesStr}

Authorization Status:
AUTHORIZED

Authorization ID:
${authorizationId}

Date:
${dateStr}

Time:
${timeStr}

Please verify the visitor authorization at the Main Gate.

If the gate verification is valid:
ENTRY AUTHORIZED

If the authorization is invalid:
ENTRY NOT AUTHORIZED
`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">MAIN GATE VISITOR ENTRY AUTHORIZATION</h2>
      <p><strong>Visitor Name(s):</strong></p>
      <p style="font-size: 1.1em; color: #1e293b; background: #f8fafc; padding: 10px; border-radius: 4px;">${namesStr}</p>
      
      <table style="width: 100%; margin: 15px 0; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #64748b;">Authorization Status:</td><td style="font-weight: bold; color: #16a34a;">AUTHORIZED</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Authorization ID:</td><td style="font-family: monospace; font-weight: bold;">${authorizationId}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Date & Time:</td><td>${dateStr} at ${timeStr}</td></tr>
      </table>

      <div style="margin-top: 20px; padding: 12px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; font-size: 0.9em;">
        Please verify the visitor authorization at the Main Gate Counter.<br>
        If the gate verification is valid: <strong>ENTRY AUTHORIZED</strong><br>
        If the authorization is invalid: <strong>ENTRY NOT AUTHORIZED</strong>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `Gatekeeper Security <${env.SMTP_USER}>`,
      to: targetEmail,
      subject: subject,
      text: textBody,
      html: htmlBody
    });

    logger.info(`[EMAIL] SENT: Real email dispatched for ${authorizationId}. Message ID: ${info.messageId}`);
    return {
      success: true,
      status: 'SENT',
      messageId: info.messageId
    };
  } catch (err) {
    logger.error(`[EMAIL] FAILED for ${authorizationId}: ${err.message}`);
    return {
      success: false,
      status: 'FAILED',
      error: err.message
    };
  }
}

const emailService = require('./emailService');

module.exports = {
  ...emailService
};

