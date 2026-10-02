const HttpError = require('../utils/httpError');
const { parseId } = require('../utils/validators');

// Returns req.params[name] (default "id") as a validated id string, or
// responds 400.
function getIdParam(req, name = 'id') {
  const id = parseId(req.params[name]);
  if (id === null) {
    throw new HttpError(400, `Invalid ${name}`);
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
