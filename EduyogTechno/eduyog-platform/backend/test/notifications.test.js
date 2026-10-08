const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client } = require('./helpers');

let db;
let api;
let call;
let a;
let b;
let admin;

const add = (userId, title, { read = false, link = null, type = 'announcement', at } = {}) =>
  db.pool.query(
    `INSERT INTO notifications (recipient_id, type, title, link_path, read_at, created_at)
     VALUES ($1, $2, $3, $4, ${read ? 'now()' : 'NULL'}, COALESCE($5::timestamptz, now())) RETURNING id`,
    [userId, type, title, link, at ?? null]
  ).then((r) => r.rows[0].id);

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  a = await createUser(db.pool, { role: 'student', fullName: 'Student A' });
  b = await createUser(db.pool, { role: 'student', fullName: 'Student B' });
  admin = await createUser(db.pool, { role: 'admin' });
});

after(async () => {
  await api.stop();
  await db.drop();
});

test('notification endpoints require authentication', async () => {
  for (const [m, p] of [
    ['GET', '/api/me/notifications'],
    ['POST', '/api/me/notifications/1/read'],
    ['POST', '/api/me/notifications/read-all'],
    ['GET', '/api/me/announcements'],
  ]) {
    assert.equal((await call(m, p)).status, 401, `${m} ${p}`);
  }
});

test('an empty list returns zero counts', async () => {
  const res = await call('GET', '/api/me/notifications', { token: a.token });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { notifications: [], unreadCount: 0, total: 0 });
});

test('a user sees only their own notifications, newest first, without recipient ids', async () => {
  await add(a.id, 'A old', { at: '2026-01-01T00:00:00Z' });
  await add(a.id, 'A new', { at: '2026-02-01T00:00:00Z', link: '/notifications' });
  await add(b.id, 'B only');
  const res = await call('GET', '/api/me/notifications', { token: a.token });
  assert.deepEqual(res.body.notifications.map((n) => n.title), ['A new', 'A old']);
  assert.equal(res.body.unreadCount, 2);
  assert.equal(res.body.total, 2);
  const fields = Object.keys(res.body.notifications[0]).sort();
  assert.deepEqual(fields, ['body', 'courseId', 'courseTitle', 'createdAt', 'id', 'linkPath', 'read', 'readAt', 'title', 'type']);
  assert.ok(!res.text.includes('recipient'));
  const other = await call('GET', '/api/me/notifications', { token: b.token });
  assert.deepEqual(other.body.notifications.map((n) => n.title), ['B only']);
});

test('admin has their own (empty) notification list too', async () => {
  const res = await call('GET', '/api/me/notifications', { token: admin.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0);
});

test('pagination: limit, offset and stable order; total is the full count', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  for (let i = 1; i <= 7; i++) await add(u.id, `N${i}`, { at: `2026-03-0${i}T00:00:00Z` });
  const page1 = await call('GET', '/api/me/notifications?limit=3', { token: u.token });
  const page2 = await call('GET', '/api/me/notifications?limit=3&offset=3', { token: u.token });
  const page3 = await call('GET', '/api/me/notifications?limit=3&offset=6', { token: u.token });
  assert.deepEqual(page1.body.notifications.map((n) => n.title), ['N7', 'N6', 'N5']);
  assert.deepEqual(page2.body.notifications.map((n) => n.title), ['N4', 'N3', 'N2']);
  assert.deepEqual(page3.body.notifications.map((n) => n.title), ['N1']);
  assert.equal(page1.body.total, 7);
  assert.equal(page3.body.unreadCount, 7);
});

test('pagination: equal timestamps fall back to id order without gaps or repeats', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  for (let i = 1; i <= 5; i++) await add(u.id, `T${i}`, { at: '2026-04-01T00:00:00Z' });
  const seen = [];
  for (const offset of [0, 2, 4]) {
    const res = await call('GET', `/api/me/notifications?limit=2&offset=${offset}`, { token: u.token });
    seen.push(...res.body.notifications.map((n) => n.title));
  }
  assert.deepEqual(seen, ['T5', 'T4', 'T3', 'T2', 'T1']);
});

test('invalid query values are rejected with 400', async () => {
  for (const q of ['limit=0', 'limit=101', 'limit=abc', 'limit=-1', 'offset=-1', 'offset=x', 'unread=maybe', 'limit=1.5']) {
    const res = await call('GET', `/api/me/notifications?${q}`, { token: a.token });
    assert.equal(res.status, 400, q);
  }
});

test('unread filter, and unreadCount always reflects all unread', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  await add(u.id, 'read one', { read: true });
  await add(u.id, 'unread one');
  await add(u.id, 'unread two');
  const unread = await call('GET', '/api/me/notifications?unread=true', { token: u.token });
  assert.deepEqual(unread.body.notifications.map((n) => n.title).sort(), ['unread one', 'unread two']);
  assert.equal(unread.body.total, 2);
  assert.equal(unread.body.unreadCount, 2);
  const read = await call('GET', '/api/me/notifications?unread=false', { token: u.token });
  assert.equal(read.body.total, 3);
  const small = await call('GET', '/api/me/notifications?unread=true&limit=1', { token: u.token });
  assert.equal(small.body.notifications.length, 1);
  assert.equal(small.body.unreadCount, 2);
});

test('marking your own notification read updates the count and keeps the first read time', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  const id = await add(u.id, 'mark me');
  await add(u.id, 'other');
  const first = await call('POST', `/api/me/notifications/${id}/read`, { token: u.token });
  assert.equal(first.status, 200);
  assert.equal(first.body.unreadCount, 1);
  const t1 = (await db.pool.query('SELECT read_at FROM notifications WHERE id = $1', [id])).rows[0].read_at;
  assert.ok(t1);
  const again = await call('POST', `/api/me/notifications/${id}/read`, { token: u.token });
  assert.equal(again.status, 200);
  const t2 = (await db.pool.query('SELECT read_at FROM notifications WHERE id = $1', [id])).rows[0].read_at;
  assert.equal(t1.getTime(), t2.getTime());
});

test("another user's notification cannot be marked read (404) and stays unread", async () => {
  const id = await add(b.id, 'b private');
  const res = await call('POST', `/api/me/notifications/${id}/read`, { token: a.token });
  assert.equal(res.status, 404);
  const row = (await db.pool.query('SELECT read_at FROM notifications WHERE id = $1', [id])).rows[0];
  assert.equal(row.read_at, null);
});

test('invalid and unknown notification ids are handled safely', async () => {
  for (const bad of ['abc', '0', '-1', '1.5', '99999999999999999999', '1;DROP']) {
    const res = await call('POST', `/api/me/notifications/${encodeURIComponent(bad)}/read`, { token: a.token });
    assert.equal(res.status, 400, bad);
  }
  assert.equal((await call('POST', '/api/me/notifications/999999/read', { token: a.token })).status, 404);
});

test('mark-all-read affects only the current user, ignores a supplied recipient, and is repeatable', async () => {
  const x = await createUser(db.pool, { role: 'student' });
  const y = await createUser(db.pool, { role: 'student' });
  await add(x.id, 'x1');
  await add(x.id, 'x2');
  await add(y.id, 'y1');
  const res = await call('POST', '/api/me/notifications/read-all', { token: x.token, body: { recipientId: y.id } });
  assert.equal(res.status, 200);
  assert.equal(res.body.updated, 2);
  assert.equal(res.body.unreadCount, 0);
  const yList = await call('GET', '/api/me/notifications', { token: y.token });
  assert.equal(yList.body.unreadCount, 1);
  const again = await call('POST', '/api/me/notifications/read-all', { token: x.token });
  assert.equal(again.body.updated, 0);
});

test('a notification of another user does not appear even when ids are guessed in a listing', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  const res = await call('GET', '/api/me/notifications?limit=100', { token: u.token });
  assert.equal(res.body.total, 0);
});
