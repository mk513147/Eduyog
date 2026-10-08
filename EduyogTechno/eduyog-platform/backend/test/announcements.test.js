const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client, createCourse, assign, enrol } = require('./helpers');

let db;
let api;
let call;
let admin;
let t1; // assigned to A
let t2; // assigned to B
let tFree; // assigned to nothing
let active;
let completed;
let cancelled;
let multi; // active in A and B, plus a completed enrolment in C
let noEnrol;
let formerStudent; // completed enrolment, now a Trainer
let courseA;
let courseB;
let courseC;
let courseEmpty;

const notesFor = async (user, type = 'announcement') =>
  (await db.pool.query('SELECT * FROM notifications WHERE recipient_id = $1 AND type = $2 ORDER BY id', [user.id, type])).rows;
const announcementCount = async () => (await db.pool.query('SELECT count(*)::int AS n FROM announcements')).rows[0].n;
const clearAll = async () => {
  await db.pool.query('DELETE FROM notifications');
  await db.pool.query('DELETE FROM announcements');
};

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin' });
  t1 = await createUser(db.pool, { role: 'trainer', fullName: 'Trainer One' });
  t2 = await createUser(db.pool, { role: 'trainer', fullName: 'Trainer Two' });
  tFree = await createUser(db.pool, { role: 'trainer', fullName: 'Trainer Free' });
  active = await createUser(db.pool, { fullName: 'Active Student' });
  completed = await createUser(db.pool, { fullName: 'Completed Student' });
  cancelled = await createUser(db.pool, { fullName: 'Cancelled Student' });
  multi = await createUser(db.pool, { fullName: 'Multi Student' });
  noEnrol = await createUser(db.pool, { fullName: 'No Enrolment' });
  formerStudent = await createUser(db.pool, { fullName: 'Former Student' });
  courseA = await createCourse(db.pool, { title: 'Course A' });
  courseB = await createCourse(db.pool, { title: 'Course B' });
  courseC = await createCourse(db.pool, { title: 'Course C' });
  courseEmpty = await createCourse(db.pool, { title: 'Course Empty' });
  await assign(db.pool, courseA.id, t1.id);
  await assign(db.pool, courseB.id, t2.id);
  await enrol(db.pool, active.id, courseA.id, 'active');
  await enrol(db.pool, completed.id, courseA.id, 'completed');
  await enrol(db.pool, cancelled.id, courseA.id, 'cancelled');
  await enrol(db.pool, multi.id, courseA.id, 'active');
  await enrol(db.pool, multi.id, courseB.id, 'active');
  await enrol(db.pool, multi.id, courseC.id, 'completed');
  await enrol(db.pool, formerStudent.id, courseA.id, 'completed');
  await db.pool.query("UPDATE users SET role = 'trainer' WHERE id = $1", [formerStudent.id]);
});

after(async () => {
  await api.stop();
  await db.drop();
});

const adminPost = (body) => call('POST', '/api/admin/eduyarp/announcements', { token: admin.token, body });
const trainerPost = (user, courseId, body) =>
  call('POST', `/api/eduyarp/trainer/courses/${courseId}/announcements`, { token: user.token, body });

test('authorization: endpoints reject anonymous and wrong-role callers', async () => {
  assert.equal((await call('GET', '/api/admin/eduyarp/announcements')).status, 401);
  assert.equal((await call('GET', '/api/admin/eduyarp/announcements', { token: t1.token })).status, 403);
  assert.equal((await call('GET', '/api/admin/eduyarp/announcements', { token: active.token })).status, 403);
  assert.equal((await call('GET', `/api/eduyarp/trainer/courses/${courseA.id}/announcements`)).status, 401);
  assert.equal((await call('GET', `/api/eduyarp/trainer/courses/${courseA.id}/announcements`, { token: active.token })).status, 403);
  assert.equal((await call('GET', `/api/eduyarp/trainer/courses/${courseA.id}/announcements`, { token: admin.token })).status, 403);
});

test('students cannot create, edit or delete announcements', async () => {
  const body = { title: 'Hi', body: 'There' };
  assert.equal((await call('POST', '/api/admin/eduyarp/announcements', { token: active.token, body })).status, 403);
  assert.equal((await trainerPost(active, courseA.id, body)).status, 403);
  assert.equal((await call('DELETE', '/api/admin/eduyarp/announcements/1', { token: active.token })).status, 403);
  assert.equal((await call('DELETE', '/api/eduyarp/trainer/announcements/1', { token: active.token })).status, 403);
  assert.equal(await announcementCount(), 0);
});

test('Admin creates a course announcement: current students and other assigned Trainers are notified', async () => {
  await clearAll();
  const res = await adminPost({ title: 'Exam moved', body: 'The exam is on Friday.\nBring ID.', courseId: courseA.id });
  assert.equal(res.status, 201);
  assert.equal(res.body.announcement.courseId, courseA.id);
  assert.equal(res.body.announcement.platformWide, false);
  assert.equal(res.body.announcement.body, 'The exam is on Friday.\nBring ID.');
  // active, completed, multi (once) and the assigned trainer t1; not cancelled, not noEnrol, not t2.
  assert.equal(res.body.announcement.notifiedCount, 4);
  for (const u of [active, completed, multi, t1]) {
    const rows = await notesFor(u);
    assert.equal(rows.length, 1, u.id);
    assert.equal(rows[0].title, 'Exam moved');
    assert.equal(rows[0].course_id, courseA.id);
    assert.equal(rows[0].link_path, '/announcements');
    assert.equal(rows[0].read_at, null);
  }
  for (const u of [cancelled, noEnrol, t2, tFree, admin, formerStudent]) {
    assert.equal((await notesFor(u)).length, 0, `user ${u.id} must not be notified`);
  }
});

test('a Student who became a Trainer/Admin does not receive student notifications from old completed enrolments', async () => {
  assert.equal((await notesFor(formerStudent)).length, 0);
});

test('Admin creates a platform-wide announcement: one notification per current student, no duplicates', async () => {
  await clearAll();
  const res = await adminPost({ title: 'Holiday', body: 'Closed on Monday.' });
  assert.equal(res.status, 201);
  assert.equal(res.body.announcement.platformWide, true);
  assert.equal(res.body.announcement.courseId, null);
  assert.equal(res.body.announcement.notifiedCount, 3);
  assert.equal((await notesFor(multi)).length, 1, 'multi-course student gets exactly one');
  assert.equal((await notesFor(active)).length, 1);
  assert.equal((await notesFor(completed)).length, 1);
  assert.equal((await notesFor(cancelled)).length, 0, 'cancelled-only student excluded');
  assert.equal((await notesFor(noEnrol)).length, 0, 'student with no enrolment excluded');
  assert.equal((await notesFor(t1)).length, 0);
  const total = await db.pool.query("SELECT count(*)::int AS n FROM notifications WHERE type = 'announcement'");
  assert.equal(total.rows[0].n, 3);
  assert.equal((await db.pool.query('SELECT course_id FROM notifications LIMIT 1')).rows[0].course_id, null);
});

test('a course with no students still accepts an announcement', async () => {
  await clearAll();
  const res = await adminPost({ title: 'Quiet', body: 'Nobody here yet.', courseId: courseEmpty.id });
  assert.equal(res.status, 201);
  assert.equal(res.body.announcement.notifiedCount, 0);
});

test('Admin: unknown course is a 400, malformed ids are rejected', async () => {
  assert.equal((await adminPost({ title: 'x', body: 'y', courseId: '999999' })).status, 400);
  assert.equal((await adminPost({ title: 'x', body: 'y', courseId: 'abc' })).status, 400);
  assert.equal((await adminPost({ title: 'x', body: 'y', courseId: '1; DROP' })).status, 400);
});

test('Trainer creates an announcement on an assigned course; students and co-trainers are notified, not the author', async () => {
  await clearAll();
  const co = await createUser(db.pool, { role: 'trainer' });
  await assign(db.pool, courseA.id, co.id);
  const res = await trainerPost(t1, courseA.id, { title: 'From trainer', body: 'Read chapter 3.' });
  assert.equal(res.status, 201);
  assert.equal(res.body.announcement.authorName, 'Trainer One');
  assert.equal((await notesFor(active)).length, 1);
  assert.equal((await notesFor(co)).length, 1);
  assert.equal((await notesFor(t1)).length, 0);
  await db.pool.query('DELETE FROM course_trainers WHERE trainer_id = $1', [co.id]);
});

test('Trainer cannot create for an unassigned course, a missing course, or platform-wide', async () => {
  await clearAll();
  assert.equal((await trainerPost(t1, courseB.id, { title: 'x', body: 'y' })).status, 403);
  assert.equal((await trainerPost(tFree, courseA.id, { title: 'x', body: 'y' })).status, 403);
  assert.equal((await trainerPost(t1, '999999', { title: 'x', body: 'y' })).status, 403);
  assert.equal((await call('POST', '/api/admin/eduyarp/announcements', { token: t1.token, body: { title: 'x', body: 'y' } })).status, 403);
  // a courseId in the body of a Trainer request is ignored: the URL decides
  const sneaky = await trainerPost(t1, courseA.id, { title: 'sneaky', body: 'y', courseId: courseB.id });
  assert.equal(sneaky.status, 201);
  assert.equal(sneaky.body.announcement.courseId, courseA.id);
  assert.equal(await announcementCount(), 1);
});

test('Trainer: unassigned Trainers cannot list another course announcements; assigned ones can', async () => {
  await clearAll();
  await adminPost({ title: 'For A', body: 'a', courseId: courseA.id });
  const own = await call('GET', `/api/eduyarp/trainer/courses/${courseA.id}/announcements`, { token: t1.token });
  assert.equal(own.status, 200);
  assert.equal(own.body.announcements.length, 1);
  assert.equal((await call('GET', `/api/eduyarp/trainer/courses/${courseA.id}/announcements`, { token: t2.token })).status, 403);
  assert.equal((await call('GET', '/api/eduyarp/trainer/courses/abc/announcements', { token: t1.token })).status, 400);
});

test('Trainer unassignment and demotion remove access immediately', async () => {
  const t = await createUser(db.pool, { role: 'trainer' });
  await assign(db.pool, courseEmpty.id, t.id);
  const url = `/api/eduyarp/trainer/courses/${courseEmpty.id}/announcements`;
  assert.equal((await call('GET', url, { token: t.token })).status, 200);
  await db.pool.query('DELETE FROM course_trainers WHERE trainer_id = $1', [t.id]);
  assert.equal((await call('GET', url, { token: t.token })).status, 403);
  assert.equal((await trainerPost(t, courseEmpty.id, { title: 'x', body: 'y' })).status, 403);
  await assign(db.pool, courseEmpty.id, t.id);
  await db.pool.query("UPDATE users SET role = 'student' WHERE id = $1", [t.id]);
  assert.equal((await call('GET', url, { token: t.token })).status, 403);
});

test('validation: empty, whitespace-only and over-long title/body are rejected', async () => {
  const before = await announcementCount();
  for (const bad of [
    {},
    { title: '', body: 'b' },
    { title: 'a', body: '' },
    { title: '   ', body: 'b' },
    { title: 'a', body: '  \n ' },
    { title: 'x'.repeat(201), body: 'b' },
    { title: 'a', body: 'b'.repeat(3001) },
    { title: 5, body: 'b' },
    { title: 'a', body: ['b'] },
  ]) {
    const res = await trainerPost(t1, courseA.id, bad);
    assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(await announcementCount(), before);
  const edge = await trainerPost(t1, courseA.id, { title: 'x'.repeat(200), body: 'b'.repeat(3000) });
  assert.equal(edge.status, 201);
});

test('long announcement text produces a short notification body (excerpt, never over 500)', async () => {
  await clearAll();
  const res = await adminPost({ title: 'Long one', body: 'word '.repeat(500), courseId: courseA.id });
  assert.equal(res.status, 201);
  const row = (await notesFor(active))[0];
  assert.ok(row.body.length <= 500 && row.body.endsWith('…'));
  const full = await call('GET', '/api/me/announcements', { token: active.token });
  assert.equal(full.body.announcements[0].body.length, 'word '.repeat(500).trim().length);
});

test('a rapid double submit does not create two announcements', async () => {
  await clearAll();
  const send = () => trainerPost(t1, courseA.id, { title: 'Double click', body: 'Same text' });
  const results = await Promise.all([send(), send(), send()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
  assert.equal(await announcementCount(), 1);
  assert.equal((await notesFor(active)).length, 1);
});

test('failed notification creation rolls the announcement back (transactional)', async () => {
  await clearAll();
  await db.pool.query('ALTER TABLE notifications RENAME TO notifications_hidden');
  try {
    const res = await trainerPost(t1, courseA.id, { title: 'Will fail', body: 'x' });
    assert.equal(res.status, 500);
    assert.equal(await announcementCount(), 0, 'no announcement without its notifications');
  } finally {
    await db.pool.query('ALTER TABLE notifications_hidden RENAME TO notifications');
  }
  const retry = await trainerPost(t1, courseA.id, { title: 'Will fail', body: 'x' });
  assert.equal(retry.status, 201);
});

test('Admin list: all, by course, platform-only, and invalid filters', async () => {
  await clearAll();
  await adminPost({ title: 'P', body: 'p' });
  await adminPost({ title: 'A1', body: 'a', courseId: courseA.id });
  await adminPost({ title: 'B1', body: 'b', courseId: courseB.id });
  const get = (q) => call('GET', `/api/admin/eduyarp/announcements${q}`, { token: admin.token });
  assert.deepEqual((await get('')).body.announcements.map((a) => a.title), ['B1', 'A1', 'P']);
  assert.deepEqual((await get(`?courseId=${courseA.id}`)).body.announcements.map((a) => a.title), ['A1']);
  assert.deepEqual((await get('?scope=platform')).body.announcements.map((a) => a.title), ['P']);
  assert.equal((await get('?courseId=abc')).status, 400);
  assert.equal((await get('?scope=weird')).status, 400);
  const row = (await get('')).body.announcements.find((a) => a.title === 'A1');
  assert.equal(row.courseTitle, 'Course A');
  assert.equal(row.authorRole, 'admin');
});

test('delete: Admin can delete any announcement; unknown or malformed ids are safe', async () => {
  await clearAll();
  const created = (await adminPost({ title: 'Del', body: 'x', courseId: courseA.id })).body.announcement;
  assert.equal((await call('DELETE', `/api/admin/eduyarp/announcements/${created.id}`, { token: admin.token })).status, 204);
  assert.equal((await call('DELETE', `/api/admin/eduyarp/announcements/${created.id}`, { token: admin.token })).status, 404);
  assert.equal((await call('DELETE', '/api/admin/eduyarp/announcements/abc', { token: admin.token })).status, 400);
  assert.equal((await call('DELETE', '/api/eduyarp/trainer/announcements/abc', { token: t1.token })).status, 400);
  assert.equal((await call('DELETE', '/api/eduyarp/trainer/announcements/999999', { token: t1.token })).status, 404);
});

test('delete: a Trainer deletes their own announcement, but not other authors, other courses or platform-wide', async () => {
  await clearAll();
  const own = (await trainerPost(t1, courseA.id, { title: 'Mine', body: 'x' })).body.announcement;
  const byAdminA = (await adminPost({ title: 'Admin A', body: 'x', courseId: courseA.id })).body.announcement;
  const byT2 = (await trainerPost(t2, courseB.id, { title: 'T2', body: 'x' })).body.announcement;
  const platform = (await adminPost({ title: 'Platform', body: 'x' })).body.announcement;
  const del = (user, id) => call('DELETE', `/api/eduyarp/trainer/announcements/${id}`, { token: user.token });

  assert.equal((await del(t1, byAdminA.id)).status, 403, "someone else's announcement on my course");
  assert.equal((await del(t1, byT2.id)).status, 404, "another trainer's course looks like it does not exist");
  assert.equal((await del(t1, platform.id)).status, 404, 'platform-wide is not a Trainer matter');
  assert.equal((await del(t2, own.id)).status, 404, 'cannot delete by guessing the id of another course');
  assert.equal((await del(tFree, own.id)).status, 404);
  assert.equal(await announcementCount(), 4);
  assert.equal((await del(t1, own.id)).status, 204);
  assert.equal(await announcementCount(), 3);
});

test('delete: a Trainer who is no longer assigned cannot delete their old announcement', async () => {
  await clearAll();
  const t = await createUser(db.pool, { role: 'trainer' });
  await assign(db.pool, courseEmpty.id, t.id);
  const made = (await trainerPost(t, courseEmpty.id, { title: 'Old', body: 'x' })).body.announcement;
  await db.pool.query('DELETE FROM course_trainers WHERE trainer_id = $1', [t.id]);
  assert.equal((await call('DELETE', `/api/eduyarp/trainer/announcements/${made.id}`, { token: t.token })).status, 404);
  assert.equal(await announcementCount(), 1);
});

test('a demoted author keeps their announcement as history and loses Trainer actions', async () => {
  await clearAll();
  const t = await createUser(db.pool, { role: 'trainer', fullName: 'Soon Student' });
  await assign(db.pool, courseEmpty.id, t.id);
  const made = (await trainerPost(t, courseEmpty.id, { title: 'History', body: 'x' })).body.announcement;
  await db.pool.query("UPDATE users SET role = 'student' WHERE id = $1", [t.id]);
  assert.equal((await trainerPost(t, courseEmpty.id, { title: 'More', body: 'y' })).status, 403);
  assert.equal((await call('DELETE', `/api/eduyarp/trainer/announcements/${made.id}`, { token: t.token })).status, 403);
  const list = await call('GET', `/api/admin/eduyarp/announcements?courseId=${courseEmpty.id}`, { token: admin.token });
  assert.equal(list.body.announcements[0].authorName, 'Soon Student');
});

test('GET /api/me/announcements: students see their courses and platform-wide, nothing else', async () => {
  await clearAll();
  await adminPost({ title: 'Platform', body: 'p' });
  await adminPost({ title: 'Only A', body: 'a', courseId: courseA.id });
  await adminPost({ title: 'Only B', body: 'b', courseId: courseB.id });
  const titles = async (u) => (await call('GET', '/api/me/announcements', { token: u.token })).body.announcements.map((a) => a.title).sort();
  assert.deepEqual(await titles(active), ['Only A', 'Platform']);
  assert.deepEqual(await titles(completed), ['Only A', 'Platform']);
  assert.deepEqual(await titles(multi), ['Only A', 'Only B', 'Platform']);
  assert.deepEqual(await titles(cancelled), []);
  assert.deepEqual(await titles(noEnrol), []);
  assert.deepEqual(await titles(t1), ['Only A']);
  assert.deepEqual(await titles(t2), ['Only B']);
  assert.deepEqual(await titles(tFree), []);
  assert.deepEqual(await titles(admin), []);
});

test('cancelling an enrolment stops announcements and new notifications for that student', async () => {
  await clearAll();
  const s = await createUser(db.pool, { fullName: 'Leaver' });
  await enrol(db.pool, s.id, courseEmpty.id, 'active');
  await db.pool.query("UPDATE enrolments SET status = 'cancelled' WHERE student_id = $1", [s.id]);
  await adminPost({ title: 'After', body: 'x', courseId: courseEmpty.id });
  await adminPost({ title: 'Everyone', body: 'x' });
  assert.equal((await notesFor(s)).length, 0);
  assert.deepEqual((await call('GET', '/api/me/announcements', { token: s.token })).body.announcements, []);
});

test('deleting an announcement leaves earlier notifications as plain history', async () => {
  await clearAll();
  const made = (await adminPost({ title: 'Gone soon', body: 'x', courseId: courseA.id })).body.announcement;
  await call('DELETE', `/api/admin/eduyarp/announcements/${made.id}`, { token: admin.token });
  assert.equal((await notesFor(active)).length, 1);
});

test('a Student made Trainer through the Admin API no longer receives announcements or class news', async () => {
  await clearAll();
  const s = await createUser(db.pool, { fullName: 'Promoted' });
  await enrol(db.pool, s.id, courseEmpty.id, 'active');
  const role = await call('PATCH', `/api/admin/users/${s.id}/role`, { token: admin.token, body: { role: 'trainer' } });
  assert.equal(role.status, 200);
  await adminPost({ title: 'After promotion', body: 'x', courseId: courseEmpty.id });
  await adminPost({ title: 'Platform after', body: 'x' });
  assert.equal((await notesFor(s)).length, 0);
});
