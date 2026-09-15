const nodemailer = require('nodemailer');
const { query } = require('../database/db');
const logger = require('../utils/logger');

// -------------------------------------------------------------
// Helper: Resolve configuration from standard or alias env keys
// -------------------------------------------------------------
function getEmailConfig() {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const from = (process.env.EMAIL_FROM || user || '').trim();
  const securityEmail = (process.env.SECURITY_EMAIL || '').trim();

  return { host, port, user, pass, from, securityEmail };
}

function getSmsConfig() {
  const provider = (process.env.SMS_PROVIDER || 'twilio').trim();
  const apiKey = (process.env.SMS_API_KEY || process.env.TWILIO_ACCOUNT_SID || '').trim();
  const apiSecret = (process.env.SMS_API_SECRET || process.env.TWILIO_AUTH_TOKEN || '').trim();
  const from = (process.env.SMS_FROM || process.env.TWILIO_PHONE_NUMBER || '').trim();
  const securityPhone = (process.env.SECURITY_PHONE || '').trim();

  return { provider, apiKey, apiSecret, from, securityPhone };
}

// -------------------------------------------------------------
// Configuration Validation
// -------------------------------------------------------------
function validateEmailConfig() {
  const config = getEmailConfig();
  const missing = [];

  if (!config.host) missing.push('SMTP_HOST');
  if (!config.port) missing.push('SMTP_PORT');
  if (!config.user) missing.push('SMTP_USER');
  if (!config.pass) missing.push('SMTP_PASSWORD');
  if (!config.securityEmail) missing.push('SECURITY_EMAIL');

  if (missing.length > 0) {
    return {
      valid: false,
      errorCode: 'EMAIL_CONFIGURATION_MISSING',
      missing,
      message: `Missing required email configuration: ${missing.join(', ')}`
    };
  }

  return { valid: true, config };
}

function validateSmsConfig() {
  const config = getSmsConfig();
  const missing = [];

  if (!config.apiKey || config.apiKey.startsWith('your_') || config.apiKey.startsWith('ACxxxx')) {
    missing.push('SMS_API_KEY / TWILIO_ACCOUNT_SID');
  }
  if (!config.apiSecret || config.apiSecret.startsWith('your_') || config.apiSecret.startsWith('xxxx')) {
    missing.push('SMS_API_SECRET / TWILIO_AUTH_TOKEN');
  }
  if (!config.from || config.from.startsWith('+1xxxx')) {
    missing.push('SMS_FROM / TWILIO_PHONE_NUMBER');
  }
  if (!config.securityPhone || config.securityPhone.startsWith('+91XXXX')) {
    missing.push('SECURITY_PHONE');
  }

  if (missing.length > 0) {
    return {
      valid: false,
      errorCode: 'SMS_CONFIGURATION_MISSING',
      missing,
      message: `Missing required SMS configuration: ${missing.join(', ')}`
    };
  }

  return { valid: true, config };
}

// -------------------------------------------------------------
// Database Notification Logger
// -------------------------------------------------------------
async function logNotificationRecord({
  authorizationId,
  recipientType,
  recipient,
  channel,
  status,
  message,
  errorMessage = null
}) {
  try {
    const now = new Date().toISOString();
    await query.run(
      `INSERT INTO notifications (authorizationId, recipientType, recipient, channel, status, message, sentAt, errorMessage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [authorizationId, recipientType, recipient, channel, status, message, now, errorMessage]
    );
  } catch (err) {
    logger.error('Failed to log notification in SQLite:', err.message);
  }
}

// -------------------------------------------------------------
// Real Email Dispatch with Retry
// -------------------------------------------------------------
async function sendEmailNotification({
  authorizationId,
  visitorNames,
  authorizationStatus,
  authorizationDate,
  authorizationTime,
  gateVerificationStatus = 'PENDING VERIFICATION'
}) {
  console.log('[EMAIL] Attempting email notification...');

  const validation = validateEmailConfig();
  const namesStr = Array.isArray(visitorNames) ? visitorNames.join(', ') : visitorNames;
  const dateStr = authorizationDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const subject = `Main Gate Visitor Authorization - ${authorizationId}`;
  const body =
    `MAIN GATE SECURITY ALERT\n\n` +
    `Visitor Name(s): ${namesStr}\n` +
    `Authorization ID: ${authorizationId}\n` +
    `Authorization Status: ${authorizationStatus}\n` +
    `Date: ${dateStr}\n` +
    `Time: ${authorizationTime}\n` +
    `Gate Verification: ${gateVerificationStatus}\n\n` +
    `Instructions for Gate Verification:\n` +
    `Please ask the visitor to present Authorization ID "${authorizationId}" and enter the Master PIN at the Main Gate counter to verify entry.`;

  if (!validation.valid) {
    console.error(`[EMAIL] Email failed`);
    console.error(`Error code: ${validation.errorCode}`);
    console.error(`Error message: ${validation.message}`);

    await logNotificationRecord({
      authorizationId,
      recipientType: 'SECURITY',
      recipient: validation.config?.securityEmail || 'NOT_CONFIGURED',
      channel: 'EMAIL',
      status: 'FAILED',
      message: body,
      errorMessage: validation.message
    });

    return {
      status: 'failed',
      errorCode: validation.errorCode,
      message: validation.message,
      missing: validation.missing
    };
  }

  const { host, port, user, pass, from, securityEmail } = validation.config;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[EMAIL] Retrying email dispatch (attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }

      const info = await transporter.sendMail({
        from: from ? `"Main Gate Security" <${from}>` : `"Main Gate Security" <${user}>`,
        to: securityEmail,
        subject,
        text: body
      });

      console.log('[EMAIL] Provider response: Accepted by SMTP');
      console.log(`[EMAIL] Email sent successfully\nMessage ID: ${info.messageId}`);

      await logNotificationRecord({
        authorizationId,
        recipientType: 'SECURITY',
        recipient: securityEmail,
        channel: 'EMAIL',
        status: 'SENT',
        message: body
      });

      return {
        status: 'sent',
        messageId: info.messageId
      };
    } catch (err) {
      lastError = err;
      console.warn(`[EMAIL] Attempt ${attempt} failed: ${err.message}`);
    }
  }

  console.error('[EMAIL] Email failed');
  console.error(`Error code: ${lastError.code || 'SMTP_ERROR'}`);
  console.error(`Error message: ${lastError.message}`);

  await logNotificationRecord({
    authorizationId,
    recipientType: 'SECURITY',
    recipient: securityEmail,
    channel: 'EMAIL',
    status: 'FAILED',
    message: body,
    errorMessage: lastError.message
  });

  return {
    status: 'failed',
    errorCode: lastError.code || 'SMTP_ERROR',
    message: lastError.message
  };
}

// -------------------------------------------------------------
// Real SMS Dispatch with Retry
// -------------------------------------------------------------
async function sendSmsNotification({
  authorizationId,
  visitorNames,
  authorizationStatus,
  gateVerificationStatus = 'PENDING'
}) {
  console.log('[SMS] Attempting SMS notification...');

  const validation = validateSmsConfig();
  const namesStr = Array.isArray(visitorNames) ? visitorNames.join(', ') : visitorNames;

  const body =
    `Main Gate Visitor Authorization\n\n` +
    `Authorization ID: ${authorizationId}\n` +
    `Visitors: ${namesStr}\n` +
    `Status: ${authorizationStatus}\n` +
    `Gate Verification: ${gateVerificationStatus}`;

  if (!validation.valid) {
    console.error(`[SMS] SMS failed`);
    console.error(`Error code: ${validation.errorCode}`);
    console.error(`Error message: ${validation.message}`);

    await logNotificationRecord({
      authorizationId,
      recipientType: 'SECURITY',
      recipient: validation.config?.securityPhone || 'NOT_CONFIGURED',
      channel: 'SMS',
      status: 'FAILED',
      message: body,
      errorMessage: validation.message
    });

    return {
      status: 'failed',
      errorCode: validation.errorCode,
      message: validation.message,
      missing: validation.missing
    };
  }

  const { apiKey, apiSecret, from, securityPhone } = validation.config;

  let twilioClient;
  try {
    const twilio = require('twilio');
    twilioClient = twilio(apiKey, apiSecret);
  } catch (err) {
    return {
      status: 'failed',
      errorCode: 'TWILIO_CLIENT_ERROR',
      message: err.message
    };
  }

  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[SMS] Retrying SMS dispatch (attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }

      const msg = await twilioClient.messages.create({
        body,
        from,
        to: securityPhone
      });

      console.log(`[SMS] Provider response: Accepted with status ${msg.status}`);
      console.log(`[SMS] SMS sent successfully\nMessage ID: ${msg.sid}`);

      await logNotificationRecord({
        authorizationId,
        recipientType: 'SECURITY',
        recipient: securityPhone,
        channel: 'SMS',
        status: 'SENT',
        message: body
      });

      return {
        status: 'sent',
        messageId: msg.sid
      };
    } catch (err) {
      lastError = err;
      console.warn(`[SMS] Attempt ${attempt} failed: ${err.message}`);
    }
  }

  console.error('[SMS] SMS failed');
  console.error(`Error code: ${lastError.code || 'SMS_ERROR'}`);
  console.error(`Error message: ${lastError.message}`);

  await logNotificationRecord({
    authorizationId,
    recipientType: 'SECURITY',
    recipient: securityPhone,
    channel: 'SMS',
    status: 'FAILED',
    message: body,
    errorMessage: lastError.message
  });

  return {
    status: 'failed',
    errorCode: lastError.code || 'SMS_ERROR',
    message: lastError.message
  };
}

// -------------------------------------------------------------
// Combined Authorization Notifications Handler
// -------------------------------------------------------------
async function dispatchAuthorizationAlerts({
  authorizationId,
  visitorNames,
  authorizationStatus,
  authorizationTime,
  gateVerificationStatus = 'PENDING VERIFICATION',
  visitorContacts = []
}) {
  console.log(`\n[AUTHORIZATION]\nAuthorization created: ${authorizationId}`);

  // Send real email and real SMS concurrently to security
  const [emailResult, smsResult] = await Promise.all([
    sendEmailNotification({
      authorizationId,
      visitorNames,
      authorizationStatus,
      authorizationTime,
      gateVerificationStatus
    }),
    sendSmsNotification({
      authorizationId,
      visitorNames,
      authorizationStatus,
      gateVerificationStatus: 'PENDING'
    })
  ]);

  // Process visitor notifications for contacts found in database
  const visitorEmailResults = [];
  const visitorSmsResults = [];

  if (Array.isArray(visitorContacts) && visitorContacts.length > 0) {
    const emailValidation = validateEmailConfig();
    const smsValidation = validateSmsConfig();

    for (const v of visitorContacts) {
      // 1. Visitor Email
      if (v.email && v.email.trim()) {
        const visEmailBody =
          `Visitor Entry Authorization\n\n` +
          `Hello ${v.name},\n\n` +
          `Your visitor entry has been authorized.\n\n` +
          `Authorization ID:\n${authorizationId}\n\n` +
          `Status:\n${authorizationStatus}\n\n` +
          `Please provide the Authorization ID at the Main Gate.`;

        if (!emailValidation.valid) {
          await logNotificationRecord({
            authorizationId,
            recipientType: 'VISITOR',
            recipient: v.email,
            channel: 'EMAIL',
            status: 'FAILED',
            message: visEmailBody,
            errorMessage: emailValidation.message
          });
          visitorEmailResults.push({
            name: v.name,
            email: v.email,
            success: false,
            error: emailValidation.message
          });
        } else {
          try {
            const { host, port, user, pass, from } = emailValidation.config;
            const transporter = nodemailer.createTransport({
              host,
              port,
              secure: port === 465,
              auth: { user, pass },
              tls: { rejectUnauthorized: false }
            });
            const info = await transporter.sendMail({
              from: from ? `"Main Gate Security" <${from}>` : `"Main Gate Security" <${user}>`,
              to: v.email,
              subject: `Visitor Entry Authorization — ${authorizationId}`,
              text: visEmailBody
            });
            await logNotificationRecord({
              authorizationId,
              recipientType: 'VISITOR',
              recipient: v.email,
              channel: 'EMAIL',
              status: 'SENT',
              message: visEmailBody
            });
            visitorEmailResults.push({
              name: v.name,
              email: v.email,
              success: true,
              messageId: info.messageId
            });
          } catch (err) {
            await logNotificationRecord({
              authorizationId,
              recipientType: 'VISITOR',
              recipient: v.email,
              channel: 'EMAIL',
              status: 'FAILED',
              message: visEmailBody,
              errorMessage: err.message
            });
            visitorEmailResults.push({
              name: v.name,
              email: v.email,
              success: false,
              error: err.message
            });
          }
        }
      }

      // 2. Visitor SMS
      if (v.phone && v.phone.trim()) {
        const visSmsBody = `Main Gate: Your visitor entry is AUTHORIZED. Authorization ID: ${authorizationId}.`;

        if (!smsValidation.valid) {
          await logNotificationRecord({
            authorizationId,
            recipientType: 'VISITOR',
            recipient: v.phone,
            channel: 'SMS',
            status: 'FAILED',
            message: visSmsBody,
            errorMessage: smsValidation.message
          });
          visitorSmsResults.push({
            name: v.name,
            phone: v.phone,
            success: false,
            error: smsValidation.message
          });
        } else {
          try {
            const { apiKey, apiSecret, from } = smsValidation.config;
            const twilio = require('twilio');
            const client = twilio(apiKey, apiSecret);
            const msg = await client.messages.create({
              body: visSmsBody,
              from,
              to: v.phone
            });
            await logNotificationRecord({
              authorizationId,
              recipientType: 'VISITOR',
              recipient: v.phone,
              channel: 'SMS',
              status: 'SENT',
              message: visSmsBody
            });
            visitorSmsResults.push({
              name: v.name,
              phone: v.phone,
              success: true,
              messageId: msg.sid
            });
          } catch (err) {
            await logNotificationRecord({
              authorizationId,
              recipientType: 'VISITOR',
              recipient: v.phone,
              channel: 'SMS',
              status: 'FAILED',
              message: visSmsBody,
              errorMessage: err.message
            });
            visitorSmsResults.push({
              name: v.name,
              phone: v.phone,
              success: false,
              error: err.message
            });
          }
        }
      }
    }
  }

  emailResult.security = emailResult.status === 'sent';
  emailResult.visitors = visitorEmailResults;
  smsResult.visitors = visitorSmsResults;

  return {
    email: emailResult,
    sms: smsResult
  };
}

// -------------------------------------------------------------
// Development Diagnostics / Health Check Endpoint
// -------------------------------------------------------------
async function checkNotificationHealth() {
  const emailValidation = validateEmailConfig();
  const smsValidation = validateSmsConfig();

  const emailHealth = {
    configured: emailValidation.valid,
    provider: 'SMTP',
    connection: 'UNKNOWN'
  };

  if (emailValidation.valid) {
    try {
      const { host, port, user, pass } = emailValidation.config;
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
      });
      await transporter.verify();
      emailHealth.connection = 'OK';
    } catch (err) {
      emailHealth.connection = `FAILED: ${err.message}`;
    }
  } else {
    emailHealth.connection = `NOT_CONFIGURED: ${emailValidation.message}`;
  }

  const smsHealth = {
    configured: smsValidation.valid,
    provider: smsValidation.config?.provider || 'Twilio',
    connection: 'UNKNOWN'
  };

  if (smsValidation.valid) {
    try {
      const twilio = require('twilio');
      const client = twilio(smsValidation.config.apiKey, smsValidation.config.apiSecret);
      // Verify credentials by reading account details
      await client.api.accounts(smsValidation.config.apiKey).fetch();
      smsHealth.connection = 'OK';
    } catch (err) {
      smsHealth.connection = `FAILED: ${err.message}`;
    }
  } else {
    smsHealth.connection = `NOT_CONFIGURED: ${smsValidation.message}`;
  }

  return {
    email: emailHealth,
    sms: smsHealth
  };
}

async function getNotificationsByAuthorizationId(authorizationId) {
  return await query.all(
    `SELECT * FROM notifications WHERE authorizationId = ? ORDER BY id ASC`,
    [authorizationId]
  );
}

module.exports = {
  validateEmailConfig,
  validateSmsConfig,
  sendEmailNotification,
  sendSmsNotification,
  dispatchAuthorizationAlerts,
  checkNotificationHealth,
  getNotificationsByAuthorizationId
};
