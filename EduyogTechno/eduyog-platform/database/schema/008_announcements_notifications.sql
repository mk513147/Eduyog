-- Eduyog Enhanced Phase 1 – announcements and in-app notifications
-- Target: PostgreSQL 13+
--
-- Run once, after 007_account_profiles.sql. Like the earlier files, statements
-- are not "IF NOT EXISTS" so a second run fails loudly. The whole file runs in
-- one transaction.
--
-- announcements: a message from an Admin or a Trainer. course_id NULL means a
-- platform-wide announcement (Admin only; enforced by the application). A course
-- announcement is removed with its course. author_id is RESTRICT so announcement
-- history is never silently lost when an account is removed.
--
-- notifications: one row per recipient (never a shared "broadcast" row). The
-- type is only format-checked here so new types can be added in application code
-- without a migration; the application keeps the list of known types. link_path
-- is an internal application path only (never an absolute or external URL).

BEGIN;

CREATE TABLE announcements (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id  BIGINT       REFERENCES courses (id) ON DELETE CASCADE,
  author_id  BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  title      VARCHAR(200) NOT NULL,
  body       TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT announcements_title_present CHECK (btrim(title) <> ''),
  CONSTRAINT announcements_body_present  CHECK (btrim(body) <> ''),
  CONSTRAINT announcements_body_length   CHECK (length(body) <= 3000)
);

CREATE INDEX announcements_course_created_idx ON announcements (course_id, created_at DESC);

CREATE TABLE notifications (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type         VARCHAR(50)  NOT NULL,
  title        VARCHAR(200) NOT NULL,
  body         VARCHAR(500),
  link_path    VARCHAR(255),
  course_id    BIGINT       REFERENCES courses (id) ON DELETE CASCADE,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT notifications_type_format  CHECK (type ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT notifications_title_present CHECK (btrim(title) <> ''),
  -- Internal path only: starts with a single "/", no scheme, no backslash, no whitespace.
  CONSTRAINT notifications_link_path_valid
    CHECK (link_path IS NULL OR (link_path ~ '^/[A-Za-z0-9._~%/?#=&-]*$' AND link_path !~ '^//'))
);

CREATE INDEX notifications_recipient_created_idx ON notifications (recipient_id, created_at DESC, id DESC);
CREATE INDEX notifications_recipient_unread_idx ON notifications (recipient_id) WHERE read_at IS NULL;
-- Serves the cascade when a course is deleted.
CREATE INDEX notifications_course_idx ON notifications (course_id) WHERE course_id IS NOT NULL;

COMMIT;
