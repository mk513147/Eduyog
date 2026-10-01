# Eduyog Fitness

React + Vite app for Eduyog Fitness, Phase 1. A single landing page with Home, Services,
About and Contact sections. Page copy lives in `src/content.js`.

The enquiry form (`src/components/EnquiryForm.jsx`) validates input and submits it to
`POST /api/fitness-leads` on the backend, which validates again and stores it in the
`fitness_leads` table. Submitted enquiries appear in the Admin app under Fitness Leads.

## Run locally

```
npm install
npm run dev
```

Open http://localhost:5174 (5173 is used by the Admin app).

## Configuration

Copy `.env.example` to `.env` to configure:

- `VITE_API_URL`: backend origin without `/api` or a trailing slash, e.g.
  `http://localhost:5000`. Required for a production build; development falls back to
  `http://localhost:5000`. The backend's `FRONTEND_URL` must include this app's origin
  (`http://localhost:5174` in development) for CORS.
- `VITE_EDUYOG_URL`: optional full http(s) URL of the main Eduyog website. When it is
  empty or invalid, the "Back to Eduyog" links are hidden.

Restart `npm run dev` after changing `.env`.

`VITE_*` values are bundled into the browser build, so never put secrets in them.

## Scripts

| Command           | Purpose                           |
|-------------------|-----------------------------------|
| `npm run dev`     | Dev server on port 5174           |
| `npm run build`   | Production build into `dist/`     |
| `npm run preview` | Serve the production build        |
