const express = require('express');
const authenticate = require('../middleware/authenticate');
const credentialsLimiter = require('../middleware/credentialsLimiter');
const profileController = require('../controllers/profile.controller');
const notificationController = require('../controllers/notification.controller');
const announcementController = require('../controllers/announcement.controller');

// The signed-in user's own account (any role). Everything here acts on req.user.
const router = express.Router();

router.use(authenticate);

router.get('/profile', profileController.getMyProfile);
router.patch('/profile', profileController.updateMyProfile);
router.post('/password', credentialsLimiter, profileController.changeMyPassword);

router.get('/notifications', notificationController.list);
router.post('/notifications/read-all', notificationController.markAllRead);
router.post('/notifications/:id/read', notificationController.markRead);

router.get('/announcements', announcementController.listMine);

module.exports = router;
