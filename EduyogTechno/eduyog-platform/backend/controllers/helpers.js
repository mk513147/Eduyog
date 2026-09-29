const HttpError = require('../utils/httpError');
const { parseId } = require('../utils/validators');

// Returns req.params.id as a validated id string, or responds 400.
function getIdParam(req) {
  const id = parseId(req.params.id);
  if (id === null) {
    throw new HttpError(400, 'Invalid id');
  }
  return id;
}

// Unwraps a validator result, or responds 400 with the field errors.
function requireValid({ value, errors }) {
  if (errors) {
    throw new HttpError(400, 'Validation failed', errors);
  }
  return value;
}

module.exports = {
  getIdParam,
  requireValid,
};
