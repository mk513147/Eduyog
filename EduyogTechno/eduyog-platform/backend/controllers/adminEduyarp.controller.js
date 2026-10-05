const courseService = require('../services/eduyarpCourse.service');
const curriculumService = require('../services/eduyarpCurriculum.service');
const trainerService = require('../services/eduyarpTrainer.service');
const enrolmentService = require('../services/eduyarpEnrolment.service');
const classService = require('../services/eduyarpClass.service');
const {
  validateCourse,
  validateCurriculumItem,
  validateTrainerAssignment,
  validateEnrolmentUpdate,
  validateClass,
} = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

// Courses

async function listCourses(req, res) {
  const courses = await courseService.listCourses();
  res.json({ courses });
}

async function getCourse(req, res) {
  const course = await courseService.getCourse(getIdParam(req));
  res.json({ course });
}

async function createCourse(req, res) {
  const input = requireValid(validateCourse(req.body));
  const course = await courseService.createCourse(input);
  res.status(201).json({ course });
}

async function updateCourse(req, res) {
  const id = getIdParam(req);
  const changes = requireValid(validateCourse(req.body, { partial: true }));
  const course = await courseService.updateCourse(id, changes);
  res.json({ course });
}

async function deleteCourse(req, res) {
  await courseService.deleteCourse(getIdParam(req));
  res.status(204).end();
}

// Modules

async function createModule(req, res) {
  const courseId = getIdParam(req, 'courseId');
  const input = requireValid(validateCurriculumItem(req.body));
  const module = await curriculumService.createModule(courseId, input);
  res.status(201).json({ module });
}

async function updateModule(req, res) {
  const id = getIdParam(req);
  const changes = requireValid(validateCurriculumItem(req.body, { partial: true }));
  const module = await curriculumService.updateModule(id, changes);
  res.json({ module });
}

async function deleteModule(req, res) {
  await curriculumService.deleteModule(getIdParam(req));
  res.status(204).end();
}

// Topics

async function createTopic(req, res) {
  const moduleId = getIdParam(req, 'moduleId');
  const input = requireValid(validateCurriculumItem(req.body, { allowVideo: true }));
  const topic = await curriculumService.createTopic(moduleId, input);
  res.status(201).json({ topic });
}

async function updateTopic(req, res) {
  const id = getIdParam(req);
  const changes = requireValid(validateCurriculumItem(req.body, { partial: true, allowVideo: true }));
  const topic = await curriculumService.updateTopic(id, changes);
  res.json({ topic });
}

async function deleteTopic(req, res) {
  await curriculumService.deleteTopic(getIdParam(req));
  res.status(204).end();
}

// Trainers

async function listTrainers(req, res) {
  const trainers = await trainerService.listTrainers();
  res.json({ trainers });
}

async function assignTrainer(req, res) {
  const courseId = getIdParam(req, 'courseId');
  const { trainerId } = requireValid(validateTrainerAssignment(req.body));
  const course = await trainerService.assignTrainer(courseId, trainerId);
  res.status(201).json({ course });
}

async function unassignTrainer(req, res) {
  const course = await trainerService.unassignTrainer(
    getIdParam(req, 'courseId'),
    getIdParam(req, 'trainerId')
  );
  res.json({ course });
}

// Enrolments

async function listEnrolments(req, res) {
  const enrolments = await enrolmentService.listEnrolments();
  res.json({ enrolments });
}

async function updateEnrolment(req, res) {
  const id = getIdParam(req);
  requireValid(validateEnrolmentUpdate(req.body));
  const enrolment = await enrolmentService.cancelEnrolment(id);
  res.json({ enrolment });
}

// Classes

async function listClasses(req, res) {
  const classes = await classService.listClasses();
  res.json({ classes });
}

async function createClass(req, res) {
  const input = requireValid(validateClass(req.body));
  const cls = await classService.createClass(input);
  res.status(201).json({ class: cls });
}

async function updateClass(req, res) {
  const id = getIdParam(req);
  const changes = requireValid(validateClass(req.body, { partial: true }));
  const cls = await classService.updateClass(id, changes);
  res.json({ class: cls });
}

async function deleteClass(req, res) {
  await classService.deleteClass(getIdParam(req));
  res.status(204).end();
}

module.exports = {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  createModule,
  updateModule,
  deleteModule,
  createTopic,
  updateTopic,
  deleteTopic,
  listTrainers,
  assignTrainer,
  unassignTrainer,
  listEnrolments,
  updateEnrolment,
  listClasses,
  createClass,
  updateClass,
  deleteClass,
};
