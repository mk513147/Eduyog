const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { assertCourseAccess, isAssigned } = require('./eduyarpAccess.service');
const notifications = require('./notification.service');

// Announcements from Admins (platform-wide or per course) and from Trainers (their
// own courses only). Every permission is decided here from the database; course,
// author and role are never taken from the request body.

const SELECT = `
  SELECT a.id, a.course_id, c.title AS course_title, a.author_id, u.full_name AS author_name,
         u.role AS author_role, a.title, a.body, a.created_at
  FROM announcements a
  JOIN users u ON u.id = a.author_id
  LEFT JOIN courses c ON c.id = a.course_id`;

const LIST_LIMIT = 200;

// `viewerId` lets the client show "delete" only on the viewer's own announcements; the
// server still decides on every delete.
function toAnnouncement(row, viewerId) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    platformWide: row.course_id === null,
    authorName: row.author_name,
    authorRole: row.author_role,
    mine: viewerId !== undefined && String(row.author_id) === String(viewerId),
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
  };
}

async function findCourse(db, courseId) {
  const { rows } = await db.query('SELECT id, title FROM courses WHERE id = $1', [courseId]);
  return rows[0] || null;
}

async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Creates the announcement and one notification per recipient in ONE transaction, so
// an announcement never exists without its notifications (and the reverse).
// Course announcements go to the course's current students (active or completed) and
// to its other assigned Trainers; platform-wide ones go to every student who currently
// has at least one active or completed enrolment, once each.
async function publish(author, { courseId, title, body }) {
  return inTransaction(async (db) => {
    // Serialises a double submit by the same author for the same target.
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`announce:${author.id}:${courseId ?? 'all'}`]);

    const duplicate = await db.query(
      `SELECT 1 FROM announcements
       WHERE author_id = $1 AND course_id IS NOT DISTINCT FROM $2 AND title = $3 AND body = $4
         AND created_at > now() - interval '30 seconds'`,
      [author.id, courseId, title, body]
    );
    if (duplicate.rows.length > 0) {
      throw new HttpError(409, 'This announcement was just posted');
    }

    const { rows } = await db.query(
      `INSERT INTO announcements (course_id, author_id, title, body)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [courseId, author.id, title, body]
    );
    const id = rows[0].id;

    const payload = {
      type: notifications.TYPES.ANNOUNCEMENT,
      title,
      body,
      linkPath: '/announcements',
      courseId,
    };
    let notified;
    if (courseId === null) {
      notified = await notifications.createNotificationsForUsers(db, await notifications.currentStudentIds(db), payload);
    } else {
      const students = await notifications.currentCourseStudentIds(db, courseId);
      const trainers = (await notifications.assignedTrainerIds(db, courseId)).filter(
        (trainerId) => String(trainerId) !== String(author.id)
      );
      notified = await notifications.createNotificationsForUsers(db, [...students, ...trainers], payload);
    }

    const created = await db.query(`${SELECT} WHERE a.id = $1`, [id]);
    return { ...toAnnouncement(created.rows[0], author.id), notifiedCount: notified };
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

// input.courseId null/undefined = platform-wide.
async function createAsAdmin(admin, input) {
  const courseId = input.courseId ?? null;
  if (courseId !== null && !(await findCourse(pool, courseId))) {
    throw new HttpError(400, 'Validation failed', { courseId: 'Course does not exist' });
  }
  return publish(admin, { courseId, title: input.title, body: input.body });
}

// filter: { courseId } for one course, { platformOnly: true } for platform-wide only.
async function listForAdmin({ courseId, platformOnly } = {}) {
  const where = [];
  const params = [];
  if (courseId) {
    params.push(courseId);
    where.push(`a.course_id = $${params.length}`);
  } else if (platformOnly) {
    where.push('a.course_id IS NULL');
  }
  const { rows } = await pool.query(
    `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY a.created_at DESC, a.id DESC LIMIT ${LIST_LIMIT}`,
    params
  );
  return rows.map((row) => toAnnouncement(row));
}

async function deleteAsAdmin(id) {
  const { rowCount } = await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
  if (rowCount === 0) throw new HttpError(404, 'Announcement not found');
}

// ---------------------------------------------------------------------------
// Trainer (course-scoped; the assignment is re-checked on every call)
// ---------------------------------------------------------------------------

async function listForCourse(actor, courseId) {
  await assertCourseAccess(actor, courseId);
  const { rows } = await pool.query(
    `${SELECT} WHERE a.course_id = $1 ORDER BY a.created_at DESC, a.id DESC LIMIT ${LIST_LIMIT}`,
    [courseId]
  );
  return rows.map((row) => toAnnouncement(row, actor.id));
}

async function createForCourse(actor, courseId, input) {
  await assertCourseAccess(actor, courseId);
  return publish(actor, { courseId, title: input.title, body: input.body });
}

// A Trainer may delete only an announcement they wrote, on a course they are still
// assigned to. Anything else they cannot see (another course, platform-wide, no such
// id) is a 404, so ids cannot be probed; someone else's announcement on their own
// course is a 403.
async function deleteAsTrainer(actor, id) {
  const { rows } = await pool.query('SELECT course_id, author_id FROM announcements WHERE id = $1', [id]);
  const found = rows[0];
  if (!found || found.course_id === null || !(await isAssigned(found.course_id, actor.id))) {
    throw new HttpError(404, 'Announcement not found');
  }
  if (String(found.author_id) !== String(actor.id)) {
    throw new HttpError(403, 'You can only delete announcements you posted');
  }
  const { rowCount } = await pool.query('DELETE FROM announcements WHERE id = $1 AND author_id = $2', [id, actor.id]);
  if (rowCount === 0) throw new HttpError(404, 'Announcement not found');
}

// ---------------------------------------------------------------------------
// The signed-in Student or Trainer: announcements delivered to them.
// ---------------------------------------------------------------------------

async function listForUser(user) {
  let where;
  if (user.role === 'student') {
    const current = `e.student_id = $1 AND e.status IN ('active', 'completed')`;
    where = `(a.course_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM enrolments e WHERE e.course_id = a.course_id AND ${current}))
             OR (a.course_id IS NULL AND EXISTS (SELECT 1 FROM enrolments e WHERE ${current}))`;
  } else if (user.role === 'trainer') {
    where = `a.course_id IN (SELECT ct.course_id FROM course_trainers ct WHERE ct.trainer_id = $1)`;
  } else {
    return [];
  }
  const { rows } = await pool.query(
    `${SELECT} WHERE ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ${LIST_LIMIT}`,
    [user.id]
  );
  return rows.map((row) => toAnnouncement(row, user.id));
}

module.exports = {
  createAsAdmin,
  listForAdmin,
  deleteAsAdmin,
  listForCourse,
  createForCourse,
  deleteAsTrainer,
  listForUser,
};
