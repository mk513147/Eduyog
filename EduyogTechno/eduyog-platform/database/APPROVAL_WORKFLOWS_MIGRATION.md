# Student approval, demo access, Admin-granted access and approved certificates

Migrations `schema/012_student_approval_and_course_access.sql` and `schema/013_certificate_requests.sql`.
They are forward-only and **have not been applied to any database by this change**. The test suite applies them to
throw-away local databases only.

## What they change

| Migration | Change | Existing data |
|---|---|---|
| 012 | `users.approval_status` (`pending` / `approved` / `rejected`, default `approved`) plus `approval_decided_at`, `approval_decided_by`, `approval_reason` | Every existing account becomes `approved` (the column default is the back-fill), so nobody is locked out |
| 012 | `enrolments.granted_by` (the Admin who granted access) | `NULL` for all existing enrolments |
| 012 | Plain index `enrolments_student_active_idx` | None. It is deliberately **not unique**: students who already hold several active enrolments keep them |
| 013 | New table `certificate_requests` (pending / approved / rejected, one pending per student and course, decided rows immutable) | Empty. No request is created for existing completions and `certificates` is untouched |

## Applying safely (manual step, for the person who owns the database)

1. Take a backup or snapshot of the target database first.
2. Apply in order, each in one transaction, stopping at the first error:
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f database/schema/012_student_approval_and_course_access.sql`
   then the same for `013_certificate_requests.sql`. Both files fail loudly if run twice.
3. Deploy the backend that contains this change **after** the migrations (the new code reads `approval_status`).
4. Verify: `SELECT approval_status, count(*) FROM users GROUP BY 1;` (all `approved`),
   `SELECT count(*) FROM certificate_requests;` (0), `SELECT count(*) FROM certificates;` (unchanged).

Rollback is not scripted (forward-only). Before any application traffic uses the new tables the changes can be undone by
hand (`DROP TABLE certificate_requests` and its functions; `ALTER TABLE users DROP COLUMN ...`), but only with a backup in hand.

## Behaviour implemented in the backend

* **Registration** creates a `pending` Student. The request cannot choose a role or status. Pending and rejected
  Students cannot sign in (403 after a correct password, with a neutral message) and an existing token stops working
  on the next request (401), because `authenticate` checks the status on every call. Trainers and Admins are never gated.
* **Admin**: `GET /api/admin/registrations?status=`, `PATCH /api/admin/users/:id/approval {status, reason?}`.
* **Demo**: `GET /api/eduyarp/courses/:courseId/demo` (approved Student). First two topics of the first module (modules and
  topics ordered by `display_order`, then `id`) include description and video; everything else is listed by title only.
  Published courses only. It creates no enrolment and records no progress.
* **Full access**: students can no longer enrol themselves (`POST .../enrol` answers 403). An Admin grants access with
  `POST /api/admin/eduyarp/enrolments {studentId, courseId}` (an ordinary active enrolment) and revokes it with the existing
  `PATCH /api/admin/eduyarp/enrolments/:id {status:'cancelled'}`.
* **One active course**: a new grant is refused while the student has another `active` enrolment (completed and cancelled do
  not count). Decided inside a transaction that locks the student's user row, so concurrent grants queue. Existing students
  with several active enrolments keep them; no constraint is added.
* **Certificates**: completing a course creates a pending request; only an Admin approving it creates the certificate
  (`POST /api/admin/eduyarp/certificate-requests/:id/approve|reject`). A rejected request can be followed by a new one
  (`POST /api/eduyarp/me/courses/:courseId/certificate-request`). Existing certificates are untouched; legacy completed
  courses get a request only when the student asks.

## Known limitations / decisions worth knowing

* The demo is strictly the first module. If the first module has fewer than two topics, only those are unlocked.
* **Completion is a one-way door.** An `active` enrolment becomes `completed` when every topic is done (also when deleting a
  topic finishes it; that creates a certificate *request*, never a certificate). A `completed` enrolment is never reopened by
  a curriculum change (topic added, edited or removed) or by re-completing a topic, so the one-active rule stays valid, history
  and progress are kept and nothing is issued. Progress is still counted against the current curriculum, so a completed
  student may see a percentage below 100 after new topics are added and can complete them. Curriculum changes and the
  status re-sync commit in one transaction and lock the course's enrolments first, which makes them safe against concurrent
  topic completion (no deadlocks, no duplicate requests).
* Revoking and rejecting are reversible by an Admin (approve again / grant again); certificates can still only be revoked,
  never restored (unchanged).
* The standalone apps `apps/eduyarp` and `apps/admin` were not changed and do not know about these workflows
  (their registration auto-login and Enrol button no longer work against this backend). The unified frontend in `apps/web`
  is the one that does.
* Admin has no notification when a student registers or completes a course; pending items appear on their own pages.
