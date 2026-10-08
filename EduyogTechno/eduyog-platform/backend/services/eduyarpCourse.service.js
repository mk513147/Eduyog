const pool = require('../config/database');
const HttpError = require('../utils/httpError');
const { PG_ERRORS, buildSetClause } = require('../utils/db');
const { parseVideoUrl } = require('../utils/videoUrl');

const COURSE_COLUMNS = `c.id, c.title, c.slug, c.description, c.learning_objectives, c.duration,
  c.level, c.fee, c.status, c.cover_image_url, c.icon_url, c.created_at, c.updated_at`;

const WRITABLE_COLUMNS = {
  title: 'title',
  slug: 'slug',
  description: 'description',
  learningObjectives: 'learning_objectives',
  duration: 'duration',
  level: 'level',
  fee: 'fee',
  status: 'status',
  coverImageUrl: 'cover_image_url',
  iconUrl: 'icon_url',
};

function toCourse(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    learningObjectives: row.learning_objectives,
    duration: row.duration,
    level: row.level,
    // NUMERIC(10,2) arrives as a string; the range fits a JS number exactly.
    fee: Number(row.fee),
    status: row.status,
    // Optional externally hosted image URLs; null means "use the default visual".
    coverImageUrl: row.cover_image_url,
    iconUrl: row.icon_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Public projection: no timestamps.
function toPublicCourse(row) {
  const course = toCourse(row);
  delete course.createdAt;
  delete course.updatedAt;
  return course;
}

function translateWriteError(err) {
  if (err.code === PG_ERRORS.UNIQUE_VIOLATION && err.constraint === 'courses_slug_key') {
    return new HttpError(409, 'A course with this slug already exists', {
      slug: 'A course with this slug already exists',
    });
  }
  if (err.code === PG_ERRORS.CHECK_VIOLATION) {
    return new HttpError(400, 'Course data is invalid');
  }
  return err;
}

// Modules with their topics, in display order. With studentId, each topic
// also carries that student's completion state.
// Video fields are included only for audiences with course access (enrolled
// student, assigned trainer, Admin); the public outline never has them.
async function getOutline(courseId, { studentId = null, includeVideo = false } = {}) {
  const progressJoin = studentId
    ? 'LEFT JOIN topic_progress p ON p.topic_id = t.id AND p.student_id = $2 AND p.completed'
    : '';
  const progressColumns = studentId ? ', p.completed_at AS topic_completed_at' : '';
  const params = studentId ? [courseId, studentId] : [courseId];

  const { rows } = await pool.query(
    `SELECT m.id AS module_id, m.title AS module_title, m.description AS module_description,
            m.display_order AS module_order,
            t.id AS topic_id, t.title AS topic_title, t.description AS topic_description,
            t.display_order AS topic_order, t.video_url AS topic_video_url${progressColumns}
     FROM course_modules m
     LEFT JOIN course_topics t ON t.module_id = m.id
     ${progressJoin}
     WHERE m.course_id = $1
     ORDER BY m.display_order, m.id, t.display_order, t.id`,
    params
  );

  const modules = [];
  const byId = new Map();
  for (const row of rows) {
    let module = byId.get(row.module_id);
    if (!module) {
      module = {
        id: row.module_id,
        title: row.module_title,
        description: row.module_description,
        displayOrder: row.module_order,
        topics: [],
      };
      byId.set(row.module_id, module);
      modules.push(module);
    }
    if (row.topic_id !== null) {
      const topic = {
        id: row.topic_id,
        title: row.topic_title,
        description: row.topic_description,
        displayOrder: row.topic_order,
      };
      if (includeVideo) {
        topic.videoUrl = row.topic_video_url;
        topic.videoEmbedUrl = row.topic_video_url
          ? (parseVideoUrl(row.topic_video_url)?.embedUrl ?? null)
          : null;
      }
      if (studentId) {
        topic.completed = row.topic_completed_at !== null;
        topic.completedAt = row.topic_completed_at;
      }
      module.topics.push(topic);
    }
  }
  return modules;
}

// Assigned trainers keyed by course id. includeEmail is for Admin only.
async function getTrainersByCourse(courseIds, { includeEmail = false } = {}) {
  const byCourse = new Map(courseIds.map((id) => [String(id), []]));
  if (courseIds.length === 0) return byCourse;

  const { rows } = await pool.query(
    `SELECT ct.course_id, u.id, u.full_name, u.email
     FROM course_trainers ct
     JOIN users u ON u.id = ct.trainer_id
     WHERE ct.course_id = ANY($1::bigint[])
     ORDER BY u.full_name, u.id`,
    [courseIds]
  );
  for (const row of rows) {
    const trainer = { id: row.id, fullName: row.full_name };
    if (includeEmail) trainer.email = row.email;
    byCourse.get(String(row.course_id)).push(trainer);
  }
  return byCourse;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

async function listPublishedCourses() {
  const { rows } = await pool.query(
    `SELECT ${COURSE_COLUMNS} FROM courses c
     WHERE c.status = 'published'
     ORDER BY c.title, c.id`
  );
  return rows.map(toPublicCourse);
}

async function getPublishedCourseBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT ${COURSE_COLUMNS} FROM courses c WHERE c.slug = $1 AND c.status = 'published'`,
    [slug]
  );
  if (!rows[0]) {
    throw new HttpError(404, 'Course not found');
  }
  const course = toPublicCourse(rows[0]);
  const trainers = await getTrainersByCourse([course.id]);
  return {
    ...course,
    trainers: trainers.get(String(course.id)),
    modules: await getOutline(course.id),
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

async function listCourses() {
  const { rows } = await pool.query(
    `SELECT ${COURSE_COLUMNS},
       (SELECT count(*) FROM course_modules m WHERE m.course_id = c.id) AS module_count,
       (SELECT count(*) FROM course_topics t JOIN course_modules m ON m.id = t.module_id
          WHERE m.course_id = c.id) AS topic_count,
       (SELECT count(*) FROM enrolments e
          WHERE e.course_id = c.id AND e.status IN ('active', 'completed')) AS enrolment_count
     FROM courses c
     ORDER BY c.created_at DESC, c.id DESC`
  );
  const trainers = await getTrainersByCourse(rows.map((row) => row.id), { includeEmail: true });
  return rows.map((row) => ({
    ...toCourse(row),
    moduleCount: Number(row.module_count),
    topicCount: Number(row.topic_count),
    enrolmentCount: Number(row.enrolment_count),
    trainers: trainers.get(String(row.id)),
  }));
}

async function findCourse(id) {
  const { rows } = await pool.query(`SELECT ${COURSE_COLUMNS} FROM courses c WHERE c.id = $1`, [id]);
  return rows[0] ? toCourse(rows[0]) : null;
}

async function getCourse(id) {
  const course = await findCourse(id);
  if (!course) {
    throw new HttpError(404, 'Course not found');
  }
  const trainers = await getTrainersByCourse([course.id], { includeEmail: true });
  return {
    ...course,
    trainers: trainers.get(String(course.id)),
    modules: await getOutline(course.id, { includeVideo: true }),
  };
}

// Omitted optional fields take the column defaults (status 'draft').
async function createCourse(input) {
  const columns = [];
  const params = [];
  for (const [field, column] of Object.entries(WRITABLE_COLUMNS)) {
    if (input[field] !== undefined) {
      columns.push(column);
      params.push(input[field]);
    }
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO courses (${columns.join(', ')})
       VALUES (${params.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING id`,
      params
    );
    return getCourse(rows[0].id);
  } catch (err) {
    throw translateWriteError(err);
  }
}

async function updateCourse(id, changes) {
  const { assignments, params } = buildSetClause(WRITABLE_COLUMNS, changes);
  params.push(id);
  let rowCount;
  try {
    ({ rowCount } = await pool.query(
      `UPDATE courses SET ${assignments.join(', ')} WHERE id = $${params.length}`,
      params
    ));
  } catch (err) {
    throw translateWriteError(err);
  }
  if (rowCount === 0) {
    throw new HttpError(404, 'Course not found');
  }
  return getCourse(id);
}

// Modules, topics, trainer assignments and classes go with the course.
// Enrolments, including cancelled ones, block the delete (ON DELETE
// RESTRICT); archive instead.
async function deleteCourse(id) {
  let rowCount;
  try {
    ({ rowCount } = await pool.query('DELETE FROM courses WHERE id = $1', [id]));
  } catch (err) {
    if (err.code === PG_ERRORS.RESTRICT_VIOLATION || err.code === PG_ERRORS.FOREIGN_KEY_VIOLATION) {
      throw new HttpError(409, 'This course has enrolments and cannot be deleted. Archive it instead.');
    }
    throw err;
  }
  if (rowCount === 0) {
    throw new HttpError(404, 'Course not found');
  }
}

module.exports = {
  toCourse,
  getOutline,
  getTrainersByCourse,
  listPublishedCourses,
  getPublishedCourseBySlug,
  listCourses,
  findCourse,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
};
