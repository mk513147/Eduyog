-- Eduyog Enhanced Phase 1 – assignments, text/URL submissions and written feedback
-- Target: PostgreSQL 13+
--
-- Run once, after 009_course_content.sql. Like the earlier files, statements are
-- not "IF NOT EXISTS" so a second run fails loudly. The whole file runs in one
-- transaction.
--
-- assignments: a course activity written by an Admin or an assigned Trainer.
--   status: draft (staff only), published (students can see and submit),
--   closed (students can still read it, no new submissions).
--   A module or topic link must belong to the assignment's own course (trigger).
--   Deleting a module or topic only clears the link; the assignment and its
--   submissions stay. Deleting a course deletes its assignments, and with them
--   their submissions and feedback (no orphans).
--
-- assignment_submissions: text and/or an http(s) link. No files. A student may
--   submit many times: each submission is its own row (no unique pair), and the
--   latest one is the current one. is_late is set by the database from the
--   assignment's due date at insert time and cannot be supplied by a client.
--
-- assignment_feedback: one current written comment per submission (no grades).

BEGIN;

CREATE TABLE assignments (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id     BIGINT       NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  module_id     BIGINT       REFERENCES course_modules (id) ON DELETE SET NULL,
  topic_id      BIGINT       REFERENCES course_topics (id) ON DELETE SET NULL,
  title         VARCHAR(200) NOT NULL,
  instructions  TEXT         NOT NULL,
  due_at        TIMESTAMPTZ,
  status        VARCHAR(20)  NOT NULL DEFAULT 'draft',
  display_order INTEGER      NOT NULL DEFAULT 0,
  created_by    BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT assignments_title_present        CHECK (btrim(title) <> ''),
  CONSTRAINT assignments_instructions_present CHECK (btrim(instructions) <> ''),
  CONSTRAINT assignments_instructions_length  CHECK (length(instructions) <= 5000),
  CONSTRAINT assignments_status_valid         CHECK (status IN ('draft', 'published', 'closed')),
  CONSTRAINT assignments_display_order_valid  CHECK (display_order >= 0)
);

CREATE INDEX assignments_course_order_idx  ON assignments (course_id, display_order, id);
CREATE INDEX assignments_course_status_idx ON assignments (course_id, status);

CREATE TRIGGER assignments_set_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION assignments_check_links() RETURNS trigger AS $$
DECLARE
  topic_module BIGINT;
  topic_course BIGINT;
  module_course BIGINT;
BEGIN
  IF NEW.topic_id IS NOT NULL THEN
    SELECT t.module_id, m.course_id INTO topic_module, topic_course
    FROM course_topics t JOIN course_modules m ON m.id = t.module_id
    WHERE t.id = NEW.topic_id;
    IF topic_course IS DISTINCT FROM NEW.course_id THEN
      RAISE EXCEPTION 'Topic does not belong to the assignment course' USING ERRCODE = '23514';
    END IF;
    IF NEW.module_id IS NULL THEN
      NEW.module_id := topic_module;
    ELSIF NEW.module_id <> topic_module THEN
      RAISE EXCEPTION 'Topic does not belong to the assignment module' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.module_id IS NOT NULL THEN
    SELECT course_id INTO module_course FROM course_modules WHERE id = NEW.module_id;
    IF module_course IS DISTINCT FROM NEW.course_id THEN
      RAISE EXCEPTION 'Module does not belong to the assignment course' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Checked on insert, and on update only when a link is set to a new non-null value or the
-- course changes; the "set null" done when a module or topic is deleted is not re-checked.
CREATE TRIGGER assignments_check_links_insert
  BEFORE INSERT ON assignments
  FOR EACH ROW EXECUTE FUNCTION assignments_check_links();

CREATE TRIGGER assignments_check_links_update
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  WHEN (NEW.course_id IS DISTINCT FROM OLD.course_id
        OR (NEW.module_id IS NOT NULL AND NEW.module_id IS DISTINCT FROM OLD.module_id)
        OR (NEW.topic_id IS NOT NULL AND NEW.topic_id IS DISTINCT FROM OLD.topic_id))
  EXECUTE FUNCTION assignments_check_links();

CREATE TABLE assignment_submissions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id BIGINT        NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  student_id    BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  text_content  TEXT,
  submission_url VARCHAR(2048),
  submitted_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  is_late       BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT assignment_submissions_text_not_blank   CHECK (text_content IS NULL OR btrim(text_content) <> ''),
  CONSTRAINT assignment_submissions_text_length      CHECK (text_content IS NULL OR length(text_content) <= 5000),
  -- http(s) only, with a host and no whitespace (javascript:, data:, file: and the like fail).
  CONSTRAINT assignment_submissions_url_valid
    CHECK (submission_url IS NULL OR submission_url ~* '^https?://[^[:space:]/?#]+[^[:space:]]*$'),
  CONSTRAINT assignment_submissions_has_content      CHECK (text_content IS NOT NULL OR submission_url IS NOT NULL)
);

-- A student's history for an assignment, newest first (the first row is the current one).
CREATE INDEX assignment_submissions_history_idx
  ON assignment_submissions (assignment_id, student_id, submitted_at DESC, id DESC);

CREATE TRIGGER assignment_submissions_set_updated_at
  BEFORE UPDATE ON assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Lateness comes from the due date, never from the client: late means submitted after due_at.
CREATE FUNCTION assignment_submissions_set_late() RETURNS trigger AS $$
DECLARE
  due TIMESTAMPTZ;
BEGIN
  SELECT due_at INTO due FROM assignments WHERE id = NEW.assignment_id;
  NEW.is_late := due IS NOT NULL AND NEW.submitted_at > due;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assignment_submissions_set_late
  BEFORE INSERT ON assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION assignment_submissions_set_late();

CREATE TABLE assignment_feedback (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id BIGINT       NOT NULL REFERENCES assignment_submissions (id) ON DELETE CASCADE,
  author_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  feedback_text TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- One current feedback per submission; updating replaces the text. No scores or grades.
  CONSTRAINT assignment_feedback_submission_key  UNIQUE (submission_id),
  CONSTRAINT assignment_feedback_text_present    CHECK (btrim(feedback_text) <> ''),
  CONSTRAINT assignment_feedback_text_length     CHECK (length(feedback_text) <= 3000)
);

CREATE TRIGGER assignment_feedback_set_updated_at
  BEFORE UPDATE ON assignment_feedback
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
