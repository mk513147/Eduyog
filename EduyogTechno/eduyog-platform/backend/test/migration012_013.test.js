// Migrations 012 (student approval, course access) and 013 (certificate requests) applied to a database that
// already holds data: nothing is locked out, rewritten or back-filled, and the constraints behave.

const fs = require('fs');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, applyMigration, createUser, createCourse, enrol } = require('./helpers');

let db;
let admin;
let trainer;
let multi; // two active enrolments (allowed before the rule existed)
let finished; // completed enrolment with a certificate
let courseA;
let courseB;
let snapshot;

before(async () => {
  db = await createTestDatabase({ upTo: '011' });
  admin = await createUser(db.pool, { role: 'admin' });
  trainer = await createUser(db.pool, { role: 'trainer' });
  multi = await createUser(db.pool, { fullName: 'Multi Active' });
  finished = await createUser(db.pool, { fullName: 'Finished Student' });
  courseA = await createCourse(db.pool, { title: 'Legacy A', topicCount: 2 });
  courseB = await createCourse(db.pool, { title: 'Legacy B', topicCount: 2 });
  await enrol(db.pool, multi.id, courseA.id);
  await enrol(db.pool, multi.id, courseB.id);
  await enrol(db.pool, finished.id, courseA.id, 'completed');
  await db.pool.query('INSERT INTO certificates (student_id, course_id, student_name, course_title) VALUES ($1, $2, $3, $4)', [finished.id, courseA.id, 'Finished Student', 'Legacy A']);
  snapshot = {
    users: (await db.pool.query('SELECT id, role, email FROM users ORDER BY id')).rows,
    enrolments: (await db.pool.query('SELECT id, student_id, course_id, status FROM enrolments ORDER BY id')).rows,
    certificates: (await db.pool.query('SELECT * FROM certificates ORDER BY id')).rows,
  };
});

after(async () => {
  await db.drop();
});

const violation = (sql, params) => db.pool.query(sql, params).then(() => null, (err) => err);

test('012 and 013 apply on top of existing data without changing any row', async () => {
  await applyMigration(db.pool, '012');
  await applyMigration(db.pool, '013');
  assert.deepEqual((await db.pool.query('SELECT id, role, email FROM users ORDER BY id')).rows, snapshot.users);
  assert.deepEqual((await db.pool.query('SELECT id, student_id, course_id, status FROM enrolments ORDER BY id')).rows, snapshot.enrolments);
  assert.deepEqual((await db.pool.query('SELECT * FROM certificates ORDER BY id')).rows, snapshot.certificates, 'certificates are byte-for-byte unchanged');
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM certificate_requests')).rows[0].n, 0, 'nothing is back-filled into requests');
});

test('every existing account is back-filled as approved (nobody is locked out)', async () => {
  const { rows } = await db.pool.query('SELECT role, approval_status, approval_decided_by, approval_reason FROM users ORDER BY id');
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.approval_status === 'approved' && r.approval_decided_by === null && r.approval_reason === null));
  assert.deepEqual(rows.map((r) => r.role), ['admin', 'trainer', 'student', 'student']);
});

test('existing enrolments keep their status; granted_by is empty for them; several active enrolments are still allowed', async () => {
  const { rows } = await db.pool.query('SELECT status, granted_by FROM enrolments WHERE student_id = $1', [multi.id]);
  assert.deepEqual(rows, [{ status: 'active', granted_by: null }, { status: 'active', granted_by: null }]);
  const third = await createCourse(db.pool, { title: 'Legacy C' });
  await enrol(db.pool, multi.id, third.id); // no unique constraint on "one active course": must not fail
  assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM enrolments WHERE student_id = $1 AND status = 'active'", [multi.id])).rows[0].n, 3);
});

test('012 and 013 fail loudly when run a second time', async () => {
  for (const file of ['012_student_approval_and_course_access.sql', '013_certificate_requests.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema', file), 'utf8');
    const conn = await db.pool.connect();
    try {
      await assert.rejects(conn.query(sql), /already exists/);
    } finally {
      await conn.query('ROLLBACK').catch(() => {});
      conn.release();
    }
  }
});

test('approval columns: new users default to approved at the database; status and reason are constrained', async () => {
  const later = await createUser(db.pool, { role: 'trainer' });
  assert.equal((await db.pool.query('SELECT approval_status FROM users WHERE id = $1', [later.id])).rows[0].approval_status, 'approved');
  const bad = await violation("UPDATE users SET approval_status = 'banned' WHERE id = $1", [later.id]);
  assert.equal(bad.code, '23514');
  const long = await violation('UPDATE users SET approval_reason = $2 WHERE id = $1', [later.id, 'x'.repeat(501)]);
  assert.equal(long.code, '22001');
  const none = await violation('UPDATE users SET approval_status = NULL WHERE id = $1', [later.id]);
  assert.equal(none.code, '23502');
});

test('certificate_requests: states are consistent, one pending per student and course, history is allowed', async () => {
  const insert = (status, extra = {}) =>
    violation(
      `INSERT INTO certificate_requests (student_id, course_id, status, decided_at, decided_by, certificate_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [extra.student ?? multi.id, extra.course ?? courseB.id, status, extra.decidedAt ?? null, extra.decidedBy ?? null, extra.certificate ?? null]
    );
  assert.equal((await insert('bogus')).code, '23514');
  assert.equal((await insert('approved')).code, '23514', 'approved needs a decision and a certificate');
  assert.equal((await insert('rejected')).code, '23514', 'rejected needs a decision');
  assert.equal((await insert('pending', { decidedBy: admin.id, decidedAt: new Date() })).code, '23514', 'pending has no decision');
  assert.equal(await insert('pending'), null);
  assert.equal((await insert('pending')).code, '23505', 'a second pending request is refused');
  // decided requests are history: any number may exist
  assert.equal(await insert('rejected', { decidedAt: new Date(), decidedBy: admin.id }), null);
  assert.equal(await insert('rejected', { decidedAt: new Date(), decidedBy: admin.id }), null);
  const cert = (await db.pool.query('SELECT id FROM certificates WHERE student_id = $1', [finished.id])).rows[0].id;
  assert.equal(await insert('approved', { student: finished.id, course: courseA.id, decidedAt: new Date(), decidedBy: admin.id, certificate: cert }), null);
  // one request per certificate
  assert.equal((await insert('approved', { student: finished.id, course: courseA.id, decidedAt: new Date(), decidedBy: admin.id, certificate: cert })).code, '23505');
});

test('a decided request is immutable and its student and course never change', async () => {
  const { rows } = await db.pool.query("SELECT id FROM certificate_requests WHERE status = 'rejected' ORDER BY id LIMIT 1");
  const id = rows[0].id;
  assert.equal((await violation("UPDATE certificate_requests SET decision_reason = 'edited' WHERE id = $1", [id])).code, '23514');
  assert.equal((await violation('UPDATE certificate_requests SET course_id = $2 WHERE id = $1', [id, courseA.id])).code, '23514');
  const pending = (await db.pool.query("SELECT id FROM certificate_requests WHERE status = 'pending' LIMIT 1")).rows[0].id;
  assert.equal(await violation("UPDATE certificate_requests SET status = 'rejected', decided_at = now(), decided_by = $2, decision_reason = 'ok' WHERE id = $1", [pending, admin.id]), null);
  assert.ok(trainer.id);
});
