const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client } = require('./helpers');

let db;
let api;
let call;
let admin;
let student;
let trainer;
let target;

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin', fullName: 'Ada Admin' });
  student = await createUser(db.pool, { role: 'student' });
  trainer = await createUser(db.pool, { role: 'trainer' });
  target = await createUser(db.pool, { role: 'student', fullName: 'Target Student' });
  await db.pool.query(
    "INSERT INTO user_profiles (user_id, phone, institution, study_level, bio) VALUES ($1, '+44 20 7946 0958', 'Old Uni', 'diploma', 'Old bio')",
    [target.id]
  );
});

after(async () => {
  await api.stop();
  await db.drop();
});

test('only an Admin can use the admin profile endpoints', async () => {
  const calls = [
    ['GET', `/api/admin/users/${target.id}`],
    ['PATCH', `/api/admin/users/${target.id}/profile`, { bio: 'x' }],
  ];
  for (const [method, path, body] of calls) {
    assert.equal((await call(method, path, { body })).status, 401, `${method} ${path} unauthenticated`);
    assert.equal((await call(method, path, { token: student.token, body })).status, 403, `${method} ${path} student`);
    assert.equal((await call(method, path, { token: trainer.token, body })).status, 403, `${method} ${path} trainer`);
  }
  const { rows } = await db.pool.query('SELECT bio FROM user_profiles WHERE user_id = $1', [target.id]);
  assert.equal(rows[0].bio, 'Old bio');
});

test('Admin can view a user\'s account and profile', async () => {
  const res = await call('GET', `/api/admin/users/${target.id}`, { token: admin.token });
  assert.equal(res.status, 200);
  const p = res.body.profile;
  assert.equal(p.id, target.id);
  assert.equal(p.fullName, 'Target Student');
  assert.equal(p.email, target.email);
  assert.equal(p.role, 'student');
  assert.equal(p.phone, '+44 20 7946 0958');
  assert.equal(p.institution, 'Old Uni');
  assert.equal(p.studyLevel, 'diploma');
  assert.equal(p.bio, 'Old bio');
  assert.doesNotMatch(res.text, /password|hash|\$2[aby]\$/i);
});

test('Admin can view a user who has no profile yet (all fields empty)', async () => {
  const res = await call('GET', `/api/admin/users/${trainer.id}`, { token: admin.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.role, 'trainer');
  assert.equal(res.body.profile.phone, null);
});

test('Admin can update profile fields and the display name', async () => {
  const res = await call('PATCH', `/api/admin/users/${target.id}/profile`, {
    token: admin.token,
    body: { fullName: 'Target Renamed', institution: 'New Uni', graduationYear: 2028, avatarUrl: 'https://example.com/t.png' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.fullName, 'Target Renamed');
  assert.equal(res.body.profile.institution, 'New Uni');
  assert.equal(res.body.profile.graduationYear, 2028);
  assert.equal(res.body.profile.bio, 'Old bio', 'fields not sent are untouched');
  const { rows } = await db.pool.query('SELECT full_name FROM users WHERE id = $1', [target.id]);
  assert.equal(rows[0].full_name, 'Target Renamed');
});

test('Admin can create a profile for a user without one', async () => {
  const res = await call('PATCH', `/api/admin/users/${trainer.id}/profile`, { token: admin.token, body: { bio: 'Trainer bio' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.bio, 'Trainer bio');
});

test('email, role and password cannot be changed through the profile endpoint', async () => {
  const before = (await db.pool.query('SELECT email, role, password_hash FROM users WHERE id = $1', [target.id])).rows[0];
  for (const body of [{ email: 'new@test.example' }, { role: 'admin' }, { password: 'newpassword1' }, { passwordHash: 'x' }]) {
    const res = await call('PATCH', `/api/admin/users/${target.id}/profile`, { token: admin.token, body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const after = (await db.pool.query('SELECT email, role, password_hash FROM users WHERE id = $1', [target.id])).rows[0];
  assert.deepEqual(after, before);
});

test('the same validation applies as for self-service', async () => {
  for (const body of [{ studyLevel: 'masters' }, { graduationYear: 1900 }, { bio: 'a'.repeat(1001) }, { avatarUrl: 'javascript:alert(1)' }, { phone: 'abc' }]) {
    const res = await call('PATCH', `/api/admin/users/${target.id}/profile`, { token: admin.token, body });
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40));
  }
});

test('unknown and invalid user ids', async () => {
  assert.equal((await call('GET', '/api/admin/users/999999', { token: admin.token })).status, 404);
  assert.equal((await call('PATCH', '/api/admin/users/999999/profile', { token: admin.token, body: { bio: 'x' } })).status, 404);
  assert.equal((await call('GET', '/api/admin/users/abc', { token: admin.token })).status, 400);
});

test('role changes still go through the existing role endpoint', async () => {
  const user = await createUser(db.pool);
  const res = await call('PATCH', `/api/admin/users/${user.id}/role`, { token: admin.token, body: { role: 'trainer' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, 'trainer');
  const list = await call('GET', '/api/admin/users', { token: admin.token });
  assert.equal(list.status, 200);
  assert.ok(list.body.users.some((u) => u.id === user.id && u.role === 'trainer'));
});
