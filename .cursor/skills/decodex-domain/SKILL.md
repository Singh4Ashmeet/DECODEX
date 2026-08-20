---
name: decodex-domain
description: >-
  Decodex Orton-Gillingham reading error taxonomy, classification rules,
  confidence gating, teacher feedback loop, and structured-literacy drill
  concepts. Use when modifying LLM prompts, error categories, classification
  UI, analytics labels, or pedagogical logic.
---

# Decodex Domain Knowledge

## Orton-Gillingham Error Taxonomy

Decodex classifies reading errors into structured-literacy categories aligned with Orton-Gillingham (O-G) methodology.

| Code | Name | Description | Example |
|------|------|-------------|---------|
| `REV` | Reversal | Letter or word visually reversed | "was" for "saw", "b" for "d" |
| `SUB` | Substitution | Wrong word/phoneme, often visually similar | "house" for "horse" |
| `OMI` | Omission | Skipped word or syllable | Source "the cat" → spoken "cat" |
| `INS` | Insertion | Added word not in source | Source "the cat" → spoken "the big cat" |
| `BLD` | Blend breakdown | Consonant blend not merged | "st-op" instead of "stop" |
| `PAC` | Pacing / Self-correction | Stumble, repeat, then fix | Hesitation with recovery |
| `UNC` | Uncertain | Low confidence or unclassifiable | ASR noise, ambiguous error |

### Mapping: Alignment Type → Default Category

Alignment engine produces mechanical types; classifier assigns pedagogical categories:

| Alignment `type` | Typical O-G category |
|------------------|---------------------|
| `omission` | OMI |
| `insertion` | INS |
| `substitution` | REV, SUB, or BLD (LLM decides) |
| `match` | (not classified — no error) |

## LLM Classification Prompt

**Location:** `backend/src/services/classifier.ts` → `classificationPrompt`

Rules enforced in prompt:
- ONE category per error
- JSON response: `{ "classifications": [{ "index", "category", "rationale" }] }`
- Rationale ≤ 30 words
- `UNC` when confidence is insufficient

When editing the prompt, keep JSON schema in sync with parsing code at `parsed.classifications`.

## Confidence Gating (TRD Spec)

| Gate | Condition | Behavior |
|------|-----------|----------|
| `pass` | ASR confidence ≥ 0.6 | Normal classification |
| `uncertain` | ASR confidence < 0.6 | Flag as `UNC`, exclude from profile stats |
| `fail` | ASR failure | Skip classification entirely |

**Current MVP status:** Whisper returns plain text (no per-word confidence). Full gating requires switching `openai.ts` to `verbose_json` with word timestamps — planned in TRD Phase 2.

DB column `error_classifications.confidence_flag` exists for this purpose.

## Error Profiles & Analytics

After each session, `error_profiles` stores aggregated counts:

```
rev_count, sub_count, omi_count, ins_count, bld_count, pac_count, uncertain_count
total_words_read, total_errors, error_rate (= total_errors / total_words_read)
```

Teacher dashboards display:
- WPM trend over sessions
- Error rate trend
- Category breakdown (pie/bar via Recharts)

## Teacher Human-in-the-Loop

Teachers can override AI classifications without destroying original data.

**Endpoint:** `POST /api/v1/sessions/:id/classifications/:errorIndex/feedback`

```json
{ "corrected_category": "REV" }
```

**Storage:** `classification_corrections` table preserves:
- `original_category` (AI assignment)
- `corrected_category` (teacher choice)
- `teacher_id`, timestamp

This data is intended for future prompt fine-tuning (Phase 2 per PRD).

## Drill Generation Logic

**File:** `backend/src/services/drills.ts`

Drillable categories: `REV`, `SUB`, `BLD` (OMI/INS/UNC skipped — hard to drill programmatically)

| Dominant error | Drill type | Focus |
|----------------|------------|-------|
| REV | Visual Discrimination | b/d distinction |
| BLD | Phoneme Blending | Consonant blends |
| SUB | Sight Word Practice | Common substitutions |

Phase 2 (per PRD): LLM-generated drills referencing specific flagged words.

## Product Phases (Context for Agents)

| Phase | Scope |
|-------|-------|
| Phase 1 (MVP) | Passage select, mic capture, alignment, classification, basic drills, teacher view |
| Phase 2 | Teacher feedback loop, multi-session profiles, phoneme-level alignment, parent portal |
| Phase 3 | School pilot, Hindi/regional languages, adaptive passages, IEP reports, mobile app |

Check `documents/PRD.md` and `documents/FEATURE_TICKETS.md` before implementing Phase 2+ features.

## Privacy & Data Rules

- **No raw audio persistence** — processed in-memory/temp file, deleted after STT
- Transcripts stored in `reading_sessions.transcript`
- Parent consent tracked in `parent_student_links.consent_granted` (Phase 2)
- Soft-delete on users, sessions, classifications (`deleted_at`)

## UI Label Mapping

When displaying categories in frontend, use teacher-friendly labels:

```typescript
const CATEGORY_LABELS: Record<string, string> = {
  REV: 'Reversal',
  SUB: 'Substitution',
  OMI: 'Omission',
  INS: 'Insertion',
  BLD: 'Blend Breakdown',
  PAC: 'Pacing',
  UNC: 'Uncertain',
};
```

Match color coding in `AnnotatedText.tsx` for consistency.
