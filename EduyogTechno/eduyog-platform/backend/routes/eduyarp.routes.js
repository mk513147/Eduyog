const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const eduyarpController = require('../controllers/eduyarp.controller');
const contentController = require('../controllers/courseContent.controller');
const assignmentController = require('../controllers/assignment.controller');
const certificateController = require('../controllers/certificate.controller');

// Eduyarp public and Student routes (Trainer routes: trainer.routes.js). Course management lives under
// /api/admin/eduyarp. All routes are covered by the general /api rate limit.
const router = express.Router();

const student = [authenticate, requireRole('student')];

// Public: published courses only.
router.get('/courses', eduyarpController.listCourses);
router.get('/courses/:slug', eduyarpController.getCourse);

// Student: always scoped to the signed-in student (req.user).
router.post('/courses/:courseId/enrol', student, eduyarpController.enrol);
router.get('/me/courses', student, eduyarpController.listMyCourses);
router.get('/me/courses/:courseId', student, eduyarpController.getMyCourse);
router.get('/me/courses/:courseId/faqs', student, contentController.listFaqs);
router.get('/me/courses/:courseId/resources', student, contentController.listResources);
router.get('/me/courses/:courseId/assignments', student, assignmentController.listMine);
router.get('/me/assignments/:id', student, assignmentController.getMine);
router.post('/me/assignments/:id/submissions', student, assignmentController.submit);
router.get('/me/certificates', student, certificateController.listMine);
router.get('/me/certificates/:id', student, certificateController.getMine);
router.get('/me/schedule', student, eduyarpController.getMySchedule);
router.post('/topics/:topicId/complete', student, eduyarpController.completeTopic);

module.exports = router;
