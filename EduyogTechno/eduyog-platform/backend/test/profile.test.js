const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client } = require('./helpers');

let db;
let api;
let call;
let student;
let other;
let trainer;
let admin;

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  student = await createUser(db.pool, { role: 'student', fullName: 'Stella Student' });
  other = await createUser(db.pool, { role: 'student', fullName: 'Other Student' });
  trainer = await createUser(db.pool, { role: 'trainer', fullName: 'Tara Trainer' });
  admin = await createUser(db.pool, { role: 'admin', fullName: 'Ada Admin' });
});

after(async () => {
  await api.stop();
  await db.drop();
});

const patch = (user, body) => call('PATCH', '/api/me/profile', { token: user.token, body });

test('unauthenticated requests are rejected (401)', async () => {
  assert.equal((await call('GET', '/api/me/profile')).status, 401);
  assert.equal((await call('PATCH', '/api/me/profile', { body: { bio: 'x' } })).status, 401);
});

test('GET returns the account and an empty profile for a new user', async () => {
  const res = await call('GET', '/api/me/profile', { token: student.token });
  assert.equal(res.status, 200);
  const p = res.body.profile;
  assert.equal(p.id, student.id);
  assert.equal(p.fullName, 'Stella Student');
  assert.equal(p.email, student.email);
  assert.equal(p.role, 'student');
  for (const field of ['phone', 'institution', 'studyLevel', 'fieldOfStudy', 'graduationYear', 'bio', 'avatarUrl']) {
    assert.equal(p[field], null, field);
  }
});

test('GET never returns the password hash or token fields', async () => {
  const res = await call('GET', '/api/me/profile', { token: student.token });
  assert.doesNotMatch(res.text, /password|hash|\$2[aby]\$/i);
});

test('PATCH saves profile fields and returns them', async () => {
  const res = await patch(student, {
    phone: '+91 98765 43210',
    institution: 'Test University',
    studyLevel: 'undergraduate',
    fieldOfStudy: 'Computer Science',
    graduationYear: 2027,
    bio: 'I like data.',
    avatarUrl: 'https://example.com/me.png',
  });
  assert.equal(res.status, 200);
  assert.deepEqual(
    {
      phone: res.body.profile.phone,
      institution: res.body.profile.institution,
      studyLevel: res.body.profile.studyLevel,
      fieldOfStudy: res.body.profile.fieldOfStudy,
      graduationYear: res.body.profile.graduationYear,
      bio: res.body.profile.bio,
      avatarUrl: res.body.profile.avatarUrl,
    },
    {
      phone: '+91 98765 43210',
      institution: 'Test University',
      studyLevel: 'undergraduate',
      fieldOfStudy: 'Computer Science',
      graduationYear: 2027,
      bio: 'I like data.',
      avatarUrl: 'https://example.com/me.png',
    }
  );
  const again = await call('GET', '/api/me/profile', { token: student.token });
  assert.equal(again.body.profile.institution, 'Test University');
});

test('a partial PATCH only changes the fields sent', async () => {
  const res = await patch(student, { bio: 'Updated bio' });
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.bio, 'Updated bio');
  assert.equal(res.body.profile.institution, 'Test University');
});

test('null or an empty string clears a field', async () => {
  const res = await patch(student, { phone: null, institution: '', graduationYear: null, studyLevel: null, avatarUrl: '' });
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.phone, null);
  assert.equal(res.body.profile.institution, null);
  assert.equal(res.body.profile.graduationYear, null);
  assert.equal(res.body.profile.studyLevel, null);
  assert.equal(res.body.profile.avatarUrl, null);
  assert.equal(res.body.profile.fieldOfStudy, 'Computer Science');
});

test('fullName is updated together with the profile and trimmed', async () => {
  const res = await patch(student, { fullName: '  Stella S.  ', bio: 'With a new name' });
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.fullName, 'Stella S.');
  const { rows } = await db.pool.query('SELECT full_name FROM users WHERE id = $1', [student.id]);
  assert.equal(rows[0].full_name, 'Stella S.');
  const me = await call('GET', '/api/auth/me', { token: student.token });
  assert.equal(me.body.user.fullName, 'Stella S.');
});

test('an empty fullName is rejected and nothing changes', async () => {
  const res = await patch(student, { fullName: '   ', bio: 'Should not be saved' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.fullName);
  const { rows } = await db.pool.query('SELECT bio FROM user_profiles WHERE user_id = $1', [student.id]);
  assert.notEqual(rows[0].bio, 'Should not be saved');
});

test('an empty body is rejected', async () => {
  assert.equal((await patch(student, {})).status, 400);
});

test('email cannot be changed', async () => {
  const res = await patch(student, { email: 'hacker@test.example' });
  assert.equal(res.status, 400);
  assert.match(res.body.error.details.email, /cannot be changed/i);
  const { rows } = await db.pool.query('SELECT email FROM users WHERE id = $1', [student.id]);
  assert.equal(rows[0].email, student.email);
});

test('role cannot be changed (including admin escalation)', async () => {
  const res = await patch(student, { role: 'admin', bio: 'x' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.role);
  const { rows } = await db.pool.query('SELECT role FROM users WHERE id = $1', [student.id]);
  assert.equal(rows[0].role, 'student');
});

test('a user id in the body cannot be used to edit another user', async () => {
  for (const key of ['userId', 'user_id', 'id']) {
    const res = await patch(student, { [key]: other.id, bio: 'Attack' });
    assert.equal(res.status, 400, key);
  }
  const { rowCount } = await db.pool.query("SELECT 1 FROM user_profiles WHERE user_id = $1 AND bio = 'Attack'", [other.id]);
  assert.equal(rowCount, 0);
});

test('password fields cannot be set through the profile', async () => {
  for (const key of ['password', 'passwordHash', 'password_hash']) {
    assert.equal((await patch(student, { [key]: 'x' })).status, 400, key);
  }
});

test('users only ever read and change their own profile', async () => {
  await patch(other, { bio: 'Other bio' });
  const mine = await call('GET', '/api/me/profile', { token: student.token });
  const theirs = await call('GET', '/api/me/profile', { token: other.token });
  assert.notEqual(mine.body.profile.bio, 'Other bio');
  assert.equal(theirs.body.profile.bio, 'Other bio');
  assert.equal(theirs.body.profile.id, other.id);
});

test('study level must be one of the allowed values', async () => {
  const res = await patch(student, { studyLevel: 'masters' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.studyLevel);
  for (const level of ['school', 'diploma', 'undergraduate', 'postgraduate', 'phd', 'other']) {
    assert.equal((await patch(student, { studyLevel: level })).status, 200, level);
  }
});

test('graduation year must be an integer between 1950 and 2100', async () => {
  for (const bad of [1949, 2101, 2026.5, 'soon', {}, []]) {
    const res = await patch(student, { graduationYear: bad });
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.ok(res.body.error.details.graduationYear);
  }
  assert.equal((await patch(student, { graduationYear: 1950 })).status, 200);
  assert.equal((await patch(student, { graduationYear: '2100' })).body.profile.graduationYear, 2100);
});

test('unsafe or malformed avatar URLs are rejected', async () => {
  const bad = [
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'file:///etc/passwd',
    'blob:https://example.com/1',
    'ftp://example.com/a.png',
    '//example.com/a.png',
    'https://user:pw@example.com/a.png',
    'https://',
    'not a url',
    'https://exa mple.com/a.png',
    `https://example.com/${'a'.repeat(2100)}`,
    123,
  ];
  for (const url of bad) {
    const res = await patch(student, { avatarUrl: url });
    assert.equal(res.status, 400, String(url).slice(0, 40));
    assert.ok(res.body.error.details.avatarUrl, String(url).slice(0, 40));
  }
  assert.equal((await patch(student, { avatarUrl: ' http://example.com/ok.png ' })).body.profile.avatarUrl, 'http://example.com/ok.png');
});

test('an oversized bio is rejected', async () => {
  const res = await patch(student, { bio: 'a'.repeat(1001) });
  assert.equal(res.status, 400);
  assert.match(res.body.error.details.bio, /1000/);
  assert.equal((await patch(student, { bio: 'a'.repeat(1000) })).status, 200);
});

test('invalid phone numbers are rejected', async () => {
  for (const phone of ['abc', '123', '12345678901234567890', 'call me']) {
    assert.equal((await patch(student, { phone })).status, 400, phone);
  }
  assert.equal((await patch(student, { phone: '(020) 7946-0958' })).status, 200);
});

test('Trainers and Admins have the same profile endpoints', async () => {
  for (const user of [trainer, admin]) {
    const res = await patch(user, { institution: `${user.role} institute`, bio: 'Staff bio' });
    assert.equal(res.status, 200);
    assert.equal(res.body.profile.role, user.role);
    assert.equal(res.body.profile.institution, `${user.role} institute`);
  }
});

test('saving a profile does not change role, e-mail or password', async () => {
  const before = (await db.pool.query('SELECT email, role, password_hash, password_changed_at FROM users WHERE id = $1', [student.id])).rows[0];
  await patch(student, { bio: 'Another save' });
  const after = (await db.pool.query('SELECT email, role, password_hash, password_changed_at FROM users WHERE id = $1', [student.id])).rows[0];
  assert.deepEqual(after, before);
});
