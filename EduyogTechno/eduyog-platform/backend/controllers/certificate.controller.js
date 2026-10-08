const certificateService = require('../services/certificate.service');
const { validateRevocation, validateCertificateFilters } = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

// Student: the student is always req.user.
async function listMine(req, res) {
  res.json({ certificates: await certificateService.listForStudent(req.user.id) });
}

async function getMine(req, res) {
  res.json({ certificate: await certificateService.getForStudent(req.user.id, getIdParam(req)) });
}

// Admin (behind authenticate + requireAdmin).
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

module.exports = { listMine, getMine, list, get, revoke };
