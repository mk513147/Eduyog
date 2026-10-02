const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS } = require('../utils/db');
const courseService = require('./eduyarpCourse.service');

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

// Users with role 'trainer', each with the courses they are assigned to.
async function listTrainers() {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.created_at,
            c.id AS course_id, c.title AS course_title, c.status AS course_status
     FROM users u
     LEFT JOIN course_trainers ct ON ct.trainer_id = u.id
     LEFT JOIN courses c ON c.id = ct.course_id
     WHERE u.role = 'trainer'
     ORDER BY u.full_name, u.id, c.title, c.id`
  );

  const trainers = [];
  const byId = new Map();
  for (const row of rows) {
    let trainer = byId.get(row.id);
    if (!trainer) {
      trainer = {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        createdAt: row.created_at,
        courses: [],
      };
      byId.set(row.id, trainer);
      trainers.push(trainer);
    }
    if (row.course_id !== null) {
      trainer.courses.push({ id: row.course_id, title: row.course_title, status: row.course_status });
    }
  }
  return trainers;
}

async function assignTrainer(courseId, trainerId) {
  if (!(await courseService.findCourse(courseId))) {
    throw new HttpError(404, 'Course not found');
  }
  const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [trainerId]);
  if (!rows[0] || rows[0].role !== 'trainer') {
    throw new HttpError(400, 'Validation failed', {
      trainerId: 'User does not exist or does not have the Trainer role',
    });
  }
  try {
    await pool.query('INSERT INTO course_trainers (course_id, trainer_id) VALUES ($1, $2)', [
      courseId,
      trainerId,
    ]);
  } catch (err) {
    if (err.code === PG_ERRORS.UNIQUE_VIOLATION) {
      throw new HttpError(409, 'This trainer is already assigned to the course');
    }
    throw err;
  }
  return courseService.getCourse(courseId);
}

// Existing classes keep their trainer; only new or re-assigned classes are
// checked against current assignments.
async function unassignTrainer(courseId, trainerId) {
  const { rowCount } = await pool.query(
    'DELETE FROM course_trainers WHERE course_id = $1 AND trainer_id = $2',
    [courseId, trainerId]
  );
  if (rowCount === 0) {
    throw new HttpError(404, 'This trainer is not assigned to the course');
  }
  return courseService.getCourse(courseId);
}

// ---------------------------------------------------------------------------
// Trainer access
//
// A trainer's access to a course is decided by course_trainers in the
// database, never by ids sent from the client.
// ---------------------------------------------------------------------------

async function isAssigned(courseId, trainerId) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM course_trainers ct
     JOIN users u ON u.id = ct.trainer_id AND u.role = 'trainer'
     WHERE ct.course_id = $1 AND ct.trainer_id = $2`,
    [courseId, trainerId]
  );
  return rows.length > 0;
}

// Read-only view of one assigned course: outline, classes and the number of
// enrolled students (no student details).
async function getTrainerCourse(trainerId, courseId) {
  if (!(await isAssigned(courseId, trainerId))) {
    throw new HttpError(403, 'You are not assigned to this course');
  }
  const course = await courseService.findCourse(courseId);
  const [{ rows: classRows }, { rows: countRows }] = await Promise.all([
    pool.query(
      `SELECT cl.id, cl.title, cl.scheduled_at, cl.meeting_link, cl.status, u.full_name AS trainer_name
       FROM classes cl
       JOIN users u ON u.id = cl.trainer_id
       WHERE cl.course_id = $1
       ORDER BY cl.scheduled_at, cl.id`,
      [courseId]
    ),
    pool.query(
      "SELECT count(*) AS count FROM enrolments WHERE course_id = $1 AND status IN ('active', 'completed')",
      [courseId]
    ),
  ]);

  return {
    ...course,
    enrolmentCount: Number(countRows[0].count),
    modules: await courseService.getOutline(courseId),
    classes: classRows.map((row) => ({
      id: row.id,
      title: row.title,
      scheduledAt: row.scheduled_at,
      meetingLink: row.meeting_link,
      status: row.status,
      trainerName: row.trainer_name,
    })),
  };
}

module.exports = {
  listTrainers,
  assignTrainer,
  unassignTrainer,
  isAssigned,
  getTrainerCourse,
};
