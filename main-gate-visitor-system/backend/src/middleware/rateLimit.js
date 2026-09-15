const rateLimit = require('express-rate-limit');

// Rate limiter for visitor authorization (prevent PIN brute force)
const authorizeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    authorizationStatus: 'NOT_AUTHORIZED',
    message: 'Too many authorization attempts from this IP, please try again after 15 minutes.'
  }
});

// Rate limiter for gate verification
const gateVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    entryStatus: 'ENTRY NOT AUTHORIZED',
    reason: 'Too many verification attempts, please try again shortly.'
  }
});

module.exports = {
  authorizeLimiter,
  gateVerifyLimiter
};
