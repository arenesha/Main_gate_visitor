const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

/**
 * Creates Nodemailer transporter using backend environment variables or DB configuration
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASSWORD || "").trim();

  if (!user || !pass) {
    logger.warn("[EMAIL SERVICE] SMTP_USER or SMTP_PASSWORD is not configured in .env.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Sends a real email to Main Gate Security via Nodemailer
 * @param {string[]} visitorNames - Array of visitor names
 * @param {string} pin - Authorization PIN
 * @param {string} date - Formatted date
 * @param {string} time - Formatted time
 * @param {string} [recipientEmail] - Optional override email configured by admin
 * @returns {Promise<{success: boolean, error?: string, messageId?: string}>}
 */
async function sendVisitorAuthorizationEmail(visitorNames, pin, date, time, recipientEmail = null) {
  const securityEmail = (recipientEmail || process.env.SECURITY_EMAIL || process.env.AUTH_EMAIL || "").trim();
  const smtpUser = (process.env.SMTP_USER || "").trim();

  if (!securityEmail) {
    const errorMsg = "SECURITY_EMAIL is not configured in backend .env file.";
    logger.error(`[EMAIL FAILED] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const transporter = getTransporter();
  if (!transporter) {
    const errorMsg = "SMTP credentials (SMTP_USER / SMTP_PASSWORD) are not configured in backend .env file.";
    logger.error(`[EMAIL FAILED] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const namesFormatted = visitorNames.map((name) => `• ${name}`).join("\n");
  const namesListHtml = visitorNames.map((name) => `<li><strong>${name}</strong></li>`).join("");

  const subject = "Main Gate Visitor Entry Authorization";

  const plainText = `MAIN GATE VISITOR ENTRY AUTHORIZATION\n\n` +
    `Visitor Name(s):\n${namesFormatted}\n\n` +
    `Authorization Status:\nAUTHORIZED\n\n` +
    `Authorization PIN:\n${pin}\n\n` +
    `Date:\n${date}\n\n` +
    `Time:\n${time}\n\n` +
    `Please verify the visitor name(s) and Authorization PIN at the main gate.\n` +
    `If the PIN and authorization are valid:\nENTRY AUTHORIZED\n\n` +
    `Otherwise:\nENTRY NOT AUTHORIZED\n\n` +
    `This is an automated Main Gate Security notification.`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px; text-align: center; border-bottom: 3px solid #10b981;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">🛡️ MAIN GATE SECURITY</h1>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Visitor Entry Authorization Notice</p>
      </div>
      <div style="padding: 24px;">
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
          <span style="color: #065f46; font-weight: 700; font-size: 14px;">✓ Status: ENTRY AUTHORIZED</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 40%; vertical-align: top;"><strong>Visitor Name(s):</strong></td>
            <td style="padding: 8px 0; color: #1e293b;"><ul style="margin: 0; padding-left: 20px;">${namesListHtml}</ul></td>
          </tr>
          <tr style="border-top: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;"><strong>Authorization Status:</strong></td>
            <td style="padding: 8px 0; color: #10b981; font-weight: 700;">AUTHORIZED</td>
          </tr>
          <tr style="border-top: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;"><strong>Authorization PIN:</strong></td>
            <td style="padding: 8px 0; font-family: monospace; font-size: 18px; font-weight: 700; color: #2563eb;">${pin}</td>
          </tr>
          <tr style="border-top: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;"><strong>Date:</strong></td>
            <td style="padding: 8px 0; color: #1e293b;">${date}</td>
          </tr>
          <tr style="border-top: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;"><strong>Time:</strong></td>
            <td style="padding: 8px 0; color: #1e293b;">${time}</td>
          </tr>
        </table>
        <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 0 6px 6px 0; color: #334155; font-size: 13px; line-height: 1.5;">
          Please verify the visitor name(s) and Authorization PIN at the main gate.<br>
          If the PIN and authorization are valid: <strong>ENTRY AUTHORIZED</strong><br>
          Otherwise: <strong>ENTRY NOT AUTHORIZED</strong>
        </div>
      </div>
      <div style="background: #f1f5f9; padding: 12px 24px; text-align: center; color: #94a3b8; font-size: 11px;">
        This is an automated Main Gate Security notification.
      </div>
    </div>
  `;

  try {
    logger.info(`[REAL EMAIL DISPATCH] Attempting Nodemailer dispatch to: ${securityEmail}...`);
    const info = await transporter.sendMail({
      from: `"Main Gate Security" <${smtpUser}>`,
      to: securityEmail,
      subject: subject,
      text: plainText,
      html: htmlContent
    });

    logger.info(`[REAL EMAIL SUCCESS] Sent to ${securityEmail}. Message ID: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (err) {
    logger.error(`[REAL EMAIL ERROR] Failed to send email to ${securityEmail}: ${err.message}`);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  sendVisitorAuthorizationEmail
};
