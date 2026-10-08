const assignmentService = require('../services/assignment.service');
const { validateAssignment, validateSubmission, validateFeedback } = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

// Shared by the Admin, Trainer and Student routes. The actor is always req.user and every
// call is authorised in the service from the database.

const courseId = (req) => getIdParam(req, 'courseId');

async function list(req, res) {
  res.json({ assignments: await assignmentService.listForCourse(req.user, courseId(req)) });
}

async function create(req, res) {
  const input = requireValid(validateAssignment(req.body));
  res.status(201).json({ assignment: await assignmentService.create(req.user, courseId(req), input) });
}

async function get(req, res) {
  res.json({ assignment: await assignmentService.get(req.user, getIdParam(req)) });
}

async function update(req, res) {
  const changes = requireValid(validateAssignment(req.body, { partial: true }));
  res.json({ assignment: await assignmentService.update(req.user, getIdParam(req), changes) });
}

async function remove(req, res) {
  await assignmentService.remove(req.user, getIdParam(req));
  res.status(204).end();
}

async function listSubmissions(req, res) {
  res.json(await assignmentService.listSubmissions(req.user, getIdParam(req)));
}

async function getSubmission(req, res) {
  res.json(await assignmentService.getSubmission(req.user, getIdParam(req)));
}

async function setFeedback(req, res) {
  const { feedback } = requireValid(validateFeedback(req.body));
  res.json({ submission: await assignmentService.setFeedback(req.user, getIdParam(req), feedback) });
}

// Student
async function listMine(req, res) {
  res.json({ assignments: await assignmentService.listForStudent(req.user, courseId(req)) });
}

async function getMine(req, res) {
  res.json({ assignment: await assignmentService.getForStudent(req.user, getIdParam(req)) });
}

async function submit(req, res) {
  const input = requireValid(validateSubmission(req.body));
  res.status(201).json({ submission: await assignmentService.submit(req.user, getIdParam(req), input) });
}

module.exports = {
  list,
  create,
  get,
  update,
  remove,
  listSubmissions,
  getSubmission,
  setFeedback,
  listMine,
  getMine,
  submit,
};
