const twilio = require("twilio");
const logger = require("../utils/logger");

let twilioClient = null;

function getTwilioClient() {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();

  if (!accountSid || !authToken || accountSid.startsWith("your_") || authToken.startsWith("your_")) {
    return null;
  }

  if (!twilioClient) {
    try {
      twilioClient = twilio(accountSid, authToken);
    } catch (err) {
      logger.error("Failed to initialize Twilio client:", err.message);
      return null;
    }
  }

  return twilioClient;
}

function formatSmsDate() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Sends visitor entry authorization SMS to Main Gate Security
 * @param {string[]} visitorNames
 * @param {string} date - formatted date
 * @param {string} time - formatted time
 * @param {string} pin - authorization PIN
 * @returns {Promise<{success: boolean, error: string|null, mock: boolean}>}
 */
async function sendVisitorAuthorizationSMS(visitorNames, date, time, pin) {
  const authorizedPhone = (process.env.AUTHORIZED_PHONE || "").trim();
  const fromPhone = (process.env.TWILIO_PHONE_NUMBER || "").trim();
  const namesJoined = visitorNames.join(", ");
  const smsDate = formatSmsDate();

  const messageBody = `Main Gate Alert: Visitor entry authorized for ${namesJoined}. Status: AUTHORIZED. PIN: ${pin}. Date: ${smsDate} Time: ${time}.`;

  const client = getTwilioClient();

  if (!client || !fromPhone || !authorizedPhone) {
    logger.info(`[SMS MOCK/DEV] Twilio unconfigured or phone missing. Simulating SMS dispatch to: ${authorizedPhone || "Main Gate Security"}`);
    logger.info(`[SMS CONTENT]\nTo: ${authorizedPhone}\n${messageBody}`);
    return {
      success: true,
      error: null,
      mock: true
    };
  }

  try {
    const message = await client.messages.create({
      body: messageBody,
      from: fromPhone,
      to: authorizedPhone
    });

    logger.info(`[SMS SUCCESS] SMS sent to ${authorizedPhone}. SID: ${message.sid}`);
    return {
      success: true,
      error: null,
      mock: false,
      sid: message.sid
    };
  } catch (err) {
    logger.error(`[SMS ERROR] Failed to send SMS to ${authorizedPhone}: ${err.message}`);
    return {
      success: false,
      error: err.message,
      mock: false
    };
  }
}

module.exports = {
  sendVisitorAuthorizationSMS
};
