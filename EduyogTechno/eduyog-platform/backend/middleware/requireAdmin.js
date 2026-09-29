const HttpError = require('../utils/httpError');

// Use after authenticate. req.user.role comes from the database (loaded by
// authenticate), never from the token or the request.
function requireAdmin(req, res, next) {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }
  if (req.user.role !== 'admin') {
    throw new HttpError(403, 'Admin access required');
  }
  next();
}

module.exports = requireAdmin;
