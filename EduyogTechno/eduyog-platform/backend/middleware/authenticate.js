const { verifyAccessToken } = require('../utils/jwt');
const { findUserForAuth } = require('../services/auth.service');
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
  const found = await findUserForAuth(payload.sub);
  if (!found) {
    throw new HttpError(401, 'Invalid token');
  }

  // A password change invalidates every token issued before it. Both sides are
  // compared in whole seconds (the token's iat has no sub-second part), so a token
  // issued in the same second as the change, such as the one returned by the
  // password-change request itself, stays valid.
  if (found.passwordChangedAt) {
    const changedAt = Math.floor(found.passwordChangedAt.getTime() / 1000);
    if (typeof payload.iat !== 'number' || payload.iat < changedAt) {
      throw new HttpError(401, 'Your password was changed. Please sign in again.');
    }
  }

  req.user = found.user;
  next();
}

module.exports = authenticate;
