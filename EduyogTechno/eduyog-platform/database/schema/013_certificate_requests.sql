-- Eduyog Enhanced Phase 2 – Admin-approved certificates
-- Target: PostgreSQL 13+
--
-- Run once, after 012_student_approval_and_course_access.sql. Statements are not "IF NOT EXISTS" so a
-- second run fails loudly. The whole file runs in one transaction. Forward-only and non-destructive:
-- the certificates table and every existing certificate are untouched.
--
-- Completing a course now creates a certificate REQUEST (status 'pending'); only an Admin approving
-- it creates the certificate (in certificates, exactly as before, so all existing certificate
-- screens, numbers and snapshots keep working). Requests are history: they are never deleted, a
-- decided request never changes, and a rejected request can be followed by a new one.
--   * at most ONE pending request per (student, course)   -> partial unique index
--   * an approved request points at its certificate        -> unique certificate_id
--   * existing certificates and legacy completed enrolments get NO request from this migration.

BEGIN;

CREATE TABLE certificate_requests (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id      BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  course_id       BIGINT       NOT NULL REFERENCES courses (id) ON DELETE RESTRICT,
  enrolment_id    BIGINT       REFERENCES enrolments (id) ON DELETE SET NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  requested_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ,
  decided_by      BIGINT       REFERENCES users (id) ON DELETE RESTRICT,
  decision_reason VARCHAR(500),
  certificate_id  BIGINT       REFERENCES certificates (id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT certificate_requests_status_valid CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT certificate_requests_reason_length CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 500),
  CONSTRAINT certificate_requests_state_consistent CHECK (
    (status = 'pending'  AND decided_at IS NULL AND decided_by IS NULL AND certificate_id IS NULL)
    OR
    (status = 'approved' AND decided_at IS NOT NULL AND decided_by IS NOT NULL AND certificate_id IS NOT NULL)
    OR
    (status = 'rejected' AND decided_at IS NOT NULL AND decided_by IS NOT NULL AND certificate_id IS NULL)
  )
);

CREATE UNIQUE INDEX certificate_requests_one_pending_key
  ON certificate_requests (student_id, course_id) WHERE status = 'pending';
CREATE UNIQUE INDEX certificate_requests_certificate_key
  ON certificate_requests (certificate_id) WHERE certificate_id IS NOT NULL;
CREATE INDEX certificate_requests_student_idx ON certificate_requests (student_id, requested_at DESC, id DESC);
CREATE INDEX certificate_requests_status_idx  ON certificate_requests (status, requested_at DESC, id DESC);

CREATE TRIGGER certificate_requests_set_updated_at
  BEFORE UPDATE ON certificate_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Integrity: who and what a request is about never changes, and a decided request is final.
CREATE FUNCTION certificate_requests_protect() RETURNS trigger AS $$
BEGIN
  IF NEW.student_id   IS DISTINCT FROM OLD.student_id
     OR NEW.course_id    IS DISTINCT FROM OLD.course_id
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
    RAISE EXCEPTION 'A certificate request cannot be re-assigned' USING ERRCODE = '23514';
  END IF;
  IF OLD.status <> 'pending' AND (NEW.status IS DISTINCT FROM OLD.status
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
     OR NEW.decision_reason IS DISTINCT FROM OLD.decision_reason
     OR NEW.certificate_id IS DISTINCT FROM OLD.certificate_id) THEN
    RAISE EXCEPTION 'A decided certificate request cannot be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER certificate_requests_protect
  BEFORE UPDATE ON certificate_requests
  FOR EACH ROW EXECUTE FUNCTION certificate_requests_protect();

COMMIT;
