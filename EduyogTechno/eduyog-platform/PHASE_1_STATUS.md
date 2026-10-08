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
- Contact details are a placeholder ("Contact details coming soon") until the company confirms real ones.
- The API base URL is read from `<meta name="eduyog-api-base">` in `index.html`.

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
- **Accounts:** registration and login create **Student** accounts.
- **Enrolment, dashboard and learning:** a Student enrols in a published course, sees their courses, progress and upcoming live classes on a dashboard, and studies on a learning page with a course outline (modules and topics), previous/next navigation, an optional video, and a "Mark complete" action.
- **Course visuals:** each course card, detail page and learning header shows the course's own cover image and icon if the Admin set them, otherwise the default gradient and icon (section 10).
- **Topic videos:** YouTube and Vimeo only (section 9).
- The four temporary demo courses use local SVG artwork matched by slug (`apps/eduyarp/src/utils/courseVisual.js`); this mapping is temporary and can be deleted at handover.
- Not included: Trainer UI, payments, uploads, assignments, certificates (section 15).

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
| Eduyarp → Classes | Schedule, edit and delete live classes (the Trainer must be assigned to the course). |

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

There is no migration after 006. To bring an existing database up to date, apply only the files it is missing, for example:

```
psql -h localhost -U <db_user> -d <db_name> -f database/schema/006_eduyarp_course_media.sql
```

Migrations 001–006 apply cleanly in order on an empty database (verified on a temporary database). No migration has been applied to any production database.

---

## 8. Authentication and Roles

- **Registration** (`POST /api/auth/register`) always creates a **Student**; the client cannot choose a role. Only an Admin can change roles (Admin → Users).
- **Sessions:** the API issues a signed JWT (default lifetime 1 hour). On **every request** the backend re-loads the user from the database, so role changes and deleted accounts take effect immediately. There are no refresh tokens.
- **Student** routes always act on the signed-in Student's own data; a Student can only see courses they currently have an active or completed enrolment in.
- **Trainer** access is limited to courses the Trainer is assigned to (one read-only API route exists; there is no Trainer user interface).
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
| Trainer | `GET /api/eduyarp/trainer/courses/:courseId` (must be assigned) |
| Admin platform data | `/api/admin/platforms`, `/api/admin/services` (list, create, get, update, delete); `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`; `GET /api/admin/fitness-leads[/:id]` |
| Admin Eduyarp | `/api/admin/eduyarp/…` — courses (list, create, get, update, delete); modules and topics (create under parent, update, delete); trainers (`GET /trainers`, assign and unassign on a course); `GET /enrolments`, `PATCH /enrolments/:id` (`{"status":"cancelled"}` only); classes (list, create, update, delete) |

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

There is no automated test suite stored in the repository (`npm test` in the backend is a placeholder). The checks below were run by hand or with throw-away scripts against **temporary databases and local servers**; the scripts are not part of the repository.

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
| Not yet verified | Real devices; screen readers; browsers other than Chrome; a production-like deployment; the StudentAQ Google Form against a real form; playback of videos (the right embed and attributes are verified, not playback itself) | Not verified |

---

## 14. Current Limitations

| Item | Status | Notes |
|---|---|---|
| Rate limit not environment-specific | Open | `backend/server.js` allows 1000 requests per 15 minutes in **every** environment; choose a stricter production value. |
| Client IP behind a proxy | Open | `trust proxy` is not set. Behind a proxy all clients can appear to share one address, so the rate limiters (global, login 20/15 min, enquiries 10/hour) act on the proxy. |
| Production database TLS | Open | `config/database.js` has no SSL option; add one if the hosted PostgreSQL requires TLS. |
| Localhost API fallbacks | Open | The Eduyog site (`index.html` meta tag and `script.js`) and the Admin and Eduyarp configs fall back to `http://localhost:5000/api`. Always set the production API URL. Fitness has no fallback in a production build. |
| SPA fallback | Open | Admin and Eduyarp use path routing; the host must serve `index.html` for unknown paths. |
| StudentAQ Google Form | Open | `googleForm.formId` and field entry IDs in `data.js` are empty, so the form is not connected yet. |
| Company contact details | Open | The Eduyog contact section is a placeholder until real details are supplied. |
| Platform URLs | Open | Saritex, StudentAQ, Eduyarp and Fitness URLs live in the database platform records, not in the repository. They must be entered or checked in production Admin. |
| Course images are external URLs | By design | Only the address is stored. Availability and licensing depend on where the image is hosted. There is no upload or media storage. |
| Temporary demo content | Open | Demo courses, their artwork mapping, sample videos and dashboard data must be reviewed or removed before launch. |
| Admin dashboard queries | Accepted | It loads seven existing list endpoints (no pagination) and calculates in the browser rather than using a dedicated summary endpoint; fine at Phase 1 scale, to be replaced by an aggregate endpoint if data grows. |
| No pagination | Accepted | List endpoints return everything. Enrolment search and filters run in the browser on the loaded list. |
| Sessions | Accepted | JWT access token only (about 1 hour); no refresh token and no server-side logout invalidation. |
| Progress model | Accepted | Progress belongs to student + topic, so it survives cancellation and re-enrolment; completed topics cannot be un-marked. |
| No Trainer interface | Deferred | Trainers have one read-only API route and no screens. |
| Eduyog fonts | Minor | The Eduyog website loads Inter from Google Fonts (an external request). |
| Automated tests | Open | None are stored in the repository. |

---

## 15. Phase 1 Scope

### Implemented in Phase 1
- Eduyog, Saritex and StudentAQ websites; Fitness, Eduyarp and Admin applications; one shared API and database.
- Registration, login, three roles, Admin role management, last-Admin protection.
- Eduyarp: catalogue, course pages, enrolment, dashboard, learning page, modules and topics, optional YouTube/Vimeo topic videos, topic completion and progress, enrolment cancellation and re-enrolment, trainer assignment, live-class schedule, optional course cover image and icon (by URL).
- Admin: platforms, services, users and roles, Fitness leads, full Eduyarp management, enrolment search/filter/cancel, and an operational Dashboard.
- Fitness business enquiries stored and visible to Admin.

### Deferred / future phase
Full Trainer dashboard; file and material uploads and cloud media storage; assignments, submissions and trainer feedback; certificates; notifications and e-mail/SMS/WhatsApp automation; payments (fees are display-only); attendance; reviews and ratings; messaging; meeting-platform integration (class links are plain URLs); advanced analytics and recommendations; a content management system; a server-side activity/audit log; refresh tokens.

---

## 16. Production Checklist

### Before deployment
- [ ] Production PostgreSQL created (with TLS configured if required)
- [ ] Migrations 001–006 applied in order, once each
- [ ] Initial Admin created (`npm run setup:admin`)
- [ ] `NODE_ENV=production`, `JWT_SECRET` (32+ characters) and `FRONTEND_URL` (every deployed frontend origin) configured
- [ ] `VITE_API_BASE_URL` (Admin, Eduyarp) and `VITE_API_URL` (Fitness) set for production builds
- [ ] Eduyog `eduyog-api-base` meta tag and `script.js` default no longer point to localhost
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
