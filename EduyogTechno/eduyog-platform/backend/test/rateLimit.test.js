const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client } = require('./helpers');

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

test('password change shares the existing credentials limiter (20 attempts per 15 minutes)', async () => {
  const user = await createUser(db.pool);
  // 10 failed logins + 10 failed password changes use up the shared allowance...
  for (let i = 0; i < 10; i++) {
    const res = await call('POST', '/api/auth/login', { body: { email: user.email, password: 'wrong-password' } });
    assert.equal(res.status, 401);
  }
  for (let i = 0; i < 10; i++) {
    const res = await call('POST', '/api/me/password', {
      token: user.token,
      body: { currentPassword: 'wrong-password', newPassword: 'brand-new-pass1' },
    });
    assert.equal(res.status, 400);
  }
  // ...so the next attempt on either route is refused.
  const blocked = await call('POST', '/api/me/password', {
    token: user.token,
    body: { currentPassword: user.password, newPassword: 'brand-new-pass1' },
  });
  assert.equal(blocked.status, 429);
  const blockedLogin = await call('POST', '/api/auth/login', { body: { email: user.email, password: user.password } });
  assert.equal(blockedLogin.status, 429);
  // Profile updates are not covered by the credentials limiter.
  const profile = await call('PATCH', '/api/me/profile', { token: user.token, body: { bio: 'still allowed' } });
  assert.equal(profile.status, 200);
});
