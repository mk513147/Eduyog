const courseService = require('../services/eduyarpCourse.service');
const enrolmentService = require('../services/eduyarpEnrolment.service');
const demoService = require('../services/eduyarpDemo.service');
const HttpError = require('../utils/httpError');
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

// Students cannot enrol themselves: full-course access is granted by an Admin. The route stays so
// older clients get a clear answer instead of a 404.
function enrol() {
  throw new HttpError(403, 'Full-course access is granted by Eduyog. Contact us to get access.', { code: 'access_by_admin' });
}

// The first two topics of the first module of a published course, no enrolment needed.
async function getDemoCourse(req, res) {
  const course = await demoService.getDemoCourse(req.user.id, getIdParam(req, 'courseId'));
  res.json({ course });
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

module.exports = {
  listCourses,
  getCourse,
  enrol,
  getDemoCourse,
  listMyCourses,
  getMyCourse,
  getMySchedule,
  completeTopic,
};
