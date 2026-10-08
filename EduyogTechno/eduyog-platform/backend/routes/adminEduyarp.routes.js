const express = require('express');
const controller = require('../controllers/adminEduyarp.controller');
const announcementController = require('../controllers/announcement.controller');
const contentController = require('../controllers/courseContent.controller');
const assignmentController = require('../controllers/assignment.controller');
const certificateController = require('../controllers/certificate.controller');

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
router.get('/courses/:courseId/faqs', contentController.listFaqs);
router.post('/courses/:courseId/faqs', contentController.createFaq);
router.post('/courses/:courseId/faqs/reorder', contentController.reorderFaqs);
router.patch('/faqs/:id', contentController.updateFaq);
router.delete('/faqs/:id', contentController.deleteFaq);

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

router.get('/certificates', certificateController.list);
router.get('/certificates/:id', certificateController.get);
router.post('/certificates/:id/revoke', certificateController.revoke);

router.get('/announcements', announcementController.listForAdmin);
router.post('/announcements', announcementController.createAsAdmin);
router.delete('/announcements/:id', announcementController.deleteAsAdmin);

module.exports = router;
