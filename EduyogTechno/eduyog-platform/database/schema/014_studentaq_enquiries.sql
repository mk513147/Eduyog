-- Eduyog – StudentAQ enquiry form submissions
-- Target: PostgreSQL 13+
--
-- Prerequisites: 001_initial_schema.sql .. 013_certificate_requests.sql already applied (this file
-- depends on none of their tables, but keep the numeric order). Apply once, manually, after
-- 013_certificate_requests.sql and BEFORE deploying the backend/StudentAQ build that posts to
-- POST /api/studentaq-enquiries (until then that endpoint answers 500 and the form shows its
-- error message). Statements are not "IF NOT EXISTS" so a second run fails loudly. The whole file
-- runs in one transaction. Forward-only and additive: it creates one new table and touches nothing
-- that exists.
--
-- Stores exactly the fields of the StudentAQ enquiry form (contact.html). Visitors have no
-- account, so there is no user reference. Rows are written only by the public endpoint and are
-- not exposed by any read endpoint.

BEGIN;

CREATE TABLE studentaq_enquiries (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name        VARCHAR(100)  NOT NULL,
  email            VARCHAR(254)  NOT NULL,
  phone            VARCHAR(20)   NOT NULL,
  current_country  VARCHAR(50)   NOT NULL,
  status           VARCHAR(50)   NOT NULL,
  target_country   VARCHAR(20)   NOT NULL,
  university       VARCHAR(150),
  course           VARCHAR(150),
  services         TEXT[]        NOT NULL,
  message          VARCHAR(1000),
  consent          BOOLEAN       NOT NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT studentaq_enquiries_full_name_present CHECK (btrim(full_name) <> ''),
  CONSTRAINT studentaq_enquiries_email_format      CHECK (email LIKE '_%@_%.__%'),
  CONSTRAINT studentaq_enquiries_phone_present     CHECK (btrim(phone) <> ''),
  CONSTRAINT studentaq_enquiries_services_present  CHECK (cardinality(services) BETWEEN 1 AND 12),
  CONSTRAINT studentaq_enquiries_consent_given     CHECK (consent)
);

CREATE INDEX studentaq_enquiries_created_at_idx ON studentaq_enquiries (created_at DESC);

COMMIT;
