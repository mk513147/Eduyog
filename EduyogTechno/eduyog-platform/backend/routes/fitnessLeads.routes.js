const express = require('express');
const { rateLimit } = require('express-rate-limit');
const fitnessLeadController = require('../controllers/fitnessLead.controller');

// Public enquiry submission from the Fitness site. No authentication.
// Reading leads stays under /api/admin/fitness-leads.
const router = express.Router();

// Stricter than the general /api limit to slow down repeated submissions.
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many enquiries, please try again later' } },
});

router.post('/', submitLimiter, fitnessLeadController.create);

module.exports = router;
