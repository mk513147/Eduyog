// Student registration approval: a new registration is pending, pending/rejected students cannot sign in or
// use an existing token, only an Admin can decide, and existing accounts keep working.
//
// The credentials limiter allows 20 register/login calls per server, so most users are created
// directly in the database and only a few calls use /auth/register and /auth/login.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client, createCourse, enrol } = require('./helpers');

let db;
let api;
let call;
let admin;
let trainer;
let course;

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin' });
  trainer = await createUser(db.pool, { role: 'trainer' });
  course = await createCourse(db.pool, { title: 'Approval course', topicCount: 3 });
});

after(async () => {
  await api.stop();
  await db.drop();
});

const status = async (user) => (await db.pool.query('SELECT approval_status FROM users WHERE id = $1', [user.id])).rows[0].approval_status;
const setStatus = (user, value) => db.pool.query('UPDATE users SET approval_status = $2 WHERE id = $1', [user.id, value]);
const decide = (token, id, body) => call('PATCH', `/api/admin/users/${id}/approval`, { token, body });
const login = (user) => call('POST', '/api/auth/login', { body: { email: user.email, password: user.password } });
// A student the way registration creates one (pending), without spending a rate-limited call.
async function pendingStudent() {
  const user = await createUser(db.pool);
  await setStatus(user, 'pending');
  return user;
}

test('registration creates a pending student; role and approval status in the request are ignored', async () => {
  const email = `pending-${Date.now()}@test.example`;
  const res = await call('POST', '/api/auth/register', {
    body: { fullName: 'Hopeful', email, password: 'password123', role: 'admin', approvalStatus: 'approved', approval_status: 'approved' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'student');
  assert.equal(res.body.user.approvalStatus, 'pending');
  assert.equal(res.body.token, undefined, 'registration never signs anyone in');
  const row = (await db.pool.query('SELECT role, approval_status FROM users WHERE email = $1', [email])).rows[0];
  assert.deepEqual(row, { role: 'student', approval_status: 'pending' });
});

test('a pending student cannot sign in; the message is only given after the correct password', async () => {
  const user = await pendingStudent();
  const res = await login(user);
  assert.equal(res.status, 403);
  assert.equal(res.body.error.details.code, 'account_pending');
  assert.equal(res.body.token, undefined);
  assert.doesNotMatch(res.text, /password_hash|approval_status/);
  const wrong = await call('POST', '/api/auth/login', { body: { email: user.email, password: 'wrong-password' } });
  assert.equal(wrong.status, 401, 'a wrong password reveals nothing about the account state');
  assert.equal(wrong.body.error.message, 'Invalid email or password');
  const unknown = await call('POST', '/api/auth/login', { body: { email: 'nobody@test.example', password: 'password123' } });
  assert.equal(unknown.body.error.message, wrong.body.error.message);
});

test('a rejected student cannot sign in; an approved one can; the rejection reason is never sent to them', async () => {
  const user = await pendingStudent();
  const rejected = await decide(admin.token, user.id, { status: 'rejected', reason: 'Not a current student' });
  assert.equal(rejected.status, 200);
  const res = await login(user);
  assert.equal(res.status, 403);
  assert.equal(res.body.error.details.code, 'account_not_approved');
  assert.doesNotMatch(res.text, /Not a current student/);
  assert.equal((await decide(admin.token, user.id, { status: 'approved' })).status, 200);
  const ok = await login(user);
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.approvalStatus, 'approved');
});

test('an existing token cannot bypass a later rejection (every protected endpoint, no restart needed)', async () => {
  const user = await createUser(db.pool); // approved, holds a valid token
  await enrol(db.pool, user.id, course.id);
  const urls = ['/api/auth/me', '/api/eduyarp/me/courses', `/api/eduyarp/me/courses/${course.id}`, '/api/eduyarp/me/certificates', '/api/me/profile'];
  for (const url of urls) assert.equal((await call('GET', url, { token: user.token })).status, 200, url);
  assert.equal((await decide(admin.token, user.id, { status: 'rejected', reason: 'Policy' })).status, 200);
  for (const url of urls) assert.equal((await call('GET', url, { token: user.token })).status, 401, url);
  assert.equal((await call('POST', `/api/eduyarp/topics/${course.topicIds[0]}/complete`, { token: user.token })).status, 401);
  assert.equal((await call('GET', `/api/eduyarp/courses/${course.id}/demo`, { token: user.token })).status, 401);
  // history is untouched
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM enrolments WHERE student_id = $1', [user.id])).rows[0].n, 1);
  // approving again restores access with the same token
  assert.equal((await decide(admin.token, user.id, { status: 'approved' })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { token: user.token })).status, 200);
});

test('a pending account holding a token (for example created before approval was required) is refused', async () => {
  const user = await pendingStudent();
  assert.equal((await call('GET', '/api/auth/me', { token: user.token })).status, 401);
  assert.equal((await call('GET', '/api/eduyarp/me/courses', { token: user.token })).status, 401);
});

test('only an Admin can list or decide; Student, Trainer and anonymous cannot', async () => {
  const target = await pendingStudent();
  const student = await createUser(db.pool);
  for (const [who, expected] of [[student.token, 403], [trainer.token, 403], [undefined, 401]]) {
    assert.equal((await call('GET', '/api/admin/registrations', { token: who })).status, expected);
    assert.equal((await decide(who, target.id, { status: 'approved' })).status, expected);
  }
  assert.equal(await status(target), 'pending', 'nothing changed');
  // a student cannot approve themselves, even via the same endpoint
  const self = await pendingStudent();
  assert.equal((await decide(self.token, self.id, { status: 'approved' })).status, 401);
  assert.equal(await status(self), 'pending');
});

test('Admin lists pending registrations and sees decided ones by status', async () => {
  const a = await pendingStudent();
  const pending = await call('GET', '/api/admin/registrations', { token: admin.token });
  assert.equal(pending.status, 200);
  assert.ok(pending.body.registrations.some((r) => r.id === a.id && r.email === a.email));
  assert.ok(pending.body.registrations.every((r) => r.role === 'student' && r.approvalStatus === 'pending'));
  assert.doesNotMatch(pending.text, /password/i);
  await decide(admin.token, a.id, { status: 'rejected', reason: 'Duplicate account' });
  const rejected = await call('GET', '/api/admin/registrations?status=rejected', { token: admin.token });
  const row = rejected.body.registrations.find((r) => r.id === a.id);
  assert.equal(row.reason, 'Duplicate account');
  assert.equal(row.decidedByName.length > 0, true);
  assert.equal((await call('GET', '/api/admin/registrations?status=bogus', { token: admin.token })).status, 400);
  assert.ok(!(await call('GET', '/api/admin/registrations', { token: admin.token })).body.registrations.some((r) => r.id === a.id));
});

test('decision validation: status, reason length, ids, unknown users, non-students', async () => {
  const user = await pendingStudent();
  for (const bad of [{}, { status: 'pending' }, { status: 'banned' }, { status: 5 }, { status: 'rejected', reason: 'x'.repeat(501) }, { status: 'rejected', reason: 7 }]) {
    assert.equal((await decide(admin.token, user.id, bad)).status, 400, JSON.stringify(bad).slice(0, 50));
  }
  assert.equal(await status(user), 'pending');
  assert.equal((await decide(admin.token, 'abc', { status: 'approved' })).status, 400);
  assert.equal((await decide(admin.token, 999999, { status: 'approved' })).status, 404);
  assert.equal((await decide(admin.token, trainer.id, { status: 'rejected' })).status, 409, 'staff are not registrations');
  assert.equal((await decide(admin.token, admin.id, { status: 'rejected' })).status, 409);
  assert.equal(await status(trainer), 'approved');
  // the reason is stored trimmed, only for rejections
  await decide(admin.token, user.id, { status: 'rejected', reason: '  Not eligible  ' });
  let row = (await db.pool.query('SELECT approval_status, approval_reason, approval_decided_by FROM users WHERE id = $1', [user.id])).rows[0];
  assert.deepEqual(row, { approval_status: 'rejected', approval_reason: 'Not eligible', approval_decided_by: admin.id });
  await decide(admin.token, user.id, { status: 'approved', reason: 'ignored' });
  row = (await db.pool.query('SELECT approval_status, approval_reason FROM users WHERE id = $1', [user.id])).rows[0];
  assert.deepEqual(row, { approval_status: 'approved', approval_reason: null });
});

test('deciding is idempotent and safe under concurrent decisions', async () => {
  const user = await pendingStudent();
  const same = await Promise.all([1, 2, 3, 4].map(() => decide(admin.token, user.id, { status: 'approved' })));
  assert.ok(same.every((r) => r.status === 200 && r.body.user.approvalStatus === 'approved'));
  const racing = await Promise.all([
    decide(admin.token, user.id, { status: 'rejected', reason: 'a' }),
    decide(admin.token, user.id, { status: 'approved' }),
    decide(admin.token, user.id, { status: 'rejected', reason: 'b' }),
  ]);
  assert.ok(racing.every((r) => r.status === 200));
  const row = (await db.pool.query('SELECT approval_status, approval_reason FROM users WHERE id = $1', [user.id])).rows[0];
  assert.ok(['approved', 'rejected'].includes(row.approval_status));
  assert.equal(row.approval_reason === null, row.approval_status === 'approved', 'status and reason stay consistent');
});

test('existing approved students, trainers and admins keep working (role routing unchanged)', async () => {
  for (const user of [await createUser(db.pool), trainer, admin]) {
    const me = await call('GET', '/api/auth/me', { token: user.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.approvalStatus, 'approved');
  }
  assert.equal((await login(trainer)).status, 200);
  assert.equal((await call('GET', '/api/eduyarp/me/courses', { token: trainer.token })).status, 403, 'role routing: trainers still use trainer endpoints');
  assert.equal((await call('GET', '/api/admin/users', { token: admin.token })).status, 200);
  // a Student -> Trainer promotion is never blocked by an old pending state, and a rejected student promoted by an Admin works as staff
  const staffToBe = await pendingStudent();
  await call('PATCH', `/api/admin/users/${staffToBe.id}/role`, { token: admin.token, body: { role: 'trainer' } });
  assert.equal((await call('GET', '/api/auth/me', { token: staffToBe.token })).status, 200, 'approval only gates Students');
});
