const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

let transporter = null;

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASSWORD || "").trim();

  if (!user || !pass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
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

  return transporter;
}

/**
 * Sends visitor entry authorization email to Main Gate Security
 * @param {string[]} visitorNames
 * @param {string} date - formatted date (e.g. '13 September 2026')
 * @param {string} time - formatted time (e.g. '03:10 PM')
 * @param {string} pin - authorization PIN
 * @returns {Promise<{success: boolean, error: string|null, mock: boolean}>}
 */
async function sendVisitorAuthorizationEmail(visitorNames, date, time, pin) {
  const authEmail = (process.env.AUTH_EMAIL || "").trim();
  const smtpUser = (process.env.SMTP_USER || "").trim();
  const namesListText = visitorNames.map((name) => `• ${name}`).join("\n");
  const namesListHtml = visitorNames.map((name) => `<li><strong>${name}</strong></li>`).join("");

  const subject = "Main Gate Visitor Entry Authorization";

  const plainText = `MAIN GATE VISITOR ENTRY AUTHORIZATION\n\n` +
    `Visitor(s):\n${namesListText}\n\n` +
    `Authorization Status:\nAUTHORIZED\n\n` +
    `Authorization PIN:\n${pin}\n\n` +
    `Date:\n${date}\n\n` +
    `Time:\n${time}\n\n` +
    `Message:\n` +
    `The above visitor(s) have been authorized for entry through the main gate.\n` +
    `Main Gate Security: Verify visitor names and PIN (${pin}) at the gate.`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
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
          <strong>Action Required at Main Gate:</strong><br>
          Security must verify visitor name(s) and matching PIN <strong>(${pin})</strong> before granting physical access.
        </div>
      </div>
      <div style="background: #f1f5f9; padding: 12px 24px; text-align: center; color: #94a3b8; font-size: 11px;">
        Main Gate Security & Visitor Access Management System
      </div>
    </div>
  `;

  const transport = getTransporter();

  if (!transport || !authEmail) {
    logger.info(`[EMAIL MOCK/DEV] SMTP unconfigured or AUTH_EMAIL missing. Simulating email dispatch to: ${authEmail || "Main Gate Security"}`);
    logger.info(`[EMAIL CONTENT]\nSubject: ${subject}\nTo: ${authEmail}\n${plainText}`);
    return {
      success: true,
      error: null,
      mock: true
    };
  }

  try {
    const info = await transport.sendMail({
      from: `"Main Gate Security" <${smtpUser}>`,
      to: authEmail,
      subject: subject,
      text: plainText,
      html: htmlContent
    });

    logger.info(`[EMAIL SUCCESS] Email sent to ${authEmail}. Message ID: ${info.messageId}`);
    return {
      success: true,
      error: null,
      mock: false,
      messageId: info.messageId
    };
  } catch (err) {
    logger.error(`[EMAIL ERROR] Failed to send email to ${authEmail}: ${err.message}`);
    return {
      success: false,
      error: err.message,
      mock: false
    };
  }
}

module.exports = {
  sendVisitorAuthorizationEmail
};
