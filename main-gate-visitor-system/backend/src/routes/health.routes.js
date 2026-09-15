const express = require('express');
const router = express.Router();
const env = require('../config/env');

router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/notifications', (req, res) => {
  const hasEmail = Boolean(
    env.SMTP_USER &&
    env.SMTP_PASSWORD &&
    env.SMTP_USER !== 'example@gmail.com' &&
    env.SMTP_PASSWORD !== 'your-app-password'
  );

  const hasTwilio = Boolean(
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_PHONE_NUMBER &&
    env.SECURITY_PHONE_NUMBER &&
    !env.TWILIO_ACCOUNT_SID.startsWith('ACXX') &&
    !env.TWILIO_ACCOUNT_SID.includes('your_')
  );

  const hasFast2sms = Boolean(env.FAST2SMS_API_KEY && env.SECURITY_PHONE_NUMBER && !env.FAST2SMS_API_KEY.startsWith('your_'));

  res.status(200).json({
    emailConfigured: hasEmail,
    smsConfigured: hasTwilio || hasFast2sms,
    providers: {
      twilio: hasTwilio,
      fast2sms: hasFast2sms
    }
  });
});

module.exports = router;
