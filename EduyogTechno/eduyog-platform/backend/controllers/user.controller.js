const userService = require('../services/user.service');
const { validateRoleChange } = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

async function list(req, res) {
  const users = await userService.listUsers();
  res.json({ users });
}

async function changeRole(req, res) {
  const id = getIdParam(req);
  const { role } = requireValid(validateRoleChange(req.body));
  const user = await userService.changeUserRole(id, role);
  res.json({ user });
}

module.exports = {
  list,
  changeRole,
};
