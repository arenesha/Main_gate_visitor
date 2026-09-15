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
 * Sends Real Visitor Authorization SMS via Twilio (or Fast2SMS fallback)
 * IMPORTANT: Contains PIN in message as requested, but NEVER logs PIN to console or logs.
 */
async function sendVisitorAuthorizationSMS({ visitorNames, pin, date, time, authorizationId }) {
  const targetPhone = env.SECURITY_PHONE_NUMBER;
  logger.info(`[SMS] Starting SMS dispatch for authorization to target: ${targetPhone || 'UNSPECIFIED'}`);

  // Development mode check
  if (!env.REAL_NOTIFICATIONS) {
    logger.info('[SMS] Mock mode active (REAL_NOTIFICATIONS=false). SMS delivery simulated.');
    return {
      success: true,
      status: 'SENT',
      messageId: `mock-sms-${Date.now()}`
    };
  }

  const namesStr = Array.isArray(visitorNames) ? visitorNames.join(', ') : visitorNames;
  const authDate = date || new Date().toLocaleDateString('en-GB');
  const authTime = time || new Date().toLocaleTimeString('en-GB');

  const smsBody = `Main Gate Alert
Visitor(s):
${namesStr}
Status:
AUTHORIZED
PIN:
${pin}
Date:
${authDate}
Time:
${authTime}
Please verify the visitor name(s) and PIN at the main gate.`;

  // 1. Twilio REST API
  if (isTwilioConfigured()) {
    try {
      logger.info(`[SMS] Dispatching via Twilio (From: ${env.TWILIO_PHONE_NUMBER})...`);
      const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      const res = await client.messages.create({
        body: smsBody,
        from: env.TWILIO_PHONE_NUMBER,
        to: targetPhone
      });

      logger.info(`[SMS] SENT: Real Twilio SMS sent successfully. SID: ${res.sid}`);
      return {
        success: true,
        status: 'SENT',
        messageId: res.sid
      };
    } catch (err) {
      logger.error(`[SMS] FAILED: Twilio SMS dispatch error: ${err.message}`);
      return {
        success: false,
        status: 'FAILED',
        error: err.message
      };
    }
  }

  // 2. Fast2SMS (Optional fallback for Indian mobile numbers)
  if (isFast2SmsConfigured()) {
    logger.info(`[SMS] Dispatching via Fast2SMS to ${targetPhone}...`);
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
              logger.info(`[SMS] SENT: Fast2SMS delivered successfully. ID: ${parsed.request_id}`);
              resolve({
                success: true,
                status: 'SENT',
                messageId: parsed.request_id || 'fast2sms-ok'
              });
            } else {
              logger.error(`[SMS] FAILED: Fast2SMS response error: ${parsed.message}`);
              resolve({
                success: false,
                status: 'FAILED',
                error: parsed.message || 'Fast2SMS error'
              });
            }
          } catch (pe) {
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
  }

  // Neither configured
  const reason = 'Neither Twilio credentials nor Fast2SMS API key configured in .env (TWILIO_ACCOUNT_SID / FAST2SMS_API_KEY)';
  logger.warn(`[SMS] FAILED: ${reason}`);
  return {
    success: false,
    status: 'FAILED',
    error: reason
  };
}

/**
 * Backward compatible alias for authorization service
 */
async function sendAuthorizationSms({ authorizationId, visitorNames, pin, createdAt }) {
  const dateStr = createdAt ? new Date(createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  const timeStr = createdAt ? new Date(createdAt).toLocaleTimeString('en-GB') : new Date().toLocaleTimeString('en-GB');
  return sendVisitorAuthorizationSMS({
    visitorNames,
    pin: pin || 'VERIFIED',
    date: dateStr,
    time: timeStr,
    authorizationId
  });
}

/**
 * Send independent test SMS
 */
async function sendTestSms({ to, message } = {}) {
  const targetPhone = to || env.SECURITY_PHONE_NUMBER;
  const content = message || `[Gatekeeper Test] Security SMS test dispatch at ${new Date().toLocaleTimeString()}`;

  if (isTwilioConfigured()) {
    try {
      const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      const res = await client.messages.create({
        body: content,
        from: env.TWILIO_PHONE_NUMBER,
        to: targetPhone
      });
      return { success: true, status: 'SENT', messageId: res.sid, provider: 'Twilio' };
    } catch (err) {
      return { success: false, status: 'FAILED', error: err.message, provider: 'Twilio' };
    }
  }

  return {
    success: false,
    status: 'FAILED',
    error: 'Twilio credentials not configured in .env'
  };
}

module.exports = {
  sendVisitorAuthorizationSMS,
  sendAuthorizationSms,
  sendTestSms,
  isTwilioConfigured,
  isFast2SmsConfigured
};
