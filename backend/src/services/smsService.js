const twilio = require("twilio");
const logger = require("../utils/logger");

/**
 * Initializes Twilio Client using backend environment variables
 */
function getTwilioClient() {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();

  if (!accountSid || !authToken || accountSid.startsWith("your_") || authToken.startsWith("your_")) {
    logger.warn("[SMS SERVICE] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not configured in .env.");
    return null;
  }

  try {
    return twilio(accountSid, authToken);
  } catch (err) {
    logger.error("[SMS SERVICE] Failed to initialize Twilio SDK:", err.message);
    return null;
  }
}

/**
 * Sends a real SMS to Main Gate Security via Twilio
 * @param {string[]} visitorNames - Array of visitor names
 * @param {string} pin - Authorization PIN
 * @param {string} date - Formatted date
 * @param {string} time - Formatted time
 * @param {string} [recipientPhone] - Optional override phone configured by admin
 * @returns {Promise<{success: boolean, error?: string, sid?: string}>}
 */
async function sendVisitorAuthorizationSMS(visitorNames, pin, date, time, recipientPhone = null) {
  const securityPhone = (recipientPhone || process.env.SECURITY_PHONE_NUMBER || process.env.AUTHORIZED_PHONE || "").trim();
  const fromPhone = (process.env.TWILIO_PHONE_NUMBER || "").trim();

  if (!securityPhone) {
    const errorMsg = "SECURITY_PHONE_NUMBER is not configured in backend .env file.";
    logger.error(`[SMS FAILED] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  if (!fromPhone) {
    const errorMsg = "TWILIO_PHONE_NUMBER is not configured in backend .env file.";
    logger.error(`[SMS FAILED] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const client = getTwilioClient();
  if (!client) {
    const errorMsg = "Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) are not configured in backend .env file.";
    logger.error(`[SMS FAILED] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const namesJoined = visitorNames.join(", ");

  const messageBody = `Main Gate Alert: Visitor entry authorized for ${namesJoined}. Status: AUTHORIZED. PIN: ${pin}. Date: ${date} Time: ${time}. Please verify PIN at gate.`;

  try {
    logger.info(`[REAL SMS DISPATCH] Attempting Twilio dispatch to ${securityPhone} from ${fromPhone}...`);
    const message = await client.messages.create({
      body: messageBody,
      from: fromPhone,
      to: securityPhone
    });

    logger.info(`[REAL SMS SUCCESS] Sent to ${securityPhone}. Message SID: ${message.sid}`);
    return {
      success: true,
      sid: message.sid
    };
  } catch (err) {
    logger.error(`[REAL SMS ERROR] Failed to send SMS via Twilio to ${securityPhone}: ${err.message}`);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  sendVisitorAuthorizationSMS
};
