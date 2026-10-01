const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { cancelActiveEnrolments } = require('./eduyarpEnrolment.service');

// Never includes password_hash.
const COLUMNS = 'id, full_name, email, role, created_at, updated_at';

function toUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listUsers() {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM users ORDER BY id`);
  return rows.map(toUser);
}

// Implements the last-Admin protection documented in the users schema:
// lock all admin rows in id order, count them, and refuse to demote the
// only one. Concurrent role changes queue on these locks, so two admins
// demoting each other at the same time cannot leave zero admins.
async function changeUserRole(id, role) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: adminRows } = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id FOR UPDATE"
    );

    const { rows: targetRows } = await client.query(
      `SELECT ${COLUMNS} FROM users WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const target = targetRows[0];
    if (!target) {
      throw new HttpError(404, 'User not found');
    }

    if (target.role === role) {
      await client.query('COMMIT');
      return toUser(target);
    }

    if (target.role === 'admin' && adminRows.length <= 1) {
      throw new HttpError(409, 'Cannot demote the last Admin. Promote another user to Admin first.');
    }

    const { rows } = await client.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING ${COLUMNS}`,
      [role, id]
    );

    // A Student who becomes a Trainer or Admin is no longer a Student, so
    // their active Eduyarp enrolments are cancelled in the same transaction.
    // Nothing is restored if they later become a Student again.
    if (target.role === 'student') {
      await cancelActiveEnrolments(id, client);
    }

    await client.query('COMMIT');
    return toUser(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listUsers,
  changeUserRole,
};
