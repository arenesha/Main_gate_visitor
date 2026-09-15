const nodemailer = require('nodemailer');

/**
 * Sends real email & SMS notifications to Main Gate Security
 */
async function sendNotification({ names, status, pin, date = null, time = null }) {
  const now = new Date();
  const dateStr = date || now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = time || now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim();
  const securityEmail = (process.env.SECURITY_EMAIL || '').trim();

  let emailSent = false;
  let smsSent = false;
  let emailError = null;
  let smsError = null;

  const namesFormatted = Array.isArray(names) ? names.join('\n') : names;

  const messageText =
    `MAIN GATE VISITOR ENTRY AUTHORIZATION\n\n` +
    `Visitor Name(s):\n${namesFormatted}\n\n` +
    `Authorization Status:\n${status}\n\n` +
    `Authorization PIN:\n${pin}\n\n` +
    `Authorization Date:\n${dateStr}\n\n` +
    `Authorization Time:\n${timeStr}\n\n` +
    `Please verify the visitor name(s) and Authorization PIN at the main gate.\n\n` +
    `If the visitor name and PIN are valid:\nENTRY AUTHORIZED\n\n` +
    `Otherwise:\nENTRY NOT AUTHORIZED\n\n` +
    `This is an automated Main Gate Security notification.`;

  // 1. Send Email via Nodemailer SMTP
  if (!smtpUser || !smtpPass) {
    emailError = 'SMTP credentials (SMTP_USER / SMTP_PASS) are missing in backend .env file.';
    console.warn(`[Notifier] ${emailError}`);
  } else if (!securityEmail) {
    emailError = 'SECURITY_EMAIL is missing in backend .env file.';
    console.warn(`[Notifier] ${emailError}`);
  } else {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false }
      });

      const info = await transporter.sendMail({
        from: `"Main Gate Security" <${smtpUser}>`,
        to: securityEmail,
        subject: 'Main Gate Visitor Entry Authorization',
        text: messageText
      });

      console.log(`[Notifier] REAL EMAIL SENT to ${securityEmail}. Message ID: ${info.messageId}`);
      emailSent = true;
    } catch (err) {
      emailError = err.message;
      console.error(`[Notifier] REAL EMAIL FAILED to ${securityEmail}:`, err.message);
    }
  }

  // 2. Send SMS via Twilio
  const accountSid = (process.env.TWILIO_SID || process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromPhone = (process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER || '').trim();
  const securityPhone = (process.env.SECURITY_PHONE || '').trim();

  if (accountSid && authToken && fromPhone && securityPhone && !accountSid.startsWith('your_')) {
    try {
      const twilio = require('twilio');
      const twilioClient = twilio(accountSid, authToken);
      const smsRes = await twilioClient.messages.create({
        body: `Main Gate Alert: Visitor entry authorized for ${Array.isArray(names) ? names.join(', ') : names}. Status: ${status}. PIN: ${pin}.`,
        from: fromPhone,
        to: securityPhone
      });
      console.log(`[Notifier] REAL SMS SENT to ${securityPhone}. Message SID: ${smsRes.sid}`);
      smsSent = true;
    } catch (err) {
      smsError = err.message;
      console.error(`[Notifier] REAL SMS FAILED to ${securityPhone}:`, err.message);
    }
  } else {
    smsError = 'Twilio SMS credentials or SECURITY_PHONE not configured.';
  }

  return { emailSent, smsSent, emailError, smsError };
}

module.exports = { sendNotification };
