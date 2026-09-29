-- Eduyog Phase 1 – initial schema
-- Target: PostgreSQL 13+
--
-- Run once against an empty database. Statements are intentionally not
-- "IF NOT EXISTS" so that re-running against an existing schema fails loudly
-- instead of silently skipping changes. The whole file runs in one transaction.

BEGIN;

-- ---------------------------------------------------------------------------
-- Shared: keep updated_at current on every UPDATE.
-- ---------------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users
--
-- Normal registration inserts without a role and receives 'student'.
-- Only an Admin may change role, enforced by the application.
-- Passwords are stored only as a hash produced by the application.
--
-- Last-Admin protection: before deleting or demoting an admin, the
-- application must, in one transaction at the default READ COMMITTED level:
--   1. SELECT id FROM users WHERE role = 'admin' ORDER BY id FOR UPDATE;
--   2. Count the returned rows in the application (FOR UPDATE cannot be
--      combined with COUNT(*)). If the target is among them and it is the
--      only one, refuse and ROLLBACK.
--   3. Otherwise run the UPDATE/DELETE and COMMIT.
-- A concurrent request blocks at step 1 until the first commits, then
-- re-checks role = 'admin' on the locked rows, so it sees the demotion and
-- cannot remove the last admin. ORDER BY id gives every request the same lock
-- order, avoiding deadlocks. The partial index below keeps step 1 cheap.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name     VARCHAR(150) NOT NULL,
  -- Stored normalized (trimmed, lowercase) so the unique constraint is
  -- case-insensitive and lookups can use a plain equality match.
  email         VARCHAR(254) NOT NULL,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'student',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT users_email_key        UNIQUE (email),
  CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email))),
  CONSTRAINT users_email_format     CHECK (email LIKE '_%@_%'),
  CONSTRAINT users_full_name_present CHECK (btrim(full_name) <> ''),
  CONSTRAINT users_password_hash_present CHECK (password_hash <> ''),
  CONSTRAINT users_role_valid       CHECK (role IN ('student', 'admin'))
);

CREATE INDEX users_admin_idx ON users (id) WHERE role = 'admin';

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- platforms
--
-- Phase 1 only supports external website links (no ZIP uploads, no storage).
-- ---------------------------------------------------------------------------
CREATE TABLE platforms (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  description TEXT,
  url         TEXT         NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT platforms_name_key      UNIQUE (name),
  CONSTRAINT platforms_slug_key      UNIQUE (slug),
  CONSTRAINT platforms_name_present  CHECK (btrim(name) <> ''),
  CONSTRAINT platforms_slug_format   CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT platforms_url_format    CHECK (url ~* '^https?://[^[:space:]]+$')
);

CREATE INDEX platforms_active_idx ON platforms (is_active);

CREATE TRIGGER platforms_set_updated_at
  BEFORE UPDATE ON platforms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- services
--
-- Managed by Admin. A service may optionally belong to one platform.
-- A platform that still has services cannot be deleted; deactivate it instead.
-- ---------------------------------------------------------------------------
CREATE TABLE services (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  platform_id BIGINT       REFERENCES platforms (id) ON DELETE RESTRICT,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT services_name_present CHECK (btrim(name) <> '')
);

-- Service names are unique within a platform, case-insensitively.
-- NULLS NOT DISTINCT is PostgreSQL 15+, so services without a platform are
-- covered by a separate partial index to stay compatible with 13+.
-- services_platform_name_key also serves platform_id lookups, including the
-- foreign-key check when a platform is deleted, so no separate index is needed.
CREATE UNIQUE INDEX services_platform_name_key
  ON services (platform_id, lower(name))
  WHERE platform_id IS NOT NULL;

CREATE UNIQUE INDEX services_unassigned_name_key
  ON services (lower(name))
  WHERE platform_id IS NULL;

CREATE TRIGGER services_set_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- fitness_leads
--
-- Fitness B2B enquiries submitted from the public Fitness site.
-- Submitted by visitors without an account, so there is no user reference.
-- ---------------------------------------------------------------------------
CREATE TABLE fitness_leads (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_name VARCHAR(200) NOT NULL,
  contact_name  VARCHAR(150) NOT NULL,
  email         VARCHAR(254) NOT NULL,
  phone         VARCHAR(30),
  message       TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT fitness_leads_business_name_present CHECK (btrim(business_name) <> ''),
  CONSTRAINT fitness_leads_contact_name_present  CHECK (btrim(contact_name) <> ''),
  CONSTRAINT fitness_leads_email_format          CHECK (email LIKE '_%@_%'),
  CONSTRAINT fitness_leads_message_length        CHECK (message IS NULL OR length(message) <= 5000)
);

CREATE INDEX fitness_leads_created_at_idx ON fitness_leads (created_at DESC);

COMMIT;
