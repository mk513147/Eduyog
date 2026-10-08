-- Admin dashboard DEMO DATA – development / demonstration databases only.
-- Never run against production.
--
-- Populates a development database so the Admin dashboard (and the Users,
-- Enrolments, Classes, Trainers and Fitness Leads pages) look realistic.
-- Everything here is fictional: people, businesses, e-mail addresses (reserved
-- ".example" domain) and meeting links. No real personal data, phone numbers
-- or credentials are used.
--
-- Run AFTER the schema files and AFTER eduyarp_demo_catalog.sql (the four demo
-- courses must exist; otherwise the course-related parts are simply skipped):
--   psql -h localhost -U <db_user> -d <dev_db> -f database/seed/admin_dashboard_demo.sql
--
-- What it adds (approximately):
--   5 trainers, 12 students      demo accounts that CANNOT log in (the password
--                                hash is a placeholder no password matches)
--   course-trainer assignments   for the four demo courses
--   13 enrolments + progress     active, completed and one cancelled, with topic
--                                progress consistent with each status
--   6 upcoming classes           valid course/trainer pairs, future dates
--   7 Fitness leads              fictional businesses
--   platforms / services         only the ones that are missing (see below)
-- No Admin account is created: use the Admin you made with backend/scripts/setup-admin.js.
--
-- Safe to run more than once and on a database that already has data:
--   * every insert is skipped when the record already exists;
--   * nothing is updated, deleted or truncated, so existing users, courses,
--     course media, enrolments, progress, platforms and services are untouched;
--   * existing platform URLs are never overwritten.
-- Demo records can be removed through Admin, or by deleting users whose e-mail
-- ends in "@eduyog-demo.example" (their enrolments must be removed first).

BEGIN;

-- ---------------------------------------------------------------------------
-- Users (fictional demo accounts)
-- ---------------------------------------------------------------------------
INSERT INTO users (full_name, email, password_hash, role, created_at)
SELECT d.full_name, d.email, '!demo-account-login-disabled', d.role,
       now() - make_interval(days => d.days_ago) - interval '3 hours'
FROM (VALUES
  ('Asha Verma',     'demo.trainer1@eduyog-demo.example',  'trainer', 40),
  ('Rohan Iyer',     'demo.trainer2@eduyog-demo.example',  'trainer', 38),
  ('Meera Nair',     'demo.trainer3@eduyog-demo.example',  'trainer', 35),
  ('Kabir Sethi',    'demo.trainer4@eduyog-demo.example',  'trainer', 33),
  ('Ishita Bose',    'demo.trainer5@eduyog-demo.example',  'trainer', 30),
  ('Ananya Rao',     'demo.student1@eduyog-demo.example',  'student', 20),
  ('Vikram Shah',    'demo.student2@eduyog-demo.example',  'student', 19),
  ('Neha Kulkarni',  'demo.student3@eduyog-demo.example',  'student', 17),
  ('Arjun Pillai',   'demo.student4@eduyog-demo.example',  'student', 15),
  ('Sana Qureshi',   'demo.student5@eduyog-demo.example',  'student', 14),
  ('Dev Malhotra',   'demo.student6@eduyog-demo.example',  'student', 12),
  ('Tara Joshi',     'demo.student7@eduyog-demo.example',  'student', 10),
  ('Karan Bhatt',    'demo.student8@eduyog-demo.example',  'student', 8),
  ('Pooja Menon',    'demo.student9@eduyog-demo.example',  'student', 6),
  ('Rahul Desai',    'demo.student10@eduyog-demo.example', 'student', 4),
  ('Divya Reddy',    'demo.student11@eduyog-demo.example', 'student', 2),
  ('Sameer Khan',    'demo.student12@eduyog-demo.example', 'student', 1)
) AS d (full_name, email, role, days_ago)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Trainer assignments (only demo trainers, only the four demo courses)
-- ---------------------------------------------------------------------------
INSERT INTO course_trainers (course_id, trainer_id)
SELECT c.id, u.id
FROM (VALUES
  ('data-science',            'demo.trainer1@eduyog-demo.example'),
  ('data-science',            'demo.trainer2@eduyog-demo.example'),
  ('artificial-intelligence', 'demo.trainer3@eduyog-demo.example'),
  ('prompt-engineering',      'demo.trainer4@eduyog-demo.example'),
  ('software-development',    'demo.trainer5@eduyog-demo.example'),
  ('software-development',    'demo.trainer2@eduyog-demo.example')
) AS a (slug, email)
JOIN courses c ON c.slug = a.slug
JOIN users u ON u.email = a.email AND u.role = 'trainer'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Enrolments and topic progress
--
-- done = number of topics completed, taken in course order (99 = every topic,
-- which is what a 'completed' enrolment means). Progress rows are only created
-- for enrolments created by this run, so existing progress is never touched.
-- ---------------------------------------------------------------------------
WITH spec AS (
  SELECT * FROM (VALUES
    ('demo.student1@eduyog-demo.example',  'data-science',            'active',    1,  2),
    ('demo.student2@eduyog-demo.example',  'data-science',            'completed', 99, 12),
    ('demo.student3@eduyog-demo.example',  'artificial-intelligence', 'active',    2,  3),
    ('demo.student4@eduyog-demo.example',  'artificial-intelligence', 'active',    0,  1),
    ('demo.student5@eduyog-demo.example',  'prompt-engineering',      'active',    1,  5),
    ('demo.student6@eduyog-demo.example',  'prompt-engineering',      'completed', 99, 11),
    ('demo.student7@eduyog-demo.example',  'software-development',    'active',    2,  4),
    ('demo.student8@eduyog-demo.example',  'software-development',    'active',    1,  6),
    ('demo.student9@eduyog-demo.example',  'data-science',            'active',    2,  5),
    ('demo.student10@eduyog-demo.example', 'artificial-intelligence', 'completed', 99, 3),
    ('demo.student1@eduyog-demo.example',  'artificial-intelligence', 'active',    1,  1),
    ('demo.student11@eduyog-demo.example', 'software-development',    'cancelled', 1,  2),
    ('demo.student12@eduyog-demo.example', 'prompt-engineering',      'active',    0,  0)
  ) AS v (email, slug, status, done, days_ago)
),
new_enrolments AS (
  INSERT INTO enrolments (course_id, student_id, status, enrolled_at)
  SELECT c.id, u.id, s.status, now() - make_interval(days => s.days_ago) - interval '3 hours'
  FROM spec s
  JOIN users u ON u.email = s.email AND u.role = 'student'
  JOIN courses c ON c.slug = s.slug
  WHERE NOT EXISTS (
    SELECT 1 FROM enrolments e WHERE e.student_id = u.id AND e.course_id = c.id
  )
  RETURNING id, student_id, course_id, enrolled_at
)
INSERT INTO topic_progress (student_id, topic_id, completed, completed_at)
SELECT ne.student_id, t.id, TRUE, ne.enrolled_at + t.rn * interval '30 minutes'
FROM new_enrolments ne
JOIN users u ON u.id = ne.student_id
JOIN courses c ON c.id = ne.course_id
JOIN spec s ON s.email = u.email AND s.slug = c.slug
JOIN LATERAL (
  SELECT x.id, row_number() OVER (ORDER BY m.display_order, m.id, x.display_order, x.id) AS rn
  FROM course_topics x
  JOIN course_modules m ON m.id = x.module_id
  WHERE m.course_id = ne.course_id
) t ON t.rn <= s.done
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Upcoming classes (the trainer must be assigned to the course, like the app requires)
-- Dates are relative to the day the seed runs. Meeting links are fictional.
-- ---------------------------------------------------------------------------
INSERT INTO classes (course_id, trainer_id, title, scheduled_at, meeting_link, status)
SELECT c.id, u.id, k.title,
       date_trunc('day', now()) + make_interval(days => k.days_ahead, hours => k.hour_of_day),
       k.link, 'scheduled'
FROM (VALUES
  ('data-science',            'demo.trainer1@eduyog-demo.example', 'Live Q&A: Working with Data',       1, 10, 'https://meet.example.com/demo-data-science-qa'),
  ('data-science',            'demo.trainer2@eduyog-demo.example', 'Hands-on: Data Analysis Basics',    4, 15, 'https://meet.example.com/demo-data-analysis'),
  ('artificial-intelligence', 'demo.trainer3@eduyog-demo.example', 'Live Session: Machine Learning Basics', 2, 11, 'https://meet.example.com/demo-ml-basics'),
  ('prompt-engineering',      'demo.trainer4@eduyog-demo.example', 'Workshop: Writing Better Prompts',  3, 16, 'https://meet.example.com/demo-prompts'),
  ('software-development',    'demo.trainer5@eduyog-demo.example', 'Live Coding: Your First Project',   5, 14, 'https://meet.example.com/demo-first-project'),
  ('software-development',    'demo.trainer2@eduyog-demo.example', 'Code Review Session',               8, 17, 'https://meet.example.com/demo-code-review')
) AS k (slug, email, title, days_ahead, hour_of_day, link)
JOIN courses c ON c.slug = k.slug
JOIN users u ON u.email = k.email AND u.role = 'trainer'
JOIN course_trainers ct ON ct.course_id = c.id AND ct.trainer_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM classes x WHERE x.course_id = c.id AND x.title = k.title
);

-- ---------------------------------------------------------------------------
-- Fitness leads (fictional businesses; no phone numbers)
-- ---------------------------------------------------------------------------
INSERT INTO fitness_leads (business_name, contact_name, email, business_type, location,
                           services_offered, marketing_requirements, marketing_objectives,
                           message, created_at)
SELECT l.business_name, l.contact_name, l.email, l.business_type, l.location,
       l.services_offered, l.marketing_requirements, l.marketing_objectives,
       'Demo enquiry (development data).',
       now() - make_interval(days => l.days_ago) - interval '2 hours'
FROM (VALUES
  ('Zenith Wellness Studio', 'Maya Kapoor',   'demo@zenithwellness.example',  'Yoga studio',   'Pune',      'Group yoga and meditation classes', 'Social media content and a simple website', 'Reach more local members',          1),
  ('CoreFit Training',       'Rohit Anand',   'demo@corefit.example',         'Gym',           'Bengaluru', 'Strength and conditioning programs', 'Local promotion and lead generation',  'Fill weekday morning batches',    3),
  ('Urban Yoga Hub',         'Leela Sharma',  'demo@urbanyogahub.example',    'Yoga studio',   'Mumbai',    'Yoga, breathwork and workshops',     'Brand presence and campaigns',         'Launch a second branch',          5),
  ('Motion Fitness Centre',  'Imran Siddiqui','demo@motionfitness.example',   'Fitness centre','Hyderabad', 'Zumba, cardio and group training',   'Promotional campaigns and content',    'Grow weekend attendance',         8),
  ('Balance Wellness',       'Priyanka Das',  'demo@balancewellness.example', 'Wellness centre','Kolkata',   'Fitness and wellness programs',      'Website and client engagement',        'Retain existing clients',         11),
  ('Karate Dojo Collective', 'Sensei Arvind', 'demo@karatedojo.example',      'Martial arts',  'Chennai',   'Karate classes for all ages',        'Digital marketing',                    'Increase junior enrolments',      14),
  ('Pulse Studio',           'Nikhil Rao',    'demo@pulsestudio.example',     'Zumba studio',  'Jaipur',    'Dance fitness classes',              'Social media campaigns',               'Build a recognisable local brand',17)
) AS l (business_name, contact_name, email, business_type, location, services_offered,
        marketing_requirements, marketing_objectives, days_ago)
WHERE NOT EXISTS (
  SELECT 1 FROM fitness_leads f WHERE f.business_name = l.business_name AND f.email = l.email
);

-- ---------------------------------------------------------------------------
-- Platforms: add the four platforms only if missing. The URLs are LOCAL
-- development placeholders; an existing platform (and its URL) is never changed.
-- Replace them with the real addresses in Admin > Platforms.
-- ---------------------------------------------------------------------------
INSERT INTO platforms (name, slug, description, url, is_active)
VALUES
  ('Saritex',   'saritex',   'Academic assignment, essay and thesis support.',       'http://localhost:5181', TRUE),
  ('StudentAQ', 'studentaq', 'International student career and interview support.',  'http://localhost:5180', TRUE),
  ('Eduyarp',   'eduyarp',   'Professional training and technical classes.',         'http://localhost:5175', TRUE),
  ('Fitness',   'fitness',   'Marketing and digital support for fitness businesses.', 'http://localhost:5174', TRUE)
ON CONFLICT DO NOTHING;

-- Services: only when the table is completely empty, so Admin-created services are never mixed with demo ones.
INSERT INTO services (platform_id, name, description, is_active)
SELECT p.id, s.name, s.description, TRUE
FROM (VALUES
  ('saritex',   'Assignment, essay and thesis support', 'Academic support for international students.'),
  ('eduyarp',   'Professional training',                'Courses and live technical classes.'),
  ('studentaq', 'Career and interview support',         'Job research, applications and interview coordination.'),
  ('fitness',   'Digital and social media marketing',   'Marketing support for fitness and wellness businesses.')
) AS s (platform_slug, name, description)
JOIN platforms p ON p.slug = s.platform_slug
WHERE NOT EXISTS (SELECT 1 FROM services);

COMMIT;
