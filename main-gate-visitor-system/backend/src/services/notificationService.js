const { sendVisitorAuthorizationEmail } = require('./emailService');
const { sendVisitorAuthorizationSMS } = require('./smsService');
const logger = require('../utils/logger');

/**
 * Dispatches real email and SMS independently after successful PIN authorization.
 * An email failure MUST NOT prevent SMS from being attempted, and vice versa.
 */
async function sendVisitorAuthorizationNotifications({ visitorNames, pin, date, time, authorizationId }) {
  logger.info(`[NOTIFICATIONS] Initiating parallel real dispatch for authorization: ${authorizationId || 'NEW'}`);

  const [emailResult, smsResult] = await Promise.all([
    sendVisitorAuthorizationEmail({ visitorNames, pin, date, time, authorizationId })
      .catch((err) => ({ success: false, status: 'FAILED', error: err.message })),
    sendVisitorAuthorizationSMS({ visitorNames, pin, date, time, authorizationId })
      .catch((err) => ({ success: false, status: 'FAILED', error: err.message }))
  ]);

  const emailSent = Boolean(emailResult && emailResult.success && emailResult.status === 'SENT');
  const smsSent = Boolean(smsResult && smsResult.success && smsResult.status === 'SENT');

  return {
    emailSent,
    smsSent,
    emailStatus: emailSent ? 'SENT' : 'FAILED',
    smsStatus: smsSent ? 'SENT' : 'FAILED',
    emailError: emailResult.error || null,
    smsError: smsResult.error || null,
    emailMessageId: emailResult.messageId || null,
    smsMessageId: smsResult.messageId || null
  };
}

module.exports = {
  sendVisitorAuthorizationNotifications
};
