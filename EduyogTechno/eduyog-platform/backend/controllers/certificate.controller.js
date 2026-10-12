const certificateService = require('../services/certificate.service');
const {
  validateRevocation,
  validateCertificateFilters,
  validateCertificateRejection,
  validateStatusFilter,
} = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

// Student: the student is always req.user.
async function listMine(req, res) {
  res.json({ certificates: await certificateService.listForStudent(req.user.id) });
}

async function getMine(req, res) {
  res.json({ certificate: await certificateService.getForStudent(req.user.id, getIdParam(req)) });
}

// Student: certificate requests (the request is created on completion; this asks again after a rejection or
// for a legacy completion). 201 when a request was created, 200 with the existing pending one otherwise.
async function listMyRequests(req, res) {
  res.json({ requests: await certificateService.listRequestsForStudent(req.user.id) });
}

async function requestMine(req, res) {
  const { request, created } = await certificateService.requestForStudent(req.user.id, getIdParam(req, 'courseId'));
  res.status(created ? 201 : 200).json({ request });
}

// Admin (behind authenticate + requireAdmin).
async function listRequests(req, res) {
  const filters = requireValid(validateStatusFilter(req.query, ['pending', 'approved', 'rejected']));
  res.json({ requests: await certificateService.listRequestsForAdmin(filters) });
}

async function approveRequest(req, res) {
  res.json({ request: await certificateService.approveRequest(req.user.id, getIdParam(req)) });
}

async function rejectRequest(req, res) {
  const { reason } = requireValid(validateCertificateRejection(req.body));
  res.json({ request: await certificateService.rejectRequest(req.user.id, getIdParam(req), reason) });
}

async function list(req, res) {
  const filters = requireValid(validateCertificateFilters(req.query));
  res.json({ certificates: await certificateService.listForAdmin(filters) });
}

async function get(req, res) {
  res.json({ certificate: await certificateService.getForAdmin(getIdParam(req)) });
}

async function revoke(req, res) {
  const { reason } = requireValid(validateRevocation(req.body));
  res.json({ certificate: await certificateService.revoke(req.user.id, getIdParam(req), reason) });
}

module.exports = {
  listMine,
  getMine,
  listMyRequests,
  requestMine,
  list,
  get,
  revoke,
  listRequests,
  approveRequest,
  rejectRequest,
};
