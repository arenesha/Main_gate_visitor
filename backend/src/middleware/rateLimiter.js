const rateLimit = require("express-rate-limit");

/**
 * Rate limiter for visitor authorization and PIN verification endpoints.
 * Blocks after 10 requests per 5 minutes per IP to prevent PIN brute force attacks.
 */
const pinAuthLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Max 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many failed attempts. Please wait 5 minutes before trying again.",
    emailSent: false,
    smsSent: false
  }
});

/**
 * General API rate limiter for standard requests
 */
const generalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down."
  }
});

module.exports = {
  pinAuthLimiter,
  generalApiLimiter
};
