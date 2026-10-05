# Eduyog Techno Solution — Phase 1 Status

Last audited: 2026-10-03 (repository audit of the `master` working tree).

Evidence labels used in this document:

- **Inspected** — confirmed by reading the code/config in this repository.
- **Run** — executed during the audit (builds, lint, syntax checks).
- **Reported** — results from earlier test runs that are *not* reproducible from the repository (see section 12).
- **Not verified** — requires a deployment environment that is not part of the repository.

---

## 1. Executive Summary

Phase 1 is a working prototype for company confirmation. It delivers:

- A public marketing site (Eduyog) that links to the education platforms.
- Static sites for Saritex and StudentAQ, linked through the Admin-managed platform list.
- A React Fitness site that stores business enquiries in PostgreSQL.
- **Eduyarp**, a basic LMS: course catalogue, enrolment, modules/topics, topic completion, progress, class schedule, and Trainer assignment.
- A React Admin panel for platforms, services, users/roles, Fitness leads, and Eduyarp management.
- A Node.js/Express API with JWT authentication and Student / Trainer / Admin role-based access.

| Level of evidence | Status |
|---|---|
| Implemented | All Phase 1 scope items below (code inspected). |
| Build / lint / syntax | Passed in this audit: Eduyarp, Admin, Fitness builds; Eduyarp and Admin lint; syntax check of every backend `.js` file. |
| Automated tests | **Reported**: Eduyarp API tests 116/116 and browser acceptance 33/33 against temporary databases. The test code is **not in the repository** (backend `npm test` is a placeholder), so these cannot be re-run from this repo. |
| Manual local testing | **Reported**: full local journey incl. role change, cancellation, re-enrolment, Fitness enquiry → Admin, and running Admin + Eduyarp + Fitness together. |
| Production | **Not production-tested.** No deployment configuration exists in the repository. See section 16 and the blockers listed in section 16.1. |

Phase 1 should be described as **feature-complete for its defined scope and locally verified**, with deployment configuration still to be done by the team (section 16).

---

## 2. Architecture

```
eduyog-platform/
├── websites/   Static sites: eduyog, saritex, studentaq (HTML/CSS/JS)
├── apps/       React + Vite apps: fitness, eduyarp, admin
├── backend/    Node.js + Express API (single backend shared by all apps)
├── database/   PostgreSQL schema migrations and demo seed
└── assets/     Images and media (shared + per site/app)
```

| Part | Role |
|---|---|
| `websites/eduyog` | Public company site. Fetches `GET /api/platforms` to attach "Learn more" links to the three education cards. |
| `websites/saritex` | Existing static academic-support site. Own contact flow (WhatsApp, email, third-party form). Does not call the backend. |
| `websites/studentaq` | Existing static study-abroad site. Uses Google Forms. Does not call the backend. |
| `apps/fitness` | Public Fitness business site with an enquiry form → `POST /api/fitness-leads`. |
| `apps/eduyarp` | Student-facing LMS (catalogue, enrolment, learning view, dashboard). |
| `apps/admin` | Admin panel; the only place roles are assigned and Eduyarp content is managed. |
| `backend/` | Layered: routes → controllers → services → PostgreSQL (`pg` pool). Middleware: `authenticate`, `requireAdmin`, `requireRole`, `errorHandler`. |
| `database/` | Sequential SQL files `001`–`005` plus a development-only demo seed. |

Browser apps talk to one backend; there is no server-side rendering or monorepo tooling.

## 3. Technology Stack

Inspected from `package.json` files.

| Layer | Technology |
|---|---|
| Static sites | HTML, CSS, JavaScript |
| Apps | React 19 + Vite 8 (JavaScript, no TypeScript). Client routing is custom (History API on `pathname`), no router library. |
| Backend | Node.js (CommonJS), Express 5, `helmet`, `cors`, `express-rate-limit`, `dotenv`, `pg` |
| Auth | `jsonwebtoken` (HS256 access tokens), `bcryptjs` (12 rounds) |
| Database | PostgreSQL 13+ (per migration headers) |
| Lint | ESLint 10 (Admin, Eduyarp only; Fitness and backend have no lint script) |

Not used (project rule): Next.js, NestJS, Prisma, Turborepo.

---

## 4. Applications

### Eduyog
Public company website. Static. Reads the API base from `<meta name="eduyog-api-base">` in `index.html` (falls back to `script.js` default). **Both currently contain `http://localhost:5000/api` and must be changed for production** (section 16).

### Saritex
Static site under `websites/saritex`. Integration is via the Admin → Platforms record (deployed URL stored in the database, not in this repo). The site itself uses WhatsApp links and a third-party form action. Not modified in Phase 1 beyond import. Deployed URL: **not recorded in the repository**; configured in Admin.

### StudentAQ
Static site under `websites/studentaq`, using Google Forms. Same integration model as Saritex. Deployed URL: **not recorded in the repository**; configured in Admin.

### Fitness
React app (dev port 5174). Landing page with About, Services, Contact and a business enquiry form (business name, contact name, email, business type, location, services offered, marketing requirements, website links, marketing objectives, additional requirements). Submissions go to `POST /api/fitness-leads` (public, rate-limited to 10 per hour per client) and appear in Admin → Fitness Leads.

### Eduyarp
React app (dev port 5175). Public catalogue and course detail; Student registration/login; Student dashboard (My Courses, progress, upcoming classes); course learning page with module/topic list and "mark complete".

### Admin
React app (dev port 5173). Admin-only. Pages: Overview, Platforms, Services, Users (role change), Fitness Leads, Eduyarp Courses (+ course detail with modules, topics, trainers), Eduyarp Trainers, Eduyarp Enrolments, Eduyarp Classes.

---

## 5. Eduyarp Phase 1 Features

| Feature | Status |
|---|---|
| Public course catalogue (published only) | ✅ Implemented |
| Published course detail by slug | ✅ Implemented |
| Student registration / login (existing auth) | ✅ Implemented |
| Student dashboard, My Courses | ✅ Implemented |
| Modules and topics (ordered by `display_order`) | ✅ Implemented |
| Topic completion + progress % | ✅ Implemented |
| Enrolment (published courses only) | ✅ Implemented |
| Enrolment cancellation on role change; re-enrolment | ✅ Implemented (migration 004) |
| Class schedule + upcoming classes for Students | ✅ Implemented |
| Admin course / module / topic CRUD | ✅ Implemented |
| Optional external video per topic (YouTube / Vimeo) | ✅ Implemented (migration 005; **not yet run in a browser**, API-tested against a temporary DB) |
| Admin Trainer assignment | ✅ Implemented |
| Admin enrolment visibility (incl. cancelled) | ✅ Implemented |
| Admin class management | ✅ Implemented |
| Trainer read-only view of an assigned course (API) | ✅ Implemented (API only, no Trainer UI) |
| Un-marking a completed topic | ⚠️ Limitation: not supported |
| Progress tied to student+topic, not enrolment | ⚠️ Limitation (accepted design) |
| Pagination on lists | ⚠️ Limitation: none |
| Trainer dashboard UI, assignments, uploads, certificates, notifications, payments, attendance, reviews, messaging, video, Zoom/Meet API | ❌ Out of scope |

## 6. Eduyarp User Journey

**Admin** (Admin app)
1. Sign in with an Admin account (first Admin created with `npm run setup:admin`).
2. Eduyarp → Courses → create course (starts as `draft`).
3. Open course → add modules → add topics.
4. Users → change a registered Student's role to Trainer.
5. Course detail → assign the Trainer.
6. Eduyarp → Classes → schedule a class (Trainer must be assigned to the course).
7. Set course status to `published`.

**Student** (Eduyarp app)
1. Register (creates a Student) and sign in.
2. Browse published courses; open a course.
3. Enrol.
4. Dashboard → My Courses → open the course.
5. View modules/topics; mark topics complete; progress updates.
6. Upcoming classes appear on the dashboard (from the start of the current day onward).

---

## 7. Authentication and RBAC

- `POST /api/auth/register` always creates a **Student** (role is not accepted from the client).
- `authenticate` verifies the HS256 JWT (`Authorization: Bearer`), then **loads the user from the database on every request**, so role changes and deleted accounts take effect immediately. The role in `req.user` comes from the database, not the token.
- Student routes use `requireRole('student')` and always scope by `req.user.id`; the client never supplies a `student_id`.
- Trainer route uses `requireRole('trainer')` and then checks the `course_trainers` table (403 if not assigned).
- All `/api/admin/*` routes use `authenticate` + `requireAdmin` (401 / 403).
- Last-Admin protection: `changeUserRole` locks admin rows and refuses to demote the only Admin (409).
- Public routes return published courses only; a Student asking for a course they are not currently enrolled in gets 404.

### Role transitions (single DB transaction with the role update)

| Change | Effect on Eduyarp enrolments |
|---|---|
| Student → Trainer | `active` → `cancelled` |
| Student → Admin | `active` → `cancelled` |
| Trainer/Admin → Student | Nothing restored |
| Any | `completed` and already `cancelled` unchanged; topic progress never deleted |

If cancellation fails, the role change rolls back.

## 8. Enrolment Lifecycle

| Status | Access | Notes |
|---|---|---|
| `active` | Yes | Default on enrol. |
| `completed` | Yes | Set automatically when all topics are done; reverts to `active` if a topic is added (re-derived on curriculum change). |
| `cancelled` | No | History only; visible to Admin; API returns 404 to the Student. |

- A partial unique index allows one `active`/`completed` enrolment per student+course and any number of `cancelled` rows, so a Student can **re-enrol** after cancellation (status is re-derived immediately from existing progress).
- `topic_progress` is keyed by `(student_id, topic_id)`; progress therefore **survives cancellation and re-enrolment** (accepted Phase 1 design).
- Courses with any enrolment (including cancelled) cannot be deleted (`ON DELETE RESTRICT` → 409); archive them instead.

---

## 9. Database

Apply in this order on a fresh database: **001 → 002 → 003 → 004 → 005**. Each file runs in one transaction and is intentionally **not idempotent**: running a file twice fails (004 and 005 must not be run twice). The user's local database already has 004 applied; nothing in the repository indicates any migration has been applied to production.

| File | Purpose |
|---|---|
| `001_initial_schema.sql` | `users` (roles `student`,`admin`), `platforms`, `services`, `fitness_leads`, `set_updated_at()` trigger function, last-Admin partial index. |
| `002_add_fitness_lead_fields.sql` | Adds business_type, location, services_offered, marketing_requirements, website_links, marketing_objectives to `fitness_leads` (nullable, length checks). |
| `003_eduyarp.sql` | Adds `trainer` to `users_role_valid`; creates the Eduyarp tables. |
| `005_eduyarp_topic_video.sql` | Adds nullable `course_topics.video_url` (TEXT, max 2048). Stores the validated original URL only. |
| `004_eduyarp_enrolment_status.sql` | Adds `cancelled` status; replaces the plain unique constraint with a partial unique index; adds `enrolments_student_idx`. |

### Eduyarp tables (Inspected)

| Table | PK | Foreign keys / key constraints |
|---|---|---|
| `courses` | `id` | `slug` UNIQUE + format check; `level` ∈ beginner/intermediate/advanced; `status` ∈ draft/published/archived; `fee >= 0` (INR, no payments); index on `status` |
| `course_modules` | `id` | `course_id → courses` CASCADE; index `(course_id, display_order, id)` |
| `course_topics` | `id` | `module_id → course_modules` CASCADE; index `(module_id, display_order, id)` |
| `course_trainers` | `(course_id, trainer_id)` | `course_id → courses` CASCADE; `trainer_id → users` CASCADE; index on `trainer_id` |
| `enrolments` | `id` | `course_id → courses` RESTRICT; `student_id → users` RESTRICT; `status` ∈ active/completed/cancelled; **partial unique index `enrolments_student_course_key (student_id, course_id) WHERE status IN ('active','completed')`**; indexes on `course_id`, `student_id` |
| `topic_progress` | `id` | `student_id → users` CASCADE; `topic_id → course_topics` CASCADE; UNIQUE `(student_id, topic_id)`; check `completed = (completed_at IS NOT NULL)` |
| `classes` | `id` | `course_id → courses` CASCADE; `trainer_id → users` RESTRICT; `status` ∈ scheduled/completed/cancelled; `meeting_link` must be http(s) URL; indexes `(course_id, scheduled_at)`, `trainer_id` |

`users.role` ∈ `student`, `trainer`, `admin`. Application code (not the database) requires that a class's trainer is assigned to the class's course and that assigned Trainers have the `trainer` role.

Note: `users.role` check and `enrolments` status check constraints are replaced by `DROP CONSTRAINT` + `ADD CONSTRAINT`; this relies on the default constraint names from 001/003, which is correct for databases built from these files.

---

## 10. API Reference

Inspected from `backend/routes/*.js`. Base path `/api`. Errors use `{ "error": { "message", "details?" } }`.

### Health
- `GET /api/health`

### Auth
- `POST /api/auth/register` (limited: 20 / 15 min per client)
- `POST /api/auth/login` (same limiter)
- `GET /api/auth/me` (authenticated)

### Platforms
- Public: `GET /api/platforms` (active platforms)
- Admin: `GET|POST /api/admin/platforms`, `GET|PATCH|DELETE /api/admin/platforms/:id`
- Admin services: `GET|POST /api/admin/services`, `GET|PATCH|DELETE /api/admin/services/:id`

### Users (Admin)
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/role`

### Fitness
- Public: `POST /api/fitness-leads` (10 / hour per client)
- Admin: `GET /api/admin/fitness-leads`, `GET /api/admin/fitness-leads/:id`

### Eduyarp — Public
- `GET /api/eduyarp/courses`
- `GET /api/eduyarp/courses/:slug`

### Eduyarp — Student
- `POST /api/eduyarp/courses/:courseId/enrol`
- `GET /api/eduyarp/me/courses`
- `GET /api/eduyarp/me/courses/:courseId`
- `GET /api/eduyarp/me/schedule`
- `POST /api/eduyarp/topics/:topicId/complete`

### Eduyarp — Trainer (read-only)
- `GET /api/eduyarp/trainer/courses/:courseId` (must be assigned)

### Eduyarp — Admin (`/api/admin/eduyarp`)
- Courses: `GET /courses`, `POST /courses`, `GET|PATCH|DELETE /courses/:id`
- Modules: `POST /courses/:courseId/modules`, `PATCH|DELETE /modules/:id`
- Topics: `POST /modules/:moduleId/topics`, `PATCH|DELETE /topics/:id` (optional `videoUrl`: YouTube/Vimeo URL, or `null`/empty to remove; other providers, HTML and `javascript:`/`data:` URLs return 400)
- Trainers: `GET /trainers`, `POST /courses/:courseId/trainers`, `DELETE /courses/:courseId/trainers/:trainerId`
- Enrolments: `GET /enrolments`
- Classes: `GET /classes`, `POST /classes`, `PATCH|DELETE /classes/:id`

The list above matches the expected endpoint set exactly; no additional or missing Eduyarp routes were found.

## 11. Frontend Routes

Client routing uses real URL paths (not hash), so production hosting **must rewrite unknown paths to `index.html`** (SPA fallback).

**Eduyarp** — `/`, `/courses` (catalogue); `/courses/:slug`; `/login`, `/register` (signed-out only); `/dashboard` (Student); `/my-courses/:courseId` (Student). Non-Student accounts see a "This area is for students" page.

**Admin** (all require Admin except `/login`) — `/`, `/platforms`, `/services`, `/users`, `/fitness-leads`, `/eduyarp/courses`, `/eduyarp/courses/:id`, `/eduyarp/trainers`, `/eduyarp/enrolments`, `/eduyarp/classes`.

**Fitness** — single page (sections: hero, about, services, contact/enquiry form).

**Eduyog** — static `index.html` (single page).

---

## 12. Testing

| Check | Result | Evidence |
|---|---|---|
| `node --check` on every backend `.js` file | Passed | **Run** in this audit |
| `apps/eduyarp`: `npm run build`, `npm run lint` | Passed | **Run** |
| `apps/admin`: `npm run build`, `npm run lint` | Passed | **Run** |
| `apps/fitness`: `npm run build` | Passed (no lint script) | **Run** |
| Eduyarp API tests | 116/116 | **Reported** (earlier run, temporary databases; test code not in repo) |
| Browser acceptance journey | 33/33 | **Reported** (earlier run, temporary databases; test code not in repo) |
| Manual local integration (Admin + Eduyarp + Fitness together, role change → cancellation, re-enrolment, progress preserved, Fitness enquiry → Admin) | Passed | **Reported** |
| Running API/database in this audit | Not performed | No database was touched. |

The repository has no test files. Re-running the reported suites requires the original test harness.

## 13. Local Development

Prerequisites: Node.js, PostgreSQL. Copy `backend/.env.example` to `backend/.env` and fill in local values.

```bash
# Backend (http://localhost:5000)
cd backend
npm install
npm run dev            # node --watch server.js   (npm start for plain node)

# Create the first Admin (one-off; refuses if an Admin exists)
npm run setup:admin

# Admin (http://localhost:5173)
cd apps/admin && npm install && npm run dev

# Fitness (http://localhost:5174)
cd apps/fitness && npm install && npm run dev

# Eduyarp (http://localhost:5175)
cd apps/eduyarp && npm install && npm run dev
```

Other scripts: `npm run build`, `npm run preview` (all apps); `npm run lint` (Admin, Eduyarp). Ports are fixed (`strictPort`). The Eduyog and other static sites are opened as plain files or via any static server (note: a static server origin such as `http://localhost:5500` must be in `FRONTEND_URL` for the Eduyog page to call the API).

## 14. Database Setup

No migration runner exists; apply files with `psql`, in order, once each:

```bash
psql -h localhost -U <db_user> -d <db_name> -f database/schema/001_initial_schema.sql
psql -h localhost -U <db_user> -d <db_name> -f database/schema/002_add_fitness_lead_fields.sql
psql -h localhost -U <db_user> -d <db_name> -f database/schema/003_eduyarp.sql
psql -h localhost -U <db_user> -d <db_name> -f database/schema/004_eduyarp_enrolment_status.sql
```

An existing database that already has 001–004 needs only 005:

```
psql -h localhost -U <db_user> -d <db_name> -f database/schema/005_eduyarp_topic_video.sql
```

An existing database that already has 001–003 needs only 004. Do **not** re-run any file.

**DEVELOPMENT ONLY — demo seed:** `database/seed/eduyarp_demo.sql` inserts four demo published courses (titles marked `[Demo]`). It aborts if any course exists. Never run it against production.

## 15. Environment Variables

Names only. Source: `backend/.env.example`, `backend/config/env.js`, app `.env.example` files.

**Backend (`backend/.env`; the file at the project root is a reference list only — the backend does not read it)**

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | Yes (all envs) | ≥ 32 chars; placeholder rejected at startup |
| `FRONTEND_URL` | Yes in production | Comma-separated exact origins, no path / trailing slash; startup fails otherwise. Dev default: `http://localhost:5173,5174,5175` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Yes in practice | Unset values fall back to `pg`/`PG*` defaults |
| `NODE_ENV` | Recommended | `development` (default), `production`, `test` |
| `PORT` | Optional | Default 5000 |
| `JWT_EXPIRES_IN` | Optional | e.g. `1h` (default) |

**Frontends (build-time, `VITE_*`, public)**

| App | Variable | Notes |
|---|---|---|
| Admin | `VITE_API_BASE_URL` | Includes `/api`. **Falls back silently to `http://localhost:5000/api`** if unset, even in a production build |
| Eduyarp | `VITE_API_BASE_URL` | Same behaviour |
| Fitness | `VITE_API_URL` | Origin without `/api`; production build has no fallback (enquiries fail with an error if unset) |
| Fitness | `VITE_EDUYOG_URL` | Optional; "Back to Eduyog" link hidden if empty |

Development-specific: localhost defaults above. Production-specific: `NODE_ENV=production`, `FRONTEND_URL`, all `VITE_*` values.

---

## 16. Deployment Checklist

Status key: **VERIFIED** (inspected/run in this audit), **NEEDS USER ACTION**, **N/A**.

### 16.1 Production readiness

| Item | Status | Detail |
|---|---|---|
| Backend syntax | VERIFIED | `node --check` passes for all files |
| Frontend builds | VERIFIED | Eduyarp, Admin, Fitness build; Eduyarp and Admin lint clean |
| Migrations 001–004 present and ordered | VERIFIED | Files inspected; each wrapped in a transaction |
| Migrations applied to production DB | NEEDS USER ACTION | Not applied; no production DB known |
| Database connection | NEEDS USER ACTION | Pool reads `DB_*`; **no SSL option is configured** in `config/database.js`. If the hosted PostgreSQL requires TLS, this needs a code/config change |
| JWT secret | VERIFIED (logic) / NEEDS USER ACTION (value) | Startup rejects missing, placeholder, or < 32-char secrets. Set a production value |
| CORS | VERIFIED (logic) / NEEDS USER ACTION (value) | Exact-origin allow-list from `FRONTEND_URL`; required and validated in production; unlisted origins get no CORS headers. List every deployed frontend origin: Admin, Eduyarp, Fitness, Eduyog |
| Frontend API URLs | NEEDS USER ACTION | Set `VITE_API_BASE_URL` (Admin, Eduyarp), `VITE_API_URL` (Fitness) and edit the Eduyog meta tag (see 16.2) |
| Production rate limit | **ISSUE — see 16.2** | Global limit is 1000 / 15 min in **all** environments; there is no separate stricter production value |
| NODE_ENV | NEEDS USER ACTION | Must be set to `production`; this is what makes `FRONTEND_URL` mandatory |
| PORT | NEEDS USER ACTION | Defaults to 5000; most hosts inject their own |
| HTTPS | NEEDS USER ACTION | App serves plain HTTP and relies on a TLS-terminating host/proxy; `helmet()` is enabled; no HSTS/redirect logic of its own |
| Reverse proxy / client IP | NEEDS USER ACTION | `trust proxy` is not set. Behind a proxy all clients may share one IP, making the rate limiters (global, login 20/15 min, enquiries 10/h) act on the proxy address |
| SPA fallback hosting | NEEDS USER ACTION | Admin and Eduyarp use path routing; host must rewrite unknown paths to `index.html` |
| Error handling | VERIFIED | Central handler; unexpected errors return generic 500 and are logged |
| Auth configuration | VERIFIED | HS256 pinned on verify; bcrypt 12 rounds; DB-loaded user per request |
| Seed usage | VERIFIED | Demo seed is separate, guarded, and not run by any script |
| First Admin | NEEDS USER ACTION | Run `npm run setup:admin` against the production DB |
| Hosting provider | NEEDS USER ACTION | No provider information in the repository; none assumed |
| Saritex / StudentAQ URLs | NEEDS USER ACTION | URLs live in the database platform records; re-enter/verify in production Admin |

### 16.2 Findings that must be addressed before deployment

1. **Rate limiter has no production/development distinction** — `backend/server.js` sets `limit: 1000` per 15 minutes for every environment. Development works as intended, but production is not stricter than development. Decide on a production value (the original value was 100) and apply it via `NODE_ENV` or an environment variable. This audit did not change code.
2. **Eduyog site hardcodes the API base** — `websites/eduyog/index.html` (`<meta name="eduyog-api-base">`) and the `DEFAULT_API_BASE` in `websites/eduyog/script.js` are `http://localhost:5000/api`. Update the meta tag at deploy time. Without it, platform links will not load in production.
3. **Admin/Eduyarp API URL fallback** — `apps/admin/src/config.js` and `apps/eduyarp/src/config.js` fall back to `http://localhost:5000/api` in production builds if `VITE_API_BASE_URL` is unset. Always set it for production builds.

### 16.3 Steps

**Database**
- Create the production database; run 001–004 in order (once each); verify tables and the `enrolments_student_course_key` partial index; do not run the demo seed.

**Backend**
- Set `NODE_ENV=production`, `FRONTEND_URL`, `JWT_SECRET`, `DB_*`, `PORT` (if needed); address 16.2(1); start with `npm start`; verify `GET /api/health` returns `{"status":"ok"}`; create the first Admin.

**Frontends**
- Set the API URL variables; `npm run build` in each app; deploy `dist/`; configure SPA fallback; update the Eduyog meta tag; verify deep links (e.g. `/eduyarp/courses`, `/my-courses/1`).

**Smoke test**
- Admin: login → create course → add module/topic → assign Trainer → schedule class → publish.
- Student: register → login → enrol → complete topic → verify progress → verify schedule.
- Role transition: Student → Trainer, verify enrolment shows `cancelled` in Admin and the Student's course access is gone.
- Fitness: submit enquiry → verify it appears in Admin → Fitness Leads.
- Existing platforms: verify Saritex and StudentAQ links open from the Eduyog site.

---

## 16.2 Topic videos (Phase 1.1)

- Admin can add an optional external video URL to a topic (Admin topic form → "Video URL (optional)"); leaving it empty removes the video.
- Only YouTube (`watch?v=`, `youtu.be/`, `/embed/`) and Vimeo (`vimeo.com/<id>`, `player.vimeo.com/video/<id>`) are accepted. The backend (`backend/utils/videoUrl.js`) validates host and video id and derives the embed URL (`youtube-nocookie.com/embed/<id>` or `player.vimeo.com/video/<id>`); the database stores only the original URL. No raw HTML or arbitrary iframe sources.
- API: topics carry `videoUrl` and `videoEmbedUrl` for Admin, assigned Trainer and enrolled Student responses. The public catalogue never includes them. Access follows existing rules (cancelled enrolments get no access; completed keep it).
- Students watch the video inside the topic on the learning page. Watching does **not** mark a topic complete; the Student still clicks "Mark complete". No watch tracking.
- No video hosting, uploads or storage exist.

## 16.3 Admin enrolment management

- Admin → Eduyarp → Enrolments has a search box (student name, email, course title; case-insensitive, partial), a status filter (All / Active / Completed / Cancelled), a course filter (courses present in the loaded data, unique, sorted by title) and "Clear filters". Filters combine (AND). Filtering is client-side on the already-loaded list: no extra API requests while typing, no pagination or server-side search.
- Active enrolments have a **Cancel** action with a confirmation dialog ("Keep enrolment" / "Cancel enrolment"). Completed and cancelled rows show no action.
- API: `PATCH /api/admin/eduyarp/enrolments/:id` with `{"status":"cancelled"}` (Admin only). Single conditional update (`status = 'active'`); 404 if not found, 409 if the enrolment is completed or already cancelled, 400 for any other body. Topic progress and other enrolments are untouched. No migration.
- Cancelled enrolments remain as historical records; there is no permanent enrolment deletion. A student can enrol again, creating a new active row.
- Verified by a scripted API run against a temporary database and a unit run of the filter functions; browser/UI behaviour (including mobile layout) has not been run in a browser.

## 17. Known Limitations

- No full Trainer Dashboard (Trainer API is one read-only endpoint; no Trainer UI).
- No materials / file uploads, assignments, certificates, payments, notifications, attendance, reviews, messaging, video infrastructure.
- No pagination on list endpoints.
- Completed topics cannot be unmarked.
- Progress belongs to student + topic, not to an enrolment; it is retained on re-enrolment.
- Cancelled enrolments remain as history; a course with any enrolment (even cancelled) cannot be deleted and must be archived.
- No automated tests are stored in the repository.
- JWT access token only (default 1 h); no refresh tokens or logout invalidation on the server.
- `backend/.env.example` and the root `.env.example` differ (root file is a reference list and is not read by the backend).
- Root `README.md` still states "Directory structure only. No application code has been written yet." and is out of date.

## 18. Explicitly Out of Scope

Full Trainer Dashboard; assignments and submissions; trainer feedback; file/material uploads; cloud storage; certificates; notifications; payments; attendance; reviews/ratings; messaging/chat; video hosting; Zoom/Google Meet integration; advanced analytics; recommendation engine; email/SMS/WhatsApp automation; full CMS; SEO management; website ZIP upload.

## 19. Phase 2 Candidates

Only items already named as out-of-scope by the Phase 1 requirements: Trainer Dashboard, assignments and feedback, material uploads with cloud storage, certificates, notifications, payments, attendance, reviews, and meeting-platform integration. No work on these has been started.
