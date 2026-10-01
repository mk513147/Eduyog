const pool = require('../config/database');
const HttpError = require('../utils/httpError');

const COLUMNS = `id, business_name, contact_name, email, phone, business_type, location,
  services_offered, marketing_requirements, website_links, marketing_objectives,
  message, created_at`;

function toLead(row) {
  return {
    id: row.id,
    businessName: row.business_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    businessType: row.business_type,
    location: row.location,
    servicesOffered: row.services_offered,
    marketingRequirements: row.marketing_requirements,
    websiteLinks: row.website_links,
    marketingObjectives: row.marketing_objectives,
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

// Input comes from validateFitnessLead. Nothing is returned: the public
// endpoint does not echo stored data back to the visitor.
async function createLead(lead) {
  await pool.query(
    `INSERT INTO fitness_leads (
       business_name, contact_name, email, phone, business_type, location,
       services_offered, marketing_requirements, website_links, marketing_objectives,
       message
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      lead.businessName,
      lead.contactName,
      lead.email,
      lead.phone,
      lead.businessType,
      lead.location,
      lead.servicesOffered,
      lead.marketingRequirements,
      lead.websiteLinks,
      lead.marketingObjectives,
      lead.message,
    ]
  );
}

module.exports = {
  listLeads,
  getLead,
  createLead,
};
