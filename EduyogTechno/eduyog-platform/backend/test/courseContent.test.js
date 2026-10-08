const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client, createCourse, assign, enrol } = require('./helpers');

let db;
let api;
let call;
let admin;
let t1; // assigned to A
let t2; // assigned to B
let sActive;
let sCompleted;
let sCancelled;
let sOther; // enrolled in B only
let sNone;
let former; // Student with a completed enrolment in A who is now a Trainer (not assigned)
let A;
let B;

const adminCall = (method, path, body) => call(method, `/api/admin/eduyarp${path}`, { token: admin.token, body });
const trainerCall = (user, method, path, body) => call(method, `/api/eduyarp/trainer${path}`, { token: user.token, body });
const studentCall = (user, courseId, what) => call('GET', `/api/eduyarp/me/courses/${courseId}/${what}`, { token: user.token });

const goodResource = (extra = {}) => ({ title: 'Slides', resourceType: 'presentation', url: 'https://example.com/slides', ...extra });

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin' });
  t1 = await createUser(db.pool, { role: 'trainer', fullName: 'Trainer One' });
  t2 = await createUser(db.pool, { role: 'trainer', fullName: 'Trainer Two' });
  sActive = await createUser(db.pool, { fullName: 'Active' });
  sCompleted = await createUser(db.pool, { fullName: 'Completed' });
  sCancelled = await createUser(db.pool, { fullName: 'Cancelled' });
  sOther = await createUser(db.pool, { fullName: 'Other' });
  sNone = await createUser(db.pool, { fullName: 'None' });
  former = await createUser(db.pool, { fullName: 'Former' });
  A = await createCourse(db.pool, { title: 'Course A', topicCount: 3 });
  B = await createCourse(db.pool, { title: 'Course B', topicCount: 2 });
  await assign(db.pool, A.id, t1.id);
  await assign(db.pool, B.id, t2.id);
  await enrol(db.pool, sActive.id, A.id, 'active');
  await enrol(db.pool, sCompleted.id, A.id, 'completed');
  await enrol(db.pool, sCancelled.id, A.id, 'cancelled');
  await enrol(db.pool, sOther.id, B.id, 'active');
  await enrol(db.pool, former.id, A.id, 'completed');
  await db.pool.query("UPDATE users SET role = 'trainer' WHERE id = $1", [former.id]);
});

after(async () => {
  await api.stop();
  await db.drop();
});

const clear = async () => {
  await db.pool.query('DELETE FROM course_faqs');
  await db.pool.query('DELETE FROM course_resources');
};

// ---------------------------------------------------------------- FAQs

test('FAQ admin CRUD: create (auto order), list order, update, delete', async () => {
  await clear();
  const f1 = await adminCall('POST', `/courses/${A.id}/faqs`, { question: '  First?  ', answer: ' Yes. ' });
  assert.equal(f1.status, 201);
  assert.equal(f1.body.faq.question, 'First?');
  assert.equal(f1.body.faq.answer, 'Yes.');
  assert.equal(f1.body.faq.displayOrder, 1);
  const f2 = await adminCall('POST', `/courses/${A.id}/faqs`, { question: 'Second?', answer: 'Sure.' });
  assert.equal(f2.body.faq.displayOrder, 2);
  const f0 = await adminCall('POST', `/courses/${A.id}/faqs`, { question: 'Zero?', answer: 'Early.', displayOrder: 0 });
  assert.equal(f0.status, 201);
  const list = await adminCall('GET', `/courses/${A.id}/faqs`);
  assert.deepEqual(list.body.faqs.map((f) => f.question), ['Zero?', 'First?', 'Second?']);
  const upd = await adminCall('PATCH', `/faqs/${f2.body.faq.id}`, { answer: 'Changed.' });
  assert.equal(upd.body.faq.answer, 'Changed.');
  assert.equal(upd.body.faq.question, 'Second?');
  assert.equal((await adminCall('DELETE', `/faqs/${f2.body.faq.id}`)).status, 204);
  assert.equal((await adminCall('DELETE', `/faqs/${f2.body.faq.id}`)).status, 404);
  assert.equal((await adminCall('GET', `/courses/${A.id}/faqs`)).body.faqs.length, 2);
});

test('FAQ equal display orders fall back to id (deterministic)', async () => {
  await clear();
  const ids = [];
  for (const q of ['a', 'b', 'c']) ids.push((await adminCall('POST', `/courses/${A.id}/faqs`, { question: q, answer: 'x', displayOrder: 5 })).body.faq.id);
  const list = await adminCall('GET', `/courses/${A.id}/faqs`);
  assert.deepEqual(list.body.faqs.map((f) => f.id), ids);
});

test('FAQ reorder: renumbers deterministically and rejects partial, foreign or duplicate id lists', async () => {
  await clear();
  const ids = [];
  for (const q of ['one', 'two', 'three']) ids.push((await adminCall('POST', `/courses/${A.id}/faqs`, { question: q, answer: 'x' })).body.faq.id);
  const other = (await adminCall('POST', `/courses/${B.id}/faqs`, { question: 'b-one', answer: 'x' })).body.faq.id;
  const ok = await adminCall('POST', `/courses/${A.id}/faqs/reorder`, { ids: [ids[2], ids[0], ids[1]] });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.faqs.map((f) => f.question), ['three', 'one', 'two']);
  assert.deepEqual(ok.body.faqs.map((f) => f.displayOrder), [1, 2, 3]);
  for (const bad of [[ids[0]], [ids[0], ids[1], other], [ids[0], ids[0], ids[1]], [], 'x', [ids[0], 'abc', ids[1]]]) {
    assert.equal((await adminCall('POST', `/courses/${A.id}/faqs/reorder`, { ids: bad })).status, 400, JSON.stringify(bad));
  }
  assert.equal((await adminCall('GET', `/courses/${B.id}/faqs`)).body.faqs[0].displayOrder, 1, 'other course untouched');
  assert.equal((await adminCall('POST', `/courses/999999/faqs/reorder`, { ids: [1] })).status, 404);
});

test('FAQ validation: blank, whitespace, over-long, wrong types, bad order', async () => {
  const before = (await adminCall('GET', `/courses/${A.id}/faqs`)).body.faqs.length;
  for (const bad of [
    {},
    { question: '', answer: 'a' },
    { question: 'q', answer: '' },
    { question: '   ', answer: 'a' },
    { question: 'q', answer: ' \n ' },
    { question: 'q'.repeat(501), answer: 'a' },
    { question: 'q', answer: 'a'.repeat(3001) },
    { question: 5, answer: 'a' },
    { question: 'q', answer: ['a'] },
    { question: 'q', answer: 'a', displayOrder: -1 },
    { question: 'q', answer: 'a', displayOrder: 'x' },
  ]) {
    assert.equal((await adminCall('POST', `/courses/${A.id}/faqs`, bad)).status, 400, JSON.stringify(bad).slice(0, 50));
  }
  assert.equal((await adminCall('POST', `/courses/${A.id}/faqs`, { question: 'q'.repeat(500), answer: 'a'.repeat(3000) })).status, 201);
  assert.equal((await adminCall('GET', `/courses/${A.id}/faqs`)).body.faqs.length, before + 1);
  const f = (await adminCall('GET', `/courses/${A.id}/faqs`)).body.faqs[0];
  assert.equal((await adminCall('PATCH', `/faqs/${f.id}`, { question: '  ' })).status, 400);
  assert.equal((await adminCall('PATCH', `/faqs/${f.id}`, {})).status, 400);
});

test('FAQ: unknown course and malformed ids', async () => {
  assert.equal((await adminCall('POST', '/courses/999999/faqs', { question: 'q', answer: 'a' })).status, 404);
  assert.equal((await adminCall('GET', '/courses/abc/faqs')).status, 400);
  assert.equal((await adminCall('PATCH', '/faqs/abc', { question: 'x' })).status, 400);
  assert.equal((await adminCall('PATCH', '/faqs/999999', { question: 'x' })).status, 404);
  assert.equal((await adminCall('DELETE', '/faqs/999999')).status, 404);
});

test('FAQ access: Trainers read assigned courses only and can never write; Students need a current enrolment', async () => {
  await clear();
  await adminCall('POST', `/courses/${A.id}/faqs`, { question: 'A-q', answer: 'A-a' });
  await adminCall('POST', `/courses/${B.id}/faqs`, { question: 'B-q', answer: 'B-a' });
  const faqId = (await adminCall('GET', `/courses/${A.id}/faqs`)).body.faqs[0].id;

  assert.equal((await call('GET', `/api/eduyarp/trainer/courses/${A.id}/faqs`)).status, 401);
  assert.equal((await trainerCall(t1, 'GET', `/courses/${A.id}/faqs`)).body.faqs[0].question, 'A-q');
  assert.equal((await trainerCall(t1, 'GET', `/courses/${B.id}/faqs`)).status, 403);
  assert.equal((await trainerCall(t2, 'GET', `/courses/${A.id}/faqs`)).status, 403);
  assert.equal((await trainerCall(former, 'GET', `/courses/${A.id}/faqs`)).status, 403, 'former student, not assigned');
  // read-only for Trainers: no write routes exist
  assert.equal((await trainerCall(t1, 'POST', `/courses/${A.id}/faqs`, { question: 'x', answer: 'y' })).status, 404);
  assert.equal((await call('PATCH', `/api/admin/eduyarp/faqs/${faqId}`, { token: t1.token, body: { answer: 'hack' } })).status, 403);
  assert.equal((await call('DELETE', `/api/admin/eduyarp/faqs/${faqId}`, { token: t1.token })).status, 403);

  assert.equal((await studentCall(sActive, A.id, 'faqs')).body.faqs[0].question, 'A-q');
  assert.equal((await studentCall(sCompleted, A.id, 'faqs')).status, 200);
  assert.equal((await studentCall(sCancelled, A.id, 'faqs')).status, 404);
  assert.equal((await studentCall(sActive, B.id, 'faqs')).status, 404, "another course's FAQ");
  assert.equal((await studentCall(sOther, A.id, 'faqs')).status, 404);
  assert.equal((await studentCall(sNone, A.id, 'faqs')).status, 404);
  assert.equal((await studentCall(sActive, '999999', 'faqs')).status, 404);
  assert.equal((await studentCall(sActive, 'abc', 'faqs')).status, 400);
  assert.equal((await call('GET', `/api/eduyarp/me/courses/${A.id}/faqs`)).status, 401);
  // a Student cannot write
  assert.equal((await call('POST', `/api/admin/eduyarp/courses/${A.id}/faqs`, { token: sActive.token, body: { question: 'x', answer: 'y' } })).status, 403);
  // a former Student who is now a Trainer does not get student access through old enrolments
  assert.equal((await call('GET', `/api/eduyarp/me/courses/${A.id}/faqs`, { token: former.token })).status, 403);
});

// ---------------------------------------------------------------- Resources

test('resource admin CRUD with module/topic association, metadata and ordering', async () => {
  await clear();
  const wide = await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ title: '  Course guide  ', description: '  Start here  ', resourceType: 'pdf' }));
  assert.equal(wide.status, 201);
  assert.equal(wide.body.resource.title, 'Course guide');
  assert.equal(wide.body.resource.description, 'Start here');
  assert.equal(wide.body.resource.moduleId, null);
  const onModule = await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ title: 'Module deck', moduleId: A.moduleId }));
  assert.equal(onModule.status, 201);
  assert.equal(onModule.body.resource.moduleTitle, 'Module 1');
  const onTopic2 = await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ title: 'Topic 2 video', resourceType: 'video', topicId: A.topicIds[1] }));
  const onTopic1 = await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ title: 'Topic 1 doc', resourceType: 'document', topicId: A.topicIds[0] }));
  assert.equal(onTopic1.body.resource.moduleId, A.moduleId, 'topic fills in its module');
  assert.equal(onTopic1.body.resource.topicTitle, 'Topic 1');
  const list = await adminCall('GET', `/courses/${A.id}/resources`);
  assert.deepEqual(list.body.resources.map((r) => r.title), ['Course guide', 'Module deck', 'Topic 1 doc', 'Topic 2 video']);
  assert.deepEqual(Object.keys(list.body.resources[0]).sort(), ['courseId', 'createdAt', 'description', 'displayOrder', 'id', 'moduleId', 'moduleTitle', 'resourceType', 'title', 'topicId', 'topicTitle', 'updatedAt', 'url']);

  const upd = await adminCall('PATCH', `/resources/${wide.body.resource.id}`, { title: 'Guide v2', url: 'https://example.com/v2.pdf', description: null });
  assert.equal(upd.body.resource.title, 'Guide v2');
  assert.equal(upd.body.resource.description, null);
  assert.equal(upd.body.resource.resourceType, 'pdf');
  assert.equal((await adminCall('DELETE', `/resources/${wide.body.resource.id}`)).status, 204);
  assert.equal((await adminCall('DELETE', `/resources/${wide.body.resource.id}`)).status, 404);
  assert.ok(onTopic2.body.resource.id);
});

test('resource ordering: display_order within a group, then id', async () => {
  await clear();
  const mk = (title, extra) => adminCall('POST', `/courses/${A.id}/resources`, goodResource({ title, ...extra }));
  await mk('b-second', { displayOrder: 2 });
  await mk('a-first', { displayOrder: 1 });
  await mk('c-tie-1', { displayOrder: 3 });
  await mk('c-tie-2', { displayOrder: 3 });
  const list = await adminCall('GET', `/courses/${A.id}/resources`);
  assert.deepEqual(list.body.resources.map((r) => r.title), ['a-first', 'b-second', 'c-tie-1', 'c-tie-2']);
  const auto = await mk('auto');
  assert.equal(auto.body.resource.displayOrder, 4);
});

test('resource updates: move between module/topic, clear links, and keep them consistent', async () => {
  await clear();
  const r = (await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ topicId: A.topicIds[0] }))).body.resource;
  const toTopic2 = await adminCall('PATCH', `/resources/${r.id}`, { topicId: A.topicIds[1] });
  assert.equal(toTopic2.body.resource.topicId, A.topicIds[1]);
  assert.equal(toTopic2.body.resource.moduleId, A.moduleId);
  const toModule = await adminCall('PATCH', `/resources/${r.id}`, { topicId: null });
  assert.equal(toModule.body.resource.topicId, null);
  assert.equal(toModule.body.resource.moduleId, A.moduleId, 'module kept when the topic is cleared');
  const wide = await adminCall('PATCH', `/resources/${r.id}`, { moduleId: null, topicId: null });
  assert.equal(wide.body.resource.moduleId, null);
  assert.equal((await adminCall('PATCH', `/resources/${r.id}`, { moduleId: B.moduleId })).status, 400);
  assert.equal((await adminCall('PATCH', `/resources/${r.id}`, { topicId: B.topicIds[0] })).status, 400);
  assert.equal((await adminCall('PATCH', `/resources/${r.id}`, { courseId: B.id, title: 'still here' })).body.resource.courseId, A.id, 'course cannot be changed');
});

test('security: cross-course module and topic associations are denied', async () => {
  await clear();
  const crossModule = await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ moduleId: B.moduleId }));
  assert.equal(crossModule.status, 400);
  assert.ok(crossModule.body.error.details.moduleId);
  const crossTopic = await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ topicId: B.topicIds[0] }));
  assert.equal(crossTopic.status, 400);
  assert.ok(crossTopic.body.error.details.topicId);
  assert.equal((await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ moduleId: '999999' }))).status, 400);
  assert.equal((await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ topicId: '999999' }))).status, 400);
  assert.equal((await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ moduleId: 'abc' }))).status, 400);
  // a topic with a module that is not its own
  const extraModule = (await db.pool.query("INSERT INTO course_modules (course_id, title, display_order) VALUES ($1, 'M2', 2) RETURNING id", [A.id])).rows[0].id;
  assert.equal((await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ moduleId: extraModule, topicId: A.topicIds[0] }))).status, 400);
  // a Trainer cannot get around it either
  assert.equal((await trainerCall(t1, 'POST', `/courses/${A.id}/resources`, goodResource({ topicId: B.topicIds[0] }))).status, 400);
  assert.equal((await adminCall('GET', `/courses/${A.id}/resources`)).body.resources.length, 0);
});

test('security: dangerous and malformed URLs are rejected (create and update)', async () => {
  await clear();
  const bad = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
    'ftp://example.com/x',
    'blob:https://example.com/abc',
    '//example.com/x',
    'example.com/x',
    'https://',
    'http:///nohost',
    'https://exa mple.com',
    ' javascript:alert(1)',
    'https://user:pass@example.com/x',
    '',
    '   ',
    'not a url',
    'https://example.com/' + 'a'.repeat(2100),
  ];
  for (const url of bad) {
    const res = await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ url }));
    assert.equal(res.status, 400, url.slice(0, 40));
    assert.ok(res.body.error.details.url, url.slice(0, 40));
  }
  for (const url of [5, null, ['https://a.com'], { a: 1 }]) {
    assert.equal((await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ url }))).status, 400);
  }
  const good = (await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ url: '  HTTPS://Example.com/Path?q=1#x ' }))).body.resource;
  assert.equal(good.url, 'HTTPS://Example.com/Path?q=1#x');
  for (const url of ['javascript:alert(1)', 'data:text/plain,hi', 'file:///x', 'bad']) {
    assert.equal((await adminCall('PATCH', `/resources/${good.id}`, { url })).status, 400, url);
  }
  assert.equal((await adminCall('GET', `/courses/${A.id}/resources`)).body.resources[0].url, good.url);
  assert.equal((await adminCall('GET', `/courses/${A.id}/resources`)).body.resources.length, 1);
});

test('resource validation: title, type, description, order', async () => {
  for (const bad of [
    {},
    goodResource({ title: '' }),
    goodResource({ title: '   ' }),
    goodResource({ title: 'x'.repeat(201) }),
    goodResource({ resourceType: 'audio' }),
    goodResource({ resourceType: 'PDF' }),
    goodResource({ resourceType: undefined }),
    goodResource({ description: 'd'.repeat(1001) }),
    goodResource({ description: 5 }),
    goodResource({ displayOrder: -1 }),
    goodResource({ displayOrder: 1.5 }),
  ]) {
    assert.equal((await adminCall('POST', `/courses/${A.id}/resources`, bad)).status, 400, JSON.stringify(bad).slice(0, 60));
  }
  for (const type of ['video', 'pdf', 'document', 'presentation', 'external']) {
    assert.equal((await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ resourceType: type }))).status, 201, type);
  }
  assert.equal((await adminCall('POST', '/courses/999999/resources', goodResource())).status, 404);
  assert.equal((await adminCall('PATCH', '/resources/999999', { title: 'x' })).status, 404);
  assert.equal((await adminCall('PATCH', '/resources/abc', { title: 'x' })).status, 400);
  assert.equal((await adminCall('DELETE', '/resources/abc')).status, 400);
});

test('Trainer: full CRUD on an assigned course', async () => {
  await clear();
  const created = await trainerCall(t1, 'POST', `/courses/${A.id}/resources`, goodResource({ title: 'Mine', topicId: A.topicIds[0] }));
  assert.equal(created.status, 201);
  const id = created.body.resource.id;
  const list = await trainerCall(t1, 'GET', `/courses/${A.id}/resources`);
  assert.deepEqual(list.body.resources.map((r) => r.title), ['Mine']);
  const upd = await trainerCall(t1, 'PATCH', `/resources/${id}`, { title: 'Renamed', resourceType: 'document' });
  assert.equal(upd.body.resource.title, 'Renamed');
  assert.equal((await trainerCall(t1, 'DELETE', `/resources/${id}`)).status, 204);
  assert.equal((await trainerCall(t1, 'GET', `/courses/${A.id}/resources`)).body.resources.length, 0);
});

test('Trainer: unassigned course is denied for list, create, edit and delete (IDOR)', async () => {
  await clear();
  const inB = (await adminCall('POST', `/courses/${B.id}/resources`, goodResource({ title: 'B only' }))).body.resource;
  assert.equal((await trainerCall(t1, 'GET', `/courses/${B.id}/resources`)).status, 403);
  assert.equal((await trainerCall(t1, 'POST', `/courses/${B.id}/resources`, goodResource())).status, 403);
  assert.equal((await trainerCall(t1, 'PATCH', `/resources/${inB.id}`, { title: 'hacked' })).status, 404);
  assert.equal((await trainerCall(t1, 'DELETE', `/resources/${inB.id}`)).status, 404);
  assert.equal((await trainerCall(t1, 'PATCH', '/resources/999999', { title: 'x' })).status, 404);
  assert.equal((await trainerCall(t1, 'PATCH', '/resources/abc', { title: 'x' })).status, 400);
  // a Trainer cannot move a resource into someone else's course or change its course
  const own = (await trainerCall(t1, 'POST', `/courses/${A.id}/resources`, goodResource())).body.resource;
  const moved = await trainerCall(t1, 'PATCH', `/resources/${own.id}`, { courseId: B.id, title: 'moved?' });
  assert.equal(moved.body.resource.courseId, A.id);
  const row = (await db.pool.query('SELECT title FROM course_resources WHERE id = $1', [inB.id])).rows[0];
  assert.equal(row.title, 'B only');
  // student and anonymous callers
  assert.equal((await call('GET', `/api/eduyarp/trainer/courses/${A.id}/resources`)).status, 401);
  assert.equal((await call('POST', `/api/eduyarp/trainer/courses/${A.id}/resources`, { token: sActive.token, body: goodResource() })).status, 403);
  assert.equal((await call('POST', `/api/admin/eduyarp/courses/${A.id}/resources`, { token: t1.token, body: goodResource() })).status, 403);
  assert.equal((await call('PATCH', `/api/admin/eduyarp/resources/${own.id}`, { token: t1.token, body: { title: 'x' } })).status, 403);
});

test('Trainer access disappears immediately on unassignment or demotion (same token)', async () => {
  await clear();
  const t = await createUser(db.pool, { role: 'trainer' });
  await assign(db.pool, B.id, t.id);
  const r = (await trainerCall(t, 'POST', `/courses/${B.id}/resources`, goodResource())).body.resource;
  assert.equal((await trainerCall(t, 'GET', `/courses/${B.id}/resources`)).status, 200);
  await db.pool.query('DELETE FROM course_trainers WHERE trainer_id = $1', [t.id]);
  assert.equal((await trainerCall(t, 'GET', `/courses/${B.id}/resources`)).status, 403);
  assert.equal((await trainerCall(t, 'GET', `/courses/${B.id}/faqs`)).status, 403);
  assert.equal((await trainerCall(t, 'PATCH', `/resources/${r.id}`, { title: 'x' })).status, 404);
  assert.equal((await trainerCall(t, 'DELETE', `/resources/${r.id}`)).status, 404);
  await assign(db.pool, B.id, t.id);
  await db.pool.query("UPDATE users SET role = 'student' WHERE id = $1", [t.id]);
  assert.equal((await trainerCall(t, 'GET', `/courses/${B.id}/resources`)).status, 403);
});

test('Students: current enrolments see resources; cancelled, other-course and unenrolled do not', async () => {
  await clear();
  await adminCall('POST', `/courses/${A.id}/resources`, goodResource({ title: 'A res', topicId: A.topicIds[0] }));
  await adminCall('POST', `/courses/${B.id}/resources`, goodResource({ title: 'B res' }));
  const a = await studentCall(sActive, A.id, 'resources');
  assert.equal(a.status, 200);
  assert.deepEqual(a.body.resources.map((r) => r.title), ['A res']);
  assert.equal(a.body.resources[0].topicTitle, 'Topic 1');
  assert.equal((await studentCall(sCompleted, A.id, 'resources')).status, 200, 'completed enrolment keeps access');
  assert.equal((await studentCall(sCancelled, A.id, 'resources')).status, 404, 'cancelled enrolment is denied');
  assert.equal((await studentCall(sActive, B.id, 'resources')).status, 404, "another course's resources");
  assert.equal((await studentCall(sNone, A.id, 'resources')).status, 404);
  assert.equal((await studentCall(sOther, A.id, 'resources')).status, 404);
  assert.equal((await studentCall(sOther, B.id, 'resources')).body.resources[0].title, 'B res');
  assert.equal((await call('GET', `/api/eduyarp/me/courses/${A.id}/resources`)).status, 401);
  assert.equal((await call('GET', `/api/eduyarp/me/courses/${A.id}/resources`, { token: former.token })).status, 403);
  assert.equal((await call('GET', `/api/eduyarp/me/courses/${A.id}/resources`, { token: admin.token })).status, 403);
  // Students cannot write or touch resource ids
  const id = a.body.resources[0].id;
  assert.equal((await call('PATCH', `/api/eduyarp/trainer/resources/${id}`, { token: sActive.token, body: { title: 'x' } })).status, 403);
  assert.equal((await call('DELETE', `/api/admin/eduyarp/resources/${id}`, { token: sActive.token })).status, 403);
});

test('a student whose enrolment is cancelled loses access at once; re-enrolment restores it', async () => {
  await clear();
  await adminCall('POST', `/courses/${A.id}/resources`, goodResource());
  const s = await createUser(db.pool, { fullName: 'Flip' });
  await enrol(db.pool, s.id, A.id, 'active');
  assert.equal((await studentCall(s, A.id, 'resources')).status, 200);
  await db.pool.query("UPDATE enrolments SET status = 'cancelled' WHERE student_id = $1", [s.id]);
  assert.equal((await studentCall(s, A.id, 'resources')).status, 404);
  assert.equal((await studentCall(s, A.id, 'faqs')).status, 404);
  await db.pool.query("UPDATE enrolments SET status = 'active' WHERE student_id = $1", [s.id]);
  assert.equal((await studentCall(s, A.id, 'resources')).status, 200);
});

test('a Student promoted to Trainer through the Admin API loses student content access', async () => {
  await clear();
  const s = await createUser(db.pool, { fullName: 'Promoted' });
  await enrol(db.pool, s.id, A.id, 'active');
  assert.equal((await studentCall(s, A.id, 'faqs')).status, 200);
  assert.equal((await call('PATCH', `/api/admin/users/${s.id}/role`, { token: admin.token, body: { role: 'trainer' } })).status, 200);
  assert.equal((await call('GET', `/api/eduyarp/me/courses/${A.id}/faqs`, { token: s.token })).status, 403);
});

test('course deletion removes FAQs and resources; modules and topics take their resources with them', async () => {
  await clear();
  const C = await createCourse(db.pool, { title: 'To delete', topicCount: 2 });
  await adminCall('POST', `/courses/${C.id}/faqs`, { question: 'q', answer: 'a' });
  await adminCall('POST', `/courses/${C.id}/resources`, goodResource({ title: 'wide' }));
  await adminCall('POST', `/courses/${C.id}/resources`, goodResource({ title: 'topic', topicId: C.topicIds[0] }));
  // deleting the topic through the Admin API removes only its resource
  assert.equal((await adminCall('DELETE', `/topics/${C.topicIds[0]}`)).status, 204);
  assert.deepEqual((await adminCall('GET', `/courses/${C.id}/resources`)).body.resources.map((r) => r.title), ['wide']);
  assert.equal((await adminCall('DELETE', `/courses/${C.id}`)).status, 204);
  assert.equal((await db.pool.query('SELECT 1 FROM course_faqs WHERE course_id = $1', [C.id])).rows.length, 0);
  assert.equal((await db.pool.query('SELECT 1 FROM course_resources WHERE course_id = $1', [C.id])).rows.length, 0);
  assert.equal((await adminCall('GET', `/courses/${C.id}/faqs`)).status, 404);
});

test('Admin can manage every course; unauthenticated callers cannot reach anything', async () => {
  await clear();
  for (const course of [A, B]) {
    assert.equal((await adminCall('POST', `/courses/${course.id}/faqs`, { question: 'q', answer: 'a' })).status, 201);
    assert.equal((await adminCall('POST', `/courses/${course.id}/resources`, goodResource())).status, 201);
  }
  for (const [m, p] of [
    ['GET', `/api/admin/eduyarp/courses/${A.id}/faqs`],
    ['POST', `/api/admin/eduyarp/courses/${A.id}/resources`],
    ['PATCH', '/api/admin/eduyarp/faqs/1'],
    ['DELETE', '/api/admin/eduyarp/resources/1'],
    ['GET', `/api/eduyarp/trainer/courses/${A.id}/resources`],
    ['GET', `/api/eduyarp/me/courses/${A.id}/resources`],
  ]) {
    assert.equal((await call(m, p)).status, 401, `${m} ${p}`);
  }
});
