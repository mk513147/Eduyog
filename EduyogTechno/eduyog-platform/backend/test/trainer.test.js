const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  createTestDatabase,
  startApi,
  createUser,
  client,
  createCourse,
  assign,
  enrol,
  completeTopics,
} = require('./helpers');

let db;
let api;
let call;
let t1;
let t2;
let admin;
let s1;
let s2;
let s3;
let s4;
let courseA;
let courseB;

const STUDENT_FIELDS = ['email', 'enrolledAt', 'enrolmentStatus', 'fullName', 'id', 'lastActivityAt', 'progress'];

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);

  t1 = await createUser(db.pool, { role: 'trainer', fullName: 'Trainer One' });
  t2 = await createUser(db.pool, { role: 'trainer', fullName: 'Trainer Two' });
  admin = await createUser(db.pool, { role: 'admin' });
  s1 = await createUser(db.pool, { fullName: 'Alice A' });
  s2 = await createUser(db.pool, { fullName: 'Bob B' });
  s3 = await createUser(db.pool, { fullName: 'Carol C' });
  s4 = await createUser(db.pool, { fullName: 'Dave D' });

  courseA = await createCourse(db.pool, { title: 'Course A' });
  courseB = await createCourse(db.pool, { title: 'Course B' });
  await assign(db.pool, courseA.id, t1.id);
  await assign(db.pool, courseB.id, t2.id);

  await enrol(db.pool, s1.id, courseA.id);
  await enrol(db.pool, s2.id, courseA.id);
  await enrol(db.pool, s3.id, courseB.id);
  await enrol(db.pool, s4.id, courseA.id, 'cancelled');
  await completeTopics(db.pool, s1.id, courseA.topicIds.slice(0, 2));
  await completeTopics(db.pool, s4.id, courseA.topicIds.slice(0, 1));

  // Private profile data that must never reach a Trainer.
  await db.pool.query(
    `INSERT INTO user_profiles (user_id, phone, institution, study_level, field_of_study, graduation_year, bio, avatar_url)
     VALUES ($1, '+91 98765 43210', 'Secret University', 'phd', 'Secret Field', 2030, 'Secret bio', 'https://example.com/secret.png')`,
    [s1.id]
  );

  // A class in each course.
  const when = new Date(Date.now() + 2 * 86400000).toISOString();
  await db.pool.query(
    "INSERT INTO classes (course_id, trainer_id, title, scheduled_at, meeting_link, status) VALUES ($1, $2, 'Class in A', $3, 'https://meet.example.com/a', 'scheduled')",
    [courseA.id, t1.id, when]
  );
  await db.pool.query(
    "INSERT INTO classes (course_id, trainer_id, title, scheduled_at, status) VALUES ($1, $2, 'Class in B', $3, 'scheduled')",
    [courseB.id, t2.id, when]
  );
});

after(async () => {
  await api.stop();
  await db.drop();
});

const get = (path, user) => call('GET', path, { token: user && user.token });

const ENDPOINTS = (c, studentId) => [
  '/api/eduyarp/trainer/courses',
  '/api/eduyarp/trainer/schedule',
  `/api/eduyarp/trainer/courses/${c.id}`,
  `/api/eduyarp/trainer/courses/${c.id}/students`,
  `/api/eduyarp/trainer/courses/${c.id}/students/${studentId}`,
];

test('unauthenticated requests are rejected (401)', async () => {
  for (const path of ENDPOINTS(courseA, s1.id)) {
    assert.equal((await get(path)).status, 401, path);
  }
});

test('a Student cannot use any Trainer endpoint (403)', async () => {
  for (const path of ENDPOINTS(courseA, s1.id)) {
    assert.equal((await get(path, s1)).status, 403, path);
  }
});

test('an Admin is not a Trainer: Trainer endpoints are Trainer-only (403)', async () => {
  for (const path of ENDPOINTS(courseA, s1.id)) {
    assert.equal((await get(path, admin)).status, 403, path);
  }
});

test('GET /courses lists only the Trainer\'s assigned courses, with correct counts', async () => {
  const res = await get('/api/eduyarp/trainer/courses', t1);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.courses.map((c) => c.title), ['Course A']);
  const a = res.body.courses[0];
  assert.equal(a.studentCount, 2, 'cancelled enrolments are not current students');
  assert.equal(a.upcomingClassCount, 1);
  assert.equal(a.nextClass.title, 'Class in A');
  assert.deepEqual(res.body.summary, { courseCount: 1, studentCount: 2, upcomingClassCount: 1 });
  const other = await get('/api/eduyarp/trainer/courses', t2);
  assert.deepEqual(other.body.courses.map((c) => c.title), ['Course B']);
  assert.equal(other.body.courses[0].studentCount, 1);
});

test('a Trainer with no courses gets an empty dashboard, not an error', async () => {
  const empty = await createUser(db.pool, { role: 'trainer' });
  const res = await get('/api/eduyarp/trainer/courses', empty);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { courses: [], summary: { courseCount: 0, studentCount: 0, upcomingClassCount: 0 } });
  assert.deepEqual((await get('/api/eduyarp/trainer/schedule', empty)).body.classes, []);
});

test('summary counts a student once even if they are in two assigned courses', async () => {
  const both = await createUser(db.pool, { role: 'trainer' });
  const x = await createCourse(db.pool, { title: 'Shared X' });
  const y = await createCourse(db.pool, { title: 'Shared Y' });
  await assign(db.pool, x.id, both.id);
  await assign(db.pool, y.id, both.id);
  const student = await createUser(db.pool);
  await enrol(db.pool, student.id, x.id);
  await enrol(db.pool, student.id, y.id);
  const res = await get('/api/eduyarp/trainer/courses', both);
  assert.equal(res.body.summary.courseCount, 2);
  assert.equal(res.body.summary.studentCount, 1);
});

test('schedule returns only classes of assigned courses', async () => {
  const res = await get('/api/eduyarp/trainer/schedule', t1);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.classes.map((c) => c.title), ['Class in A']);
  assert.equal(res.body.classes[0].courseTitle, 'Course A');
  assert.equal(res.body.classes[0].meetingLink, 'https://meet.example.com/a');
});

test('the existing course view still works for an assigned course (outline, classes, count only)', async () => {
  const res = await get(`/api/eduyarp/trainer/courses/${courseA.id}`, t1);
  assert.equal(res.status, 200);
  const c = res.body.course;
  assert.equal(c.title, 'Course A');
  assert.equal(c.enrolmentCount, 2);
  assert.equal(c.modules[0].topics.length, 3);
  assert.equal(c.classes.length, 1);
  assert.doesNotMatch(res.text, /@test\.example/, 'no student details in the course view');
});

test('a Trainer cannot open a course that is not assigned to them (403)', async () => {
  assert.equal((await get(`/api/eduyarp/trainer/courses/${courseB.id}`, t1)).status, 403);
  assert.equal((await get(`/api/eduyarp/trainer/courses/${courseA.id}`, t2)).status, 403);
});

test('a Trainer cannot list the students of another course (403)', async () => {
  const res = await get(`/api/eduyarp/trainer/courses/${courseB.id}/students`, t1);
  assert.equal(res.status, 403);
  assert.doesNotMatch(res.text, /Carol/);
});

test('students list: only current students of the assigned course', async () => {
  const res = await get(`/api/eduyarp/trainer/courses/${courseA.id}/students`, t1);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.students.map((s) => s.fullName), ['Alice A', 'Bob B']);
  assert.doesNotMatch(res.text, /Carol|Dave/, 'other courses and cancelled enrolments are excluded');
  const alice = res.body.students[0];
  assert.equal(alice.email, s1.email);
  assert.equal(alice.enrolmentStatus, 'active');
  assert.deepEqual(alice.progress, { completedTopics: 2, totalTopics: 3, percent: 67 });
  assert.ok(alice.lastActivityAt);
  assert.equal(res.body.students[1].progress.percent, 0);
});

test('students list shows completed students too', async () => {
  const c = await createCourse(db.pool, { title: 'Done course', topicCount: 2 });
  const trainer = await createUser(db.pool, { role: 'trainer' });
  await assign(db.pool, c.id, trainer.id);
  const student = await createUser(db.pool);
  await enrol(db.pool, student.id, c.id, 'completed');
  await completeTopics(db.pool, student.id, c.topicIds);
  const res = await get(`/api/eduyarp/trainer/courses/${c.id}/students`, trainer);
  assert.equal(res.body.students[0].enrolmentStatus, 'completed');
  assert.equal(res.body.students[0].progress.percent, 100);
});

test('private student fields are never returned to a Trainer', async () => {
  const list = await get(`/api/eduyarp/trainer/courses/${courseA.id}/students`, t1);
  const detail = await get(`/api/eduyarp/trainer/courses/${courseA.id}/students/${s1.id}`, t1);
  for (const res of [list, detail]) {
    assert.doesNotMatch(res.text, /Secret|98765|avatar|secret\.png|graduation|phone|institution|bio|password|hash/i);
  }
  for (const s of list.body.students) {
    assert.deepEqual(Object.keys(s).sort(), STUDENT_FIELDS);
  }
  assert.deepEqual(Object.keys(detail.body.student).sort(), STUDENT_FIELDS);
});

test('student detail: progress and per-topic completion', async () => {
  const res = await get(`/api/eduyarp/trainer/courses/${courseA.id}/students/${s1.id}`, t1);
  assert.equal(res.status, 200);
  assert.equal(res.body.student.fullName, 'Alice A');
  assert.equal(res.body.student.progress.percent, 67);
  const topics = res.body.modules[0].topics;
  assert.deepEqual(topics.map((t) => t.completed), [true, true, false]);
  assert.ok(topics[0].completedAt);
});

test('student detail is denied unless the student is currently enrolled in that course (404)', async () => {
  // Enrolled elsewhere, cancelled here, never enrolled, unknown id, a Trainer id.
  for (const studentId of [s3.id, s4.id, 999999, t2.id]) {
    const res = await get(`/api/eduyarp/trainer/courses/${courseA.id}/students/${studentId}`, t1);
    assert.equal(res.status, 404, String(studentId));
  }
});

test('student detail through an unassigned course is denied (403) whatever the student id', async () => {
  const res = await get(`/api/eduyarp/trainer/courses/${courseB.id}/students/${s3.id}`, t1);
  assert.equal(res.status, 403);
});

test('invalid ids are rejected (400)', async () => {
  assert.equal((await get('/api/eduyarp/trainer/courses/abc', t1)).status, 400);
  assert.equal((await get(`/api/eduyarp/trainer/courses/${courseA.id}/students/abc`, t1)).status, 400);
});

test('a missing course is a plain 403 for a Trainer (nothing leaks about whether it exists)', async () => {
  assert.equal((await get('/api/eduyarp/trainer/courses/999999', t1)).status, 403);
  assert.equal((await get('/api/eduyarp/trainer/courses/999999/students', t1)).status, 403);
});

test('unassigning a Trainer removes access immediately (same token)', async () => {
  const trainer = await createUser(db.pool, { role: 'trainer' });
  const c = await createCourse(db.pool, { title: 'Temp course' });
  await assign(db.pool, c.id, trainer.id);
  const student = await createUser(db.pool);
  await enrol(db.pool, student.id, c.id);
  assert.equal((await get(`/api/eduyarp/trainer/courses/${c.id}/students`, trainer)).status, 200);

  await db.pool.query('DELETE FROM course_trainers WHERE course_id = $1 AND trainer_id = $2', [c.id, trainer.id]);

  for (const path of [`/api/eduyarp/trainer/courses/${c.id}`, `/api/eduyarp/trainer/courses/${c.id}/students`, `/api/eduyarp/trainer/courses/${c.id}/students/${student.id}`]) {
    assert.equal((await get(path, trainer)).status, 403, path);
  }
  assert.deepEqual((await get('/api/eduyarp/trainer/courses', trainer)).body.courses, []);
  assert.deepEqual((await get('/api/eduyarp/trainer/schedule', trainer)).body.classes, []);
});

test('demoting a Trainer to Student removes Trainer access immediately', async () => {
  const trainer = await createUser(db.pool, { role: 'trainer' });
  const c = await createCourse(db.pool, { title: 'Demotion course' });
  await assign(db.pool, c.id, trainer.id);
  assert.equal((await get(`/api/eduyarp/trainer/courses/${c.id}`, trainer)).status, 200);

  const adminRes = await call('PATCH', `/api/admin/users/${trainer.id}/role`, { token: admin.token, body: { role: 'student' } });
  assert.equal(adminRes.status, 200);

  assert.equal((await get(`/api/eduyarp/trainer/courses/${c.id}`, trainer)).status, 403);
  assert.equal((await get('/api/eduyarp/trainer/courses', trainer)).status, 403);
  // Even the stale course_trainers row grants nothing to a Student.
  const { rowCount } = await db.pool.query('SELECT 1 FROM course_trainers WHERE course_id = $1 AND trainer_id = $2', [c.id, trainer.id]);
  assert.equal(rowCount, 1);
  assert.equal((await get(`/api/eduyarp/trainer/courses/${c.id}/students`, trainer)).status, 403);
});

test('a student who later becomes a Trainer is no longer listed as a student', async () => {
  const trainer = await createUser(db.pool, { role: 'trainer' });
  const c = await createCourse(db.pool, { title: 'Role change course', topicCount: 1 });
  await assign(db.pool, c.id, trainer.id);
  const person = await createUser(db.pool, { fullName: 'Former Student' });
  await enrol(db.pool, person.id, c.id);
  assert.equal((await get(`/api/eduyarp/trainer/courses/${c.id}/students`, trainer)).body.students.length, 1);
  await call('PATCH', `/api/admin/users/${person.id}/role`, { token: admin.token, body: { role: 'trainer' } });
  assert.equal((await get(`/api/eduyarp/trainer/courses/${c.id}/students`, trainer)).body.students.length, 0);
});

test('the access helper: Admin passes, assigned Trainer passes, others get 403', async () => {
  const { assertCourseAccess } = require('../services/eduyarpAccess.service');
  await assertCourseAccess({ id: admin.id, role: 'admin' }, courseA.id);
  await assertCourseAccess({ id: t1.id, role: 'trainer' }, courseA.id);
  await assert.rejects(assertCourseAccess({ id: t1.id, role: 'trainer' }, courseB.id), { status: 403 });
  await assert.rejects(assertCourseAccess({ id: s1.id, role: 'student' }, courseA.id), { status: 403 });
  await assert.rejects(assertCourseAccess({ id: t1.id, role: 'student' }, courseA.id), { status: 403 });
  require('../config/database').end();
});
