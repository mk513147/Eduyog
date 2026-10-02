-- Eduyog Phase 1 – Eduyarp basic LMS
-- Target: PostgreSQL 13+
--
-- Run once, after 002_add_fitness_lead_fields.sql. Like the earlier files,
-- statements are not "IF NOT EXISTS" so a second run fails loudly. The whole
-- file runs in one transaction.

BEGIN;

-- ---------------------------------------------------------------------------
-- users: add the trainer role.
--
-- Trainers are ordinary users; only an Admin can assign the role. Existing
-- rows are all 'student' or 'admin', so they satisfy the wider constraint.
-- ---------------------------------------------------------------------------
ALTER TABLE users
  DROP CONSTRAINT users_role_valid,
  ADD CONSTRAINT users_role_valid CHECK (role IN ('student', 'admin', 'trainer'));

-- ---------------------------------------------------------------------------
-- courses
--
-- Only 'published' courses are visible publicly and open for enrolment.
-- 'archived' retires a course without deleting enrolments or progress.
-- fee is in INR; 0 means free. No payment processing in Phase 1.
-- ---------------------------------------------------------------------------
CREATE TABLE courses (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title               VARCHAR(200)  NOT NULL,
  slug                VARCHAR(100)  NOT NULL,
  description         TEXT,
  learning_objectives TEXT,
  duration            VARCHAR(100),
  level               VARCHAR(20)   NOT NULL,
  fee                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  status              VARCHAR(20)   NOT NULL DEFAULT 'draft',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT courses_slug_key                   UNIQUE (slug),
  CONSTRAINT courses_title_present              CHECK (btrim(title) <> ''),
  CONSTRAINT courses_slug_format                CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT courses_description_length         CHECK (description IS NULL OR length(description) <= 5000),
  CONSTRAINT courses_learning_objectives_length CHECK (learning_objectives IS NULL OR length(learning_objectives) <= 5000),
  CONSTRAINT courses_level_valid                CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  CONSTRAINT courses_fee_non_negative           CHECK (fee >= 0),
  CONSTRAINT courses_status_valid               CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX courses_status_idx ON courses (status);

CREATE TRIGGER courses_set_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- course_modules / course_topics
--
-- Ordered by display_order, then id. Deleting a course removes its modules,
-- and deleting a module removes its topics (and their progress rows).
-- ---------------------------------------------------------------------------
CREATE TABLE course_modules (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id     BIGINT       NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  display_order INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT course_modules_title_present       CHECK (btrim(title) <> ''),
  CONSTRAINT course_modules_description_length  CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT course_modules_display_order_valid CHECK (display_order >= 0)
);

CREATE INDEX course_modules_course_order_idx ON course_modules (course_id, display_order, id);

CREATE TRIGGER course_modules_set_updated_at
  BEFORE UPDATE ON course_modules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE course_topics (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  module_id     BIGINT       NOT NULL REFERENCES course_modules (id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  display_order INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT course_topics_title_present       CHECK (btrim(title) <> ''),
  CONSTRAINT course_topics_description_length  CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT course_topics_display_order_valid CHECK (display_order >= 0)
);

CREATE INDEX course_topics_module_order_idx ON course_topics (module_id, display_order, id);

CREATE TRIGGER course_topics_set_updated_at
  BEFORE UPDATE ON course_topics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- course_trainers
--
-- A course may have several trainers. The application only assigns users
-- whose role is 'trainer', and trainer access is checked against this table.
-- ---------------------------------------------------------------------------
CREATE TABLE course_trainers (
  course_id  BIGINT NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  trainer_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  CONSTRAINT course_trainers_pkey PRIMARY KEY (course_id, trainer_id)
);

CREATE INDEX course_trainers_trainer_idx ON course_trainers (trainer_id);

-- ---------------------------------------------------------------------------
-- enrolments
--
-- One enrolment per student per course. A course with enrolments cannot be
-- deleted (RESTRICT); archive it instead. status becomes 'completed' when the
-- student has completed every topic.
-- ---------------------------------------------------------------------------
CREATE TABLE enrolments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id   BIGINT      NOT NULL REFERENCES courses (id) ON DELETE RESTRICT,
  student_id  BIGINT      NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT enrolments_student_course_key UNIQUE (student_id, course_id),
  CONSTRAINT enrolments_status_valid       CHECK (status IN ('active', 'completed'))
);

-- enrolments_student_course_key serves lookups by student.
CREATE INDEX enrolments_course_idx ON enrolments (course_id);

-- ---------------------------------------------------------------------------
-- topic_progress
--
-- One row per student per topic, written when the topic is completed.
-- ---------------------------------------------------------------------------
CREATE TABLE topic_progress (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id   BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  topic_id     BIGINT      NOT NULL REFERENCES course_topics (id) ON DELETE CASCADE,
  completed    BOOLEAN     NOT NULL DEFAULT TRUE,
  completed_at TIMESTAMPTZ,

  CONSTRAINT topic_progress_student_topic_key UNIQUE (student_id, topic_id),
  CONSTRAINT topic_progress_completed_at      CHECK (completed = (completed_at IS NOT NULL))
);

CREATE INDEX topic_progress_topic_idx ON topic_progress (topic_id);

-- ---------------------------------------------------------------------------
-- classes
--
-- Scheduled live classes. meeting_link is a plain URL (no Zoom / Meet
-- integration). The application requires trainer_id to be a trainer assigned
-- to the course when the class is created or its course/trainer changes.
-- ---------------------------------------------------------------------------
CREATE TABLE classes (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id    BIGINT       NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  trainer_id   BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  title        VARCHAR(200) NOT NULL,
  scheduled_at TIMESTAMPTZ  NOT NULL,
  meeting_link TEXT,
  status       VARCHAR(20)  NOT NULL DEFAULT 'scheduled',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT classes_title_present      CHECK (btrim(title) <> ''),
  CONSTRAINT classes_meeting_link_format CHECK (meeting_link IS NULL OR meeting_link ~* '^https?://[^[:space:]]+$'),
  CONSTRAINT classes_status_valid       CHECK (status IN ('scheduled', 'completed', 'cancelled'))
);

CREATE INDEX classes_course_scheduled_idx ON classes (course_id, scheduled_at);
CREATE INDEX classes_trainer_idx ON classes (trainer_id);

CREATE TRIGGER classes_set_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
