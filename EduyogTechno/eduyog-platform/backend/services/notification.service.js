const pool = require('../config/database');
const HttpError = require('../utils/httpError');

// In-app notifications. One row per recipient; nothing here is ever addressed by a
// recipient id taken from a request.

const TYPES = Object.freeze({
  ANNOUNCEMENT: 'announcement',
  CLASS_SCHEDULED: 'class_scheduled',
  CLASS_SCHEDULE_CHANGED: 'class_schedule_changed',
  ASSIGNMENT_SUBMISSION: 'assignment_submission',
});

const TITLE_MAX = 200;
const BODY_MAX = 500;
const LINK_PATTERN = /^\/(?!\/)[A-Za-z0-9._~%/?#=&-]*$/;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Students who currently take a course (active or completed; never cancelled).
// The role join keeps a user who was later made a Trainer/Admin, and so may still
// hold a completed enrolment, from receiving student notifications.
const COURSE_STUDENTS_SQL = `
  SELECT DISTINCT e.student_id AS id
  FROM enrolments e
  JOIN users u ON u.id = e.student_id AND u.role = 'student'
  WHERE e.course_id = $1 AND e.status IN ('active', 'completed')`;

const ALL_CURRENT_STUDENTS_SQL = `
  SELECT DISTINCT e.student_id AS id
  FROM enrolments e
  JOIN users u ON u.id = e.student_id AND u.role = 'student'
  WHERE e.status IN ('active', 'completed')`;

const ASSIGNED_TRAINERS_SQL = `
  SELECT ct.trainer_id AS id
  FROM course_trainers ct
  JOIN users u ON u.id = ct.trainer_id AND u.role = 'trainer'
  WHERE ct.course_id = $1`;

function truncate(text, max) {
  if (text == null) return null;
  const clean = String(text).trim();
  if (clean === '') return null;
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

// Only an internal application path is ever stored.
function isInternalPath(path) {
  return typeof path === 'string' && path.length <= 255 && LINK_PATTERN.test(path);
}

function normalise({ type, title, body, linkPath, courseId }) {
  if (!Object.values(TYPES).includes(type)) {
    throw new Error(`Unknown notification type: ${type}`);
  }
  const cleanTitle = truncate(title, TITLE_MAX);
  if (!cleanTitle) throw new Error('A notification needs a title');
  if (linkPath != null && !isInternalPath(linkPath)) {
    throw new Error('Notification links must be internal paths');
  }
  return [type, cleanTitle, truncate(body, BODY_MAX), linkPath ?? null, courseId ?? null];
}

// `db` is the pool or a transaction client, so callers choose the transaction boundary.
async function createNotification(db, recipientId, payload) {
  const [type, title, body, linkPath, courseId] = normalise(payload);
  await db.query(
    `INSERT INTO notifications (recipient_id, type, title, body, link_path, course_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [recipientId, type, title, body, linkPath, courseId]
  );
  return 1;
}

// One row per distinct user id. Returns the number of rows created.
async function createNotificationsForUsers(db, userIds, payload) {
  const unique = [...new Set(userIds.map(String))];
  if (unique.length === 0) return 0;
  const [type, title, body, linkPath, courseId] = normalise(payload);
  const { rowCount } = await db.query(
    `INSERT INTO notifications (recipient_id, type, title, body, link_path, course_id)
     SELECT recipient, $2, $3, $4, $5, $6 FROM unnest($1::bigint[]) AS recipient`,
    [unique, type, title, body, linkPath, courseId]
  );
  return rowCount;
}

async function currentCourseStudentIds(db, courseId) {
  const { rows } = await db.query(COURSE_STUDENTS_SQL, [courseId]);
  return rows.map((r) => r.id);
}

async function currentStudentIds(db) {
  const { rows } = await db.query(ALL_CURRENT_STUDENTS_SQL);
  return rows.map((r) => r.id);
}

async function assignedTrainerIds(db, courseId) {
  const { rows } = await db.query(ASSIGNED_TRAINERS_SQL, [courseId]);
  return rows.map((r) => r.id);
}

// Students with an active or completed enrolment in the course.
async function createNotificationsForCourseStudents(db, courseId, payload) {
  const ids = await currentCourseStudentIds(db, courseId);
  return createNotificationsForUsers(db, ids, { ...payload, courseId });
}

// ---------------------------------------------------------------------------
// Reading and marking (always scoped to the signed-in user)
// ---------------------------------------------------------------------------

function toNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    linkPath: row.link_path,
    courseId: row.course_id,
    courseTitle: row.course_title,
    read: row.read_at !== null,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

async function unreadCount(userId) {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS count FROM notifications WHERE recipient_id = $1 AND read_at IS NULL',
    [userId]
  );
  return rows[0].count;
}

// Query values were validated by validatePagination: limit 1-100, offset >= 0.
async function listNotifications(userId, { limit = DEFAULT_LIMIT, offset = 0, unread = false } = {}) {
  const filter = unread ? 'AND n.read_at IS NULL' : '';
  const [{ rows }, totals] = await Promise.all([
    pool.query(
      `SELECT n.id, n.type, n.title, n.body, n.link_path, n.course_id, c.title AS course_title,
              n.read_at, n.created_at
       FROM notifications n
       LEFT JOIN courses c ON c.id = n.course_id
       WHERE n.recipient_id = $1 ${filter}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    pool.query(
      `SELECT count(*)::int AS total, (count(*) FILTER (WHERE read_at IS NULL))::int AS unread
       FROM notifications n WHERE n.recipient_id = $1`,
      [userId]
    ),
  ]);
  return {
    notifications: rows.map(toNotification),
    unreadCount: totals.rows[0].unread,
    total: unread ? totals.rows[0].unread : totals.rows[0].total,
  };
}

// Another user's notification looks exactly like one that does not exist (404).
async function markRead(userId, id) {
  const { rows } = await pool.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND recipient_id = $2
     RETURNING id`,
    [id, userId]
  );
  if (!rows[0]) throw new HttpError(404, 'Notification not found');
  return { unreadCount: await unreadCount(userId) };
}

async function markAllRead(userId) {
  const { rowCount } = await pool.query(
    'UPDATE notifications SET read_at = now() WHERE recipient_id = $1 AND read_at IS NULL',
    [userId]
  );
  return { updated: rowCount, unreadCount: 0 };
}

module.exports = {
  TYPES,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  isInternalPath,
  truncate,
  createNotification,
  createNotificationsForUsers,
  createNotificationsForCourseStudents,
  currentCourseStudentIds,
  currentStudentIds,
  assignedTrainerIds,
  listNotifications,
  markRead,
  markAllRead,
};
