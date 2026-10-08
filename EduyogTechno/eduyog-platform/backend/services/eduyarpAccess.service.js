const pool = require('../config/database');
const HttpError = require('../utils/httpError');

// Course access decisions for staff, always made from the database and never from
// ids or roles sent by the client.

// A Trainer's access to a course comes from course_trainers. The join on
// users.role means a demoted user's assignment stops counting immediately.
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

// actor is { id, role } (req.user). Admin may access any course; a Trainer only a
// course they are currently assigned to (403, as before); any other role never.
async function assertCourseAccess(actor, courseId) {
  if (actor.role === 'admin') return;
  if (actor.role === 'trainer' && (await isAssigned(courseId, actor.id))) return;
  throw new HttpError(403, 'You are not assigned to this course');
}

// Read access to a course's learning content (FAQs, resources): Admin; a Trainer
// currently assigned to the course; a Student with an active or completed enrolment.
// A cancelled or missing enrolment is a 404, like the Student course endpoints, so
// course ids reveal nothing. Role comes from the database user, so a former Student
// who is now a Trainer/Admin follows the Trainer/Admin rules, not their old enrolments.
async function assertCourseContentAccess(actor, courseId) {
  if (actor.role === 'student') {
    const { rows } = await pool.query(
      `SELECT 1 FROM enrolments e
       WHERE e.student_id = $1 AND e.course_id = $2 AND e.status IN ('active', 'completed')`,
      [actor.id, courseId]
    );
    if (rows.length === 0) throw new HttpError(404, 'Course not found in your enrolments');
    return;
  }
  await assertCourseAccess(actor, courseId);
}

module.exports = {
  isAssigned,
  assertCourseAccess,
  assertCourseContentAccess,
};
