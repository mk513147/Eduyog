const fs = require('fs');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, applyMigration, createUser, createCourse } = require('./helpers');

let db;
let admin;
let student;
let courseA;

before(async () => {
  db = await createTestDatabase({ upTo: '010' });
  admin = await createUser(db.pool, { role: 'admin' });
  student = await createUser(db.pool, { role: 'student', fullName: 'Migration Student' });
  courseA = await createCourse(db.pool, { title: 'Mig A' });
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

const ISSUE = 'INSERT INTO certificates (student_id, course_id, student_name, course_title) VALUES ($1, $2, $3, $4) RETURNING *';
const issue = (over = {}) =>
  db.pool.query(ISSUE, [over.studentId ?? student.id, over.courseId ?? courseA.id, over.name ?? 'Migration Student', over.title ?? 'Mig A']);

test('011 applies after 001-010 and keeps existing data', async () => {
  await applyMigration(db.pool, '011');
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 2);
  assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'certificates'")).rows[0].n, 1);
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM certificates')).rows[0].n, 0, 'nothing is back-filled');
});

test('011 fails when run a second time', async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema', '011_certificates.sql'), 'utf8');
  const conn = await db.pool.connect();
  try {
    await assert.rejects(conn.query(sql), /already exists/);
  } finally {
    await conn.query('ROLLBACK').catch(() => {});
    conn.release();
  }
});

test('an issued certificate gets a generated number, status active and timestamps', async () => {
  const { rows } = await issue();
  const c = rows[0];
  assert.match(c.certificate_number, /^EDUYOG-\d{4}-[0-9A-F]{10}$/);
  assert.equal(c.certificate_number.split('-')[1], String(new Date().getUTCFullYear()));
  assert.equal(c.status, 'active');
  assert.equal(c.revoked_at, null);
  assert.ok(c.issued_at && c.created_at);
  assert.ok(!c.certificate_number.includes(String(c.id).padStart(8, '0')), 'not derived from the id');
});

test('one certificate per student and course; numbers are unique', async () => {
  const err = await violation(ISSUE, [student.id, courseA.id, 'x', 'y']);
  assert.equal(err.code, '23505');
  assert.equal(err.constraint, 'certificates_student_course_key');
  const other = await createUser(db.pool, { role: 'student' });
  const second = await issue({ studentId: other.id });
  const first = (await db.pool.query('SELECT certificate_number FROM certificates WHERE student_id = $1', [student.id])).rows[0];
  assert.notEqual(second.rows[0].certificate_number, first.certificate_number);
  const dup = await violation("UPDATE certificates SET certificate_number = $1 WHERE id = $2", [first.certificate_number, second.rows[0].id]);
  assert.ok(dup, 'duplicate number or immutability error');
  const manual = await violation(
    'INSERT INTO certificates (certificate_number, student_id, course_id, student_name, course_title) VALUES ($1, $2, $3, $4, $5)',
    [first.certificate_number, other.id, (await createCourse(db.pool, { title: 'Other' })).id, 'n', 't']
  );
  assert.equal(manual.code, '23505');
  assert.equal(manual.constraint, 'certificates_number_key');
});

test('many certificates get distinct numbers', async () => {
  const course = await createCourse(db.pool, { title: 'Bulk' });
  const numbers = new Set();
  for (let i = 0; i < 25; i++) {
    const u = await createUser(db.pool, { role: 'student' });
    numbers.add((await issue({ studentId: u.id, courseId: course.id })).rows[0].certificate_number);
  }
  assert.equal(numbers.size, 25);
});

test('field constraints: blank snapshots, bad status, bad number, foreign keys', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  const c = await createCourse(db.pool, { title: 'Constraints' });
  assert.equal((await violation(ISSUE, [u.id, c.id, '  ', 'T'])).code, '23514');
  assert.equal((await violation(ISSUE, [u.id, c.id, 'N', '  '])).code, '23514');
  assert.equal((await violation(ISSUE, [u.id, c.id, 'n'.repeat(151), 'T'])).code, '22001');
  assert.equal((await violation(ISSUE, [u.id, c.id, 'N', 't'.repeat(201)])).code, '22001');
  assert.equal((await violation(ISSUE, [999999, c.id, 'N', 'T'])).code, '23503');
  assert.equal((await violation(ISSUE, [u.id, 999999, 'N', 'T'])).code, '23503');
  assert.equal((await violation("INSERT INTO certificates (student_id, course_id, student_name, course_title, status) VALUES ($1, $2, 'N', 'T', 'pending')", [u.id, c.id])).code, '23514');
  assert.equal((await violation("INSERT INTO certificates (certificate_number, student_id, course_id, student_name, course_title) VALUES ('x y', $1, $2, 'N', 'T')", [u.id, c.id])).code, '23514');
  assert.equal((await violation("INSERT INTO certificates (certificate_number, student_id, course_id, student_name, course_title) VALUES ('', $1, $2, 'N', 'T')", [u.id, c.id])).code, '23514');
  assert.equal((await violation("INSERT INTO certificates (certificate_number, student_id, course_id, student_name, course_title) VALUES ('abc-1234', $1, $2, 'N', 'T')", [u.id, c.id])).code, '23514', 'lower case');
});

test('revocation data must be complete and consistent', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  const c = await createCourse(db.pool, { title: 'Revoke' });
  const cert = (await issue({ studentId: u.id, courseId: c.id })).rows[0];
  const upd = (set, params = []) => violation(`UPDATE certificates SET ${set} WHERE id = ${cert.id}`, params);
  assert.equal((await upd("status = 'revoked'")).code, '23514', 'no details');
  assert.equal((await upd("status = 'revoked', revoked_at = now(), revoked_by = $1, revocation_reason = '  '", [admin.id])).code, '23514', 'blank reason');
  assert.equal((await upd("status = 'revoked', revoked_at = now(), revocation_reason = 'x'")).code, '23514', 'no admin');
  assert.equal((await upd("revocation_reason = 'orphan reason'")).code, '23514', 'details on an active certificate');
  assert.equal((await upd("status = 'revoked', revoked_at = now(), revoked_by = 999999, revocation_reason = 'x'")).code, '23503');
  assert.equal(await upd("status = 'revoked', revoked_at = now(), revoked_by = $1, revocation_reason = 'Issued in error'", [admin.id]), null);
  const row = (await db.pool.query('SELECT * FROM certificates WHERE id = $1', [cert.id])).rows[0];
  assert.equal(row.status, 'revoked');
  assert.equal(row.revoked_by, admin.id);
  assert.equal(row.revocation_reason, 'Issued in error');
  assert.equal(row.certificate_number, cert.certificate_number);
});

test('issued facts are immutable and a revoked certificate cannot be restored', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  const c = await createCourse(db.pool, { title: 'Immutable' });
  const cert = (await issue({ studentId: u.id, courseId: c.id, name: 'Original Name', title: 'Original Title' })).rows[0];
  const other = await createCourse(db.pool, { title: 'Elsewhere' });
  const attempts = [
    ["certificate_number = 'EDUYOG-2026-AAAAAAAAAA'", []],
    ['student_name = $1', ['Changed']],
    ['course_title = $1', ['Changed']],
    ["issued_at = now() - interval '1 year'", []],
    ['course_id = $1', [other.id]],
    ['student_id = $1', [admin.id]],
  ];
  for (const [set, params] of attempts) {
    const err = await violation(`UPDATE certificates SET ${set} WHERE id = ${cert.id}`, params);
    assert.equal(err && err.code, '23514', set);
  }
  const same = (await db.pool.query('SELECT * FROM certificates WHERE id = $1', [cert.id])).rows[0];
  assert.equal(same.student_name, 'Original Name');
  assert.equal(same.course_title, 'Original Title');
  await db.pool.query("UPDATE certificates SET status = 'revoked', revoked_at = now(), revoked_by = $1, revocation_reason = 'r' WHERE id = $2", [admin.id, cert.id]);
  for (const set of ["status = 'active', revoked_at = NULL, revoked_by = NULL, revocation_reason = NULL", "revocation_reason = 'edited'"]) {
    const err = await violation(`UPDATE certificates SET ${set} WHERE id = ${cert.id}`);
    assert.equal(err && err.code, '23514', set);
  }
});

test('the student and the course cannot be deleted away from a certificate', async () => {
  const u = await createUser(db.pool, { role: 'student' });
  const c = await createCourse(db.pool, { title: 'Protected' });
  await issue({ studentId: u.id, courseId: c.id });
  for (const [sql, id] of [['DELETE FROM users WHERE id = $1', u.id], ['DELETE FROM courses WHERE id = $1', c.id]]) {
    const err = await violation(sql, [id]);
    assert.ok(err && ['23001', '23503'].includes(err.code), sql);
  }
  assert.equal((await db.pool.query('SELECT 1 FROM certificates WHERE student_id = $1', [u.id])).rows.length, 1);
});

test('indexes exist', async () => {
  const { rows } = await db.pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'certificates'");
  const def = (n) => rows.find((r) => r.indexname === n)?.indexdef;
  assert.ok(def('certificates_number_key'));
  assert.ok(def('certificates_student_course_key'));
  assert.match(def('certificates_student_issued_idx'), /\(student_id, issued_at DESC, id DESC\)/);
  assert.match(def('certificates_course_issued_idx'), /\(course_id, issued_at DESC\)/);
});
