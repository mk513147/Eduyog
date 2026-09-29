const fitnessLeadService = require('../services/fitnessLead.service');
const { getIdParam } = require('./helpers');

async function list(req, res) {
  const leads = await fitnessLeadService.listLeads();
  res.json({ leads });
}

async function get(req, res) {
  const lead = await fitnessLeadService.getLead(getIdParam(req));
  res.json({ lead });
}

module.exports = {
  list,
  get,
};
