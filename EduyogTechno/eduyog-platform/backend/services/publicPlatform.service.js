const pool = require('../config/database');

// Public projection of a platform. Only these fields may leave the API;
// ids, timestamps and is_active are deliberately not selected.
function toPublicPlatform(row) {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description,
    url: row.url,
  };
}

async function listActivePlatforms() {
  const { rows } = await pool.query(
    `SELECT name, slug, description, url
     FROM platforms
     WHERE is_active = TRUE
     ORDER BY name, id`
  );
  return rows.map(toPublicPlatform);
}

module.exports = {
  listActivePlatforms,
};
