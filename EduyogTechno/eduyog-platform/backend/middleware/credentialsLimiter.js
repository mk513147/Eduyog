const { rateLimit } = require('express-rate-limit');

// Stricter than the general /api limit to slow down password guessing.
// Shared by register, login and password change.
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts, please try again later' } },
});

module.exports = credentialsLimiter;
