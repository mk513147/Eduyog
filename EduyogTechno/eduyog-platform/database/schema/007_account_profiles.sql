-- Eduyog Enhanced Phase 1 – account profiles and password-change tracking
-- Target: PostgreSQL 13+
--
-- Run once, after 006_eduyarp_course_media.sql. Like the earlier files,
-- statements are not "IF NOT EXISTS" so a second run fails loudly. The whole
-- file runs in one transaction.
--
-- user_profiles holds optional account details for any user (Student, Trainer
-- or Admin). It is one-to-one with users and a row is created the first time a
-- user saves their profile. users.full_name stays the authoritative display name
-- and users.email / users.role are never stored here.
--
-- users.password_changed_at records when a user last changed their password.
-- It is NULL for every existing user, so no existing session is affected. The
-- API rejects access tokens issued before this moment.

BEGIN;

CREATE TABLE user_profiles (
  user_id         BIGINT       PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  phone           VARCHAR(30),
  institution     VARCHAR(200),
  study_level     VARCHAR(20),
  field_of_study  VARCHAR(150),
  graduation_year SMALLINT,
  bio             VARCHAR(1000),
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT user_profiles_study_level_valid
    CHECK (study_level IS NULL
           OR study_level IN ('school', 'diploma', 'undergraduate', 'postgraduate', 'phd', 'other')),
  CONSTRAINT user_profiles_graduation_year_valid
    CHECK (graduation_year IS NULL OR graduation_year BETWEEN 1950 AND 2100),
  -- Same shape as the Fitness lead phone rule: digits with optional + ( ) . - and spaces.
  CONSTRAINT user_profiles_phone_valid
    CHECK (phone IS NULL OR phone ~ '^\+?[0-9 ().-]+$'),
  CONSTRAINT user_profiles_avatar_url_valid
    CHECK (avatar_url IS NULL
           OR (length(avatar_url) <= 2048 AND avatar_url ~* '^https?://[^[:space:]]+$'))
);

CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;

COMMIT;
