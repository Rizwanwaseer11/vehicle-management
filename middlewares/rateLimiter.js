const rateLimit = require('express-rate-limit');

/**
 * Auth (login, OTP, reset)
 * Strict to prevent brute force
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Admin APIs (heavy + sensitive)
 */
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
});

/**
 * Employee / driver / passenger APIs
 */
const userLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
});

module.exports = {
  authLimiter,
  adminLimiter,
  userLimiter,
};
