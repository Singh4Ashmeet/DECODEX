# Decodex — Agent Guide

> **Start here.** This file orients any AI agent working on the Decodex codebase. Read it first, then load the relevant project skills from `.cursor/skills/`.

## What Is Decodex?

Decodex is an AI-powered **diagnostic reading platform** for dyslexia education. Students read passages aloud; the system transcribes speech (Whisper), aligns it to source text, classifies errors using **Orton-Gillingham taxonomy** (GPT-4o-mini), generates personalized drills, and gives teachers actionable analytics with human-in-the-loop override capability.

**Repo type:** Monorepo — `backend/` (Express/TS) + `frontend/` (React/Vite) + `documents/` (specs)

## Quick Orientation

```
Student flow:  Passage → Record audio → Async pipeline → Results + Drills
Teacher flow:  Dashboard → Student detail → Trends + Classification overrides
Pipeline:      STT → Align → Classify → Save → Generate drills (Bull/Redis worker)
Real-time UX:  Server-Sent Events push pipeline status to frontend
```

## Project Skills (Read Before Coding)

All skills live in `.cursor/skills/`. Load the skill that matches your task:

| Skill | Path | Use when… |
|-------|------|-----------|
| **decodex-overview** | `.cursor/skills/decodex-overview/SKILL.md` | Onboarding, architecture questions, finding where code lives |
| **decodex-ai-pipeline** | `.cursor/skills/decodex-ai-pipeline/SKILL.md` | STT, alignment, classification, caching, circuit breakers, worker |
| **decodex-backend** | `.cursor/skills/decodex-backend/SKILL.md` | API routes, middleware, DB queries, auth, queue, uploads |
| **decodex-frontend** | `.cursor/skills/decodex-frontend/SKILL.md` | Pages, components, hooks, SSE, AuthContext, Tailwind UI |
| **decodex-domain** | `.cursor/skills/decodex-domain/SKILL.md` | O-G error categories, LLM prompts, teacher feedback, pedagogy |
| **decodex-dev-workflow** | `.cursor/skills/decodex-dev-workflow/SKILL.md` | Setup, Docker, env vars, test accounts, debugging |

### Skill Selection Guide

```
"What does this project do?"           → decodex-overview
"How does the AI pipeline work?"       → decodex-ai-pipeline
"Add/modify an API endpoint"           → decodex-backend (+ decodex-domain if classification)
"Build/fix a UI page or component"     → decodex-frontend (+ decodex-domain if error labels)
"Change error categories or prompts"   → decodex-domain + decodex-ai-pipeline
"Run locally / deploy / env issues"    → decodex-dev-workflow
```

## Community Skills (skills.sh / npm)

Decodex also carries a locked set of community skills installed via the `skills` npm CLI. They live in `.agents/skills/` and are restored from `skills-lock.json`.

```bash
npm run skills:install   # restore locked community skills
npm run skills:list      # inspect installed project skills
npm run skills:update    # intentionally refresh from upstream
```

Use community skills as supplements, not replacements: Decodex-specific skills remain authoritative for product behavior, API conventions, O-G taxonomy, privacy, and security rules.

| Community skill | Source | Pair with Decodex skill(s) | Use when... |
|-----------------|--------|----------------------------|-------------|
| `frontend-design` | `anthropics/skills` | `decodex-frontend` | Creating or reshaping polished UI while keeping Decodex's product tone |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | `decodex-frontend` | Writing or reviewing React/Vite components, hooks, routing, and data-fetching patterns |
| `webapp-testing` | `anthropics/skills` | `decodex-frontend`, `decodex-dev-workflow` | Verifying local frontend behavior with Playwright screenshots, DOM checks, and browser logs |
| `e2e-testing-patterns` | `wshobson/agents` | `decodex-frontend`, `decodex-dev-workflow` | Designing focused E2E coverage for login, session recording, results, and teacher flows |
| `nodejs-backend-patterns` | `wshobson/agents` | `decodex-backend`, `decodex-ai-pipeline` | Building or reviewing Express middleware, REST APIs, auth, jobs, and service boundaries |
| `typescript-advanced-types` | `wshobson/agents` | `decodex-backend`, `decodex-frontend` | Tightening shared TypeScript contracts, discriminated unions, generic helpers, and API result types |

Cursor-specific discovery is mirrored in `.cursor/rules/agent-discovery.mdc`.

## Repository Map

| Path | Contents |
|------|----------|
| `backend/src/server.ts` | Express entry, middleware (CORS, CSRF, rate limiters), route mounting |
| `backend/src/middleware/` | `auth`, `rbac`, `consent`, `csrf`, `upload` |
| `backend/src/routes/` | 18 routes: `auth`, `passages`, `sessions`, `analytics`, `teacher`, `consent`, `students`, `healthScore`, `copilot`, `learningPaths`, `stories`, `gamification`, `riskScreening`, `classroomAnalytics`, `parentDashboard`, `assignments`, `tts`, `dex` |
| `backend/src/services/` | 19 services: `alignment`, `classifier`, `openai`, `drills`, `cache`, `healthScore`, `gamification`, `copilot`, `storyGenerator`, `passageGenerator`, `learningPath`, `riskScreening`, `dexTutor`, `tts`, `classroomAnalytics`, `assignments`, `studentAccess`, `email`, `audioStorage` |
| `backend/src/queue/worker.ts` | Bull worker — full AI pipeline orchestration & background jobs |
| `backend/src/db/` | PostgreSQL schema (`schema.sql`, `init.ts`), migrations (V1–V11) |
| `backend/src/__tests__/` | Vitest backend test suite (22 test files) |
| `frontend/src/App.tsx` | React Router config (Student, Teacher, Parent routes) |
| `frontend/src/main.tsx` | App entry point wrapped in `<ErrorBoundary>` fallback |
| `frontend/src/components/` | `ErrorBoundary`, `DexAvatar`, `ConfettiBurst`, `AnnotatedText`, `AudioRecorder`, `DrillCard`, `DexVoiceCommands`, `ReadingPreferencesPanel`, `AssignmentManager`, etc. |
| `frontend/src/pages/` | Page components (`LandingPage`, `Dashboard`, `TeacherDashboard`, `ParentHome`, `LearningPathPage`, `StoryReaderPage`, `CopilotPanel`, `SessionActive`, `SessionResults`, `PracticePage`, etc.) |
| `frontend/src/lib/api.ts` | API client (`apiFetch`, cookie auth) |
| `frontend/src/hooks/` | `useDex`, `useSessionSSE`, `useReadingPreferences` |
| `frontend/src/__tests__/` | Vitest frontend test suite (8 test files) |
| `documents/` | PRD, TRD, frontend spec, security analysis, feature tickets |

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS 4, React Router 7, Recharts
- **Backend:** Node.js, Express 5, TypeScript, Bull, Opossum, OpenAI SDK, Groq SDK
- **Data:** PostgreSQL + Redis (cache + queue)
- **AI:** Groq Whisper (`whisper-large-v3-turbo`) + GPT-4o-mini (with OpenAI fallback)
- **Deploy:** Render (`render.yaml`) / Docker Compose (`docker-compose.prod.yml`)

## Critical Conventions

1. **API prefix:** All endpoints under `/api/v1`
2. **Auth:** JWT in httpOnly cookie — frontend uses `credentials: 'include'`
3. **CSRF Protection:** State-changing requests (POST/PUT/PATCH/DELETE) require matching `Origin`/`Referer` header
4. **Error Boundary:** React top-level `ErrorBoundary` handles render errors with user recovery options
5. **Errors:** `{ error: { code, message } }` shape
6. **SQL:** Parameterized queries only — never string-interpolate user input
7. **Security:** `canAccessStudent` IDOR guards (students own data, teachers school-scoped, parents linked)
8. **Privacy:** No raw audio persisted by default — temp files deleted after STT
9. **Resilience:** Circuit breakers on AI calls; smart O-G rule engine fallback when AI fails
10. **Scope:** Match existing patterns — minimal diffs, no over-engineering

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

## Local Development (Quick Reference)

```bash
# 1. Infrastructure
docker compose up -d

# 2. Backend (port 3000)
cd backend && cp .env.example .env && npm install && npm run dev

# 3. Frontend (port 5173)
cd frontend && npm install && npm run dev

# Or single command launcher:
python app.py
```

**Test accounts:** `student@decodex.com` / `teacher@decodex.com` / `parent@decodex.com` / `admin@decodex.com` — password `password123`

**Production:** `docker compose -f docker-compose.prod.yml up --build -d` → http://localhost

Details: `decodex-dev-workflow` skill.

## Key Documents

| Document | Purpose |
|----------|---------|
| `documents/PRD.md` | Product requirements, user stories, roadmap phases |
| `documents/TRD.md` | Technical architecture, pipeline specs, API schemas |
| `documents/FRONTEND_SPECIFICATION.md` | UI/UX specifications |
| `documents/SECURITY_ANALYSIS.md` | Security review findings |
| `documents/FEATURE_TICKETS.md` | Planned feature work |
| `README.md` | Project pitch, demo instructions |

## Agent Workflow Checklist

When starting any task:

- [ ] Read this file (`AGENTS.md`)
- [ ] Load the relevant skill(s) from `.cursor/skills/`
- [ ] Read surrounding code before editing — match conventions
- [ ] Check `documents/FEATURE_TICKETS.md` if implementing new features
- [ ] Verify auth/IDOR guards on new endpoints
- [ ] If changing pipeline steps, update worker SSE events + frontend `useSessionSSE` step types
- [ ] Do not commit unless explicitly asked

## Phase Awareness

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 (MVP) | **Implemented** | Core pipeline, basic teacher dashboard, drills |
| Phase 2 (V2 Platform) | **Implemented** | Health Score, Copilot, Story Generator, Learning Paths, Risk Screening, Classroom Analytics, Parent Portal, Dex Tutor, Teacher Assignments, CSRF, Error Boundary |
| Phase 3 | Planned | Multi-language expansion, school district pilot, mobile app |

Check PRD before building Phase 3+ features — schema may exist but UI may not.
