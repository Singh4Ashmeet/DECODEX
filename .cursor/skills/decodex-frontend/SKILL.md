---
name: decodex-frontend
description: >-
  Decodex React frontend — Vite SPA routing, AuthContext, apiFetch with cookie
  auth, SSE session updates, AudioRecorder, teacher dashboards, and Tailwind
  design tokens. Use when building or modifying UI pages, components, hooks, or
  API integration.
---

# Decodex Frontend

## Stack & Tooling

- React 19 + TypeScript + Vite 8
- React Router 7 (declarative routes in `App.tsx`)
- Tailwind CSS 4 with custom design tokens in `index.css`
- Recharts for teacher analytics charts
- Lucide React icons
- Linter: oxlint (`npm run lint`)

## App Structure

**Entry:** `frontend/src/main.tsx` → wraps `App` in `AuthProvider` + `BrowserRouter`

**Routing:** `frontend/src/App.tsx`

| Path | Page | Access |
|------|------|--------|
| `/login`, `/register` | Auth pages | Public |
| `/` | Dashboard | Authenticated |
| `/passages` | PassageSelection | Student |
| `/session/:id` | SessionActive | Student (recording + SSE) |
| `/sessions/:id/results` | SessionResults | Student |
| `/teacher/dashboard` | TeacherDashboard | teacher, admin |
| `/teacher/student/:id` | StudentDetail | teacher, admin |

**Route guard:** `components/ProtectedRoute.tsx` — optional `allowedRoles` prop

## API Client

**File:** `frontend/src/lib/api.ts`

```typescript
export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T>
export function useApiQuery<T>(endpoint: string, options?: RequestInit)
```

- Prefixes all calls with `/api/v1`
- Sends `credentials: 'include'` for httpOnly JWT cookie
- Dispatches `auth:expired` event on 401
- Throws `Error` with server message on failure

**Vite proxy:** Dev server proxies `/api` to backend (see `vite.config.ts`)

## Auth

**File:** `frontend/src/context/AuthContext.tsx`

```typescript
interface User { id, email, role: 'student' | 'teacher' | 'parent' | 'admin', display_name }
// login(user), logout(), isAuthenticated, loading
```

- Boot: calls `GET /auth/me` to restore session from cookie
- Login pages set user via `login()` after successful POST

## Real-Time Session Updates (SSE)

**File:** `frontend/src/hooks/useSessionSSE.ts`

```typescript
export interface ProcessingStatus {
  step: 'idle' | 'uploading' | 'queued' | 'transcribing' | 'aligning' | 'saving' | 'complete' | 'error';
  message: string;
}
export function useSessionSSE(sessionId: string | null)
```

- Uses native `EventSource` with `withCredentials: true`
- Listens: `connected`, `status`, `error`
- Closes on `complete` step
- **When adding pipeline steps:** extend the `step` union type here and in the worker

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| AudioRecorder | `components/AudioRecorder.tsx` | MediaRecorder capture, blob upload |
| AnnotatedText | `components/AnnotatedText.tsx` | Passage with error highlights |
| DrillCard | `components/DrillCard.tsx` | Display generated drill |
| ProtectedRoute | `components/ProtectedRoute.tsx` | Auth + role gate |

## Student Session Flow

1. `PassageSelection` → user picks passage
2. `POST /sessions` → navigate to `/session/:id`
3. `SessionActive` → `AudioRecorder` records → `POST /sessions/:id/audio` (multipart)
4. `useSessionSSE` shows pipeline progress
5. On `complete` → navigate to `/sessions/:id/results`
6. `SessionResults` → `GET /sessions/:id/results` → AnnotatedText + DrillCard

## Teacher Flow

- `TeacherDashboard` → `GET /teacher/students` → student list with avg WPM/error rate
- `StudentDetail` → `GET /teacher/students/:id/trends` → Recharts trend lines
- Classification override → `POST /sessions/:id/classifications/:errorIndex/feedback`

## Styling Conventions

- Design tokens: `bg-background`, `text-primary`, `font-display`, `font-body`
- Layout: `max-w-6xl mx-auto`, sticky header with role-aware nav
- Buttons: rounded-full primary actions, uppercase tracking on nav links
- Match existing Tailwind patterns in sibling components

## Adding a New Page

1. Create `frontend/src/pages/MyPage.tsx`
2. Add route in `App.tsx` inside appropriate `ProtectedRoute`
3. Add nav link in header if user-facing
4. Use `apiFetch` or `useApiQuery` for data — never raw fetch without credentials
5. Handle loading/error states consistently with existing pages

## Build & Dev

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
```

Production served by Nginx (`frontend/nginx.conf`) proxying `/api` to backend.
