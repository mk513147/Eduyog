const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS } = require('../utils/db');

// Profile fields stored in user_profiles. Column names come only from this map,
// never from input.
const PROFILE_COLUMNS = {
  phone: 'phone',
  institution: 'institution',
  studyLevel: 'study_level',
  fieldOfStudy: 'field_of_study',
  graduationYear: 'graduation_year',
  bio: 'bio',
  avatarUrl: 'avatar_url',
};

// Never includes password_hash. The account fields (name, e-mail, role) come from
// users; the rest from user_profiles, which has no row until the first save.
const PROFILE_SELECT = `
  SELECT u.id, u.full_name, u.email, u.role, u.created_at,
         p.phone, p.institution, p.study_level, p.field_of_study, p.graduation_year,
         p.bio, p.avatar_url, p.updated_at AS profile_updated_at
  FROM users u
  LEFT JOIN user_profiles p ON p.user_id = u.id
  WHERE u.id = $1`;

function toProfile(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    phone: row.phone,
    institution: row.institution,
    studyLevel: row.study_level,
    fieldOfStudy: row.field_of_study,
    graduationYear: row.graduation_year,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    profileUpdatedAt: row.profile_updated_at,
  };
}

async function getProfile(userId, queryable = pool) {
  const { rows } = await queryable.query(PROFILE_SELECT, [userId]);
  if (!rows[0]) {
    throw new HttpError(404, 'User not found');
  }
  return toProfile(rows[0]);
}

// Updates the display name (users.full_name) and/or the profile row in one
// transaction. `changes` is the output of validateProfile: only present fields are
// touched. Email, role and password are never written here.
async function updateProfile(userId, changes) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (rowCount === 0) {
      throw new HttpError(404, 'User not found');
    }

    if (changes.fullName !== undefined) {
      await client.query('UPDATE users SET full_name = $1 WHERE id = $2', [changes.fullName, userId]);
    }

    const fields = Object.keys(PROFILE_COLUMNS).filter((field) => changes[field] !== undefined);
    if (fields.length > 0) {
      const columns = fields.map((field) => PROFILE_COLUMNS[field]);
      const params = [userId, ...fields.map((field) => changes[field])];
      await client.query(
        `INSERT INTO user_profiles (user_id, ${columns.join(', ')})
         VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})
         ON CONFLICT (user_id) DO UPDATE SET ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}`,
        params
      );
    }

    const profile = await getProfile(userId, client);
    await client.query('COMMIT');
    return profile;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === PG_ERRORS.CHECK_VIOLATION) {
      throw new HttpError(400, 'Profile data is invalid');
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getProfile,
  updateProfile,
};
