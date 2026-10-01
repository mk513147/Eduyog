-- Eduyog Phase 1 – additional Fitness lead fields
-- Target: PostgreSQL 13+
--
-- Run once, after 001_initial_schema.sql. Like 001, statements are not
-- "IF NOT EXISTS" so a second run fails loudly. The whole file runs in one
-- transaction.
--
-- All new columns are nullable so existing rows stay valid. The application
-- requires every field except website_links for new submissions.
-- The existing message column holds "Additional Requirements".

BEGIN;

ALTER TABLE fitness_leads
  ADD COLUMN business_type          VARCHAR(100),
  ADD COLUMN location               VARCHAR(200),
  ADD COLUMN services_offered       TEXT,
  ADD COLUMN marketing_requirements TEXT,
  ADD COLUMN website_links          TEXT,
  ADD COLUMN marketing_objectives   TEXT,

  ADD CONSTRAINT fitness_leads_services_offered_length
    CHECK (services_offered IS NULL OR length(services_offered) <= 2000),
  ADD CONSTRAINT fitness_leads_marketing_requirements_length
    CHECK (marketing_requirements IS NULL OR length(marketing_requirements) <= 2000),
  ADD CONSTRAINT fitness_leads_website_links_length
    CHECK (website_links IS NULL OR length(website_links) <= 2000),
  ADD CONSTRAINT fitness_leads_marketing_objectives_length
    CHECK (marketing_objectives IS NULL OR length(marketing_objectives) <= 2000);

COMMIT;
