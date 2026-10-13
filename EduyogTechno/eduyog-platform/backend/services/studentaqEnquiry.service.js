const pool = require('../config/database');

// Input comes from validateStudentaqEnquiry. Nothing is returned and nothing is logged: the
// public endpoint never echoes stored data back, and the content is personal data.
async function createEnquiry(enquiry) {
  await pool.query(
    `INSERT INTO studentaq_enquiries (
       full_name, email, phone, current_country, status, target_country,
       university, course, services, message, consent
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      enquiry.fullName,
      enquiry.email,
      enquiry.phone,
      enquiry.currentCountry,
      enquiry.status,
      enquiry.targetCountry,
      enquiry.university,
      enquiry.course,
      enquiry.services,
      enquiry.message,
      enquiry.consent,
    ]
  );
}

const COLUMNS = `id, full_name, email, phone, current_country, status, target_country,
  university, course, services, message, created_at`;

function toEnquiry(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    currentCountry: row.current_country,
    status: row.status,
    targetCountry: row.target_country,
    university: row.university,
    course: row.course,
    services: row.services,
    message: row.message,
    createdAt: row.created_at,
  };
}

// Admin only (see admin.routes.js). Newest first; `total` is the number of stored enquiries.
async function listEnquiries({ limit, offset }) {
  const [{ rows }, { rows: counted }] = await Promise.all([
    pool.query(
      `SELECT ${COLUMNS} FROM studentaq_enquiries ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    pool.query('SELECT count(*) AS total FROM studentaq_enquiries'),
  ]);
  return { enquiries: rows.map(toEnquiry), total: Number(counted[0].total) };
}

module.exports = {
  createEnquiry,
  listEnquiries,
};
