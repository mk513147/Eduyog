const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase, startApi, createUser, client, createCourse, assign, enrol } = require('./helpers');

let db;
let api;
let call;
let admin;
let trainer;
let active;
let completed;
let cancelled;
let other; // enrolled in another course
let course;
let otherCourse;

const WHEN = '2026-12-01T10:00:00Z';
const types = ['class_scheduled', 'class_schedule_changed'];
const notes = async (user) =>
  (await db.pool.query('SELECT * FROM notifications WHERE recipient_id = $1 AND type = ANY($2) ORDER BY id', [user.id, types])).rows;
const total = async () => (await db.pool.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n;
const reset = () => db.pool.query('DELETE FROM notifications');

const createClass = (fields = {}) =>
  call('POST', '/api/admin/eduyarp/classes', {
    token: admin.token,
    body: { courseId: course.id, trainerId: trainer.id, title: 'Live session', scheduledAt: WHEN, ...fields },
  });
const patch = (id, body) => call('PATCH', `/api/admin/eduyarp/classes/${id}`, { token: admin.token, body });

before(async () => {
  db = await createTestDatabase();
  api = await startApi(db.name);
  call = client(api.url);
  admin = await createUser(db.pool, { role: 'admin' });
  trainer = await createUser(db.pool, { role: 'trainer' });
  active = await createUser(db.pool, { fullName: 'Active' });
  completed = await createUser(db.pool, { fullName: 'Completed' });
  cancelled = await createUser(db.pool, { fullName: 'Cancelled' });
  other = await createUser(db.pool, { fullName: 'Elsewhere' });
  course = await createCourse(db.pool, { title: 'Live Course' });
  otherCourse = await createCourse(db.pool, { title: 'Other Course' });
  await assign(db.pool, course.id, trainer.id);
  await enrol(db.pool, active.id, course.id, 'active');
  await enrol(db.pool, completed.id, course.id, 'completed');
  await enrol(db.pool, cancelled.id, course.id, 'cancelled');
  await enrol(db.pool, other.id, otherCourse.id, 'active');
});

after(async () => {
  await api.stop();
  await db.drop();
});

test('a new class notifies active and completed students and the class Trainer, nobody else', async () => {
  await reset();
  const res = await createClass();
  assert.equal(res.status, 201);
  for (const u of [active, completed]) {
    const rows = await notes(u);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, 'class_scheduled');
    assert.equal(rows[0].title, 'New class: Live session');
    assert.match(rows[0].body, /Live Course · 1 Dec 2026, 10:00 UTC/);
    assert.equal(rows[0].link_path, `/my-courses/${course.id}`);
    assert.equal(rows[0].course_id, course.id);
  }
  const t = await notes(trainer);
  assert.equal(t.length, 1);
  assert.equal(t[0].link_path, `/trainer/courses/${course.id}`);
  assert.equal((await notes(cancelled)).length, 0);
  assert.equal((await notes(other)).length, 0);
  assert.equal((await notes(admin)).length, 0);
  assert.equal(await total(), 3);
});

test('a class created as completed or cancelled sends nothing', async () => {
  await reset();
  assert.equal((await createClass({ status: 'cancelled' })).status, 201);
  assert.equal((await createClass({ status: 'completed' })).status, 201);
  assert.equal(await total(), 0);
});

test('a rejected class (invalid data, unassigned trainer) sends nothing', async () => {
  await reset();
  assert.equal((await createClass({ trainerId: admin.id })).status, 400);
  assert.equal((await createClass({ scheduledAt: 'tomorrow' })).status, 400);
  assert.equal(await total(), 0);
});

test('changing the date/time notifies once with the new time', async () => {
  const id = (await createClass()).body.class.id;
  await reset();
  const res = await patch(id, { scheduledAt: '2026-12-02T09:30:00Z' });
  assert.equal(res.status, 200);
  const rows = await notes(active);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'class_schedule_changed');
  assert.equal(rows[0].title, 'Class updated: Live session');
  assert.match(rows[0].body, /2 Dec 2026, 09:30 UTC/);
  assert.equal((await notes(completed)).length, 1);
  assert.equal((await notes(trainer)).length, 1);
  assert.equal((await notes(cancelled)).length, 0);
  assert.equal(await total(), 3);
});

test('changing only the meeting link notifies; adding then removing it both count', async () => {
  const id = (await createClass()).body.class.id;
  await reset();
  assert.equal((await patch(id, { meetingLink: 'https://meet.example.com/abc' })).status, 200);
  assert.match((await notes(active))[0].body, /Meeting link updated/);
  assert.equal((await patch(id, { meetingLink: null })).status, 200);
  assert.equal((await notes(active)).length, 2);
});

test('cancelling a class notifies with a cancellation message', async () => {
  const id = (await createClass()).body.class.id;
  await reset();
  assert.equal((await patch(id, { status: 'cancelled' })).status, 200);
  const rows = await notes(active);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Class cancelled: Live session');
  assert.match(rows[0].body, /was 1 Dec 2026, 10:00 UTC/);
});

test('unchanged data and unrelated edits do not notify', async () => {
  const id = (await createClass({ meetingLink: 'https://meet.example.com/x' })).body.class.id;
  await reset();
  // same values (including the date written in a different but equal form)
  assert.equal((await patch(id, { scheduledAt: '2026-12-01T10:00:00.000Z', meetingLink: 'https://meet.example.com/x', status: 'scheduled' })).status, 200);
  assert.equal((await patch(id, { title: 'Renamed only' })).status, 200);
  assert.equal(await total(), 0);
  // marking completed is housekeeping
  assert.equal((await patch(id, { status: 'completed' })).status, 200);
  assert.equal(await total(), 0);
});

test('editing a class that stays cancelled does not notify again', async () => {
  const id = (await createClass()).body.class.id;
  await patch(id, { status: 'cancelled' });
  await reset();
  assert.equal((await patch(id, { scheduledAt: '2027-01-01T10:00:00Z' })).status, 200);
  assert.equal(await total(), 0);
});

test('moving a class to another course notifies the new course students only', async () => {
  const id = (await createClass()).body.class.id;
  await assign(db.pool, otherCourse.id, trainer.id);
  await reset();
  assert.equal((await patch(id, { courseId: otherCourse.id })).status, 200);
  assert.equal((await notes(other)).length, 1);
  assert.equal((await notes(active)).length, 0);
});

test('a failed update (404, invalid) does not notify', async () => {
  await reset();
  assert.equal((await patch('999999', { title: 'x', scheduledAt: WHEN })).status, 404);
  assert.equal((await patch('1', { status: 'bogus' })).status, 400);
  assert.equal(await total(), 0);
});

test('the class operation succeeds even if notification creation fails', async () => {
  // In-process, against the same temporary database, with the notifications table unavailable.
  const classService = require('../services/eduyarpClass.service');
  const pool = require('../config/database');
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  await db.pool.query('ALTER TABLE notifications RENAME TO notifications_hidden');
  try {
    const created = await classService.createClass({ courseId: course.id, trainerId: trainer.id, title: 'Resilient', scheduledAt: WHEN });
    assert.equal(created.title, 'Resilient');
    const updated = await classService.updateClass(created.id, { scheduledAt: '2026-12-05T10:00:00Z' });
    assert.equal(new Date(updated.scheduledAt).toISOString(), '2026-12-05T10:00:00.000Z');
    const stored = await db.pool.query("SELECT 1 FROM classes WHERE title = 'Resilient'");
    assert.equal(stored.rows.length, 1);
    assert.equal(logged.length, 2);
    assert.match(logged[0], /\[notifications\] Could not create class_scheduled notifications/);
    assert.match(logged[1], /class_schedule_changed/);
  } finally {
    console.error = original;
    await db.pool.query('ALTER TABLE notifications_hidden RENAME TO notifications');
    await pool.end();
  }
});

test('the same failure through the API still returns success', async () => {
  await db.pool.query('ALTER TABLE notifications RENAME TO notifications_hidden');
  try {
    const res = await createClass({ title: 'Via API' });
    assert.equal(res.status, 201);
  } finally {
    await db.pool.query('ALTER TABLE notifications_hidden RENAME TO notifications');
  }
});

test('a student who is cancelled after a class was scheduled gets nothing for the later change', async () => {
  const s = await createUser(db.pool, { fullName: 'Later cancelled' });
  await enrol(db.pool, s.id, course.id, 'active');
  const id = (await createClass({ title: 'Cancel test' })).body.class.id;
  assert.equal((await notes(s)).length, 1);
  await db.pool.query("UPDATE enrolments SET status = 'cancelled' WHERE student_id = $1", [s.id]);
  await patch(id, { scheduledAt: '2027-02-01T10:00:00Z' });
  assert.equal((await notes(s)).length, 1, 'still just the original notification');
});
