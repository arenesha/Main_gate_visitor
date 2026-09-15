const twilio = require('twilio');
const https = require('https');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Validates whether Twilio credentials are real and not placeholders
 */
function isTwilioConfigured() {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_PHONE_NUMBER &&
    env.SECURITY_PHONE_NUMBER &&
    !env.isPlaceholder(env.TWILIO_ACCOUNT_SID) &&
    !env.isPlaceholder(env.TWILIO_AUTH_TOKEN) &&
    !env.isPlaceholder(env.TWILIO_PHONE_NUMBER)
  );
}

/**
 * Validates whether Fast2SMS credentials are configured
 */
function isFast2SmsConfigured() {
  return Boolean(
    env.FAST2SMS_API_KEY &&
    env.SECURITY_PHONE_NUMBER &&
    !env.isPlaceholder(env.FAST2SMS_API_KEY)
  );
}

/**
 * Send independent test SMS
 */
async function sendTestSms({ to, message } = {}) {
  const targetPhone = to || env.SECURITY_PHONE_NUMBER;
  const content = message || `[TEST] Main Gate Visitor Security SMS test - ${new Date().toLocaleTimeString()}`;

  logger.info(`[SMS] Starting test SMS dispatch to: ${targetPhone || 'UNSPECIFIED'}`);

  if (isTwilioConfigured()) {
    try {
      logger.info(`[SMS] Attempting test dispatch via Twilio (From: ${env.TWILIO_PHONE_NUMBER})...`);
      const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      const res = await client.messages.create({
        body: content,
        from: env.TWILIO_PHONE_NUMBER,
        to: targetPhone
      });

      logger.info(`[SMS] SENT successfully via Twilio. SID: ${res.sid}`);
      return {
        success: true,
        status: 'SENT',
        provider: 'Twilio',
        messageId: res.sid,
        recipient: targetPhone
      };
    } catch (err) {
      logger.error(`[SMS] FAILED via Twilio: ${err.message}`);
      return {
        success: false,
        status: 'FAILED',
        provider: 'Twilio',
        error: err.message,
        code: err.code || 'TWILIO_ERROR'
      };
    }
  }

  if (isFast2SmsConfigured()) {
    try {
      logger.info(`[SMS] Attempting test dispatch via Fast2SMS...`);
      const phoneClean = targetPhone.replace(/\D/g, '').slice(-10);
      const postData = JSON.stringify({
        route: 'q',
        message: content,
        language: 'english',
        flash: 0,
        numbers: phoneClean
      });

      return new Promise((resolve) => {
        const req = https.request({
          hostname: 'www.fast2sms.com',
          path: '/dev/bulkV2',
          method: 'POST',
          headers: {
            'authorization': env.FAST2SMS_API_KEY,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 10000
        }, (res) => {
          let rawData = '';
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(rawData);
              if (parsed.return === true) {
                logger.info(`[SMS] SENT successfully via Fast2SMS. ID: ${parsed.request_id}`);
                resolve({
                  success: true,
                  status: 'SENT',
                  provider: 'Fast2SMS',
                  messageId: parsed.request_id || 'fast2sms-ok'
                });
              } else {
                logger.error(`[SMS] FAILED via Fast2SMS: ${parsed.message}`);
                resolve({
                  success: false,
                  status: 'FAILED',
                  provider: 'Fast2SMS',
                  error: parsed.message || 'Fast2SMS dispatch error'
                });
              }
            } catch (pErr) {
              resolve({ success: false, status: 'FAILED', error: 'Invalid response from Fast2SMS' });
            }
          });
        });

        req.on('error', (e) => {
          logger.error(`[SMS] FAILED: Fast2SMS network error: ${e.message}`);
          resolve({ success: false, status: 'FAILED', error: e.message });
        });

        req.write(postData);
        req.end();
      });
    } catch (fastErr) {
      logger.error(`[SMS] FAILED via Fast2SMS: ${fastErr.message}`);
      return { success: false, status: 'FAILED', error: fastErr.message };
    }
  }

  const reason = 'Neither Twilio credentials nor Fast2SMS API key configured in .env';
  logger.error(`[SMS] FAILED: ${reason}`);
  return {
    success: false,
    status: 'FAILED',
    error: reason,
    diagnostics: {
      twilioSidConfigured: Boolean(env.TWILIO_ACCOUNT_SID && !env.isPlaceholder(env.TWILIO_ACCOUNT_SID)),
      twilioTokenConfigured: Boolean(env.TWILIO_AUTH_TOKEN && !env.isPlaceholder(env.TWILIO_AUTH_TOKEN)),
      twilioPhoneConfigured: Boolean(env.TWILIO_PHONE_NUMBER && !env.isPlaceholder(env.TWILIO_PHONE_NUMBER)),
      securityPhoneConfigured: Boolean(env.SECURITY_PHONE_NUMBER && !env.isPlaceholder(env.SECURITY_PHONE_NUMBER)),
      fast2smsKeyConfigured: Boolean(env.FAST2SMS_API_KEY && !env.isPlaceholder(env.FAST2SMS_API_KEY))
    }
  };
}

/**
 * Sends real SMS for authorization flow
 * Returns: { success: boolean, status: 'SENT'|'FAILED', messageId?: string, error?: string }
 */
async function sendAuthorizationSms({ authorizationId, visitorNames }) {
  const namesStr = Array.isArray(visitorNames) ? visitorNames.join(', ') : visitorNames;
  const smsBody = `MAIN GATE VISITOR AUTHORIZATION
Visitors:
${namesStr}
Status:
AUTHORIZED
Reference:
${authorizationId}
Please verify at Main Gate.`;

  const targetPhone = env.SECURITY_PHONE_NUMBER;
  logger.info(`[SMS] Starting authorization SMS send for ${authorizationId} to ${targetPhone || 'UNSPECIFIED'}`);

  // 1. Check Twilio Configuration
  if (isTwilioConfigured()) {
    try {
      logger.info(`[SMS] Dispatching authorization SMS via Twilio to ${targetPhone}...`);
      const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      const message = await client.messages.create({
        body: smsBody,
        from: env.TWILIO_PHONE_NUMBER,
        to: targetPhone
      });

      logger.info(`[SMS] SENT: Real Twilio SMS sent for ${authorizationId}. SID: ${message.sid}`);
      return {
        success: true,
        status: 'SENT',
        messageId: message.sid
      };
    } catch (err) {
      logger.error(`[SMS] FAILED: Twilio SMS error for ${authorizationId}: ${err.message}`);
      return {
        success: false,
        status: 'FAILED',
        error: err.message
      };
    }
  }

  // 2. Check Fast2SMS configuration (Fallback for Indian mobile numbers)
  if (isFast2SmsConfigured()) {
    logger.info(`[SMS] Dispatching authorization SMS via Fast2SMS to ${targetPhone}...`);
    return new Promise((resolve) => {
      const phoneClean = targetPhone.replace(/\D/g, '').slice(-10);
      const postData = JSON.stringify({
        route: 'q',
        message: smsBody,
        language: 'english',
        flash: 0,
        numbers: phoneClean
      });

      const req = https.request({
        hostname: 'www.fast2sms.com',
        path: '/dev/bulkV2',
        method: 'POST',
        headers: {
          'authorization': env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      }, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            if (parsed.return === true) {
              logger.info(`[SMS] SENT: Fast2SMS sent for ${authorizationId}. Request ID: ${parsed.request_id}`);
              resolve({
                success: true,
                status: 'SENT',
                messageId: parsed.request_id || 'fast2sms-ok'
              });
            } else {
              logger.error(`[SMS] FAILED: Fast2SMS failed for ${authorizationId}: ${parsed.message}`);
              resolve({
                success: false,
                status: 'FAILED',
                error: parsed.message || 'Fast2SMS dispatch error'
              });
            }
          } catch (parseErr) {
            resolve({ success: false, status: 'FAILED', error: 'Invalid response from SMS gateway' });
          }
        });
      });

      req.on('error', (e) => {
        logger.error(`[SMS] FAILED: Fast2SMS connection error: ${e.message}`);
        resolve({ success: false, status: 'FAILED', error: e.message });
      });

      req.write(postData);
      req.end();
    });
  }

  // Neither SMS provider configured
  const reason = 'Neither Twilio credentials nor Fast2SMS API key configured in .env (TWILIO_ACCOUNT_SID / FAST2SMS_API_KEY)';
  logger.warn(`[SMS] FAILED for ${authorizationId}: ${reason}`);
  return {
    success: false,
    status: 'FAILED',
    error: reason
  };
}

const smsService = require('./smsService');

module.exports = {
  ...smsService
};

