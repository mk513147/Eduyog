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

// Course of a module or topic parent, for re-syncing enrolment status.
async function courseIdFor(kindName, parentId) {
  if (kindName === 'module') return parentId;
  const { rows } = await pool.query('SELECT course_id FROM course_modules WHERE id = $1', [parentId]);
  return rows[0]?.course_id ?? null;
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
    const { rows } = await pool.query(
      `INSERT INTO ${kind.table} (${kind.parentColumn}, title, description, display_order${videoColumn})
       VALUES ($1, $2, $3, COALESCE($4::integer,
         (SELECT COALESCE(MAX(display_order), 0) + 1 FROM ${kind.table} WHERE ${kind.parentColumn} = $1))${videoParam})
       RETURNING *`,
      kind.hasVideo
        ? [parentId, title, description, displayOrder ?? null, videoUrl]
        : [parentId, title, description, displayOrder ?? null]
    );
    if (kindName === 'topic') {
      await syncCourseStatuses(await courseIdFor('topic', parentId));
    }
    return toItem(kind, rows[0]);
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
  const { rows } = await pool.query(
    `DELETE FROM ${kind.table} WHERE id = $1 RETURNING ${kind.parentColumn} AS parent_id`,
    [id]
  );
  if (!rows[0]) {
    throw new HttpError(404, `${kind.label} not found`);
  }
  const courseId = await courseIdFor(kindName, rows[0].parent_id);
  if (courseId !== null) {
    await syncCourseStatuses(courseId);
  }
}

module.exports = {
  createModule: (courseId, input) => createItem('module', courseId, input),
  updateModule: (id, changes) => updateItem('module', id, changes),
  deleteModule: (id) => deleteItem('module', id),
  createTopic: (moduleId, input) => createItem('topic', moduleId, input),
  updateTopic: (id, changes) => updateItem('topic', id, changes),
  deleteTopic: (id) => deleteItem('topic', id),
};
