# Decodex — Feature Ticket List

**Version:** 1.0  
**Date:** 2026-07-19  
**Team:** TeraBytes  
**Format:** Ready for import into Jira / Linear / GitHub Projects  

---

## Legend

| Field | Description |
|-------|-------------|
| **ID** | Unique ticket identifier (DEX-###) |
| **Title** | Short, imperative ticket title |
| **Epic** | Parent feature group |
| **Priority** | P0 (must-have MVP), P1 (V1), P2 (V2) |
| **Size** | S (1-2 hrs), M (3-6 hrs), L (1-2 days), XL (3-5 days) |
| **Type** | Feature, Task, Bug, Spike |
| **Dependencies** | Tickets that must be completed first |
| **Acceptance Criteria** | What "done" looks like |

---

## Epic 1: Project Setup & Infrastructure

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-001 | Initialize React + Vite project with folder structure | P0 | S | Task | — | Project scaffolded with Vite; `npm run dev` starts successfully; folder structure matches TRD spec (components/, pages/, services/, hooks/, utils/) |
| DEX-002 | Set up CSS design system (tokens, variables, base styles) | P0 | M | Task | DEX-001 | All CSS custom properties from Frontend Spec §3.1 defined in `index.css`; dark theme active by default; typography scale working |
| DEX-003 | Set up React Router with route structure | P0 | M | Task | DEX-001 | All routes from Frontend Spec §4.1 defined; layout components for Student/Teacher/Parent views; 404 page |
| DEX-004 | Initialize Express API server with project structure | P0 | M | Task | — | Express server starts on PORT 3001; health check endpoint (`GET /api/health`) returns 200; folder structure: routes/, controllers/, services/, middleware/ |
| DEX-005 | Set up PostgreSQL database with schema | P0 | L | Task | DEX-004 | All tables from TRD §2.6.2 created; migrations working; seed data for 10 test passages |
| DEX-006 | Configure environment variables and secrets | P0 | S | Task | DEX-004 | `.env.example` created; all required vars documented; `.env` added to `.gitignore` |
| DEX-007 | Set up CI/CD pipeline (GitHub Actions) | P1 | M | Task | DEX-001, DEX-004 | Lint + test + build on every PR; auto-deploy to Vercel (frontend) and Render (backend) on merge to main |
| DEX-008 | Configure Helmet.js + CORS + rate limiting middleware | P0 | M | Task | DEX-004 | Security headers active (verified via securityheaders.com); CORS restricted to frontend domain; rate limits enforced |
| DEX-009 | Set up structured logging (no PII) | P1 | S | Task | DEX-004 | JSON-formatted logs; verified: no student names, emails, or audio data in any log output |

---

## Epic 2: Authentication & Authorization

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-010 | Implement user registration API (email + password + role) | P0 | M | Feature | DEX-005 | `POST /api/auth/register` creates user with hashed password (bcrypt cost 12); validates email uniqueness; returns JWT |
| DEX-011 | Implement login API with JWT issuance | P0 | M | Feature | DEX-005 | `POST /api/auth/login` validates credentials; returns JWT (7-day expiry); account lockout after 5 failed attempts |
| DEX-012 | Build JWT authentication middleware | P0 | M | Task | DEX-011 | Middleware validates JWT on all `/api/*` routes (except auth routes); returns 401 on invalid/expired tokens |
| DEX-013 | Build RBAC authorization middleware | P0 | L | Task | DEX-012 | Role-based access checks per endpoint; ownership validation (student can only access own data); teacher-student and parent-student link verification |
| DEX-014 | Build Login page UI | P0 | M | Feature | DEX-003 | Split layout with gradient background; email + password form; role selector; form validation; error messages; redirect to role-appropriate dashboard on success |
| DEX-015 | Build Registration page UI | P0 | M | Feature | DEX-003 | Registration form with name, email, password, role; password strength indicator; success → redirect to login |
| DEX-016 | Implement auth state management (Context + httpOnly cookies) | P0 | M | Task | DEX-014 | AuthContext provides `user`, `login()`, `logout()`, `isAuthenticated`; JWT stored in httpOnly Secure SameSite=Strict cookie (NOT localStorage); auto-redirect on expired session; `credentials: 'include'` on all fetch calls |
| DEX-017 | Build protected route wrapper component | P0 | S | Task | DEX-016 | `<ProtectedRoute>` component redirects to login if not authenticated; role-based route guard (e.g., teacher routes inaccessible to students) |

---

## Epic 3: Parental Consent Flow

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-018 | Design and implement consent API endpoints | P0 | L | Feature | DEX-013 | `POST /api/consent` records consent with timestamp; `GET /api/consent/:studentId` returns consent status; consent gates audio recording capability |
| DEX-019 | Build parental consent UI flow | P0 | L | Feature | DEX-003 | Multi-step form: (1) explain what's collected, (2) explain how it's used, (3) explain retention and deletion, (4) checkbox + submit; timestamp recorded; accessible via email link |
| DEX-020 | Implement consent-gated feature access | P0 | M | Task | DEX-018 | Students without parental consent: can browse passages and do text drills; CANNOT use microphone or generate error profiles; clear messaging about why recording is disabled |
| DEX-021 | Build consent withdrawal and data deletion flow | P1 | L | Feature | DEX-018 | Parent can withdraw consent → soft-delete all student data → hard-delete after 30 days; confirmation email sent |

---

## Epic 4: Passage Management

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-022 | Create curated passage seed data (10-15 passages) | P0 | M | Task | DEX-005 | 10-15 age-appropriate English passages across 3 grade levels and 3 difficulty tiers; word counts calculated; stored in DB |
| DEX-023 | Build passage listing API with filters | P0 | M | Feature | DEX-005 | `GET /api/passages?grade=3&difficulty=easy` returns filtered list; pagination support |
| DEX-024 | Build Passage Selection page UI | P0 | L | Feature | DEX-023 | Grid of passage cards (3 col desktop, 2 tablet, 1 mobile); difficulty badge + word count; grade filter dropdown; hover animation; click → navigate to reading session |
| DEX-025 | Build passage detail API | P0 | S | Feature | DEX-005 | `GET /api/passages/:id` returns full passage content |
| DEX-026 | Build custom passage upload (teacher) | P1 | M | Feature | DEX-013 | `POST /api/passages` allows teachers to upload custom passages; input validation for word count and content length; XSS sanitization on content |

---

## Epic 5: Audio Capture & STT Pipeline

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-027 | Build AudioRecorder component (MediaRecorder API) | P0 | L | Feature | DEX-002 | Mic permission request with graceful denial handling; start/stop recording; audio blob capture in WebM/Opus; timer display; max 5-min recording; cross-browser tested (Chrome, Firefox, Edge, Safari) |
| DEX-028 | Build audio waveform visualizer | P0 | M | Feature | DEX-027 | Canvas-based real-time waveform using Web Audio API AnalyserNode; responsive sizing; clean visual style matching design system |
| DEX-029 | Build live transcript preview (Web Speech API) | P1 | M | Feature | DEX-027 | Real-time text display of recognized speech during recording (used for user feedback only, not for classification pipeline); clearly labeled as "preview" |
| DEX-030 | Implement audio upload API endpoint | P0 | M | Feature | DEX-004 | `POST /api/sessions/:id/audio` accepts audio blob (max 10MB); validates session ownership; returns 202 with processing status; audio held in-memory only — never written to disk |
| DEX-031 | Implement Whisper API integration service | P0 | L | Feature | DEX-030 | Sends audio to Whisper API with `verbose_json` response format; extracts word-level timestamps + confidence scores; retry with exponential backoff (max 3 attempts); error handling for timeout/rate limit |
| DEX-032 | Implement Web Speech API fallback for STT | P1 | M | Feature | DEX-031 | If Whisper API fails after retries, fall back to client-side Web Speech API transcript; flag results as "fallback quality" in UI |
| DEX-033 | Build Recording Session page UI (pre-recording state) | P0 | M | Feature | DEX-024 | Passage display with large text (20px, high line-height); "Start Reading" button with mic icon; instruction text; passage title + metadata |
| DEX-034 | Build Recording Session page UI (recording state) | P0 | L | Feature | DEX-027, DEX-028 | Pulsing red dot; waveform visualizer; timer; "Stop Reading" button; live transcript preview area; passage text remains visible |
| DEX-035 | Build Recording Session page UI (processing state) | P0 | M | Feature | DEX-034 | Stepped progress indicator (4 steps); animated spinner per step; skeleton content preview; estimated time remaining |
| DEX-036 | Implement audio cleanup — verify no audio persistence | P0 | S | Task | DEX-030, DEX-031 | Automated test: after session processing, query DB and check filesystem — zero audio files/blobs exist; Blob URLs revoked on client |

---

## Epic 6: Alignment Engine

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-037 | Implement word-level edit-distance alignment algorithm | P0 | L | Feature | DEX-031 | Input: source words + spoken words with confidence; output: array of `{source_word, spoken_word, match_type, asr_confidence, confidence_gate}` tuples; handles substitution, omission, insertion, match |
| DEX-038 | Implement confidence gating logic | P0 | M | Feature | DEX-037 | Confidence < 0.6 → `fail` (excluded); 0.6–0.8 → `uncertain` (flagged); > 0.8 → `pass` (classified normally); thresholds configurable via env vars |
| DEX-039 | Implement pacing anomaly detection | P0 | M | Feature | DEX-037 | Detect inter-word gaps > 2x average interval using Whisper word timestamps; flag as `pacing_anomaly` match type |
| DEX-040 | Write comprehensive unit tests for alignment engine | P0 | L | Task | DEX-037, DEX-038, DEX-039 | Test suite covers: exact match, single substitution, multiple omissions, insertions, mixed errors, confidence gating at each threshold, pacing detection; ≥90% code coverage on alignment module |
| DEX-041 | Create alignment API endpoint | P0 | M | Feature | DEX-037 | `GET /api/sessions/:id/alignment` returns alignment results; only accessible to session owner + linked teacher/parent |
| DEX-042 | Spike: Evaluate G2P libraries for phoneme-level alignment | P1 | L | Spike | — | Evaluate `g2p-en`, CMU Pronouncing Dictionary, eSpeak; test on 20 word pairs with known phoneme errors; document accuracy and integration approach |
| DEX-043 | Implement phoneme-level alignment (Phase 2) | P1 | XL | Feature | DEX-042 | G2P conversion for source words; phoneme-level edit distance; detect sub-word errors (b/d reversals, blend breakdowns); output phoneme error details |

---

## Epic 7: Error Classification (LLM)

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-044 | Design and version-control classification prompt | P0 | M | Task | — | System prompt anchored to O-G taxonomy (6 categories: REV, SUB, OMI, INS, BLD, PAC); includes confidence gating rules; stored in version-controlled file; JSON output schema enforced |
| DEX-045 | Implement LLM classification service | P0 | L | Feature | DEX-037, DEX-044 | Sends alignment diff to LLM with classification prompt; parses JSON response; validates against schema; retry on malformed response; temperature 0.1 for consistency |
| DEX-046 | Implement PII scrubbing for LLM prompts | P0 | M | Task | DEX-045 | Verify and enforce: no student names, IDs, emails, or metadata in any LLM prompt; only passage text + anonymized alignment diff sent |
| DEX-047 | Build error profile aggregation logic | P0 | M | Feature | DEX-045 | Aggregate classifications into error profile (counts per category + uncertain count + error rate); store in `error_profiles` table; update cumulative profile across sessions (Phase 2) |
| DEX-048 | Create classification API endpoint | P0 | M | Feature | DEX-045 | `GET /api/sessions/:id/classification` returns classified errors + error profile; auth-gated |
| DEX-049 | Build classification accuracy test suite | P0 | L | Task | DEX-045 | 10 known-answer test cases (seeded alignment diffs with expected classifications); run against LLM; track accuracy %; alert if < 80% |
| DEX-050 | Implement LLM response caching for identical error patterns | P0 | M | Feature | DEX-045 | Cache classification results for identical alignment patterns in Redis; reduce redundant API calls; cache invalidated on prompt version change; hash alignment diff as cache key |

---

## Epic 8: Drill Generation

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-051 | Design and version-control drill generation prompt | P0 | M | Task | — | System prompt generates 3-5 drills per error profile; drills mapped to O-G error categories; age-appropriate language; stored in version-controlled file |
| DEX-052 | Implement drill generation service | P0 | L | Feature | DEX-047, DEX-051 | Sends error profile to LLM with drill prompt; parses JSON response; validates drill structure; stores in `drills` table |
| DEX-053 | Create drill API endpoints | P0 | M | Feature | DEX-052 | `GET /api/sessions/:id/drills` returns drills for a session; `PATCH /api/sessions/:id/drills/:drillId` marks drill as completed; auth-gated |
| DEX-054 | Build drill completion tracking | P1 | M | Feature | DEX-053 | Track which drills a student completes; surface completion rate to teacher dashboard |

---

## Epic 9: Results & Alignment View (Student)

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-055 | Build Alignment View component | P0 | XL | Feature | DEX-041 | Passage text displayed with inline highlights: green (correct), red (error), purple (uncertain); hover/tap tooltip showing source word, spoken word, error category, confidence; responsive on mobile |
| DEX-056 | Build Error Profile Summary component | P0 | L | Feature | DEX-048 | Donut chart (category breakdown) + horizontal bar chart; uncertain count displayed separately; category colors match design system |
| DEX-057 | Build Drill Card component | P0 | L | Feature | DEX-053 | Card per drill: category badge, instructions, drill content; "Mark Complete" button; completed state styling; staggered entrance animation |
| DEX-058 | Assemble Session Results page | P0 | L | Feature | DEX-055, DEX-056, DEX-057 | Three sections: alignment view, error profile summary, drill cards; session metadata header (words read, time, WPM, error count); "Read Another Passage" CTA |
| DEX-059 | Build word highlight animation for alignment view | P1 | M | Feature | DEX-055 | Words highlight sequentially with 50ms delay on page load, simulating a reading cursor sweep |

---

## Epic 10: Student Dashboard & Progress

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-060 | Build Student Home Dashboard | P0 | L | Feature | DEX-017 | Welcome message; quick stats (total sessions, last session date); "Start Reading" CTA; recent sessions list (last 5) |
| DEX-061 | Build Student Progress page | P1 | XL | Feature | DEX-047 | Error rate trend line chart (last 10 sessions); category breakdown over time (stacked area chart); stat cards (total sessions, best WPM, streak); improvement highlight text |
| DEX-062 | Implement streak tracking logic | P1 | M | Feature | DEX-005 | Track consecutive days with at least 1 completed session; display streak count with flame animation; reset on missed day |
| DEX-063 | Build session history list (student view) | P1 | M | Feature | DEX-041 | Paginated list of past sessions: date, passage title, WPM, error count; click → navigate to session results |

---

## Epic 11: Teacher Dashboard

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-064 | Build Teacher Home Dashboard | P0 | XL | Feature | DEX-017, DEX-013 | KPI stat cards (student count, sessions this week, avg error rate, alerts); class error distribution chart (stacked bar); attention alerts list; recent sessions table |
| DEX-065 | Build student list sidebar (teacher view) | P0 | L | Feature | DEX-013 | Collapsible sidebar listing all students in teacher's class; search/filter by name; click → navigate to student profile; active student highlighted |
| DEX-066 | Build Individual Student Profile view (teacher) | P0 | XL | Feature | DEX-047, DEX-048 | Student header (name, grade, sessions, last active); current error profile (donut + bars); trend chart (error rate over time, filterable by category); session history table; drill completion rate; notes field |
| DEX-067 | Build class-level aggregate analytics page | P1 | XL | Feature | DEX-047 | Class-wide error category distribution; student comparison table (anonymized ranking by improvement, not raw scores); most common error patterns; average WPM over time |
| DEX-068 | Build teacher-student link management | P0 | M | Feature | DEX-013 | Teacher can add students to their class via invite code or email; teacher can remove students; verified in authorization middleware |
| DEX-069 | Build student report export (PDF) | P2 | L | Feature | DEX-066 | "Export Report" button on student profile; generates PDF with error profile, trend chart, session history, drill recommendations; formatted for IEP documentation |

---

## Epic 12: Parent Dashboard

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-070 | Build Parent Home Dashboard | P1 | L | Feature | DEX-017, DEX-018 | Child card (name, grade, last session); weekly summary text; simple progress chart (overall error rate over time); recent drills list |
| DEX-071 | Build parent-child account linking | P1 | M | Feature | DEX-018 | Parent enters child's invite code to link accounts; link requires consent flow completion; parent can unlink → triggers data review |
| DEX-072 | Build weekly parent report view | P1 | L | Feature | DEX-047 | Plain-language summary: sessions completed, error rate change, specific improvements, 2-3 practice suggestions; designed for non-technical parents |
| DEX-073 | Implement weekly report email notifications | P2 | M | Feature | DEX-072 | Automated weekly email to parent with summary + link to dashboard; unsubscribe option; email content contains no student PII (link to authenticated dashboard instead) |

---

## Epic 13: End-to-End Pipeline Integration

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-074 | Implement full session processing pipeline (orchestrator) | P0 | XL | Feature | DEX-031, DEX-037, DEX-045, DEX-052 | Single API call triggers: STT → alignment → classification → drill generation → profile update → store results; each stage has error handling and partial-result support; processing status exposed via polling endpoint |
| DEX-075 | Build session status polling endpoint | P0 | M | Feature | DEX-074 | `GET /api/sessions/:id/status` returns current processing step (0-4) and status (processing/complete/error); client polls every 2s during processing |
| DEX-076 | Implement graceful degradation for pipeline failures | P0 | L | Feature | DEX-074 | If STT fails: show error, suggest retry; if alignment succeeds but classification fails: show alignment without classification; if drill gen fails: show profile without drills; user always sees maximum available results |
| DEX-077 | Build end-to-end integration test with seeded audio | P0 | L | Task | DEX-074 | 3 pre-recorded audio files with known errors → run through full pipeline → verify alignment, classification, and drill output match expected results; automated in CI |

---

## Epic 14: Demo Preparation

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-078 | Prepare 3 seeded demo recordings with known errors | P0 | M | Task | — | 3 audio files recorded by team members: (1) reversal errors, (2) omission + blend breakdown, (3) pacing anomalies; corresponding source passages and expected classifications documented |
| DEX-079 | Build demo mode with pre-loaded session data | P0 | L | Feature | DEX-074 | "Demo Mode" button that loads pre-processed session results for instant display; bypasses live recording for reliable demo; clearly flagged as demo data |
| DEX-080 | Create demo script and presentation flow | P0 | M | Task | DEX-079 | Written script: (1) show problem slide, (2) live demo with seeded recording, (3) show results + drills, (4) show teacher dashboard with pre-loaded multi-session data, (5) closing slide; rehearsed 2x |
| DEX-081 | Deploy MVP to production URLs (Vercel + Render) | P0 | M | Task | DEX-007 | Frontend accessible at production URL; backend API accessible; database populated with seed data; environment secrets configured |

---

## Epic 15: Multi-Session Profiles & Trends (Phase 2)

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-082 | Implement cumulative error profile computation | P1 | L | Feature | DEX-047 | After each session, recompute cumulative profile across all student sessions; weighted recency (more recent sessions weigh more); store as latest profile |
| DEX-083 | Build error trend computation (sliding window) | P1 | L | Feature | DEX-082 | Compute per-category error rates over sliding windows (last 5, 10, all sessions); expose via `GET /api/students/:id/profile/history` |
| DEX-084 | Build trend visualization components | P1 | L | Feature | DEX-083 | Line chart for error rate over time; stacked area chart for category composition; improvement/decline annotations |
| DEX-085 | Implement "attention needed" alerts for teachers | P1 | M | Feature | DEX-083 | Detect: error rate spike > 20% vs. previous 5-session average; no sessions in > 5 days; surface as alerts on teacher dashboard |

---

## Epic 16: Accessibility & Polish

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-086 | Implement keyboard navigation across all pages | P1 | L | Task | All UI tickets | All interactive elements focusable via Tab; Enter/Space activates; visible focus ring; tested with keyboard-only navigation |
| DEX-087 | Add ARIA labels and live regions | P1 | M | Task | All UI tickets | All buttons, inputs, charts have descriptive ARIA labels; processing status updates announced via `aria-live` region; screen reader tested (NVDA/VoiceOver) |
| DEX-088 | Implement `prefers-reduced-motion` support | P1 | S | Task | All UI tickets | All animations disabled when user has reduced-motion OS preference; transitions reduced to instant |
| DEX-089 | Add OpenDyslexic font toggle | P1 | M | Feature | DEX-002 | User preference toggle in settings; applies OpenDyslexic font to all reading passages; preference stored in localStorage |
| DEX-090 | Ensure color-blind accessible error category indicators | P1 | M | Task | DEX-055, DEX-056 | All error categories distinguished by color AND icon/pattern; tested with simulated color blindness (deuteranopia, protanopia) |
| DEX-091 | Implement responsive design for all pages | P0 | XL | Task | All UI tickets | All pages tested at 3 breakpoints (mobile <640px, tablet 640-1024px, desktop >1024px); no horizontal scroll; touch targets ≥ 44px on mobile |

---

## Epic 17: Content & Legal

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-092 | Draft and publish Privacy Policy | P0 | M | Task | — | Covers: data collected, data usage, data retention, third-party processors (OpenAI), children's privacy, parental consent, data deletion rights; linked from all pages |
| DEX-093 | Draft and publish Terms of Service | P0 | M | Task | — | Includes "not a clinical diagnosis" disclaimer; limitation of liability; acceptable use; data licensing terms |
| DEX-094 | Add disclaimer banner to all user-facing surfaces | P0 | S | Task | DEX-002 | Footer text on every page: "Decodex is an educational screening tool, not a clinical diagnosis." |
| DEX-095 | Implement cookie consent banner (if applicable) | P1 | M | Feature | DEX-002 | Cookie consent popup with accept/reject; only set analytics cookies after consent; no cookies required for core functionality |

---

## Epic 18: Performance & Optimization

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-096 | Implement route-based code splitting | P1 | M | Task | DEX-003 | `React.lazy` + `Suspense` for all page-level components; initial bundle < 200KB gzipped; lazy-loaded routes load on demand |
| DEX-097 | Optimize chart rendering with React.memo | P1 | S | Task | DEX-056, DEX-061 | Chart components wrapped in `React.memo`; no re-render on unrelated state changes; verified via React DevTools Profiler |
| DEX-098 | Implement API response caching (client-side) | P1 | M | Task | DEX-016 | Cache passage list, student profile, session history in memory with 5-minute TTL; stale-while-revalidate pattern |
| DEX-099 | Preload critical fonts (Inter, Outfit) | P0 | S | Task | DEX-002 | `<link rel="preload">` for font files; `font-display: swap`; no FOUT on initial load |

---

## Summary Statistics

| Phase | Ticket Count | Estimated Effort |
|-------|-------------|-----------------|
| **P0 (MVP / Hackathon)** | 70 | ~55-65 dev-hours |
| **P1 (V1 — Post-Hackathon)** | 28 | ~35-45 dev-hours |
| **P2 (V2 — Growth)** | 13 | ~18-24 dev-hours |
| **Total** | **111** | **~108-134 dev-hours** |

---

## Epic 19: Infrastructure — Async Pipeline & Cache (NEW)

> [!IMPORTANT]
> These tickets are **P0 critical** and must be completed before pipeline integration. They address the synchronous bottleneck, cost optimization, and real-time UX identified in the project analysis.

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-100 | Set up Redis instance (local dev + hosted) | P0 | M | Task | DEX-001 | Redis running locally via Docker; hosted Redis provisioned on Render/Upstash; `REDIS_URL` in env config; connection verified |
| DEX-101 | Implement Bull job queue for session processing | P0 | L | Feature | DEX-100, DEX-004 | Bull queue processes `process-session` jobs; API returns 202 immediately on audio upload; worker runs pipeline stages sequentially; dead-letter queue for failed jobs; job retry with exponential backoff (3 attempts) |
| DEX-102 | Implement SSE endpoint for processing status | P0 | M | Feature | DEX-101 | `GET /api/v1/sessions/:id/status/stream` returns SSE stream; each pipeline stage pushes `{ step, status }` event; client receives real-time updates; connection auto-closes on completion/error |
| DEX-103 | Implement Redis caching for LLM classification responses | P0 | M | Feature | DEX-100, DEX-045 | Hash alignment diff → check Redis cache before LLM call; cache hit skips LLM; cache miss stores result with 7-day TTL; cache invalidated on prompt version change; cache hit rate logged |
| DEX-104 | Implement Redis caching for hot query paths | P0 | S | Feature | DEX-100 | Cache passage list (5min TTL), latest student profile (5min TTL), session status (1hr TTL); stale-while-revalidate pattern |
| DEX-105 | Implement circuit breaker for OpenAI API | P0 | M | Feature | DEX-101 | Opossum circuit breaker wraps all OpenAI calls; opens after 3 consecutive failures; half-open test after 30s; when open, pipeline stores partial results and notifies user |
| DEX-106 | Build SSE connection hook for frontend | P0 | M | Feature | DEX-102 | `useSessionSSE` hook connects to SSE endpoint; updates `processingStep` in real-time; replaces polling; handles reconnection and error states |

---

## Epic 20: Feedback Loop & Validation (NEW)

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-107 | Build teacher classification feedback UI | P0 | L | Feature | DEX-066 | On each error in session detail view, teacher sees "Wrong?" button → dropdown with 6 O-G categories → submit sends correction to API; correction stored with teacher ID, original category, corrected category, timestamp |
| DEX-108 | Create classification corrections API and table | P0 | M | Feature | DEX-005 | `POST /api/v1/sessions/:id/classifications/:errorId/feedback` stores correction; new `classification_corrections` DB table; only teacher/admin can submit; corrections queryable for prompt tuning analytics |
| DEX-109 | Expand classification test suite to 25+ cases | P0 | L | Task | DEX-049 | 25 known-answer test cases covering all 6 O-G categories (at least 4 per category + edge cases); includes ambiguous cases; run against LLM; track per-category precision/recall; alert if any category drops below 70% |

---

## Epic 21: DevOps & Quality (NEW)

| ID | Title | Priority | Size | Type | Dependencies | Acceptance Criteria |
|----|-------|----------|------|------|-------------|---------------------|
| DEX-110 | Create Dockerfile for backend | P0 | M | Task | DEX-004 | Multi-stage Dockerfile; dev and prod targets; non-root user; < 200MB image size; docker-compose.yml with API + PostgreSQL + Redis for local dev |
| DEX-111 | Generate OpenAPI/Swagger spec for all API endpoints | P1 | L | Task | All API tickets | OpenAPI 3.0 spec covering all endpoints; auto-generated docs at `/api/docs`; request/response schemas validated against Zod types |

### Suggested Sprint Plan (Hackathon — 48 hours)

> [!IMPORTANT]
> This sprint plan is optimized for **parallel execution by a 3-person team** (Frontend Lead, Backend Lead, Pipeline Lead). Tasks are color-coded by owner.

| Sprint / Block | Hours | Focus | Key Tickets | Owner |
|---------------|-------|-------|-------------|-------|
| **Block 1** (0-4h) | 4h | Project scaffold + infra | DEX-001, DEX-002, DEX-003, DEX-004, DEX-005, DEX-008, DEX-110 (docker-compose), DEX-100 (Redis) | ALL |
| **Block 2** (4-10h) | 6h | Auth + Passages + Audio foundations | DEX-010→017, DEX-022→025 (Backend); DEX-027→029 (Frontend) | Backend + Frontend |
| **Block 3** (10-18h) | 8h | Core pipeline: STT + Alignment + Queue | DEX-031→036 (Whisper), DEX-037→041 (Alignment), DEX-101 (Bull queue), DEX-102 (SSE) | Pipeline + Backend |
| **Block 4** (18-26h) | 8h | Classification + Drills + Cache | DEX-044→049, DEX-050 (LLM cache), DEX-103 (Redis cache), DEX-105 (circuit breaker), DEX-051→053 | Pipeline + Backend |
| **Block 5** (26-34h) | 8h | Results UI + Dashboard | DEX-055→058 (Results), DEX-106 (SSE hook), DEX-060 (Student home), DEX-033 (Reading session UI) | Frontend |
| **Block 6** (34-40h) | 6h | Teacher dashboard + Feedback | DEX-064→066, DEX-107→108 (feedback UI + API), DEX-109 (expanded test suite) | Frontend + Backend |
| **Block 7** (40-44h) | 4h | Pipeline integration + Polish | DEX-074→077, DEX-091 (responsive), DEX-094 (disclaimer) | ALL |
| **Block 8** (44-48h) | 4h | Demo prep + Deploy + Rehearse | DEX-078→081, final bug fixes, demo script rehearsal (2x) | ALL |

---

### Dependency Graph (Critical Path — Updated)

```
DEX-001 (Project Setup)
  ├─→ DEX-002 (Design System)
  ├─→ DEX-003 (Routing)
  ├─→ DEX-110 (Docker Compose)
  └─→ DEX-004 (API Server)
       ├─→ DEX-005 (Database)
       │    ├─→ DEX-010 (Registration)
       │    │    └─→ DEX-011 (Login — httpOnly cookies)
       │    │         └─→ DEX-012 (Auth Middleware)
       │    │              └─→ DEX-013 (RBAC)
       │    │                   └─→ DEX-018 (Consent API)
       │    └─→ DEX-022 (Passage Seed Data)
       │         └─→ DEX-023 (Passage API)
       │              └─→ DEX-024 (Passage Selection UI)
       │                   └─→ DEX-033 (Reading Session UI)
       │                        └─→ DEX-027 (Audio Recorder)
       │                             └─→ DEX-030 (Audio Upload API)
       │                                  └─→ DEX-031 (Whisper Integration)
       │                                       └─→ DEX-037 (Alignment Engine)
       │                                            ├─→ DEX-038 (Confidence Gating)
       │                                            └─→ DEX-045 (LLM Classification)
       │                                                 ├─→ DEX-050 (LLM Cache — P0)
       │                                                 ├─→ DEX-103 (Redis Cache)
       │                                                 └─→ DEX-047 (Error Profiles)
       │                                                      └─→ DEX-052 (Drill Gen)
       │                                                           └─→ DEX-074 (Pipeline)
       ├─→ DEX-100 (Redis Setup)
       │    ├─→ DEX-101 (Bull Queue)
       │    │    └─→ DEX-102 (SSE Endpoint)
       │    │         └─→ DEX-106 (SSE Frontend Hook)
       │    ├─→ DEX-103 (LLM Cache)
       │    └─→ DEX-104 (Hot Query Cache)
       ├─→ DEX-105 (Circuit Breaker)
       ├─→ DEX-008 (Security Middleware)
       └─→ DEX-108 (Feedback API)
            └─→ DEX-107 (Feedback UI)

CRITICAL PATH: DEX-001 → DEX-004 → DEX-005 → DEX-100 → DEX-101 → DEX-031 → DEX-037 → DEX-045 → DEX-052 → DEX-074
```

---

*End of Feature Ticket List — Version 2.0*
