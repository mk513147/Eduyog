// Demo access (first two topics of the first module, no enrolment) and Admin-granted full-course access:
// what a Student can and cannot see, what leaks, the one-active-course rule and legacy data.

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

const adminCall = (method, path, body) => call(method, `/api/admin/eduyarp${path}`, { token: admin.token, body });
const demo = (user, course) => call('GET', `/api/eduyarp/courses/${course.id}/demo`, { token: user.token });
const grant = (student, course, token = admin.token) =>
  call('POST', '/api/admin/eduyarp/enrolments', { token, body: { studentId: student.id, courseId: course.id } });
const rowsOf = async (user) => (await db.pool.query('SELECT * FROM enrolments WHERE student_id = $1 ORDER BY id', [user.id])).rows;

// A course with two modules (3 + 2 topics); every topic has a description and a video URL so leaks are visible.
async function richCourse(title = 'Rich Course') {
  const c = await createCourse(db.pool, { title, topicCount: 3 });
  await db.pool.query(
    "UPDATE course_topics SET description = 'SECRET description ' || id, video_url = 'https://www.youtube.com/watch?v=SECRETv' || lpad(id::text, 4, '0') WHERE module_id = $1",
    [c.moduleId]
  );
  const { rows: m } = await db.pool.query("INSERT INTO course_modules (course_id, title, description, display_order) VALUES ($1, 'Module 2', 'SECRET module two', 2) RETURNING id", [c.id]);
  const second = [];
  for (let i = 1; i <= 2; i++) {
    const { rows } = await db.pool.query(
      "INSERT INTO course_topics (module_id, title, description, display_order, video_url) VALUES ($1, $2, 'SECRET m2 description', $3, $4) RETURNING id",
      [m[0].id, `M2 Topic ${i}`, i, `https://www.youtube.com/watch?v=SECRETm${String(i).padStart(4, '0')}`]
    );
    second.push(rows[0].id);
  }
  return { ...c, module2Id: m[0].id, module2Topics: second };
}

// ------------------------------------------------------------------ demo

test('demo shows exactly the first two topics of the first module; everything else is locked', async () => {
  const c = await richCourse();
  const s = await createUser(db.pool);
  const res = await demo(s, c);
  assert.equal(res.status, 200);
  const [m1, m2] = res.body.course.modules;
  assert.deepEqual(m1.topics.map((t) => t.locked), [false, false, true]);
  assert.deepEqual(m1.topics.map((t) => t.title), ['Topic 1', 'Topic 2', 'Topic 3']);
  assert.match(m1.topics[0].description, /SECRET description/);
  assert.match(m1.topics[0].videoEmbedUrl, /youtube/);
  assert.equal(m1.locked, false);
  assert.equal(m2.locked, true);
  assert.equal(m2.topics.every((t) => t.locked), true);
  assert.equal(res.body.course.hasFullAccess, false);
  assert.deepEqual(res.body.course.demo, { topicLimit: 2, moduleId: c.moduleId });
  assert.equal((await rowsOf(s)).length, 0, 'viewing the demo creates no enrolment');
});

test('no locked content leaks into a demo response: descriptions, video URLs, embed URLs', async () => {
  const c = await richCourse('Leak check');
  const s = await createUser(db.pool);
  const res = await demo(s, c);
  const locked = [c.topicIds[2], ...c.module2Topics];
  const text = JSON.stringify(res.body);
  assert.doesNotMatch(text, new RegExp(`SECRETv${String(c.topicIds[2]).padStart(4, '0')}|SECRETm|SECRET m2|SECRET module two`), 'no locked video or description');
  assert.ok(!text.includes(`SECRET description ${c.topicIds[2]}`));
  for (const topic of res.body.course.modules.flatMap((m) => m.topics).filter((t) => locked.includes(t.id))) {
    assert.deepEqual(Object.keys(topic).sort(), ['displayOrder', 'id', 'locked', 'title']);
  }
  assert.deepEqual(Object.keys(res.body.course.modules[1]).sort(), ['displayOrder', 'id', 'locked', 'title', 'topics']);
});

test('demo is for approved Students on published courses only; anonymous, Trainer and Admin use their own paths', async () => {
  const c = await richCourse('Demo auth');
  const s = await createUser(db.pool);
  assert.equal((await call('GET', `/api/eduyarp/courses/${c.id}/demo`)).status, 401);
  assert.equal((await demo(trainer, c)).status, 403);
  assert.equal((await demo(admin, c)).status, 403);
  assert.equal((await call('GET', '/api/eduyarp/courses/999999/demo', { token: s.token })).status, 404);
  assert.equal((await call('GET', '/api/eduyarp/courses/abc/demo', { token: s.token })).status, 400);
  const draft = await createCourse(db.pool, { title: 'Unpublished demo', status: 'draft', topicCount: 2 });
  assert.equal((await demo(s, draft)).status, 404, 'unpublished content is never shown');
  await db.pool.query("UPDATE courses SET status = 'archived' WHERE id = $1", [c.id]);
  assert.equal((await demo(s, c)).status, 404);
  // staff keep full access through the existing Admin/Trainer endpoints
  const full = await createCourse(db.pool, { title: 'Staff view', topicCount: 3 });
  await assign(db.pool, full.id, trainer.id);
  assert.equal((await adminCall('GET', `/courses/${full.id}`)).body.course.modules[0].topics.length, 3);
  assert.equal((await call('GET', `/api/eduyarp/trainer/courses/${full.id}`, { token: trainer.token })).status, 200);
});

test('demo does not unlock anything else: no progress, no FAQs/resources/assignments/schedule access without enrolment', async () => {
  const c = await richCourse('No side doors');
  const s = await createUser(db.pool);
  assert.equal((await demo(s, c)).status, 200);
  assert.equal((await call('POST', `/api/eduyarp/topics/${c.topicIds[0]}/complete`, { token: s.token })).status, 404, 'cannot complete a demo topic');
  for (const sub of ['', '/faqs', '/resources', '/assignments']) {
    assert.equal((await call('GET', `/api/eduyarp/me/courses/${c.id}${sub}`, { token: s.token })).status, 404, `/me/courses/:id${sub}`);
  }
  assert.equal((await call('POST', `/api/eduyarp/courses/${c.id}/enrol`, { token: s.token })).status, 403, 'students cannot enrol themselves');
  assert.equal((await rowsOf(s)).length, 0);
  assert.equal((await call('GET', '/api/eduyarp/me/courses', { token: s.token })).body.courses.length, 0);
});

test('demo edge cases: fewer than two topics, no modules, reordering', async () => {
  const s = await createUser(db.pool);
  const one = await createCourse(db.pool, { title: 'One topic', topicCount: 1 });
  const oneRes = await demo(s, one);
  assert.deepEqual(oneRes.body.course.modules[0].topics.map((t) => t.locked), [false]);
  const none = await createCourse(db.pool, { title: 'No topics', topicCount: 0 });
  assert.deepEqual((await demo(s, none)).body.course.modules[0].topics, []);
  const bare = await createCourse(db.pool, { title: 'No modules', topicCount: 0 });
  await db.pool.query('DELETE FROM course_modules WHERE course_id = $1', [bare.id]);
  const bareRes = await demo(s, bare);
  assert.equal(bareRes.status, 200);
  assert.deepEqual(bareRes.body.course.modules, []);
  assert.equal(bareRes.body.course.demo.moduleId, null);

  // curriculum order decides: moving a later topic first moves the demo with it; ties fall back to id
  const c = await richCourse('Reordered');
  await db.pool.query('UPDATE course_topics SET display_order = 0 WHERE id = $1', [c.topicIds[2]]);
  let topics = (await demo(s, c)).body.course.modules[0].topics;
  assert.deepEqual(topics.map((t) => [t.id, t.locked]), [[c.topicIds[2], false], [c.topicIds[0], false], [c.topicIds[1], true]]);
  await db.pool.query('UPDATE course_modules SET display_order = 0 WHERE id = $1', [c.module2Id]);
  const res = await demo(s, c);
  assert.equal(res.body.course.demo.moduleId, c.module2Id, 'the first module in curriculum order');
  assert.equal(res.body.course.modules[0].topics.every((t) => !t.locked), true);
  assert.equal(res.body.course.modules[1].topics.every((t) => t.locked), true);
  topics = res.body.course.modules.flatMap((m) => m.topics);
  assert.ok(!JSON.stringify(res.body).includes('SECRETv' + String(c.topicIds[0]).padStart(4, '0')), 'the old first module is now locked');
});

// ------------------------------------------------------------------ granting full access

test('an Admin grants full-course access; it is an ordinary active enrolment with every existing rule', async () => {
  const c = await richCourse('Granted');
  const s = await createUser(db.pool);
  const res = await grant(s, c);
  assert.equal(res.status, 201);
  assert.equal(res.body.enrolment.status, 'active');
  assert.equal((await rowsOf(s))[0].granted_by, admin.id);
  const full = await call('GET', `/api/eduyarp/me/courses/${c.id}`, { token: s.token });
  assert.equal(full.status, 200);
  assert.equal(full.body.course.modules.reduce((n, m) => n + m.topics.length, 0), 5);
  assert.match(JSON.stringify(full.body), /SECRETm0001/, 'full content is available after the grant');
  assert.equal((await demo(s, c)).body.course.hasFullAccess, true);
  assert.equal((await call('POST', `/api/eduyarp/topics/${c.module2Topics[0]}/complete`, { token: s.token })).status, 200);
  assert.equal((await grant(s, c)).status, 409, 'granting twice is refused');
});

test('only an Admin can grant or revoke; the body cannot choose another actor or status', async () => {
  const c = await richCourse('Who grants');
  const s = await createUser(db.pool);
  for (const [token, expected] of [[s.token, 403], [trainer.token, 403], [null, 401]]) {
    assert.equal((await grant(s, c, token)).status, expected);
  }
  assert.equal((await rowsOf(s)).length, 0);
  const res = await call('POST', '/api/admin/eduyarp/enrolments', { token: admin.token, body: { studentId: s.id, courseId: c.id, status: 'completed', grantedBy: 999, role: 'admin' } });
  assert.equal(res.status, 201);
  const row = (await rowsOf(s))[0];
  assert.equal(row.status, 'active');
  assert.equal(row.granted_by, admin.id);
  assert.equal((await call('PATCH', `/api/admin/eduyarp/enrolments/${row.id}`, { token: s.token, body: { status: 'cancelled' } })).status, 403);
  assert.equal((await rowsOf(s))[0].status, 'active');
});

test('grant validation: ids, unknown student/course, non-students, unpublished, unapproved', async () => {
  const c = await richCourse('Grant validation');
  const s = await createUser(db.pool);
  const post = (body) => call('POST', '/api/admin/eduyarp/enrolments', { token: admin.token, body });
  for (const bad of [{}, { studentId: s.id }, { courseId: c.id }, { studentId: 'x', courseId: c.id }, { studentId: s.id, courseId: -1 }]) {
    assert.equal((await post(bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await post({ studentId: 999999, courseId: c.id })).status, 404);
  assert.equal((await post({ studentId: s.id, courseId: 999999 })).status, 404);
  assert.equal((await post({ studentId: trainer.id, courseId: c.id })).status, 404, 'staff are not students');
  const draft = await createCourse(db.pool, { title: 'Draft grant', status: 'draft' });
  assert.equal((await grant(s, draft)).status, 404);
  const pending = await createUser(db.pool);
  await db.pool.query("UPDATE users SET approval_status = 'pending' WHERE id = $1", [pending.id]);
  assert.equal((await grant(pending, c)).status, 409, 'an unapproved registration cannot be granted access');
  assert.equal((await rowsOf(pending)).length, 0);
});

test('revoking cancels the enrolment, keeps history and progress, and the student falls back to the demo', async () => {
  const c = await richCourse('Revoked');
  const s = await createUser(db.pool);
  await grant(s, c);
  await call('POST', `/api/eduyarp/topics/${c.topicIds[0]}/complete`, { token: s.token });
  const id = (await rowsOf(s))[0].id;
  const revoked = await call('PATCH', `/api/admin/eduyarp/enrolments/${id}`, { token: admin.token, body: { status: 'cancelled' } });
  assert.equal(revoked.status, 200);
  assert.equal((await rowsOf(s))[0].status, 'cancelled');
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM topic_progress WHERE student_id = $1', [s.id])).rows[0].n, 1);
  assert.equal((await call('GET', `/api/eduyarp/me/courses/${c.id}`, { token: s.token })).status, 404);
  const fallback = await demo(s, c);
  assert.equal(fallback.status, 200);
  assert.equal(fallback.body.course.hasFullAccess, false);
  assert.doesNotMatch(JSON.stringify(fallback.body), /SECRETm/);
});

// ------------------------------------------------------------------ one active course

test('one active course at a time on new grants; completed and cancelled ones do not count', async () => {
  const A = await createCourse(db.pool, { title: 'One A', topicCount: 1 });
  const B = await createCourse(db.pool, { title: 'One B', topicCount: 1 });
  const C = await createCourse(db.pool, { title: 'One C', topicCount: 1 });
  const s = await createUser(db.pool);
  assert.equal((await grant(s, A)).status, 201);
  const second = await grant(s, B);
  assert.equal(second.status, 409);
  assert.match(second.body.error.message, /active course/);
  assert.equal((await rowsOf(s)).length, 1, 'nothing was created');
  // after a valid completion another course can be granted, and the completed one is kept
  assert.equal((await call('POST', `/api/eduyarp/topics/${A.topicIds[0]}/complete`, { token: s.token })).body.enrolmentStatus, 'completed');
  assert.equal((await grant(s, B)).status, 201);
  assert.equal((await grant(s, C)).status, 409, 'B is active now');
  // cancelling B frees the slot and keeps B's history
  const b = (await rowsOf(s)).find((r) => String(r.course_id) === String(B.id));
  await call('PATCH', `/api/admin/eduyarp/enrolments/${b.id}`, { token: admin.token, body: { status: 'cancelled' } });
  assert.equal((await grant(s, C)).status, 201);
  assert.deepEqual((await rowsOf(s)).map((r) => r.status), ['completed', 'cancelled', 'active']);
  // a cancelled course can be granted again later (history kept, a new enrolment)
  await db.pool.query("UPDATE enrolments SET status = 'cancelled' WHERE student_id = $1 AND status = 'active'", [s.id]);
  assert.equal((await grant(s, B)).status, 201);
  assert.equal((await rowsOf(s)).filter((r) => String(r.course_id) === String(B.id)).length, 2);
});

test('concurrent grants for one student create exactly one active enrolment', async () => {
  const courses = await Promise.all([1, 2, 3, 4, 5].map((i) => createCourse(db.pool, { title: `Race ${i}`, topicCount: 2 })));
  const s = await createUser(db.pool);
  const results = await Promise.all(courses.map((c) => grant(s, c)));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 4);
  assert.equal((await rowsOf(s)).filter((r) => r.status === 'active').length, 1);
  // the same course granted concurrently also yields one
  const c = await createCourse(db.pool, { title: 'Race same', topicCount: 2 });
  const t = await createUser(db.pool);
  const same = await Promise.all([1, 2, 3, 4].map(() => grant(t, c)));
  assert.equal(same.filter((r) => r.status === 201).length, 1);
  assert.equal((await rowsOf(t)).length, 1);
});

test('students with several active enrolments from before keep access and progress; only NEW grants are limited', async () => {
  const A = await createCourse(db.pool, { title: 'Legacy A', topicCount: 2 });
  const B = await createCourse(db.pool, { title: 'Legacy B', topicCount: 2 });
  const C = await createCourse(db.pool, { title: 'Legacy C', topicCount: 2 });
  const s = await createUser(db.pool);
  await enrol(db.pool, s.id, A.id);
  await enrol(db.pool, s.id, B.id);
  await db.pool.query('INSERT INTO topic_progress (student_id, topic_id, completed, completed_at) VALUES ($1, $2, TRUE, now())', [s.id, A.topicIds[0]]);
  const before = await rowsOf(s);
  const list = await call('GET', '/api/eduyarp/me/courses', { token: s.token });
  assert.equal(list.body.courses.length, 2, 'both keep access');
  assert.equal((await call('GET', `/api/eduyarp/me/courses/${A.id}`, { token: s.token })).body.course.enrolment.progress.completedTopics, 1);
  assert.equal((await call('POST', `/api/eduyarp/topics/${B.topicIds[0]}/complete`, { token: s.token })).status, 200);
  assert.equal((await grant(s, C)).status, 409, 'no third course while two are active');
  assert.deepEqual((await rowsOf(s)).map((r) => [r.id, r.status]), before.map((r) => [r.id, r.status]), 'nothing cancelled or rewritten');
  // finishing one still leaves another active, so still no new grant; revoking both frees the student
  for (const r of before) await call('PATCH', `/api/admin/eduyarp/enrolments/${r.id}`, { token: admin.token, body: { status: 'cancelled' } });
  assert.equal((await grant(s, C)).status, 201);
});

test('a course reopened by a new topic does not break completed students, and the grant rule ignores completed courses', async () => {
  const A = await createCourse(db.pool, { title: 'Reopen A', topicCount: 1 });
  const B = await createCourse(db.pool, { title: 'Reopen B', topicCount: 1 });
  const s = await createUser(db.pool);
  await grant(s, A);
  await call('POST', `/api/eduyarp/topics/${A.topicIds[0]}/complete`, { token: s.token });
  assert.equal((await grant(s, B)).status, 201);
  assert.deepEqual((await rowsOf(s)).map((r) => r.status), ['completed', 'active']);
});
