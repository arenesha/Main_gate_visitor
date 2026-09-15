const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from both root and backend .env files
const rootEnvPath = path.resolve(__dirname, '../../../../.env');
const backendEnvPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath, override: true });
}

function cleanStr(val) {
  return (val || '').trim();
}

function isPlaceholder(val) {
  if (!val) return true;
  const v = val.toLowerCase().trim();
  return (
    v.includes('your_') ||
    v.includes('your-') ||
    v.includes('example.com') ||
    v === 'your-app-password' ||
    v === 'your_16_digit_app_password' ||
    v === 'your_twilio_account_sid' ||
    v === 'your_twilio_auth_token' ||
    v === 'your_twilio_phone_number' ||
    v === 'your_api_key_here' ||
    v.startsWith('acxx')
  );
}

const env = {
  PORT: parseInt(process.env.PORT || '8003', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  REAL_NOTIFICATIONS: process.env.REAL_NOTIFICATIONS !== 'false',
  JWT_SECRET: process.env.JWT_SECRET || 'gatekeeper-secret-key-2026',
  
  // Security PIN (Read strictly from environment variable)
  DEFAULT_PIN: cleanStr(process.env.DEFAULT_PIN || process.env.AUTHORIZATION_PIN || '1234'),
  
  // Expiry
  AUTHORIZATION_EXPIRY_MINUTES: parseInt(process.env.AUTHORIZATION_EXPIRY_MINUTES || '300', 10), // default 5 hours
  
  // SMTP Email Configuration
  SMTP_HOST: cleanStr(process.env.SMTP_HOST || 'smtp.gmail.com'),
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
  SMTP_USER: cleanStr(process.env.SMTP_USER || process.env.SMTP_USERNAME || ''),
  SMTP_PASSWORD: cleanStr(process.env.SMTP_PASSWORD || process.env.SMTP_PASS || ''),
  MAIN_GATE_EMAIL: cleanStr(process.env.MAIN_GATE_EMAIL || process.env.SECURITY_EMAIL || process.env.ADMIN_EMAIL || 'security@maingate.com'),

  // Twilio / Fast2SMS SMS Configuration
  TWILIO_ACCOUNT_SID: cleanStr(process.env.TWILIO_ACCOUNT_SID || ''),
  TWILIO_AUTH_TOKEN: cleanStr(process.env.TWILIO_AUTH_TOKEN || ''),
  TWILIO_PHONE_NUMBER: cleanStr(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER || ''),
  SECURITY_PHONE_NUMBER: cleanStr(process.env.SECURITY_PHONE_NUMBER || process.env.SECURITY_PHONE || process.env.ADMIN_PHONE || ''),
  FAST2SMS_API_KEY: cleanStr(process.env.FAST2SMS_API_KEY || ''),

  // Excel Path
  EXCEL_FILE_PATH: path.resolve(__dirname, '../../../records/visitor-entry.xlsx'),
  DATABASE_PATH: path.resolve(__dirname, '../../data/gatekeeper.sqlite'),

  // Helper
  isPlaceholder
};

module.exports = env;

