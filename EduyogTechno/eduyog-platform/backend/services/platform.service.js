const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS, buildSetClause } = require('../utils/db');

const COLUMNS = 'id, name, slug, description, url, is_active, created_at, updated_at';

// Validated field name -> column name. Also the whitelist for UPDATE.
const WRITABLE_COLUMNS = {
  name: 'name',
  slug: 'slug',
  description: 'description',
  url: 'url',
  isActive: 'is_active',
};

function toPlatform(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    url: row.url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function translateWriteError(err) {
  if (err.code === PG_ERRORS.UNIQUE_VIOLATION) {
    if (err.constraint === 'platforms_name_key') {
      return new HttpError(409, 'A platform with this name already exists');
    }
    if (err.constraint === 'platforms_slug_key') {
      return new HttpError(409, 'A platform with this slug already exists');
    }
  }
  if (err.code === PG_ERRORS.CHECK_VIOLATION) {
    return new HttpError(400, 'Platform data is invalid');
  }
  return err;
}

async function listPlatforms() {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM platforms ORDER BY name, id`);
  return rows.map(toPlatform);
}

async function getPlatform(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM platforms WHERE id = $1`, [id]);
  if (!rows[0]) {
    throw new HttpError(404, 'Platform not found');
  }
  return toPlatform(rows[0]);
}

async function createPlatform({ name, slug, description = null, url, isActive = true }) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO platforms (name, slug, description, url, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [name, slug, description, url, isActive]
    );
    return toPlatform(rows[0]);
  } catch (err) {
    throw translateWriteError(err);
  }
}

async function updatePlatform(id, changes) {
  const { assignments, params } = buildSetClause(WRITABLE_COLUMNS, changes);
  params.push(id);

  let rows;
  try {
    ({ rows } = await pool.query(
      `UPDATE platforms SET ${assignments.join(', ')}
       WHERE id = $${params.length}
       RETURNING ${COLUMNS}`,
      params
    ));
  } catch (err) {
    throw translateWriteError(err);
  }
  if (!rows[0]) {
    throw new HttpError(404, 'Platform not found');
  }
  return toPlatform(rows[0]);
}

// The foreign key (ON DELETE RESTRICT) is the source of truth, so a service
// added concurrently still blocks the delete.
async function deletePlatform(id) {
  let rowCount;
  try {
    ({ rowCount } = await pool.query('DELETE FROM platforms WHERE id = $1', [id]));
  } catch (err) {
    if (err.code === PG_ERRORS.RESTRICT_VIOLATION || err.code === PG_ERRORS.FOREIGN_KEY_VIOLATION) {
      const { rows } = await pool.query(
        'SELECT count(*)::int AS count FROM services WHERE platform_id = $1',
        [id]
      );
      throw new HttpError(
        409,
        'This platform still has services and cannot be deleted. Deactivate it instead, or remove or reassign its services first.',
        { serviceCount: rows[0].count }
      );
    }
    throw err;
  }
  if (rowCount === 0) {
    throw new HttpError(404, 'Platform not found');
  }
}

module.exports = {
  listPlatforms,
  getPlatform,
  createPlatform,
  updatePlatform,
  deletePlatform,
};
