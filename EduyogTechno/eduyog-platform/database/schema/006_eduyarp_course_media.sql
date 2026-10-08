-- Eduyog Phase 1.2 – Eduyarp course media
-- Target: PostgreSQL 13+
--
-- Run once, after 005_eduyarp_topic_video.sql. Like the earlier files,
-- statements are not "IF NOT EXISTS" so a second run fails loudly. The whole
-- file runs in one transaction.
--
-- A course may have an optional cover image and an optional icon, both stored
-- as externally hosted http(s) URLs. There is no file upload or media storage.
-- Existing courses keep NULL in both columns, and the applications then fall
-- back to their default course visual and icon. The application validates the
-- URLs; the constraints here are a second line of defence.

BEGIN;

ALTER TABLE courses
  ADD COLUMN cover_image_url TEXT,
  ADD COLUMN icon_url        TEXT,
  ADD CONSTRAINT courses_cover_image_url_valid
    CHECK (cover_image_url IS NULL
           OR (length(cover_image_url) <= 2048 AND cover_image_url ~* '^https?://[^[:space:]]+$')),
  ADD CONSTRAINT courses_icon_url_valid
    CHECK (icon_url IS NULL
           OR (length(icon_url) <= 2048 AND icon_url ~* '^https?://[^[:space:]]+$'));

COMMIT;
