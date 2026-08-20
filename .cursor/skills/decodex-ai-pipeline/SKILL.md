---
name: decodex-ai-pipeline
description: >-
  Decodex async AI reading pipeline — Whisper STT, word alignment, GPT-4o-mini
  O-G classification, Redis caching, circuit breakers, and drill generation.
  Use when modifying transcription, alignment, classification, caching, or the
  Bull worker processing flow.
---

# Decodex AI Pipeline

## Pipeline Stages

The worker in `backend/src/queue/worker.ts` orchestrates all stages and emits SSE events:

| Step | SSE event `step` | Service | Output |
|------|------------------|---------|--------|
| 1 | `transcribing` | `services/openai.ts` → `transcribeAudio` | Plain text transcript |
| 2 | `aligning` | `services/alignment.ts` → `alignText` | `AlignmentResult[]` |
| 3 | `classifying` | `services/classifier.ts` → `classifyErrors` | `ClassificationResult[]` |
| 4 | `saving` | `db/analytics.ts` | DB rows in `error_classifications`, `error_profiles` |
| 5 | `generating` | `services/drills.ts` → `generateDrill` | Row in `drills` |
| 6 | `complete` | worker | Session marked `completed` with WPM |

## Entry Points

- **Upload:** `POST /api/v1/sessions/:id/audio` — multer saves file, enqueues Bull job, returns 202
- **SSE:** `GET /api/v1/sessions/:id/status/stream` — in-memory `sseClients` Map (single-process only)
- **Results:** `GET /api/v1/sessions/:id/results` — session + classifications + drills

## Stage 1: Speech-to-Text

**File:** `backend/src/services/openai.ts`

```typescript
export const transcribeAudio = async (filePath: string): Promise<string>
```

- Model: `whisper-1`, format: `text`, language: `en`
- Wrapped in Opossum circuit breaker (15s timeout)
- **Mock mode:** No valid `OPENAI_API_KEY` → 3s delay + hardcoded transcript with intentional errors
- **Fallback:** Circuit open → `"Fallback transcript due to service timeout."`
- Temp audio file deleted in worker `finally` block

## Stage 2: Alignment

**File:** `backend/src/services/alignment.ts`

```typescript
export interface AlignmentResult {
  sourceWord: string | null;
  spokenWord: string | null;
  type: 'match' | 'omission' | 'insertion' | 'substitution';
  index: number;
}
export const alignText = (original: string, spoken: string): AlignmentResult[]
```

- Uses `diff` library (`diffWords`) on normalized text (lowercase, punctuation stripped)
- Parses remove+add pairs as `substitution`
- Pure removes → `omission`, pure adds → `insertion`
- Only non-`match` rows are sent to the classifier

## Stage 3: Classification

**File:** `backend/src/services/classifier.ts`

```typescript
export type ErrorCategory = 'REV' | 'SUB' | 'OMI' | 'INS' | 'BLD' | 'PAC' | 'UNC';
export const classifyErrors = async (alignment: AlignmentResult[]): Promise<ClassificationResult[]>
```

- Model: `gpt-4o-mini` with `response_format: json_object`
- System prompt anchors O-G taxonomy (see `decodex-domain` skill)
- **Redis cache:** SHA-256 hash of error set → key `classify:{hash}`, TTL 7 days
- **Circuit breaker:** 10s timeout; fallback assigns `UNC` to all errors
- **Mock mode:** Maps alignment `type` directly (omission→OMI, insertion→INS, else SUB)

## Stage 4: Persistence

**File:** `backend/src/db/analytics.ts`

- `saveClassifications` — batch parameterized INSERT into `error_classifications`
- `updateErrorProfile` — aggregates counts into `error_profiles`, returns count map for drills

WPM computed in worker: `totalPassageWords / (durationSeconds / 60)`

## Stage 5: Drill Generation

**File:** `backend/src/services/drills.ts`

- Picks most frequent drillable category among `REV`, `SUB`, `BLD`
- Skips if max count is 0
- Currently rule-based content (not LLM) — Phase 2 may add LLM drill gen per TRD
- Stores JSONB `content` with `instructions` and `target`

## Resilience Patterns

```
OpenAI call → Opossum circuit breaker → fallback (UNC or mock transcript)
           → Redis cache (classifications only, not fallbacks)
```

Do not cache fallback results (`rationale` contains `"Fallback applied due to service timeout/error."`).

## Modifying the Pipeline

| Change | Touch these files |
|--------|-------------------|
| Add pipeline step | `worker.ts`, `sessions.ts` (SSE events), `useSessionSSE.ts` (frontend step type) |
| Change alignment logic | `alignment.ts`, add unit tests |
| Change LLM prompt | `classifier.ts` → `classificationPrompt` |
| Add word-level confidence gating | `openai.ts` (verbose_json), `alignment.ts`, classifier input |
| Scale horizontally | Replace in-memory `sseClients` with Redis pub/sub |

## Frontend Integration

- `frontend/src/hooks/useSessionSSE.ts` — listens for `connected`, `status`, `error` events
- `frontend/src/pages/SessionActive.tsx` — records audio, uploads, shows pipeline progress
- `frontend/src/pages/SessionResults.tsx` — fetches results after `complete` step
