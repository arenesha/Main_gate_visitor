const express = require('express');
const router = express.Router();
const env = require('../config/env');
const { sendTestEmail, verifySmtpConnection, isSmtpConfigured } = require('../services/email.service');
const { sendTestSms, isTwilioConfigured, isFast2SmsConfigured } = require('../services/sms.service');
const logger = require('../utils/logger');

/**
 * GET /api/test/status
 * Returns safe diagnostic snapshot of notification configurations without revealing secrets
 */
router.get('/status', async (req, res) => {
  const emailReady = isSmtpConfigured();
  const twilioReady = isTwilioConfigured();
  const fast2smsReady = isFast2SmsConfigured();

  res.status(200).json({
    email: {
      configured: emailReady,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      userConfigured: Boolean(env.SMTP_USER && !env.isPlaceholder(env.SMTP_USER)),
      passwordConfigured: Boolean(env.SMTP_PASSWORD && !env.isPlaceholder(env.SMTP_PASSWORD)),
      recipient: env.MAIN_GATE_EMAIL
    },
    sms: {
      configured: twilioReady || fast2smsReady,
      activeProvider: twilioReady ? 'Twilio' : (fast2smsReady ? 'Fast2SMS' : 'None'),
      twilioSidConfigured: Boolean(env.TWILIO_ACCOUNT_SID && !env.isPlaceholder(env.TWILIO_ACCOUNT_SID)),
      twilioTokenConfigured: Boolean(env.TWILIO_AUTH_TOKEN && !env.isPlaceholder(env.TWILIO_AUTH_TOKEN)),
      twilioPhoneConfigured: Boolean(env.TWILIO_PHONE_NUMBER && !env.isPlaceholder(env.TWILIO_PHONE_NUMBER)),
      recipientPhoneConfigured: Boolean(env.SECURITY_PHONE_NUMBER && !env.isPlaceholder(env.SECURITY_PHONE_NUMBER)),
      recipientPhone: env.SECURITY_PHONE_NUMBER ? env.SECURITY_PHONE_NUMBER.replace(/\d(?=\d{4})/g, '*') : 'NOT SET',
      fast2smsKeyConfigured: Boolean(env.FAST2SMS_API_KEY && !env.isPlaceholder(env.FAST2SMS_API_KEY))
    }
  });
});

/**
 * POST /api/test/email
 * Triggers an immediate test email dispatch using configured SMTP credentials
 */
router.post('/email', async (req, res) => {
  const { to, subject, body } = req.body || {};
  logger.info(`[TEST API] Independent email test requested to ${to || env.MAIN_GATE_EMAIL}`);

  const result = await sendTestEmail({ to, subject, body });

  if (result.success) {
    return res.status(200).json({
      success: true,
      status: 'SENT',
      message: 'Test email sent successfully via SMTP',
      messageId: result.messageId,
      recipient: result.recipient
    });
  } else {
    return res.status(400).json({
      success: false,
      status: 'FAILED',
      message: 'Failed to send test email',
      error: result.error,
      code: result.code,
      diagnostics: result.diagnostics
    });
  }
});

/**
 * POST /api/test/sms
 * Triggers an immediate test SMS dispatch using Twilio or Fast2SMS
 */
router.post('/sms', async (req, res) => {
  const { to, message } = req.body || {};
  logger.info(`[TEST API] Independent SMS test requested to ${to || env.SECURITY_PHONE_NUMBER || 'DEFAULT'}`);

  const result = await sendTestSms({ to, message });

  if (result.success) {
    return res.status(200).json({
      success: true,
      status: 'SENT',
      provider: result.provider,
      message: `Test SMS sent successfully via ${result.provider}`,
      messageId: result.messageId,
      recipient: result.recipient
    });
  } else {
    return res.status(400).json({
      success: false,
      status: 'FAILED',
      message: 'Failed to send test SMS',
      error: result.error,
      code: result.code,
      diagnostics: result.diagnostics
    });
  }
});

module.exports = router;
