const courseService = require('../services/eduyarpCourse.service');
const enrolmentService = require('../services/eduyarpEnrolment.service');
const trainerService = require('../services/eduyarpTrainer.service');
const { getIdParam } = require('./helpers');

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

async function listCourses(req, res) {
  const courses = await courseService.listPublishedCourses();
  res.json({ courses });
}

async function getCourse(req, res) {
  const course = await courseService.getPublishedCourseBySlug(String(req.params.slug).toLowerCase());
  res.json({ course });
}

// ---------------------------------------------------------------------------
// Student: the student is always req.user, set by authenticate.
// ---------------------------------------------------------------------------

async function enrol(req, res) {
  const enrolment = await enrolmentService.enrol(req.user.id, getIdParam(req, 'courseId'));
  res.status(201).json({ enrolment });
}

async function listMyCourses(req, res) {
  const courses = await enrolmentService.listStudentCourses(req.user.id);
  res.json({ courses });
}

async function getMyCourse(req, res) {
  const course = await enrolmentService.getStudentCourse(req.user.id, getIdParam(req, 'courseId'));
  res.json({ course });
}

async function getMySchedule(req, res) {
  const classes = await enrolmentService.getStudentSchedule(req.user.id);
  res.json({ classes });
}

async function completeTopic(req, res) {
  const result = await enrolmentService.completeTopic(req.user.id, getIdParam(req, 'topicId'));
  res.json(result);
}

// ---------------------------------------------------------------------------
// Trainer: access is checked against course_trainers for req.user.
// ---------------------------------------------------------------------------

async function getTrainerCourse(req, res) {
  const course = await trainerService.getTrainerCourse(req.user.id, getIdParam(req, 'courseId'));
  res.json({ course });
}

module.exports = {
  listCourses,
  getCourse,
  enrol,
  listMyCourses,
  getMyCourse,
  getMySchedule,
  completeTopic,
  getTrainerCourse,
};
