-- Eduyog Enhanced Phase 2 – student account approval and Admin-granted course access
-- Target: PostgreSQL 13+
--
-- Run once, after 011_certificates.sql. Like the earlier files, statements are not
-- "IF NOT EXISTS" so a second run fails loudly. The whole file runs in one transaction.
-- It is forward-only and non-destructive: no rows are deleted or rewritten.
--
-- 1. users.approval_status
--    'pending' | 'approved' | 'rejected'. The column DEFAULT is 'approved', so every account that
--    already exists (students, trainers, admins) is back-filled as approved by this statement and
--    nobody is locked out. The application inserts 'pending' explicitly for public registration
--    (it never takes a status or role from the request). The status only gates Students.
--
-- 2. enrolments.granted_by
--    The Admin who granted full-course access. NULL for every existing enrolment (they were
--    self-enrolments). Students can no longer enrol themselves; an Admin grants access, which
--    creates an ordinary 'active' enrolment, and revoking it cancels that enrolment (history and
--    topic progress are kept).
--
-- 3. enrolments_student_active_idx
--    A plain (non-unique) index for the "one active course at a time" check. It is deliberately
--    NOT a unique index: some existing students may already have several active enrolments and
--    must keep them. The rule is enforced by the application on NEW grants, in a transaction that
--    locks the student's user row, so concurrent grants queue up.

BEGIN;

ALTER TABLE users
  ADD COLUMN approval_status     VARCHAR(20) NOT NULL DEFAULT 'approved',
  ADD COLUMN approval_decided_at TIMESTAMPTZ,
  ADD COLUMN approval_decided_by BIGINT REFERENCES users (id) ON DELETE RESTRICT,
  ADD COLUMN approval_reason     VARCHAR(500),
  ADD CONSTRAINT users_approval_status_valid CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD CONSTRAINT users_approval_reason_length CHECK (approval_reason IS NULL OR char_length(approval_reason) <= 500);

CREATE INDEX users_approval_pending_idx ON users (created_at, id) WHERE approval_status = 'pending';

ALTER TABLE enrolments
  ADD COLUMN granted_by BIGINT REFERENCES users (id) ON DELETE RESTRICT;

CREATE INDEX enrolments_student_active_idx ON enrolments (student_id) WHERE status = 'active';

COMMIT;
