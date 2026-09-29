const pool = require('../config/database');
const HttpError = require('../utils/httpError');

const COLUMNS = 'id, business_name, contact_name, email, phone, message, created_at';

function toLead(row) {
  return {
    id: row.id,
    businessName: row.business_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    createdAt: row.created_at,
  };
}

async function listLeads() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM fitness_leads ORDER BY created_at DESC, id DESC`
  );
  return rows.map(toLead);
}

async function getLead(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM fitness_leads WHERE id = $1`, [id]);
  if (!rows[0]) {
    throw new HttpError(404, 'Fitness lead not found');
  }
  return toLead(rows[0]);
}

module.exports = {
  listLeads,
  getLead,
};
