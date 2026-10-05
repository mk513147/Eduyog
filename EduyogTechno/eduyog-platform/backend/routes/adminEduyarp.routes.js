const express = require('express');
const controller = require('../controllers/adminEduyarp.controller');

// Mounted by admin.routes.js at /api/admin/eduyarp, after its
// authenticate + requireAdmin guard.
const router = express.Router();

router.get('/courses', controller.listCourses);
router.post('/courses', controller.createCourse);
router.get('/courses/:id', controller.getCourse);
router.patch('/courses/:id', controller.updateCourse);
router.delete('/courses/:id', controller.deleteCourse);

router.post('/courses/:courseId/modules', controller.createModule);
router.patch('/modules/:id', controller.updateModule);
router.delete('/modules/:id', controller.deleteModule);

router.post('/modules/:moduleId/topics', controller.createTopic);
router.patch('/topics/:id', controller.updateTopic);
router.delete('/topics/:id', controller.deleteTopic);

router.get('/trainers', controller.listTrainers);
router.post('/courses/:courseId/trainers', controller.assignTrainer);
router.delete('/courses/:courseId/trainers/:trainerId', controller.unassignTrainer);

router.get('/enrolments', controller.listEnrolments);
router.patch('/enrolments/:id', controller.updateEnrolment);

router.get('/classes', controller.listClasses);
router.post('/classes', controller.createClass);
router.patch('/classes/:id', controller.updateClass);
router.delete('/classes/:id', controller.deleteClass);

module.exports = router;
