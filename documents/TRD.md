# Decodex — Technical Requirements Document (TRD)

**Version:** 1.0  
**Date:** 2026-07-19  
**Team:** TeraBytes  
**Status:** Draft — Awaiting Technical Review  

---

## 1. System Overview

Decodex is a web-based diagnostic reading platform built as a **React SPA** that captures student audio, transcribes it via STT, aligns the transcript against source text, classifies reading errors using an LLM, generates targeted drills, and persists an evolving per-student error profile for teacher/parent consumption.

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT (React SPA)                            │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ Passage   │  │ Mic       │  │ Results    │  │ Dashboard        │  │
│  │ Selector  │  │ Capture   │  │ View       │  │ (Teacher/Parent) │  │
│  └──────────┘  └───────────┘  └────────────┘  └──────────────────┘  │
└──────────────────┬───────────────────────────────────────────────────┘
                   │ Audio blob / API calls
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        API LAYER (Node.js / Express)                 │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ /stt     │  │ /align    │  │ /classify  │  │ /dashboard       │  │
│  │ endpoint │  │ endpoint  │  │ endpoint   │  │ endpoints        │  │
│  └────┬─────┘  └─────┬─────┘  └─────┬──────┘  └────────┬─────────┘  │
│       │              │              │                   │            │
│       ▼              ▼              ▼                   │            │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐           │            │
│  │ Whisper  │  │ Alignment │  │ LLM        │           │            │
│  │ Service  │  │ Engine    │  │ Classifier │           │            │
│  └──────────┘  └───────────┘  └────────────┘           │            │
└──────────────────────────────────┬───────────────────────┘            │
                                   │                                   │
                                   ▼                                   │
                          ┌────────────────┐                           │
                          │   PostgreSQL    │◄──────────────────────────┘
                          │   Database      │
                          └────────────────┘
```

### 1.2 Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Service isolation** | Each pipeline stage (STT, alignment, classification, drill gen) is a discrete, independently testable service |
| **Fail gracefully** | If STT confidence is low, flag it — don't force a bad classification |
| **No raw audio persistence** | Audio is processed in-memory and discarded after transcription |
| **Stateless API, stateful DB** | API servers are horizontally scalable; all state lives in PostgreSQL |
| **Prompt-anchored classification** | LLM prompts are version-controlled and anchored to the O-G taxonomy — not open-ended |
| **Async pipeline** | Processing runs in a Bull/Redis job queue; API returns 202 immediately; status pushed via SSE |
| **Cache before call** | Redis caches LLM responses for identical alignment patterns; reduces COGS and latency |
| **Real-time push** | Server-Sent Events (SSE) push processing status to client; eliminates polling |

---

## 2. Component Specifications

### 2.1 Audio Capture Module

**Purpose:** Capture student's voice reading aloud via browser microphone.

| Attribute | Specification |
|-----------|---------------|
| **API** | `MediaRecorder` API (Web standard) |
| **Audio format** | WebM/Opus (browser default) → converted to WAV/MP3 server-side if needed by Whisper |
| **Sample rate** | 16kHz minimum (Whisper optimal) |
| **Max recording duration** | 5 minutes (MVP) |
| **Chunk streaming** | Optional: stream 5-second chunks for progress indication; full blob sent on completion |
| **Permissions** | Browser `getUserMedia` with explicit user grant; graceful fallback messaging on denial |
| **Fallback** | Web Speech API for real-time preview text (not used for classification pipeline) |

**Technical Constraints:**
- Must handle browser permission denial gracefully with user-friendly messaging
- Must detect when microphone is muted or disconnected mid-recording
- Audio blob size limit: 10MB (sufficient for 5 min at 16kHz mono)
- Cross-browser support: Chrome 80+, Firefox 78+, Edge 80+, Safari 14.1+

### 2.2 Speech-to-Text (STT) Service

**Purpose:** Convert audio recording to text transcript with per-word confidence scores.

| Attribute | MVP | Production |
|-----------|-----|------------|
| **Engine** | Web Speech API (client-side, free) | OpenAI Whisper API (`whisper-1`) |
| **Output** | Plain text transcript | Word-level timestamps + confidence scores (via `verbose_json` response format) |
| **Latency target** | < 3s for 1-min audio | < 5s for 3-min audio |
| **Language** | English (en-US, en-IN) | English + Hindi (Phase 3) |
| **Error handling** | Retry once on timeout; surface error to user | Retry with exponential backoff (max 3 attempts) |

**Whisper API Integration Details:**
```
POST https://api.openai.com/v1/audio/transcriptions
Content-Type: multipart/form-data

Parameters:
  model: "whisper-1"
  file: <audio_blob>
  response_format: "verbose_json"
  timestamp_granularities: ["word"]
  language: "en"
```

**Response Schema (used by alignment engine):**
```json
{
  "text": "The cat sat on the mat",
  "words": [
    { "word": "The", "start": 0.0, "end": 0.32, "confidence": 0.97 },
    { "word": "cat", "start": 0.35, "end": 0.71, "confidence": 0.94 },
    ...
  ]
}
```

### 2.3 Alignment Engine

**Purpose:** Diff the STT transcript against the source text to identify divergences.

#### 2.3.1 Word-Level Alignment (MVP)

**Algorithm:** Modified Levenshtein edit-distance with word tokens.

**Input:**
- `source_words[]`: tokenized source passage
- `spoken_words[]`: tokenized STT transcript with confidence scores

**Output:**
```json
[
  {
    "index": 0,
    "source_word": "bright",
    "spoken_word": "blight",
    "match_type": "substitution",
    "asr_confidence": 0.72,
    "confidence_gate": "pass"    // "pass" | "uncertain" | "fail"
  },
  {
    "index": 3,
    "source_word": "string",
    "spoken_word": null,
    "match_type": "omission",
    "asr_confidence": null,
    "confidence_gate": "pass"
  }
]
```

**Match Types:**
| Type | Description |
|------|-------------|
| `match` | Source and spoken word are identical |
| `substitution` | Different word spoken |
| `omission` | Word in source not spoken |
| `insertion` | Extra word spoken not in source |
| `pacing_anomaly` | Word spoken but with abnormal timing gap (>2x average inter-word interval) |

**Confidence Gating Logic:**
```
IF asr_confidence < 0.6 THEN confidence_gate = "fail" (excluded from classification)
ELSE IF asr_confidence < 0.8 THEN confidence_gate = "uncertain" (flagged in UI)
ELSE confidence_gate = "pass" (classified normally)
```

#### 2.3.2 Phoneme-Level Alignment (Phase 2)

**Purpose:** Detect sub-word errors like letter reversals and blend breakdowns.

| Component | Technology | Notes |
|-----------|------------|-------|
| **G2P Conversion** | `g2p-en` Python library or CMU Pronouncing Dictionary | Converts source words to expected phoneme sequences |
| **Phoneme extraction from speech** | Wav2Vec2 CTC phoneme output or Whisper word-level → G2P mapping | Extracts actual phoneme sequence from spoken audio |
| **Phoneme diff** | Edit distance on phoneme sequences | Identifies specific phoneme substitutions, omissions, insertions |

**Phoneme-level output example:**
```json
{
  "source_word": "bright",
  "source_phonemes": ["B", "R", "AY1", "T"],
  "spoken_word": "blight",
  "spoken_phonemes": ["B", "L", "AY1", "T"],
  "phoneme_errors": [
    {
      "position": 1,
      "expected": "R",
      "actual": "L",
      "error_type": "substitution",
      "og_category": "blend_breakdown"
    }
  ]
}
```

### 2.4 Error Classification Service

**Purpose:** Classify alignment divergences into structured-literacy error categories using an LLM.

#### 2.4.1 Taxonomy (Orton-Gillingham Framework)

| Error Category | Code | Description | Examples |
|----------------|------|-------------|----------|
| **Reversal** | `REV` | Confusing visually similar letters or transposing letter order | b/d, p/q, "was"→"saw", "on"→"no" |
| **Substitution** | `SUB` | Replacing one phoneme/word with another | "house"→"horse", "then"→"when" |
| **Omission** | `OMI` | Skipping a word, syllable, or phoneme | "str-ong"→"song", skipping function words |
| **Insertion** | `INS` | Adding words, syllables, or phonemes not in the source | Adding "the" before nouns, repeating syllables |
| **Blend Breakdown** | `BLD` | Inability to combine phonemes into a fluid syllable or word | Sounding out each letter individually; "c-a-t" instead of "cat" |
| **Pacing Anomaly** | `PAC` | Abnormal timing — long pauses, rushed segments, loss of fluency | >2s pause between common words; reading at <60 WPM on grade-level text |

#### 2.4.2 LLM Classification Prompt Structure

```
SYSTEM PROMPT:
You are a structured-literacy diagnostic assistant trained in the
Orton-Gillingham methodology. You classify reading errors into exactly
six categories: REV, SUB, OMI, INS, BLD, PAC.

You receive:
1. The source passage text
2. An alignment diff (JSON array of divergences)
3. Per-word ASR confidence scores

Rules:
- Only classify divergences where confidence_gate is "pass" or "uncertain"
- For "uncertain" items, append a confidence_flag: true
- Classify each divergence into exactly one O-G category
- Provide a brief rationale for each classification
- Output valid JSON

USER PROMPT:
Source: "{source_text}"
Alignment: {alignment_json}

Classify each divergence.
```

**Output Schema:**
```json
{
  "classifications": [
    {
      "index": 0,
      "source_word": "bright",
      "spoken_word": "blight",
      "category": "BLD",
      "rationale": "R-blend simplified to L — consistent with blend breakdown pattern",
      "confidence_flag": false
    }
  ],
  "error_profile": {
    "REV": 0,
    "SUB": 1,
    "OMI": 2,
    "INS": 0,
    "BLD": 3,
    "PAC": 1,
    "uncertain_count": 2
  }
}
```

#### 2.4.3 LLM Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Model** | `gpt-4o` or `claude-sonnet-4-20250514` | Current-gen production models |
| **Temperature** | 0.1 | Near-deterministic for classification consistency |
| **Max tokens** | 2000 | Sufficient for full classification output |
| **Response format** | JSON mode enforced | Prevents formatting errors |
| **Prompt version** | Tracked in version control | Enables A/B testing and audit trail |

### 2.5 Drill Generation Service

**Purpose:** Generate targeted structured-literacy practice activities based on the error profile.

#### 2.5.1 Drill Types

| Error Category | Drill Type | Example |
|----------------|-----------|---------|
| `REV` | Letter discrimination exercises | "Circle all the **b** letters: b d b p d b q b" |
| `SUB` | Minimal pair practice | "Read these pairs: house/horse, then/when, bright/blight" |
| `OMI` | Word-tracking exercises | "Read this sentence and tap each word as you say it" |
| `INS` | Sentence accuracy checks | "Read exactly what's written — no extra words" |
| `BLD` | Blend ladders | "Read: s → st → str → stri → strin → string" |
| `PAC` | Timed fluency passages | "Read this passage in 1 minute. Goal: 80 WPM" |

#### 2.5.2 Drill Generation Prompt

```
SYSTEM PROMPT:
You are a structured-literacy tutor specializing in Orton-Gillingham
methodology. Generate targeted drills for a student based on their
error profile.

Rules:
- Generate 3-5 drills, prioritizing the most frequent error categories
- Each drill must be specific to the error pattern observed
- Use age-appropriate language (grade level provided)
- Include clear instructions the student can follow independently
- Output valid JSON

USER PROMPT:
Error Profile: {error_profile_json}
Specific errors: {classified_errors_json}
Student grade level: {grade_level}
Generate targeted practice drills.
```

### 2.6 Data Storage

#### 2.6.1 Database: PostgreSQL

**Rationale:** Relational structure suits the hierarchical data model (school → class → student → session → errors). JSONB columns handle semi-structured classification output. Strong ecosystem for hosting (Supabase, Render, Railway).

#### 2.6.2 Schema Design

```sql
-- Core entities
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,    -- bcrypt hash (cost factor 12)
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher', 'parent', 'admin')),
    display_name VARCHAR(255) NOT NULL,
    school_id UUID REFERENCES schools(id),
    grade_level INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                   -- soft-delete support
);

CREATE TABLE parent_student_links (
    parent_id UUID REFERENCES users(id),
    student_id UUID REFERENCES users(id),
    consent_granted BOOLEAN DEFAULT FALSE,
    consent_granted_at TIMESTAMPTZ,
    PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE teacher_student_links (
    teacher_id UUID REFERENCES users(id),
    student_id UUID REFERENCES users(id),
    class_name VARCHAR(100),
    PRIMARY KEY (teacher_id, student_id)
);

-- Passages
CREATE TABLE passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    grade_level INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    category VARCHAR(50),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE reading_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    passage_id UUID NOT NULL REFERENCES passages(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    words_per_minute REAL,
    transcript TEXT,                          -- STT output (no raw audio)
    alignment_result JSONB,                  -- Full alignment diff
    status VARCHAR(20) DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    deleted_at TIMESTAMPTZ                   -- soft-delete support
);

-- Error classifications
CREATE TABLE error_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
    word_index INTEGER NOT NULL,
    source_word VARCHAR(100),
    spoken_word VARCHAR(100),
    category VARCHAR(3) NOT NULL
        CHECK (category IN ('REV', 'SUB', 'OMI', 'INS', 'BLD', 'PAC')),
    rationale TEXT,
    asr_confidence REAL,
    confidence_flag BOOLEAN DEFAULT FALSE,   -- true = uncertain classification
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                   -- soft-delete support
);

-- Aggregated error profiles (updated per session)
CREATE TABLE error_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
    rev_count INTEGER DEFAULT 0,
    sub_count INTEGER DEFAULT 0,
    omi_count INTEGER DEFAULT 0,
    ins_count INTEGER DEFAULT 0,
    bld_count INTEGER DEFAULT 0,
    pac_count INTEGER DEFAULT 0,
    uncertain_count INTEGER DEFAULT 0,
    total_words_read INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    error_rate REAL,                         -- total_errors / total_words_read
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                   -- soft-delete support
);

-- Generated drills
CREATE TABLE drills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_category VARCHAR(3) NOT NULL,
    drill_type VARCHAR(50),
    content JSONB NOT NULL,                  -- Drill content and instructions
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                   -- soft-delete support
);

-- Indexes for common queries
CREATE INDEX idx_sessions_student ON reading_sessions(student_id, started_at DESC);
CREATE INDEX idx_sessions_passage ON reading_sessions(passage_id);
CREATE INDEX idx_errors_session ON error_classifications(session_id);
CREATE INDEX idx_errors_category ON error_classifications(session_id, category);
CREATE INDEX idx_profiles_student ON error_profiles(student_id, computed_at DESC);
CREATE INDEX idx_drills_student ON drills(student_id, created_at DESC);

-- Partial indexes for soft-delete filtering
CREATE INDEX idx_users_active ON users(id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sessions_active ON reading_sessions(student_id, started_at DESC) WHERE deleted_at IS NULL;
```

#### 2.6.3 Data Retention Policy

| Data Type | Retention | Storage |
|-----------|-----------|---------|
| Raw audio | **Not stored** — discarded after STT processing | In-memory only |
| STT transcript | Indefinite (text only, no PII beyond words spoken) | PostgreSQL |
| Alignment results | Indefinite | PostgreSQL (JSONB) |
| Error classifications | Indefinite | PostgreSQL |
| Error profiles | Indefinite | PostgreSQL |
| Generated drills | Indefinite | PostgreSQL (JSONB) |
| User PII (name, email) | Until account deletion | PostgreSQL (encrypted at rest) |

### 2.7 Job Queue & Cache Layer

**Purpose:** Decouple the processing pipeline from API request threads; cache LLM responses to reduce cost and latency.

| Component | Technology | Purpose |
|-----------|-----------|--------|
| **Job Queue** | Bull (backed by Redis) | Process STT → alignment → classification → drill gen asynchronously |
| **Cache** | Redis | Cache LLM classification responses for identical alignment patterns; cache passage lists and student profiles |
| **Real-time Push** | Server-Sent Events (SSE) | Push processing step updates to client (replaces polling) |
| **Circuit Breaker** | opossum | Fail-fast on OpenAI API outages; prevent cascade failures |

**Pipeline Job Flow:**
1. `POST /api/v1/sessions/:id/audio` → returns **202 Accepted** immediately
2. Enqueues `process-session` job in Bull with `{ sessionId, audioBlob }`
3. Worker picks up job and runs pipeline stages sequentially:
   - Stage 1: Call Whisper API (STT) → store transcript
   - Stage 2: Run alignment engine → store alignment result
   - Stage 3: Hash alignment diff → check Redis cache → LLM classification (cache miss) or cached result (cache hit)
   - Stage 4: Generate drills (LLM, cached similarly) → store drills
   - Stage 5: Compute error profile → store profile
4. After each stage, push SSE event: `{ step: 1-5, status: 'complete' }`
5. On failure at any stage: push SSE error event; store partial results; mark session with failure stage

**Cache TTL Policy:**

| Key Pattern | TTL | Invalidation |
|-------------|-----|-------------|
| `classification:{alignment_hash}` | 7 days | On prompt version change |
| `passages:list:{grade}:{difficulty}` | 5 minutes | On passage create/update |
| `profile:latest:{student_id}` | 5 minutes | On new session completion |
| `session:status:{session_id}` | 1 hour | On session completion |

**Redis Dependencies:**
```
npm install bull ioredis opossum
```

---

## 3. API Design

> [!IMPORTANT]
> **API Versioning:** All endpoints use the `/api/v1/` prefix (e.g., `/api/v1/sessions`). This is MVP scope to prevent breaking changes post-launch.

> **Standard Error Response:** All errors return:
> ```json
> { "error": { "code": "AUTH_EXPIRED", "message": "Session has expired", "details": {} } }
> ```

### 3.1 REST API Endpoints

#### 3.1.1 Session Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/sessions` | Create a new reading session | Student |
| `POST` | `/api/sessions/:id/audio` | Upload audio recording for a session | Student |
| `GET` | `/api/sessions/:id` | Get session details + results | Student, Teacher, Parent |
| `GET` | `/api/sessions/:id/alignment` | Get alignment diff for a session | Student, Teacher |
| `GET` | `/api/sessions/:id/classification` | Get error classifications for a session | Student, Teacher |
| `GET` | `/api/sessions/:id/drills` | Get generated drills for a session | Student, Teacher |
| `PATCH` | `/api/sessions/:id/drills/:drillId` | Mark a drill as completed | Student |

#### 3.1.2 Dashboard / Analytics

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/students/:id/profile` | Get latest error profile for a student | Teacher, Parent |
| `GET` | `/api/students/:id/profile/history` | Get error profile trend over time | Teacher, Parent |
| `GET` | `/api/students/:id/sessions` | List all sessions for a student | Teacher, Parent |
| `GET` | `/api/classes/:id/analytics` | Get class-level aggregate analytics | Teacher |
| `GET` | `/api/parents/:id/children` | List parent's linked children | Parent |
| `GET` | `/api/parents/:id/children/:childId/report` | Get child's weekly report | Parent |

#### 3.1.3 Content Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/passages` | List available passages (filterable by grade, difficulty) | All |
| `GET` | `/api/passages/:id` | Get passage content | All |
| `POST` | `/api/passages` | Create a custom passage | Teacher, Admin |

#### 3.1.4 User Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Register a new user | Public |
| `POST` | `/api/auth/login` | Login and receive JWT | Public |
| `GET` | `/api/users/me` | Get current user profile | All |
| `POST` | `/api/consent` | Record parental consent | Parent |

### 3.2 Request/Response Examples

#### Create Session
```http
POST /api/sessions
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "passage_id": "uuid-of-passage",
  "student_id": "uuid-of-student"
}

Response 201:
{
  "session_id": "uuid-of-session",
  "status": "in_progress",
  "passage": { "title": "The Fox and the Hound", "word_count": 120 }
}
```

#### Upload Audio & Trigger Pipeline
```http
POST /api/sessions/:id/audio
Authorization: Bearer <jwt>
Content-Type: multipart/form-data

file: <audio_blob.webm>

Response 202:
{
  "session_id": "uuid",
  "status": "processing",
  "estimated_completion_seconds": 15
}
```

#### Get Classification Results
```http
GET /api/sessions/:id/classification
Authorization: Bearer <jwt>

Response 200:
{
  "session_id": "uuid",
  "classifications": [...],
  "error_profile": { "REV": 0, "SUB": 1, "OMI": 2, "INS": 0, "BLD": 3, "PAC": 1 },
  "uncertain_count": 2,
  "drills_generated": true
}
```

---

## 4. Infrastructure & Deployment

### 4.1 Hosting Architecture

| Component | Platform | Tier |
|-----------|----------|------|
| **Frontend SPA** | Vercel | Free (Hobby) for MVP |
| **API Server** | Render (Node.js) | Free tier for MVP; Starter ($7/mo) for production |
| **Database** | Render PostgreSQL or Supabase | Free tier (1GB) for MVP |
| **File Processing** | Render background workers or serverless functions | Included in Render plan |

### 4.2 Environment Configuration

```env
# .env.example
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@host:5432/decodex

# Redis (job queue + cache)
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL_SECONDS=300

# OpenAI
OPENAI_API_KEY=sk-...
WHISPER_MODEL=whisper-1
LLM_MODEL=gpt-4o

# Auth
JWT_SECRET=<random-256-bit-key>
JWT_EXPIRY=7d

# Confidence thresholds
ASR_CONFIDENCE_PASS=0.8
ASR_CONFIDENCE_UNCERTAIN=0.6

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4.3 CI/CD Pipeline

```yaml
# GitHub Actions workflow
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Render
        run: curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
```

---

## 5. Performance Requirements

| Metric | Target (MVP) | Target (Production) |
|--------|-------------|---------------------|
| Audio upload → transcript returned | < 5s (1-min audio) | < 8s (3-min audio) |
| Alignment computation | < 500ms | < 1s |
| Error classification (LLM) | < 5s | < 8s |
| Drill generation (LLM) | < 5s | < 8s |
| Full pipeline (record stop → drills displayed) | < 20s | < 30s |
| Dashboard page load | < 2s | < 2s |
| API response time (non-LLM endpoints) | < 200ms | < 200ms |
| Concurrent users supported | 10 | 500 |

---

## 6. Error Handling & Resilience

### 6.1 Error Handling Strategy

| Failure Mode | Detection | Recovery |
|--------------|-----------|----------|
| Mic permission denied | `getUserMedia` rejection | Show inline permission guide with browser-specific instructions |
| Audio too short (<5 words) | Word count check post-STT | Prompt user to read more; don't process |
| Audio too noisy / unintelligible | Whisper returns <50% confidence on >50% of words | Show "recording quality too low" message; suggest quieter environment |
| Whisper API timeout | HTTP 408 or no response in 30s | Retry once; fall back to Web Speech API transcript with warning |
| Whisper API rate limit | HTTP 429 | Queue and retry with exponential backoff; show "processing" state |
| LLM API failure | HTTP 5xx or timeout | Retry once; show partial results (alignment without classification) |
| Database connection failure | Connection pool exhaustion | Circuit breaker pattern; queue writes for retry |
| Invalid session state | State machine validation | Return 409 Conflict with current state |

### 6.2 Monitoring & Observability

| Tool | Purpose | Phase |
|------|---------|-------|
| Console logging (structured JSON) | Basic debugging | MVP |
| Sentry | Error tracking + alerting | V1 |
| Render/Vercel built-in metrics | Uptime, response times | MVP |
| Custom analytics events | Pipeline stage timing, error rates | V1 |
| Prometheus + Grafana | Full observability stack | V2 |

---

## 7. Testing Strategy

### 7.1 Test Pyramid

| Level | Coverage | Tools | Target |
|-------|----------|-------|--------|
| **Unit tests** | Alignment engine, confidence gating, data transforms | Jest | >90% for alignment engine |
| **Integration tests** | API endpoints, DB operations, LLM prompt → parse | Jest + Supertest | All API endpoints |
| **E2E tests** | Full pipeline with pre-recorded audio samples | Playwright | 3 golden-path scenarios |
| **Classification accuracy tests** | Known-answer test suite (seeded errors → expected categories) | Custom test harness | ≥80% accuracy on test suite |

### 7.2 Test Data

**Seeded error recordings:** 5 pre-recorded audio files with deliberately induced errors:
1. **Reversal test:** "The dog sat on the mat" → speaker says "The bog sat on the mat"
2. **Omission test:** "She quickly ran to the store" → speaker says "She ran to store"
3. **Blend breakdown test:** "The strong wind blew" → speaker says "The s-t-rong wind blew"
4. **Insertion test:** "He went home" → speaker says "He then went to home"
5. **Pacing test:** Normal text read with deliberate 3-second pauses between common words

---

## 8. Third-Party Dependencies

| Dependency | Version | Purpose | License | Risk |
|------------|---------|---------|---------|------|
| React | 18.x | Frontend framework | MIT | Low |
| Vite | 5.x | Build tool | MIT | Low |
| Express | 4.x | API server | MIT | Low |
| pg (node-postgres) | 8.x | PostgreSQL client | MIT | Low |
| OpenAI SDK | 4.x | Whisper + LLM API client | MIT | Low |
| bull | 4.x | Job queue for async pipeline | MIT | Low |
| ioredis | 5.x | Redis client (cache + queue backend) | MIT | Low |
| opossum | 8.x | Circuit breaker for external APIs | MIT | Low |
| jsonwebtoken | 9.x | JWT auth | MIT | Low |
| bcrypt | 5.x | Password hashing | MIT | Low |
| helmet | 7.x | HTTP security headers | MIT | Low |
| cors | 2.x | CORS middleware | MIT | Low |
| express-rate-limit | 7.x | Rate limiting | MIT | Low |
| recharts | 2.x | Dashboard charts | MIT | Low |
| g2p-en (Python) | 2.x | Grapheme-to-phoneme (Phase 2) | Apache 2.0 | Low |

---

*End of TRD — Version 1.0*
