-- Eduyarp DEMO data – development / demonstration databases only.
-- Never run against production.
--
-- Run once, after 003_eduyarp.sql:
--   psql -h localhost -U <db_user> -d <dev_db> -f database/seed/eduyarp_demo.sql
--
-- Adds four published demo courses with modules and topics. It refuses to run
-- (and changes nothing) if any course already exists.
--
-- Not included, because they need real accounts: trainers, trainer
-- assignments and classes. Create a Trainer in Admin > Users, assign them in
-- Admin > Eduyarp > Courses, then schedule classes in Admin > Eduyarp > Classes.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM courses) THEN
    RAISE EXCEPTION 'Courses already exist; the Eduyarp demo seed was not applied.';
  END IF;
END
$$;

INSERT INTO courses (title, slug, description, learning_objectives, duration, level, fee, status) VALUES
  ('Data Science Fundamentals', 'data-science-fundamentals',
   '[Demo] A practical introduction to working with data: Python basics, data cleaning, analysis and visualisation.',
   E'Write basic Python for data work\nClean and prepare real-world datasets\nSummarise data with descriptive statistics\nCreate clear charts to communicate findings',
   '8 weeks', 'beginner', 14999, 'published'),
  ('Artificial Intelligence Essentials', 'artificial-intelligence-essentials',
   '[Demo] Core AI and machine learning concepts explained without heavy maths, with hands-on examples.',
   E'Explain key AI and machine learning terms\nTrain and evaluate a simple model\nRecognise common AI use cases and limits',
   '6 weeks', 'intermediate', 17999, 'published'),
  ('Prompt Engineering', 'prompt-engineering',
   '[Demo] Techniques for getting reliable, useful results from large language models.',
   E'Structure clear, effective prompts\nUse examples and constraints to guide output\nEvaluate and iterate on responses',
   '3 weeks', 'beginner', 4999, 'published'),
  ('Software Development with React', 'software-development-with-react',
   '[Demo] Build modern web interfaces with React, from components and state to data fetching.',
   E'Build reusable React components\nManage state and user input\nFetch and display data from an API',
   '10 weeks', 'intermediate', 19999, 'published');

-- Modules: (course slug, display_order, title, description)
INSERT INTO course_modules (course_id, display_order, title, description)
SELECT c.id, m.display_order, m.title, m.description
FROM (VALUES
  ('data-science-fundamentals', 1, 'Python for Data', 'Just enough Python to start working with data.'),
  ('data-science-fundamentals', 2, 'Data Analysis', 'Cleaning, summarising and visualising datasets.'),
  ('artificial-intelligence-essentials', 1, 'AI Foundations', 'What AI is, and what it is not.'),
  ('artificial-intelligence-essentials', 2, 'Machine Learning Basics', 'Training and evaluating simple models.'),
  ('prompt-engineering', 1, 'Prompt Fundamentals', 'The building blocks of a good prompt.'),
  ('prompt-engineering', 2, 'Advanced Techniques', 'Examples, constraints and iteration.'),
  ('software-development-with-react', 1, 'React Basics', 'Components, JSX and props.'),
  ('software-development-with-react', 2, 'State and Data', 'Interactive interfaces backed by an API.')
) AS m (slug, display_order, title, description)
JOIN courses c ON c.slug = m.slug;

-- Topics: (course slug, module order, display_order, title)
INSERT INTO course_topics (module_id, display_order, title)
SELECT cm.id, t.display_order, t.title
FROM (VALUES
  ('data-science-fundamentals', 1, 1, 'Introduction to Python'),
  ('data-science-fundamentals', 1, 2, 'Variables and Data Types'),
  ('data-science-fundamentals', 1, 3, 'Working with Lists and Dictionaries'),
  ('data-science-fundamentals', 2, 1, 'Loading and Cleaning Data'),
  ('data-science-fundamentals', 2, 2, 'Descriptive Statistics'),
  ('data-science-fundamentals', 2, 3, 'Visualising Data'),
  ('artificial-intelligence-essentials', 1, 1, 'What is Artificial Intelligence?'),
  ('artificial-intelligence-essentials', 1, 2, 'Types of AI Systems'),
  ('artificial-intelligence-essentials', 2, 1, 'Supervised Learning'),
  ('artificial-intelligence-essentials', 2, 2, 'Evaluating a Model'),
  ('prompt-engineering', 1, 1, 'How Language Models Respond'),
  ('prompt-engineering', 1, 2, 'Writing Clear Instructions'),
  ('prompt-engineering', 2, 1, 'Few-shot Examples'),
  ('prompt-engineering', 2, 2, 'Iterating on Prompts'),
  ('software-development-with-react', 1, 1, 'Components and JSX'),
  ('software-development-with-react', 1, 2, 'Props and Composition'),
  ('software-development-with-react', 2, 1, 'State and Events'),
  ('software-development-with-react', 2, 2, 'Fetching Data from an API')
) AS t (slug, module_order, display_order, title)
JOIN courses c ON c.slug = t.slug
JOIN course_modules cm ON cm.course_id = c.id AND cm.display_order = t.module_order;

COMMIT;
