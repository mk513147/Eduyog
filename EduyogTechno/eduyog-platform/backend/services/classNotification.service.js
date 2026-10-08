const pool = require('../config/database');
const notifications = require('./notification.service');

// Notifications for the existing class scheduling flow. These run AFTER the class
// change has been committed and never throw: a failure is logged and the class
// operation stays successful. (No queue or retry in this stage.)

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const when = (value) => `${timeFormatter.format(new Date(value))} UTC`;

const sameInstant = (a, b) => new Date(a).getTime() === new Date(b).getTime();

// What changed between two class snapshots, for the fields students and the Trainer
// care about. A new title or trainer on its own is not announced.
function meaningfulChanges(before, after) {
  return {
    schedule: !sameInstant(before.scheduledAt, after.scheduledAt),
    link: (before.meetingLink ?? null) !== (after.meetingLink ?? null),
    status: before.status !== after.status,
    course: String(before.courseId) !== String(after.courseId),
  };
}

function describe(before, after, changes) {
  if (after.status === 'cancelled' && changes.status) {
    return { title: `Class cancelled: ${after.title}`, body: `${after.courseTitle} · was ${when(before.scheduledAt)}` };
  }
  const parts = [`${after.courseTitle} · ${when(after.scheduledAt)}`];
  if (changes.link && !changes.schedule) parts.push('Meeting link updated');
  return { title: `Class updated: ${after.title}`, body: parts.join(' · ') };
}

async function deliver(cls, type, { title, body }) {
  const studentIds = await notifications.currentCourseStudentIds(pool, cls.courseId);
  const trainerIds = (await notifications.assignedTrainerIds(pool, cls.courseId)).filter(
    (id) => String(id) === String(cls.trainerId)
  );
  await notifications.createNotificationsForUsers(pool, studentIds, {
    type,
    title,
    body,
    courseId: cls.courseId,
    linkPath: `/my-courses/${cls.courseId}`,
  });
  await notifications.createNotificationsForUsers(pool, trainerIds, {
    type,
    title,
    body,
    courseId: cls.courseId,
    linkPath: `/trainer/courses/${cls.courseId}`,
  });
}

async function safely(label, work) {
  try {
    await work();
  } catch (err) {
    console.error(`[notifications] Could not create ${label} notifications; the class change was saved.`, err);
  }
}

async function classCreated(cls) {
  if (cls.status !== 'scheduled') return;
  await safely('class_scheduled', () =>
    deliver(cls, notifications.TYPES.CLASS_SCHEDULED, {
      title: `New class: ${cls.title}`,
      body: `${cls.courseTitle} · ${when(cls.scheduledAt)}`,
    })
  );
}

// `before` and `after` are class objects as returned by getClass.
async function classUpdated(before, after) {
  const changes = meaningfulChanges(before, after);
  if (!changes.schedule && !changes.link && !changes.status && !changes.course) return;
  // Marking a class completed is housekeeping, not news for students.
  if (after.status === 'completed') return;
  // Edits to a class that is already cancelled and stays cancelled are not news either.
  if (after.status === 'cancelled' && !changes.status) return;
  await safely('class_schedule_changed', () =>
    deliver(after, notifications.TYPES.CLASS_SCHEDULE_CHANGED, describe(before, after, changes))
  );
}

module.exports = { classCreated, classUpdated };
