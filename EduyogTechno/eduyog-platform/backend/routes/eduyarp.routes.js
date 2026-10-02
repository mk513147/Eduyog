const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const eduyarpController = require('../controllers/eduyarp.controller');

// Eduyarp public, Student and Trainer routes. Course management lives under
// /api/admin/eduyarp. All routes are covered by the general /api rate limit.
const router = express.Router();

const student = [authenticate, requireRole('student')];
const trainer = [authenticate, requireRole('trainer')];

// Public: published courses only.
router.get('/courses', eduyarpController.listCourses);
router.get('/courses/:slug', eduyarpController.getCourse);

// Student: always scoped to the signed-in student (req.user).
router.post('/courses/:courseId/enrol', student, eduyarpController.enrol);
router.get('/me/courses', student, eduyarpController.listMyCourses);
router.get('/me/courses/:courseId', student, eduyarpController.getMyCourse);
router.get('/me/schedule', student, eduyarpController.getMySchedule);
router.post('/topics/:topicId/complete', student, eduyarpController.completeTopic);

// Trainer: read-only, only for courses the trainer is assigned to.
router.get('/trainer/courses/:courseId', trainer, eduyarpController.getTrainerCourse);

module.exports = router;
