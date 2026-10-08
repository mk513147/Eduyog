const trainerService = require('../services/eduyarpTrainer.service');
const { getIdParam } = require('./helpers');

// Trainer routes. The Trainer is always req.user (set by authenticate); every
// course-scoped call is authorized against course_trainers in the service.

async function listCourses(req, res) {
  res.json(await trainerService.listTrainerCourses(req.user.id));
}

async function getSchedule(req, res) {
  const classes = await trainerService.listTrainerSchedule(req.user.id);
  res.json({ classes });
}

async function getCourse(req, res) {
  const course = await trainerService.getTrainerCourse(req.user, getIdParam(req, 'courseId'));
  res.json({ course });
}

async function listStudents(req, res) {
  const students = await trainerService.listCourseStudents(req.user, getIdParam(req, 'courseId'));
  res.json({ students });
}

async function getStudent(req, res) {
  const result = await trainerService.getCourseStudent(
    req.user,
    getIdParam(req, 'courseId'),
    getIdParam(req, 'studentId')
  );
  res.json(result);
}

module.exports = {
  listCourses,
  getSchedule,
  getCourse,
  listStudents,
  getStudent,
};
