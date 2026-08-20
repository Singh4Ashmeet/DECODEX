# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Decodex** is an AI-powered diagnostic reading platform for dyslexia education. It captures student reading aloud, transcribes via **Groq Whisper** (`whisper-large-v3-turbo`), aligns against source text with Needleman-Wunsch DP, classifies errors using Orton-Gillingham taxonomy (GPT-4o-mini via Groq), generates personalized practice drills, and provides teachers and parents with actionable analytics with human-in-the-loop override capability.

### Architecture

```
Client (React 19 + Vite) ↔ Express 5 API (Render) ↔ PostgreSQL (Supabase) + Redis (Queue + Cache)
                                    ↓
                            Bull Worker (Async Pipeline)
                                    ↓
                            Groq Whisper (STT) + GPT-4o-mini (Classification) + OpenAI fallback
```

**Audio processing flow:** Student records → audio uploaded to Express → job enqueued in Redis/Bull → worker transcribes (Groq Whisper with OpenAI fallback) → aligns transcript to source (Needleman-Wunsch) → classifies errors (GPT-4o-mini with O-G taxonomy prompt) → saves results → generates drills → computes Health Score → updates Gamification → evaluates Assignment completion (if linked) → awards XP/achievements → pushes status via SSE to frontend.

---

## Major Feature Areas (V2 AI Intervention Platform + Dex Voice-First Tutor)

### 1. Reading Health Score Engine (`healthScore.ts`)
Composite 0–100 score from 6 dimensions: WPM (grade-normalized), Accuracy, Fluency, Error Frequency, Error Severity (weighted by O-G category), Improvement Trend. Risk levels: Critical (<40), High (40–59), Medium (60–74), Good (75–89), Excellent (≥90). Persisted to `health_scores` table.

### 2. Gamification System (`gamification.ts`)
XP system with 10 levels, daily streaks with freeze mechanism (2 missed days/month), achievements (sessions, streaks, drills, stories, health score thresholds). Tables: `gamification_profiles`, `achievements`, `student_achievements`. XP awards: session=25, drill=15, story=20, perfect accuracy=50, streak/day=10.

### 3. AI Copilot (`copilot.ts` + `services/copilot.ts`)
Generates comprehensive intervention strategies for teachers using student's error profile, health score history, and learning context. Teacher-only endpoint with school-scoped access verification.

### 4. AI Story Generator (`stories.ts` + `services/storyGenerator.ts`)
Creates personalized decodable stories targeting student's specific phonetic weaknesses. Stories split into 3–4 word chunks for dyslexia-friendly reading.

### 5. Adaptive Learning Paths (`learningPaths.ts` + `services/learningPath.ts`)
4-week, 20-day Orton-Gillingham intervention roadmaps generated from reading assessment context. Stage-based progression with risk-level tracking. Includes interactive multimodal exercises (choice + voice).

### 6. Dyslexia Risk Screening (`riskScreening.ts` + `services/riskScreening.ts`)
Preliminary screening based on error patterns across sessions. Identifies indicators (e.g., high reversal frequency, blend breakdowns) with confidence score and evidence. Educational disclaimer included.

### 7. Classroom Analytics (`classroomAnalytics.ts`)
Teacher dashboard with error heatmap (O-G categories per student), class-wide weakness analysis, skill distribution (Excellent/Good/Medium/High/Critical counts).

### 8. Parent Dashboard (`parentDashboard.ts`)
Child progress cards (health score, strengths, recommendations), risk screening report, recent sessions with drill-down, consent management (link via invite code, request email with DOB KBV, withdraw with 30-day hard-delete).

### 9. Dex Voice-First Tutor (`dex.ts` + `services/dexTutor.ts` + `services/tts.ts`)
- **POST /dex/grade-answer**: Grades spoken answer against expected answer using GPT-4o-mini (multilingual)
- **POST /dex/transcribe**: Real-time STT via Whisper with consent gating
- **TTS Service**: ElevenLabs (primary) → browser SpeechSynthesis fallback. Multilingual support.

### 10. Reading Preferences & Fair Evaluation
User-configurable font scale, letter spacing, line spacing, theme. StoryReader evaluates 3–4 word chunks with ≥75% word match threshold; marks "struggled" not "mastered" on repeated failure.

### 11. Teacher Assignments (`assignments.ts` route + `services/assignments.ts`)
Teachers create reading assignments tied to a passage with optional due date, instructions, and scope (single student, selected students, or entire class). Students see assigned work on their dashboard. When a session is completed for an assignment, the worker resolves a score (from `health_scores` or `error_profiles`), awards XP (base 30, +15 at ≥75, +35 at ≥90), updates `assignment_students.status`, and grants achievements. Tables: `assignments`, `assignment_students` (with `rewards_awarded`, `reward_xp`, `session_id` link). `reading_sessions.assignment_student_id` links sessions to assignments.

### 12. Passage Generator (`passageGenerator.ts`)
AI-generated reading passages on demand for teachers, tuned to grade level and target phonemes (e.g., to drill specific O-G weaknesses). Used by teacher tools and adaptive learning paths.

### 13. Audio Storage (`audioStorage.ts`)
Optional object-storage abstraction (V5 migration creates `audio_storage` table) for keeping audio beyond ephemeral temp files. Disabled by default — primary path still deletes temp files post-STT for privacy.

### 14. Email Service (`email.ts`)
Nodemailer-based transactional email (Gmail SMTP via `GMAIL_USER` / `GMAIL_APP_PASSWORD`) for parent invite codes, consent notifications, and assignment reminders.

### 15. Student Access Service (`studentAccess.ts`)
Centralized `canAccessStudent(actor, target)` predicate used by all teacher/parent routes. Enforces role + relationship rules (school_id match for teachers, `parent_student_links` for parents) and is the single source of truth for IDOR prevention.

---

## Common Development Commands

### Root Workspace
```bash
npm run install:all       # Install all dependencies (skills + backend + frontend)
npm run skills:install    # Install skill dependencies
python app.py             # One-command dev launcher — starts both backend + frontend dev servers (stdlib only)
```

`app.py` is a repo-root Python 3 stdlib launcher (no extra packages). It checks for Postgres/Redis, installs deps if `node_modules/` is missing, and boots backend (3000) + frontend (5173) with clean process-group teardown on exit.

### Backend
```bash
cd backend
npm run dev               # Start dev server with ts-node-dev (http://localhost:3000)
npm run build             # TypeScript compile + copy DB files
npm start                 # Run production build
npm run migrate           # Run DB migrations standalone (src/scripts/migrate.ts)
npm run start:prod        # Run migrations, then start production server
npm test                  # Run tests with vitest
npm run test:coverage     # Run tests with coverage
```

### Frontend
```bash
cd frontend
npm run dev               # Start Vite dev server (http://localhost:5173, proxies /api to backend)
npm run build             # TypeScript compile + Vite build
npm run lint              # Run oxlint
npm run preview           # Preview production build
npm test                  # Run tests with vitest
npm run test:coverage     # Run tests with coverage
```

### Single Test Run
```bash
# Backend
cd backend && npx vitest run src/__tests__/specific-file.test.ts

# Frontend
cd frontend && npx vitest run src/__tests__/specific-file.test.tsx
```

### Infrastructure
```bash
docker compose up -d      # Start PostgreSQL (port 5433) and Redis (port 6379)
docker compose down       # Stop infrastructure
```

---

## Key Technical Decisions

### Circuit Breaker Pattern (Opossum)
All AI API calls (Groq Whisper and GPT-4o-mini) wrapped in Opossum circuit breakers. On provider failure, falls back to a passage-aware deterministic Orton-Gillingham rule engine. Errors classified during fallback tagged as `UNC` (Uncertain) for teacher review. **Primary provider is Groq** (free tier); OpenAI is the configurable fallback when `OPENAI_API_KEY` is set.

### Consent-Gating Architecture (Hardened V2)
Parental consent required before any audio recording. Uses invite codes for parent-student linking, knowledge-based verification (DOB) with rate-limited attempts, consent withdrawal with 30-day hard-delete grace period, data erasure jobs. `requireConsent` middleware blocks audio upload until valid consent exists. Removed insecure `/consent/approve` bypass endpoint.

### Role-Based + Relationship-Verified Authorization
- **Students**: Only own sessions, drills, results (IDOR guards)
- **Teachers**: Only students at same school (`school_id` join)
- **Parents**: Only children linked via `parent_student_links`
- **Admins**: Bypass relationship checks

### Database Migrations (Idempotent)
Schema applied via `initDB()` on startup with 11 migrations:
- V1: Core schema (users, sessions, passages, classifications, drills, error_profiles, parent_student_links, consent_requests)
- V2: Health Scores, Risk Screenings, Learning Paths, Copilot, Gamification, IEPs, Stories
- V3: Multi-Language Support (`preferred_language` on users)
- V4: Streak Freeze Mechanism (`freeze_count`, `freeze_month`)
- V5: Audio Object Storage (`audio_storage` table)
- V6: Drop deprecated `audio_base64` and `audio_file_path` columns
- V7: Harden DOB Knowledge-Based Verification (`dob_attempts`, `dob_locked_until`)
- V8: Dead-letter table for failed audio processing jobs (`audio_jobs_dead_letter`)
- V9: User Reading Preferences (`font_scale`, `letter_spacing`, `line_spacing`, `theme`)
- V10: Demo school backfill (creates "Decodex Demo School" + assigns test users to its `school_id` for teacher-scoped classroom/Copilot access)
- V11: Teacher Assignments + Student Assignment Rewards (`assignments`, `assignment_students`, `reading_sessions.assignment_student_id`, indexes)

### Mascot States & Celebrations
Student companion avatar (`DexAvatar.tsx`) renders state-based visuals (idle, speaking, listening, thinking, celebrating, concerned) with smooth CSS transforms and border highlights. Transitioning into `'celebrating'` triggers canvas-based particle burst (`ConfettiBurst.tsx`) for 1.8s. No external libraries.

### Sentry Error Tracking
`@sentry/node` initialized in `server.ts` when `SENTRY_DSN` set. Captures exceptions in worker with session context.

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── routes/              # Express route handlers (auth, dex, passages, sessions, teacher, consent, students, healthScore, copilot, learningPaths, stories, gamification, riskScreening, classroomAnalytics, parentDashboard, tts, assignments, analytics)
│   │   ├── middleware/          # Auth, RBAC, consent, upload
│   │   ├── services/            # Business logic (alignment, classifier, drills, TTS, healthScore, gamification, copilot, storyGenerator, passageGenerator, learningPath, riskScreening, dexTutor, openai, cache, audioStorage, email, classroomAnalytics, assignments, studentAccess)
│   │   ├── queue/               # Bull worker (worker.ts, index.ts, consentErasure.ts)
│   │   ├── db/                  # Schema, migrations (init.ts, schema.sql, migration_v2-v11.sql, seed.sql), analytics, index.ts
│   │   ├── lib/                 # logger.ts (Pino)
│   │   ├── scripts/             # migrate.ts, seed-prod.ts, reset-database.ts, backfill-audio-base64.ts
│   │   └── __tests__/           # Backend test suite (vitest) — auth, alignment-reversals, assignments, classification-corrections, consent-security, consent-kbv-hardening, copilot-parent-language, copilot-scope, dex-transcribe-language, dex-grading, gamification-streak-freeze, parent-dashboard, queue-dead-letter, rate-limiting, reading-preferences, sessions-idor, tts, worker-stt-language
│   ├── vitest.config.ts
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/               # Route page components (LandingPage, Login, Register, Dashboard, PassageSelection, SessionActive, SessionResults, PracticePage, TeacherDashboard, StudentDetail, ParentHome, ParentSessionReport, ConsentConfirm, PrivacyPolicy, TermsOfService, LearningPathPage, StoryReaderPage, CopilotPanel)
│   │   ├── components/          # Shared UI (DexAvatar, ConfettiBurst, AnnotatedText, AudioRecorder, DrillCard, DexVoiceCommands, DexNavigationGuide, ReadingPreferencesPanel, ProtectedRoute, AssignmentManager, AnimatedCounter, Skeleton)
│   │   ├── hooks/               # Custom hooks (useDex, useSessionSSE, useReadingPreferences)
│   │   ├── lib/                 # API client (api.ts), constants
│   │   ├── context/             # AuthContext, ThemeContext
│   │   └── __tests__/           # Frontend test suite (vitest + testing-library)
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json / tsconfig.node.json
├── documents/                   # PRD, TRD, frontend spec, security analysis, feature tickets, master implementation plan, privacy policy, terms, project analysis
├── .github/workflows/           # CI pipeline (Node 20)
├── tools/                       # Standalone helper scripts (e.g., browser_assignment_flow.py — Playwright E2E for the teacher-assignment flow)
├── app.py                       # One-command dev launcher (backend + frontend, stdlib-only)
├── AGENTS.md                    # Agent onboarding guide (read before coding; points to .cursor/skills)
├── DEMO.md                      # Demo logins, invite code (`DEMO01`), and seeded-data walkthrough
├── docker-compose.yml           # Local dev infrastructure (Postgres 5433 + Redis 6379)
├── docker-compose.prod.yml      # Full production stack (Postgres + Redis + backend, 5432/6379)
├── render.yaml                  # Render blueprint (deploys backend from render.com, health check on /health)
├── skills-lock.json             # Lockfile for community skills (restored via `npm run skills:install`)
├── .agents/skills/              # Community skills (skills.sh / npm)
└── .cursor/skills/              # Decodex-specific skills (authoritative)
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Random string ≥32 chars (`openssl rand -base64 32`) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `REDIS_URL` | **Yes** | Redis connection string |
| `OPENAI_API_KEY` | No* | OpenAI API key (fallback STT + LLM provider if Groq unavailable) |
| `GROQ_API_KEY` | Yes* | **Primary** free-tier provider for Whisper (`whisper-large-v3-turbo`) + GPT-4o-mini-compatible chat |
| `FRONTEND_URL` | No | Frontend origin for CORS (default: `http://localhost:5173`) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | No | For consent email delivery |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `ELEVENLABS_API_KEY` | No | ElevenLabs TTS (primary voice provider) |
| `AUDIO_STORAGE_PROVIDER` | No | Audio object storage provider: `local` (disk, default) or `supabase` |
| `AUDIO_STORAGE_PATH` | No | Local disk path for stored audio (default `./audio-storage`) |
| `AUDIO_STORAGE_BUCKET` | No | Supabase Storage bucket name (when provider is `supabase`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase credentials (required for Supabase Storage) |

*At least one of `OPENAI_API_KEY` or `GROQ_API_KEY` required; Groq is the default primary.

---

## Testing

- **Backend**: vitest with Node environment, globals enabled, setup file at `src/__tests__/helpers/setup.ts`
- **Frontend**: vitest with jsdom environment, globals enabled, setup file at `src/__tests__/setup.ts`
- **Coverage**: v8 provider, text + lcov reporters
- **Test patterns**: `src/__tests__/**/*.test.ts` (backend), `src/__tests__/**/*.test.{ts,tsx}` (frontend)

---

## Security Practices

- Parameterized SQL queries throughout
- bcrypt password hashing (cost factor 12)
- httpOnly, secure, sameSite cookie auth (no localStorage tokens)
- Rate limiting: auth endpoints 50 req/15 min, global 300 req/15 min
- Relationship-verified data access on all endpoints
- Consent gating on audio upload (hardened with DOB KBV)
- Error message masking in production
- CORS allowlist (production frontend + preview deployments + localhost)
- Dead-letter queue for failed audio jobs with retry metadata
- Audio files never persisted — temp files deleted after STT

---

## Key Files to Understand

### Backend Core
- `src/server.ts` — Express app setup, middleware, route mounting (V1 + V2 + Dex + Assignments routes)
- `src/middleware/auth.ts` — JWT verification, role extraction
- `src/middleware/rbac.ts` — Role-based access control
- `src/middleware/consent.ts` — Consent verification middleware
- `src/middleware/upload.ts` — Multer audio upload (size/type limits, temp file)
- `src/db/init.ts` — Database schema and migrations (V1–V11)
- `src/queue/worker.ts` — Bull worker for audio processing pipeline (Health Score + Gamification + Assignment completion integrated)
- `src/queue/consentErasure.ts` — 30-day delayed erasure job (consent withdrawal hard-delete)
- `src/services/alignment.ts` — Needleman-Wunsch alignment implementation
- `src/services/classifier.ts` — GPT-4o-mini error classification with O-G taxonomy (via Groq)
- `src/services/dexTutor.ts` — Drill generation + voice-first tutor grading
- `src/services/healthScore.ts` — Reading Health Score engine
- `src/services/gamification.ts` — XP, streaks, achievements, freeze
- `src/services/copilot.ts` — AI intervention strategy generation
- `src/services/storyGenerator.ts` — AI adaptive story generation
- `src/services/passageGenerator.ts` — AI-generated passages for targeted phoneme practice
- `src/services/learningPath.ts` — Adaptive learning path generation
- `src/services/riskScreening.ts` — Dyslexia risk screening
- `src/services/tts.ts` — ElevenLabs + browser TTS fallback
- `src/services/classroomAnalytics.ts` — Teacher dashboard analytics
- `src/routes/analytics.ts` — Student error trend series (`GET /api/v1/analytics/student/trends`)
- `src/services/assignments.ts` — Assignment scoring + reward awarding
- `src/services/studentAccess.ts` — `canAccessStudent` IDOR guard (teacher school, parent link, admin bypass)
- `src/services/email.ts` — Transactional email (parent invites, consent notifications)
- `src/services/audioStorage.ts` — Optional object-storage layer for audio
- `src/services/cache.ts` — Redis cache wrapper
- `src/services/openai.ts` — Groq (primary) + OpenAI (fallback) STT client with circuit breaker
- `src/lib/logger.ts` — Structured logging (Pino)

### Frontend Core
- `src/main.tsx` — App entry point, providers
- `src/App.tsx` — Router setup, route definitions (student/teacher/parent routes)
- `src/context/AuthContext.tsx` — Authentication state management
- `src/context/ThemeContext.tsx` — Theme/dark mode management
- `src/hooks/useDex.ts` — Speech recognition, recording, TTS, SSE handling
- `src/hooks/useSessionSSE.ts` — Server-sent events for real-time pipeline status
- `src/hooks/useReadingPreferences.ts` — Dyslexia-friendly reading preferences
- `src/lib/api.ts` — API client with interceptors
- `src/lib/constants.ts` — Shared client-side constants (O-G codes, thresholds, routes)
- `src/components/DexAvatar.tsx` — Student avatar companion and animation container
- `src/components/ConfettiBurst.tsx` — Lightweight canvas confetti celebration controller
- `src/components/ReadingPreferencesPanel.tsx` — Font/spacing/theme controls
- `src/components/DexVoiceCommands.tsx` — Global voice command listener
- `src/components/DexVoiceCommands.types.ts` — Shared types for Dex voice command system
- `src/components/DexNavigationGuide.tsx` — Onboarding guide for Dex
- `src/components/AssignmentManager.tsx` — Teacher UI for creating/managing assignments
- `src/components/AnimatedCounter.tsx` — Number-count-up animation for dashboards
- `src/components/Skeleton.tsx` — Loading skeletons
- `src/pages/SessionActive.tsx` — Active recording session UI
- `src/pages/PracticePage.tsx` — Drill practice interface
- `src/pages/LearningPathPage.tsx` — Adaptive learning path with interactive exercises
- `src/pages/StoryReaderPage.tsx` — Narrated story reader with 3–4 word chunk evaluation
- `src/pages/CopilotPanel.tsx` — Teacher intervention strategy view
- `src/pages/TeacherDashboard.tsx` — Classroom analytics (heatmap, weaknesses, skill dist); dual-theme dashboard with motion, skeleton loading, and gamified stat callouts
- `src/pages/Dashboard.tsx` — Student-facing dashboard (role-adaptive), recent sessions, drills, assignments
- `src/pages/ParentHome.tsx` — Parent portal with risk screening & consent management
- `src/pages/PrivacyPolicy.tsx` / `src/pages/TermsOfService.tsx` — Legal pages, routed from the app shell/footer

---

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` (Node 20) runs:
1. Backend `npm ci` → build → `npm test` (with a CI-safe `JWT_SECRET` + `NODE_ENV=test`)
2. Frontend `npm ci` → lint (oxlint) → build → `npm test`

---

## Deployment

Two deploy paths are supported:

- **Render** (`render.yaml`) — hosts the backend web service on Render's free tier. Build command is `npm install --include=dev && npm run build`, start command is `npm run start:prod` (runs DB migrations then boots), and bootstrap health check hits `/health`. Secrets (`DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `SENTRY_DSN`) are set via the Render dashboard; `JWT_SECRET` is auto-generated.
- **Docker Compose production** (`docker-compose.prod.yml`) — full stack (Postgres 15 on 5432, Redis 7, backend on 3000 with a `Dockerfile`). Requires `OPENAI_API_KEY` provided externally; audio storage set to `local`.

The backend exposes a **readiness `GET /health`** endpoint (in `server.ts`) that verifies Postgres connectivity plus a set of critical tables and returns HTTP 503 until ready — Render routes traffic only after it passes.

## Deployed URLs

- **Frontend**: https://decodex-five.vercel.app/
- **Backend Health**: https://decodex-backend.onrender.com/health (readiness check — verifies DB + critical tables, returns 503 while unavailable)
- **Test Accounts**: `student@decodex.com` / `teacher@decodex.com` / `parent@decodex.com` / `admin@decodex.com` — password `password123`
- **Demo**: see `DEMO.md` — seeded demo student `demostudent@decodex.com`, consent invite code `DEMO01`, pre-loaded sessions/drills (no AI key or worker needed)

---

## Local Development Notes

1. Run `docker compose up -d` first for PostgreSQL and Redis
2. Backend runs on port 3000, Frontend on port 5173 (proxies `/api` to backend)
3. Copy `backend/.env.example` to `backend/.env` and configure required variables
4. Database runs on port 5433 (not default 5432) to avoid conflicts
5. For ElevenLabs TTS, add `ELEVENLABS_API_KEY` to backend `.env`
6. For Sentry, add `SENTRY_DSN` to backend `.env`
7. For audio object storage, add `AUDIO_STORAGE_PROVIDER` (and `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` if using `supabase`); disabled by default — audio stays ephemeral
8. Quick one-command start: `python app.py` (launches both servers; verify with `curl http://localhost:3000/health`)

---

## Error Categories (O-G Taxonomy)

| Code | Meaning |
|------|---------|
| REV | Reversal |
| SUB | Substitution |
| OMI | Omission |
| INS | Insertion |
| BLD | Blend breakdown |
| PAC | Pacing / self-correction |
| UNC | Uncertain |

Full definitions: see `decodex-domain` skill.