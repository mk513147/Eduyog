# Eduyog Techno Solution – Platform (Phase 1)

Phase 1 is a working prototype for company confirmation.

## Structure

```
eduyog-platform/
├── websites/        Static sites (HTML, CSS, JavaScript)
│   ├── eduyog/
│   ├── saritex/
│   └── studentaq/
├── apps/            React + Vite applications
│   ├── fitness/
│   ├── eduyarp/
│   └── admin/
├── backend/         Node.js + Express API
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── utils/
├── database/        PostgreSQL
│   ├── schema/
│   └── seed/
└── assets/          Images and media
    ├── shared/
    ├── eduyog/
    ├── saritex/
    ├── studentaq/
    ├── fitness/
    └── eduyarp/
```

## Tech stack

| Part      | Technology                  |
|-----------|-----------------------------|
| Eduyog    | HTML, CSS, JavaScript       |
| Saritex   | HTML, CSS, JavaScript       |
| StudentAQ | HTML, CSS, JavaScript       |
| Fitness   | React + Vite                |
| Eduyarp   | React + Vite                |
| Admin     | React + Vite                |
| Backend   | Node.js + Express           |
| Database  | PostgreSQL                  |

## Environment

Copy `.env.example` to `.env` and fill in local values. `.env` is ignored by Git and must never be committed.

## Status

Directory structure only. No application code has been written yet.

See [CLAUDE.md](CLAUDE.md) for project rules and Phase 1 scope.
