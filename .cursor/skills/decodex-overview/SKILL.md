---
name: decodex-overview
description: >-
  Decodex project architecture, repository layout, tech stack, and navigation
  guide. Use when onboarding to the codebase, planning features, or needing a
  map of where code lives in this AI reading diagnostic platform.
---

# Decodex Overview

## What This Project Is

Decodex is an AI-powered diagnostic reading platform for dyslexia education. Students read aloud; the system transcribes speech, aligns it to source text, classifies errors using Orton-Gillingham (O-G) taxonomy via GPT-4o-mini, generates personalized drills, and surfaces analytics to teachers.

**Philosophy:** Diagnostic-first (identify *why* a student struggles), not assistive (read text aloud).

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, React Router 7, Recharts |
| Backend | Node.js, Express 5, TypeScript, Bull queue, Opossum circuit breakers |
| Data | PostgreSQL (persistent state), Redis (cache + job queue) |
| AI | OpenAI Whisper (`whisper-1`), GPT-4o-mini (classification) |
| Deploy | Docker multi-stage builds, Nginx frontend proxy |

## Repository Layout

```
DECODEX/
├── AGENTS.md                  # Agent entry point — read first
├── backend/
│   ├── src/
│   │   ├── server.ts          # Express entry, route mounting
│   │   ├── routes/            # auth, passages, sessions, analytics, teacher
│   │   ├── services/          # alignment, classifier, openai, drills, cache
│   │   ├── queue/             # Bull audio-processing worker
│   │   ├── middleware/        # auth (JWT cookie), rbac, upload (multer)
│   │   └── db/                # schema.sql, init, analytics persistence
│   └── .env.example
├── frontend/
│   └── src/
│       ├── pages/             # Login, Dashboard, SessionActive, TeacherDashboard, etc.
│       ├── components/        # AudioRecorder, AnnotatedText, DrillCard, ProtectedRoute
│       ├── context/           # AuthContext (JWT via httpOnly cookie)
│       ├── hooks/             # useSessionSSE (real-time pipeline status)
│       └── lib/api.ts         # apiFetch, useApiQuery
├── documents/                 # PRD, TRD, FRONTEND_SPEC, security, tickets
├── docker-compose.yml         # Dev: Postgres + Redis only
└── docker-compose.prod.yml    # Full stack (db, redis, backend, frontend)
```

## User Roles & Flows

| Role | Primary routes | Key actions |
|------|----------------|-------------|
| `student` | `/`, `/passages`, `/session/:id`, `/sessions/:id/results` | Select passage, record audio, view results/drills |
| `teacher` / `admin` | `/teacher/dashboard`, `/teacher/student/:id` | View class analytics, override AI classifications |
| `parent` | (Phase 2 — schema ready, UI not built) | Read-only child profile |

## Core Data Flow (High Level)

```
Student records audio → POST /sessions/:id/audio (202)
  → Bull queue worker: STT → align → classify → save → drills
  → SSE pushes status to frontend
  → GET /sessions/:id/results returns full session data
```

## API Conventions

- Base path: `/api/v1`
- Auth: JWT in httpOnly cookie (`token`), sent via `credentials: 'include'`
- Errors: `{ error: { code, message } }` — codes like `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `UNAUTHORIZED`
- Async uploads return `202 Accepted` with `{ status: 'queued' }`

## Key Documents

| File | Purpose |
|------|---------|
| `documents/PRD.md` | Product requirements, user stories, phases |
| `documents/TRD.md` | Technical specs, pipeline stages, schemas |
| `documents/FRONTEND_SPECIFICATION.md` | UI/UX specs |
| `documents/SECURITY_ANALYSIS.md` | Security review |
| `documents/FEATURE_TICKETS.md` | Planned work items |

## Related Skills

| Skill | When to use |
|-------|-------------|
| `decodex-ai-pipeline` | STT, alignment, classification, drills, caching, circuit breakers |
| `decodex-backend` | Routes, middleware, DB queries, queue worker changes |
| `decodex-frontend` | Pages, components, auth, SSE, API client |
| `decodex-domain` | O-G error categories, pedagogical rules, teacher overrides |
| `decodex-dev-workflow` | Local setup, Docker, env vars, test accounts |

## Code Change Principles

1. **No raw audio persistence** — audio is temp-file only, deleted in worker `finally`
2. **Fail gracefully** — circuit breakers + `UNC` fallback when AI fails
3. **Parameterized SQL only** — never interpolate user input into queries
4. **IDOR guards** — students access own sessions; teachers access any
5. **Minimize scope** — match existing Express/React patterns in surrounding files
