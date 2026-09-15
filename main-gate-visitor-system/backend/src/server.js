const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');

const http = require('http');
const { verifySmtpConfiguration } = require('./services/emailService');

const server = http.createServer(app);

server.listen(env.PORT, () => {
  const isSmtpUserOk = Boolean(env.SMTP_USER && !env.isPlaceholder(env.SMTP_USER));
  const isSmtpPassOk = Boolean(env.SMTP_PASSWORD && !env.isPlaceholder(env.SMTP_PASSWORD));
  const isTwilioSidOk = Boolean(env.TWILIO_ACCOUNT_SID && !env.isPlaceholder(env.TWILIO_ACCOUNT_SID));
  const isTwilioTokenOk = Boolean(env.TWILIO_AUTH_TOKEN && !env.isPlaceholder(env.TWILIO_AUTH_TOKEN));
  const isTwilioFromOk = Boolean(env.TWILIO_PHONE_NUMBER && !env.isPlaceholder(env.TWILIO_PHONE_NUMBER));
  const isSecurityPhoneOk = Boolean(env.SECURITY_PHONE_NUMBER && !env.isPlaceholder(env.SECURITY_PHONE_NUMBER));
  const isFast2smsOk = Boolean(env.FAST2SMS_API_KEY && !env.isPlaceholder(env.FAST2SMS_API_KEY));

  logger.info(`====================================================`);
  logger.info(`Main Gate Visitor Authorization Server running`);
  logger.info(`Listening on port: ${env.PORT} (Primary)`);
  logger.info(`Environment:       ${env.NODE_ENV}`);
  logger.info(`Real Deliveries:   ${env.REAL_NOTIFICATIONS ? 'ENABLED (Production)' : 'DISABLED (Mock mode)'}`);
  logger.info(`Health check:      http://localhost:${env.PORT}/api/health`);
  logger.info(`Test Endpoints:    POST /api/test/email | POST /api/test/sms`);
  logger.info(`----------------------------------------------------`);
  logger.info(`NOTIFICATION CREDENTIAL STATUS:`);
  logger.info(`  SMTP_HOST:             ${env.SMTP_HOST}`);
  logger.info(`  SMTP_PORT:             ${env.SMTP_PORT}`);
  logger.info(`  SMTP_USER:             ${isSmtpUserOk ? 'CONFIGURED (' + env.SMTP_USER + ')' : 'MISSING / PLACEHOLDER'}`);
  logger.info(`  SMTP_PASS:             ${isSmtpPassOk ? 'CONFIGURED (Protected)' : 'MISSING / PLACEHOLDER'}`);
  logger.info(`  MAIN_GATE_EMAIL:       ${env.MAIN_GATE_EMAIL}`);
  logger.info(`  TWILIO_ACCOUNT_SID:    ${isTwilioSidOk ? 'CONFIGURED' : 'MISSING / PLACEHOLDER'}`);
  logger.info(`  TWILIO_AUTH_TOKEN:     ${isTwilioTokenOk ? 'CONFIGURED (Protected)' : 'MISSING / PLACEHOLDER'}`);
  logger.info(`  TWILIO_PHONE_NUMBER:   ${isTwilioFromOk ? 'CONFIGURED (' + env.TWILIO_PHONE_NUMBER + ')' : 'MISSING / PLACEHOLDER'}`);
  logger.info(`  SECURITY_PHONE_NUMBER: ${isSecurityPhoneOk ? 'CONFIGURED (' + env.SECURITY_PHONE_NUMBER + ')' : 'MISSING / PLACEHOLDER'}`);
  logger.info(`  FAST2SMS_API_KEY:      ${isFast2smsOk ? 'CONFIGURED (Protected)' : 'MISSING / PLACEHOLDER'}`);
  logger.info(`====================================================`);

  // Verify SMTP configuration on startup (transporter.verify())
  verifySmtpConfiguration().catch(() => {});
});

// Dual listener: Also listen on port 5000 if env.PORT is 8003 for browser convenience
if (env.PORT !== 5000) {
  try {
    const secondaryServer = http.createServer(app);
    secondaryServer.listen(5000, () => {
      logger.info(`Secondary port 5000 active for backward compatibility.`);
    }).on('error', () => {
      // If port 5000 in use or restricted, primary port handles traffic
    });
  } catch (e) {}
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully.');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully.');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

module.exports = server;
