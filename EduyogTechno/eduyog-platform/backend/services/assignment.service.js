const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS, buildSetClause } = require('../utils/db');
const { assertCourseAccess, assertCourseContentAccess, isAssigned } = require('./eduyarpAccess.service');
const { checkLinks } = require('./courseContent.service');
const notifications = require('./notification.service');

// Assignments, text/URL submissions and written feedback (no files, no grades).
//
//   Admin    - every course.
//   Trainer  - courses they are CURRENTLY assigned to: manage assignments, read
//              submissions, write feedback. Having created an assignment earlier
//              gives no access once the assignment to the course ends.
//   Student  - published and closed assignments of courses with an active or completed
//              enrolment; may submit (again) while the assignment is published.
// Every decision is made here from the database, never from ids or roles in the request.

const ASSIGNMENT_SELECT = `
  SELECT a.*, m.title AS module_title, t.title AS topic_title, u.full_name AS created_by_name
  FROM assignments a
  JOIN users u ON u.id = a.created_by
  LEFT JOIN course_modules m ON m.id = a.module_id
  LEFT JOIN course_topics t ON t.id = a.topic_id`;

const WRITABLE = {
  title: 'title',
  instructions: 'instructions',
  dueAt: 'due_at',
  status: 'status',
  moduleId: 'module_id',
  topicId: 'topic_id',
  displayOrder: 'display_order',
};

function toAssignment(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    moduleId: row.module_id,
    moduleTitle: row.module_title,
    topicId: row.topic_id,
    topicTitle: row.topic_title,
    title: row.title,
    instructions: row.instructions,
    dueAt: row.due_at,
    status: row.status,
    displayOrder: row.display_order,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFeedback(row) {
  if (!row || row.feedback_id == null) return null;
  return {
    text: row.feedback_text,
    authorName: row.feedback_author_name,
    updatedAt: row.feedback_updated_at,
  };
}

function toSubmission(row) {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    text: row.text_content,
    url: row.submission_url,
    submittedAt: row.submitted_at,
    isLate: row.is_late,
    feedback: toFeedback(row),
  };
}

const SUBMISSION_SELECT = `
  SELECT s.*, f.id AS feedback_id, f.feedback_text, f.updated_at AS feedback_updated_at,
         fa.full_name AS feedback_author_name
  FROM assignment_submissions s
  LEFT JOIN assignment_feedback f ON f.submission_id = s.id
  LEFT JOIN users fa ON fa.id = f.author_id`;

async function assertCourseExists(courseId) {
  const { rows } = await pool.query('SELECT 1 FROM courses WHERE id = $1', [courseId]);
  if (rows.length === 0) throw new HttpError(404, 'Course not found');
}

function translateError(err) {
  if (err.code === PG_ERRORS.CHECK_VIOLATION) return new HttpError(400, 'Assignment data is invalid');
  return err;
}

async function getAssignmentRow(id) {
  const { rows } = await pool.query(`${ASSIGNMENT_SELECT} WHERE a.id = $1`, [id]);
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Admin and Trainer
// ---------------------------------------------------------------------------

// A Trainer reaches an assignment only through a course they are assigned to right now;
// anything else (no such id, another course) is a 404 so ids cannot be probed.
async function loadManageable(actor, id) {
  const row = await getAssignmentRow(id);
  if (!row) throw new HttpError(404, 'Assignment not found');
  if (actor.role !== 'admin' && !(actor.role === 'trainer' && (await isAssigned(row.course_id, actor.id)))) {
    throw new HttpError(404, 'Assignment not found');
  }
  return row;
}

async function listForCourse(actor, courseId) {
  await assertCourseAccess(actor, courseId);
  if (actor.role === 'admin') await assertCourseExists(courseId);
  const { rows } = await pool.query(
    `${ASSIGNMENT_SELECT.replace(
      'SELECT a.*,',
      `SELECT a.*,
         (SELECT count(DISTINCT s.student_id)::int FROM assignment_submissions s WHERE s.assignment_id = a.id) AS student_count,
         (SELECT count(*)::int FROM assignment_submissions s WHERE s.assignment_id = a.id) AS submission_count,`
    )}
     WHERE a.course_id = $1 ORDER BY a.display_order, a.id`,
    [courseId]
  );
  return rows.map((row) => ({ ...toAssignment(row), studentCount: row.student_count, submissionCount: row.submission_count }));
}

async function create(actor, courseId, input) {
  await assertCourseAccess(actor, courseId);
  await assertCourseExists(courseId);
  await checkLinks(courseId, input.moduleId, input.topicId);
  try {
    const { rows } = await pool.query(
      `INSERT INTO assignments
         (course_id, module_id, topic_id, title, instructions, due_at, status, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'draft'), COALESCE($8::integer,
         (SELECT COALESCE(MAX(display_order), 0) + 1 FROM assignments WHERE course_id = $1)), $9)
       RETURNING id`,
      [
        courseId,
        input.moduleId ?? null,
        input.topicId ?? null,
        input.title,
        input.instructions,
        input.dueAt ?? null,
        input.status ?? null,
        input.displayOrder ?? null,
        actor.id,
      ]
    );
    return toAssignment(await getAssignmentRow(rows[0].id));
  } catch (err) {
    throw translateError(err);
  }
}

async function get(actor, id) {
  return toAssignment(await loadManageable(actor, id));
}

async function update(actor, id, changes) {
  const current = await loadManageable(actor, id);
  if (changes.moduleId !== undefined || changes.topicId !== undefined) {
    let moduleId = changes.moduleId !== undefined ? changes.moduleId : current.module_id;
    const topicId = changes.topicId !== undefined ? changes.topicId : current.topic_id;
    // Choosing a topic without naming a module: the topic decides the module.
    if (changes.topicId && changes.moduleId === undefined) moduleId = null;
    await checkLinks(current.course_id, moduleId, topicId);
    changes.moduleId = moduleId;
    changes.topicId = topicId;
  }
  const { assignments, params } = buildSetClause(WRITABLE, changes);
  params.push(id);
  try {
    await pool.query(`UPDATE assignments SET ${assignments.join(', ')} WHERE id = $${params.length}`, params);
  } catch (err) {
    throw translateError(err);
  }
  return toAssignment(await getAssignmentRow(id));
}

// Submissions and feedback of the assignment go with it.
async function remove(actor, id) {
  await loadManageable(actor, id);
  await pool.query('DELETE FROM assignments WHERE id = $1', [id]);
}

// One row per student: their latest submission, how many they made, and whether it has feedback.
async function listSubmissions(actor, assignmentId) {
  const assignment = await loadManageable(actor, assignmentId);
  const { rows } = await pool.query(
    `SELECT s.id, s.student_id, s.submitted_at, s.is_late, s.text_content, s.submission_url,
            u.full_name, u.email, (f.id IS NOT NULL) AS has_feedback,
            (SELECT count(*)::int FROM assignment_submissions x
               WHERE x.assignment_id = s.assignment_id AND x.student_id = s.student_id) AS attempts
     FROM (SELECT DISTINCT ON (student_id) *
           FROM assignment_submissions WHERE assignment_id = $1
           ORDER BY student_id, submitted_at DESC, id DESC) s
     JOIN users u ON u.id = s.student_id
     LEFT JOIN assignment_feedback f ON f.submission_id = s.id
     ORDER BY s.submitted_at DESC, s.id DESC`,
    [assignmentId]
  );
  return {
    assignment: toAssignment(assignment),
    submissions: rows.map((row) => ({
      id: row.id,
      studentName: row.full_name,
      studentEmail: row.email,
      submittedAt: row.submitted_at,
      isLate: row.is_late,
      attempts: row.attempts,
      hasFeedback: row.has_feedback,
      preview: row.text_content ? row.text_content.slice(0, 160) : null,
      hasUrl: row.submission_url !== null,
    })),
  };
}

async function loadSubmissionFor(actor, submissionId) {
  const { rows } = await pool.query('SELECT assignment_id, student_id FROM assignment_submissions WHERE id = $1', [submissionId]);
  if (!rows[0]) throw new HttpError(404, 'Submission not found');
  try {
    const assignment = await loadManageable(actor, rows[0].assignment_id);
    return { assignment, studentId: rows[0].student_id };
  } catch (err) {
    if (err.status === 404) throw new HttpError(404, 'Submission not found');
    throw err;
  }
}

// One submission with the student's earlier submissions for the same assignment.
async function getSubmission(actor, submissionId) {
  const { assignment, studentId } = await loadSubmissionFor(actor, submissionId);
  const student = await pool.query('SELECT full_name, email FROM users WHERE id = $1', [studentId]);
  const { rows } = await pool.query(
    `${SUBMISSION_SELECT} WHERE s.assignment_id = $1 AND s.student_id = $2 ORDER BY s.submitted_at DESC, s.id DESC`,
    [assignment.id, studentId]
  );
  const history = rows.map(toSubmission);
  return {
    assignment: toAssignment(assignment),
    student: { name: student.rows[0].full_name, email: student.rows[0].email },
    submission: history.find((s) => String(s.id) === String(submissionId)),
    history,
  };
}

// One current feedback per submission; writing again replaces the text.
async function setFeedback(actor, submissionId, text) {
  await loadSubmissionFor(actor, submissionId);
  await pool.query(
    `INSERT INTO assignment_feedback (submission_id, author_id, feedback_text)
     VALUES ($1, $2, $3)
     ON CONFLICT (submission_id) DO UPDATE SET feedback_text = EXCLUDED.feedback_text, author_id = EXCLUDED.author_id`,
    [submissionId, actor.id, text]
  );
  const { rows } = await pool.query(`${SUBMISSION_SELECT} WHERE s.id = $1`, [submissionId]);
  return toSubmission(rows[0]);
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

const CURRENT_ENROLMENT_FOR_STUDENT = `EXISTS (
  SELECT 1 FROM enrolments e
  WHERE e.course_id = a.course_id AND e.student_id = $2 AND e.status IN ('active', 'completed'))`;

function assertStudent(user) {
  if (user.role !== 'student') throw new HttpError(403, 'Only students can use this');
}

// Draft assignments, other courses and cancelled enrolments all look like "not found".
async function loadForStudent(user, id, { lock = false, db = pool } = {}) {
  assertStudent(user);
  const { rows } = await db.query(
    `SELECT a.id FROM assignments a
     WHERE a.id = $1 AND a.status IN ('published', 'closed') AND ${CURRENT_ENROLMENT_FOR_STUDENT}
     ${lock ? 'FOR SHARE OF a' : ''}`,
    [id, user.id]
  );
  if (!rows[0]) throw new HttpError(404, 'Assignment not found');
  const full = await db.query(`${ASSIGNMENT_SELECT} WHERE a.id = $1`, [id]);
  return full.rows[0];
}

async function listForStudent(user, courseId) {
  assertStudent(user);
  await assertCourseContentAccess(user, courseId);
  const { rows } = await pool.query(
    `${ASSIGNMENT_SELECT.replace(
      'SELECT a.*,',
      `SELECT a.*, ls.id AS latest_id, ls.submitted_at AS latest_at, ls.is_late AS latest_late,
         (SELECT count(*)::int FROM assignment_submissions c WHERE c.assignment_id = a.id AND c.student_id = $2) AS attempts,
         EXISTS (SELECT 1 FROM assignment_submissions fs JOIN assignment_feedback ff ON ff.submission_id = fs.id
                 WHERE fs.assignment_id = a.id AND fs.student_id = $2) AS has_feedback,`
    )}
     LEFT JOIN LATERAL (
       SELECT s.id, s.submitted_at, s.is_late FROM assignment_submissions s
       WHERE s.assignment_id = a.id AND s.student_id = $2
       ORDER BY s.submitted_at DESC, s.id DESC LIMIT 1) ls ON TRUE
     WHERE a.course_id = $1 AND a.status IN ('published', 'closed')
     ORDER BY a.display_order, a.id`,
    [courseId, user.id]
  );
  return rows.map((row) => ({
    ...toAssignment(row),
    attempts: row.attempts,
    hasFeedback: row.has_feedback,
    latestSubmission: row.latest_id ? { id: row.latest_id, submittedAt: row.latest_at, isLate: row.latest_late } : null,
  }));
}

// The assignment, the student's own submissions (newest first = current first) and feedback.
async function getForStudent(user, id) {
  const row = await loadForStudent(user, id);
  const { rows } = await pool.query(
    `${SUBMISSION_SELECT} WHERE s.assignment_id = $1 AND s.student_id = $2 ORDER BY s.submitted_at DESC, s.id DESC`,
    [id, user.id]
  );
  return { ...toAssignment(row), canSubmit: row.status === 'published', submissions: rows.map(toSubmission) };
}

// A new row each time. The assignment row is locked so a submission cannot slip in while it is
// being closed. Lateness is set by the database from the due date.
async function submit(user, id, input) {
  assertStudent(user);
  const client = await pool.connect();
  let assignment;
  let submission;
  try {
    await client.query('BEGIN');
    assignment = await loadForStudent(user, id, { lock: true, db: client });
    if (assignment.status !== 'published') {
      throw new HttpError(409, 'This assignment is closed and no longer accepts submissions');
    }
    const { rows } = await client.query(
      `INSERT INTO assignment_submissions (assignment_id, student_id, text_content, submission_url)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [id, user.id, input.text ?? null, input.url ?? null]
    );
    const result = await client.query(`${SUBMISSION_SELECT} WHERE s.id = $1`, [rows[0].id]);
    submission = toSubmission(result.rows[0]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err.code === PG_ERRORS.CHECK_VIOLATION ? new HttpError(400, 'Submission is invalid') : err;
  } finally {
    client.release();
  }
  await notifyTrainers(user, assignment, submission);
  return submission;
}

// After the commit and best effort: a failure is logged and the submission stays saved.
async function notifyTrainers(student, assignment, submission) {
  try {
    const trainerIds = await notifications.assignedTrainerIds(pool, assignment.course_id);
    await notifications.createNotificationsForUsers(pool, trainerIds, {
      type: notifications.TYPES.ASSIGNMENT_SUBMISSION,
      title: 'New assignment submission',
      body: `${student.fullName} submitted ${assignment.title}${submission.isLate ? ' (late)' : ''}`,
      courseId: assignment.course_id,
      linkPath: `/trainer/courses/${assignment.course_id}/assignments/${assignment.id}?submission=${submission.id}`,
    });
  } catch (err) {
    console.error('[notifications] Could not create assignment_submission notifications; the submission was saved.', err);
  }
}

module.exports = {
  listForCourse,
  create,
  get,
  update,
  remove,
  listSubmissions,
  getSubmission,
  setFeedback,
  listForStudent,
  getForStudent,
  submit,
};
