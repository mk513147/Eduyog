const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS } = require('../utils/db');
const courseService = require('./eduyarpCourse.service');
const certificateService = require('./certificate.service');

// Enrolments that give course access, for an enrolment aliased "e".
// 'cancelled' enrolments are history only: no access, never re-derived.
const CURRENT_ENROLMENT = "e.status IN ('active', 'completed')";

// Topic counts for an enrolment aliased "e". Progress is
// completed topics / total topics in the course.
const PROGRESS_COLUMNS = `
  (SELECT count(*) FROM course_topics t JOIN course_modules m ON m.id = t.module_id
     WHERE m.course_id = e.course_id) AS total_topics,
  (SELECT count(*) FROM topic_progress p
     JOIN course_topics t ON t.id = p.topic_id
     JOIN course_modules m ON m.id = t.module_id
     WHERE m.course_id = e.course_id AND p.student_id = e.student_id AND p.completed) AS completed_topics`;

function toProgress(row) {
  const totalTopics = Number(row.total_topics);
  const completedTopics = Number(row.completed_topics);
  return {
    completedTopics,
    totalTopics,
    percent: totalTopics === 0 ? 0 : Math.round((completedTopics / totalTopics) * 100),
  };
}

// 'completed' once every topic is done, otherwise 'active'.
const STATUS_FROM_PROGRESS = `
  CASE WHEN total_topics > 0 AND completed_topics = total_topics THEN 'completed' ELSE 'active' END`;

// Completion is a one-way door. An 'active' enrolment becomes 'completed' when every topic is done (also
// when a topic is deleted and that finishes it); a 'completed' enrolment NEVER goes back to 'active', and
// 'cancelled' ones are history. So a curriculum change (a topic added, edited or removed) cannot reopen a
// finished course, cannot raise anyone's number of active enrolments (the one-active-course rule stays
// valid), and cannot discard the completion. Progress is still counted against the current curriculum, so a
// completed student can see a percentage below 100 after new topics are added and may complete them.
// Reaching completion creates a certificate REQUEST only, never a certificate.
//
// The enrolment rows are locked before the topics are counted, so a concurrent topic completion or
// curriculum change is either fully included or runs after this and re-derives. queryable must be a
// transaction client (syncCourseStatuses opens one).
async function syncStatuses(courseId, queryable) {
  await queryable.query(
    "SELECT id FROM enrolments WHERE course_id = $1 AND status = 'active' ORDER BY id FOR UPDATE",
    [courseId]
  );
  const { rows } = await queryable.query(
    `UPDATE enrolments SET status = 'completed'
     FROM (
       SELECT id, ${STATUS_FROM_PROGRESS} AS status
       FROM (
         SELECT e.id, ${PROGRESS_COLUMNS} FROM enrolments e
         WHERE e.course_id = $1 AND e.status = 'active'
       ) counts
     ) s
     WHERE enrolments.id = s.id AND enrolments.status = 'active' AND s.status = 'completed'
     RETURNING enrolments.id, enrolments.status`,
    [courseId]
  );
  // Enrolments that have just become completed get a certificate REQUEST for an Admin to review (same
  // transaction when queryable is one). Ones that were already completed are left as they are.
  await certificateService.requestForEnrolments(
    queryable,
    rows.filter((r) => r.status === 'completed').map((r) => r.id)
  );
}

// Standalone calls (curriculum edits) run status changes and certificate issuing as one transaction;
// callers that pass their own transaction client keep using it.
async function syncCourseStatuses(courseId, queryable = pool) {
  if (queryable !== pool) return syncStatuses(courseId, queryable);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await syncStatuses(courseId, client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function toEnrolment(row) {
  return {
    id: row.enrolment_id,
    status: row.enrolment_status,
    enrolledAt: row.enrolled_at,
    progress: toProgress(row),
  };
}

// ---------------------------------------------------------------------------
// Student
//
// Every query is scoped by studentId, which callers take from req.user.id.
// ---------------------------------------------------------------------------

// Full-course access is granted by an Admin (students cannot enrol themselves; demo access to the first
// two topics is separate and creates no enrolment: eduyarpDemo.service.js). Granting creates an
// ordinary 'active' enrolment, so every existing access check, progress and certificate rule applies
// unchanged; revoking cancels it (cancelEnrolment), keeping history and topic progress.
//
// Rules, all decided inside one transaction that locks the student's user row (so two concurrent
// grants for the same student queue up and the second sees the first):
//   * the student must exist, be a Student and have an approved account;
//   * the course must be published;
//   * one ACTIVE course at a time: a new grant is refused while the student has another 'active'
//     enrolment. 'completed' and 'cancelled' ones do not count. Students who already hold several
//     active enrolments keep them (nothing is cancelled or rewritten); they simply cannot be
//     granted another until they are down to none.
async function grantAccess(adminId, studentId, courseId) {
  const course = await courseService.findCourse(courseId);
  if (!course || course.status !== 'published') {
    throw new HttpError(404, 'Course not found');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: users } = await client.query(
      'SELECT id, role, approval_status FROM users WHERE id = $1 FOR UPDATE',
      [studentId]
    );
    if (!users[0] || users[0].role !== 'student') {
      throw new HttpError(404, 'Student not found');
    }
    if (users[0].approval_status !== 'approved') {
      throw new HttpError(409, 'The student\'s registration has not been approved');
    }
    const { rows: current } = await client.query(
      "SELECT course_id, status FROM enrolments WHERE student_id = $1 AND status IN ('active', 'completed')",
      [studentId]
    );
    if (current.some((row) => String(row.course_id) === String(courseId))) {
      throw new HttpError(409, 'The student already has access to this course');
    }
    if (current.some((row) => row.status === 'active')) {
      throw new HttpError(409, 'The student already has an active course. Revoke it or wait for them to complete it first.');
    }
    const { rows } = await client.query(
      'INSERT INTO enrolments (course_id, student_id, granted_by) VALUES ($1, $2, $3) RETURNING id',
      [courseId, studentId, adminId]
    );
    // Earlier topic progress is kept, so the status is derived straight away.
    await syncStatuses(courseId, client);
    const { rows: enrolled } = await client.query(
      'SELECT id, course_id, student_id, status, enrolled_at FROM enrolments WHERE id = $1',
      [rows[0].id]
    );
    await client.query('COMMIT');
    return {
      id: enrolled[0].id,
      courseId: enrolled[0].course_id,
      studentId: enrolled[0].student_id,
      status: enrolled[0].status,
      enrolledAt: enrolled[0].enrolled_at,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === PG_ERRORS.UNIQUE_VIOLATION && err.constraint === 'enrolments_student_course_key') {
      throw new HttpError(409, 'The student already has access to this course');
    }
    throw err;
  } finally {
    client.release();
  }
}

const STUDENT_COURSE_SELECT = `
  SELECT c.id, c.title, c.slug, c.description, c.learning_objectives, c.duration, c.level,
         c.fee, c.status, c.cover_image_url, c.icon_url, c.created_at, c.updated_at,
         e.id AS enrolment_id, e.status AS enrolment_status, e.enrolled_at,
         ${PROGRESS_COLUMNS}
  FROM enrolments e
  JOIN courses c ON c.id = e.course_id`;

function toStudentCourse(row) {
  const course = courseService.toCourse(row);
  delete course.createdAt;
  delete course.updatedAt;
  return { ...course, enrolment: toEnrolment(row) };
}

async function listStudentCourses(studentId) {
  const { rows } = await pool.query(
    `${STUDENT_COURSE_SELECT}
     WHERE e.student_id = $1 AND ${CURRENT_ENROLMENT}
     ORDER BY e.enrolled_at DESC, e.id DESC`,
    [studentId]
  );
  return rows.map(toStudentCourse);
}

// 404 (not 403) when the student has no current enrolment (none, or only a
// cancelled one), so course ids of other students' enrolments reveal nothing.
async function getStudentCourse(studentId, courseId) {
  const { rows } = await pool.query(
    `${STUDENT_COURSE_SELECT}
     WHERE e.student_id = $1 AND e.course_id = $2 AND ${CURRENT_ENROLMENT}`,
    [studentId, courseId]
  );
  if (!rows[0]) {
    throw new HttpError(404, 'Course not found in your enrolments');
  }
  const trainers = await courseService.getTrainersByCourse([courseId]);
  return {
    ...toStudentCourse(rows[0]),
    trainers: trainers.get(String(courseId)),
    modules: await courseService.getOutline(courseId, { studentId, includeVideo: true }),
    certificate: await certificateService.findForStudentCourse(studentId, courseId),
    certificateRequest: await certificateService.findRequestForStudentCourse(studentId, courseId),
  };
}

// Marks a topic complete for the student and recalculates course progress.
// The topic must belong to a course the student is enrolled in. Completing
// an already completed topic is a no-op that returns the current progress.
async function completeTopic(studentId, topicId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Locks the enrolment so concurrent completions update status in turn.
    const { rows: enrolmentRows } = await client.query(
      `SELECT e.id, e.status
       FROM course_topics t
       JOIN course_modules m ON m.id = t.module_id
       JOIN enrolments e ON e.course_id = m.course_id AND e.student_id = $2
       WHERE t.id = $1 AND ${CURRENT_ENROLMENT}
       FOR UPDATE OF e`,
      [topicId, studentId]
    );
    if (!enrolmentRows[0]) {
      throw new HttpError(404, 'Topic not found in your enrolled courses');
    }
    const enrolmentId = enrolmentRows[0].id;
    const statusBefore = enrolmentRows[0].status;

    let progressRows;
    try {
      ({ rows: progressRows } = await client.query(
      `INSERT INTO topic_progress (student_id, topic_id, completed, completed_at)
       VALUES ($1, $2, TRUE, now())
       ON CONFLICT (student_id, topic_id)
       DO UPDATE SET completed = TRUE,
                     completed_at = COALESCE(topic_progress.completed_at, EXCLUDED.completed_at)
       RETURNING completed_at`,
      [studentId, topicId]
      ));
    } catch (err) {
      // The topic was deleted between the lookup and the insert.
      if (err.code === PG_ERRORS.FOREIGN_KEY_VIOLATION) throw new HttpError(404, 'Topic not found in your enrolled courses');
      throw err;
    }

    const { rows } = await client.query(
      `UPDATE enrolments SET status = CASE WHEN enrolments.status = 'completed' THEN 'completed' ELSE counts.status END
       FROM (
         SELECT e.id, total_topics, completed_topics, ${STATUS_FROM_PROGRESS} AS status
         FROM (SELECT e.id, ${PROGRESS_COLUMNS} FROM enrolments e WHERE e.id = $1) e
       ) counts
       WHERE enrolments.id = counts.id
       RETURNING counts.total_topics, counts.completed_topics, enrolments.status`,
      [enrolmentId]
    );
    const progress = toProgress(rows[0]);
    const { status } = rows[0];

    // Reaching completion creates the certificate request in the same transaction; if that fails the
    // whole completion rolls back instead of leaving a completed course without one.
    if (status === 'completed' && statusBefore !== 'completed') {
      await certificateService.requestForEnrolments(client, [enrolmentId]);
    }
    const courseRow = await client.query('SELECT course_id FROM enrolments WHERE id = $1', [enrolmentId]);
    const courseId = courseRow.rows[0].course_id;
    const certificate = status === 'completed' ? await certificateService.findForStudentCourse(studentId, courseId, client) : null;
    const certificateRequest =
      status === 'completed' ? await certificateService.findRequestForStudentCourse(studentId, courseId, client) : null;

    await client.query('COMMIT');
    return {
      topicId: String(topicId),
      completed: true,
      completedAt: progressRows[0].completed_at,
      enrolmentStatus: status,
      progress,
      certificate,
      certificateRequest,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Classes of the student's enrolled courses, from the start of today onward,
// so a class that has just started is still listed.
async function getStudentSchedule(studentId) {
  const { rows } = await pool.query(
    `SELECT cl.id, cl.title, cl.scheduled_at, cl.meeting_link, cl.status,
            c.id AS course_id, c.title AS course_title, u.full_name AS trainer_name
     FROM classes cl
     JOIN enrolments e ON e.course_id = cl.course_id AND e.student_id = $1 AND ${CURRENT_ENROLMENT}
     JOIN courses c ON c.id = cl.course_id
     JOIN users u ON u.id = cl.trainer_id
     WHERE cl.scheduled_at >= date_trunc('day', now())
     ORDER BY cl.scheduled_at, cl.id`,
    [studentId]
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    scheduledAt: row.scheduled_at,
    meetingLink: row.meeting_link,
    status: row.status,
    courseId: row.course_id,
    courseTitle: row.course_title,
    trainerName: row.trainer_name,
  }));
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const ADMIN_ENROLMENT_SELECT = `
  SELECT e.id AS enrolment_id, e.status AS enrolment_status, e.enrolled_at,
         u.id AS student_id, u.full_name AS student_name, u.email AS student_email,
         c.id AS course_id, c.title AS course_title,
         ${PROGRESS_COLUMNS}
  FROM enrolments e
  JOIN users u ON u.id = e.student_id
  JOIN courses c ON c.id = e.course_id`;

function toAdminEnrolment(row) {
  return {
    ...toEnrolment(row),
    student: { id: row.student_id, fullName: row.student_name, email: row.student_email },
    course: { id: row.course_id, title: row.course_title },
  };
}

// Includes cancelled enrolments, with the progress the student had.
async function listEnrolments() {
  const { rows } = await pool.query(
    `${ADMIN_ENROLMENT_SELECT}
     ORDER BY e.enrolled_at DESC, e.id DESC`
  );
  return rows.map(toAdminEnrolment);
}

// Admin cancellation of one active enrolment. A single conditional UPDATE, so
// a completed or already cancelled enrolment can never be changed. Topic
// progress is not touched.
async function cancelEnrolment(id) {
  const { rowCount } = await pool.query(
    "UPDATE enrolments SET status = 'cancelled' WHERE id = $1 AND status = 'active'",
    [id]
  );
  const { rows } = await pool.query(`${ADMIN_ENROLMENT_SELECT} WHERE e.id = $1`, [id]);
  if (!rows[0]) {
    throw new HttpError(404, 'Enrolment not found');
  }
  if (rowCount === 0) {
    throw new HttpError(409, `Only active enrolments can be cancelled; this one is ${rows[0].enrolment_status}`);
  }
  return toAdminEnrolment(rows[0]);
}

// Called inside the role-change transaction when a Student becomes a Trainer
// or Admin. Only active enrolments change; completed and already cancelled
// ones, and all topic progress, are kept.
async function cancelActiveEnrolments(studentId, client) {
  await client.query(
    "UPDATE enrolments SET status = 'cancelled' WHERE student_id = $1 AND status = 'active'",
    [studentId]
  );
}

module.exports = {
  CURRENT_ENROLMENT,
  PROGRESS_COLUMNS,
  toProgress,
  syncCourseStatuses,
  cancelActiveEnrolments,
  grantAccess,
  listStudentCourses,
  getStudentCourse,
  completeTopic,
  getStudentSchedule,
  listEnrolments,
  cancelEnrolment,
};
