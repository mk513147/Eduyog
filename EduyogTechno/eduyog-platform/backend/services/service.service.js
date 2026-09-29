const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS, buildSetClause } = require('../utils/db');

// Selected from a row source aliased "s", joined to its platform for the name.
const SELECT_FROM = `
  SELECT s.id, s.platform_id, p.name AS platform_name, s.name, s.description,
         s.is_active, s.created_at, s.updated_at
  FROM s
  LEFT JOIN platforms p ON p.id = s.platform_id`;

const WRITABLE_COLUMNS = {
  platformId: 'platform_id',
  name: 'name',
  description: 'description',
  isActive: 'is_active',
};

function toService(row) {
  return {
    id: row.id,
    platformId: row.platform_id,
    platformName: row.platform_name,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function translateWriteError(err) {
  if (err.code === PG_ERRORS.UNIQUE_VIOLATION) {
    if (err.constraint === 'services_platform_name_key') {
      return new HttpError(409, 'A service with this name already exists for this platform');
    }
    if (err.constraint === 'services_unassigned_name_key') {
      return new HttpError(409, 'A service with this name already exists without a platform');
    }
  }
  if (err.code === PG_ERRORS.FOREIGN_KEY_VIOLATION) {
    return new HttpError(400, 'Validation failed', { platformId: 'Platform does not exist' });
  }
  if (err.code === PG_ERRORS.CHECK_VIOLATION) {
    return new HttpError(400, 'Service data is invalid');
  }
  return err;
}

async function listServices() {
  const { rows } = await pool.query(
    `WITH s AS (SELECT * FROM services) ${SELECT_FROM} ORDER BY s.name, s.id`
  );
  return rows.map(toService);
}

async function getService(id) {
  const { rows } = await pool.query(
    `WITH s AS (SELECT * FROM services WHERE id = $1) ${SELECT_FROM}`,
    [id]
  );
  if (!rows[0]) {
    throw new HttpError(404, 'Service not found');
  }
  return toService(rows[0]);
}

async function createService({ platformId = null, name, description = null, isActive = true }) {
  try {
    const { rows } = await pool.query(
      `WITH s AS (
         INSERT INTO services (platform_id, name, description, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING *
       ) ${SELECT_FROM}`,
      [platformId, name, description, isActive]
    );
    return toService(rows[0]);
  } catch (err) {
    throw translateWriteError(err);
  }
}

async function updateService(id, changes) {
  const { assignments, params } = buildSetClause(WRITABLE_COLUMNS, changes);
  params.push(id);

  let rows;
  try {
    ({ rows } = await pool.query(
      `WITH s AS (
         UPDATE services SET ${assignments.join(', ')}
         WHERE id = $${params.length}
         RETURNING *
       ) ${SELECT_FROM}`,
      params
    ));
  } catch (err) {
    throw translateWriteError(err);
  }
  if (!rows[0]) {
    throw new HttpError(404, 'Service not found');
  }
  return toService(rows[0]);
}

async function deleteService(id) {
  const { rowCount } = await pool.query('DELETE FROM services WHERE id = $1', [id]);
  if (rowCount === 0) {
    throw new HttpError(404, 'Service not found');
  }
}

module.exports = {
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
};
