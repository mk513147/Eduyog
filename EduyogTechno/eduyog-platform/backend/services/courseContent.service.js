const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS, buildSetClause } = require('../utils/db');
const { assertCourseContentAccess, assertCourseAccess, isAssigned } = require('./eduyarpAccess.service');

// Course FAQs and URL-based learning resources.
//
// Who may do what (decided here, from the database, never from the request):
//   Admin    - everything, any course.
//   Trainer  - read FAQs and read/create/edit/delete resources of courses they are
//              currently assigned to. FAQs are read-only for Trainers.
//   Student  - read FAQs and resources of courses with an active or completed enrolment.

async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function assertCourseExists(courseId) {
  const { rows } = await pool.query('SELECT 1 FROM courses WHERE id = $1', [courseId]);
  if (rows.length === 0) throw new HttpError(404, 'Course not found');
}

// Admin writes: a missing course is a plain 404.
async function assertAdminCourse(actor, courseId) {
  await assertCourseAccess(actor, courseId);
  await assertCourseExists(courseId);
}

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------

const FAQ_WRITABLE = { question: 'question', answer: 'answer', displayOrder: 'display_order' };

function toFaq(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    question: row.question,
    answer: row.answer,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listFaqs(actor, courseId) {
  await assertCourseContentAccess(actor, courseId);
  if (actor.role === 'admin') await assertCourseExists(courseId);
  const { rows } = await pool.query(
    'SELECT * FROM course_faqs WHERE course_id = $1 ORDER BY display_order ASC, id ASC',
    [courseId]
  );
  return rows.map(toFaq);
}

// Without displayOrder the FAQ goes after the existing ones.
async function createFaq(actor, courseId, input) {
  await assertAdminCourse(actor, courseId);
  try {
    const { rows } = await pool.query(
      `INSERT INTO course_faqs (course_id, question, answer, display_order)
       VALUES ($1, $2, $3, COALESCE($4::integer,
         (SELECT COALESCE(MAX(display_order), 0) + 1 FROM course_faqs WHERE course_id = $1)))
       RETURNING *`,
      [courseId, input.question, input.answer, input.displayOrder ?? null]
    );
    return toFaq(rows[0]);
  } catch (err) {
    if (err.code === PG_ERRORS.CHECK_VIOLATION) throw new HttpError(400, 'FAQ data is invalid');
    throw err;
  }
}

async function updateFaq(actor, id, changes) {
  const { rows: found } = await pool.query('SELECT course_id FROM course_faqs WHERE id = $1', [id]);
  if (!found[0]) throw new HttpError(404, 'FAQ not found');
  await assertCourseAccess(actor, found[0].course_id);
  const { assignments, params } = buildSetClause(FAQ_WRITABLE, changes);
  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE course_faqs SET ${assignments.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) throw new HttpError(404, 'FAQ not found');
    return toFaq(rows[0]);
  } catch (err) {
    if (err.code === PG_ERRORS.CHECK_VIOLATION) throw new HttpError(400, 'FAQ data is invalid');
    throw err;
  }
}

async function deleteFaq(actor, id) {
  const { rows } = await pool.query('SELECT course_id FROM course_faqs WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'FAQ not found');
  await assertCourseAccess(actor, rows[0].course_id);
  await pool.query('DELETE FROM course_faqs WHERE id = $1', [id]);
}

// `ids` must be exactly the course's FAQ ids; they are renumbered 1..n in that order.
async function reorderFaqs(actor, courseId, ids) {
  await assertAdminCourse(actor, courseId);
  return inTransaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`faq-order:${courseId}`]);
    const { rows } = await db.query('SELECT id FROM course_faqs WHERE course_id = $1', [courseId]);
    const existing = new Set(rows.map((r) => String(r.id)));
    if (existing.size !== ids.length || ids.some((id) => !existing.has(String(id)))) {
      throw new HttpError(400, 'Validation failed', { ids: 'ids must list every FAQ of this course exactly once' });
    }
    await db.query(
      `UPDATE course_faqs f SET display_order = o.position
       FROM unnest($1::bigint[]) WITH ORDINALITY AS o(id, position)
       WHERE f.id = o.id AND f.course_id = $2`,
      [ids, courseId]
    );
    const result = await db.query(
      'SELECT * FROM course_faqs WHERE course_id = $1 ORDER BY display_order ASC, id ASC',
      [courseId]
    );
    return result.rows.map(toFaq);
  });
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

const RESOURCE_WRITABLE = {
  title: 'title',
  description: 'description',
  resourceType: 'resource_type',
  url: 'url',
  moduleId: 'module_id',
  topicId: 'topic_id',
  displayOrder: 'display_order',
};

// Course-wide resources first, then each module's (module order), with topic resources
// after their module's own, then by display_order and id.
const RESOURCE_SELECT = `
  SELECT r.*, m.title AS module_title, t.title AS topic_title
  FROM course_resources r
  LEFT JOIN course_modules m ON m.id = r.module_id
  LEFT JOIN course_topics t ON t.id = r.topic_id`;

const RESOURCE_ORDER = `
  ORDER BY (r.module_id IS NOT NULL), m.display_order, m.id,
           (r.topic_id IS NOT NULL), t.display_order, t.id,
           r.display_order, r.id`;

function toResource(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    moduleId: row.module_id,
    moduleTitle: row.module_title,
    topicId: row.topic_id,
    topicTitle: row.topic_title,
    title: row.title,
    description: row.description,
    resourceType: row.resource_type,
    url: row.url,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getResource(id) {
  const { rows } = await pool.query(`${RESOURCE_SELECT} WHERE r.id = $1`, [id]);
  return rows[0] ? toResource(rows[0]) : null;
}

async function listResources(actor, courseId) {
  await assertCourseContentAccess(actor, courseId);
  if (actor.role === 'admin') await assertCourseExists(courseId);
  const { rows } = await pool.query(`${RESOURCE_SELECT} WHERE r.course_id = $1 ${RESOURCE_ORDER}`, [courseId]);
  return rows.map(toResource);
}

// Module and topic must belong to the resource's own course and agree with each other.
// The database has a trigger doing the same; this gives readable field errors.
async function checkLinks(courseId, moduleId, topicId) {
  const errors = {};
  let topicModule = null;
  if (topicId) {
    const { rows } = await pool.query(
      `SELECT t.module_id, m.course_id FROM course_topics t
       JOIN course_modules m ON m.id = t.module_id WHERE t.id = $1`,
      [topicId]
    );
    if (!rows[0] || String(rows[0].course_id) !== String(courseId)) {
      errors.topicId = 'Topic does not belong to this course';
    } else {
      topicModule = rows[0].module_id;
    }
  }
  if (moduleId) {
    const { rows } = await pool.query('SELECT course_id FROM course_modules WHERE id = $1', [moduleId]);
    if (!rows[0] || String(rows[0].course_id) !== String(courseId)) {
      errors.moduleId = 'Module does not belong to this course';
    } else if (topicModule !== null && String(topicModule) !== String(moduleId)) {
      errors.topicId = 'Topic does not belong to the selected module';
    }
  }
  if (Object.keys(errors).length > 0) throw new HttpError(400, 'Validation failed', errors);
}

function translateResourceError(err) {
  if (err.code === PG_ERRORS.CHECK_VIOLATION) return new HttpError(400, 'Resource data is invalid');
  return err;
}

async function createResource(actor, courseId, input) {
  await assertCourseAccess(actor, courseId);
  await assertCourseExists(courseId);
  await checkLinks(courseId, input.moduleId, input.topicId);
  try {
    const { rows } = await pool.query(
      `INSERT INTO course_resources
         (course_id, module_id, topic_id, title, description, resource_type, url, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::integer,
         (SELECT COALESCE(MAX(display_order), 0) + 1 FROM course_resources WHERE course_id = $1)))
       RETURNING id`,
      [
        courseId,
        input.moduleId ?? null,
        input.topicId ?? null,
        input.title,
        input.description ?? null,
        input.resourceType,
        input.url,
        input.displayOrder ?? null,
      ]
    );
    return await getResource(rows[0].id);
  } catch (err) {
    throw translateResourceError(err);
  }
}

// A Trainer can only reach a resource of a course they are assigned to. Anything else
// (no such id, another course) is a 404, so ids cannot be probed. Admin reaches all.
async function loadManageable(actor, id) {
  const { rows } = await pool.query('SELECT course_id, module_id, topic_id FROM course_resources WHERE id = $1', [id]);
  const found = rows[0];
  if (!found) throw new HttpError(404, 'Resource not found');
  if (actor.role !== 'admin' && !(actor.role === 'trainer' && (await isAssigned(found.course_id, actor.id)))) {
    throw new HttpError(404, 'Resource not found');
  }
  return found;
}

async function updateResource(actor, id, changes) {
  const current = await loadManageable(actor, id);
  const touchesLinks = changes.moduleId !== undefined || changes.topicId !== undefined;
  if (touchesLinks) {
    let moduleId = changes.moduleId !== undefined ? changes.moduleId : current.module_id;
    const topicId = changes.topicId !== undefined ? changes.topicId : current.topic_id;
    // Choosing a topic without naming a module: the topic decides the module.
    if (changes.topicId && changes.moduleId === undefined) moduleId = null;
    await checkLinks(current.course_id, moduleId, topicId);
    changes.moduleId = moduleId;
    changes.topicId = topicId;
  }
  const { assignments, params } = buildSetClause(RESOURCE_WRITABLE, changes);
  params.push(id);
  try {
    await pool.query(`UPDATE course_resources SET ${assignments.join(', ')} WHERE id = $${params.length}`, params);
  } catch (err) {
    throw translateResourceError(err);
  }
  return getResource(id);
}

async function deleteResource(actor, id) {
  await loadManageable(actor, id);
  await pool.query('DELETE FROM course_resources WHERE id = $1', [id]);
}

module.exports = {
  checkLinks,
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  reorderFaqs,
  listResources,
  createResource,
  updateResource,
  deleteResource,
};
