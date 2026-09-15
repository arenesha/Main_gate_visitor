const { sendVisitorAuthorizationEmail } = require("./emailService");
const { sendVisitorAuthorizationSMS } = require("./smsService");
const logger = require("../utils/logger");

/**
 * Dispatches real Email and SMS notifications independently
 * @param {string[]} visitorNames
 * @param {string} pin
 * @param {string} date
 * @param {string} time
 * @param {string} [recipientEmail]
 * @param {string} [recipientPhone]
 * @returns {Promise<{emailSent: boolean, smsSent: boolean, emailError?: string, smsError?: string}>}
 */
async function dispatchVisitorAuthorizationNotifications(visitorNames, pin, date, time, recipientEmail = null, recipientPhone = null) {
  logger.info(`[NOTIFICATION SERVICE] Triggering notification dispatch for visitors: ${visitorNames.join(", ")}`);

  const [emailResult, smsResult] = await Promise.all([
    sendVisitorAuthorizationEmail(visitorNames, pin, date, time, recipientEmail),
    sendVisitorAuthorizationSMS(visitorNames, pin, date, time, recipientPhone)
  ]);

  logger.info(`[NOTIFICATION RESULTS] Email Result: ${emailResult.success ? "SUCCESS" : "FAILED (" + emailResult.error + ")"} | SMS Result: ${smsResult.success ? "SUCCESS" : "FAILED (" + smsResult.error + ")"}`);

  return {
    emailSent: emailResult.success,
    smsSent: smsResult.success,
    emailError: emailResult.error || null,
    smsError: smsResult.error || null
  };
}

module.exports = {
  dispatchVisitorAuthorizationNotifications
};
