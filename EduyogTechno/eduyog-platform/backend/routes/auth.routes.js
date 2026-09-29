const express = require('express');
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Stricter than the general /api limit to slow down password guessing.
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts, please try again later' } },
});

router.post('/register', credentialsLimiter, authController.register);
router.post('/login', credentialsLimiter, authController.login);
router.get('/me', authenticate, authController.me);

module.exports = router;
