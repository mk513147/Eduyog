# Eduyog Phase 1 — Project Status

This document describes the current state of the Eduyog Phase 1 platform: what it contains, how the parts fit together, how it is run and managed, what has been verified, and what remains before a production deployment.

---

## 1. Purpose

Eduyog Techno Solution Pvt. Ltd. brings education services, professional training, international-student career support and fitness-business services together under one brand. **Phase 1 is a working prototype for company confirmation.** It covers six pieces:

| Piece | What it is |
|---|---|
| **Eduyog** | The public company website and entry point to the other platforms. |
| **Saritex** | Existing static website for academic assignment, essay and thesis support. |
| **StudentAQ** | Existing static website for international-student career and interview support. |
| **Eduyarp** | A basic learning platform (LMS): course catalogue, enrolment, learning, progress, live-class schedule. |
| **Fitness** | A website for fitness and wellness services with a business enquiry form. |
| **Admin** | An Admin-only console to manage users, platforms, services, Fitness leads and everything in Eduyarp. |

Some larger features from the original requirements are **intentionally deferred** (see section 15): a full Trainer dashboard, file/material uploads, assignments, certificates, payments, notifications, attendance and similar. Phase 1 is complete for its defined scope, locally verified, and not yet production-tested or deployed.

---

## 2. System Architecture

```
Browser / Static Websites
        │
        ├── Eduyog        (static HTML/CSS/JS, calls the API for platform links)
        ├── Saritex       (static, no API)
        └── StudentAQ     (static, no API; enquiry form posts to Google Forms)
        │
        ▼
React Applications (Vite)
        │
        ├── Eduyarp       (students; public catalogue)
        ├── Fitness       (public site + enquiry form)
        └── Admin         (Admin accounts only)
        │
        ▼
Node.js + Express API  (one backend shared by all React apps and the Eduyog site)
        │
        ▼
PostgreSQL
```

- **Use the API:** Eduyarp, Fitness, Admin (all of it) and the Eduyog website (only `GET /api/platforms`, to attach "Learn more" links to the platform cards).
- **Do not use the API:** Saritex and StudentAQ. Saritex uses its own contact links; StudentAQ uses WhatsApp/e-mail links and a Google Form (section 5).
- **Backend layering:** routes → controllers → services → PostgreSQL (`pg` pool). Middleware handles authentication, role checks, rate limiting, CORS, security headers and errors.
- There is no server-side rendering and no monorepo tooling; each app is built and deployed on its own.

---

## 3. Repository Structure

```
eduyog-platform/
├── websites/
│   ├── eduyog/        Main company website
│   ├── saritex/       Saritex website
│   └── studentaq/     StudentAQ website
│
├── apps/
│   ├── admin/         Admin console (React + Vite)
│   ├── eduyarp/       Learning platform (React + Vite)
│   └── fitness/       Fitness website (React + Vite)
│
├── backend/           Node.js + Express API
├── database/          Ordered SQL migrations and development seed data
└── assets/            Shared images; screenshots used by the Eduyog website
```

| Directory | Role |
|---|---|
| `websites/` | Static sites: plain HTML, CSS and JavaScript, served as files. |
| `apps/` | The three React applications. Each has its own `package.json`, build and `.env`. |
| `backend/` | The API: `routes/`, `controllers/`, `services/`, `middleware/`, `config/`, `utils/`, `scripts/`. |
| `database/schema/` | Ordered SQL migrations (section 7). |
| `database/seed/` | Development/demo data only (section 12). |
| `assets/` | Project images. The Eduyog site serves its own copies from `websites/eduyog/images/`. |

---

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Static sites | HTML, CSS, JavaScript (no framework, no build step) |
| React apps | React 19, Vite 8, JavaScript (no TypeScript). Client routing is custom (History API), with no router library. |
| Animation / icons / type | **Eduyarp and Fitness:** Motion, Lucide icons, Inter (bundled via Fontsource). **Admin:** none of these (its own small icon set). **Eduyog:** CSS animation and inline SVG icons, Inter from Google Fonts. **StudentAQ:** CSS animation and inline SVG icons, Inter bundled locally. |
| Backend | Node.js (CommonJS), Express 5, `helmet`, `cors`, `express-rate-limit`, `dotenv`, `pg` |
| Authentication | `jsonwebtoken` (HS256 access tokens), `bcryptjs` (12 rounds) |
| Database | PostgreSQL 13+ |
| Lint | ESLint, in Admin and Eduyarp (Fitness and the backend have no lint script) |

**Intentionally not used:** Next.js, NestJS, Prisma, Turborepo. No UI component library (such as shadcn or Chakra) and no CSS framework is used.

---

## 5. Application Responsibilities

### Eduyog (`websites/eduyog`)
The company's public landing page. It explains the two business verticals (Education and Fitness), presents the platforms, and links visitors on.
- Sections: hero, a strip of real counts (2 verticals, 4 platforms, 1 brand), About, Education platform cards, an Eduyarp showcase, a Fitness section, and a closing call to action.
- The three Education cards (Saritex, Eduyarp, StudentAQ) get a "Learn more" link only when `GET /api/platforms` returns an active platform with a matching slug and a valid http(s) URL; otherwise the card says "Website coming soon". The Fitness card links to the page's own Fitness section.
- Product screenshots (Eduyarp and Fitness, taken from demo data) are in `websites/eduyog/images/`.
- Contact: the official e-mail `eduyogtechnology@gmail.com` is shown in the contact section and footer (a `mailto:` link) and a floating WhatsApp button uses the number from the StudentAQ site. No phone number or address is shown until the company confirms them.
- The API base URL is read from `<meta name="eduyog-api-base">` in `index.html`. It is empty in the repository: set it to the deployed API (`https://…/api`, http(s) only) before publishing. While it is empty a deployed page makes no API call and the platform cards show "Website coming soon". Only when the page is opened from localhost or a file does it use `http://localhost:5000/api`.

### Saritex (`websites/saritex`)
An existing static academic-support website with its own pages (about, services, blogs, reviews, contact). It does not call the backend. It is connected to the platform only through its record in Admin → Platforms.

### StudentAQ (`websites/studentaq`)
A static multi-page career-support website for students looking for work in the UK and Dubai (home, services, destinations, about, contact, privacy, 404).
- Content lives in `assets/js/data.js`; small scripts render the pages from it. Changing text, services or FAQs means editing that file.
- Contact is by WhatsApp and e-mail links, and an enquiry form that submits to a **Google Form**. The form is connected by setting `googleForm.formId` and the field entry IDs in `data.js`. **These are currently empty**, so the form shows its "not configured" state until they are filled in.
- The site has its own `README.md` with its content and deployment guide. It does not use the backend.

### Eduyarp (`apps/eduyarp`)
The learning platform (students and the public).
- **Public:** landing page, course catalogue (published courses only) and course detail pages.
- **Accounts:** registration and login create **Student** accounts. Every signed-in role has a **Profile** page (`/profile`, opened from the header) with personal details and a change-password form.
- **Trainer assignments:** the Trainer course page has an Assignments section (create, edit, publish, close, back to draft, delete) and each assignment opens `/trainer/courses/:courseId/assignments/:assignmentId`, which lists submissions and lets the Trainer write or edit feedback. A new submission notifies the course's Trainers through the notification bell.
- **Trainer area:** a signed-in Trainer lands on `/trainer` (assigned courses, current-student count, upcoming classes) and can open an assigned course (read-only curriculum, current students, classes) and a student's progress (`/trainer/courses/:courseId/students/:studentId`).
- **Enrolment, dashboard and learning:** a Student enrols in a published course, sees their courses, progress and upcoming live classes on a dashboard, and studies on a learning page with a course outline (modules and topics), previous/next navigation, an optional video, and a "Mark complete" action.
- **Course visuals:** each course card, detail page and learning header shows the course's own cover image and icon if the Admin set them, otherwise the default gradient and icon (section 10).
- **Topic videos:** YouTube and Vimeo only (section 9).
- The four temporary demo courses use local SVG artwork matched by slug (`apps/eduyarp/src/utils/courseVisual.js`); this mapping is temporary and can be deleted at handover.
- **Notifications and announcements:** signed-in users get a bell in the header (unread count, latest items, mark as read / mark all as read) and a `/notifications` page. Students and Trainers read announcements in full at `/announcements`. A Trainer posts and deletes announcements for an assigned course from the course page (`/trainer/courses/:courseId`). Text is plain; no rich text or attachments. In-app only: nothing is sent by e-mail, SMS, WhatsApp or push.
- **Learning resources and FAQs:** below the learning workspace a Student sees the course's resources (grouped by module, each with type, description and an "Open resource" link that opens in a new tab) and its FAQs (expandable). Resources are links only; nothing is embedded or uploaded.
- **Assignments:** the course page lists published and closed assignments with the student's own state (not submitted, submitted, submitted late, feedback received). An assignment page shows the instructions and due date, a form for text and/or a link, the student's earlier submissions (newest first) and the trainer's written feedback. There are no grades.
- **Certificates:** finishing the last topic of a course shows "Course completed" and "Certificate issued" with a **View certificate** link. **Certificates** (nav and `/certificates`) lists a Student's certificates; each opens a printable certificate page (`/certificates/:certificateId`) with a Print button. A revoked certificate stays visible and is clearly marked REVOKED (also when printed).
- Not included: public certificate verification, payments, uploads (section 15).

### Fitness (`apps/fitness`)
A single-page website for corporate wellness, fitness programs and employee fitness initiatives, with an enquiry form (business name, contact person, e-mail, phone, business type, location, services offered, marketing requirements, website links, marketing objectives, additional requirements). Submissions go to `POST /api/fitness-leads` (public, rate-limited) and appear in Admin → Fitness Leads.

### Admin (`apps/admin`)
The management console. Only accounts with the Admin role can sign in.

| Area | What Admin can do |
|---|---|
| Dashboard | See the platform overview (below). |
| Platforms, Services | Create, edit, activate/deactivate and delete the records shown on the Eduyog site. |
| Users | See all users and change their role (Student, Trainer, Admin). |
| Fitness Leads | Read business enquiries from the Fitness site. |
| Eduyarp → Courses | Create, edit, publish/unpublish, archive and delete courses, including the optional cover image URL and icon URL; manage modules, topics (with optional video URLs) and trainer assignments on the course page. |
| Eduyarp → Trainers | See Trainers and their assigned courses. |
| Eduyarp → Enrolments | Search and filter all enrolments; cancel an active enrolment. |
| Eduyarp → Classes | Schedule, edit and delete live classes (the Trainer must be assigned to the course). Enrolled students and the class Trainer are notified of new classes and meaningful changes. |
| Eduyarp → Courses → a course | Besides modules, topics and Trainers: add, edit, delete and reorder (up/down) the course's **FAQs**, and add, edit and delete its **learning resources** (title, type, URL, description, attached to the whole course, a module or a topic). |
| Eduyarp → Courses → a course → Assignments | Create, edit, publish, close, return to draft and delete assignments; view each assignment's submissions, history and feedback (read only). |
| Eduyarp → Certificates | See every issued certificate (number, student, course, issue date, status), search and filter by status or course, open the details, and **revoke** an active certificate with a required reason. |
| Eduyarp → Announcements | Post a platform-wide or per-course announcement, filter by course or platform-wide only, and delete announcements. |

#### Admin dashboard
The first page after sign-in (sidebar: Dashboard) summarises the platform on one screen. **Every figure is derived in the browser from lists the existing Admin API already returns; nothing is hard-coded, there are no invented trends, and no dedicated dashboard endpoint exists.** The calculations live in `apps/admin/src/utils/dashboard.js`. It shows:
- **Four headline numbers:** total users (with the student/trainer/admin split), active (published) courses, active enrolments (with the number of students learning) and Fitness leads (with the count from the last 30 days).
- **Enrolment status:** a donut of active, completed and cancelled enrolments with exact counts and percentages.
- **Students by course:** horizontal bars of current students per course (active and completed; cancelled enrolments are not counted).
- **Recent activity:** one chronological feed built from real timestamps: user registrations, enrolments, Fitness enquiries and newly created courses.
- **Upcoming classes:** the next five scheduled classes by day and time, with course and Trainer.
- **Course health:** which published courses have no Trainer or no upcoming class, followed by up to four notable courses with their trainer count, student count and next class.
- **Fitness enquiries:** enquiries per week over the last eight weeks and the three most recent businesses.
- **Shortcuts** to the Courses, Users, Classes, Enrolments and Fitness Leads pages, and a link to Platforms and Services.

The charts are small inline SVG/CSS components (no chart library), with exact values in tooltips and in accompanying text. Each card has its own data source: while it loads it shows a compact skeleton, if its request fails only that card shows "Unable to load …" with a Retry button, and with no data it shows a plain message such as "No enrolment activity yet." or "No classes scheduled." A fresh development database can be filled with demonstration data using the seed in section 12; those records are fictional, not production data.

---

## 6. Eduyarp Data Model

| Table | Meaning |
|---|---|
| `users` | All accounts. `role` is `student`, `trainer` or `admin`. |
| `courses` | A course: title, unique `slug`, description, learning objectives, duration, `level`, `fee` (INR, display only), `status` (`draft`, `published`, `archived`), and the optional media fields **`cover_image_url`** and **`icon_url`**. |
| `course_modules` | Ordered sections of a course. |
| `course_topics` | Ordered topics inside a module; includes the optional **`video_url`**. |
| `course_trainers` | Which Trainers are assigned to which courses. |
| `enrolments` | A Student's enrolment in a course; `status` is `active`, `completed` or `cancelled`. |
| `topic_progress` | Which topics a Student has completed. |
| `classes` | Scheduled live classes: course, Trainer, title, date/time, optional meeting link, status. |

In plain language:
- A **Course** has **Modules**, and each Module has **Topics**.
- A **Course** can have several **Trainers**.
- A **Student** has **Enrolments** (one current enrolment per course; cancelled ones are kept as history).
- A **Student + Topic** has a **Topic progress** record once completed.
- A **Course** has **Classes**, each taught by one of its assigned Trainers.

Key rules enforced in the database: unique course slug; level, status and fee checks; only one `active`/`completed` enrolment per student and course (a partial unique index, so re-enrolment after cancellation works); a course with any enrolment cannot be deleted (archive it instead); `meeting_link`, `cover_image_url` and `icon_url` must be http(s) URLs. The application additionally requires that a class's Trainer is assigned to the class's course.

---

## 7. Migrations

Files in `database/schema/` are applied **in order, once each**, with `psql`. There is no migration runner. Each file runs in a single transaction and is deliberately **not** idempotent: running one twice fails. Never edit a migration that has been applied; add a new one.

| File | What it does |
|---|---|
| `001_initial_schema.sql` | Initial application schema: `users` (roles `student`, `admin`), `platforms`, `services`, `fitness_leads`, the `set_updated_at()` trigger, last-Admin index. |
| `002_add_fitness_lead_fields.sql` | Adds the business-enquiry fields to `fitness_leads` (type, location, services, marketing requirements, links, objectives). |
| `003_eduyarp.sql` | Eduyarp schema: adds the `trainer` role and creates `courses`, `course_modules`, `course_topics`, `course_trainers`, `enrolments`, `topic_progress`, `classes`. |
| `004_eduyarp_enrolment_status.sql` | Adds the `cancelled` enrolment status and the partial unique index that allows re-enrolment after cancellation. |
| `005_eduyarp_topic_video.sql` | Adds the nullable `course_topics.video_url` (stores the validated original YouTube/Vimeo URL). |
| `006_eduyarp_course_media.sql` | Adds the nullable `courses.cover_image_url` and `courses.icon_url` (http(s) only, at most 2048 characters). Existing courses keep `NULL` and fall back to the default visual. |
| `007_account_profiles.sql` | Creates `user_profiles` (one optional row per user: phone, institution, study level, field of study, graduation year, bio, avatar URL; deleted with the user; CHECK constraints on study level, year 1950-2100, phone characters and http(s) avatar URL) and adds the nullable `users.password_changed_at`. Existing users are unchanged. |
| `008_announcements_notifications.sql` | Creates `announcements` (optional course; `NULL` = platform-wide; title up to 200 and message up to 3000 characters, both non-empty; author kept as history, never silently deleted) and `notifications` (one row per recipient: type, title up to 200, optional body up to 500, optional internal `link_path`, optional course, `read_at`). Indexes: announcements `(course_id, created_at DESC)`; notifications `(recipient_id, created_at DESC, id DESC)`, a partial unread index `(recipient_id) WHERE read_at IS NULL`, and a course index. The notification type is only format-checked, so new types need no migration; `link_path` must start with a single `/` (no scheme, no `//`). |
| `009_course_content.sql` | Creates `course_faqs` (question up to 500 characters, answer up to 3000, both non-empty, `display_order`) and `course_resources` (title up to 200, optional description up to 1000, type `video`/`pdf`/`document`/`presentation`/`external`, `url` up to 2048 characters that must start with `http://` or `https://` and have a host, optional `module_id` / `topic_id`, `display_order`). Both are deleted with their course; deleting a module or topic deletes the resources attached to it. A trigger rejects a module or topic from another course and fills in a topic's module. Indexes on `(course_id, display_order, id)` and on module/topic. |
| `010_assignments.sql` | Creates `assignments` (title up to 200, instructions up to 5000, optional `due_at`, status `draft`/`published`/`closed`, optional module/topic, `display_order`, `created_by`), `assignment_submissions` (text up to 5000 and/or an http(s) link up to 2048; at least one is required; `submitted_at`; `is_late`) and `assignment_feedback` (one text comment per submission, up to 3000 characters, no scores). Triggers keep a module/topic inside the assignment's own course and set `is_late` from the due date. Indexes: assignments by `(course_id, display_order, id)` and `(course_id, status)`; submissions by `(assignment_id, student_id, submitted_at DESC, id DESC)`; feedback by the unique `submission_id`. |
| `011_certificates.sql` | Creates `certificates`: a random human-readable `certificate_number` (database default, unique), `student_id`, `course_id` (both RESTRICT, so a certificate cannot be deleted away), snapshots `student_name` and `course_title`, `issued_at`, `status` (`active`/`revoked`) and the revocation fields (`revoked_at`, `revoked_by`, `revocation_reason`, all present together or all absent). `UNIQUE (student_id, course_id)` allows one certificate per student and course. A trigger blocks any change to the number, student, course, snapshots and issue date, and blocks changing or restoring a revoked certificate. Indexes: number (unique), `(student_id, course_id)` (unique), `(student_id, issued_at DESC, id DESC)`, `(course_id, issued_at DESC)`, `(issued_at DESC, id DESC)`. Existing completed enrolments are not given certificates by the migration. |

There is no migration after 011. To bring an existing database up to date, apply only the files it is missing, for example:

```
psql -h localhost -U <db_user> -d <db_name> -f database/schema/011_certificates.sql
```

Migrations 001–011 apply cleanly in order on an empty database (verified on a temporary database). No migration has been applied to any production database.

---

## 8. Authentication and Roles

- **Registration** (`POST /api/auth/register`) always creates a **Student**; the client cannot choose a role. Only an Admin can change roles (Admin → Users).
- **Sessions:** the API issues a signed JWT (default lifetime 1 hour). On **every request** the backend re-loads the user from the database, so role changes and deleted accounts take effect immediately. There are no refresh tokens.
- **Student** routes always act on the signed-in Student's own data; a Student can only see courses they currently have an active or completed enrolment in.
- **Trainer** access is limited to courses the Trainer is assigned to, through the Trainer API (`/api/eduyarp/trainer/*`) and the Eduyarp Trainer screens. A Trainer sees each current student's name, e-mail, enrolment status and progress only, never phone, institution, field of study, graduation year, bio or avatar. Curriculum is read-only. Unassigned course: 403; a student who is not currently enrolled: 404. Unassigning or demoting a Trainer removes access immediately.
- **Profiles:** any signed-in user can read and edit their own profile (`/api/me/profile`); the name may change, e-mail and role may not. The avatar is an http(s) URL only (no upload). Admin can view and edit any user's profile from Admin → Users.
- **Announcements:** an Admin can post platform-wide or per-course announcements and delete any. A Trainer can post to, list and read announcements of a course they are currently assigned to, and delete only their own announcement on such a course. A Trainer cannot post platform-wide or touch another course (403 for an unassigned course; announcement ids outside their courses return 404). Students cannot create, edit or delete. Every check is made on the server from the database, never from the client.
- **Course FAQs and resources:** Admin manages both for any course. A Trainer reads FAQs and reads, adds, edits and deletes resources only for a course they are **currently** assigned to (403 for an unassigned course on list/create; resource ids outside their courses return 404; access ends the moment the assignment or Trainer role does). A Student reads both only with an **active or completed** enrolment (a cancelled or missing enrolment is a 404); a user who became a Trainer/Admin follows the Trainer/Admin rules, not their old enrolments. Resource URLs must be `http://` or `https://` with a host and no embedded username/password; `javascript:`, `data:`, `file:`, `vbscript:`, `blob:`, relative and malformed values are rejected by both the API and the database. A module or topic must belong to the resource's own course.
- **Assignments and submissions:**
  - States: **draft** (Admin and assigned Trainers only), **published** (students can read and submit), **closed** (students can read and see their history; new submissions are refused with 409). Any state can be changed to any other.
  - Each submission is a separate record; there is no one-per-student limit. A student may resubmit while the assignment is published, even after the due date. The newest submission is the current one and earlier ones are kept.
  - **Late:** a submission is late when it is made after `due_at`. The database computes it at insert time; a client cannot send or change it. Late submissions are accepted and flagged. Changing the due date later does not rewrite earlier submissions. No due date means never late.
  - A submission needs text, a link, or both. Links must be `http://` or `https://` with a host (the same rules as resource URLs); `javascript:`, `data:`, `file:`, `vbscript:`, `http:///x` and malformed values are rejected by the API and the database. There are no file uploads.
  - **Feedback:** written text only, one current record per submission (writing again replaces it). No grades, scores or marks. Students read feedback on their own submissions only.
  - **Access:** Admin manages every course. A Trainer manages assignments, reads submissions and writes feedback only for a course they are **currently** assigned to (403 on an unassigned course list/create; assignment and submission ids outside their courses return 404; having created an assignment gives no access after the assignment ends). A Student needs the Student role and an active or completed enrolment (cancelled, none, other course and draft assignments all return 404; a former Student now Trainer/Admin gets 403). Students cannot edit or delete submissions.
  - **Deleting** an assignment deletes its submissions and feedback; deleting a course does the same. Deleting a module or topic only clears the assignment's link and keeps the assignment and its submissions.
  - **Notification:** each submission creates one `assignment_submission` notification for every Trainer assigned to the course, linking to `/trainer/courses/:courseId/assignments/:assignmentId?submission=:id`. It is created after the submission is saved, on a best-effort basis: if it fails the error is logged and the submission stays saved.
- **Certificates:**
  - **When:** the existing completion rule is used unchanged: an enrolment is `completed` when the course has topics and the student has finished all of them. The certificate is created in the same database transaction as the moment an enrolment *becomes* completed: finishing the last topic, re-enrolling with all progress already kept, or a curriculum change (for example the last unfinished topic being deleted) that completes enrolments. If issuing fails, the completion is rolled back. There is no polling, cron or queue.
  - **Once only:** one certificate per student and course (database unique constraint; the insert ignores a duplicate), however often completion is re-evaluated, even concurrently. Re-enrolling, cancellation of another enrolment, or course edits never create a second one. Only users with the Student role receive certificates. Enrolling alone, partial progress, or a course with no topics issues nothing; cancelled enrolments never earn one.
  - **Number:** `EDUYOG-<year>-<10 hex characters>`, for example `EDUYOG-2026-3F9A1C07B2`. It is random (not derived from an id), generated by the database, unique, never changes and is never accepted from a client.
  - **Snapshots:** the student's display name and the course title at issuance are stored and shown. Later renames of the student or course, and any other profile or course change (fee, status, modules, topics, resources, assignments), do not alter or revoke an issued certificate.
  - **Revocation:** Admin only, with a required reason (up to 500 characters); records who, when and why; the certificate is kept, still listed and still viewable by the student marked revoked (the reason is shown to Admin only). A revoked certificate cannot be restored and a second revocation returns 409. There is no delete, edit or restore route.
  - **Access:** a Student lists and opens only their own certificates (another student's id returns 404; a user who is no longer a Student gets 403). Trainers have no certificate access and no management rights. Admin lists, filters, views and revokes all.
  - Pre-existing completed enrolments (completed before certificates existed) are **not** back-filled automatically.
  - **Public certificate verification is not implemented in Phase 1.**
- **Notification recipients:** one row per person. Course announcements and class notifications go to students with an **active or completed** enrolment in that course (never cancelled, and never a user who is no longer a Student) and to the course's assigned Trainers (an announcement is not sent back to its author; class notifications go to the class's own Trainer). Platform-wide announcements go to every student with at least one active or completed enrolment, exactly once each. Users read and mark only their own notifications; another user's id returns 404.
- **Password change** (`POST /api/me/password`, same 20 per 15 min limiter as login): a wrong current password returns 400 (not 401). A successful change stores `users.password_changed_at` and returns a fresh token; tokens issued before the change are rejected.
- **Admin** routes (`/api/admin/*`) require the Admin role.
- **Last-Admin protection:** the only remaining Admin cannot be demoted.
- The first Admin is created once with `npm run setup:admin` in `backend/` (it refuses to run if an Admin already exists).

### Role changes and enrolments

| Change | Effect on enrolments |
|---|---|
| Student → Trainer or Admin | Active enrolments become `cancelled` (in the same transaction as the role change). |
| Trainer or Admin → Student | Nothing is restored. |
| Any change | `completed` and already `cancelled` enrolments are unchanged; topic progress is never deleted. |

### Enrolment lifecycle

| Status | Course access | Notes |
|---|---|---|
| `active` | Yes | Set on enrolment. |
| `completed` | Yes | Set automatically when every topic is done; returns to `active` if a topic is added. |
| `cancelled` | No | Kept as history and visible to Admin. The Student no longer sees the course, its classes, or its videos. |

A cancelled Student can enrol again; a new active enrolment is created and earlier topic progress is kept. Admin can also cancel an active enrolment directly (Admin → Eduyarp → Enrolments); completed and already-cancelled enrolments cannot be cancelled, and enrolments are never deleted.

---

## 9. Eduyarp Learning Flow

```
Register → Login → Browse courses → Course detail → Enrol → Dashboard
   → Learning page → Select module/topic → Watch optional video
   → Mark topic complete → Progress updates
```

- Courses can be browsed without an account; enrolling requires a Student account.
- The learning page shows the course outline with each topic marked completed, current or available, an optional video, the topic text, and Previous/Next buttons.
- **Videos never complete a topic automatically.** The Student always clicks "Mark complete". There is no watch tracking.
- **Supported video providers:** YouTube (`youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/embed/…`) and Vimeo (`vimeo.com/<id>`, `player.vimeo.com/video/<id>`). The backend validates the host and the video id and builds the embed address itself (YouTube videos use `youtube-nocookie.com`). Other providers, raw iframe HTML and `javascript:`/`data:` URLs are rejected, so only YouTube and Vimeo can ever appear as an iframe source.
- Videos follow normal course access: the public catalogue never includes them, cancelled enrolments lose them, completed enrolments keep them. Videos stay hosted by their provider; nothing is uploaded or stored.

---

## 10. Admin Course Management

```
Create course → Edit course → Add cover image URL → Add icon URL
   → Add modules → Add topics → Add topic video → Assign trainers
   → Schedule classes → Publish / unpublish → Archive / delete (where allowed)
```

- A new course starts as `draft`. Only `published` courses appear to the public and can be enrolled in.
- **Course media (optional):** the course form has *Cover image URL* and *Course icon URL*. They are externally hosted http(s) image addresses; **no files are uploaded or stored**. The form shows a live preview (loaded after typing pauses), a neutral "Image unavailable" box if an image cannot load, and a button to remove the cover (*Remove cover image*) or return to the default icon (*Use default icon*); clearing a field saves `NULL`.
- **Validation:** the backend trims the value, turns an empty string into `NULL`, accepts only `http:` and `https:` with a host, and rejects `javascript:`, `data:`, `file:`, `blob:`, malformed addresses, addresses containing a username or password, and anything longer than 2048 characters. The form repeats the check, but the backend is authoritative.
- **Fallbacks:** no cover → the existing gradient visual (or, for the four temporary demo courses, their local artwork); no icon → the default course icon chosen from the title; an image that fails to load falls back the same way. Courses never depend on these fields.
- A course with enrolments cannot be deleted (archive it).

---

## 11. API Reference

Base path `/api`. Errors use `{ "error": { "message", "details?" } }`. Course objects include `coverImageUrl` and `iconUrl`; topic objects (for Admin, assigned Trainers and enrolled Students only) include `videoUrl` and `videoEmbedUrl`.

| Area | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login` (20 per 15 min per client), `GET /api/auth/me` |
| Public platforms | `GET /api/platforms` (active only) |
| Fitness | `POST /api/fitness-leads` (public, 10 per hour per client) |
| Public Eduyarp | `GET /api/eduyarp/courses`, `GET /api/eduyarp/courses/:slug` (published only) |
| Student | `POST /api/eduyarp/courses/:courseId/enrol`, `GET /api/eduyarp/me/courses`, `GET /api/eduyarp/me/courses/:courseId`, `GET /api/eduyarp/me/schedule`, `POST /api/eduyarp/topics/:topicId/complete` |
| Account (any signed-in role) | `GET /api/me/profile`, `PATCH /api/me/profile`, `POST /api/me/password` (20 per 15 min per client) |
| Notifications (any signed-in role) | `GET /api/me/notifications?limit&offset&unread` (returns `{ notifications, unreadCount, total }`), `POST /api/me/notifications/:id/read`, `POST /api/me/notifications/read-all`, `GET /api/me/announcements` (announcements delivered to the Student or Trainer) |
| Course content: Admin | `GET`/`POST /api/admin/eduyarp/courses/:courseId/faqs`, `POST .../faqs/reorder` (`{ids}`), `PATCH`/`DELETE /api/admin/eduyarp/faqs/:id`; `GET`/`POST /api/admin/eduyarp/courses/:courseId/resources`, `PATCH`/`DELETE /api/admin/eduyarp/resources/:id` |
| Course content: Trainer | `GET /api/eduyarp/trainer/courses/:courseId/faqs`; `GET`/`POST /api/eduyarp/trainer/courses/:courseId/resources`; `PATCH`/`DELETE /api/eduyarp/trainer/resources/:id` |
| Course content: Student | `GET /api/eduyarp/me/courses/:courseId/faqs` and `/resources` |
| Assignments: Admin | `GET`/`POST /api/admin/eduyarp/courses/:courseId/assignments`; `GET`/`PATCH`/`DELETE /api/admin/eduyarp/assignments/:id`; `GET /api/admin/eduyarp/assignments/:id/submissions`; `GET /api/admin/eduyarp/submissions/:id`; `PUT /api/admin/eduyarp/submissions/:id/feedback` |
| Assignments: Trainer | The same paths under `/api/eduyarp/trainer/` (assigned courses only) |
| Assignments: Student | `GET /api/eduyarp/me/courses/:courseId/assignments`; `GET /api/eduyarp/me/assignments/:id` (with the student's own submissions and feedback); `POST /api/eduyarp/me/assignments/:id/submissions` |
| Certificates: Student | `GET /api/eduyarp/me/certificates`, `GET /api/eduyarp/me/certificates/:id`; completing a topic (`POST /api/eduyarp/topics/:topicId/complete`) and the student course (`GET /api/eduyarp/me/courses/:courseId`) also return the course's certificate when there is one |
| Certificates: Admin | `GET /api/admin/eduyarp/certificates?courseId&studentId&status`, `GET /api/admin/eduyarp/certificates/:id`, `POST /api/admin/eduyarp/certificates/:id/revoke` (`{reason}`) |
| Trainer announcements | `GET` and `POST /api/eduyarp/trainer/courses/:courseId/announcements`, `DELETE /api/eduyarp/trainer/announcements/:id` |
| Trainer | `GET /api/eduyarp/trainer/courses`, `/schedule`, `/courses/:courseId`, `/courses/:courseId/students`, `/courses/:courseId/students/:studentId` (Trainer role; course must be assigned) |
| Admin platform data | `/api/admin/platforms`, `/api/admin/services` (list, create, get, update, delete); `GET /api/admin/users`, `GET /api/admin/users/:id` (profile), `PATCH /api/admin/users/:id/profile`, `PATCH /api/admin/users/:id/role`; `GET /api/admin/fitness-leads[/:id]` |
| Admin Eduyarp | `/api/admin/eduyarp/…` — courses (list, create, get, update, delete); modules and topics (create under parent, update, delete); trainers (`GET /trainers`, assign and unassign on a course); `GET /enrolments`, `PATCH /enrolments/:id` (`{"status":"cancelled"}` only); classes (list, create, update, delete); announcements (`GET /announcements[?courseId=\|scope=platform]`, `POST /announcements`, `DELETE /announcements/:id`) |

A general limit of 1000 requests per 15 minutes per client applies to `/api`.

---

## 12. Seed Data (development only)

Seeds live in `database/seed/` and are **never** run by any script or migration. Do not run them against production.

| File | Purpose |
|---|---|
| `eduyarp_demo.sql` | Four sample courses (titles marked `[Demo]`) with modules and topics. Refuses to run if any course exists. |
| `eduyarp_demo_catalog.sql` | **Temporary demo catalogue:** Data Science, Artificial Intelligence, Prompt Engineering and Software Development (published, Beginner, one module and three topics each), with sample **third-party YouTube videos** on the topics. Re-runnable: it creates only courses whose slug is free and sets a topic video only if the topic has none. |
| `admin_dashboard_demo.sql` | Fictional demonstration data so the Admin dashboard looks populated: 5 Trainers and 12 Students (demo accounts that cannot log in), trainer assignments, 13 enrolments with consistent topic progress (active, completed and one cancelled), 6 upcoming classes, 7 Fitness leads, and any missing platforms/services. Re-runnable; it never updates or deletes existing records and never overwrites existing platform URLs or course media. It creates no Admin account. |

Run, in this order, on a development database that already has the schema:

```
psql -h localhost -U <db_user> -d <dev_db> -f database/seed/eduyarp_demo_catalog.sql
psql -h localhost -U <db_user> -d <dev_db> -f database/seed/admin_dashboard_demo.sql
```

The demo courses, their local artwork, the sample videos and the dashboard data are **demonstration content, not production content**. They can be replaced or deleted through Admin during handover; the sample videos belong to their original creators and are only linked, never copied.

---

## 13. Testing Status

The backend has an automated suite (`npm test` in `backend/`, Node's built-in test runner, no extra dependencies). It creates a **temporary database**, starts the real server against it and drops it afterwards; it needs the PostgreSQL credentials from `backend/.env` and never touches the configured database. It covers Stage 2 (accounts, profiles, Trainer access), Stage 3 (announcements, notifications, class notifications), Stage 4 (FAQs and resources), Stage 5 (assignments, submissions, feedback), Stage 6 (certificates) and regression of existing behaviour: 254 tests, all passing. The browser checks and earlier checks below were run by hand or with throw-away scripts against temporary databases and local servers; those scripts are not in the repository.

| Area | Checks | Result |
|---|---|---|
| Lint | Admin and Eduyarp `npm run lint` | Verified: clean |
| Builds | Admin, Eduyarp, Fitness `npm run build` | Verified: succeed |
| Backend | `node --check` on every backend `.js` file | Verified: pass |
| Migrations | 001–006 applied in order on a fresh database; 005 and 006 fail if run twice; 006 constraints reject non-http(s) values | Verified |
| Seeds | Catalogue and dashboard seeds run twice with no duplicates; existing data, platform URLs and Admin-set videos/media untouched; progress consistent with enrolment status | Verified |
| API | Course media create/change/remove, trimming, rejection of unsafe or malformed URLs, role restrictions, media in public/student/Admin responses; topic video validation and access rules; enrolment cancel rules (404/409); role-change cancellation | Verified |
| Browser (Chrome) | Admin course form (preview, "Image unavailable", remove/default, validation); Admin dashboard (KPIs, both charts, feed, schedule, course health and Fitness figures equal the database; shortcuts and links; empty data; failed and slow requests stay local); every Admin page loads without console errors; Eduyarp landing, catalogue, detail, dashboard and learning pages with custom, partial, missing and unreachable media; student journey (enrol, videos on every demo topic, mark complete, progress); Fitness enquiry submit; mobile menus; StudentAQ pages, menu, links, form validation and submission request path | Verified |
| Responsive | No horizontal overflow at 390, 768, 1024, 1280 and 1440 px on the Admin dashboard, Eduyarp course grids and landing page, and (at 390–1440 px) the StudentAQ pages | Verified |
| Regression | Student ↔ Trainer role changes and enrolment cancellation, trainer assignment, class scheduling rule, publish/unpublish, course delete rules | Verified |
| Stage 2: migration | 007 applies after 001–006, keeps existing users, fails if run twice; constraints and cascade behave as designed | Verified (automated) |
| Stage 2: API | Profile read/update (whitelist, locked e-mail/role, unsafe URLs rejected, partial update, clearing); password change (400 on wrong password, old tokens rejected, new token works, rate limit); Trainer authorization (assigned vs other course, student not in course, field minimisation, Admin/Student denied); Admin profile read/edit; regression (role change and enrolment cancellation, enrolment, progress, classes, course APIs) | Verified (automated, 89 tests) |
| Stage 2: browser (Chrome) | Student: login, profile edit and persistence, name in header, invalid phone and unsafe avatar URL, change password (wrong, mismatch, success, old token rejected, re-login), Trainer URL blocked. Trainer: login redirect, dashboard, course, student progress, other course and outside student refused, no private fields, Student area blocked. Admin: Users → Profile view/edit/validation, role change cancels enrolment and the Trainer view updates. New pages at 390, 768, 1024 and 1440 px: no horizontal overflow, no console errors | Verified (79 checks) |
| Stage 3: migration | 008 applies after 001–007, keeps existing data, fails if run twice; constraints (empty/over-long text, link paths, type format), foreign keys, cascade/restrict behaviour and the three indexes | Verified (automated) |
| Stage 3: API | Own-notifications-only listing, pagination (including equal timestamps), unread filter and counts, mark read / mark all read, other users' ids (404) and malformed ids (400); announcement permissions for Admin, Trainer, Student, unassigned and demoted Trainers; recipient rules (active, completed, cancelled, duplicates, multi-course, former students); announcement + notifications in one transaction (a failure leaves no announcement); double-submit protection; class created/changed notifications, no notification for unchanged data, and a class change still succeeds if notifications fail | Verified (automated, 62 tests) |
| Stage 3: browser (Chrome) | Student: bell and count, panel, open and mark read, mark all read, receive a Trainer announcement and a class notification, count refresh on navigation and window focus, announcement text shown in full. Trainer: post (with validation), delete own, plain-text rendering, unassigned course blocked. Admin: sidebar entry, create platform-wide and course announcements, filters, delete with confirmation. Privacy: cancelled student receives nothing. Notifications, announcements and Trainer course pages (and the open bell panel) at 390, 768, 1024 and 1440 px: no horizontal overflow, no console errors | Verified (84 checks) |
| Stage 4: migration | 009 applies after 001–008, keeps existing data, fails if run twice; FAQ and resource constraints, all five types, URL rules (dangerous and malformed values rejected), module/topic trigger, ordering, cascade on course/module/topic delete, indexes | Verified (automated, 13 tests) |
| Stage 4: API | FAQ and resource CRUD for Admin; Trainer read FAQs and full resource CRUD on assigned courses only; Student access with active/completed enrolments, denied when cancelled, not enrolled, other course, or promoted to Trainer; 401/403/404 conventions and IDOR checks; cross-course module/topic rejected; `javascript:`, `data:`, `file:`, malformed URLs rejected; deterministic ordering; FAQ reorder | Verified (automated, 20 tests) |
| Stage 4: browser (Chrome) | Student: expand/collapse FAQs, grouped resources, safe new-tab links, cancelled student sees nothing. Trainer: add (with unsafe URL rejected), edit, delete resources, read-only FAQs, unassigned course blocked. Admin: FAQ add/edit/reorder/delete, resource add/edit/delete, per-course context. Student, Trainer and Admin course pages, forms and modals at 390, 768, 1024 and 1440 px: no horizontal overflow, no console errors, no 5xx | Verified (82 checks) |
| Stage 5: migration | 010 applies after 001–009, keeps existing data, fails if run twice; assignment, submission and feedback constraints, URL rules, module/topic trigger, several submissions per student, database-computed late flag (none, before, exactly at, just after the due time), one feedback per submission, delete behaviour, indexes | Verified (automated, 11 tests) |
| Stage 5: API | Admin and Trainer CRUD and status changes; Student visibility (draft hidden, closed readable, cancelled/none/other course/former Student denied); text/URL/both submissions and rejected values; late flag set by the server; resubmission history; closed assignments refuse submissions; feedback write/update/read; IDOR checks across students, trainers and courses; Trainer notifications (all assigned Trainers, nobody else, internal link, still saved when notifications fail); concurrent submissions | Verified (automated, 29 tests) |
| Stage 5: browser (Chrome) | Trainer creates a draft, Student cannot see it, Trainer publishes, Student submits (late), resubmits (history, link opens safely), Trainer is notified through the bell, opens the submission, writes and edits feedback, Student sees feedback, Trainer closes and Student can no longer submit; unassigned course and other Trainer blocked; Admin create/edit/publish/close/reopen/view submissions and feedback/delete with confirmation. Student, Trainer and Admin pages, forms and modals at 390, 768, 1024 and 1440 px: no horizontal overflow, no console errors, no 5xx | Verified (102 checks) |
| Stage 6: migration | 011 applies after 001–010, back-fills nothing, fails if run twice; generated number format and uniqueness, one certificate per student and course, field and revocation constraints, immutability and no-restore triggers, delete protection, indexes | Verified (automated, 10 tests) |
| Stage 6: API | Issued exactly once on completion (also concurrent and repeated completion, re-enrolment, curriculum changes); nothing for enrolment, partial progress, empty or draft courses; snapshots survive student and course changes; Student own-only access (404/403); Trainer and Student cannot revoke or modify; Admin list, filters, view and revoke with reason, who and when recorded; revoked certificates stay listed and visible; no back-fill of pre-existing completions | Verified (automated, 20 tests) |
| Stage 6: browser (Chrome) | Student finishes a course and sees the completion banner, opens the certificate (number, name, course, date, status), Print button, print layout (navigation hidden, fits one landscape page), list; renamed course/student do not change it; Trainer blocked; Admin search, details, revoke with required reason, record stays; Student then sees REVOKED (also in print layout). Certificate, list, completion banner and Admin pages at 390, 768, 1024 and 1440 px: no horizontal overflow, no console errors, no 5xx | Verified (76 checks) |
| Not yet verified | Real devices; screen readers; browsers other than Chrome; a production-like deployment; the StudentAQ Google Form against a real form; playback of videos (the right embed and attributes are verified, not playback itself) | Not verified |

---

## 14. Current Limitations

| Item | Status | Notes |
|---|---|---|
| Rate limit not environment-specific | Open | `backend/server.js` allows 1000 requests per 15 minutes in **every** environment; choose a stricter production value. |
| Client IP behind a proxy | Open | `trust proxy` is not set. Behind a proxy all clients can appear to share one address, so the rate limiters (global, login 20/15 min, enquiries 10/hour) act on the proxy. |
| Production database TLS | Open | `config/database.js` has no SSL option; add one if the hosted PostgreSQL requires TLS. |
| Localhost API fallbacks | Partly open | The Eduyog site no longer falls back to localhost on a deployed host (see section 5). The Admin and Eduyarp configs still fall back to `http://localhost:5000/api`: always set `VITE_API_BASE_URL`. Fitness has no fallback in a production build. The two "Become a Partner" links in the Eduyog site still point to `http://localhost:5174/` and need the deployed Fitness address. |
| SPA fallback | Open | Admin and Eduyarp use path routing; the host must serve `index.html` for unknown paths. |
| StudentAQ Google Form | Open | `googleForm.formId` and field entry IDs in `data.js` are empty, so the form is not connected yet. |
| Company contact details | Open | The Eduyog contact section is a placeholder until real details are supplied. |
| Platform URLs | Open | Saritex, StudentAQ, Eduyarp and Fitness URLs live in the database platform records, not in the repository. They must be entered or checked in production Admin. |
| Course images are external URLs | By design | Only the address is stored. Availability and licensing depend on where the image is hosted. There is no upload or media storage. |
| Temporary demo content | Open | Demo courses, their artwork mapping, sample videos and dashboard data must be reviewed or removed before launch. |
| Admin dashboard queries | Accepted | It loads seven existing list endpoints (no pagination) and calculates in the browser rather than using a dedicated summary endpoint; fine at Phase 1 scale, to be replaced by an aggregate endpoint if data grows. |
| No pagination | Accepted | List endpoints return everything. Enrolment search and filters run in the browser on the loaded list. |
| Sessions | Accepted | JWT access token only (about 1 hour); no refresh token and no server-side logout. A password change invalidates tokens issued before it (compared in whole seconds). |
| Progress model | Accepted | Progress belongs to student + topic, so it survives cancellation and re-enrolment; completed topics cannot be un-marked. |
| Trainer area is a foundation | Accepted | Trainers can view assigned courses, current students and progress. They cannot edit curriculum, message students or grade work; notifications, announcements, assignments, resources and certificates are not implemented. |
| Notifications are in-app only | By design | No e-mail, SMS, WhatsApp or push, no polling and no live updates. The bell refreshes on sign-in, page changes, when the window regains focus, and after actions. |
| Class notifications are best effort | Accepted | Sent after the class change is saved; if that fails it is logged and the class stays saved (no retry or queue). Marking a class completed, or editing only its title or trainer, does not notify. Times in notification text are in UTC. |
| Deleting an announcement | Accepted | Notifications already sent stay in people's lists (they link to the announcements page, where the deleted item is gone). |
| Announcements list size | Accepted | The newest 200 are returned; there is no pagination. |
| Certificates are printable HTML | By design | Printed or saved as PDF with the browser's print dialog. No PDF generation, QR code, digital signature or file storage; **public certificate verification is not implemented**. The certificate makes no accreditation or recognition claims. |
| Certificates for past completions | Accepted | Enrolments completed before migration 011 do not receive certificates automatically; a deliberate one-off back-fill would be a separate decision. |
| Certificate rules | Accepted | Revocation cannot be undone. There is no certificate notification and Trainers cannot see certificates. |
| Assignments are text and links | By design | No file uploads or attachments, no grades or marks, no quizzes, no automatic grading. Students cannot edit or delete a submission; they submit again. |
| Assignment notifications | Accepted | Only Trainers are notified of new submissions; students are not notified when feedback arrives or an assignment is published (they see it on the course page). Admin has no notification for submissions. |
| Feedback authorship | Accepted | Feedback shows the last author; there is no feedback history. Admin can write feedback through the API but the Admin screen shows feedback read only. |
| Resources are links | By design | No file upload, storage or embedding; availability and licensing depend on the linked site. Videos open as ordinary links. |
| Deleting a module or topic | Accepted | Also deletes the learning resources attached to it. |
| FAQ ordering | Accepted | A simple `display_order` number; the Admin page offers up/down for FAQs and a number field for resources. Resources are listed course-wide first, then by module and topic order. |
| Trainers and FAQs | By design | Trainers can read FAQs but not change them. |
| Profile image | By design | URL only, no upload; availability depends on the host. |
| Password reset / e-mail verification | Deferred | Not implemented; a forgotten password needs an Admin-assisted fix. |
| Eduyog fonts | Minor | The Eduyog website loads Inter from Google Fonts (an external request). |
| Automated tests | Partial | Backend suite only (section 13); no frontend unit tests or automated browser tests. |

---

## 15. Phase 1 Scope

### Implemented in Phase 1
- Eduyog, Saritex and StudentAQ websites; Fitness, Eduyarp and Admin applications; one shared API and database.
- Registration, login, three roles, Admin role management, last-Admin protection, user profiles, password change, Admin profile management.
- Eduyarp: catalogue, course pages, enrolment, dashboard, learning page, modules and topics, optional YouTube/Vimeo topic videos, topic completion and progress, enrolment cancellation and re-enrolment, trainer assignment, live-class schedule, optional course cover image and icon (by URL).
- Admin: platforms, services, users and roles, Fitness leads, full Eduyarp management, enrolment search/filter/cancel, and an operational Dashboard.
- Trainer dashboard foundation: assigned courses, read-only curriculum, current students and per-student progress.
- Course completion certificates: automatic, uniquely numbered, printable, with Admin revocation.
- Assignments with text/link submissions, resubmission, late flagging and written trainer feedback.
- Course FAQs and URL-based learning resources, managed by Admin (and resources by assigned Trainers) and shown to enrolled Students.
- In-app notifications and announcements: platform-wide (Admin) and per-course (Admin and assigned Trainers), class scheduling notifications, bell and notifications page.
- Fitness business enquiries stored and visible to Admin.

### Deferred / future phase
Grading, marks, quizzes and messaging; e-mail/SMS/WhatsApp/push notifications; file and material uploads and cloud media storage; public certificate verification and downloadable PDFs; e-mail/SMS/WhatsApp automation; payments (fees are display-only); attendance; reviews and ratings; messaging; meeting-platform integration (class links are plain URLs); advanced analytics and recommendations; a content management system; a server-side activity/audit log; refresh tokens.

---

## 16. Production Checklist

### Before deployment
- [ ] Production PostgreSQL created (with TLS configured if required)
- [ ] Migrations 001–006 applied in order, once each
- [ ] Initial Admin created (`npm run setup:admin`)
- [ ] `NODE_ENV=production`, `JWT_SECRET` (32+ characters) and `FRONTEND_URL` (every deployed frontend origin) configured
- [ ] `VITE_API_BASE_URL` (Admin, Eduyarp) and `VITE_API_URL` (Fitness) set for production builds
- [ ] Eduyog `eduyog-api-base` meta tag set to the deployed API, and the "Become a Partner" links set to the deployed Fitness site
- [ ] Production rate limits chosen and applied
- [ ] `trust proxy` set correctly for the hosting setup
- [ ] SPA fallback configured for Admin and Eduyarp
- [ ] HTTPS configured; database backup strategy in place
- [ ] Demo data reviewed or removed (demo courses, artwork mapping, sample videos, dashboard seed)
- [ ] Real company contact information added to the Eduyog site
- [ ] Platform URLs for Saritex, StudentAQ, Eduyarp and Fitness entered in Admin and the links verified
- [ ] StudentAQ Google Form connected (`formId` and entry IDs) and one real submission tested
- [ ] Real course media added where wanted
- [ ] Fitness enquiry tested end to end
- [ ] Eduyarp student journey tested (register, enrol, learn, complete, progress)
- [ ] Admin journey tested (course, module, topic, trainer, class, publish, role change)
- [ ] Real-device and screen-reader spot checks

### Smoke test after deployment
Admin: sign in, create a course, add a module and topic, assign a Trainer, schedule a class, publish. Student: register, enrol, open the course, mark a topic complete, check progress. Role change: Student → Trainer and confirm the enrolment shows `cancelled`. Fitness: submit an enquiry and see it in Admin. Eduyog: confirm the platform links open.

---

## 17. How the Company Uses the System

### Add a course (no code change needed)
Admin → Eduyarp → Courses → **Add course**. Enter the title, slug (web address), description, level, fee, status, and optionally a **cover image URL** and **icon URL**. Then open the course and:
1. Add **modules**, then **topics** inside each module.
2. Optionally add a **YouTube or Vimeo URL** to a topic.
3. **Assign a Trainer** (first change the user's role to Trainer in Admin → Users).
4. Schedule **classes** in Admin → Eduyarp → Classes (the Trainer must be assigned to the course).
5. Set the status to **Published**.

### Common tasks
- **View or edit a user's profile:** Admin → Users → Profile.
- **Make someone a Trainer or Admin:** Admin → Users → change the role (a Student's active enrolments are cancelled).
- **Cancel an enrolment:** Admin → Eduyarp → Enrolments → find it (search or filters) → Cancel.
- **Remove a cover image or icon:** edit the course and use the remove / default-icon button, then save.
- **Change a platform link on the Eduyog site:** Admin → Platforms.
- **Read Fitness enquiries:** Admin → Fitness Leads.
- **Edit the StudentAQ site text:** `websites/studentaq/assets/js/data.js`.

---

## 18. Important Files

| File / directory | Purpose |
|---|---|
| `backend/server.js` | Starts the Express server; CORS, security headers, rate limits, route mounting |
| `backend/routes/` | API route definitions |
| `backend/controllers/` | Request handling |
| `backend/services/` | Business logic and database queries |
| `backend/middleware/` | Authentication and role checks, error handling |
| `backend/utils/` | Input validation (`validators.js`), video URL parsing (`videoUrl.js`), database helpers |
| `backend/scripts/setup-admin.js` | Creates the first Admin account |
| `database/schema/` | Ordered SQL migrations |
| `database/seed/` | Development and demo data |
| `apps/admin/` | Admin console; `src/pages/OverviewPage.jsx` is the dashboard, `src/utils/dashboard.js` its calculations |
| `apps/eduyarp/` | Learning platform; `src/pages/` holds the screens, `src/components/learn/` the learning workspace |
| `apps/eduyarp/src/utils/courseVisual.js` | Course icon matching and the **temporary** demo-artwork mapping |
| `apps/fitness/` | Fitness website and enquiry form |
| `websites/eduyog/` | Main marketing website (`index.html`, `styles.css`, `script.js`, `images/`) |
| `websites/saritex/` | Saritex website |
| `websites/studentaq/` | StudentAQ website (`assets/js/data.js` holds its content) |

---

## 19. Local Development

Prerequisites: Node.js and PostgreSQL. Copy `backend/.env.example` to `backend/.env` and fill in local values.

```bash
# Backend (http://localhost:5000)
cd backend && npm install && npm run dev        # npm start for plain node
npm run setup:admin                              # one-off: create the first Admin

# Admin     (http://localhost:5173)  cd apps/admin    && npm install && npm run dev
# Fitness   (http://localhost:5174)  cd apps/fitness  && npm install && npm run dev
# Eduyarp   (http://localhost:5175)  cd apps/eduyarp  && npm install && npm run dev
```

Ports are fixed. The static sites open as plain files or from any static server (a static server's origin, for example `http://localhost:5500`, must be listed in `FRONTEND_URL` for the Eduyog page to call the API). StudentAQ can be served with `python3 -m http.server 5180` from `websites/studentaq`.

### Environment variables (names only)

| Where | Variable | Notes |
|---|---|---|
| Backend | `JWT_SECRET` | Required, 32+ characters |
| Backend | `FRONTEND_URL` | Comma-separated exact origins; required in production |
| Backend | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| Backend | `NODE_ENV`, `PORT`, `JWT_EXPIRES_IN` | Optional (defaults: development, 5000, 1h) |
| Admin, Eduyarp | `VITE_API_BASE_URL` | Includes `/api`; build-time |
| Fitness | `VITE_API_URL` | API origin without `/api`; build-time |
| Fitness | `VITE_EDUYOG_URL` | Optional "Back to Eduyog" link |
