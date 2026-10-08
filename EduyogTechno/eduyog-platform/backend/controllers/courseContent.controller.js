const contentService = require('../services/courseContent.service');
const { validateFaq, validateResource, validateReorder } = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

// Shared by the Admin, Trainer and Student routes. The actor is always req.user and
// every call is authorised in the service from the database.

const courseId = (req) => getIdParam(req, 'courseId');

async function listFaqs(req, res) {
  res.json({ faqs: await contentService.listFaqs(req.user, courseId(req)) });
}

async function createFaq(req, res) {
  const input = requireValid(validateFaq(req.body));
  res.status(201).json({ faq: await contentService.createFaq(req.user, courseId(req), input) });
}

async function updateFaq(req, res) {
  const changes = requireValid(validateFaq(req.body, { partial: true }));
  res.json({ faq: await contentService.updateFaq(req.user, getIdParam(req), changes) });
}

async function deleteFaq(req, res) {
  await contentService.deleteFaq(req.user, getIdParam(req));
  res.status(204).end();
}

async function reorderFaqs(req, res) {
  const { ids } = requireValid(validateReorder(req.body));
  res.json({ faqs: await contentService.reorderFaqs(req.user, courseId(req), ids) });
}

async function listResources(req, res) {
  res.json({ resources: await contentService.listResources(req.user, courseId(req)) });
}

async function createResource(req, res) {
  const input = requireValid(validateResource(req.body));
  res.status(201).json({ resource: await contentService.createResource(req.user, courseId(req), input) });
}

async function updateResource(req, res) {
  const changes = requireValid(validateResource(req.body, { partial: true }));
  res.json({ resource: await contentService.updateResource(req.user, getIdParam(req), changes) });
}

async function deleteResource(req, res) {
  await contentService.deleteResource(req.user, getIdParam(req));
  res.status(204).end();
}

module.exports = {
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  reorderFaqs,
  listResources,
  createResource,
  updateResource,
  deleteResource,
};
