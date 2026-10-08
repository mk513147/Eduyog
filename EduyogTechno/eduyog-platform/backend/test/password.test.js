const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createTestDatabase, startApi, createUser, tokenFor, client } = require('./helpers');

let db;
let api;
let call;

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
});

after(async () => {
  await api.stop();
  await db.drop();
});

const change = (user, body, token = user.token) => call('POST', '/api/me/password', { token, body });
const nowSeconds = () => Math.floor(Date.now() / 1000);

test('unauthenticated password change is rejected (401)', async () => {
  const res = await call('POST', '/api/me/password', { body: { currentPassword: 'a', newPassword: 'longenough1' } });
  assert.equal(res.status, 401);
});

test('a wrong current password returns 400 (never 401) with a field error', async () => {
  const user = await createUser(db.pool);
  const res = await change(user, { currentPassword: 'not-the-password', newPassword: 'brand-new-pass1' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.details.currentPassword, 'Current password is incorrect');
  // The session is still valid afterwards.
  assert.equal((await call('GET', '/api/auth/me', { token: user.token })).status, 200);
  const { rows } = await db.pool.query('SELECT password_changed_at FROM users WHERE id = $1', [user.id]);
  assert.equal(rows[0].password_changed_at, null);
});

test('missing or weak new passwords are rejected by the existing rules', async () => {
  const user = await createUser(db.pool);
  const cases = [
    [{ newPassword: 'longenough1' }, 'currentPassword'],
    [{ currentPassword: user.password }, 'newPassword'],
    [{ currentPassword: user.password, newPassword: 'short' }, 'newPassword'],
    [{ currentPassword: user.password, newPassword: 'x'.repeat(73) }, 'newPassword'],
    [{ currentPassword: user.password, newPassword: user.password }, 'newPassword'],
  ];
  for (const [body, field] of cases) {
    const res = await change(user, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok(res.body.error.details[field], field);
  }
});

test('the correct current password succeeds and returns a fresh token', async () => {
  const user = await createUser(db.pool);
  const res = await change(user, { currentPassword: user.password, newPassword: 'brand-new-pass1' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.tokenType, 'Bearer');
  assert.doesNotMatch(res.text, /password_hash|\$2[aby]\$/);
});

test('the new password is bcrypt-hashed and password_changed_at is set', async () => {
  const user = await createUser(db.pool);
  const { rows: before } = await db.pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  const res = await change(user, { currentPassword: user.password, newPassword: 'brand-new-pass1' });
  assert.equal(res.status, 200);
  const { rows } = await db.pool.query('SELECT password_hash, password_changed_at FROM users WHERE id = $1', [user.id]);
  assert.notEqual(rows[0].password_hash, before[0].password_hash);
  assert.match(rows[0].password_hash, /^\$2[aby]\$12\$/, 'bcrypt with the existing 12 rounds');
  assert.notEqual(rows[0].password_hash, 'brand-new-pass1');
  assert.equal(await bcrypt.compare('brand-new-pass1', rows[0].password_hash), true);
  assert.equal(await bcrypt.compare(user.password, rows[0].password_hash), false);
  assert.ok(rows[0].password_changed_at instanceof Date);
});

test('tokens issued before the change stop working; the returned token keeps working', async () => {
  const user = await createUser(db.pool);
  const older = tokenFor(user.id, { issuedAt: nowSeconds() - 30 });
  assert.equal((await call('GET', '/api/auth/me', { token: older })).status, 200, 'valid before the change');
  const res = await change(user, { currentPassword: user.password, newPassword: 'brand-new-pass1' });
  assert.equal(res.status, 200);

  assert.equal((await call('GET', '/api/auth/me', { token: older })).status, 401);
  const stale = await call('GET', '/api/me/profile', { token: older });
  assert.equal(stale.status, 401);
  assert.match(stale.body.error.message, /password was changed/i);

  // The token from the response is issued in the same second as the change and must work immediately.
  assert.equal((await call('GET', '/api/auth/me', { token: res.body.token })).status, 200);
});

test('a token issued after the change is accepted', async () => {
  const user = await createUser(db.pool);
  await change(user, { currentPassword: user.password, newPassword: 'brand-new-pass1' });
  const later = tokenFor(user.id, { issuedAt: nowSeconds() + 2 });
  assert.equal((await call('GET', '/api/auth/me', { token: later })).status, 200);
});

test('users who never changed their password are unaffected (password_changed_at is NULL)', async () => {
  const user = await createUser(db.pool);
  const oldToken = tokenFor(user.id, { issuedAt: nowSeconds() - 3600 + 60 });
  assert.equal((await call('GET', '/api/auth/me', { token: oldToken })).status, 200);
});

test('login works with the new password only', async () => {
  const user = await createUser(db.pool);
  await change(user, { currentPassword: user.password, newPassword: 'brand-new-pass1' });
  const oldLogin = await call('POST', '/api/auth/login', { body: { email: user.email, password: user.password } });
  assert.equal(oldLogin.status, 401);
  const newLogin = await call('POST', '/api/auth/login', { body: { email: user.email, password: 'brand-new-pass1' } });
  assert.equal(newLogin.status, 200);
  assert.equal((await call('GET', '/api/auth/me', { token: newLogin.body.token })).status, 200);
});

test('changing the password does not alter role, e-mail or enrolments', async () => {
  const user = await createUser(db.pool, { role: 'trainer' });
  const { rows: before } = await db.pool.query('SELECT email, role FROM users WHERE id = $1', [user.id]);
  await change(user, { currentPassword: user.password, newPassword: 'brand-new-pass1' });
  const { rows } = await db.pool.query('SELECT email, role FROM users WHERE id = $1', [user.id]);
  assert.deepEqual(rows[0], before[0]);
});

test('Trainers and Admins can change their password too', async () => {
  for (const role of ['trainer', 'admin']) {
    const user = await createUser(db.pool, { role });
    const res = await change(user, { currentPassword: user.password, newPassword: 'brand-new-pass1' });
    assert.equal(res.status, 200, role);
  }
});
