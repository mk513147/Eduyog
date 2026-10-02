const HttpError = require('../utils/httpError');

const ROLE_LABELS = {
  student: 'Student',
  trainer: 'Trainer',
  admin: 'Admin',
};

// Use after authenticate. Like requireAdmin, the role comes from the database
// (loaded by authenticate), never from the token or the request.
function requireRole(role) {
  return function requireRoleMiddleware(req, res, next) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }
    if (req.user.role !== role) {
      throw new HttpError(403, `${ROLE_LABELS[role] || role} access required`);
    }
    next();
  };
}

module.exports = requireRole;
