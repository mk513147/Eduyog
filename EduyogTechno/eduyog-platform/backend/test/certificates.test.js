const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client, createCourse, assign, enrol } = require('./helpers');

let db;
let api;
let call;
let admin;
let trainer;
let A;
let B;

const NUMBER = /^EDUYOG-\d{4}-[0-9A-F]{10}$/;
const adminCall = (method, path, body) => call(method, `/api/admin/eduyarp${path}`, { token: admin.token, body });
const meCall = (user, method, path, body) => call(method, `/api/eduyarp/me${path}`, { token: user.token, body });
const complete = (user, topicId) => call('POST', `/api/eduyarp/topics/${topicId}/complete`, { token: user.token });
const certsOf = async (user) => (await db.pool.query('SELECT * FROM certificates WHERE student_id = $1 ORDER BY id', [user.id])).rows;
const count = async () => (await db.pool.query('SELECT count(*)::int AS n FROM certificates')).rows[0].n;

// A new Student enrolled (through the API) in `course`.
async function newStudent(course, fullName) {
  const s = await createUser(db.pool, { fullName });
  const res = await call('POST', `/api/eduyarp/courses/${course.id}/enrol`, { token: s.token });
  assert.equal(res.status, 201);
  return s;
}
async function finish(student, course) {
  let last;
  for (const id of course.topicIds) last = await complete(student, id);
  return last;
}

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin' });
  trainer = await createUser(db.pool, { role: 'trainer' });
  A = await createCourse(db.pool, { title: 'Data Science Fundamentals', topicCount: 3 });
  B = await createCourse(db.pool, { title: 'Prompt Engineering', topicCount: 2 });
  await assign(db.pool, A.id, trainer.id);
});

after(async () => {
  await api.stop();
  await db.drop();
});

// ------------------------------------------------------------ generation

test('enrolling or partial progress issues nothing; finishing the last topic issues exactly one', async () => {
  const s = await newStudent(A, 'Priya Sharma');
  assert.equal(await count(), 0, 'enrolment alone');
  const first = await complete(s, A.topicIds[0]);
  assert.equal(first.body.certificate, null);
  await complete(s, A.topicIds[1]);
  assert.equal((await certsOf(s)).length, 0, 'incomplete course');
  const last = await complete(s, A.topicIds[2]);
  assert.equal(last.status, 200);
  assert.equal(last.body.enrolmentStatus, 'completed');
  assert.match(last.body.certificate.certificateNumber, NUMBER);
  const rows = await certsOf(s);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'active');
  assert.equal(rows[0].student_name, 'Priya Sharma');
  assert.equal(rows[0].course_title, 'Data Science Fundamentals');
  assert.equal(rows[0].course_id, A.id);
  assert.ok(rows[0].issued_at);
  const course = await meCall(s, 'GET', `/courses/${A.id}`);
  assert.equal(course.body.course.certificate.certificateNumber, rows[0].certificate_number);
});

test('completing again is idempotent: the same certificate, never a second', async () => {
  const s = await newStudent(B, 'Repeat Student');
  await finish(s, B);
  const before = (await certsOf(s))[0];
  for (let i = 0; i < 3; i++) {
    const again = await complete(s, B.topicIds[1]);
    assert.equal(again.status, 200);
    assert.equal(again.body.certificate.certificateNumber, before.certificate_number);
  }
  const rows = await certsOf(s);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].certificate_number, before.certificate_number);
  assert.equal(rows[0].issued_at.getTime(), before.issued_at.getTime());
});

test('concurrent completion of the last topic creates one certificate', async () => {
  const s = await newStudent(A, 'Racer');
  await complete(s, A.topicIds[0]);
  await complete(s, A.topicIds[1]);
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => complete(s, A.topicIds[2])));
  assert.ok(results.every((r) => r.status === 200));
  assert.equal((await certsOf(s)).length, 1);
  const numbers = new Set(results.map((r) => r.body.certificate?.certificateNumber));
  assert.equal(numbers.size, 1);
});

test('different students and courses get different, well-formed numbers', async () => {
  const a = await newStudent(B, 'Num One');
  const b = await newStudent(B, 'Num Two');
  await finish(a, B);
  await finish(b, B);
  const numbers = [...(await certsOf(a)), ...(await certsOf(b))].map((c) => c.certificate_number);
  assert.equal(new Set(numbers).size, 2);
  for (const n of numbers) assert.match(n, NUMBER);
  const all = (await db.pool.query('SELECT certificate_number FROM certificates')).rows.map((r) => r.certificate_number);
  assert.equal(new Set(all).size, all.length);
});

test('a course with no topics, or an unpublished course, never produces a certificate', async () => {
  const empty = await createCourse(db.pool, { title: 'Empty', topicCount: 0 });
  const s = await newStudent(empty, 'Nothing To Do');
  assert.equal((await certsOf(s)).length, 0);
  const draft = await createCourse(db.pool, { title: 'Draft one', status: 'draft', topicCount: 1 });
  const d = await createUser(db.pool, { fullName: 'Drafty' });
  assert.equal((await call('POST', `/api/eduyarp/courses/${draft.id}/enrol`, { token: d.token })).status, 404);
  assert.equal((await complete(d, draft.topicIds[0])).status, 404);
  assert.equal((await certsOf(d)).length, 0);
});

test('a non-student, or a student not enrolled, cannot complete topics into a certificate', async () => {
  const outsider = await createUser(db.pool, { fullName: 'Outsider' });
  assert.equal((await complete(outsider, A.topicIds[0])).status, 404);
  assert.equal((await call('POST', `/api/eduyarp/topics/${A.topicIds[0]}/complete`, { token: trainer.token })).status, 403);
  assert.equal((await certsOf(outsider)).length, 0);
});

test('finishing the course after a cancelled enrolment: re-enrolling issues one certificate, and again never a second', async () => {
  const s = await newStudent(B, 'Comes Back');
  await complete(s, B.topicIds[0]);
  assert.equal((await adminCall('PATCH', `/enrolments/${(await db.pool.query('SELECT id FROM enrolments WHERE student_id = $1', [s.id])).rows[0].id}`, { status: 'cancelled' })).status, 200);
  assert.equal((await certsOf(s)).length, 0, 'cancellation alone creates nothing');
  // progress is kept; the other topic is finished directly in the database while cancelled
  await db.pool.query('INSERT INTO topic_progress (student_id, topic_id, completed, completed_at) VALUES ($1, $2, TRUE, now())', [s.id, B.topicIds[1]]);
  assert.equal((await certsOf(s)).length, 0, 'cancelled enrolments never earn one');
  const re = await call('POST', `/api/eduyarp/courses/${B.id}/enrol`, { token: s.token });
  assert.equal(re.status, 201);
  assert.equal(re.body.enrolment.status, 'completed');
  assert.equal((await certsOf(s)).length, 1, 'completion reached by re-enrolling issues it');
  // cancel and re-enrol once more: still one
  await db.pool.query("UPDATE enrolments SET status = 'cancelled' WHERE student_id = $1", [s.id]);
  assert.equal((await call('POST', `/api/eduyarp/courses/${B.id}/enrol`, { token: s.token })).status, 201);
  assert.equal((await certsOf(s)).length, 1);
});

test('a certificate survives cancellation attempts, curriculum changes and re-opening of the course', async () => {
  const C = await createCourse(db.pool, { title: 'Evolving', topicCount: 2 });
  const s = await newStudent(C, 'Keeps It');
  await finish(s, C);
  const cert = (await certsOf(s))[0];
  const enrolmentId = (await db.pool.query('SELECT id FROM enrolments WHERE student_id = $1 AND course_id = $2', [s.id, C.id])).rows[0].id;
  assert.equal((await adminCall('PATCH', `/enrolments/${enrolmentId}`, { status: 'cancelled' })).status, 409, 'completed enrolments cannot be cancelled');
  // a new topic reopens the enrolment; the certificate stays and is not duplicated on completion
  const added = await adminCall('POST', `/courses/${C.id}/modules`, { title: 'Extra module' });
  const topic = await adminCall('POST', `/modules/${added.body.module.id}/topics`, { title: 'Extra topic' });
  assert.equal((await meCall(s, 'GET', `/courses/${C.id}`)).body.course.enrolment.status, 'active');
  assert.equal((await certsOf(s)).length, 1);
  assert.equal((await complete(s, topic.body.topic.id)).body.enrolmentStatus, 'completed');
  const after = await certsOf(s);
  assert.equal(after.length, 1);
  assert.equal(after[0].certificate_number, cert.certificate_number);
  assert.equal(after[0].id, cert.id);
});

test('removing the last unfinished topic completes the course and issues the certificate (existing completion rule)', async () => {
  const C = await createCourse(db.pool, { title: 'Shrinking', topicCount: 2 });
  const s = await newStudent(C, 'Almost There');
  await complete(s, C.topicIds[0]);
  assert.equal((await certsOf(s)).length, 0);
  assert.equal((await adminCall('DELETE', `/topics/${C.topicIds[1]}`)).status, 204);
  assert.equal((await certsOf(s)).length, 1);
  assert.equal((await meCall(s, 'GET', `/courses/${C.id}`)).body.course.enrolment.status, 'completed');
});

test('already-completed enrolments from before certificates are not given one by unrelated edits', async () => {
  const C = await createCourse(db.pool, { title: 'Legacy', topicCount: 1 });
  const s = await createUser(db.pool, { fullName: 'Legacy Student' });
  await enrol(db.pool, s.id, C.id, 'completed');
  await db.pool.query('INSERT INTO topic_progress (student_id, topic_id, completed, completed_at) VALUES ($1, $2, TRUE, now())', [s.id, C.topicIds[0]]);
  await adminCall('PATCH', `/courses/${C.id}`, { description: 'edited' });
  await adminCall('POST', `/courses/${C.id}/modules`, { title: 'Empty module, no new topics' });
  assert.equal((await certsOf(s)).length, 0, 'no silent back-fill');
});

// ------------------------------------------------------------ snapshots

test('snapshots: renaming the student or the course, or changing other details, never changes an issued certificate', async () => {
  const C = await createCourse(db.pool, { title: 'Original Title', topicCount: 1 });
  const s = await newStudent(C, 'Original Name');
  await finish(s, C);
  const before = (await certsOf(s))[0];
  const view = () => meCall(s, 'GET', `/certificates/${before.id}`);
  assert.equal((await view()).body.certificate.courseTitle, 'Original Title');

  assert.equal((await call('PATCH', '/api/me/profile', { token: s.token, body: { fullName: 'New Name', phone: '+91 90000 11111', institution: 'New Uni', bio: 'changed' } })).status, 200);
  assert.equal((await adminCall('PATCH', `/courses/${C.id}`, { title: 'Advanced Renamed', description: 'new', fee: 999, status: 'archived', level: 'advanced' })).status, 200);
  await adminCall('POST', `/courses/${C.id}/resources`, { title: 'r', resourceType: 'pdf', url: 'https://example.com/r' });
  await adminCall('POST', `/courses/${C.id}/assignments`, { title: 'a', instructions: 'i' });

  const shown = (await view()).body.certificate;
  assert.equal(shown.studentName, 'Original Name');
  assert.equal(shown.courseTitle, 'Original Title');
  assert.equal(shown.certificateNumber, before.certificate_number);
  const row = (await certsOf(s))[0];
  assert.equal(row.student_name, 'Original Name');
  assert.equal(row.course_title, 'Original Title');
  assert.equal(row.status, 'active', 'course changes never revoke');
  // a later certificate for the renamed student uses the current name
  const D = await createCourse(db.pool, { title: 'Second Course', topicCount: 1 });
  assert.equal((await call('POST', `/api/eduyarp/courses/${D.id}/enrol`, { token: s.token })).status, 201);
  await finish(s, D);
  const second = (await certsOf(s)).find((c) => c.course_id === D.id);
  assert.equal(second.student_name, 'New Name');
});

test('the display name used is users.full_name at the moment of completion', async () => {
  const C = await createCourse(db.pool, { title: 'Name Check', topicCount: 1 });
  const s = await newStudent(C, 'Before Rename');
  await call('PATCH', '/api/me/profile', { token: s.token, body: { fullName: 'After Rename' } });
  await finish(s, C);
  assert.equal((await certsOf(s))[0].student_name, 'After Rename');
});

// ------------------------------------------------------------ student access

test('Student: lists and views only their own certificates; others look like "not found"', async () => {
  const C = await createCourse(db.pool, { title: 'Privacy', topicCount: 1 });
  const s1 = await newStudent(C, 'Student One');
  const s2 = await newStudent(C, 'Student Two');
  await finish(s1, C);
  await finish(s2, C);
  const mine = await meCall(s1, 'GET', '/certificates');
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.certificates.map((c) => c.studentName), ['Student One']);
  assert.deepEqual(Object.keys(mine.body.certificates[0]).sort(), ['certificateNumber', 'courseTitle', 'id', 'issuedAt', 'revokedAt', 'status', 'studentName']);
  const own = await meCall(s1, 'GET', `/certificates/${mine.body.certificates[0].id}`);
  assert.equal(own.status, 200);
  assert.equal(own.body.certificate.courseTitle, 'Privacy');
  const theirs = (await certsOf(s2))[0];
  assert.equal((await meCall(s1, 'GET', `/certificates/${theirs.id}`)).status, 404);
  assert.ok(!mine.text.includes(theirs.certificate_number));
  assert.equal((await meCall(s1, 'GET', '/certificates/999999')).status, 404);
  assert.equal((await meCall(s1, 'GET', '/certificates/abc')).status, 400);
  assert.equal((await call('GET', '/api/eduyarp/me/certificates')).status, 401);
  assert.deepEqual((await meCall(await createUser(db.pool, {}), 'GET', '/certificates')).body.certificates, []);
});

test('Student cannot revoke, create or modify certificates (no such routes)', async () => {
  const C = await createCourse(db.pool, { title: 'No Tamper', topicCount: 1 });
  const s = await newStudent(C, 'Tamperer');
  await finish(s, C);
  const cert = (await certsOf(s))[0];
  assert.equal((await call('POST', `/api/admin/eduyarp/certificates/${cert.id}/revoke`, { token: s.token, body: { reason: 'self' } })).status, 403);
  assert.equal((await call('GET', '/api/admin/eduyarp/certificates', { token: s.token })).status, 403);
  for (const m of ['PATCH', 'PUT', 'DELETE', 'POST']) {
    const res = await meCall(s, m, `/certificates/${cert.id}`, { studentName: 'Hacked', certificateNumber: 'EDUYOG-2026-AAAAAAAAAA', courseTitle: 'x' });
    assert.equal(res.status, 404, m);
  }
  assert.equal((await meCall(s, 'POST', '/certificates', { studentId: s.id, courseId: C.id, certificateNumber: 'EDUYOG-2026-BBBBBBBBBB' })).status, 404);
  const row = (await certsOf(s))[0];
  assert.equal(row.student_name, 'Tamperer');
  assert.equal(row.certificate_number, cert.certificate_number);
  assert.equal(row.status, 'active');
});

test('Trainer has no certificate management or access to other students certificates', async () => {
  const C = await createCourse(db.pool, { title: 'Trainer View', topicCount: 1 });
  await assign(db.pool, C.id, trainer.id);
  const s = await newStudent(C, 'Seen By Trainer');
  await finish(s, C);
  const cert = (await certsOf(s))[0];
  assert.equal((await call('POST', `/api/admin/eduyarp/certificates/${cert.id}/revoke`, { token: trainer.token, body: { reason: 'nope' } })).status, 403);
  assert.equal((await call('GET', '/api/admin/eduyarp/certificates', { token: trainer.token })).status, 403);
  assert.equal((await call('GET', `/api/admin/eduyarp/certificates/${cert.id}`, { token: trainer.token })).status, 403);
  assert.equal((await meCall(trainer, 'GET', '/certificates')).status, 403);
  assert.equal((await meCall(trainer, 'GET', `/certificates/${cert.id}`)).status, 403);
  assert.equal((await call('PATCH', `/api/eduyarp/trainer/certificates/${cert.id}`, { token: trainer.token, body: { studentName: 'x' } })).status, 404);
  assert.equal((await certsOf(s))[0].status, 'active');
});

test('a former Student made Trainer keeps their certificates but cannot use student endpoints', async () => {
  const C = await createCourse(db.pool, { title: 'Promoted', topicCount: 1 });
  const s = await newStudent(C, 'Soon Trainer');
  await finish(s, C);
  assert.equal((await call('PATCH', `/api/admin/users/${s.id}/role`, { token: admin.token, body: { role: 'trainer' } })).status, 200);
  assert.equal((await certsOf(s)).length, 1, 'role change keeps the certificate');
  assert.equal((await certsOf(s))[0].status, 'active');
  assert.equal((await meCall(s, 'GET', '/certificates')).status, 403);
  assert.equal((await adminCall('GET', `/certificates?studentId=${s.id}`)).body.certificates.length, 1);
});

// ------------------------------------------------------------ admin

test('Admin: list with filters, view details, and see everything', async () => {
  const C = await createCourse(db.pool, { title: 'Admin List', topicCount: 1 });
  const s = await newStudent(C, 'Listed Student');
  await finish(s, C);
  const all = await adminCall('GET', '/certificates');
  assert.equal(all.status, 200);
  assert.ok(all.body.certificates.length >= 3);
  const row = all.body.certificates.find((c) => c.studentName === 'Listed Student');
  assert.equal(row.studentEmail, s.email);
  assert.equal(row.courseId, C.id);
  assert.equal(row.revocationReason, null);
  assert.deepEqual((await adminCall('GET', `/certificates?courseId=${C.id}`)).body.certificates.map((c) => c.studentName), ['Listed Student']);
  assert.deepEqual((await adminCall('GET', `/certificates?studentId=${s.id}&status=active`)).body.certificates.length, 1);
  assert.deepEqual((await adminCall('GET', `/certificates?courseId=${C.id}&status=revoked`)).body.certificates, []);
  for (const bad of ['courseId=abc', 'studentId=-1', 'status=pending']) assert.equal((await adminCall('GET', `/certificates?${bad}`)).status, 400, bad);
  const one = await adminCall('GET', `/certificates/${row.id}`);
  assert.equal(one.body.certificate.certificateNumber, row.certificateNumber);
  assert.equal((await adminCall('GET', '/certificates/999999')).status, 404);
  assert.equal((await adminCall('GET', '/certificates/abc')).status, 400);
  assert.equal((await call('GET', '/api/admin/eduyarp/certificates')).status, 401);
});

test('Admin revokes: reason required, who/when/why recorded, certificate kept, number unchanged, cannot be restored', async () => {
  const C = await createCourse(db.pool, { title: 'Revocable', topicCount: 1 });
  const s = await newStudent(C, 'To Revoke');
  await finish(s, C);
  const cert = (await certsOf(s))[0];
  const url = `/certificates/${cert.id}/revoke`;
  for (const bad of [{}, { reason: '' }, { reason: '   ' }, { reason: 5 }, { reason: 'x'.repeat(501) }]) {
    assert.equal((await adminCall('POST', url, bad)).status, 400, JSON.stringify(bad).slice(0, 40));
  }
  assert.equal((await certsOf(s))[0].status, 'active');
  assert.equal((await adminCall('POST', '/certificates/999999/revoke', { reason: 'x' })).status, 404);
  const done = await adminCall('POST', url, { reason: '  Issued in error  ', certificateNumber: 'EDUYOG-2026-ZZZZZZZZZZ', studentName: 'Hacked' });
  assert.equal(done.status, 200);
  assert.equal(done.body.certificate.status, 'revoked');
  assert.equal(done.body.certificate.revocationReason, 'Issued in error');
  assert.equal(done.body.certificate.revokedByName.length > 0, true);
  assert.ok(done.body.certificate.revokedAt);
  const row = (await certsOf(s))[0];
  assert.equal(row.status, 'revoked');
  assert.equal(row.revoked_by, admin.id);
  assert.equal(row.revocation_reason, 'Issued in error');
  assert.ok(Math.abs(Date.now() - row.revoked_at.getTime()) < 60000);
  assert.equal(row.certificate_number, cert.certificate_number, 'number unchanged');
  assert.equal(row.student_name, 'To Revoke', 'client-sent snapshot ignored');
  assert.equal((await adminCall('POST', url, { reason: 'again' })).status, 409, 'cannot revoke twice');
  assert.equal(row.revoked_at.getTime(), (await certsOf(s))[0].revoked_at.getTime());
  // no way back
  for (const m of ['PATCH', 'PUT', 'DELETE']) assert.equal((await adminCall(m, `/certificates/${cert.id}`, { status: 'active' })).status, 404, m);
  assert.equal((await adminCall('POST', `/certificates/${cert.id}/restore`, {})).status, 404);
  assert.equal((await certsOf(s))[0].status, 'revoked');
});

test('a revoked certificate stays in every list, is visible to the student marked revoked, and is not re-issued', async () => {
  const C = await createCourse(db.pool, { title: 'Stays Listed', topicCount: 1 });
  const s = await newStudent(C, 'Revoked But Kept');
  await finish(s, C);
  const cert = (await certsOf(s))[0];
  await adminCall('POST', `/certificates/${cert.id}/revoke`, { reason: 'Confidential reason' });
  const list = await meCall(s, 'GET', '/certificates');
  assert.equal(list.body.certificates.length, 1);
  assert.equal(list.body.certificates[0].status, 'revoked');
  assert.ok(list.body.certificates[0].revokedAt);
  const one = await meCall(s, 'GET', `/certificates/${cert.id}`);
  assert.equal(one.status, 200, 'history stays accessible');
  assert.equal(one.body.certificate.certificateNumber, cert.certificate_number);
  assert.ok(!one.text.includes('Confidential reason') && !list.text.includes('Confidential reason'), 'reason is Admin only');
  assert.equal((await adminCall('GET', `/certificates?status=revoked&studentId=${s.id}`)).body.certificates.length, 1);
  assert.equal((await adminCall('GET', `/certificates/${cert.id}`)).body.certificate.revocationReason, 'Confidential reason');
  await complete(s, C.topicIds[0]);
  assert.equal((await certsOf(s)).length, 1, 'completing again does not issue a replacement');
  assert.equal((await certsOf(s))[0].status, 'revoked');
});

test('certificate numbers are not derived from ids and cannot be supplied or changed through the database layer', async () => {
  const rows = (await db.pool.query('SELECT id, certificate_number FROM certificates')).rows;
  assert.ok(rows.length > 5);
  for (const r of rows) {
    assert.match(r.certificate_number, NUMBER);
    assert.ok(!r.certificate_number.endsWith(String(r.id).padStart(10, '0')));
  }
  const err = await db.pool.query("UPDATE certificates SET certificate_number = 'EDUYOG-2026-0000000000' WHERE id = $1", [rows[0].id]).catch((e) => e);
  assert.equal(err.code, '23514');
});
