const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS, buildSetClause } = require('../utils/db');
const courseService = require('./eduyarpCourse.service');
const trainerService = require('./eduyarpTrainer.service');
const classNotifications = require('./classNotification.service');

const WRITABLE_COLUMNS = {
  courseId: 'course_id',
  trainerId: 'trainer_id',
  title: 'title',
  scheduledAt: 'scheduled_at',
  meetingLink: 'meeting_link',
  status: 'status',
};

const CLASS_SELECT = `
  SELECT cl.id, cl.course_id, c.title AS course_title, cl.trainer_id, u.full_name AS trainer_name,
         cl.title, cl.scheduled_at, cl.meeting_link, cl.status, cl.created_at, cl.updated_at
  FROM classes cl
  JOIN courses c ON c.id = cl.course_id
  JOIN users u ON u.id = cl.trainer_id`;

function toClass(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    trainerId: row.trainer_id,
    trainerName: row.trainer_name,
    title: row.title,
    scheduledAt: row.scheduled_at,
    meetingLink: row.meeting_link,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function translateWriteError(err) {
  if (err.code === PG_ERRORS.CHECK_VIOLATION) {
    return new HttpError(400, 'Class data is invalid');
  }
  return err;
}

// The trainer must be a Trainer assigned to the course.
async function checkCourseAndTrainer(courseId, trainerId) {
  if (!(await courseService.findCourse(courseId))) {
    throw new HttpError(400, 'Validation failed', { courseId: 'Course does not exist' });
  }
  if (!(await trainerService.isAssigned(courseId, trainerId))) {
    throw new HttpError(400, 'Validation failed', {
      trainerId: 'Trainer must be assigned to this course first',
    });
  }
}

async function listClasses() {
  const { rows } = await pool.query(`${CLASS_SELECT} ORDER BY cl.scheduled_at DESC, cl.id DESC`);
  return rows.map(toClass);
}

async function getClass(id) {
  const { rows } = await pool.query(`${CLASS_SELECT} WHERE cl.id = $1`, [id]);
  if (!rows[0]) {
    throw new HttpError(404, 'Class not found');
  }
  return toClass(rows[0]);
}

async function createClass(input) {
  await checkCourseAndTrainer(input.courseId, input.trainerId);
  let created;
  try {
    const { rows } = await pool.query(
      `INSERT INTO classes (course_id, trainer_id, title, scheduled_at, meeting_link, status)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'scheduled'))
       RETURNING id`,
      [
        input.courseId,
        input.trainerId,
        input.title,
        input.scheduledAt,
        input.meetingLink ?? null,
        input.status ?? null,
      ]
    );
    created = await getClass(rows[0].id);
  } catch (err) {
    throw translateWriteError(err);
  }
  // After the commit; a failure here is logged and never fails the class.
  await classNotifications.classCreated(created);
  return created;
}

// Re-checks the trainer assignment only when the course or trainer changes,
// so a class keeps working if its trainer is later unassigned.
async function updateClass(id, changes) {
  const before = await getClass(id);
  if (changes.courseId !== undefined || changes.trainerId !== undefined) {
    await checkCourseAndTrainer(
      changes.courseId ?? before.courseId,
      changes.trainerId ?? before.trainerId
    );
  }

  const { assignments, params } = buildSetClause(WRITABLE_COLUMNS, changes);
  params.push(id);
  let rowCount;
  try {
    ({ rowCount } = await pool.query(
      `UPDATE classes SET ${assignments.join(', ')} WHERE id = $${params.length}`,
      params
    ));
  } catch (err) {
    throw translateWriteError(err);
  }
  if (rowCount === 0) {
    throw new HttpError(404, 'Class not found');
  }
  const after = await getClass(id);
  await classNotifications.classUpdated(before, after);
  return after;
}

async function deleteClass(id) {
  const { rowCount } = await pool.query('DELETE FROM classes WHERE id = $1', [id]);
  if (rowCount === 0) {
    throw new HttpError(404, 'Class not found');
  }
}

module.exports = {
  listClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
};
