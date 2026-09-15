const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('../models/db');
const env = require('../config/env');
const logger = require('../utils/logger');

function handleChangePin(req, res) {
  const { currentPin, newPin, confirmNewPin } = req.body;

  if (!newPin || String(newPin).trim().length === 0) {
    return res.status(400).json({ success: false, message: 'New PIN is required.' });
  }

  if (confirmNewPin !== undefined && newPin !== confirmNewPin) {
    return res.status(400).json({ success: false, message: 'New PIN and confirmation PIN do not match.' });
  }

  // Check current PIN
  db.get(`SELECT value FROM admin_settings WHERE key = 'auth_pin'`, (err, row) => {
    if (err) {
      logger.error('Database error in handleChangePin:', err.message);
      return res.status(500).json({ success: false, message: 'Database error.' });
    }

    if (row && currentPin) {
      const isMatch = bcrypt.compareSync(String(currentPin).trim(), row.value);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Current authorization PIN is incorrect.' });
      }
    }

    // Hash the new PIN
    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync(String(newPin).trim(), salt);

    db.run(
      `INSERT INTO admin_settings (key, value, updated_at) VALUES ('auth_pin', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [hashed],
      (updateErr) => {
        if (updateErr) {
          logger.error('Failed to update admin PIN:', updateErr.message);
          return res.status(500).json({ success: false, message: 'Failed to update PIN in database.' });
        }

        logger.info('Authorization PIN changed successfully and securely hashed.');
        return res.status(200).json({
          success: true,
          message: 'Authorization PIN successfully updated.'
        });
      }
    );
  });
}

function handleGetAuthorizations(req, res) {
  db.all(`SELECT * FROM authorizations ORDER BY created_at DESC LIMIT 100`, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    const records = rows.map(r => {
      let visitorNames = [];
      try {
        visitorNames = JSON.parse(r.visitor_names);
      } catch (e) {
        visitorNames = [r.visitor_names];
      }
      return {
        authorizationId: r.authorization_id,
        visitorNames,
        authorizationStatus: r.authorization_status,
        emailStatus: r.email_status,
        smsStatus: r.sms_status,
        gateStatus: r.gate_status,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        verifiedAt: r.verified_at,
        retryCount: r.retry_count
      };
    });

    return res.json({ success: true, records });
  });
}

function handleDownloadExcel(req, res) {
  if (fs.existsSync(env.EXCEL_FILE_PATH)) {
    return res.download(env.EXCEL_FILE_PATH, 'visitor-entry.xlsx');
  }
  return res.status(404).json({ success: false, message: 'Excel record file not yet created.' });
}

function handleGetConfig(req, res) {
  return res.json({
    success: true,
    config: {
      smtpConfigured: Boolean(env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_USER !== 'example@gmail.com'),
      smtpUser: env.SMTP_USER && env.SMTP_USER !== 'example@gmail.com' ? env.SMTP_USER : null,
      mainGateEmail: env.MAIN_GATE_EMAIL,
      twilioConfigured: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && !env.TWILIO_ACCOUNT_SID.startsWith('ACXX')),
      fast2smsConfigured: Boolean(env.FAST2SMS_API_KEY && !env.FAST2SMS_API_KEY.startsWith('your_')),
      securityPhone: env.SECURITY_PHONE_NUMBER || null,
      expiryMinutes: env.AUTHORIZATION_EXPIRY_MINUTES
    }
  });
}

function handleSaveSettings(req, res) {
  try {
    const data = req.body || {};
    const backendEnvPath = path.resolve(__dirname, '../../.env');
    const rootEnvPath = path.resolve(__dirname, '../../../../.env');

    // Helper to update key-value pairs in .env string
    const updateEnvFile = (filePath) => {
      let content = '';
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf8');
      }

      const updates = {};
      if (data.smtpUser !== undefined) {
        updates.SMTP_USER = data.smtpUser.trim();
        updates.SMTP_USERNAME = data.smtpUser.trim();
      }
      if (data.smtpPassword !== undefined) {
        updates.SMTP_PASSWORD = data.smtpPassword.trim();
        updates.SMTP_PASS = data.smtpPassword.trim();
      }
      if (data.mainGateEmail !== undefined) {
        updates.MAIN_GATE_EMAIL = data.mainGateEmail.trim();
        updates.SECURITY_EMAIL = data.mainGateEmail.trim();
      }
      if (data.twilioSid !== undefined) updates.TWILIO_ACCOUNT_SID = data.twilioSid.trim();
      if (data.twilioToken !== undefined) updates.TWILIO_AUTH_TOKEN = data.twilioToken.trim();
      if (data.twilioPhone !== undefined) {
        updates.TWILIO_PHONE_NUMBER = data.twilioPhone.trim();
        updates.TWILIO_FROM_NUMBER = data.twilioPhone.trim();
      }
      if (data.securityPhone !== undefined) {
        updates.SECURITY_PHONE_NUMBER = data.securityPhone.trim();
        updates.GATE_SECURITY_PHONE = data.securityPhone.trim();
        updates.ADMIN_PHONE = data.securityPhone.trim();
      }
      if (data.fast2smsKey !== undefined) updates.FAST2SMS_API_KEY = data.fast2smsKey.trim();

      const lines = content.split('\n');
      const handledKeys = new Set();
      const newLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const key = trimmed.split('=')[0].trim();
          if (updates[key] !== undefined) {
            handledKeys.add(key);
            return `${key}=${updates[key]}`;
          }
        }
        return line;
      });

      for (const [key, val] of Object.entries(updates)) {
        if (!handledKeys.has(key)) {
          newLines.push(`${key}=${val}`);
        }
      }

      fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    };

    updateEnvFile(backendEnvPath);
    if (fs.existsSync(rootEnvPath)) {
      updateEnvFile(rootEnvPath);
    }

    // Apply into memory
    if (data.smtpUser !== undefined) env.SMTP_USER = data.smtpUser.trim();
    if (data.smtpPassword !== undefined) env.SMTP_PASSWORD = data.smtpPassword.trim();
    if (data.mainGateEmail !== undefined) env.MAIN_GATE_EMAIL = data.mainGateEmail.trim();
    if (data.twilioSid !== undefined) env.TWILIO_ACCOUNT_SID = data.twilioSid.trim();
    if (data.twilioToken !== undefined) env.TWILIO_AUTH_TOKEN = data.twilioToken.trim();
    if (data.twilioPhone !== undefined) env.TWILIO_PHONE_NUMBER = data.twilioPhone.trim();
    if (data.securityPhone !== undefined) env.SECURITY_PHONE_NUMBER = data.securityPhone.trim();
    if (data.fast2smsKey !== undefined) env.FAST2SMS_API_KEY = data.fast2smsKey.trim();

    // Reset email transporter
    const { resetTransporter } = require('../services/emailService');
    resetTransporter();

    logger.info('Admin updated notification credentials and reloaded environment.');

    return res.json({
      success: true,
      message: 'Notification credentials successfully updated and active immediately!'
    });
  } catch (err) {
    logger.error('Failed to save settings:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function handleTestSend(req, res) {
  const { channel, recipient } = req.body || {};
  try {
    if (channel === 'email') {
      const { sendTestEmail } = require('../services/emailService');
      const result = await sendTestEmail(recipient || env.MAIN_GATE_EMAIL);
      return res.json(result);
    } else {
      const { sendTestSms } = require('../services/smsService');
      const result = await sendTestSms(recipient || env.SECURITY_PHONE_NUMBER);
      return res.json(result);
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleChangePin,
  handleGetAuthorizations,
  handleDownloadExcel,
  handleGetConfig,
  handleSaveSettings,
  handleTestSend
};
