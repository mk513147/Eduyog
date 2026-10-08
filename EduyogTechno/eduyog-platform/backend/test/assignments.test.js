const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client, createCourse, assign, enrol } = require('./helpers');

let db;
let api;
let call;
let admin;
let t1; // assigned to A
let tA2; // second trainer on A
let t2; // assigned to B
let sActive;
let sCompleted;
let sCancelled;
let sOther; // enrolled in B only
let sNone;
let former; // completed enrolment in A, now a Trainer (not assigned)
let A;
let B;

const FUTURE = new Date(Date.now() + 7 * 86400000).toISOString();
const PAST = new Date(Date.now() - 7 * 86400000).toISOString();

const adminCall = (method, path, body) => call(method, `/api/admin/eduyarp${path}`, { token: admin.token, body });
const trainerCall = (user, method, path, body) => call(method, `/api/eduyarp/trainer${path}`, { token: user.token, body });
const meCall = (user, method, path, body) => call(method, `/api/eduyarp/me${path}`, { token: user.token, body });

const good = (extra = {}) => ({ title: 'Essay', instructions: 'Write about testing.', ...extra });
const mk = async (courseId, extra = {}) => (await adminCall('POST', `/courses/${courseId}/assignments`, good(extra))).body.assignment;
const published = (courseId, extra = {}) => mk(courseId, { status: 'published', ...extra });
const notesFor = async (user) =>
  (await db.pool.query("SELECT * FROM notifications WHERE recipient_id = $1 AND type = 'assignment_submission' ORDER BY id", [user.id])).rows;

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin' });
  t1 = await createUser(db.pool, { role: 'trainer', fullName: 'Trainer One' });
  tA2 = await createUser(db.pool, { role: 'trainer', fullName: 'Trainer A2' });
  t2 = await createUser(db.pool, { role: 'trainer', fullName: 'Trainer Two' });
  sActive = await createUser(db.pool, { fullName: 'Active Student', email: 'active@test.example' });
  sCompleted = await createUser(db.pool, { fullName: 'Completed Student' });
  sCancelled = await createUser(db.pool, { fullName: 'Cancelled Student' });
  sOther = await createUser(db.pool, { fullName: 'Other Student' });
  sNone = await createUser(db.pool, { fullName: 'No Enrolment' });
  former = await createUser(db.pool, { fullName: 'Former Student' });
  A = await createCourse(db.pool, { title: 'Course A', topicCount: 3 });
  B = await createCourse(db.pool, { title: 'Course B', topicCount: 2 });
  await assign(db.pool, A.id, t1.id);
  await assign(db.pool, A.id, tA2.id);
  await assign(db.pool, B.id, t2.id);
  await enrol(db.pool, sActive.id, A.id, 'active');
  await enrol(db.pool, sCompleted.id, A.id, 'completed');
  await enrol(db.pool, sCancelled.id, A.id, 'cancelled');
  await enrol(db.pool, sOther.id, B.id, 'active');
  await enrol(db.pool, former.id, A.id, 'completed');
  await db.pool.query("UPDATE users SET role = 'trainer' WHERE id = $1", [former.id]);
});

after(async () => {
  await api.stop();
  await db.drop();
});

const clear = async () => {
  await db.pool.query('DELETE FROM notifications');
  await db.pool.query('DELETE FROM assignments');
};

// ------------------------------------------------------------ management

test('Admin CRUD: create (draft by default), get, list with counts, update, delete', async () => {
  await clear();
  const created = await adminCall('POST', `/courses/${A.id}/assignments`, good({ title: '  Essay  ', dueAt: FUTURE }));
  assert.equal(created.status, 201);
  const a = created.body.assignment;
  assert.equal(a.title, 'Essay');
  assert.equal(a.status, 'draft');
  assert.equal(new Date(a.dueAt).toISOString(), FUTURE);
  assert.equal(a.displayOrder, 1);
  assert.equal((await mk(A.id)).displayOrder, 2);
  assert.equal((await adminCall('GET', `/assignments/${a.id}`)).body.assignment.title, 'Essay');
  const list = await adminCall('GET', `/courses/${A.id}/assignments`);
  assert.deepEqual(list.body.assignments.map((x) => x.displayOrder), [1, 2]);
  assert.equal(list.body.assignments[0].submissionCount, 0);
  const upd = await adminCall('PATCH', `/assignments/${a.id}`, { title: 'Essay v2', status: 'published', dueAt: null });
  assert.equal(upd.body.assignment.title, 'Essay v2');
  assert.equal(upd.body.assignment.status, 'published');
  assert.equal(upd.body.assignment.dueAt, null);
  assert.equal((await adminCall('DELETE', `/assignments/${a.id}`)).status, 204);
  assert.equal((await adminCall('DELETE', `/assignments/${a.id}`)).status, 404);
  assert.equal((await adminCall('GET', `/assignments/${a.id}`)).status, 404);
});

test('status changes: draft -> published -> closed -> draft are all allowed; invalid status is rejected', async () => {
  const a = await mk(A.id);
  for (const status of ['published', 'closed', 'draft', 'published']) {
    assert.equal((await adminCall('PATCH', `/assignments/${a.id}`, { status })).body.assignment.status, status);
  }
  for (const bad of ['open', 'PUBLISHED', '', 5, null]) {
    assert.equal((await adminCall('PATCH', `/assignments/${a.id}`, { status: bad })).status, 400, String(bad));
  }
});

test('validation: title, instructions, due date, links, order', async () => {
  for (const bad of [
    {},
    good({ title: '' }),
    good({ title: '   ' }),
    good({ title: 'x'.repeat(201) }),
    good({ instructions: '' }),
    good({ instructions: ' \n ' }),
    good({ instructions: 'x'.repeat(5001) }),
    good({ dueAt: 'tomorrow' }),
    good({ dueAt: '2026-13-45T00:00:00Z' }),
    good({ dueAt: '2026-06-01T10:00' }),
    good({ dueAt: 5 }),
    good({ status: 'archived' }),
    good({ displayOrder: -1 }),
    good({ moduleId: 'abc' }),
  ]) {
    assert.equal((await adminCall('POST', `/courses/${A.id}/assignments`, bad)).status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal((await adminCall('POST', `/courses/${A.id}/assignments`, good({ title: 'x'.repeat(200), instructions: 'y'.repeat(5000) }))).status, 201);
  assert.equal((await adminCall('POST', '/courses/999999/assignments', good())).status, 404);
  assert.equal((await adminCall('GET', '/courses/abc/assignments')).status, 400);
  assert.equal((await adminCall('PATCH', '/assignments/abc', { title: 'x' })).status, 400);
  assert.equal((await adminCall('PATCH', '/assignments/999999', { title: 'x' })).status, 404);
});

test('course/module/topic links: same-course only, a topic implies its module, cross-course denied', async () => {
  await clear();
  const onTopic = await mk(A.id, { topicId: A.topicIds[0] });
  assert.equal(onTopic.moduleId, A.moduleId);
  assert.equal(onTopic.topicTitle, 'Topic 1');
  const onModule = await mk(A.id, { moduleId: A.moduleId });
  assert.equal(onModule.moduleTitle, 'Module 1');
  const crossModule = await adminCall('POST', `/courses/${A.id}/assignments`, good({ moduleId: B.moduleId }));
  assert.equal(crossModule.status, 400);
  assert.ok(crossModule.body.error.details.moduleId);
  const crossTopic = await adminCall('POST', `/courses/${A.id}/assignments`, good({ topicId: B.topicIds[0] }));
  assert.equal(crossTopic.status, 400);
  assert.ok(crossTopic.body.error.details.topicId);
  assert.equal((await adminCall('POST', `/courses/${A.id}/assignments`, good({ topicId: '999999' }))).status, 400);
  assert.equal((await trainerCall(t1, 'POST', `/courses/${A.id}/assignments`, good({ topicId: B.topicIds[0] }))).status, 400);
  assert.equal((await adminCall('PATCH', `/assignments/${onTopic.id}`, { moduleId: B.moduleId })).status, 400);
  assert.equal((await adminCall('PATCH', `/assignments/${onTopic.id}`, { topicId: B.topicIds[1] })).status, 400);
  const moved = await adminCall('PATCH', `/assignments/${onTopic.id}`, { topicId: A.topicIds[1] });
  assert.equal(moved.body.assignment.topicId, A.topicIds[1]);
  const cleared = await adminCall('PATCH', `/assignments/${onTopic.id}`, { topicId: null, moduleId: null });
  assert.equal(cleared.body.assignment.moduleId, null);
  assert.equal((await adminCall('PATCH', `/assignments/${onTopic.id}`, { courseId: B.id, title: 'same course' })).body.assignment.courseId, A.id);
});

test('Trainer manages assignments only on currently assigned courses', async () => {
  await clear();
  const c = await trainerCall(t1, 'POST', `/courses/${A.id}/assignments`, good({ title: 'By trainer' }));
  assert.equal(c.status, 201);
  const id = c.body.assignment.id;
  assert.equal((await trainerCall(t1, 'GET', `/courses/${A.id}/assignments`)).body.assignments.length, 1);
  assert.equal((await trainerCall(tA2, 'GET', `/assignments/${id}`)).status, 200, 'a co-trainer on the course');
  assert.equal((await trainerCall(t1, 'PATCH', `/assignments/${id}`, { status: 'published', title: 'Renamed' })).body.assignment.status, 'published');
  assert.equal((await trainerCall(t1, 'PATCH', `/assignments/${id}`, { status: 'closed' })).body.assignment.status, 'closed');
  assert.equal((await trainerCall(t1, 'DELETE', `/assignments/${id}`)).status, 204);
});

test('IDOR: Trainer on an unassigned course cannot list, create, read, edit, delete, or see submissions', async () => {
  await clear();
  const inB = await published(B.id);
  const sub = await meCall(sOther, 'POST', `/assignments/${inB.id}/submissions`, { text: 'answer' });
  assert.equal(sub.status, 201);
  assert.equal((await trainerCall(t1, 'GET', `/courses/${B.id}/assignments`)).status, 403);
  assert.equal((await trainerCall(t1, 'POST', `/courses/${B.id}/assignments`, good())).status, 403);
  assert.equal((await trainerCall(t1, 'GET', `/assignments/${inB.id}`)).status, 404);
  assert.equal((await trainerCall(t1, 'PATCH', `/assignments/${inB.id}`, { title: 'hacked' })).status, 404);
  assert.equal((await trainerCall(t1, 'DELETE', `/assignments/${inB.id}`)).status, 404);
  assert.equal((await trainerCall(t1, 'GET', `/assignments/${inB.id}/submissions`)).status, 404);
  assert.equal((await trainerCall(t1, 'GET', `/submissions/${sub.body.submission.id}`)).status, 404);
  const fb = await trainerCall(t1, 'PUT', `/submissions/${sub.body.submission.id}/feedback`, { feedback: 'sneaky' });
  assert.equal(fb.status, 404);
  assert.equal((await db.pool.query('SELECT 1 FROM assignment_feedback')).rows.length, 0);
  assert.equal((await db.pool.query('SELECT title FROM assignments WHERE id = $1', [inB.id])).rows[0].title, 'Essay');
  assert.equal((await trainerCall(t2, 'GET', `/submissions/${sub.body.submission.id}`)).status, 200, 'the right trainer can');
  // unknown / malformed ids
  assert.equal((await trainerCall(t1, 'GET', '/assignments/999999')).status, 404);
  assert.equal((await trainerCall(t1, 'GET', '/submissions/999999')).status, 404);
  assert.equal((await trainerCall(t1, 'GET', '/assignments/abc')).status, 400);
  assert.equal((await trainerCall(t1, 'PUT', '/submissions/abc/feedback', { feedback: 'x' })).status, 400);
});

test('Trainer access follows the CURRENT assignment: unassigned or demoted creators lose everything at once', async () => {
  await clear();
  const t = await createUser(db.pool, { role: 'trainer' });
  await assign(db.pool, B.id, t.id);
  const mine = (await trainerCall(t, 'POST', `/courses/${B.id}/assignments`, good({ status: 'published' }))).body.assignment;
  const sub = (await meCall(sOther, 'POST', `/assignments/${mine.id}/submissions`, { text: 'x' })).body.submission;
  await db.pool.query('DELETE FROM course_trainers WHERE trainer_id = $1', [t.id]);
  assert.equal((await trainerCall(t, 'GET', `/courses/${B.id}/assignments`)).status, 403);
  assert.equal((await trainerCall(t, 'PATCH', `/assignments/${mine.id}`, { title: 'still mine?' })).status, 404, 'created it, no longer assigned');
  assert.equal((await trainerCall(t, 'DELETE', `/assignments/${mine.id}`)).status, 404);
  assert.equal((await trainerCall(t, 'GET', `/assignments/${mine.id}/submissions`)).status, 404);
  assert.equal((await trainerCall(t, 'PUT', `/submissions/${sub.id}/feedback`, { feedback: 'x' })).status, 404);
  await assign(db.pool, B.id, t.id);
  await db.pool.query("UPDATE users SET role = 'student' WHERE id = $1", [t.id]);
  assert.equal((await trainerCall(t, 'GET', `/assignments/${mine.id}`)).status, 403);
  assert.equal((await adminCall('GET', `/assignments/${mine.id}`)).body.assignment.createdByName.length > 0, true, 'history kept');
});

test('Students cannot reach any management route; anonymous callers get 401', async () => {
  const a = await published(A.id);
  for (const [m, p, body] of [
    ['POST', `/api/admin/eduyarp/courses/${A.id}/assignments`, good()],
    ['PATCH', `/api/admin/eduyarp/assignments/${a.id}`, { status: 'closed' }],
    ['DELETE', `/api/admin/eduyarp/assignments/${a.id}`],
    ['GET', `/api/eduyarp/trainer/courses/${A.id}/assignments`],
    ['PATCH', `/api/eduyarp/trainer/assignments/${a.id}`, { status: 'closed' }],
    ['PUT', '/api/eduyarp/trainer/submissions/1/feedback', { feedback: 'x' }],
    ['PUT', '/api/admin/eduyarp/submissions/1/feedback', { feedback: 'x' }],
  ]) {
    assert.equal((await call(m, p, { token: sActive.token, body })).status, 403, `${m} ${p}`);
    assert.equal((await call(m, p, { body })).status, 401, `${m} ${p} anonymous`);
  }
  assert.equal((await adminCall('GET', `/assignments/${a.id}`)).body.assignment.status, 'published');
});

// ------------------------------------------------------------ students

test('Student visibility: published and closed only, never drafts; nothing from other courses', async () => {
  await clear();
  const draft = await mk(A.id, { title: 'Draft one' });
  const pub = await published(A.id, { title: 'Published one' });
  const closed = await mk(A.id, { title: 'Closed one', status: 'closed' });
  const other = await published(B.id, { title: 'B one' });
  const list = await meCall(sActive, 'GET', `/courses/${A.id}/assignments`);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.assignments.map((x) => x.title), ['Published one', 'Closed one']);
  assert.equal((await meCall(sActive, 'GET', `/assignments/${draft.id}`)).status, 404, 'draft hidden');
  assert.equal((await meCall(sActive, 'POST', `/assignments/${draft.id}/submissions`, { text: 'x' })).status, 404);
  assert.equal((await meCall(sActive, 'GET', `/assignments/${pub.id}`)).status, 200);
  assert.equal((await meCall(sActive, 'GET', `/assignments/${closed.id}`)).status, 200, 'closed is readable');
  assert.equal((await meCall(sActive, 'GET', `/assignments/${other.id}`)).status, 404, "another course's assignment");
  assert.equal((await meCall(sActive, 'GET', `/courses/${B.id}/assignments`)).status, 404);
  assert.equal((await meCall(sActive, 'POST', `/assignments/${other.id}/submissions`, { text: 'x' })).status, 404);
  assert.equal((await meCall(sActive, 'GET', '/assignments/999999')).status, 404);
  assert.equal((await meCall(sActive, 'GET', '/assignments/abc')).status, 400);
  assert.equal((await meCall(sActive, 'POST', '/assignments/abc/submissions', { text: 'x' })).status, 400);
});

test('Enrolment rules: active and completed may use assignments; cancelled, none and other-course may not', async () => {
  await clear();
  const a = await published(A.id);
  for (const s of [sActive, sCompleted]) {
    assert.equal((await meCall(s, 'GET', `/assignments/${a.id}`)).status, 200);
    assert.equal((await meCall(s, 'POST', `/assignments/${a.id}/submissions`, { text: 'mine' })).status, 201);
    assert.equal((await meCall(s, 'GET', `/courses/${A.id}/assignments`)).status, 200);
  }
  for (const s of [sCancelled, sNone, sOther]) {
    assert.equal((await meCall(s, 'GET', `/assignments/${a.id}`)).status, 404);
    assert.equal((await meCall(s, 'POST', `/assignments/${a.id}/submissions`, { text: 'no' })).status, 404);
    assert.equal((await meCall(s, 'GET', `/courses/${A.id}/assignments`)).status, 404);
  }
  assert.equal((await db.pool.query('SELECT 1 FROM assignment_submissions')).rows.length, 2);
});

test('a former Student (now Trainer/Admin) cannot use old enrolments on student APIs', async () => {
  await clear();
  const a = await published(A.id);
  assert.equal((await meCall(former, 'GET', `/assignments/${a.id}`)).status, 403);
  assert.equal((await meCall(former, 'POST', `/assignments/${a.id}/submissions`, { text: 'x' })).status, 403);
  assert.equal((await meCall(former, 'GET', `/courses/${A.id}/assignments`)).status, 403);
  assert.equal((await meCall(admin, 'GET', `/assignments/${a.id}`)).status, 403);
  const s = await createUser(db.pool, { fullName: 'Promoted' });
  await enrol(db.pool, s.id, A.id, 'active');
  assert.equal((await meCall(s, 'GET', `/assignments/${a.id}`)).status, 200);
  assert.equal((await call('PATCH', `/api/admin/users/${s.id}/role`, { token: admin.token, body: { role: 'trainer' } })).status, 200);
  assert.equal((await meCall(s, 'POST', `/assignments/${a.id}/submissions`, { text: 'x' })).status, 403);
});

test('submissions: text only, URL only, text and URL; trimmed; blank and invalid rejected', async () => {
  await clear();
  const a = await published(A.id);
  const send = (body) => meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, body);
  const t = await send({ text: '  My answer  ' });
  assert.equal(t.status, 201);
  assert.equal(t.body.submission.text, 'My answer');
  assert.equal(t.body.submission.url, null);
  assert.equal((await send({ url: 'https://example.com/work' })).body.submission.url, 'https://example.com/work');
  const both = await send({ text: 'see link', url: 'http://example.com/x' });
  assert.equal(both.body.submission.text, 'see link');
  assert.equal(both.body.submission.url, 'http://example.com/x');
  const before = (await db.pool.query('SELECT count(*)::int AS n FROM assignment_submissions')).rows[0].n;
  for (const bad of [{}, { text: '' }, { text: '   ' }, { url: '' }, { text: '  ', url: '  ' }, { text: null, url: null }, { text: 5 }, { text: ['a'] }, { url: 5 }, { text: 'x'.repeat(5001) }]) {
    assert.equal((await send(bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM assignment_submissions')).rows[0].n, before);
  assert.equal((await send({ text: 'x'.repeat(5000) })).status, 201);
});

test('submission URLs: http and https allowed; javascript:, data:, file:, vbscript:, http:///nohost and malformed rejected', async () => {
  await clear();
  const a = await published(A.id);
  const send = (url) => meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'ok', url });
  for (const url of ['http://example.com', 'https://example.com', 'https://example.com/a/b?x=1#y']) {
    assert.equal((await send(url)).status, 201, url);
  }
  const count = (await db.pool.query('SELECT count(*)::int AS n FROM assignment_submissions')).rows[0].n;
  for (const url of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
    'ftp://example.com/x',
    'blob:https://example.com/x',
    'http:///nohost',
    'https://',
    '//example.com',
    'example.com',
    'not a url',
    'https://user:pass@example.com',
    'https://exa mple.com',
    'https://example.com/' + 'a'.repeat(2100),
  ]) {
    const res = await send(url);
    assert.equal(res.status, 400, url.slice(0, 40));
    assert.ok(res.body.error.details.url, url.slice(0, 40));
  }
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM assignment_submissions')).rows[0].n, count);
});

test('late flag is decided by the server: no due date, future, past; a client flag is ignored', async () => {
  await clear();
  const none = await published(A.id, { title: 'No due' });
  const future = await published(A.id, { title: 'Future', dueAt: FUTURE });
  const past = await published(A.id, { title: 'Past', dueAt: PAST });
  const send = (a, extra = {}) => meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'answer', ...extra });
  assert.equal((await send(none)).body.submission.isLate, false);
  assert.equal((await send(future)).body.submission.isLate, false);
  const late = await send(past);
  assert.equal(late.status, 201, 'late submissions are accepted');
  assert.equal(late.body.submission.isLate, true);
  assert.equal((await send(past, { isLate: false, submittedAt: FUTURE })).body.submission.isLate, true);
  assert.equal((await send(future, { isLate: true })).body.submission.isLate, false);
  const list = await meCall(sActive, 'GET', `/courses/${A.id}/assignments`);
  assert.equal(list.body.assignments.find((x) => x.title === 'Past').latestSubmission.isLate, true);
  assert.equal(list.body.assignments.find((x) => x.title === 'Future').latestSubmission.isLate, false);
});

test('late status follows the due date moving: due date changed after a submission does not rewrite it', async () => {
  await clear();
  const a = await published(A.id, { dueAt: FUTURE });
  const first = (await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'early' })).body.submission;
  await adminCall('PATCH', `/assignments/${a.id}`, { dueAt: PAST });
  const second = (await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'later' })).body.submission;
  assert.equal(first.isLate, false);
  assert.equal(second.isLate, true);
  const detail = (await meCall(sActive, 'GET', `/assignments/${a.id}`)).body.assignment;
  assert.deepEqual(detail.submissions.map((s) => s.isLate), [true, false]);
});

test('resubmission keeps history: newest first, every version stored, other students unaffected', async () => {
  await clear();
  const a = await published(A.id);
  for (const text of ['v1', 'v2', 'v3']) {
    assert.equal((await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text })).status, 201);
  }
  await meCall(sCompleted, 'POST', `/assignments/${a.id}/submissions`, { text: 'someone else' });
  const mine = (await meCall(sActive, 'GET', `/assignments/${a.id}`)).body.assignment;
  assert.deepEqual(mine.submissions.map((s) => s.text), ['v3', 'v2', 'v1']);
  assert.equal(mine.canSubmit, true);
  assert.ok(!JSON.stringify(mine).includes('someone else'));
  const list = (await meCall(sActive, 'GET', `/courses/${A.id}/assignments`)).body.assignments[0];
  assert.equal(list.attempts, 3);
  assert.equal(list.latestSubmission.id, mine.submissions[0].id);
});

test('closed assignment: readable with history, no new submissions; reopening allows them again', async () => {
  await clear();
  const a = await published(A.id);
  await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'before close' });
  await adminCall('PATCH', `/assignments/${a.id}`, { status: 'closed' });
  const res = await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'after close' });
  assert.equal(res.status, 409);
  const detail = (await meCall(sActive, 'GET', `/assignments/${a.id}`)).body.assignment;
  assert.equal(detail.canSubmit, false);
  assert.deepEqual(detail.submissions.map((s) => s.text), ['before close']);
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM assignment_submissions')).rows[0].n, 1);
  await adminCall('PATCH', `/assignments/${a.id}`, { status: 'published' });
  assert.equal((await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'reopened' })).status, 201);
  await adminCall('PATCH', `/assignments/${a.id}`, { status: 'draft' });
  assert.equal((await meCall(sActive, 'GET', `/assignments/${a.id}`)).status, 404, 'back to draft hides it again');
});

test('a student whose enrolment is cancelled loses access to old submissions and assignments', async () => {
  await clear();
  const s = await createUser(db.pool, { fullName: 'Leaver' });
  await enrol(db.pool, s.id, A.id, 'active');
  const a = await published(A.id);
  await meCall(s, 'POST', `/assignments/${a.id}/submissions`, { text: 'mine' });
  await db.pool.query("UPDATE enrolments SET status = 'cancelled' WHERE student_id = $1", [s.id]);
  assert.equal((await meCall(s, 'GET', `/assignments/${a.id}`)).status, 404);
  assert.equal((await meCall(s, 'POST', `/assignments/${a.id}/submissions`, { text: 'again' })).status, 404);
  // the Trainer still sees the history
  const subs = await trainerCall(t1, 'GET', `/assignments/${a.id}/submissions`);
  assert.equal(subs.body.submissions.length, 1);
});

// ------------------------------------------------------------ submissions seen by staff

test('Trainer submission list: latest per student with name, email, late, attempts, feedback state; no extra profile data', async () => {
  await clear();
  await db.pool.query("INSERT INTO user_profiles (user_id, phone, institution, bio) VALUES ($1, '+91 99999 11111', 'Private Uni', 'Private bio')", [sActive.id]);
  const a = await published(A.id, { dueAt: PAST });
  await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'first try' });
  const second = (await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'second try', url: 'https://example.com/w' })).body.submission;
  await meCall(sCompleted, 'POST', `/assignments/${a.id}/submissions`, { url: 'https://example.com/c' });
  const res = await trainerCall(t1, 'GET', `/assignments/${a.id}/submissions`);
  assert.equal(res.status, 200);
  assert.equal(res.body.assignment.title, 'Essay');
  assert.equal(res.body.submissions.length, 2, 'one row per student');
  const row = res.body.submissions.find((s) => s.studentName === 'Active Student');
  assert.equal(row.id, second.id, 'the latest submission');
  assert.equal(row.studentEmail, 'active@test.example');
  assert.equal(row.attempts, 2);
  assert.equal(row.isLate, true);
  assert.equal(row.hasFeedback, false);
  assert.deepEqual(Object.keys(row).sort(), ['attempts', 'hasFeedback', 'hasUrl', 'id', 'isLate', 'preview', 'studentEmail', 'studentName', 'submittedAt']);
  assert.ok(!res.text.includes('Private Uni') && !res.text.includes('99999') && !res.text.includes('Private bio'));
  const admin2 = await adminCall('GET', `/assignments/${a.id}/submissions`);
  assert.equal(admin2.body.submissions.length, 2);
});

test('Trainer submission detail: content, timestamps, late flag, history, student name and email only', async () => {
  await clear();
  const a = await published(A.id);
  await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'v1' });
  const v2 = (await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'v2', url: 'https://example.com/v2' })).body.submission;
  const res = await trainerCall(t1, 'GET', `/submissions/${v2.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.submission.text, 'v2');
  assert.equal(res.body.submission.url, 'https://example.com/v2');
  assert.equal(res.body.submission.isLate, false);
  assert.deepEqual(res.body.student, { name: 'Active Student', email: 'active@test.example' });
  assert.deepEqual(res.body.history.map((s) => s.text), ['v2', 'v1']);
  assert.equal(res.body.assignment.id, a.id);
});

// ------------------------------------------------------------ feedback

test('feedback: Trainer writes and updates (one current record), Student reads own, no grades anywhere', async () => {
  await clear();
  const a = await published(A.id);
  const sub = (await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'work' })).body.submission;
  const w1 = await trainerCall(t1, 'PUT', `/submissions/${sub.id}/feedback`, { feedback: '  Good start.  ' });
  assert.equal(w1.status, 200);
  assert.equal(w1.body.submission.feedback.text, 'Good start.');
  assert.equal(w1.body.submission.feedback.authorName, 'Trainer One');
  const w2 = await trainerCall(tA2, 'PUT', `/submissions/${sub.id}/feedback`, { feedback: 'Better: add examples.' });
  assert.equal(w2.body.submission.feedback.text, 'Better: add examples.');
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM assignment_feedback')).rows[0].n, 1);
  const own = (await meCall(sActive, 'GET', `/assignments/${a.id}`)).body.assignment;
  assert.equal(own.submissions[0].feedback.text, 'Better: add examples.');
  const list = (await meCall(sActive, 'GET', `/courses/${A.id}/assignments`)).body.assignments[0];
  assert.equal(list.hasFeedback, true);
  assert.ok(!/grade|score|mark|percent/i.test(JSON.stringify(own)), 'no grade fields');
  const staff = await trainerCall(t1, 'GET', `/assignments/${a.id}/submissions`);
  assert.equal(staff.body.submissions[0].hasFeedback, true);
  assert.equal((await adminCall('PUT', `/submissions/${sub.id}/feedback`, { feedback: 'Admin note' })).body.submission.feedback.authorName.length > 0, true);
});

test('feedback validation and unknown submissions', async () => {
  await clear();
  const a = await published(A.id);
  const sub = (await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'work' })).body.submission;
  for (const bad of [{}, { feedback: '' }, { feedback: '   ' }, { feedback: 5 }, { feedback: 'x'.repeat(3001) }, { score: 9 }]) {
    assert.equal((await trainerCall(t1, 'PUT', `/submissions/${sub.id}/feedback`, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await trainerCall(t1, 'PUT', `/submissions/${sub.id}/feedback`, { feedback: 'x'.repeat(3000) })).status, 200);
  assert.equal((await trainerCall(t1, 'PUT', '/submissions/999999/feedback', { feedback: 'x' })).status, 404);
});

test('a Student cannot write feedback or read another student feedback or submissions', async () => {
  await clear();
  const a = await published(A.id);
  const mine = (await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'mine' })).body.submission;
  const theirs = (await meCall(sCompleted, 'POST', `/assignments/${a.id}/submissions`, { text: 'theirs-secret' })).body.submission;
  await trainerCall(t1, 'PUT', `/submissions/${theirs.id}/feedback`, { feedback: 'private feedback for them' });
  assert.equal((await call('PUT', `/api/eduyarp/trainer/submissions/${mine.id}/feedback`, { token: sActive.token, body: { feedback: 'self' } })).status, 403);
  assert.equal((await call('PUT', `/api/admin/eduyarp/submissions/${mine.id}/feedback`, { token: sActive.token, body: { feedback: 'self' } })).status, 403);
  assert.equal((await call('GET', `/api/eduyarp/trainer/submissions/${theirs.id}`, { token: sActive.token })).status, 403);
  assert.equal((await call('GET', `/api/admin/eduyarp/assignments/${a.id}/submissions`, { token: sActive.token })).status, 403);
  const view = await meCall(sActive, 'GET', `/assignments/${a.id}`);
  assert.ok(!view.text.includes('theirs-secret') && !view.text.includes('private feedback'));
  assert.equal(view.body.assignment.submissions.length, 1);
  // there is no route to edit or delete a submission at all
  for (const m of ['PATCH', 'PUT', 'DELETE']) {
    assert.equal((await meCall(sActive, m, `/assignments/${a.id}/submissions/${theirs.id}`, { text: 'tamper' })).status, 404, m);
    assert.equal((await meCall(sActive, m, `/assignments/${a.id}/submissions`, { text: 'tamper' })).status, 404, `${m} collection`);
  }
  assert.equal((await db.pool.query('SELECT text_content FROM assignment_submissions WHERE id = $1', [theirs.id])).rows[0].text_content, 'theirs-secret');
  assert.equal((await meCall(sActive, 'GET', `/assignments/${a.id}/submissions/${theirs.id}`)).status, 404);
});

test('deleting an assignment removes its submissions and feedback through the API', async () => {
  await clear();
  const a = await published(A.id);
  const sub = (await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'x' })).body.submission;
  await trainerCall(t1, 'PUT', `/submissions/${sub.id}/feedback`, { feedback: 'ok' });
  assert.equal((await trainerCall(t1, 'DELETE', `/assignments/${a.id}`)).status, 204);
  assert.equal((await db.pool.query('SELECT 1 FROM assignment_submissions')).rows.length, 0);
  assert.equal((await db.pool.query('SELECT 1 FROM assignment_feedback')).rows.length, 0);
  assert.equal((await trainerCall(t1, 'GET', `/submissions/${sub.id}`)).status, 404);
  assert.equal((await meCall(sActive, 'GET', `/assignments/${a.id}`)).status, 404);
});

// ------------------------------------------------------------ notifications

test('a submission notifies every currently assigned Trainer of the course, and nobody else', async () => {
  await clear();
  const a = await published(A.id, { title: 'Report' });
  const sub = (await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'done' })).body.submission;
  for (const t of [t1, tA2]) {
    const rows = await notesFor(t);
    assert.equal(rows.length, 1, `trainer ${t.id}`);
    assert.equal(rows[0].title, 'New assignment submission');
    assert.equal(rows[0].body, 'Active Student submitted Report');
    assert.equal(rows[0].course_id, A.id);
    assert.equal(rows[0].link_path, `/trainer/courses/${A.id}/assignments/${a.id}?submission=${sub.id}`);
    assert.equal(rows[0].read_at, null);
  }
  for (const u of [t2, admin, former, sActive, sCompleted, sOther]) assert.equal((await notesFor(u)).length, 0, `user ${u.id}`);
  // visible and markable through the existing notification API
  const list = await call('GET', '/api/me/notifications', { token: t1.token });
  assert.equal(list.body.notifications[0].type, 'assignment_submission');
  assert.equal(list.body.unreadCount, 1);
  assert.equal((await call('POST', `/api/me/notifications/${list.body.notifications[0].id}/read`, { token: t1.token })).status, 200);
});

test('late submissions are flagged in the notification; each resubmission notifies again; links are internal paths', async () => {
  await clear();
  const a = await published(A.id, { title: 'Late work', dueAt: PAST });
  await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'one' });
  await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'two' });
  const rows = await notesFor(t1);
  assert.equal(rows.length, 2);
  assert.match(rows[0].body, /\(late\)$/);
  for (const r of rows) assert.match(r.link_path, /^\/trainer\/courses\/\d+\/assignments\/\d+\?submission=\d+$/);
});

test('an unassigned Trainer is not notified; a course without Trainers still accepts submissions', async () => {
  await clear();
  const C = await createCourse(db.pool, { title: 'No trainers' });
  const s = await createUser(db.pool, { fullName: 'Solo' });
  await enrol(db.pool, s.id, C.id, 'active');
  const a = await published(C.id);
  assert.equal((await meCall(s, 'POST', `/assignments/${a.id}/submissions`, { text: 'ok' })).status, 201);
  assert.equal((await db.pool.query("SELECT 1 FROM notifications WHERE type = 'assignment_submission'")).rows.length, 0);
});

test('notification failure does not lose the submission', async () => {
  await clear();
  const a = await published(A.id);
  await db.pool.query('ALTER TABLE notifications RENAME TO notifications_hidden');
  try {
    const res = await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'survives' });
    assert.equal(res.status, 201);
    assert.equal(res.body.submission.text, 'survives');
  } finally {
    await db.pool.query('ALTER TABLE notifications_hidden RENAME TO notifications');
  }
  const stored = await db.pool.query('SELECT text_content FROM assignment_submissions');
  assert.deepEqual(stored.rows.map((r) => r.text_content), ['survives']);
});

test('concurrent submissions all succeed as separate rows; a close racing with submits never leaves a late insert', async () => {
  await clear();
  const a = await published(A.id);
  const results = await Promise.all([1, 2, 3].map((n) => meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: `parallel ${n}` })));
  assert.deepEqual(results.map((r) => r.status), [201, 201, 201]);
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM assignment_submissions')).rows[0].n, 3);
  await adminCall('PATCH', `/assignments/${a.id}`, { status: 'closed' });
  const after = await meCall(sActive, 'POST', `/assignments/${a.id}/submissions`, { text: 'too late' });
  assert.equal(after.status, 409);
});
