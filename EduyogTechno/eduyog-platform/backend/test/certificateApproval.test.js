// Admin-approved certificates: completion creates a pending request, only approval creates the
// certificate, rejection is history (and can be followed by a new request), and existing
// certificates and legacy completions are untouched.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client, createCourse, enrol } = require('./helpers');

let db;
let api;
let call;
let admin;
let trainer;

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin' });
  trainer = await createUser(db.pool, { role: 'trainer' });
});

after(async () => {
  await api.stop();
  await db.drop();
});

const adminCall = (method, path, body) => call(method, `/api/admin/eduyarp${path}`, { token: admin.token, body });
const meCall = (user, method, path, body) => call(method, `/api/eduyarp/me${path}`, { token: user.token, body });
const complete = (user, topicId) => call('POST', `/api/eduyarp/topics/${topicId}/complete`, { token: user.token });
const certs = async (user) => (await db.pool.query('SELECT * FROM certificates WHERE student_id = $1 ORDER BY id', [user.id])).rows;
const requests = async (user) => (await db.pool.query('SELECT * FROM certificate_requests WHERE student_id = $1 ORDER BY id', [user.id])).rows;

// A student who has finished a fresh one-topic course (so a pending request exists).
async function completed(title, name) {
  const course = await createCourse(db.pool, { title, topicCount: 1 });
  const student = await createUser(db.pool, { fullName: name });
  assert.equal((await adminCall('POST', '/enrolments', { studentId: student.id, courseId: course.id })).status, 201);
  assert.equal((await complete(student, course.topicIds[0])).status, 200);
  const [request] = await requests(student);
  return { course, student, request };
}

test('completion creates a pending request and no certificate; the student sees only the pending state', async () => {
  const { course, student, request } = await completed('Approval A', 'Pending Pat');
  assert.equal(request.status, 'pending');
  assert.equal((await certs(student)).length, 0);
  const mine = await meCall(student, 'GET', '/certificates');
  assert.deepEqual(mine.body.certificates, []);
  const reqs = await meCall(student, 'GET', '/certificate-requests');
  assert.equal(reqs.body.requests.length, 1);
  assert.equal(reqs.body.requests[0].status, 'pending');
  assert.equal(reqs.body.requests[0].certificateId, null);
  const page = await meCall(student, 'GET', `/courses/${course.id}`);
  assert.equal(page.body.course.certificate, null);
  assert.equal(page.body.course.certificateRequest.status, 'pending');
});

test('only an Admin lists and decides requests; the student, a trainer and anonymous cannot', async () => {
  const { student, request } = await completed('Approval B', 'Guarded Gail');
  for (const [token, expected] of [[student.token, 403], [trainer.token, 403], [undefined, 401]]) {
    assert.equal((await call('GET', '/api/admin/eduyarp/certificate-requests', { token })).status, expected);
    assert.equal((await call('POST', `/api/admin/eduyarp/certificate-requests/${request.id}/approve`, { token })).status, expected);
    assert.equal((await call('POST', `/api/admin/eduyarp/certificate-requests/${request.id}/reject`, { token, body: { reason: 'x' } })).status, expected);
  }
  assert.equal((await certs(student)).length, 0);
  assert.equal((await requests(student))[0].status, 'pending');
  const list = await adminCall('GET', '/certificate-requests?status=pending');
  const row = list.body.requests.find((r) => r.id === request.id);
  assert.equal(row.studentEmail, student.email);
  assert.equal(row.courseTitle, 'Approval B');
  assert.equal((await adminCall('GET', '/certificate-requests?status=bogus')).status, 400);
});

test('approval creates exactly one certificate from the snapshot at approval and links it', async () => {
  const { course, student, request } = await completed('Approval C', 'Approved Alex');
  const res = await adminCall('POST', `/certificate-requests/${request.id}/approve`, { studentId: 1, certificateNumber: 'EDUYOG-2026-FAKEFAKE00' });
  assert.equal(res.status, 200);
  assert.equal(res.body.request.status, 'approved');
  const rows = await certs(student);
  assert.equal(rows.length, 1);
  assert.match(rows[0].certificate_number, /^EDUYOG-\d{4}-[0-9A-F]{10}$/);
  assert.notEqual(rows[0].certificate_number, 'EDUYOG-2026-FAKEFAKE00', 'numbers are never taken from the client');
  assert.equal(rows[0].student_name, 'Approved Alex');
  assert.equal(rows[0].course_title, 'Approval C');
  const stored = (await requests(student))[0];
  assert.equal(stored.certificate_id, rows[0].id);
  assert.equal(stored.decided_by, admin.id);
  const mine = await meCall(student, 'GET', '/certificates');
  assert.equal(mine.body.certificates.length, 1);
  assert.equal((await meCall(student, 'GET', `/courses/${course.id}`)).body.course.certificate.certificateNumber, rows[0].certificate_number);
  // visible to the Admin's existing certificate screens too
  assert.equal((await adminCall('GET', `/certificates?studentId=${student.id}`)).body.certificates.length, 1);
});

test('approving or rejecting twice is refused; concurrent approvals issue one certificate', async () => {
  const { student, request } = await completed('Approval D', 'Racing Rory');
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => adminCall('POST', `/certificate-requests/${request.id}/approve`)));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 4);
  assert.equal((await certs(student)).length, 1);
  assert.equal((await adminCall('POST', `/certificate-requests/${request.id}/approve`)).status, 409);
  assert.equal((await adminCall('POST', `/certificate-requests/${request.id}/reject`, { reason: 'late' })).status, 409);
  assert.equal((await requests(student))[0].status, 'approved');
  // a racing approve and reject: exactly one wins
  const other = await completed('Approval D2', 'Racing Ray');
  const mixed = await Promise.all([
    adminCall('POST', `/certificate-requests/${other.request.id}/approve`),
    adminCall('POST', `/certificate-requests/${other.request.id}/reject`, { reason: 'no' }),
  ]);
  assert.equal(mixed.filter((r) => r.status === 200).length, 1);
  const [final] = await requests(other.student);
  assert.equal((await certs(other.student)).length, final.status === 'approved' ? 1 : 0);
});

test('rejection needs a reason, keeps history, exposes no certificate, and shows the reason to the student', async () => {
  const { course, student, request } = await completed('Approval E', 'Rejected Ria');
  const url = `/certificate-requests/${request.id}/reject`;
  for (const bad of [{}, { reason: '' }, { reason: '   ' }, { reason: 4 }, { reason: 'x'.repeat(501) }]) {
    assert.equal((await adminCall('POST', url, bad)).status, 400, JSON.stringify(bad).slice(0, 40));
  }
  assert.equal((await adminCall('POST', '/certificate-requests/999999/reject', { reason: 'x' })).status, 404);
  assert.equal((await adminCall('POST', '/certificate-requests/abc/approve')).status, 400);
  const res = await adminCall('POST', url, { reason: '  Assignment missing  ' });
  assert.equal(res.status, 200);
  assert.equal(res.body.request.status, 'rejected');
  assert.equal((await certs(student)).length, 0);
  const view = await meCall(student, 'GET', `/courses/${course.id}`);
  assert.equal(view.body.course.certificate, null);
  assert.equal(view.body.course.certificateRequest.status, 'rejected');
  assert.equal(view.body.course.certificateRequest.decisionReason, 'Assignment missing');
  assert.doesNotMatch(JSON.stringify(view.body.course.certificateRequest), /decidedBy|admin/i, 'who decided is Admin-only');
  assert.equal((await meCall(student, 'GET', '/certificates')).body.certificates.length, 0);
});

test('after a rejection the student can ask again; one pending at a time; history is kept', async () => {
  const { course, student, request } = await completed('Approval F', 'Again Abe');
  await adminCall('POST', `/certificate-requests/${request.id}/reject`, { reason: 'First try' });
  const again = await meCall(student, 'POST', `/courses/${course.id}/certificate-request`);
  assert.equal(again.status, 201);
  assert.equal(again.body.request.status, 'pending');
  const repeat = await meCall(student, 'POST', `/courses/${course.id}/certificate-request`);
  assert.equal(repeat.status, 200, 'repeating returns the pending request');
  assert.equal(repeat.body.request.id, again.body.request.id);
  const rows = await requests(student);
  assert.deepEqual(rows.map((r) => r.status), ['rejected', 'pending']);
  assert.equal(rows[0].decision_reason, 'First try', 'the earlier decision is preserved');
  assert.equal((await adminCall('POST', `/certificate-requests/${again.body.request.id}/approve`)).status, 200);
  assert.equal((await certs(student)).length, 1);
  assert.deepEqual((await requests(student)).map((r) => r.status), ['rejected', 'approved']);
  // once issued, no further request is possible
  assert.equal((await meCall(student, 'POST', `/courses/${course.id}/certificate-request`)).status, 409);
});

test('requests need a completed course and use only the signed-in student', async () => {
  const course = await createCourse(db.pool, { title: 'Approval G', topicCount: 2 });
  const student = await createUser(db.pool);
  await adminCall('POST', '/enrolments', { studentId: student.id, courseId: course.id });
  await complete(student, course.topicIds[0]);
  assert.equal((await meCall(student, 'POST', `/courses/${course.id}/certificate-request`)).status, 409, 'not complete yet');
  const other = await completed('Approval G2', 'Someone Else');
  // another student's course id: no completed enrolment for the caller, and the body cannot name a student
  const res = await meCall(student, 'POST', `/courses/${other.course.id}/certificate-request`, { studentId: other.student.id });
  assert.equal(res.status, 409);
  assert.equal((await requests(student)).length, 0);
  assert.equal((await meCall(student, 'POST', '/courses/abc/certificate-request')).status, 400);
  assert.equal((await call('POST', `/api/eduyarp/me/courses/${course.id}/certificate-request`)).status, 401);
});

test('approval is refused when the student no longer has a completed course, or a certificate already exists', async () => {
  const gone = await completed('Approval H', 'Reopened Rae');
  await db.pool.query("UPDATE enrolments SET status = 'cancelled' WHERE student_id = $1", [gone.student.id]);
  const refused = await adminCall('POST', `/certificate-requests/${gone.request.id}/approve`);
  assert.equal(refused.status, 409);
  assert.equal((await certs(gone.student)).length, 0);
  assert.equal((await requests(gone.student))[0].status, 'pending', 'the Admin can still reject it');
  assert.equal((await adminCall('POST', `/certificate-requests/${gone.request.id}/reject`, { reason: 'Access revoked' })).status, 200);

  const dup = await completed('Approval I', 'Already Has');
  await db.pool.query('INSERT INTO certificates (student_id, course_id, student_name, course_title) VALUES ($1, $2, $3, $4)', [dup.student.id, dup.course.id, 'Already Has', 'Approval I']);
  assert.equal((await adminCall('POST', `/certificate-requests/${dup.request.id}/approve`)).status, 409);
  assert.equal((await certs(dup.student)).length, 1, 'still exactly one');
});

test('legacy: existing certificates stay as they are, legacy completions get nothing until the student asks', async () => {
  const course = await createCourse(db.pool, { title: 'Legacy cert', topicCount: 1 });
  const holder = await createUser(db.pool, { fullName: 'Holder' });
  await enrol(db.pool, holder.id, course.id, 'completed');
  await db.pool.query('INSERT INTO certificates (student_id, course_id, student_name, course_title) VALUES ($1, $2, $3, $4)', [holder.id, course.id, 'Holder', 'Legacy cert']);
  const before = (await certs(holder))[0];
  // touching the course and re-evaluating completion does not request, reissue or revoke anything
  await adminCall('PATCH', `/courses/${course.id}`, { description: 'edit' });
  await adminCall('POST', `/courses/${course.id}/modules`, { title: 'Empty module' });
  assert.equal((await requests(holder)).length, 0);
  const after = await certs(holder);
  assert.equal(after.length, 1);
  assert.equal(after[0].certificate_number, before.certificate_number);
  assert.equal(after[0].status, 'active');
  assert.equal((await meCall(holder, 'GET', '/certificates')).body.certificates.length, 1, 'still listed and viewable');
  assert.equal((await meCall(holder, 'POST', `/courses/${course.id}/certificate-request`)).status, 409, 'already issued');
  // revocation by an Admin keeps working
  assert.equal((await adminCall('POST', `/certificates/${before.id}/revoke`, { reason: 'Test' })).status, 200);
  assert.equal((await certs(holder))[0].status, 'revoked');
});

test('decided requests cannot be altered, and a pending request cannot be duplicated (database level)', async () => {
  const { student, request } = await completed('Approval J', 'Locked Lou');
  const dupe = await db.pool.query('INSERT INTO certificate_requests (student_id, course_id) VALUES ($1, $2)', [student.id, request.course_id]).catch((e) => e);
  assert.equal(dupe.code, '23505');
  await adminCall('POST', `/certificate-requests/${request.id}/reject`, { reason: 'Final for this one' });
  const edit = await db.pool.query("UPDATE certificate_requests SET status = 'pending', decided_at = NULL, decided_by = NULL, decision_reason = NULL WHERE id = $1", [request.id]).catch((e) => e);
  assert.equal(edit.code, '23514');
  const reassign = await db.pool.query('UPDATE certificate_requests SET student_id = $2 WHERE id = $1', [request.id, trainer.id]).catch((e) => e);
  assert.equal(reassign.code, '23514');
});
