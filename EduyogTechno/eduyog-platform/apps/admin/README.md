# Eduyog Admin

React + Vite Admin console for Eduyog Phase 1. Talks to the backend Admin API
(`/api/auth/*`, `/api/admin/*`).

## Run locally

1. Start the backend (`cd ../../backend && npm start`), which listens on port 5000.
2. In this directory:

   ```
   npm install
   npm run dev
   ```

3. Open http://localhost:5173 and sign in with an Admin account.

## Configuration

Optional. Copy `.env.example` to `.env` to change the API base URL; it defaults to
`http://localhost:5000/api`. The backend's `FRONTEND_URL` must include
`http://localhost:5173` for CORS (this is the backend's development default).

`VITE_*` values are bundled into the browser build, so never put secrets in them.

## Scripts

| Command           | Purpose                           |
|-------------------|-----------------------------------|
| `npm run dev`     | Dev server on port 5173           |
| `npm run build`   | Production build into `dist/`     |
| `npm run preview` | Serve the production build        |
| `npm run lint`    | ESLint                            |

## Notes

- The JWT is kept in `sessionStorage` and cleared on logout or when the tab closes.
- After login the role is confirmed with `GET /api/auth/me`; non-Admin accounts are rejected.
- Any 401/403 from the API ends the session and returns to the login page.
