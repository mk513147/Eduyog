// Curriculum changes and enrolment status. Completion is a one-way door: a topic added, edited or removed
// never reopens a completed enrolment, never raises the number of active enrolments, never discards
// progress, and never issues a certificate (at most a pending request). Concurrent completion and
// curriculum changes must leave consistent statuses.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client, createCourse, enrol } = require('./helpers');

let db;
let api;
let call;
let admin;

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin' });
});

after(async () => {
  await api.stop();
  await db.drop();
});

const adminCall = (method, path, body) => call(method, `/api/admin/eduyarp${path}`, { token: admin.token, body });
const complete = (user, topicId) => call('POST', `/api/eduyarp/topics/${topicId}/complete`, { token: user.token });
const view = (user, course) => call('GET', `/api/eduyarp/me/courses/${course.id}`, { token: user.token });
const statusOf = async (user, course) =>
  (await db.pool.query('SELECT status FROM enrolments WHERE student_id = $1 AND course_id = $2 ORDER BY id DESC LIMIT 1', [user.id, course.id])).rows[0]?.status;
const certs = async (user) => (await db.pool.query('SELECT id FROM certificates WHERE student_id = $1', [user.id])).rows;
const requests = async (user) => (await db.pool.query('SELECT status FROM certificate_requests WHERE student_id = $1 ORDER BY id', [user.id])).rows;
const progressRows = async (user) => (await db.pool.query('SELECT topic_id FROM topic_progress WHERE student_id = $1 AND completed', [user.id])).rows.length;
const addTopic = (course, title = 'New topic') => adminCall('POST', `/modules/${course.moduleId}/topics`, { title });

// A granted student who has finished every topic of a fresh course (status completed, one pending request).
async function finishedStudent(topicCount = 3) {
  const course = await createCourse(db.pool, { title: `Curriculum ${Math.random().toString(36).slice(2, 7)}`, topicCount });
  const student = await createUser(db.pool);
  assert.equal((await adminCall('POST', '/enrolments', { studentId: student.id, courseId: course.id })).status, 201);
  for (const id of course.topicIds) assert.equal((await complete(student, id)).status, 200);
  assert.equal(await statusOf(student, course), 'completed');
  return { course, student };
}

test('adding a topic to a completed course keeps it completed, keeps progress and history, and issues nothing', async () => {
  const { course, student } = await finishedStudent(3);
  const reqBefore = await requests(student);
  assert.deepEqual(reqBefore.map((r) => r.status), ['pending']);
  const enrolmentBefore = (await db.pool.query('SELECT id, enrolled_at FROM enrolments WHERE student_id = $1', [student.id])).rows;
  const added = await addTopic(course);
  assert.equal(added.status, 201);
  assert.equal(await statusOf(student, course), 'completed', 'not reactivated');
  const page = await view(student, course);
  assert.equal(page.status, 200, 'the completed student keeps access');
  assert.equal(page.body.course.enrolment.status, 'completed');
  assert.deepEqual(page.body.course.enrolment.progress, { completedTopics: 3, totalTopics: 4, percent: 75 });
  assert.equal(page.body.course.modules[0].topics.length, 4, 'and sees the new topic');
  assert.equal(await progressRows(student), 3, 'progress kept');
  assert.deepEqual((await db.pool.query('SELECT id, enrolled_at FROM enrolments WHERE student_id = $1', [student.id])).rows, enrolmentBefore, 'same enrolment row');
  assert.deepEqual(await requests(student), reqBefore, 'no new request');
  assert.equal((await certs(student)).length, 0, 'no certificate issued by a curriculum change');
  // completing the new topic (or re-completing an old one) never flips the status either
  assert.equal((await complete(student, course.topicIds[0])).body.enrolmentStatus, 'completed');
  assert.equal((await complete(student, added.body.topic.id)).body.enrolmentStatus, 'completed');
  assert.equal((await view(student, course)).body.course.enrolment.progress.percent, 100);
  assert.equal((await requests(student)).length, 1, 'still the one request');
});

test('re-completing an already finished topic after a new topic was added does not reactivate (the progress endpoint)', async () => {
  const { course, student } = await finishedStudent(2);
  await addTopic(course);
  const again = await complete(student, course.topicIds[1]);
  assert.equal(again.status, 200);
  assert.equal(again.body.enrolmentStatus, 'completed');
  assert.equal(again.body.progress.percent, 67);
  assert.equal(await statusOf(student, course), 'completed');
});

test('editing a topic or module (title, description, video, order) never changes statuses or progress', async () => {
  const { course, student } = await finishedStudent(2);
  const active = await createUser(db.pool);
  await enrol(db.pool, active.id, course.id);
  const before = (await db.pool.query('SELECT student_id, status FROM enrolments WHERE course_id = $1 ORDER BY id', [course.id])).rows;
  for (const [path, body] of [
    [`/topics/${course.topicIds[0]}`, { title: 'Renamed', description: 'Edited', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', displayOrder: 9 }],
    [`/topics/${course.topicIds[1]}`, { title: 'Also renamed' }],
    [`/modules/${course.moduleId}`, { title: 'Module renamed', displayOrder: 3 }],
  ]) {
    assert.equal((await adminCall('PATCH', path, body)).status, 200, path);
  }
  assert.deepEqual((await db.pool.query('SELECT student_id, status FROM enrolments WHERE course_id = $1 ORDER BY id', [course.id])).rows, before);
  assert.equal(await progressRows(student), 2);
  assert.equal((await requests(student)).length, 1);
});

test('adding a topic leaves an active enrolment active; finishing it later completes it once', async () => {
  const course = await createCourse(db.pool, { title: 'Active stays', topicCount: 2 });
  const s = await createUser(db.pool);
  await adminCall('POST', '/enrolments', { studentId: s.id, courseId: course.id });
  await complete(s, course.topicIds[0]);
  const added = await addTopic(course);
  assert.equal(await statusOf(s, course), 'active');
  await complete(s, course.topicIds[1]);
  assert.equal(await statusOf(s, course), 'active', 'the new topic is still open');
  assert.equal((await complete(s, added.body.topic.id)).body.enrolmentStatus, 'completed');
  assert.equal((await requests(s)).length, 1);
  assert.equal((await certs(s)).length, 0);
});

test('deleting a topic: an active enrolment that is then fully done completes (request, no certificate); a completed one stays completed', async () => {
  const course = await createCourse(db.pool, { title: 'Delete topic', topicCount: 3 });
  const a = await createUser(db.pool);
  const c = await createUser(db.pool);
  await adminCall('POST', '/enrolments', { studentId: a.id, courseId: course.id });
  await complete(a, course.topicIds[0]);
  await complete(a, course.topicIds[1]);
  // c finishes everything first, on its own enrolment (a second course slot is not needed: different student)
  await adminCall('POST', '/enrolments', { studentId: c.id, courseId: course.id });
  for (const id of course.topicIds) await complete(c, id);
  assert.equal(await statusOf(c, course), 'completed');
  assert.equal((await adminCall('DELETE', `/topics/${course.topicIds[2]}`)).status, 204);
  assert.equal(await statusOf(a, course), 'completed', 'deleting the last unfinished topic finishes the course (existing rule)');
  assert.deepEqual((await requests(a)).map((r) => r.status), ['pending']);
  assert.equal((await certs(a)).length, 0);
  assert.equal(await statusOf(c, course), 'completed');
  assert.equal((await requests(c)).length, 1, 'c is not given a second request');
  // deleting a finished topic removes its progress row but never reopens a completed enrolment
  assert.equal((await adminCall('DELETE', `/topics/${course.topicIds[0]}`)).status, 204);
  assert.equal(await statusOf(c, course), 'completed');
  assert.equal(await progressRows(c), 1);
  assert.equal((await view(c, course)).body.course.enrolment.progress.percent, 100);
});

test('deleting a module (with its topics) follows the same rules', async () => {
  const course = await createCourse(db.pool, { title: 'Delete module', topicCount: 2 });
  const { rows: m } = await db.pool.query("INSERT INTO course_modules (course_id, title, display_order) VALUES ($1, 'Extra', 2) RETURNING id", [course.id]);
  const { rows: t } = await db.pool.query("INSERT INTO course_topics (module_id, title, display_order) VALUES ($1, 'Extra topic', 1) RETURNING id", [m[0].id]);
  const s = await createUser(db.pool);
  await adminCall('POST', '/enrolments', { studentId: s.id, courseId: course.id });
  for (const id of course.topicIds) await complete(s, id);
  assert.equal(await statusOf(s, course), 'active', 'the extra module keeps the course open');
  assert.equal((await adminCall('DELETE', `/modules/${m[0].id}`)).status, 204);
  assert.equal(await statusOf(s, course), 'completed');
  assert.ok(t[0].id);
  assert.equal((await requests(s)).length, 1);
});

test('the one-active rule stays valid: a curriculum change never raises the number of active enrolments', async () => {
  const done = await createCourse(db.pool, { title: 'Done course', topicCount: 1 });
  const next = await createCourse(db.pool, { title: 'Next course', topicCount: 2 });
  const s = await createUser(db.pool);
  await adminCall('POST', '/enrolments', { studentId: s.id, courseId: done.id });
  await complete(s, done.topicIds[0]);
  assert.equal((await adminCall('POST', '/enrolments', { studentId: s.id, courseId: next.id })).status, 201);
  const activeCount = async () => (await db.pool.query("SELECT count(*)::int AS n FROM enrolments WHERE student_id = $1 AND status = 'active'", [s.id])).rows[0].n;
  assert.equal(await activeCount(), 1);
  await addTopic(done);
  await addTopic(done, 'Another');
  assert.equal(await activeCount(), 1, 'the finished course did not become active again');
  assert.deepEqual((await db.pool.query('SELECT status FROM enrolments WHERE student_id = $1 ORDER BY id', [s.id])).rows.map((r) => r.status), ['completed', 'active']);
  const third = await createCourse(db.pool, { title: 'Third', topicCount: 1 });
  assert.equal((await adminCall('POST', '/enrolments', { studentId: s.id, courseId: third.id })).status, 409, 'still exactly one active course');
});

test('students with several legacy active enrolments keep them through curriculum changes and can still read', async () => {
  const A = await createCourse(db.pool, { title: 'Legacy multi A', topicCount: 2 });
  const B = await createCourse(db.pool, { title: 'Legacy multi B', topicCount: 2 });
  const s = await createUser(db.pool);
  await enrol(db.pool, s.id, A.id);
  await enrol(db.pool, s.id, B.id);
  await complete(s, A.topicIds[0]);
  const snapshot = async () => (await db.pool.query('SELECT course_id, status FROM enrolments WHERE student_id = $1 ORDER BY id', [s.id])).rows;
  const before = await snapshot();
  await addTopic(A);
  await addTopic(B);
  await adminCall('PATCH', `/topics/${B.topicIds[0]}`, { title: 'edited' });
  assert.deepEqual(await snapshot(), before);
  for (const path of ['/api/eduyarp/me/courses', `/api/eduyarp/me/courses/${A.id}`, `/api/eduyarp/me/courses/${B.id}`, '/api/eduyarp/me/schedule', '/api/eduyarp/me/certificates', '/api/eduyarp/me/certificate-requests', `/api/eduyarp/courses/${A.id}/demo`]) {
    assert.equal((await call('GET', path, { token: s.token })).status, 200, path);
  }
  assert.equal((await call('GET', '/api/eduyarp/me/courses', { token: s.token })).body.courses.length, 2);
  // finishing one of them still works, and completes only that one
  const aTopics = (await db.pool.query('SELECT t.id FROM course_topics t JOIN course_modules m ON m.id = t.module_id WHERE m.course_id = $1 ORDER BY t.id', [A.id])).rows;
  for (const { id } of aTopics) assert.equal((await complete(s, id)).status, 200);
  assert.deepEqual((await snapshot()).map((r) => r.status), ['completed', 'active']);
  // an Admin can still revoke each of the other active ones
  const rows = (await db.pool.query("SELECT id FROM enrolments WHERE student_id = $1 AND status = 'active'", [s.id])).rows;
  assert.equal((await adminCall('PATCH', `/enrolments/${rows[0].id}`, { status: 'cancelled' })).status, 200);
});

test('concurrent topic completion and topic creation never leave an inconsistent status', async () => {
  for (let round = 0; round < 4; round++) {
    const course = await createCourse(db.pool, { title: `Race create ${round}`, topicCount: 2 });
    const s = await createUser(db.pool);
    await adminCall('POST', '/enrolments', { studentId: s.id, courseId: course.id });
    await complete(s, course.topicIds[0]);
    const [done, added] = await Promise.all([complete(s, course.topicIds[1]), addTopic(course)]);
    assert.equal(done.status, 200);
    assert.equal(added.status, 201);
    const status = await statusOf(s, course);
    const total = (await db.pool.query('SELECT count(*)::int AS n FROM course_topics WHERE module_id = $1', [course.moduleId])).rows[0].n;
    assert.equal(total, 3);
    // either the completion won (finished, then a topic was added: stays completed) or the new topic landed
    // first (still open). Both are consistent; what must hold is the pairing with the request.
    if (status === 'completed') assert.equal((await requests(s)).length, 1);
    else assert.equal((await requests(s)).length, 0);
    assert.equal((await certs(s)).length, 0);
    // and the student can always finish from here
    await complete(s, (await db.pool.query('SELECT id FROM course_topics WHERE module_id = $1 ORDER BY id DESC LIMIT 1', [course.moduleId])).rows[0].id);
    assert.equal(await statusOf(s, course), 'completed');
    assert.equal((await requests(s)).length, 1);
  }
});

test('concurrent deletion of the last unfinished topic and its completion gives one completed status and one request, no server error', async () => {
  for (let round = 0; round < 4; round++) {
    const course = await createCourse(db.pool, { title: `Race delete ${round}`, topicCount: 2 });
    const s = await createUser(db.pool);
    await adminCall('POST', '/enrolments', { studentId: s.id, courseId: course.id });
    await complete(s, course.topicIds[0]);
    const results = await Promise.all([complete(s, course.topicIds[1]), adminCall('DELETE', `/topics/${course.topicIds[1]}`)]);
    for (const r of results) assert.ok([200, 204, 404].includes(r.status), `no server error: ${r.status}`);
    assert.equal(await statusOf(s, course), 'completed');
    assert.equal((await requests(s)).length, 1);
    assert.equal((await certs(s)).length, 0);
  }
});

test('many students are completed by one curriculum change, each exactly once, even when changes overlap', async () => {
  const course = await createCourse(db.pool, { title: 'Many students', topicCount: 2 });
  const students = [];
  for (let i = 0; i < 5; i++) {
    const s = await createUser(db.pool);
    await adminCall('POST', '/enrolments', { studentId: s.id, courseId: course.id });
    await complete(s, course.topicIds[0]);
    students.push(s);
  }
  const results = await Promise.all([
    adminCall('DELETE', `/topics/${course.topicIds[1]}`),
    addTopic(course, 'Overlap'),
    addTopic(course, 'Overlap 2'),
  ]);
  for (const r of results) assert.ok([201, 204].includes(r.status), `status ${r.status}`);
  for (const s of students) {
    const status = await statusOf(s, course);
    const reqs = await requests(s);
    assert.ok(reqs.length <= 1, 'never a duplicate request');
    assert.equal(status === 'completed', reqs.length === 1, 'completed exactly when the one request exists');
    assert.equal((await certs(s)).length, 0);
  }
});
