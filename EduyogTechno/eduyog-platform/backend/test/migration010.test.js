const fs = require('fs');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, applyMigration, createUser, createCourse } = require('./helpers');

let db;
let author;
let student;
let courseA;
let courseB;

before(async () => {
  db = await createTestDatabase({ upTo: '009' });
  author = await createUser(db.pool, { role: 'admin' });
  student = await createUser(db.pool, { role: 'student' });
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

const A_INSERT =
  'INSERT INTO assignments (course_id, module_id, topic_id, title, instructions, due_at, status, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';
const assignment = (over = {}) =>
  db.pool.query(A_INSERT, [
    over.courseId ?? courseA.id,
    over.moduleId ?? null,
    over.topicId ?? null,
    over.title ?? 'HW',
    over.instructions ?? 'Do it',
    over.dueAt ?? null,
    over.status ?? 'draft',
    over.createdBy ?? author.id,
  ]);
const S_INSERT = 'INSERT INTO assignment_submissions (assignment_id, student_id, text_content, submission_url, submitted_at) VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now())) RETURNING *';
const submission = (assignmentId, over = {}) =>
  db.pool.query(S_INSERT, [assignmentId, over.studentId ?? student.id, over.text ?? 'my answer', over.url ?? null, over.at ?? null]);

test('010 applies after 001-009 and keeps existing data', async () => {
  await applyMigration(db.pool, '010');
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM courses')).rows[0].n, 2);
  const t = await db.pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name IN ('assignments', 'assignment_submissions', 'assignment_feedback') ORDER BY 1"
  );
  assert.deepEqual(t.rows.map((r) => r.table_name), ['assignment_feedback', 'assignment_submissions', 'assignments']);
});

test('010 fails when run a second time', async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema', '010_assignments.sql'), 'utf8');
  const conn = await db.pool.connect();
  try {
    await assert.rejects(conn.query(sql), /already exists/);
  } finally {
    await conn.query('ROLLBACK').catch(() => {});
    conn.release();
  }
});

test('assignment constraints: text, status, order, due date, foreign keys', async () => {
  const ok = await assignment();
  assert.equal(ok.rows[0].status, 'draft');
  assert.equal(ok.rows[0].due_at, null);
  assert.equal((await violation(A_INSERT, [courseA.id, null, null, '  ', 'x', null, 'draft', author.id])).code, '23514');
  assert.equal((await violation(A_INSERT, [courseA.id, null, null, 't', '   ', null, 'draft', author.id])).code, '23514');
  assert.equal((await violation(A_INSERT, [courseA.id, null, null, 't'.repeat(201), 'x', null, 'draft', author.id])).code, '22001');
  assert.equal((await violation(A_INSERT, [courseA.id, null, null, 't', 'x'.repeat(5001), null, 'draft', author.id])).code, '23514');
  for (const status of ['archived', 'Published', '', 'open']) {
    assert.equal((await violation(A_INSERT, [courseA.id, null, null, 't', 'x', null, status, author.id])).code, '23514', status);
  }
  for (const status of ['draft', 'published', 'closed']) {
    assert.equal(await violation(A_INSERT, [courseA.id, null, null, 't', 'x', null, status, author.id]), null, status);
  }
  assert.equal((await violation('INSERT INTO assignments (course_id, title, instructions, display_order, created_by) VALUES ($1, $2, $3, -1, $4)', [courseA.id, 't', 'x', author.id])).code, '23514');
  assert.equal((await violation(A_INSERT, [999999, null, null, 't', 'x', null, 'draft', author.id])).code, '23503');
  assert.equal((await violation(A_INSERT, [courseA.id, null, null, 't', 'x', null, 'draft', 999999])).code, '23503');
});

test('assignment links: module/topic must belong to the course and agree; a topic fills its module', async () => {
  assert.equal((await violation(A_INSERT, [courseA.id, courseB.moduleId, null, 't', 'x', null, 'draft', author.id])).code, '23514');
  assert.equal((await violation(A_INSERT, [courseA.id, null, courseB.topicIds[0], 't', 'x', null, 'draft', author.id])).code, '23514');
  assert.equal((await violation(A_INSERT, [courseA.id, courseB.moduleId, courseA.topicIds[0], 't', 'x', null, 'draft', author.id])).code, '23514');
  const r = await assignment({ topicId: courseA.topicIds[0] });
  assert.equal(r.rows[0].module_id, courseA.moduleId);
  assert.equal((await violation('UPDATE assignments SET course_id = $1 WHERE id = $2', [courseB.id, r.rows[0].id])).code, '23514');
  assert.equal((await violation('UPDATE assignments SET module_id = $1 WHERE id = $2', [courseB.moduleId, r.rows[0].id])).code, '23514');
});

test('submission constraints: content required, blank text, URL rules, length', async () => {
  const a = (await assignment({ status: 'published' })).rows[0];
  assert.equal(await violation(S_INSERT, [a.id, student.id, 'text only', null, null]), null);
  assert.equal(await violation(S_INSERT, [a.id, student.id, null, 'https://example.com/work', null]), null);
  assert.equal(await violation(S_INSERT, [a.id, student.id, 'both', 'http://example.com', null]), null);
  assert.equal((await violation(S_INSERT, [a.id, student.id, null, null, null])).code, '23514', 'neither');
  assert.equal((await violation(S_INSERT, [a.id, student.id, '   ', null, null])).code, '23514', 'blank text only');
  assert.equal((await violation(S_INSERT, [a.id, student.id, 'x'.repeat(5001), null, null])).code, '23514');
  const bad = ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'vbscript:x', 'ftp://example.com', 'http:///nohost', 'example.com', '//example.com', 'https://exa mple.com', ''];
  for (const url of bad) {
    const err = await violation(S_INSERT, [a.id, student.id, null, url, null]);
    assert.equal(err && err.code, '23514', url);
  }
  assert.equal((await violation(S_INSERT, [a.id, student.id, null, 'https://e.com/' + 'a'.repeat(2048), null])).code, '22001');
  assert.equal((await violation(S_INSERT, [999999, student.id, 'x', null, null])).code, '23503');
  assert.equal((await violation(S_INSERT, [a.id, 999999, 'x', null, null])).code, '23503');
});

test('several submissions per student are allowed (no unique pair); history is ordered newest first', async () => {
  const a = (await assignment({ status: 'published' })).rows[0];
  const first = await submission(a.id, { text: 'v1', at: '2026-01-01T10:00:00Z' });
  const second = await submission(a.id, { text: 'v2', at: '2026-01-02T10:00:00Z' });
  const third = await submission(a.id, { text: 'v3', at: '2026-01-02T10:00:00Z' });
  const { rows } = await db.pool.query(
    'SELECT text_content FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2 ORDER BY submitted_at DESC, id DESC',
    [a.id, student.id]
  );
  assert.deepEqual(rows.map((r) => r.text_content), ['v3', 'v2', 'v1']);
  assert.ok(first.rows[0].id < second.rows[0].id && second.rows[0].id < third.rows[0].id);
});

test('is_late is computed by the database: no due date, before, exactly at, just after', async () => {
  const none = (await assignment({ status: 'published' })).rows[0];
  assert.equal((await submission(none.id)).rows[0].is_late, false);
  const due = '2026-06-01T12:00:00.000Z';
  const dated = (await assignment({ status: 'published', dueAt: due })).rows[0];
  assert.equal((await submission(dated.id, { at: '2026-06-01T11:59:59.999Z' })).rows[0].is_late, false);
  assert.equal((await submission(dated.id, { at: due })).rows[0].is_late, false, 'exactly at the due time is on time');
  assert.equal((await submission(dated.id, { at: '2026-06-01T12:00:00.001Z' })).rows[0].is_late, true);
  // a supplied value is ignored
  const forged = await db.pool.query(
    "INSERT INTO assignment_submissions (assignment_id, student_id, text_content, submitted_at, is_late) VALUES ($1, $2, 'x', '2026-05-01T00:00:00Z', TRUE) RETURNING is_late",
    [dated.id, student.id]
  );
  assert.equal(forged.rows[0].is_late, false);
  const past = (await assignment({ status: 'published', dueAt: '2020-01-01T00:00:00Z' })).rows[0];
  assert.equal((await submission(past.id)).rows[0].is_late, true, 'now() after a past due date');
});

test('feedback: one per submission, text only, no grades', async () => {
  const a = (await assignment({ status: 'published' })).rows[0];
  const s = (await submission(a.id)).rows[0];
  const F = 'INSERT INTO assignment_feedback (submission_id, author_id, feedback_text) VALUES ($1, $2, $3)';
  assert.equal(await violation(F, [s.id, author.id, 'Good work']), null);
  assert.equal((await violation(F, [s.id, author.id, 'Again'])).code, '23505', 'unique per submission');
  const s2 = (await submission(a.id)).rows[0];
  assert.equal((await violation(F, [s2.id, author.id, '   '])).code, '23514');
  assert.equal((await violation(F, [s2.id, author.id, 'x'.repeat(3001)])).code, '23514');
  assert.equal((await violation(F, [999999, author.id, 'x'])).code, '23503');
  assert.equal((await violation(F, [s2.id, 999999, 'x'])).code, '23503');
  const cols = await db.pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'assignment_feedback'");
  assert.ok(!cols.rows.some((c) => /grade|score|mark|percent/.test(c.column_name)));
});

test('deleting an assignment deletes its submissions and feedback; a course delete does the same', async () => {
  const c = await createCourse(db.pool, { title: 'Doomed', topicCount: 1 });
  const a = (await assignment({ courseId: c.id, status: 'published' })).rows[0];
  const s = (await submission(a.id)).rows[0];
  await db.pool.query("INSERT INTO assignment_feedback (submission_id, author_id, feedback_text) VALUES ($1, $2, 'ok')", [s.id, author.id]);
  await db.pool.query('DELETE FROM assignments WHERE id = $1', [a.id]);
  for (const [table, col, val] of [['assignment_submissions', 'id', s.id], ['assignment_feedback', 'submission_id', s.id]]) {
    assert.equal((await db.pool.query(`SELECT 1 FROM ${table} WHERE ${col} = $1`, [val])).rows.length, 0, table);
  }
  const a2 = (await assignment({ courseId: c.id })).rows[0];
  const s2 = (await submission(a2.id)).rows[0];
  await db.pool.query('DELETE FROM courses WHERE id = $1', [c.id]);
  assert.equal((await db.pool.query('SELECT 1 FROM assignments WHERE id = $1', [a2.id])).rows.length, 0);
  assert.equal((await db.pool.query('SELECT 1 FROM assignment_submissions WHERE id = $1', [s2.id])).rows.length, 0);
});

test('deleting a topic or module only clears the link; deleting a student removes their submissions; authors are protected', async () => {
  const c = await createCourse(db.pool, { title: 'Links', topicCount: 2 });
  const onTopic = (await assignment({ courseId: c.id, topicId: c.topicIds[0], status: 'published' })).rows[0];
  const onModule = (await assignment({ courseId: c.id, moduleId: c.moduleId })).rows[0];
  const s = (await submission(onTopic.id)).rows[0];
  await db.pool.query('DELETE FROM course_topics WHERE id = $1', [c.topicIds[0]]);
  let row = (await db.pool.query('SELECT topic_id, module_id FROM assignments WHERE id = $1', [onTopic.id])).rows[0];
  assert.equal(row.topic_id, null);
  assert.equal((await db.pool.query('SELECT 1 FROM assignment_submissions WHERE id = $1', [s.id])).rows.length, 1, 'submission survives');
  await db.pool.query('DELETE FROM course_modules WHERE id = $1', [c.moduleId]);
  row = (await db.pool.query('SELECT module_id FROM assignments WHERE id = $1', [onModule.id])).rows[0];
  assert.equal(row.module_id, null);
  assert.equal((await db.pool.query('SELECT 1 FROM assignments WHERE id = $1', [onModule.id])).rows.length, 1);

  const gone = await createUser(db.pool, { role: 'student' });
  const a = (await assignment({ status: 'published' })).rows[0];
  const gs = (await submission(a.id, { studentId: gone.id })).rows[0];
  await db.pool.query('DELETE FROM users WHERE id = $1', [gone.id]);
  assert.equal((await db.pool.query('SELECT 1 FROM assignment_submissions WHERE id = $1', [gs.id])).rows.length, 0);
  const err = await violation('DELETE FROM users WHERE id = $1', [author.id]);
  assert.ok(err && ['23001', '23503'].includes(err.code), 'creator with assignments cannot be deleted');
});

test('indexes exist', async () => {
  const { rows } = await db.pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename LIKE 'assignment%'");
  const def = (n) => rows.find((r) => r.indexname === n)?.indexdef;
  assert.match(def('assignments_course_order_idx'), /\(course_id, display_order, id\)/);
  assert.match(def('assignments_course_status_idx'), /\(course_id, status\)/);
  assert.match(def('assignment_submissions_history_idx'), /\(assignment_id, student_id, submitted_at DESC, id DESC\)/);
  assert.ok(def('assignment_feedback_submission_key'), 'feedback by submission (unique index)');
});
