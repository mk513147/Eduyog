const fs = require('fs');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, applyMigration, createUser, createCourse } = require('./helpers');

let db;
let courseA;
let courseB;

before(async () => {
  db = await createTestDatabase({ upTo: '008' });
  await createUser(db.pool, { role: 'student' });
  courseA = await createCourse(db.pool, { title: 'Mig A', topicCount: 2 });
  courseB = await createCourse(db.pool, { title: 'Mig B', topicCount: 2 });
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

const FAQ = 'INSERT INTO course_faqs (course_id, question, answer, display_order) VALUES ($1, $2, $3, $4)';
const RES =
  'INSERT INTO course_resources (course_id, module_id, topic_id, title, resource_type, url, display_order) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *';
const res = (courseId, over = {}) =>
  db.pool.query(RES, [
    courseId,
    over.moduleId ?? null,
    over.topicId ?? null,
    over.title ?? 'R',
    over.type ?? 'external',
    over.url ?? 'https://example.com/x',
    over.order ?? 0,
  ]);

test('009 applies after 001-008 and keeps existing data', async () => {
  await applyMigration(db.pool, '009');
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 1);
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM courses')).rows[0].n, 2);
  const t = await db.pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name IN ('course_faqs', 'course_resources') ORDER BY 1"
  );
  assert.deepEqual(t.rows.map((r) => r.table_name), ['course_faqs', 'course_resources']);
});

test('009 fails when run a second time', async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema', '009_course_content.sql'), 'utf8');
  const conn = await db.pool.connect();
  try {
    await assert.rejects(conn.query(sql), /already exists/);
  } finally {
    await conn.query('ROLLBACK').catch(() => {});
    conn.release();
  }
});

test('FAQ constraints: blank, over-long, bad order, missing course', async () => {
  assert.equal(await violation(FAQ, [courseA.id, 'Q?', 'A.', 0]), null);
  assert.equal((await violation(FAQ, [courseA.id, '  ', 'A', 0])).code, '23514');
  assert.equal((await violation(FAQ, [courseA.id, 'Q', '   ', 0])).code, '23514');
  assert.equal((await violation(FAQ, [courseA.id, 'q'.repeat(501), 'A', 0])).code, '22001');
  assert.equal((await violation(FAQ, [courseA.id, 'Q', 'a'.repeat(3001), 0])).code, '23514');
  assert.equal(await violation(FAQ, [courseA.id, 'q'.repeat(500), 'a'.repeat(3000), 0]), null);
  assert.equal((await violation(FAQ, [courseA.id, 'Q', 'A', -1])).code, '23514');
  assert.equal((await violation(FAQ, [999999, 'Q', 'A', 0])).code, '23503');
});

test('FAQ ordering is by display_order then id', async () => {
  const c = await createCourse(db.pool, { title: 'Order' });
  for (const [q, o] of [['third', 2], ['first', 1], ['second-a', 2], ['zero', 0]]) await db.pool.query(FAQ, [c.id, q, 'a', o]);
  const { rows } = await db.pool.query('SELECT question FROM course_faqs WHERE course_id = $1 ORDER BY display_order, id', [c.id]);
  assert.deepEqual(rows.map((r) => r.question), ['zero', 'first', 'third', 'second-a']);
});

test('resource types: all five accepted, others rejected', async () => {
  for (const type of ['video', 'pdf', 'document', 'presentation', 'external']) {
    assert.equal(await violation(RES, [courseA.id, null, null, 'T', type, 'https://example.com/a', 0]), null, type);
  }
  for (const bad of ['audio', 'PDF', '', 'link']) {
    assert.equal((await violation(RES, [courseA.id, null, null, 'T', bad, 'https://example.com/a', 0])).code, '23514', bad);
  }
});

test('resource URLs: http(s) only; dangerous and malformed values rejected', async () => {
  for (const ok of ['http://example.com', 'https://example.com/a/b.pdf?x=1#y', 'HTTPS://EXAMPLE.COM/A', 'https://localhost:3000/x']) {
    assert.equal(await violation(RES, [courseA.id, null, null, 'T', 'external', ok, 0]), null, ok);
  }
  const bad = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
    'ftp://example.com/x',
    '//example.com/x',
    'example.com/x',
    'https://',
    'https:// example.com',
    'https://exa mple.com',
    '/relative/path',
    '',
  ];
  for (const url of bad) {
    const err = await violation(RES, [courseA.id, null, null, 'T', 'external', url, 0]);
    assert.equal(err && err.code, '23514', url);
  }
  assert.equal((await violation(RES, [courseA.id, null, null, 'T', 'external', 'https://e.com/' + 'a'.repeat(2048), 0])).code, '22001');
});

test('resource text constraints and display order', async () => {
  assert.equal((await violation(RES, [courseA.id, null, null, '  ', 'external', 'https://e.com', 0])).code, '23514');
  assert.equal((await violation(RES, [courseA.id, null, null, 'x'.repeat(201), 'external', 'https://e.com', 0])).code, '22001');
  assert.equal((await violation(RES, [courseA.id, null, null, 'T', 'external', 'https://e.com', -5])).code, '23514');
  const desc = 'INSERT INTO course_resources (course_id, title, description, resource_type, url) VALUES ($1, $2, $3, $4, $5)';
  assert.equal((await violation(desc, [courseA.id, 'T', 'd'.repeat(1001), 'pdf', 'https://e.com'])).code, '22001');
  assert.equal((await violation(RES, [999999, null, null, 'T', 'external', 'https://e.com', 0])).code, '23503');
});

test('module/topic links must belong to the resource course (database trigger)', async () => {
  assert.equal((await violation(RES, [courseA.id, courseB.moduleId, null, 'T', 'pdf', 'https://e.com', 0])).code, '23514');
  assert.equal((await violation(RES, [courseA.id, null, courseB.topicIds[0], 'T', 'pdf', 'https://e.com', 0])).code, '23514');
  assert.equal((await violation(RES, [courseA.id, courseB.moduleId, courseA.topicIds[0], 'T', 'pdf', 'https://e.com', 0])).code, '23514');
  assert.equal((await violation(RES, [courseA.id, 999999, null, 'T', 'pdf', 'https://e.com', 0])).code, '23514');
  const ok = await res(courseA.id, { moduleId: courseA.moduleId });
  assert.equal(ok.rows[0].module_id, courseA.moduleId);
});

test('a topic fills in its module; moving a resource to another course is blocked while linked', async () => {
  const r = await res(courseA.id, { topicId: courseA.topicIds[0] });
  assert.equal(r.rows[0].module_id, courseA.moduleId);
  const err = await violation('UPDATE course_resources SET course_id = $1 WHERE id = $2', [courseB.id, r.rows[0].id]);
  assert.equal(err.code, '23514');
  const err2 = await violation('UPDATE course_resources SET module_id = $1 WHERE id = $2', [courseB.moduleId, r.rows[0].id]);
  assert.equal(err2.code, '23514');
});

test('updated_at changes on update', async () => {
  const r = await res(courseA.id, { title: 'Touch' });
  await new Promise((x) => setTimeout(x, 20));
  const u = await db.pool.query("UPDATE course_resources SET title = 'Touched' WHERE id = $1 RETURNING created_at, updated_at", [r.rows[0].id]);
  assert.ok(u.rows[0].updated_at > u.rows[0].created_at);
});

test('deleting a course removes its FAQs and resources', async () => {
  const c = await createCourse(db.pool, { title: 'Doomed' });
  await db.pool.query(FAQ, [c.id, 'Q', 'A', 0]);
  await res(c.id, { topicId: c.topicIds[0] });
  await db.pool.query('DELETE FROM courses WHERE id = $1', [c.id]);
  assert.equal((await db.pool.query('SELECT 1 FROM course_faqs WHERE course_id = $1', [c.id])).rows.length, 0);
  assert.equal((await db.pool.query('SELECT 1 FROM course_resources WHERE course_id = $1', [c.id])).rows.length, 0);
});

test('deleting a module or topic removes the resources tied to it, others stay', async () => {
  const c = await createCourse(db.pool, { title: 'Parts', topicCount: 2 });
  const onTopic = await res(c.id, { topicId: c.topicIds[0], title: 'topic one' });
  const onTopic2 = await res(c.id, { topicId: c.topicIds[1], title: 'topic two' });
  const wide = await res(c.id, { title: 'course wide' });
  await db.pool.query('DELETE FROM course_topics WHERE id = $1', [c.topicIds[0]]);
  let left = (await db.pool.query('SELECT title FROM course_resources WHERE course_id = $1 ORDER BY id', [c.id])).rows.map((r) => r.title);
  assert.deepEqual(left, ['topic two', 'course wide']);
  await db.pool.query('DELETE FROM course_modules WHERE id = $1', [c.moduleId]);
  left = (await db.pool.query('SELECT title FROM course_resources WHERE course_id = $1', [c.id])).rows.map((r) => r.title);
  assert.deepEqual(left, ['course wide']);
  assert.ok(onTopic && onTopic2 && wide);
});

test('indexes exist', async () => {
  const { rows } = await db.pool.query("SELECT indexname FROM pg_indexes WHERE tablename IN ('course_faqs', 'course_resources')");
  const names = rows.map((r) => r.indexname);
  for (const n of ['course_faqs_course_order_idx', 'course_resources_course_order_idx', 'course_resources_module_idx', 'course_resources_topic_idx']) {
    assert.ok(names.includes(n), n);
  }
});
