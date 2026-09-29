const platformService = require('../services/platform.service');
const { validatePlatform } = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

async function list(req, res) {
  const platforms = await platformService.listPlatforms();
  res.json({ platforms });
}

async function get(req, res) {
  const platform = await platformService.getPlatform(getIdParam(req));
  res.json({ platform });
}

async function create(req, res) {
  const input = requireValid(validatePlatform(req.body));
  const platform = await platformService.createPlatform(input);
  res.status(201).json({ platform });
}

async function update(req, res) {
  const id = getIdParam(req);
  const changes = requireValid(validatePlatform(req.body, { partial: true }));
  const platform = await platformService.updatePlatform(id, changes);
  res.json({ platform });
}

async function remove(req, res) {
  await platformService.deletePlatform(getIdParam(req));
  res.status(204).end();
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
};
