const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const platformController = require('../controllers/platform.controller');
const serviceController = require('../controllers/service.controller');
const userController = require('../controllers/user.controller');
const fitnessLeadController = require('../controllers/fitnessLead.controller');
const adminEduyarpRoutes = require('./adminEduyarp.routes');

const router = express.Router();

// Every route below requires a signed-in Admin: 401 without a valid token,
// 403 for any other role.
router.use(authenticate, requireAdmin);

router.get('/platforms', platformController.list);
router.post('/platforms', platformController.create);
router.get('/platforms/:id', platformController.get);
router.patch('/platforms/:id', platformController.update);
router.delete('/platforms/:id', platformController.remove);

router.get('/services', serviceController.list);
router.post('/services', serviceController.create);
router.get('/services/:id', serviceController.get);
router.patch('/services/:id', serviceController.update);
router.delete('/services/:id', serviceController.remove);

router.get('/users', userController.list);
router.patch('/users/:id/role', userController.changeRole);

router.get('/fitness-leads', fitnessLeadController.list);
router.get('/fitness-leads/:id', fitnessLeadController.get);

router.use('/eduyarp', adminEduyarpRoutes);

module.exports = router;
