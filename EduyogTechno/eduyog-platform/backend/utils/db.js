// PostgreSQL error codes handled by the services.
const PG_ERRORS = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  // Raised instead of 23503 when an ON DELETE RESTRICT reference blocks a delete.
  RESTRICT_VIOLATION: '23001',
  CHECK_VIOLATION: '23514',
};

// Builds "col = $n" assignments for the fields present in `value`.
// Column names come only from the fixed `columns` map, never from input.
function buildSetClause(columns, value) {
  const assignments = [];
  const params = [];
  for (const [field, column] of Object.entries(columns)) {
    if (value[field] !== undefined) {
      params.push(value[field]);
      assignments.push(`${column} = $${params.length}`);
    }
  }
  return { assignments, params };
}

module.exports = {
  PG_ERRORS,
  buildSetClause,
};
