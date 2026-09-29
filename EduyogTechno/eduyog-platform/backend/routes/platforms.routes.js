const express = require('express');
const publicPlatformController = require('../controllers/publicPlatform.controller');

// Public, read-only. No authentication; covered by the general /api rate limit.
// Platform management stays under /api/admin/platforms.
const router = express.Router();

router.get('/', publicPlatformController.list);

module.exports = router;
