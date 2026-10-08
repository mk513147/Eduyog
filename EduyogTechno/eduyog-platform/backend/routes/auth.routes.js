const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const credentialsLimiter = require('../middleware/credentialsLimiter');

const router = express.Router();

router.post('/register', credentialsLimiter, authController.register);
router.post('/login', credentialsLimiter, authController.login);
router.get('/me', authenticate, authController.me);

module.exports = router;
