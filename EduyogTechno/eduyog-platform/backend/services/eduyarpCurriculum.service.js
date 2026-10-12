const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS, buildSetClause } = require('../utils/db');
const { parseVideoUrl } = require('../utils/videoUrl');
const { syncCourseStatuses } = require('./eduyarpEnrolment.service');

// Modules and topics have the same shape; only the table and parent differ.
// Table and column names come only from this map, never from input.
const KINDS = {
  module: {
    table: 'course_modules',
    parentColumn: 'course_id',
    parentField: 'courseId',
    label: 'Module',
    parentLabel: 'Course',
  },
  topic: {
    table: 'course_topics',
    parentColumn: 'module_id',
    parentField: 'moduleId',
    label: 'Topic',
    parentLabel: 'Module',
    hasVideo: true,
  },
};

const WRITABLE_COLUMNS = {
  title: 'title',
  description: 'description',
  displayOrder: 'display_order',
  videoUrl: 'video_url',
};

function toItem(kind, row) {
  const item = {
    id: row.id,
    [kind.parentField]: row[kind.parentColumn],
    title: row.title,
    description: row.description,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (kind.hasVideo) {
    item.videoUrl = row.video_url;
    item.videoEmbedUrl = row.video_url ? (parseVideoUrl(row.video_url)?.embedUrl ?? null) : null;
  }
  return item;
}

// Course of a module or topic parent, for re-syncing enrolment status. `db` is the pool or a transaction client.
async function courseIdFor(kindName, parentId, db = pool) {
  if (kindName === 'module') return parentId;
  const { rows } = await db.query('SELECT course_id FROM course_modules WHERE id = $1', [parentId]);
  return rows[0]?.course_id ?? null;
}

// Runs fn(client) in one transaction: a curriculum change and the enrolment re-sync it causes commit together
// (or not at all), so a failure can never leave statuses out of step with the topics.
async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function translateWriteError(kind, err) {
  if (err.code === PG_ERRORS.CHECK_VIOLATION) {
    return new HttpError(400, `${kind.label} data is invalid`);
  }
  return err;
}

// Without displayOrder, the item goes after its current siblings.
async function createItem(kindName, parentId, { title, description = null, displayOrder, videoUrl = null }) {
  const kind = KINDS[kindName];
  // Modules have no video column; the validator never passes videoUrl for them.
  const videoColumn = kind.hasVideo ? ', video_url' : '';
  const videoParam = kind.hasVideo ? ', $5' : '';
  try {
    return await inTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO ${kind.table} (${kind.parentColumn}, title, description, display_order${videoColumn})
         VALUES ($1, $2, $3, COALESCE($4::integer,
           (SELECT COALESCE(MAX(display_order), 0) + 1 FROM ${kind.table} WHERE ${kind.parentColumn} = $1))${videoParam})
         RETURNING *`,
        kind.hasVideo
          ? [parentId, title, description, displayOrder ?? null, videoUrl]
          : [parentId, title, description, displayOrder ?? null]
      );
      // A new topic never reopens a completed enrolment (see syncStatuses); the re-sync is still run so the
      // statuses are derived from the committed curriculum.
      if (kindName === 'topic') {
        await syncCourseStatuses(await courseIdFor('topic', parentId, client), client);
      }
      return toItem(kind, rows[0]);
    });
  } catch (err) {
    if (err.code === PG_ERRORS.FOREIGN_KEY_VIOLATION) {
      throw new HttpError(404, `${kind.parentLabel} not found`);
    }
    throw translateWriteError(kind, err);
  }
}

async function updateItem(kindName, id, changes) {
  const kind = KINDS[kindName];
  const { assignments, params } = buildSetClause(WRITABLE_COLUMNS, changes);
  params.push(id);
  let rows;
  try {
    ({ rows } = await pool.query(
      `UPDATE ${kind.table} SET ${assignments.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    ));
  } catch (err) {
    throw translateWriteError(kind, err);
  }
  if (!rows[0]) {
    throw new HttpError(404, `${kind.label} not found`);
  }
  return toItem(kind, rows[0]);
}

// Deleting a module deletes its topics; deleting a topic deletes its
// progress rows, so course progress is recalculated from what remains.
async function deleteItem(kindName, id) {
  const kind = KINDS[kindName];
  await inTransaction(async (client) => {
    // Lock the course's current enrolments BEFORE deleting. A student completing a topic locks their enrolment
    // first and then touches the topic (topic_progress references it); taking the locks in the same order here
    // means the two can never deadlock, and the delete waits for any completion in flight.
    const { rows: owner } = await client.query(
      kindName === 'module'
        ? 'SELECT course_id FROM course_modules WHERE id = $1'
        : 'SELECT m.course_id FROM course_topics t JOIN course_modules m ON m.id = t.module_id WHERE t.id = $1',
      [id]
    );
    if (!owner[0]) {
      throw new HttpError(404, `${kind.label} not found`);
    }
    await client.query("SELECT id FROM enrolments WHERE course_id = $1 AND status IN ('active', 'completed') ORDER BY id FOR UPDATE", [
      owner[0].course_id,
    ]);
    const { rows } = await client.query(`DELETE FROM ${kind.table} WHERE id = $1 RETURNING id`, [id]);
    if (!rows[0]) {
      throw new HttpError(404, `${kind.label} not found`);
    }
    await syncCourseStatuses(owner[0].course_id, client);
  });
}

module.exports = {
  createModule: (courseId, input) => createItem('module', courseId, input),
  updateModule: (id, changes) => updateItem('module', id, changes),
  deleteModule: (id) => deleteItem('module', id),
  createTopic: (moduleId, input) => createItem('topic', moduleId, input),
  updateTopic: (id, changes) => updateItem('topic', id, changes),
  deleteTopic: (id) => deleteItem('topic', id),
};
