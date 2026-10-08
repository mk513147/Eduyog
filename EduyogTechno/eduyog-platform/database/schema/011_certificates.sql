-- Eduyog Enhanced Phase 1 – course completion certificates
-- Target: PostgreSQL 13+ (gen_random_uuid() is built in from 13)
--
-- Run once, after 010_assignments.sql. Like the earlier files, statements are not
-- "IF NOT EXISTS" so a second run fails loudly. The whole file runs in one
-- transaction. This is the last migration of the enhanced Phase 1.
--
-- A certificate is a historical issuance record, written by the application when a
-- student's enrolment becomes 'completed' (every topic done). It is never edited
-- after issuance and never deleted:
--   * student_name and course_title are copies taken at issuance, so later renames
--     of the course or the student do not change an issued certificate;
--   * certificate_number is generated here, is random (not an id), and is unique;
--   * (student_id, course_id) is unique, so there is at most one certificate per
--     student and course, however often completion is re-evaluated or the student
--     re-enrols;
--   * only the status can change, from 'active' to 'revoked', with who, when and why.
-- Existing completed enrolments are NOT given certificates by this migration.

BEGIN;

CREATE TABLE certificates (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Example: EDUYOG-2026-3F9A1C07B2. The year is the issue year (UTC); the rest is random.
  certificate_number VARCHAR(40)  NOT NULL
    DEFAULT ('EDUYOG-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-'
             || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  student_id         BIGINT       NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  course_id          BIGINT       NOT NULL REFERENCES courses (id) ON DELETE RESTRICT,
  student_name       VARCHAR(150) NOT NULL,
  course_title       VARCHAR(200) NOT NULL,
  issued_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  status             VARCHAR(20)  NOT NULL DEFAULT 'active',
  revoked_at         TIMESTAMPTZ,
  revoked_by         BIGINT       REFERENCES users (id) ON DELETE RESTRICT,
  revocation_reason  VARCHAR(500),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT certificates_number_key           UNIQUE (certificate_number),
  CONSTRAINT certificates_student_course_key   UNIQUE (student_id, course_id),
  CONSTRAINT certificates_number_format        CHECK (certificate_number ~ '^[A-Z0-9][A-Z0-9-]{5,39}$'),
  CONSTRAINT certificates_student_name_present CHECK (btrim(student_name) <> ''),
  CONSTRAINT certificates_course_title_present CHECK (btrim(course_title) <> ''),
  CONSTRAINT certificates_status_valid         CHECK (status IN ('active', 'revoked')),
  -- An active certificate has no revocation data; a revoked one has all of it.
  CONSTRAINT certificates_revocation_consistent CHECK (
    (status = 'active' AND revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL)
    OR
    (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL
       AND revocation_reason IS NOT NULL AND btrim(revocation_reason) <> '')
  )
);

CREATE INDEX certificates_student_issued_idx ON certificates (student_id, issued_at DESC, id DESC);
CREATE INDEX certificates_course_issued_idx  ON certificates (course_id, issued_at DESC);
CREATE INDEX certificates_issued_idx         ON certificates (issued_at DESC, id DESC);

CREATE TRIGGER certificates_set_updated_at
  BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Integrity: the issued facts never change, and a revoked certificate stays revoked.
CREATE FUNCTION certificates_protect() RETURNS trigger AS $$
BEGIN
  IF NEW.certificate_number IS DISTINCT FROM OLD.certificate_number
     OR NEW.student_id      IS DISTINCT FROM OLD.student_id
     OR NEW.course_id       IS DISTINCT FROM OLD.course_id
     OR NEW.student_name    IS DISTINCT FROM OLD.student_name
     OR NEW.course_title    IS DISTINCT FROM OLD.course_title
     OR NEW.issued_at       IS DISTINCT FROM OLD.issued_at THEN
    RAISE EXCEPTION 'An issued certificate cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'revoked' AND (NEW.status IS DISTINCT FROM OLD.status
     OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
     OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by
     OR NEW.revocation_reason IS DISTINCT FROM OLD.revocation_reason) THEN
    RAISE EXCEPTION 'A revoked certificate cannot be changed or restored' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER certificates_protect
  BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION certificates_protect();

COMMIT;
