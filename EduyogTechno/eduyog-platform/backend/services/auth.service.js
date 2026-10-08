const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const HttpError = require('../utils/httpError');

const BCRYPT_ROUNDS = 12;
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

// Compared against when the email is unknown, so a login for a missing
// account takes about as long as one with a wrong password.
const dummyHashPromise = bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

// Never includes password_hash.
function toPublicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

async function registerStudent({ fullName, email, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    // role is intentionally omitted so the column default ('student') applies.
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, role, created_at`,
      [fullName, email, passwordHash]
    );
    return toPublicUser(rows[0]);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION && err.constraint === 'users_email_key') {
      throw new HttpError(409, 'An account with this email already exists');
    }
    if (err.code === CHECK_VIOLATION) {
      throw new HttpError(400, 'Registration data is invalid');
    }
    throw err;
  }
}

// Returns the public user, or null if the email or password is wrong.
async function verifyCredentials(email, password) {
  const { rows } = await pool.query(
    `SELECT id, full_name, email, role, created_at, password_hash
     FROM users
     WHERE email = $1`,
    [email]
  );

  const user = rows[0];
  if (!user) {
    await bcrypt.compare(password, await dummyHashPromise);
    return null;
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  return matches ? toPublicUser(user) : null;
}

// For the authenticate middleware: the public user plus when the password was last
// changed (NULL if never), which is not part of the public user.
async function findUserForAuth(id) {
  const { rows } = await pool.query(
    `SELECT id, full_name, email, role, created_at, password_changed_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  return { user: toPublicUser(rows[0]), passwordChangedAt: rows[0].password_changed_at };
}

// Changes the signed-in user's password. A wrong current password is a validation
// error (400), never 401: the frontends treat 401 as an expired session.
async function changePassword(userId, currentPassword, newPassword) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT password_hash FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!rows[0]) {
      throw new HttpError(404, 'User not found');
    }
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      throw new HttpError(400, 'Validation failed', { currentPassword: 'Current password is incorrect' });
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await client.query(
      'UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2',
      [passwordHash, userId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT id, full_name, email, role, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return rows[0] ? toPublicUser(rows[0]) : null;
}

module.exports = {
  BCRYPT_ROUNDS,
  registerStudent,
  verifyCredentials,
  findUserById,
  findUserForAuth,
  changePassword,
};
