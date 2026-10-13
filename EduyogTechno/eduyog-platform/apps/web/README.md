# Eduyog Web (unified frontend shell)

React 19 + Vite 8 shell that will become the single hosted Eduyog frontend. **Done so far:** the shell,
the public Eduyog homepage (`/`), the Fitness page (`/fitness`), Eduyarp (`/eduyarp/…`, plus the
`/account/…` pages), the Admin console (`/admin/…`) and the StudentAQ and Saritex static sites
(`/studentaq/`, `/saritex/`). The Supabase school-submission workflow is *not* migrated yet; the existing apps and websites
keep working unchanged. The backend is not modified.

## Run locally

```
npm install
cp .env.example .env     # then set VITE_API_BASE_URL (see below)
npm run dev              # http://localhost:5176
```

| Command           | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `npm run dev`     | Dev server on port 5176                              |
| `npm run build`   | Production build into `dist/`                        |
| `npm run preview` | Serve the production build on port 4176              |
| `npm run lint`    | ESLint                                               |
| `npm test`        | Unit tests for the pure logic (`node --test`)        |

## Configuration (`.env`, read at build time)

| Variable            | Required | Meaning |
| ------------------- | -------- | ------- |
| `VITE_API_BASE_URL` | for Eduyarp and the Fitness form | Backend API base URL **including `/api`**, no trailing slash, e.g. `http://localhost:5000/api` for local development. There is no default, not even in development: when empty or invalid no API request is made: Eduyarp shows "The API address is not configured." and the Fitness enquiry form tells visitors to e-mail instead. The backend's `FRONTEND_URL` (CORS) must include the unified origin; Eduyarp sends an `Authorization` header, so the browser also makes a preflight request. The production value is not decided yet. |
| `VITE_FITNESS_URL`  | no       | Override for the homepage "Become a Partner" buttons. Leave empty: they go to the unified `/fitness` page (and follow `VITE_BASE_PATH`). Accepts another app path or an http(s) URL. |
| `VITE_BASE_PATH`    | no       | Public base path if the site is not served from the domain root, e.g. `/eduyog/` (start and end with `/`). Defaults to `/`. On Windows Git Bash prefix the command with `MSYS_NO_PATHCONV=1`, or the shell rewrites the value into a file path. |

`VITE_*` values are bundled into the browser build: never put secrets in them.

**CORS:** the backend only answers browsers whose origin is in its `FRONTEND_URL` list. For local
development that list must include `http://localhost:5176`; in production it must include the real
origin of this site (unless the API is served from the same origin). This is backend *environment*
configuration; no backend code is involved.

**Hosting:** the app uses History-API routing, so the host must serve `index.html` for any path that
is not a real file (SPA fallback). `npm run dev` and `npm run preview` already do. The hosting
provider is not decided, so no provider-specific rewrite file is included.

## Structure

```
index.html            Original SEO title, description, Open Graph / Twitter metadata
src/main.jsx          Entry point: RouterProvider -> App
src/App.jsx           Resolves the current route and renders it inside its layout
src/staticSites.js    URLs of the static sites (entry links, /saritex -> index.html redirect)
src/routes.js         Central route table (pure data: id, path, layout) and not-found route
src/App.jsx           Maps route ids to pages (home eager, Fitness lazy) and layouts
src/config.js         The only place that reads import.meta.env; contact details
src/router/           Small History-API router (base path, hash scrolling, <Link>)
src/api/              createClient.js (pure GET/POST client), client.js (the configured instance),
                      platforms.js, fetchPlatforms.js
src/lib/              Pure helpers (URL validation, partner link resolution) + their tests
src/layouts/          PublicLayout: skip link, header/navigation, footer, WhatsApp button
src/features/home/    The homepage, one module per section
src/features/admin/   Admin (lazy-loaded): copied pages/components, its own session (api/session.js),
                      router adapters (router/), access.js, styles/ (scoped under .eduyog-admin)
src/features/eduyarp/ Eduyarp (lazy-loaded): copied pages/components, its own session (api/session.js),
                      router adapters (router/), access.js, styles/ (scoped under .eduyarp-site)
src/features/fitness/ The Fitness page (lazy-loaded): components/, content.js, enquiry.js
                      (validation + submission outcomes), styles/ (scoped under .fitness-site)
src/pages/            Shared pages (not found)
src/components/       BrandLogo (shared logo asset), Reveal (scroll reveal)
src/assets/home/      The three screenshots used by the homepage (copied, same filenames)
public/studentaq/     StudentAQ static site (copy of websites/studentaq, see "Static sites")
public/saritex/       Saritex static site (copy of websites/saritex)
src/assets/fitness/   fitness-hero-image.jpg (byte-identical to apps/fitness/public/images/hero-image.jpg)
src/styles/           global.css (html/body only), eduyog-site.css, shell.css
test/                 node:test unit tests
```

### Styling and assets

- `eduyog-site.css` is the original `websites/eduyog/styles.css`, scoped under `.eduyog-site`
  (tokens, element rules and keyframes included), so it cannot collide with the global CSS of other
  features, and theirs cannot reach it. `global.css` holds the only unscoped rules (`html`, `body`).
  Eduyarp and Admin CSS is not imported. Fitness CSS (`features/fitness/styles/`) is generated from the
  Fitness app the same way, scoped under `.fitness-site`, and only loads with the `/fitness` chunk. Its
  hero image is a uniquely named file imported by the CSS (Eduyarp has a different `hero-image.jpg`).
- The logo is imported from `assets/shared/eduyog-logo.svg`; images are imported from `src/assets/`.
  Both are emitted with hashed filenames under `assets/`, follow `VITE_BASE_PATH`, and use no root
  paths such as `/images/hero-image.jpg`.
- Inter still comes from Google Fonts, as on the original page.

## Fitness (`/fitness`)

Adapted from `apps/fitness` (which is unchanged and still runs on its own). It keeps its own header
and footer and design; "Back to Eduyog" is now an internal link to `/`. The enquiry form posts to
`POST {VITE_API_BASE_URL}/fitness-leads` with the same field names and validation as before. Without
an API address nothing is sent and the form says so. Note `motion`, `lucide-react` and
`@fontsource-variable/inter` are dependencies of this app because Fitness uses them. The hero JPEG is
about 2 MB (6000x4000), as in the source app.

## Eduyarp (`/eduyarp/…`, `/account/…`)

Adapted from `apps/eduyarp` (which is unchanged and still runs on its own). One lazy module renders
every Eduyarp route, so the homepage downloads none of it and the session and notification state
survive navigation between its pages. It leaves nothing behind when the visitor moves to another section:
its timers and listeners are removed on unmount.

| Original (standalone) | Unified | Access |
| --- | --- | --- |
| `/` | `/eduyarp` | public |
| `/courses`, `/courses/:slug` | `/eduyarp/courses`, `/eduyarp/courses/:slug` | public |
| `/login`, `/register` | `/eduyarp/login`, `/eduyarp/register` | signed out only |
| `/dashboard` | `/eduyarp/dashboard` | student |
| `/my-courses/:courseId`, `…/assignments/:assignmentId` | `/eduyarp/my-courses/…` | student |
| `/certificates`, `/certificates/:certificateId` | `/eduyarp/certificates[/…]` | student |
| `/trainer`, `/trainer/courses/:courseId`, `…/assignments/:assignmentId`, `…/students/:studentId` | `/eduyarp/trainer/…` | trainer |
| `/profile`, `/notifications`, `/announcements` | `/account/profile`, `/account/notifications`, `/account/announcements` | any signed-in role |

The table lives in `src/routes.js` (pure data). An unknown path under `/eduyarp` or `/account` gets Eduyarp's
own not-found page. Query strings (`?next=`, `?submission=`), trailing slashes, refresh and back/forward work.

- **Legacy paths.** The backend stores notification links as paths of the standalone app (`/my-courses/5`,
  `/trainer/courses/9/assignments/3?submission=2`, `/announcements`). `legacyToUnified` translates them, and
  only a safe in-app destination is ever followed.
- **`?next=`** (login and register) accepts only an internal path that resolves to an Eduyarp/account route,
  never an external URL, `//host`, a backslash form or a signed-out-only page (which would bounce back). A
  legacy value is translated.
- **Authentication.** Unchanged from the standalone app and kept separate from everything else: the JWT lives in
  `sessionStorage` under `eduyarp_token`; the role always comes from `/auth/me`; a failed restore clears the token; a
  401 on a request that used the stored token logs out with "Your session has expired"; logout clears only that
  key. `auth/`, `api/endpoints.js`, `api/session.js` are byte-identical to the original (a test enforces it). The
  access rules (`access.js`) are the original's; the backend's role checks remain the authority, and a page that
  needs sign-in renders only after `/auth/me` has confirmed the session (no private request before that).
  There is **no shared auth provider** and no shared token key with Admin or Supabase: that needs a design review.
- **API.** Eduyarp has its own instance of the shared client factory (`features/eduyarp/api/client.js`) using the central
  `VITE_API_BASE_URL` with its own token. The original's fallback to `http://localhost:5000/api` is gone: with no address
  configured nothing is sent and the pages show "The API address is not configured." Endpoint paths, methods, bodies
  and headers are unchanged.
- **Behaviour notes.** The trainer dashboard still refreshes every 30s while the tab is visible and when it becomes visible
  again; notifications refresh on window focus, tab visibility, page changes and after actions (`utils/polling.js`,
  unit tested). The certificate's `@page` print rule (A4 landscape) is added only while that page is on screen.
- **Styles and assets.** The original CSS (8 files) is generated under `.eduyarp-site` (keyframes renamed `eduyarp-*`); its hero
  image is `src/assets/eduyarp/eduyarp-hero-image.jpg` (the Eduyarp one, not Fitness's) and the course art lives in
  `src/assets/eduyarp/course-art/`.
- **Differences from the standalone app (all intentional, small):** unified paths; login/register under `/eduyarp/…`;
  focus moves to the main content after a navigation (shared shell behaviour); `?next=` no longer accepts the signed-out-only
  pages; the page title/description are restored when leaving Eduyarp.

## Admin (`/admin/…`)

Adapted from `apps/admin` (which is unchanged and still runs on its own). One lazy module renders every Admin
route inside Admin's own dashboard layout (sidebar + top bar): no public header, footer or WhatsApp button, one
skip link and one `<main>`. Public visitors never download it. While it is mounted the page carries
`<meta name="robots" content="noindex, nofollow">`, like the standalone app's `index.html`.

| Original (standalone) | Unified |
| --- | --- |
| `/login` | `/admin/login` |
| `/` | `/admin` |
| `/platforms`, `/services`, `/users`, `/fitness-leads` | `/admin/platforms`, `/admin/services`, `/admin/users`, `/admin/fitness-leads` |
| `/eduyarp/courses`, `/eduyarp/courses/:id` (digits only), `/eduyarp/trainers`, `/eduyarp/enrolments`, `/eduyarp/classes`, `/eduyarp/announcements`, `/eduyarp/certificates` | the same paths under `/admin` |

The table is in `src/routes.js`. There are no query-string or `?next=` routes in Admin (the original has none, and none
was added). An unknown path under `/admin` is sent to the Admin login when signed out and shows Admin's not-found page
when signed in, as before.

- **Authentication.** Unchanged and separate: the JWT lives in `sessionStorage` under `eduyog_admin_token`; the role always comes from `/auth/me`; a non-admin is rejected at login ("This account does not
  have Admin access.") and on restore, and nothing is stored for them; a 401 on a stored-token request logs out with
  "Your session has expired", a 403 with "Your account no longer has Admin access"; a network failure on restore keeps the
  token so a reload can retry. `auth/`, `api/session.js`, `api/endpoints.js` and the auto-refresh files are byte-identical to
  the original (a test enforces it). The session is "authenticated" only after `/auth/me` confirmed the role, and the
  backend's admin-only checks remain the authority; the browser guard is an extra layer.
- **Per-feature tokens.** Each feature has its own instance of the shared client, with its own token source: Admin sends
  only `eduyog_admin_token`, Eduyarp only `eduyarp_token`, and the default client (homepage, Fitness) sends no
  token. Logging out of one never clears the other, an Eduyarp student/trainer session cannot open Admin (Admin never
  reads `eduyarp_token`; a valid student token planted in the Admin key is rejected as non-admin), and tests forbid
  features importing each other's session or naming each other's token key. There is **no shared auth provider**.
- **API.** Endpoints, methods, payloads and headers are unchanged; the `localhost:5000` fallback is gone. With no
  `VITE_API_BASE_URL` nothing is sent and the login shows "The API address is not configured." The shared client gained
  two optional settings used only by Admin: which statuses end the session (401 and 403) and the original network message.
- **Platform URLs.** The platform form still sends the URL exactly as typed and the backend (validator and database
  constraint) requires an absolute http(s) URL; nothing in Admin writes an internal path such as `/fitness` into a platform
  record. Update platform URLs through the Admin UI only when you decide to.
- **Auto-refresh.** The 30 s, pause-while-hidden, no-overlap, keep-data-on-error behaviour and its tests are ported
  unchanged (`test/admin-autorefresh.test.js`); only the active page polls, and timers and listeners are removed on
  unmount.
- **Styles.** The original CSS (2 files) is generated under `.eduyog-admin` (keyframes renamed `admin-*`); the logo is the
  shared one. Admin text follows the shell's Inter font, so it can look marginally different from the standalone build.
- **Differences from the standalone app (all intentional, small):** unified `/admin` paths; focus moves to the main content
  after a navigation (shared shell behaviour); the default page title is restored when leaving Admin.

## Static sites (`/studentaq/`, `/saritex/`)

StudentAQ and Saritex are **not** React routes and are not converted to React. Their complete pages are
copied unchanged (apart from the edits below) into `public/studentaq/` and `public/saritex/`, which Vite
publishes as-is at `<base>/studentaq/` and `<base>/saritex/`. Each opens as its own HTML document, so
Saritex's Bootstrap 5 and Font Awesome (CDN) and StudentAQ's global CSS never touch the React document
(and the React shell never loads them). All their internal links and asset paths are relative, so they
work at the domain root and under any `VITE_BASE_PATH` without edits.

- **Entry links:** the homepage Saritex and StudentAQ cards link to the folder URLs with a plain `<a>`
  (a full page load; the React router would show its not-found page). `src/staticSites.js` is the one
  place that knows these URLs. No React routes are registered for them.
- **`/saritex` or `/studentaq` answered by the React shell** (a host SPA fallback, or the dev server):
  `main.jsx` redirects to `<site>/index.html`, a real file, where the relative links resolve correctly.
  Other paths under the sites (a missing file) fall through to the shell's not-found page.
- **Inventory.** StudentAQ (41 published files): `index`, `services`, `destinations`, `about`, `contact`,
  `privacy`, `404` pages, `assets/css` (2), `assets/js` (8), `assets/fonts` (2), `assets/img` (22).
  Saritex (147 files): `index`, `AboutUs`, `Services`, `Blogs`, `Reviews`, `ContactUs` pages and
  `image/`, `Blog/`, `Team/`, `Services/` (images) and `SaritexPdf_File/` (93 PDFs, about 144 MB: the
  build output is about 182 MB). Not published: the originals' `.gitkeep` files and StudentAQ's `README.md`.
- **Changes from the originals** (the originals in `websites/` are untouched; `test/static-sites.test.js`
  fails if any other file differs):
  1. Saritex `index.html`: PDF folder names `SariteXpdf_File` corrected to the real `SaritexPdf_File`, and four
     listed PDF names corrected to the names on disk (`Full DIssertation`, `Harsh Shripremkumar  Dissertation`
     with two spaces, `Mirza Dissertaion`, `Intelligent System- MD Shoaib .pdf`). In the originals these links
     break on case-sensitive hosts, and the last two names point at files that never existed.
  2. All six Saritex pages: one footer Quick Links item, `Back to Eduyog` (`href="../"`).
  3. StudentAQ `assets/js/data.js`: one footer link, `Back to Eduyog` (`href: '../'`), the Eduyog contact email
     (`eduyogtechnology@gmail.com`), the Eduyog header logo link and the backend `api` settings; `layout.js`
     (header logo link), `enquiry-form.js` and `pages.js` (backend submission), `contact.html` (loads
     `site-config.js`). Saritex pages: the Eduyog logo in the navbar (linking to `../`, the Eduyog homepage).
  4. StudentAQ `404.html`: `<base href="/">` replaced by a small script that derives the base from the
     page's own URL (`/studentaq/`, or `/<base>/studentaq/`); the static `/` base would point its assets
     and links at the React shell.
- **Third-party forms (unchanged, not tested against production):**
  - *StudentAQ* (changed): the enquiry form no longer uses Google Forms. It posts JSON to the existing
    backend, `POST <VITE_API_BASE_URL>/studentaq-enquiries`, which validates it and stores it in the new
    PostgreSQL table `studentaq_enquiries` (`database/schema/014_studentaq_enquiries.sql`). The success
    message is shown only on HTTP 201; every other outcome (no API configured, network error, timeout,
    4xx/5xx) shows the error panel. Because StudentAQ is static, `vite.config.js` generates
    `studentaq/assets/js/site-config.js` from `VITE_API_BASE_URL` (dev server and build); the committed copy
    is an empty "not configured" default. **Order of rollout:** apply migration 014 manually to the target
    database, deploy the backend (its `FRONTEND_URL` must include the origin serving StudentAQ), then build
    and deploy the web app with `VITE_API_BASE_URL` set. Submissions are not readable through the API.
  - *Saritex* (`index.html` modal form and `ContactUs.html`) posts to the SheetDB endpoint already in the
    pages (`https://sheetdb.io/api/v1/io3zycyrrbs36`). **Known issue, deliberately not fixed here:** both
    show their success message (modal / "Data sent to Google Sheet!" toast) whenever SheetDB returns any
    JSON body, including an HTTP error, because the HTTP status is not checked.
- **Other known pre-existing issues:** 13 Saritex footer/social links have `href="http://"` (dead);
  `ContactUs.html` overflows a 390px screen by 12px; Saritex review avatars load from `picsum.photos`.

### Hosting requirements for the static sites

- Serve real files before the SPA fallback (any normal static host does). `/saritex/index.html` and
  `/studentaq/index.html` need nothing special; folder URLs work either via the host's directory index
  or via the shell redirect above.
- Redirect `/saritex` to `/saritex/` (trailing slash) if you want the clean folder URL; the shell
  already redirects to `index.html` when the host does not.
- Preserve filename case and spaces (Saritex has names such as `Suhani Chauhan .jpeg`), and serve PDFs
  with `application/pdf`. Mind per-deployment size limits (about 182 MB) and consider hosting the PDFs
  elsewhere if the provider limits that.
- A missing path under a static site (`/studentaq/oops`) falls through to the React not-found page; map
  it to `/studentaq/404.html` in the host configuration if the StudentAQ 404 page is preferred. This
  is host-specific and not configured here.

## Adding a feature later

1. Create `src/features/<name>/` with its pages (lazy-load them with `React.lazy` when large).
2. Register its routes in `src/routes.js` with the right layout. Add role-specific layouts
   (student, trainer, admin) next to `PublicLayout`; public navigation stays separate from them.
3. Scope any feature CSS under its own root class.

## Authentication (intentionally not built yet)

Eduyarp and Admin each keep their own JWT in `sessionStorage` today, with different keys and
different role rules, and the Supabase school-submission workflow has its own session. The shell
has no shared auth provider: `src/api/client.js` sends no credentials, and only the Eduyarp and Admin
modules have sessions (their own `eduyarp_token` and `eduyog_admin_token`, see "Eduyarp" and "Admin"). A shared provider needs an
authentication design review first; it must not merge the Express JWT session with a Supabase one.
