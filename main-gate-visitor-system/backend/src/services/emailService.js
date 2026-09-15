const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

let cachedTransporter = null;

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
  if (cachedTransporter) return cachedTransporter;

  if (!isSmtpConfigured()) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true for 465, false for 587/STARTTLS
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  return cachedTransporter;
}

/**
 * Verifies SMTP connection using transporter.verify()
 */
async function verifySmtpConfiguration() {
  if (!isSmtpConfigured()) {
    logger.warn('[EMAIL] SMTP credentials not configured or using placeholder values in .env');
    return {
      success: false,
      error: 'SMTP credentials missing or placeholder in .env (SMTP_USER, SMTP_PASSWORD)'
    };
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('[EMAIL] SMTP transporter verified successfully with server.');
    return { success: true, message: 'SMTP connection verified successfully' };
  } catch (err) {
    logger.error('[EMAIL] SMTP verification failed:', err.message);
    return {
      success: false,
      error: `SMTP connection verification error: ${err.message}`
    };
  }
}

/**
 * Sends Real Visitor Authorization Email
 * IMPORTANT: Includes Authorization PIN in email body as requested,
 * but NEVER logs the PIN to application logs or console.
 */
async function sendVisitorAuthorizationEmail({ visitorNames, pin, date, time, authorizationId }) {
  const targetEmail = env.MAIN_GATE_EMAIL;
  logger.info(`[EMAIL] Starting real email dispatch for authorization to: ${targetEmail}`);

  // Development mode check
  if (!env.REAL_NOTIFICATIONS) {
    logger.info('[EMAIL] Mock mode active (REAL_NOTIFICATIONS=false). Email delivery simulated.');
    return {
      success: true,
      status: 'SENT',
      messageId: `mock-email-${Date.now()}`
    };
  }

  if (!isSmtpConfigured()) {
    const reason = 'SMTP credentials not configured or placeholder values in .env (SMTP_USER, SMTP_PASSWORD)';
    logger.warn(`[EMAIL] FAILED: ${reason}`);
    return {
      success: false,
      status: 'FAILED',
      error: reason
    };
  }

  const transporter = createTransporter();
  const namesStr = Array.isArray(visitorNames) ? visitorNames.join(', ') : visitorNames;
  const authDate = date || new Date().toLocaleDateString('en-GB');
  const authTime = time || new Date().toLocaleTimeString('en-GB');

  const subject = 'Main Gate Visitor Entry Authorization';
  const textBody = `MAIN GATE VISITOR ENTRY AUTHORIZATION

Visitor Name(s):
${namesStr}

Authorization Status:
AUTHORIZED

Authorization PIN:
${pin}

Authorization Date:
${authDate}

Authorization Time:
${authTime}

Please verify the visitor name(s) and Authorization PIN at the main gate.

If the PIN matches the authorized request:
ENTRY AUTHORIZED

Otherwise:
ENTRY NOT AUTHORIZED

This is an automated Main Gate Security notification.
`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
      <h2 style="color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-top: 0;">MAIN GATE VISITOR ENTRY AUTHORIZATION</h2>
      
      <p style="margin-bottom: 4px;"><strong>Visitor Name(s):</strong></p>
      <div style="font-size: 1.15em; font-weight: bold; color: #1e293b; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
        ${namesStr}
      </div>

      <table style="width: 100%; margin: 15px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #64748b;">Authorization Status:</td><td style="font-weight: bold; color: #16a34a;">AUTHORIZED</td></tr>
        ${authorizationId ? `<tr><td style="padding: 8px 0; color: #64748b;">Authorization ID:</td><td style="font-family: monospace; font-weight: bold;">${authorizationId}</td></tr>` : ''}
        <tr><td style="padding: 8px 0; color: #64748b;">Authorization PIN:</td><td style="font-family: monospace; font-weight: bold; color: #d97706; font-size: 1.1em;">${pin}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b;">Authorization Date:</td><td>${authDate}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b;">Authorization Time:</td><td>${authTime}</td></tr>
      </table>

      <div style="margin-top: 20px; padding: 14px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; font-size: 0.95em; line-height: 1.5;">
        Please verify the visitor name(s) and Authorization PIN at the main gate.<br><br>
        If the PIN matches the authorized request: <strong style="color: #16a34a;">ENTRY AUTHORIZED</strong><br>
        Otherwise: <strong style="color: #dc2626;">ENTRY NOT AUTHORIZED</strong>
      </div>
      
      <p style="margin-top: 24px; font-size: 0.8em; color: #94a3b8; text-align: center;">
        This is an automated Main Gate Security notification.
      </p>
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

    logger.info(`[EMAIL] SENT: Real email accepted by SMTP server. Message ID: ${info.messageId}`);
    return {
      success: true,
      status: 'SENT',
      messageId: info.messageId
    };
  } catch (err) {
    logger.error(`[EMAIL] FAILED: Real email dispatch error: ${err.message}`);
    return {
      success: false,
      status: 'FAILED',
      error: err.message
    };
  }
}

/**
 * Backward compatible alias for authorization service
 */
async function sendAuthorizationEmail({ authorizationId, visitorNames, pin, createdAt }) {
  const dateStr = createdAt ? new Date(createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  const timeStr = createdAt ? new Date(createdAt).toLocaleTimeString('en-GB') : new Date().toLocaleTimeString('en-GB');
  return sendVisitorAuthorizationEmail({
    visitorNames,
    pin: pin || 'VERIFIED',
    date: dateStr,
    time: timeStr,
    authorizationId
  });
}

/**
 * Send independent test email
 */
async function sendTestEmail({ to, subject, body } = {}) {
  const targetEmail = to || env.MAIN_GATE_EMAIL;
  logger.info(`[EMAIL] Starting test email send to: ${targetEmail}`);

  if (!isSmtpConfigured()) {
    const reason = 'SMTP credentials not configured or placeholder values in .env';
    return {
      success: false,
      status: 'FAILED',
      error: reason
    };
  }

  const transporter = createTransporter();
  try {
    const info = await transporter.sendMail({
      from: `Gatekeeper Security <${env.SMTP_USER}>`,
      to: targetEmail,
      subject: subject || `Main Gate Test Email - ${new Date().toISOString()}`,
      text: body || `This is a test notification from Gatekeeper.\nServer time: ${new Date().toLocaleString()}`
    });

    logger.info(`[EMAIL] SENT: Test email dispatched successfully. Message ID: ${info.messageId}`);
    return {
      success: true,
      status: 'SENT',
      messageId: info.messageId,
      recipient: targetEmail
    };
  } catch (err) {
    logger.error(`[EMAIL] FAILED: Test email failed: ${err.message}`);
    return {
      success: false,
      status: 'FAILED',
      error: err.message
    };
  }
}

function resetTransporter() {
  cachedTransporter = null;
}

module.exports = {
  sendVisitorAuthorizationEmail,
  sendAuthorizationEmail,
  sendTestEmail,
  verifySmtpConfiguration,
  verifySmtpConnection: verifySmtpConfiguration,
  isSmtpConfigured,
  resetTransporter
};
