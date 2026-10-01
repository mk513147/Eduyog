-- Eduyog Phase 1 – Eduyarp enrolment cancellation
-- Target: PostgreSQL 13+
--
-- Run once, after 003_eduyarp.sql. Like the earlier files, statements are not
-- "IF NOT EXISTS" so a second run fails loudly. The whole file runs in one
-- transaction.
--
-- When an Admin changes a Student to Trainer or Admin, the application sets
-- that user's active enrolments to 'cancelled'. Cancelled enrolments are kept
-- as history (with their topic_progress) and give no course access.

BEGIN;

-- Allow 'cancelled'. Existing rows are all 'active' or 'completed'.
ALTER TABLE enrolments
  DROP CONSTRAINT enrolments_status_valid,
  ADD CONSTRAINT enrolments_status_valid CHECK (status IN ('active', 'completed', 'cancelled'));

-- One active or completed enrolment per student per course; any number of
-- cancelled ones, so a student can enrol again after a cancellation.
-- The index keeps the old constraint's name, which the application uses to
-- recognise a duplicate enrolment. Existing rows are unique already.
ALTER TABLE enrolments DROP CONSTRAINT enrolments_student_course_key;

CREATE UNIQUE INDEX enrolments_student_course_key
  ON enrolments (student_id, course_id)
  WHERE status IN ('active', 'completed');

-- The partial index only covers current enrolments; lookups and the role
-- change update by student need a full index.
CREATE INDEX enrolments_student_idx ON enrolments (student_id);

COMMIT;
