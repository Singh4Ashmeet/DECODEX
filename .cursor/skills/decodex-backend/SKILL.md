---
name: decodex-backend
description: >-
  Decodex backend development — Express 5 routes, JWT cookie auth, RBAC,
  PostgreSQL queries, Bull queue, multer uploads, and API error conventions.
  Use when adding or modifying API endpoints, middleware, database logic, or
  background workers.
---

# Decodex Backend

## Server Entry

**File:** `backend/src/server.ts`

- Mounts routes under `/api/v1/{auth,passages,sessions,analytics,teacher}`
- Side-effect import: `./queue/worker` starts Bull processor on boot
- Middleware: helmet, cors (credentials), express.json, cookieParser
- Health: `GET /health`

## Route Map

| Prefix | File | Key endpoints |
|--------|------|---------------|
| `/auth` | `routes/auth.ts` | POST register/login/logout, GET me |
| `/passages` | `routes/passages.ts` | GET list, GET by id |
| `/sessions` | `routes/sessions.ts` | POST create, POST audio, GET SSE stream, GET results, POST feedback |
| `/analytics` | `routes/analytics.ts` | Student-facing analytics |
| `/teacher` | `routes/teacher.ts` | GET students, GET students/:id/trends |

## Auth & RBAC

**JWT cookie auth** — `middleware/auth.ts`

```typescript
export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}
export const authenticate = (req, res, next) => { /* reads req.cookies.token */ }
```

**Role guard** — `middleware/rbac.ts`

```typescript
export const requireRole = (roles: string[]) => (req, res, next) => { ... }
```

- Public registration always creates `student` role (caller-supplied role ignored)
- Teachers/admins created out-of-band (seed script or admin)
- bcrypt cost factor 12 for passwords

## Error Response Format

Always return structured errors:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human-readable message" } }
```

Common codes: `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `UNAUTHORIZED`, `CONFLICT`, `INTERNAL_ERROR`, `AUTH_EXPIRED`

## Database

**Schema:** `backend/src/db/schema.sql`  
**Connection:** `backend/src/db/index.ts` → `query(sql, params)`

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Auth, roles (`student`, `teacher`, `parent`, `admin`), soft-delete |
| `passages` | Reading content with grade_level, lexile_score |
| `reading_sessions` | Session state, transcript, alignment_result JSONB, WPM |
| `error_classifications` | Per-word O-G category + rationale |
| `classification_corrections` | Teacher overrides (non-destructive) |
| `error_profiles` | Aggregated counts per session |
| `drills` | Generated practice content (JSONB) |

### Query Rules

- **Always parameterized** — `$1, $2, ...` placeholders, values in array
- Filter soft-deleted rows: `WHERE deleted_at IS NULL`
- Batch inserts use dynamic placeholder generation (see `saveClassifications`)

## File Uploads

**File:** `middleware/upload.ts` — multer disk storage in `uploads/`

- Endpoint: `POST /sessions/:id/audio` with field name `audio`
- Validates session ownership before enqueueing
- File path passed to Bull job; worker deletes in `finally`

## Queue

**Files:** `queue/index.ts`, `queue/worker.ts`

```typescript
export const audioQueue = new Queue('audio-processing', REDIS_URL);
export interface AudioJobData { sessionId, passageText, filePath }
```

Worker runs all AI pipeline stages. See `decodex-ai-pipeline` skill.

## SSE (Server-Sent Events)

In-memory `Map<sessionId, Response>` in `routes/sessions.ts`.

```typescript
export const getSSEClient = (sessionId: string) => ({
  sendEvent: (event, data) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
});
```

**Scaling note:** For multi-instance deploys, replace with Redis pub/sub.

## Security Checklist for New Endpoints

- [ ] `authenticate` middleware applied
- [ ] Role check where needed (`requireRole` or inline)
- [ ] IDOR guard: students can only access own resources
- [ ] Input validation before DB calls
- [ ] Parameterized queries only
- [ ] No secrets in responses or logs

## Adding a New Route

1. Create handler in `backend/src/routes/{name}.ts`
2. Mount in `server.ts`: `app.use('/api/v1/{name}', {name}Routes)`
3. Use `AuthRequest` type for authenticated handlers
4. Follow existing error response shape
5. Update frontend `api.ts` consumer if needed

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | ts-node-dev with hot reload |
| `npm run build` | tsc → `dist/` |
| `npm run start:prod` | seed-prod + node dist/server.js |

**Seed:** `backend/src/scripts/seed-prod.ts` — test users and passages
