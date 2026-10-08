const fs = require('fs');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, applyMigration, createUser, createCourse } = require('./helpers');

let db;
let author;
let student;
let course;

before(async () => {
  db = await createTestDatabase({ upTo: '007' });
  author = await createUser(db.pool, { role: 'admin' });
  student = await createUser(db.pool, { role: 'student' });
  course = await createCourse(db.pool, { title: 'Mig Course' });
});

after(async () => {
  await db.drop();
});

async function violation(sql, params) {
  try {
    await db.pool.query(sql, params);
  } catch (err) {
    return err;
  }
  return null;
}

const addAnnouncement = (courseId, title = 'Hello', body = 'World', authorId = author.id) =>
  db.pool.query('INSERT INTO announcements (course_id, author_id, title, body) VALUES ($1, $2, $3, $4) RETURNING id', [
    courseId,
    authorId,
    title,
    body,
  ]);

const addNotification = (recipientId, fields = {}) =>
  db.pool.query(
    'INSERT INTO notifications (recipient_id, type, title, body, link_path, course_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [recipientId, fields.type ?? 'announcement', fields.title ?? 'T', fields.body ?? null, fields.linkPath ?? null, fields.courseId ?? null]
  );

const INSERT_A = 'INSERT INTO announcements (author_id, title, body) VALUES ($1, $2, $3)';
const INSERT_N_LINK = "INSERT INTO notifications (recipient_id, type, title, link_path) VALUES ($1, 'announcement', 't', $2)";

test('008 applies after 001-007 and keeps existing data', async () => {
  await applyMigration(db.pool, '008');
  const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM users');
  assert.equal(rows[0].n, 2);
  const tables = await db.pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name IN ('announcements', 'notifications') ORDER BY 1"
  );
  assert.deepEqual(tables.rows.map((r) => r.table_name), ['announcements', 'notifications']);
});

test('008 fails when run a second time', async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema', '008_announcements_notifications.sql'), 'utf8');
  const conn = await db.pool.connect();
  try {
    await assert.rejects(conn.query(sql), /already exists/);
  } finally {
    await conn.query('ROLLBACK').catch(() => {});
    conn.release();
  }
});

test('announcements: platform-wide (NULL course) and course rows are accepted', async () => {
  await addAnnouncement(null);
  await addAnnouncement(course.id);
  const { rows } = await db.pool.query('SELECT created_at FROM announcements');
  assert.equal(rows.length, 2);
  assert.ok(rows[0].created_at);
});

test('announcements: empty and over-long title/body are rejected', async () => {
  assert.equal((await violation(INSERT_A, [author.id, '  ', 'x'])).code, '23514');
  assert.equal((await violation(INSERT_A, [author.id, 'x', '   '])).code, '23514');
  assert.equal((await violation(INSERT_A, [author.id, 'x'.repeat(201), 'b'])).code, '22001');
  assert.equal((await violation(INSERT_A, [author.id, 't', 'b'.repeat(3001)])).code, '23514');
  assert.equal(await violation(INSERT_A, [author.id, 'x'.repeat(200), 'b'.repeat(3000)]), null);
});

test('announcements: foreign keys (course must exist, author must exist)', async () => {
  assert.equal(
    (await violation('INSERT INTO announcements (course_id, author_id, title, body) VALUES (999999, $1, $2, $3)', [author.id, 't', 'b'])).code,
    '23503'
  );
  assert.equal((await violation('INSERT INTO announcements (author_id, title, body) VALUES (999999, $1, $2)', ['t', 'b'])).code, '23503');
});

test('announcements: deleting an author with history is blocked, deleting a course removes its announcements', async () => {
  const other = await createUser(db.pool, { role: 'trainer' });
  const c2 = await createCourse(db.pool, { title: 'Doomed' });
  await addAnnouncement(c2.id, 'a', 'b', other.id);
  const err = await violation('DELETE FROM users WHERE id = $1', [other.id]);
  assert.ok(err && ['23001', '23503'].includes(err.code));
  await db.pool.query('DELETE FROM courses WHERE id = $1', [c2.id]);
  const { rows } = await db.pool.query('SELECT 1 FROM announcements WHERE course_id = $1', [c2.id]);
  assert.equal(rows.length, 0);
});

test('notifications: valid row, defaults to unread, free-form lower-case types allowed', async () => {
  await addNotification(student.id, { type: 'some_future_type' });
  const { rows } = await db.pool.query('SELECT read_at, created_at FROM notifications');
  assert.equal(rows[0].read_at, null);
  assert.ok(rows[0].created_at);
  const err = await violation("INSERT INTO notifications (recipient_id, type, title) VALUES ($1, 'Bad Type', 't')", [student.id]);
  assert.equal(err.code, '23514');
});

test('notifications: title, body and recipient constraints', async () => {
  const insert = 'INSERT INTO notifications (recipient_id, type, title, body) VALUES ($1, $2, $3, $4)';
  assert.equal((await violation(insert, [student.id, 'announcement', ' ', null])).code, '23514');
  assert.equal((await violation(insert, [student.id, 'announcement', 't'.repeat(201), null])).code, '22001');
  assert.equal((await violation(insert, [student.id, 'announcement', 't', 'b'.repeat(501)])).code, '22001');
  assert.equal((await violation(insert, [999999, 'announcement', 't', null])).code, '23503');
  const withCourse = "INSERT INTO notifications (recipient_id, type, title, course_id) VALUES ($1, 'announcement', 't', 999999)";
  assert.equal((await violation(withCourse, [student.id])).code, '23503');
});

test('notifications: link_path accepts internal paths only', async () => {
  for (const ok of ['/notifications', '/my-courses/12', '/course/slug?tab=a#top']) {
    assert.equal(await violation(INSERT_N_LINK, [student.id, ok]), null, ok);
  }
  const bad = ['https://evil.example/x', '//evil.example', 'javascript:alert(1)', 'my-courses/1', '/a b', '/a\\b', 'http://x', '/x"y'];
  for (const link of bad) {
    const err = await violation(INSERT_N_LINK, [student.id, link]);
    assert.equal(err && err.code, '23514', link);
  }
});

test('notifications: deleting the recipient or the course removes the rows', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  const c = await createCourse(db.pool, { title: 'Gone' });
  await addNotification(u.id, { courseId: c.id });
  await db.pool.query('DELETE FROM courses WHERE id = $1', [c.id]);
  assert.equal((await db.pool.query('SELECT 1 FROM notifications WHERE recipient_id = $1', [u.id])).rows.length, 0);
  await addNotification(u.id);
  await db.pool.query('DELETE FROM users WHERE id = $1', [u.id]);
  assert.equal((await db.pool.query('SELECT 1 FROM notifications WHERE recipient_id = $1', [u.id])).rows.length, 0);
});

test('indexes exist, and the unread index is partial', async () => {
  const { rows } = await db.pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('announcements', 'notifications')");
  const def = (name) => rows.find((r) => r.indexname === name)?.indexdef;
  assert.match(def('announcements_course_created_idx'), /\(course_id, created_at DESC\)/);
  assert.match(def('notifications_recipient_created_idx'), /\(recipient_id, created_at DESC, id DESC\)/);
  assert.match(def('notifications_recipient_unread_idx'), /\(recipient_id\) WHERE \(read_at IS NULL\)/);
});

test('unread behaviour: only rows with read_at NULL count as unread', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  const a = await addNotification(u.id);
  await addNotification(u.id);
  await db.pool.query('UPDATE notifications SET read_at = now() WHERE id = $1', [a.rows[0].id]);
  const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM notifications WHERE recipient_id = $1 AND read_at IS NULL', [u.id]);
  assert.equal(rows[0].n, 1);
});
