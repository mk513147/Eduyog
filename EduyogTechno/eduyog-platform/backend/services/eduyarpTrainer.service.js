const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS } = require('../utils/db');
const courseService = require('./eduyarpCourse.service');
const { CURRENT_ENROLMENT, PROGRESS_COLUMNS, toProgress } = require('./eduyarpEnrolment.service');
const { isAssigned, assertCourseAccess } = require('./eduyarpAccess.service');

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
// Access to a course is decided by course_trainers in the database (see
// eduyarpAccess.service), never by ids sent from the client. Students are only
// ever visible through a current (active or completed) enrolment in a course the
// Trainer is assigned to, and only with the fields below: no phone, academic
// details, bio or avatar.
// ---------------------------------------------------------------------------

// Classes that are still relevant: from the start of today onward, like the Student schedule.
const FROM_TODAY = "cl.scheduled_at >= date_trunc('day', now())";

function toClassSummary(row) {
  return {
    id: row.id,
    title: row.title,
    scheduledAt: row.scheduled_at,
    meetingLink: row.meeting_link,
    status: row.status,
  };
}

// The Trainer's assigned courses, each with its current student count and next
// class, plus totals across all of them (students counted once).
async function listTrainerCourses(trainerId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.slug, c.status, c.level, c.duration, c.cover_image_url, c.icon_url,
            (SELECT count(*) FROM enrolments e
               JOIN users s ON s.id = e.student_id AND s.role = 'student'
               WHERE e.course_id = c.id AND ${CURRENT_ENROLMENT}) AS student_count
     FROM course_trainers ct
     JOIN users u ON u.id = ct.trainer_id AND u.role = 'trainer'
     JOIN courses c ON c.id = ct.course_id
     WHERE ct.trainer_id = $1
     ORDER BY c.title, c.id`,
    [trainerId]
  );
  const courseIds = rows.map((row) => row.id);
  if (courseIds.length === 0) {
    return { courses: [], summary: { courseCount: 0, studentCount: 0, upcomingClassCount: 0 } };
  }

  const [{ rows: classRows }, { rows: studentRows }] = await Promise.all([
    pool.query(
      `SELECT cl.id, cl.course_id, cl.title, cl.scheduled_at, cl.meeting_link, cl.status
       FROM classes cl
       WHERE cl.course_id = ANY($1::bigint[]) AND cl.status = 'scheduled' AND ${FROM_TODAY}
       ORDER BY cl.scheduled_at, cl.id`,
      [courseIds]
    ),
    pool.query(
      `SELECT count(DISTINCT e.student_id) AS count
       FROM enrolments e
       JOIN users s ON s.id = e.student_id AND s.role = 'student'
       WHERE e.course_id = ANY($1::bigint[]) AND ${CURRENT_ENROLMENT}`,
      [courseIds]
    ),
  ]);

  const nextByCourse = new Map();
  const upcomingByCourse = new Map();
  for (const row of classRows) {
    if (!nextByCourse.has(row.course_id)) nextByCourse.set(row.course_id, toClassSummary(row));
    upcomingByCourse.set(row.course_id, (upcomingByCourse.get(row.course_id) ?? 0) + 1);
  }

  return {
    courses: rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      level: row.level,
      duration: row.duration,
      coverImageUrl: row.cover_image_url,
      iconUrl: row.icon_url,
      studentCount: Number(row.student_count),
      upcomingClassCount: upcomingByCourse.get(row.id) ?? 0,
      nextClass: nextByCourse.get(row.id) ?? null,
    })),
    summary: {
      courseCount: rows.length,
      studentCount: Number(studentRows[0].count),
      upcomingClassCount: classRows.length,
    },
  };
}

// Upcoming classes across the Trainer's assigned courses.
async function listTrainerSchedule(trainerId) {
  const { rows } = await pool.query(
    `SELECT cl.id, cl.title, cl.scheduled_at, cl.meeting_link, cl.status,
            c.id AS course_id, c.title AS course_title, t.full_name AS trainer_name
     FROM course_trainers ct
     JOIN users u ON u.id = ct.trainer_id AND u.role = 'trainer'
     JOIN classes cl ON cl.course_id = ct.course_id
     JOIN courses c ON c.id = cl.course_id
     JOIN users t ON t.id = cl.trainer_id
     WHERE ct.trainer_id = $1 AND ${FROM_TODAY}
     ORDER BY cl.scheduled_at, cl.id`,
    [trainerId]
  );
  return rows.map((row) => ({
    ...toClassSummary(row),
    courseId: row.course_id,
    courseTitle: row.course_title,
    trainerName: row.trainer_name,
  }));
}

// Read-only view of one assigned course: outline, classes and the number of
// enrolled students (no student details; see listCourseStudents for those).
async function getTrainerCourse(actor, courseId) {
  await assertCourseAccess(actor, courseId);
  const course = await courseService.findCourse(courseId);
  if (!course) {
    throw new HttpError(404, 'Course not found');
  }
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
    modules: await courseService.getOutline(courseId, { includeVideo: true }),
    classes: classRows.map((row) => ({
      ...toClassSummary(row),
      trainerName: row.trainer_name,
    })),
  };
}

const STUDENT_SELECT = `
  SELECT s.id, s.full_name, s.email,
         e.id AS enrolment_id, e.status AS enrolment_status, e.enrolled_at,
         (SELECT max(p.completed_at) FROM topic_progress p
            JOIN course_topics t ON t.id = p.topic_id
            JOIN course_modules m ON m.id = t.module_id
            WHERE m.course_id = e.course_id AND p.student_id = e.student_id AND p.completed) AS last_activity_at,
         ${PROGRESS_COLUMNS}
  FROM enrolments e
  JOIN users s ON s.id = e.student_id AND s.role = 'student'
  WHERE e.course_id = $1 AND ${CURRENT_ENROLMENT}`;

// The only student fields a Trainer can see.
function toTrainerStudent(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    enrolmentStatus: row.enrolment_status,
    enrolledAt: row.enrolled_at,
    lastActivityAt: row.last_activity_at,
    progress: toProgress(row),
  };
}

// Current students of a course the actor may access (cancelled enrolments are history only).
async function listCourseStudents(actor, courseId) {
  await assertCourseAccess(actor, courseId);
  const { rows } = await pool.query(`${STUDENT_SELECT} ORDER BY s.full_name, s.id`, [courseId]);
  return rows.map(toTrainerStudent);
}

// One current student of a course the actor may access, with per-topic completion.
// 404 when that student is not currently enrolled, so ids cannot be probed.
async function getCourseStudent(actor, courseId, studentId) {
  await assertCourseAccess(actor, courseId);
  const { rows } = await pool.query(`${STUDENT_SELECT} AND s.id = $2`, [courseId, studentId]);
  if (!rows[0]) {
    throw new HttpError(404, 'Student not found in this course');
  }
  return {
    student: toTrainerStudent(rows[0]),
    modules: await courseService.getOutline(courseId, { studentId }),
  };
}

module.exports = {
  listTrainers,
  assignTrainer,
  unassignTrainer,
  isAssigned,
  listTrainerCourses,
  listTrainerSchedule,
  getTrainerCourse,
  listCourseStudents,
  getCourseStudent,
};
