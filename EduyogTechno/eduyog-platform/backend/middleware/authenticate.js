const { verifyAccessToken } = require('../utils/jwt');
const { findUserById } = require('../services/auth.service');
const HttpError = require('../utils/httpError');

// Protects a route: requires "Authorization: Bearer <token>" and sets
// req.user to the current user loaded from the database.
async function authenticate(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.set('WWW-Authenticate', 'Bearer');
    throw new HttpError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
    const message = err.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token';
    throw new HttpError(401, message);
  }

  if (typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)) {
    throw new HttpError(401, 'Invalid token');
  }

  // Load the user so a deleted account or changed role applies immediately.
  const user = await findUserById(payload.sub);
  if (!user) {
    throw new HttpError(401, 'Invalid token');
  }

  req.user = user;
  next();
}

module.exports = authenticate;
