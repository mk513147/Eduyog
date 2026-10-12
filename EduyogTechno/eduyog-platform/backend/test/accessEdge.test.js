// Access-control edge cases: revocation, old tokens, the Admin-only matrix, certificate resubmission races and
// enrolment races, all through the real API.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client, createCourse, assign, enrol } = require('./helpers');

let db;
let api;
let call;
let admin;
let trainer;

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin' });
  trainer = await createUser(db.pool, { role: 'trainer' });
});

after(async () => {
  await api.stop();
  await db.drop();
});

const adminCall = (method, path, body, token = admin.token) => call(method, `/api/admin/eduyarp${path}`, { token, body });
const complete = (user, topicId) => call('POST', `/api/eduyarp/topics/${topicId}/complete`, { token: user.token });
const grant = (student, course, token = admin.token) => call('POST', '/api/admin/eduyarp/enrolments', { token, body: { studentId: student.id, courseId: course.id } });
const setApproval = (user, status) => db.pool.query('UPDATE users SET approval_status = $2 WHERE id = $1', [user.id, status]);
const secretCourse = async (title) => {
  const c = await createCourse(db.pool, { title, topicCount: 4 });
  await db.pool.query(
    "UPDATE course_topics SET description = 'SECRETDESC' || id, video_url = 'https://www.youtube.com/watch?v=SECRETv' || lpad(id::text, 4, '0') WHERE module_id = $1",
    [c.moduleId]
  );
  return c;
};

test('revoking full access: locked topics, protected media and course endpoints are refused directly; only the demo remains', async () => {
  const c = await secretCourse('Revoke access');
  await assign(db.pool, c.id, trainer.id);
  await db.pool.query("INSERT INTO course_faqs (course_id, question, answer) VALUES ($1, 'Q', 'A')", [c.id]);
  await db.pool.query("INSERT INTO course_resources (course_id, title, resource_type, url) VALUES ($1, 'R', 'external', 'https://example.com/r')", [c.id]);
  const s = await createUser(db.pool);
  await grant(s, c);
  await complete(s, c.topicIds[0]);
  const urls = [`/me/courses/${c.id}`, `/me/courses/${c.id}/faqs`, `/me/courses/${c.id}/resources`, `/me/courses/${c.id}/assignments`];
  for (const u of urls) assert.equal((await call('GET', `/api/eduyarp${u}`, { token: s.token })).status, 200, `before: ${u}`);
  const full = await call('GET', `/api/eduyarp/me/courses/${c.id}`, { token: s.token });
  assert.match(full.text, /SECRETv0*/, 'full access sees the videos');

  const enrolmentId = (await db.pool.query('SELECT id FROM enrolments WHERE student_id = $1', [s.id])).rows[0].id;
  assert.equal((await adminCall('PATCH', `/enrolments/${enrolmentId}`, { status: 'cancelled' })).status, 200);

  for (const u of urls) assert.equal((await call('GET', `/api/eduyarp${u}`, { token: s.token })).status, 404, `after: ${u}`);
  assert.equal((await complete(s, c.topicIds[1])).status, 404, 'cannot complete a topic any more');
  assert.equal((await call('GET', '/api/eduyarp/me/courses', { token: s.token })).body.courses.length, 0);
  const schedule = await call('GET', '/api/eduyarp/me/schedule', { token: s.token });
  assert.deepEqual(schedule.body.classes, []);
  // the demo is all that is left, and it leaks nothing beyond its two topics
  const demo = await call('GET', `/api/eduyarp/courses/${c.id}/demo`, { token: s.token });
  assert.equal(demo.status, 200);
  assert.equal(demo.body.course.hasFullAccess, false);
  assert.doesNotMatch(demo.text, new RegExp(`SECRETv${String(c.topicIds[2]).padStart(4, '0')}|SECRETv${String(c.topicIds[3]).padStart(4, '0')}|SECRETDESC${c.topicIds[2]}`));
  assert.match(demo.text, new RegExp(`SECRETv${String(c.topicIds[0]).padStart(4, '0')}`), 'the two demo topics are still shown');

  // history is intact, and granting again restores the progress
  const rows = (await db.pool.query('SELECT status FROM enrolments WHERE student_id = $1', [s.id])).rows;
  assert.deepEqual(rows, [{ status: 'cancelled' }]);
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM topic_progress WHERE student_id = $1 AND completed', [s.id])).rows[0].n, 1);
  assert.equal((await grant(s, c)).status, 201);
  const back = await call('GET', `/api/eduyarp/me/courses/${c.id}`, { token: s.token });
  assert.equal(back.body.course.enrolment.progress.completedTopics, 1);
  assert.deepEqual((await db.pool.query('SELECT status FROM enrolments WHERE student_id = $1 ORDER BY id', [s.id])).rows.map((r) => r.status), ['cancelled', 'active']);
});

test('revoking while the student acts concurrently never leaves a 500 or a completed topic after the revocation', async () => {
  const c = await secretCourse('Revoke race');
  const s = await createUser(db.pool);
  await grant(s, c);
  const enrolmentId = (await db.pool.query('SELECT id FROM enrolments WHERE student_id = $1', [s.id])).rows[0].id;
  const results = await Promise.all([
    complete(s, c.topicIds[0]),
    complete(s, c.topicIds[1]),
    adminCall('PATCH', `/enrolments/${enrolmentId}`, { status: 'cancelled' }),
  ]);
  for (const r of results) assert.ok([200, 404].includes(r.status), `unexpected ${r.status}`);
  assert.equal((await db.pool.query('SELECT status FROM enrolments WHERE id = $1', [enrolmentId])).rows[0].status, 'cancelled');
  assert.equal((await complete(s, c.topicIds[2])).status, 404);
});

test('pending and rejected students cannot use an old token on any protected student API', async () => {
  const c = await secretCourse('Old tokens');
  const s = await createUser(db.pool);
  await grant(s, c);
  await complete(s, c.topicIds[0]);
  const assignment = await db.pool.query("INSERT INTO assignments (course_id, title, instructions, status) VALUES ($1, 'A', 'Do it', 'published') RETURNING id", [c.id]).catch(() => null);
  const calls = [
    ['GET', '/api/auth/me'], ['GET', '/api/me/profile'], ['PATCH', '/api/me/profile', { bio: 'x' }], ['GET', '/api/me/notifications'], ['GET', '/api/me/announcements'],
    ['GET', '/api/eduyarp/me/courses'], ['GET', `/api/eduyarp/me/courses/${c.id}`], ['GET', `/api/eduyarp/me/courses/${c.id}/faqs`],
    ['GET', `/api/eduyarp/me/courses/${c.id}/resources`], ['GET', `/api/eduyarp/me/courses/${c.id}/assignments`], ['GET', '/api/eduyarp/me/schedule'],
    ['GET', '/api/eduyarp/me/certificates'], ['GET', '/api/eduyarp/me/certificate-requests'], ['POST', `/api/eduyarp/me/courses/${c.id}/certificate-request`],
    ['GET', `/api/eduyarp/courses/${c.id}/demo`], ['POST', `/api/eduyarp/topics/${c.topicIds[1]}/complete`], ['POST', `/api/eduyarp/courses/${c.id}/enrol`],
    ['POST', '/api/me/password', { currentPassword: 'password123', newPassword: 'another-password-1' }],
  ];
  if (assignment) calls.push(['GET', `/api/eduyarp/me/assignments/${assignment.rows[0].id}`]);
  for (const status of ['pending', 'rejected']) {
    await setApproval(s, status);
    for (const [method, path, body] of calls) {
      const res = await call(method, path, { token: s.token, body });
      assert.equal(res.status, 401, `${status}: ${method} ${path}`);
    }
  }
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM topic_progress WHERE student_id = $1', [s.id])).rows[0].n, 1, 'nothing was written');
  await setApproval(s, 'approved');
  assert.equal((await call('GET', '/api/eduyarp/me/courses', { token: s.token })).status, 200, 'approval restores the same token');
});

test('Admin-only matrix: students, trainers, anonymous and unapproved students are refused on every approval, grant and decision endpoint', async () => {
  const c = await secretCourse('Admin matrix');
  const target = await createUser(db.pool);
  const done = await createUser(db.pool);
  await grant(done, c);
  for (const id of c.topicIds) await complete(done, id);
  const request = (await db.pool.query('SELECT id FROM certificate_requests WHERE student_id = $1', [done.id])).rows[0].id;
  const enrolmentId = (await db.pool.query('SELECT id FROM enrolments WHERE student_id = $1', [done.id])).rows[0].id;
  const pendingStudent = await createUser(db.pool);
  await setApproval(pendingStudent, 'pending');
  const student = await createUser(db.pool);
  const endpoints = [
    ['GET', '/api/admin/registrations'],
    ['PATCH', `/api/admin/users/${target.id}/approval`, { status: 'rejected' }],
    ['POST', '/api/admin/eduyarp/enrolments', { studentId: target.id, courseId: c.id }],
    ['PATCH', `/api/admin/eduyarp/enrolments/${enrolmentId}`, { status: 'cancelled' }],
    ['GET', '/api/admin/eduyarp/certificate-requests'],
    ['POST', `/api/admin/eduyarp/certificate-requests/${request}/approve`],
    ['POST', `/api/admin/eduyarp/certificate-requests/${request}/reject`, { reason: 'no' }],
  ];
  for (const [who, expected] of [[student.token, 403], [trainer.token, 403], [pendingStudent.token, 401], [null, 401]]) {
    for (const [method, path, body] of endpoints) {
      const res = await call(method, path, { token: who, body });
      assert.equal(res.status, expected, `${expected}: ${method} ${path}`);
    }
  }
  assert.equal((await db.pool.query('SELECT approval_status FROM users WHERE id = $1', [target.id])).rows[0].approval_status, 'approved');
  assert.equal((await db.pool.query('SELECT status FROM enrolments WHERE id = $1', [enrolmentId])).rows[0].status, 'completed');
  assert.equal((await db.pool.query('SELECT status FROM certificate_requests WHERE id = $1', [request])).rows[0].status, 'pending');
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM enrolments WHERE student_id = $1', [target.id])).rows[0].n, 0);
  // the Admin can
  assert.equal((await call('POST', `/api/admin/eduyarp/certificate-requests/${request}/approve`, { token: admin.token })).status, 200);
});

test('a demoted Admin or Trainer loses the Admin endpoints at once (role is read from the database)', async () => {
  const staff = await createUser(db.pool, { role: 'admin' });
  assert.equal((await call('GET', '/api/admin/registrations', { token: staff.token })).status, 200);
  await db.pool.query("UPDATE users SET role = 'trainer' WHERE id = $1", [staff.id]);
  assert.equal((await call('GET', '/api/admin/registrations', { token: staff.token })).status, 403);
});

test('rejected certificate requests: concurrent resubmission creates one pending request; approval never duplicates the certificate', async () => {
  const c = await createCourse(db.pool, { title: 'Resubmit', topicCount: 1 });
  const s = await createUser(db.pool);
  await grant(s, c);
  await complete(s, c.topicIds[0]);
  const requests = async () => (await db.pool.query('SELECT id, status FROM certificate_requests WHERE student_id = $1 ORDER BY id', [s.id])).rows;
  for (let round = 1; round <= 3; round++) {
    const pending = (await requests()).find((r) => r.status === 'pending');
    assert.ok(pending, `round ${round}: a pending request exists`);
    assert.equal((await adminCall('POST', `/certificate-requests/${pending.id}/reject`, { reason: `Round ${round}` })).status, 200);
    const again = await Promise.all([1, 2, 3, 4, 5, 6].map(() => call('POST', `/api/eduyarp/me/courses/${c.id}/certificate-request`, { token: s.token })));
    assert.ok(again.every((r) => [200, 201].includes(r.status)), again.map((r) => r.status).join());
    assert.equal(again.filter((r) => r.status === 201).length, 1, 'exactly one creation');
    assert.equal((await requests()).filter((r) => r.status === 'pending').length, 1);
  }
  assert.deepEqual((await requests()).map((r) => r.status), ['rejected', 'rejected', 'rejected', 'pending']);
  // approving it twice in parallel, with a resubmission racing: one certificate
  const pending = (await requests()).find((r) => r.status === 'pending');
  const results = await Promise.all([
    adminCall('POST', `/certificate-requests/${pending.id}/approve`),
    adminCall('POST', `/certificate-requests/${pending.id}/approve`),
    call('POST', `/api/eduyarp/me/courses/${c.id}/certificate-request`, { token: s.token }),
  ]);
  for (const r of results) assert.ok([200, 201, 409].includes(r.status), `status ${r.status}`);
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM certificates WHERE student_id = $1', [s.id])).rows[0].n, 1);
  assert.equal((await requests()).filter((r) => r.status === 'pending').length <= 1, true);
  assert.equal((await call('POST', `/api/eduyarp/me/courses/${c.id}/certificate-request`, { token: s.token })).status, 409, 'issued: no more requests');
});

test('concurrent enrolment attempts: self-enrolment is refused, grants are serialised, and a completed student can be granted the next course once', async () => {
  const courses = await Promise.all([1, 2, 3].map((i) => createCourse(db.pool, { title: `Race next ${i}`, topicCount: 1 })));
  const s = await createUser(db.pool);
  const results = await Promise.all([
    ...courses.map((c) => call('POST', `/api/eduyarp/courses/${c.id}/enrol`, { token: s.token })),
    ...courses.map((c) => grant(s, c)),
    ...courses.map((c) => grant(s, c)),
  ]);
  assert.equal(results.slice(0, 3).every((r) => r.status === 403), true, 'self-enrolment');
  assert.equal(results.slice(3).filter((r) => r.status === 201).length, 1);
  assert.equal(results.slice(3).filter((r) => r.status === 409).length, 5);
  assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM enrolments WHERE student_id = $1 AND status = 'active'", [s.id])).rows[0].n, 1);
});

test('legacy students with several active enrolments can still do every read-only operation and are not blocked by unrelated ones', async () => {
  const A = await createCourse(db.pool, { title: 'RO A', topicCount: 2 });
  const B = await createCourse(db.pool, { title: 'RO B', topicCount: 2 });
  const s = await createUser(db.pool);
  await enrol(db.pool, s.id, A.id);
  await enrol(db.pool, s.id, B.id);
  for (const path of ['/api/auth/me', '/api/me/profile', '/api/me/notifications', '/api/me/announcements', '/api/eduyarp/me/courses', `/api/eduyarp/me/courses/${A.id}`,
    `/api/eduyarp/me/courses/${B.id}/faqs`, '/api/eduyarp/me/schedule', '/api/eduyarp/me/certificates', '/api/eduyarp/me/certificate-requests', '/api/eduyarp/courses', `/api/eduyarp/courses/${A.id}/demo`]) {
    assert.equal((await call('GET', path, { token: s.token })).status, 200, path);
  }
  assert.equal((await complete(s, A.topicIds[0])).status, 200);
  assert.equal((await call('PATCH', '/api/me/profile', { token: s.token, body: { bio: 'still works' } })).status, 200);
  const list = await adminCall('GET', '/enrolments');
  assert.equal(list.body.enrolments.filter((e) => e.student.id === s.id).length, 2);
});
