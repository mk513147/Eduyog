-- Eduyarp DEMO CATALOGUE – development / demonstration databases only.
-- Never run against production.
--
-- Temporary Phase 1 demo courses. These can be removed/replaced by the
-- company through Admin after handover.
--
-- Run after the schema files (003 and later):
--   psql -h localhost -U <db_user> -d <dev_db> -f database/seed/eduyarp_demo_catalog.sql
--
-- Adds four PUBLISHED courses: Data Science, Artificial Intelligence, Prompt
-- Engineering and Software Development, each with one module and three topics.
-- They are ordinary course records, managed in Admin > Eduyarp like any other.
--
-- Safe to run more than once: a course is created only if its slug does not
-- exist yet, and modules/topics are added only for courses created by this run.
-- Existing course rows (including the ones from eduyarp_demo.sql) are never changed.
-- Course Admin edits are therefore never overwritten by a re-run.
--
-- Sample videos: after the courses exist, the final statement sets each demo
-- topic's video_url (see below). It also works on a database where the four
-- courses were loaded earlier by a previous version of this file.
--
-- Deliberately not included: trainers (assign them in Admin), classes, fees
-- (Free), durations, learning objectives, and any claims about jobs, salaries or
-- certificates. Replace the copy and the videos in Admin when the company is ready.

BEGIN;

WITH new_courses AS (
  INSERT INTO courses (title, slug, description, level, fee, status)
  VALUES
    ('Data Science', 'data-science',
     'Build practical foundations in data analysis, statistics and working with data.',
     'beginner', 0, 'published'),
    ('Artificial Intelligence', 'artificial-intelligence',
     'Explore the foundations of artificial intelligence and modern AI concepts.',
     'beginner', 0, 'published'),
    ('Prompt Engineering', 'prompt-engineering',
     'Learn how to design effective prompts and work more effectively with modern AI tools.',
     'beginner', 0, 'published'),
    ('Software Development', 'software-development',
     'Build strong foundations in programming and modern software development practices.',
     'beginner', 0, 'published')
  ON CONFLICT (slug) DO NOTHING
  RETURNING id, slug
),
new_modules AS (
  INSERT INTO course_modules (course_id, display_order, title)
  SELECT c.id, 1, m.title
  FROM new_courses c
  JOIN (VALUES
    ('data-science', 'Data Science Fundamentals'),
    ('artificial-intelligence', 'AI Fundamentals'),
    ('prompt-engineering', 'Prompt Engineering Fundamentals'),
    ('software-development', 'Software Development Fundamentals')
  ) AS m (slug, title) ON m.slug = c.slug
  RETURNING id, course_id
)
INSERT INTO course_topics (module_id, display_order, title)
SELECT nm.id, t.display_order, t.title
FROM new_modules nm
JOIN new_courses c ON c.id = nm.course_id
JOIN (VALUES
  ('data-science', 1, 'Introduction to Data Science'),
  ('data-science', 2, 'Understanding Data'),
  ('data-science', 3, 'Data Analysis Fundamentals'),
  ('artificial-intelligence', 1, 'Introduction to Artificial Intelligence'),
  ('artificial-intelligence', 2, 'Understanding Machine Learning'),
  ('artificial-intelligence', 3, 'AI in the Real World'),
  ('prompt-engineering', 1, 'Introduction to Prompt Engineering'),
  ('prompt-engineering', 2, 'Writing Effective Prompts'),
  ('prompt-engineering', 3, 'Improving AI Responses'),
  ('software-development', 1, 'Programming Fundamentals'),
  ('software-development', 2, 'Understanding Software Development'),
  ('software-development', 3, 'Building Your First Project')
) AS t (slug, display_order, title) ON t.slug = c.slug;

-- ---------------------------------------------------------------------------
-- Sample YouTube videos (temporary demo content).
--
-- These are third-party, publicly available videos from their original
-- creators, referenced only by URL and still hosted on YouTube. Eduyog does not
-- own or endorse them; replace them with the company's own content.
--
-- Safe on an existing database: only the 12 demo topics are targeted (matched
-- by course slug + topic title, so similarly named topics in other courses are
-- never touched), and only when the topic has no video yet, so a video set by an
-- Admin is never overwritten. Courses, enrolments and progress are not changed.
-- ---------------------------------------------------------------------------
UPDATE course_topics t
SET video_url = v.video_url
FROM (VALUES
  ('data-science', 'Introduction to Data Science',
     'https://www.youtube.com/watch?v=CMEWVn1uZpQ'),  -- Learn Python for Data Science – Full Course for Beginners (freeCodeCamp.org)
  ('data-science', 'Understanding Data',
     'https://www.youtube.com/watch?v=CMEWVn1uZpQ'),
  ('data-science', 'Data Analysis Fundamentals',
     'https://www.youtube.com/watch?v=NZedo3QRML8'),  -- What is Machine Learning? [Part 1] (Great Learning)
  ('artificial-intelligence', 'Introduction to Artificial Intelligence',
     'https://www.youtube.com/watch?v=9tbaiFIm0HU'),  -- Artificial Intelligence Full Course (2025) | AI Course For Beginners (Intellipaat)
  ('artificial-intelligence', 'Understanding Machine Learning',
     'https://www.youtube.com/watch?v=NZedo3QRML8'),
  ('artificial-intelligence', 'AI in the Real World',
     'https://www.youtube.com/watch?v=SY0_i6Jyhuw'),  -- Neural Network for Beginners | From Zero to Understanding Deep Learning (Coder Army)
  ('prompt-engineering', 'Introduction to Prompt Engineering',
     'https://www.youtube.com/watch?v=_ZvnD73m40o'),  -- Prompt Engineering Tutorial – Master ChatGPT and LLM Responses (freeCodeCamp.org)
  ('prompt-engineering', 'Writing Effective Prompts',
     'https://www.youtube.com/watch?v=_ZvnD73m40o'),
  ('prompt-engineering', 'Improving AI Responses',
     'https://www.youtube.com/watch?v=_ZvnD73m40o'),
  ('software-development', 'Programming Fundamentals',
     'https://www.youtube.com/watch?v=l1Kbw2XtfHo'),  -- Master Software Development: Full Course for Beginners (Pataki Academy)
  ('software-development', 'Understanding Software Development',
     'https://www.youtube.com/watch?v=l1Kbw2XtfHo'),
  ('software-development', 'Building Your First Project',
     'https://www.youtube.com/watch?v=l1Kbw2XtfHo')
) AS v (slug, topic_title, video_url)
JOIN courses c ON c.slug = v.slug
JOIN course_modules m ON m.course_id = c.id
WHERE t.module_id = m.id
  AND t.title = v.topic_title
  AND t.video_url IS NULL;

COMMIT;
