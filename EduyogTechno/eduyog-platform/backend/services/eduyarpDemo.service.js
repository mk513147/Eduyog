const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { parseVideoUrl } = require('../utils/videoUrl');
const courseService = require('./eduyarpCourse.service');

// Demo access: any approved Student may preview the first DEMO_TOPIC_LIMIT topics of the FIRST module of
// a published course, without an enrolment (it never creates one, and records no progress).
//
// "First" is the curriculum order used everywhere else: modules by (display_order, id), topics by
// (display_order, id), so reordering the curriculum moves the demo with it. The decision is made here
// from the database, per request; nothing the client sends picks what is unlocked.
//
// Everything outside the demo is LOCKED. A locked topic or module is listed (its title only, so the
// student can see what full access contains) but its description, video URL and embed URL are never
// part of the response. A first module with fewer than two topics unlocks what exists; a course with
// no modules has nothing to unlock; an unpublished course is a 404.
const DEMO_TOPIC_LIMIT = 2;

async function getDemoCourse(studentId, courseId) {
  const course = await courseService.findCourse(courseId);
  if (!course || course.status !== 'published') {
    throw new HttpError(404, 'Course not found');
  }

  const { rows } = await pool.query(
    `SELECT m.id AS module_id, m.title AS module_title, m.description AS module_description, m.display_order AS module_order,
            t.id AS topic_id, t.title AS topic_title, t.description AS topic_description,
            t.display_order AS topic_order, t.video_url AS topic_video_url
     FROM course_modules m
     LEFT JOIN course_topics t ON t.module_id = m.id
     WHERE m.course_id = $1
     ORDER BY m.display_order, m.id, t.display_order, t.id`,
    [courseId]
  );

  const modules = [];
  const byId = new Map();
  let firstModuleId = null;
  for (const row of rows) {
    let module = byId.get(row.module_id);
    if (!module) {
      if (firstModuleId === null) firstModuleId = row.module_id;
      const isDemoModule = row.module_id === firstModuleId;
      module = { id: row.module_id, title: row.module_title, displayOrder: row.module_order, locked: !isDemoModule, topics: [] };
      if (isDemoModule) module.description = row.module_description;
      byId.set(row.module_id, module);
      modules.push(module);
    }
    if (row.topic_id === null) continue;
    const unlocked = row.module_id === firstModuleId && module.topics.length < DEMO_TOPIC_LIMIT;
    const topic = { id: row.topic_id, title: row.topic_title, displayOrder: row.topic_order, locked: !unlocked };
    if (unlocked) {
      topic.description = row.topic_description;
      topic.videoUrl = row.topic_video_url;
      topic.videoEmbedUrl = row.topic_video_url ? (parseVideoUrl(row.topic_video_url)?.embedUrl ?? null) : null;
    }
    module.topics.push(topic);
  }

  const { rows: access } = await pool.query(
    "SELECT 1 FROM enrolments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
    [studentId, courseId]
  );
  const trainers = await courseService.getTrainersByCourse([course.id]);
  const publicCourse = { ...course };
  delete publicCourse.createdAt;
  delete publicCourse.updatedAt;

  return {
    ...publicCourse,
    trainers: trainers.get(String(course.id)),
    demo: { topicLimit: DEMO_TOPIC_LIMIT, moduleId: firstModuleId },
    hasFullAccess: access.length > 0,
    modules,
  };
}

module.exports = { DEMO_TOPIC_LIMIT, getDemoCourse };
