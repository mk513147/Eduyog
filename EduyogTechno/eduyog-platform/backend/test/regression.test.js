// Existing behaviour that Stage 2 must not change: auth, courses, enrolment, progress,
// classes and the role-change / enrolment-cancellation rules.

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
let admin;
let course;

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin' });
  course = await createCourse(db.pool, { title: 'Regression course', topicCount: 3 });
});

after(async () => {
  await api.stop();
  await db.drop();
});

const role = (userId, newRole) => call('PATCH', `/api/admin/users/${userId}/role`, { token: admin.token, body: { role: newRole } });
const enrolments = async (studentId) =>
  (await db.pool.query('SELECT id, status FROM enrolments WHERE student_id = $1 ORDER BY id', [studentId])).rows;
const progressCount = async (studentId) =>
  Number((await db.pool.query('SELECT count(*) AS n FROM topic_progress WHERE student_id = $1', [studentId])).rows[0].n);

test('register, login and /auth/me still work and return the same shape', async () => {
  const email = `reg-${Date.now()}@test.example`;
  const reg = await call('POST', '/api/auth/register', { body: { fullName: 'Reg User', email, password: 'password123' } });
  assert.equal(reg.status, 201);
  assert.deepEqual(Object.keys(reg.body.user).sort(), ['createdAt', 'email', 'fullName', 'id', 'role']);
  assert.equal(reg.body.user.role, 'student');
  const login = await call('POST', '/api/auth/login', { body: { email, password: 'password123' } });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);
  assert.equal(login.body.tokenType, 'Bearer');
  const me = await call('GET', '/api/auth/me', { token: login.body.token });
  assert.equal(me.status, 200);
  assert.deepEqual(Object.keys(me.body.user).sort(), ['createdAt', 'email', 'fullName', 'id', 'role']);
  assert.doesNotMatch(me.text, /passwordChangedAt|password_changed_at|password/i, 'the new column is not exposed');
});

test('registration validation is unchanged', async () => {
  const res = await call('POST', '/api/auth/register', { body: { fullName: '', email: 'bad', password: 'short' } });
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(res.body.error.details).sort(), ['email', 'fullName', 'password']);
  assert.equal(res.body.error.details.password, 'Password must be at least 8 characters');
});

test('a token without a password change keeps working; a missing/forged token is 401', async () => {
  const user = await createUser(db.pool);
  assert.equal((await call('GET', '/api/auth/me', { token: user.token })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { token: 'not.a.token' })).status, 401);
  assert.equal((await call('GET', '/api/auth/me')).status, 401);
});

test('public course catalogue and detail are unchanged', async () => {
  const list = await call('GET', '/api/eduyarp/courses');
  assert.equal(list.status, 200);
  assert.ok(list.body.courses.some((c) => c.id === course.id));
  const detail = await call('GET', `/api/eduyarp/courses/${course.slug}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.course.modules[0].topics.length, 3);
  assert.doesNotMatch(detail.text, /student|phone|@test/i, 'no private data on public pages');
});

test('enrolment, progress, topic completion and schedule still work for a Student', async () => {
  const student = await createUser(db.pool);
  const enrolRes = await call('POST', `/api/eduyarp/courses/${course.id}/enrol`, { token: student.token });
  assert.equal(enrolRes.status, 201);
  assert.equal((await call('POST', `/api/eduyarp/courses/${course.id}/enrol`, { token: student.token })).status, 409);

  const first = await call('POST', `/api/eduyarp/topics/${course.topicIds[0]}/complete`, { token: student.token });
  assert.equal(first.status, 200);
  assert.equal(first.body.progress.percent, 33);
  assert.equal(first.body.enrolmentStatus, 'active');
  await call('POST', `/api/eduyarp/topics/${course.topicIds[1]}/complete`, { token: student.token });
  const last = await call('POST', `/api/eduyarp/topics/${course.topicIds[2]}/complete`, { token: student.token });
  assert.equal(last.body.enrolmentStatus, 'completed');
  assert.equal(last.body.progress.percent, 100);

  const mine = await call('GET', '/api/eduyarp/me/courses', { token: student.token });
  assert.equal(mine.body.courses[0].enrolment.status, 'completed');
  assert.equal((await call('GET', `/api/eduyarp/me/courses/${course.id}`, { token: student.token })).status, 200);
  assert.equal((await call('GET', '/api/eduyarp/me/schedule', { token: student.token })).status, 200);
});

test('Admin class API: create needs an assigned trainer; list and update still work', async () => {
  const trainer = await createUser(db.pool, { role: 'trainer' });
  const when = new Date(Date.now() + 86400000).toISOString();
  const body = { courseId: course.id, trainerId: trainer.id, title: 'Live session', scheduledAt: when };
  assert.equal((await call('POST', '/api/admin/eduyarp/classes', { token: admin.token, body })).status, 400, 'trainer not assigned yet');
  await assign(db.pool, course.id, trainer.id);
  const created = await call('POST', '/api/admin/eduyarp/classes', { token: admin.token, body });
  assert.equal(created.status, 201);
  const id = created.body.class.id;
  const updated = await call('PATCH', `/api/admin/eduyarp/classes/${id}`, { token: admin.token, body: { title: 'Renamed' } });
  assert.equal(updated.body.class.title, 'Renamed');
  const list = await call('GET', '/api/admin/eduyarp/classes', { token: admin.token });
  assert.ok(list.body.classes.some((c) => c.id === id));
});

test('Admin course, enrolment and user lists still work', async () => {
  for (const path of ['/api/admin/eduyarp/courses', '/api/admin/eduyarp/enrolments', '/api/admin/eduyarp/trainers', '/api/admin/users']) {
    assert.equal((await call('GET', path, { token: admin.token })).status, 200, path);
  }
  const users = await call('GET', '/api/admin/users', { token: admin.token });
  assert.deepEqual(Object.keys(users.body.users[0]).sort(), ['createdAt', 'email', 'fullName', 'id', 'role', 'updatedAt']);
});

test('Student -> Trainer cancels active enrolments, keeps progress and history', async () => {
  const student = await createUser(db.pool);
  const c = await createCourse(db.pool, { title: 'Role change A', topicCount: 3 });
  await enrol(db.pool, student.id, c.id);
  await completeTopics(db.pool, student.id, c.topicIds.slice(0, 1));
  const progressBefore = await progressCount(student.id);

  const res = await role(student.id, 'trainer');
  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, 'trainer');

  const rows = await enrolments(student.id);
  assert.deepEqual(rows.map((r) => r.status), ['cancelled'], 'the enrolment is kept as history');
  assert.equal(await progressCount(student.id), progressBefore, 'progress is preserved');
});

test('Student -> Admin cancels active enrolments the same way', async () => {
  const student = await createUser(db.pool);
  const c = await createCourse(db.pool, { title: 'Role change B', topicCount: 2 });
  await enrol(db.pool, student.id, c.id);
  await completeTopics(db.pool, student.id, c.topicIds.slice(0, 1));
  assert.equal((await role(student.id, 'admin')).status, 200);
  assert.deepEqual((await enrolments(student.id)).map((r) => r.status), ['cancelled']);
  assert.equal(await progressCount(student.id), 1);
});

test('completed enrolments are not cancelled by a role change', async () => {
  const student = await createUser(db.pool);
  const c = await createCourse(db.pool, { title: 'Role change C', topicCount: 1 });
  await enrol(db.pool, student.id, c.id, 'completed');
  await completeTopics(db.pool, student.id, c.topicIds);
  await role(student.id, 'trainer');
  assert.deepEqual((await enrolments(student.id)).map((r) => r.status), ['completed']);
});

test('Trainer -> Student does not restore cancelled enrolments; the student can re-enrol', async () => {
  const person = await createUser(db.pool);
  const c = await createCourse(db.pool, { title: 'Role change D', topicCount: 3 });
  await enrol(db.pool, person.id, c.id);
  await completeTopics(db.pool, person.id, c.topicIds.slice(0, 1));
  await role(person.id, 'trainer');
  await role(person.id, 'student');
  assert.deepEqual((await enrolments(person.id)).map((r) => r.status), ['cancelled'], 'nothing restored');

  const noAccess = await call('GET', `/api/eduyarp/me/courses/${c.id}`, { token: person.token });
  assert.equal(noAccess.status, 404, 'a cancelled enrolment gives no access');

  const again = await call('POST', `/api/eduyarp/courses/${c.id}/enrol`, { token: person.token });
  assert.equal(again.status, 201);
  const rows = await enrolments(person.id);
  assert.deepEqual(rows.map((r) => r.status), ['cancelled', 'active'], 'history kept, a new enrolment created');
  const mine = await call('GET', `/api/eduyarp/me/courses/${c.id}`, { token: person.token });
  assert.equal(mine.body.course.enrolment.progress.completedTopics, 1, 'earlier progress still counts');
});

test('the last Admin cannot be demoted', async () => {
  const solo = await createTestDatabase();
  const soloApi = await startApi(solo.name);
  try {
    const only = await createUser(solo.pool, { role: 'admin' });
    const res = await client(soloApi.url)('PATCH', `/api/admin/users/${only.id}/role`, { token: only.token, body: { role: 'student' } });
    assert.equal(res.status, 409);
  } finally {
    await soloApi.stop();
    await solo.drop();
  }
});

test('Admin can still cancel an active enrolment (existing endpoint)', async () => {
  const student = await createUser(db.pool);
  const c = await createCourse(db.pool, { title: 'Cancel course' });
  const enrolmentId = await enrol(db.pool, student.id, c.id);
  const res = await call('PATCH', `/api/admin/eduyarp/enrolments/${enrolmentId}`, { token: admin.token, body: { status: 'cancelled' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.enrolment.status, 'cancelled');
});
