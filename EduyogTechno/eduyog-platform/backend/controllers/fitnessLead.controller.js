const fitnessLeadService = require('../services/fitnessLead.service');
const { validateFitnessLead } = require('../utils/validators');
const { getIdParam, requireValid } = require('./helpers');

async function list(req, res) {
  const leads = await fitnessLeadService.listLeads();
  res.json({ leads });
}

async function get(req, res) {
  const lead = await fitnessLeadService.getLead(getIdParam(req));
  res.json({ lead });
}

// Public: enquiry submitted from the Fitness site.
async function create(req, res) {
  const input = requireValid(validateFitnessLead(req.body));
  await fitnessLeadService.createLead(input);
  res.status(201).json({ message: 'Enquiry received' });
}

module.exports = {
  list,
  get,
  create,
};
