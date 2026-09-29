const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ALGORITHM = 'HS256';

// The token carries only the user id. Role is always read from the database
// so a role change takes effect immediately.
function signAccessToken(userId) {
  return jwt.sign({}, env.jwt.secret, {
    algorithm: ALGORITHM,
    subject: String(userId),
    expiresIn: env.jwt.expiresIn,
  });
}

// Throws jsonwebtoken's TokenExpiredError / JsonWebTokenError on failure.
function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret, { algorithms: [ALGORITHM] });
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
};
