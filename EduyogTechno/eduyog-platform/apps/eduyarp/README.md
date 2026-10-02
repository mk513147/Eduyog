# Eduyarp

React + Vite app for Eduyarp, Phase 1: a basic LMS prototype.

- Public course catalogue and course pages (published courses only, from PostgreSQL).
- Student registration and login using the existing `/api/auth` endpoints.
- Student dashboard: profile, enrolled courses with progress, upcoming classes.
- Learning page: modules and topics, mark topics complete, progress updates.

Courses, modules, topics, trainers and classes are managed in the Admin app under
**Eduyarp**.

## Run locally

```
npm install
npm run dev
```

Open http://localhost:5175 (5173 is Admin, 5174 is Fitness).

The database needs `database/schema/003_eduyarp.sql` applied. For demo content on a
development database, see `database/seed/eduyarp_demo.sql`.

## Configuration

Optional. Copy `.env.example` to `.env` to change the API base URL; it defaults to
`http://localhost:5000/api`. The backend's `FRONTEND_URL` must include
`http://localhost:5175` for CORS (it is in the backend's development default).

`VITE_*` values are bundled into the browser build, so never put secrets in them.

## Scripts

| Command           | Purpose                           |
|-------------------|-----------------------------------|
| `npm run dev`     | Dev server on port 5175           |
| `npm run build`   | Production build into `dist/`     |
| `npm run preview` | Serve the production build        |
| `npm run lint`    | ESLint                            |
