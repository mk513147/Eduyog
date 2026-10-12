const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { cancelActiveEnrolments } = require('./eduyarpEnrolment.service');

// Never includes password_hash.
const COLUMNS = 'id, full_name, email, role, approval_status, created_at, updated_at';

function toUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    approvalStatus: row.approval_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listUsers() {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM users ORDER BY id`);
  return rows.map(toUser);
}

// Admin: student registrations, newest first. status is 'pending' (default), 'approved' or 'rejected';
// only Students have a registration to review.
async function listRegistrations(status = 'pending') {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.role, u.approval_status, u.created_at, u.updated_at,
            u.approval_decided_at, u.approval_reason, d.full_name AS decided_by_name
     FROM users u
     LEFT JOIN users d ON d.id = u.approval_decided_by
     WHERE u.role = 'student' AND u.approval_status = $1
     ORDER BY u.created_at DESC, u.id DESC`,
    [status]
  );
  return rows.map((row) => ({
    ...toUser(row),
    decidedAt: row.approval_decided_at,
    decidedByName: row.decided_by_name,
    reason: row.approval_reason,
  }));
}

// Admin approves or rejects a Student account. The row is locked, so two Admins deciding at once
// are applied one after the other; repeating the current decision changes nothing. Rejecting also
// signs the Student out everywhere: authenticate refuses their tokens from the next request on.
async function decideRegistration(adminId, id, { status, reason }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT ${COLUMNS} FROM users WHERE id = $1 FOR UPDATE`, [id]);
    const target = rows[0];
    if (!target) {
      throw new HttpError(404, 'User not found');
    }
    if (target.role !== 'student') {
      throw new HttpError(409, 'Only Student registrations can be approved or rejected');
    }
    if (target.approval_status === status) {
      await client.query('COMMIT');
      return toUser(target);
    }
    const { rows: updated } = await client.query(
      `UPDATE users
       SET approval_status = $2, approval_decided_at = now(), approval_decided_by = $3, approval_reason = $4
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, status, adminId, status === 'rejected' ? reason : null]
    );
    await client.query('COMMIT');
    return toUser(updated[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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
  listRegistrations,
  decideRegistration,
  changeUserRole,
};
