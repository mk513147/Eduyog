const serviceService = require('../services/service.service');
const { validateService } = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

async function list(req, res) {
  const services = await serviceService.listServices();
  res.json({ services });
}

async function get(req, res) {
  const service = await serviceService.getService(getIdParam(req));
  res.json({ service });
}

async function create(req, res) {
  const input = requireValid(validateService(req.body));
  const service = await serviceService.createService(input);
  res.status(201).json({ service });
}

async function update(req, res) {
  const id = getIdParam(req);
  const changes = requireValid(validateService(req.body, { partial: true }));
  const service = await serviceService.updateService(id, changes);
  res.json({ service });
}

async function remove(req, res) {
  await serviceService.deleteService(getIdParam(req));
  res.status(204).end();
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
};
