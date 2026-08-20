---
name: decodex-dev-workflow
description: >-
  Decodex local development, Docker deployment, environment variables, database
  seeding, and test accounts. Use when setting up the project, running
  services, debugging environment issues, or preparing demo deployments.
---

# Decodex Dev Workflow

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- OpenAI API key (optional — mock fallbacks work without it)

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3000 | Backend listen port |
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/decodex` | Postgres connection |
| `REDIS_URL` | `redis://localhost:6379` | Cache + Bull queue |
| `JWT_SECRET` | (required) | JWT signing key |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |
| `OPENAI_API_KEY` | `sk-your-key-here` | Whisper + GPT-4o-mini (mock if missing/placeholder) |

## Local Development (Recommended)

### 1. Start infrastructure

```bash
docker compose up -d
```

Starts Postgres (5432) and Redis (6379) only — see `docker-compose.yml`.

### 2. Initialize database

```bash
cd backend
npm install
npm run dev   # runs db init + seed on startup via db/init.ts
```

### 3. Start frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173, proxies /api to :3000
```

### 4. Verify

- Backend health: `curl http://localhost:3000/health`
- Frontend: http://localhost:5173

## Production Docker (Full Stack)

```bash
export OPENAI_API_KEY="sk-your-real-key"
docker compose -f docker-compose.prod.yml up --build -d
```

| Service | URL |
|---------|-----|
| Frontend (Nginx) | http://localhost |
| Backend API | http://localhost:3000/api/v1 |

Prod compose includes db, redis, backend, frontend with health checks and volume mounts.

## Test Accounts

Seeded automatically (see `backend/src/db/seed.sql` and `scripts/seed-prod.ts`):

| Role | Email | Password |
|------|-------|----------|
| Student | `student@decodex.com` | `password123` |
| Teacher | `teacher@decodex.com` | `password123` |

## Mock / Offline Mode

Works without a valid OpenAI key:

- **STT:** 3s simulated delay → hardcoded transcript with intentional errors
- **Classification:** Maps alignment types to OMI/INS/SUB deterministically
- **Circuit breakers:** Still active; fallback to UNC on timeout

Trigger mock mode: leave `OPENAI_API_KEY` unset or set to `sk-your-key-here`.

## Common Tasks

### Reset database

```bash
docker compose down -v   # removes volumes
docker compose up -d
cd backend && npm run dev
```

### Run backend only (production build)

```bash
cd backend
npm run build
npm run start:prod   # seeds prod data + starts server
```

### Lint frontend

```bash
cd frontend && npm run lint
```

## Debugging Tips

| Issue | Check |
|-------|-------|
| 401 on API calls | Cookie not sent — verify `credentials: 'include'` and CORS `FRONTEND_URL` |
| SSE not updating | Worker running? Check backend logs for "Audio processing worker started." |
| Queue jobs stuck | Redis running? `REDIS_URL` correct? |
| OpenAI errors | Key valid? Circuit breaker may be open — wait 30s reset |
| Upload fails | `uploads/` dir exists? Multer disk space? |

## Project Scripts Summary

| Location | Command | Purpose |
|----------|---------|---------|
| `backend/` | `npm run dev` | Hot-reload dev server + worker |
| `backend/` | `npm run build` | Compile TypeScript |
| `backend/` | `npm run start:prod` | Seed + production start |
| `frontend/` | `npm run dev` | Vite dev server |
| `frontend/` | `npm run build` | Production build |
| `frontend/` | `npm run lint` | oxlint |

## Deployment Notes

- Backend Dockerfile: multi-stage build, runs seed + server
- Frontend Dockerfile: builds SPA, serves via Nginx
- Nginx proxies `/api/v1` to backend container
- Set strong `JWT_SECRET` in production — default in compose is for demo only
- Audio temp files stored in `backend_uploads` volume (prod compose)
