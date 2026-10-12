const userService = require('../services/user.service');
const profileService = require('../services/profile.service');
const {
  validateProfile,
  validateRoleChange,
  validateApprovalDecision,
  validateStatusFilter,
} = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

async function list(req, res) {
  const users = await userService.listUsers();
  res.json({ users });
}

// Admin: Student registrations (default: pending) and the approve / reject decision.
async function listRegistrations(req, res) {
  const { status } = requireValid(validateStatusFilter(req.query, ['pending', 'approved', 'rejected']));
  res.json({ registrations: await userService.listRegistrations(status) });
}

async function decideRegistration(req, res) {
  const decision = requireValid(validateApprovalDecision(req.body));
  const user = await userService.decideRegistration(req.user.id, getIdParam(req), decision);
  res.json({ user });
}

async function changeRole(req, res) {
  const id = getIdParam(req);
  const { role } = requireValid(validateRoleChange(req.body));
  const user = await userService.changeUserRole(id, role);
  res.json({ user });
}

// Admin: one user's account and profile.
async function get(req, res) {
  const profile = await profileService.getProfile(getIdParam(req));
  res.json({ profile });
}

// Admin edits profile fields and the display name; e-mail, role and password
// are not editable here (roles go through changeRole).
async function updateProfile(req, res) {
  const id = getIdParam(req);
  const changes = requireValid(validateProfile(req.body));
  const profile = await profileService.updateProfile(id, changes);
  res.json({ profile });
}

module.exports = {
  list,
  get,
  updateProfile,
  changeRole,
  listRegistrations,
  decideRegistration,
};
