const express = require('express');
const { rateLimit } = require('express-rate-limit');
const HttpError = require('../utils/httpError');
const studentaqEnquiryController = require('../controllers/studentaqEnquiry.controller');

// Public enquiry submission from the StudentAQ site. No authentication, and deliberately no read
// routes: stored enquiries are listed only by GET /api/admin/studentaq-enquiries (Admin).
const router = express.Router();

// The form's fields add up to well under 5 KB; refuse anything much larger (the global JSON
// parser still caps every body at its own limit).
const MAX_BODY_BYTES = 20 * 1024;

function limitBodySize(req, res, next) {
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
    return next(new HttpError(413, 'Request body is too large'));
  }
  return next();
}

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many enquiries, please try again later' } },
});

router.post('/', limitBodySize, submitLimiter, studentaqEnquiryController.create);

module.exports = router;
