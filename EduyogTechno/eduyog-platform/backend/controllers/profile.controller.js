const authService = require('../services/auth.service');
const profileService = require('../services/profile.service');
const { signAccessToken } = require('../utils/jwt');
const { validateProfile, validatePasswordChange } = require('../utils/validators');
const env = require('../config/env');
const { requireValid } = require('./helpers');

// The user is always req.user, set by authenticate; no user id is read from the request.

async function getMyProfile(req, res) {
  const profile = await profileService.getProfile(req.user.id);
  res.json({ profile });
}

async function updateMyProfile(req, res) {
  const changes = requireValid(validateProfile(req.body));
  const profile = await profileService.updateProfile(req.user.id, changes);
  res.json({ profile });
}

// Tokens issued before the change stop working, so the response carries a fresh
// one and the client can keep the current session going.
async function changeMyPassword(req, res) {
  const { currentPassword, newPassword } = requireValid(validatePasswordChange(req.body));
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({
    token: signAccessToken(req.user.id),
    tokenType: 'Bearer',
    expiresIn: env.jwt.expiresIn,
  });
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
};
