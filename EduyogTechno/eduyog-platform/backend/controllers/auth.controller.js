const authService = require('../services/auth.service');
const { signAccessToken } = require('../utils/jwt');
const { validateRegistration, validateLogin } = require('../utils/validators');
const HttpError = require('../utils/httpError');
const env = require('../config/env');

async function register(req, res) {
  const { value, errors } = validateRegistration(req.body);
  if (errors) {
    throw new HttpError(400, 'Validation failed', errors);
  }

  const user = await authService.registerStudent(value);
  res.status(201).json({ user });
}

async function login(req, res) {
  const { value, errors } = validateLogin(req.body);
  if (errors) {
    throw new HttpError(400, 'Validation failed', errors);
  }

  const user = await authService.verifyCredentials(value.email, value.password);
  if (!user) {
    throw new HttpError(401, 'Invalid email or password');
  }

  // Credentials are correct, but a Student whose registration is not approved cannot sign in. The
  // messages say nothing beyond the account's own state, and are only given after a correct password.
  if (!authService.isActiveAccount(user)) {
    if (user.approvalStatus === 'pending') {
      throw new HttpError(403, 'Your registration is waiting for approval. You can sign in once Eduyog has approved it.', {
        code: 'account_pending',
      });
    }
    throw new HttpError(403, 'This account cannot sign in. Please contact Eduyog.', { code: 'account_not_approved' });
  }

  res.json({
    token: signAccessToken(user.id),
    tokenType: 'Bearer',
    expiresIn: env.jwt.expiresIn,
    user,
  });
}

// Returns the user attached by the authenticate middleware.
function me(req, res) {
  res.json({ user: req.user });
}

module.exports = {
  register,
  login,
  me,
};
