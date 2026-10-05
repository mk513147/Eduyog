-- Eduyog Phase 1.1 – Eduyarp topic video
-- Target: PostgreSQL 13+
--
-- Run once, after 004_eduyarp_enrolment_status.sql. Like the earlier files,
-- statements are not "IF NOT EXISTS" so a second run fails loudly. The whole
-- file runs in one transaction.
--
-- A topic may have one optional external video (YouTube or Vimeo). Only the
-- validated original URL is stored; the embed URL is derived by the
-- application. The application is the authority on supported providers.

BEGIN;

ALTER TABLE course_topics
  ADD COLUMN video_url TEXT,
  ADD CONSTRAINT course_topics_video_url_length
    CHECK (video_url IS NULL OR length(video_url) <= 2048);

COMMIT;
