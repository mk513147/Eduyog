const HttpError = require('../utils/httpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'Not found'));
}

// All errors are returned as { error: { message, details? } }.
// Unexpected errors are logged server-side and reported as a generic 500 so
// internal details never reach the client.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    const body = { message: err.message };
    if (err.details) {
      body.details = err.details;
    }
    return res.status(err.status).json({ error: body });
  }

  // Errors raised by express.json().
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body must be valid JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Request body is too large' } });
  }

  console.error(err);
  return res.status(500).json({ error: { message: 'Internal server error' } });
}

module.exports = {
  notFound,
  errorHandler,
};
