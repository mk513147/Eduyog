-- Eduyog Enhanced Phase 1 – course FAQs and URL-based learning resources
-- Target: PostgreSQL 13+
--
-- Run once, after 008_announcements_notifications.sql. Like the earlier files,
-- statements are not "IF NOT EXISTS" so a second run fails loudly. The whole
-- file runs in one transaction.
--
-- course_faqs: questions and answers shown to a course's students. Ordered by
-- display_order, then id.
--
-- course_resources: links (no uploads) that belong to one course and may be tied
-- to one of its modules and/or topics. Only http(s) addresses are accepted. A
-- trigger keeps the links consistent: a module or topic must belong to the
-- resource's own course, and a topic's module is the resource's module.
--
-- Both tables are removed with their course. Deleting a module or topic also
-- deletes the resources tied to it (they were that module's or topic's material).

BEGIN;

CREATE TABLE course_faqs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id     BIGINT       NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  question      VARCHAR(500) NOT NULL,
  answer        TEXT         NOT NULL,
  display_order INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT course_faqs_question_present       CHECK (btrim(question) <> ''),
  CONSTRAINT course_faqs_answer_present         CHECK (btrim(answer) <> ''),
  CONSTRAINT course_faqs_answer_length          CHECK (length(answer) <= 3000),
  CONSTRAINT course_faqs_display_order_valid    CHECK (display_order >= 0)
);

CREATE INDEX course_faqs_course_order_idx ON course_faqs (course_id, display_order, id);

CREATE TRIGGER course_faqs_set_updated_at
  BEFORE UPDATE ON course_faqs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE course_resources (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id     BIGINT        NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  module_id     BIGINT        REFERENCES course_modules (id) ON DELETE CASCADE,
  topic_id      BIGINT        REFERENCES course_topics (id) ON DELETE CASCADE,
  title         VARCHAR(200)  NOT NULL,
  description   VARCHAR(1000),
  resource_type VARCHAR(20)   NOT NULL,
  url           VARCHAR(2048) NOT NULL,
  display_order INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT course_resources_title_present    CHECK (btrim(title) <> ''),
  CONSTRAINT course_resources_type_valid
    CHECK (resource_type IN ('video', 'pdf', 'document', 'presentation', 'external')),
  -- http(s) only, with a host and no whitespace (javascript:, data:, file: and the like fail).
  CONSTRAINT course_resources_url_valid        CHECK (url ~* '^https?://[^[:space:]/?#]+[^[:space:]]*$'),
  CONSTRAINT course_resources_display_order_valid CHECK (display_order >= 0)
);

CREATE INDEX course_resources_course_order_idx ON course_resources (course_id, display_order, id);
CREATE INDEX course_resources_module_idx ON course_resources (module_id) WHERE module_id IS NOT NULL;
CREATE INDEX course_resources_topic_idx ON course_resources (topic_id) WHERE topic_id IS NOT NULL;

CREATE TRIGGER course_resources_set_updated_at
  BEFORE UPDATE ON course_resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION course_resources_check_links() RETURNS trigger AS $$
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
      RAISE EXCEPTION 'Topic does not belong to the resource course' USING ERRCODE = '23514';
    END IF;
    IF NEW.module_id IS NULL THEN
      NEW.module_id := topic_module;
    ELSIF NEW.module_id <> topic_module THEN
      RAISE EXCEPTION 'Topic does not belong to the resource module' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.module_id IS NOT NULL THEN
    SELECT course_id INTO module_course FROM course_modules WHERE id = NEW.module_id;
    IF module_course IS DISTINCT FROM NEW.course_id THEN
      RAISE EXCEPTION 'Module does not belong to the resource course' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER course_resources_check_links
  BEFORE INSERT OR UPDATE OF course_id, module_id, topic_id ON course_resources
  FOR EACH ROW EXECUTE FUNCTION course_resources_check_links();

COMMIT;
