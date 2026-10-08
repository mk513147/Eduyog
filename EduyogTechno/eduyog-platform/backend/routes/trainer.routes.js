const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const trainerController = require('../controllers/trainer.controller');
const announcementController = require('../controllers/announcement.controller');
const contentController = require('../controllers/courseContent.controller');
const assignmentController = require('../controllers/assignment.controller');

// Mounted at /api/eduyarp/trainer. Trainer role only; each course-scoped route is
// further limited to courses the Trainer is currently assigned to.
const router = express.Router();

router.use(authenticate, requireRole('trainer'));

router.get('/courses', trainerController.listCourses);
router.get('/schedule', trainerController.getSchedule);
router.get('/courses/:courseId', trainerController.getCourse);
router.get('/courses/:courseId/students', trainerController.listStudents);
router.get('/courses/:courseId/students/:studentId', trainerController.getStudent);
// FAQs are read-only for Trainers; resources can be managed on assigned courses.
router.get('/courses/:courseId/faqs', contentController.listFaqs);
router.get('/courses/:courseId/resources', contentController.listResources);
router.post('/courses/:courseId/resources', contentController.createResource);
router.patch('/resources/:id', contentController.updateResource);
router.delete('/resources/:id', contentController.deleteResource);

router.get('/courses/:courseId/assignments', assignmentController.list);
router.post('/courses/:courseId/assignments', assignmentController.create);
router.get('/assignments/:id', assignmentController.get);
router.patch('/assignments/:id', assignmentController.update);
router.delete('/assignments/:id', assignmentController.remove);
router.get('/assignments/:id/submissions', assignmentController.listSubmissions);
router.get('/submissions/:id', assignmentController.getSubmission);
router.put('/submissions/:id/feedback', assignmentController.setFeedback);

router.get('/courses/:courseId/announcements', announcementController.listForCourse);
router.post('/courses/:courseId/announcements', announcementController.createForCourse);
router.delete('/announcements/:id', announcementController.deleteAsTrainer);

module.exports = router;
