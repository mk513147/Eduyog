const studentaqEnquiryService = require('../services/studentaqEnquiry.service');
const { validateStudentaqEnquiry, validateStudentaqEnquiryQuery } = require('../utils/validators');
const { requireValid } = require('./helpers');

// Public: enquiry submitted from the StudentAQ contact page.
async function create(req, res) {
  const input = requireValid(validateStudentaqEnquiry(req.body));
  // A filled honeypot is a bot: answer like a success but store nothing.
  if (!input.honeypot) {
    await studentaqEnquiryService.createEnquiry(input);
  }
  res.status(201).json({ message: 'Enquiry received' });
}

// Admin only: stored enquiries, newest first, paged.
async function list(req, res) {
  const query = requireValid(validateStudentaqEnquiryQuery(req.query));
  const { enquiries, total } = await studentaqEnquiryService.listEnquiries(query);
  res.json({ enquiries, total, limit: query.limit, offset: query.offset });
}

module.exports = {
  create,
  list,
};
