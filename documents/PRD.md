# Decodex — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 2026-07-19  
**Team:** TeraBytes  
**Status:** Draft — Awaiting Stakeholder Review  

---

## 1. Executive Summary

**Decodex** is a diagnostic-first AI reading companion that listens to a child read aloud, identifies *why* they struggle (not just *that* they struggle), generates targeted structured-literacy drills, and tracks the evolving error profile across sessions for teachers and parents.

Unlike every existing competitor in the dyslexia edtech space — Speechify, Kurzweil 3000, DyslexiaBuddy, OrCam Learn — which optimize for *consumption* (reading text aloud, reformatting it visually), Decodex optimizes for *improvement* by surfacing specific decoding gaps continuously through normal reading practice.

---

## 2. Problem Statement

### 2.1 The Scale

India's dyslexia prevalence is estimated at **10–15% of school-age children**. Against ~229 million students enrolled in recognized schools, that translates to approximately **35 million children** who struggle with decoding — most of them undiagnosed.

### 2.2 The Diagnosis Bottleneck

- Formal dyslexia diagnosis requires a **speech-language pathologist or educational psychologist** — expensive, scarce, and usually happens *after* a child has already fallen behind for years.
- Teachers observe struggle daily but have **no tool to identify the specific error pattern** — is it letter reversals? phoneme-blend breakdowns? omissions? pacing issues? They are guessing.
- Students practice reading generically instead of targeting their **actual weak points**.

### 2.3 The Edtech Gap

Every existing dyslexia edtech product is **assistive** (text-to-speech, OCR, visual reformatting). None are **diagnostic**. They assume the student's weaknesses are already known via a formal diagnosis and build tools to work *around* them. No product sits *upstream* of diagnosis — surfacing weaknesses continuously through ordinary reading practice.

---

## 3. Product Vision

> **Turn every ordinary reading session into structured diagnostic data — at near-zero marginal cost — that previously required expensive human specialist assessment.**

### 3.1 Core Value Proposition

| Dimension | Competitors | Decodex |
|-----------|-------------|---------|
| **Philosophy** | Accommodate the diagnosis | *Become* the diagnosis |
| **Input** | Text to be consumed | Student reading aloud |
| **Output** | Reformatted/spoken text | Error profile + targeted drills |
| **Data model** | Stateless session | Persistent, evolving profile |
| **Teacher value** | "Student used the tool" | "Student reverses b/d 40% less than 3 weeks ago" |

### 3.2 Target Users

| Persona | Description | Primary Need |
|---------|-------------|--------------|
| **Student (age 6–14)** | Primary/middle school reader, may or may not have a formal dyslexia diagnosis | Engaging, non-stigmatizing practice that actually targets their gaps |
| **Teacher** | Classroom teacher or special educator, manages 20–40 students | Actionable per-student diagnostic data without manual assessment |
| **Parent** | Guardian of a struggling reader | Visibility into their child's progress and concrete "what to practice" guidance |
| **School Administrator** | Decision-maker for edtech purchases | Class-level and school-level analytics, compliance-friendly data handling |

---

## 4. User Stories

### 4.1 Student Stories

| ID | Story | Priority |
|----|-------|----------|
| S-01 | As a student, I can select a reading passage appropriate to my level so I practice with relevant content. | P0 |
| S-02 | As a student, I can read aloud and see my words appear on screen so I know the system is listening. | P0 |
| S-03 | As a student, I receive targeted drills after reading so I practice exactly what I got wrong. | P0 |
| S-04 | As a student, I can see my progress over time so I feel motivated to continue. | P1 |
| S-05 | As a student, I can earn badges/streaks so practice feels rewarding. | P2 |
| S-06 | As a student, I can pause and resume a reading session without losing progress. | P1 |

### 4.2 Teacher Stories

| ID | Story | Priority |
|----|-------|----------|
| T-01 | As a teacher, I can view each student's error profile so I know their specific weaknesses. | P0 |
| T-02 | As a teacher, I can see class-level aggregate analytics so I can plan group interventions. | P1 |
| T-03 | As a teacher, I can assign specific passages to students or groups. | P1 |
| T-04 | As a teacher, I can track a student's progress across sessions (trend lines). | P0 |
| T-05 | As a teacher, I can export a student's report for parent meetings or IEP documentation. | P2 |
| T-06 | As a teacher, I receive alerts when a student's error pattern changes significantly. | P2 |

### 4.3 Parent Stories

| ID | Story | Priority |
|----|-------|----------|
| P-01 | As a parent, I can see my child's current error profile in plain language. | P1 |
| P-02 | As a parent, I receive a weekly progress report. | P1 |
| P-03 | As a parent, I can view recommended at-home practice activities. | P2 |
| P-04 | As a parent, I must provide explicit consent before any recording begins. | P0 |

---

## 5. Feature Requirements

### 5.1 Phase 1 — Hackathon MVP

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| **Passage Selection** | Student picks from a curated set of age-appropriate passages (10–15 passages) | Passages displayed with difficulty labels; selection persists for the session |
| **Mic Capture & STT** | Browser-based mic recording → Whisper API transcription | Audio streams correctly; transcript returned within 5s of reading completion; Web Speech API fallback works |
| **Transcript–Source Alignment** | Word-level edit-distance diff between STT transcript and source text | Alignment output is a list of `{source_word, spoken_word, match_type, confidence}` tuples |
| **Error Classification** | LLM classifies divergences into Orton-Gillingham error categories | Each error tagged as one of: reversal, substitution, omission, insertion, blend_breakdown, pacing_anomaly |
| **Confidence Gating** | Low-ASR-confidence segments flagged "uncertain" instead of classified | Uncertain segments visually distinct in the UI; not counted in error profile stats |
| **Drill Generation** | LLM generates 3–5 targeted drills per identified error pattern | Drills reference the specific error and follow structured-literacy methodology |
| **Basic Teacher View** | Single-page dashboard showing a student's error profile after one session | Profile shows error category breakdown (pie/bar chart) + flagged words + generated drills |

### 5.2 Phase 2 — Post-Hackathon V1 (4–6 weeks)

| Feature | Description |
|---------|-------------|
| **Teacher Classification Feedback** | Teacher can flag "wrong classification" on any error → selects correct O-G category → correction stored as training data for prompt improvement |
| **SLP Validation Study** | Collect 50+ reading sessions validated against SLP assessment → measure precision/recall per error category → publish confusion matrix |
| **Phoneme-Level Alignment** | Grapheme-to-phoneme mapping for detecting sub-word errors (b/d reversals, blend breakdowns) |
| **Multi-Session Profiles** | Error profiles persist and update across sessions; trend tracking over time |
| **Progress Dashboard** | Student-facing progress view with streaks, improvement charts |
| **Teacher Class View** | Aggregate analytics across all students in a class |
| **Parent Portal** | Read-only view of child's profile + weekly summary emails |
| **Passage Library Expansion** | 50+ passages across grade levels; teacher can upload custom passages |
| **Session Replay** | Teacher can review a session's alignment results (no raw audio — only transcript + diff) |

### 5.3 Phase 3 — V2 (3–6 months)

| Feature | Description |
|---------|-------------|
| **School Pilot Integration** | Onboarding flow for schools; admin dashboard; bulk student enrollment |
| **Multi-Language Support** | Hindi and regional Indian language support (alignment + drills) |
| **Adaptive Passage Selection** | System recommends passages targeting the student's weakest error categories |
| **IEP Report Generation** | Exportable reports formatted for Individualized Education Program documentation |
| **Anonymized Data Licensing** | Opt-in, privacy-preserving aggregate error-pattern data pipeline for researchers |
| **Mobile App** | React Native wrapper for tablet use in classrooms |

---

## 6. Success Metrics

### 6.1 Hackathon Demo Metrics

| Metric | Target |
|--------|--------|
| End-to-end pipeline latency (read → profile → drills displayed) | < 30 seconds (async pipeline with SSE) |
| Correct error classification on seeded test samples | ≥ 80% accuracy on known-answer cases |
| Confidence gating correctly flags low-confidence segments | 100% of segments with ASR confidence < 0.6 flagged |
| Demo completes without crash | 3/3 test runs |
| LLM cache hit rate on repeated error patterns | ≥ 40% by demo day |
| Pipeline resilience (partial results on LLM failure) | Alignment view renders even when classification fails |

### 6.2 Post-Launch KPIs

| Metric | Target (V1) | Target (V2) |
|--------|-------------|-------------|
| Weekly Active Students | 100 | 5,000 |
| Sessions per student per week | 2.5 | 3.5 |
| Teacher adoption (active dashboards) | 10 | 200 |
| Error classification accuracy (validated against SLP assessment) | 70% | 85% |
| Student error-rate reduction after 4 weeks of targeted drills | 15% | 25% |
| B2School conversion (school → paid pilot) | 2 schools | 20 schools |

---

## 7. Competitive Analysis (Detailed)

### 7.1 Competitor Matrix

| Competitor | Type | Diagnostic? | Drill Generation? | Persistent Profile? | Price Point | Key Weakness vs. Decodex |
|------------|------|-------------|--------------------|--------------------|-------------|--------------------------|
| **Speechify** | TTS / reading tool | ❌ | ❌ | ❌ | Free / $139/yr | Pure consumption; no diagnostic signal |
| **Microsoft Immersive Reader** | TTS + visual formatting | ❌ | ❌ | ❌ | Free (bundled) | Strong distribution but zero diagnosis |
| **Kurzweil 3000** | Full study suite | ❌ | ❌ | ❌ | ~$1,400/license | Expensive, enterprise-only, still assistive |
| **DyslexiaBuddy** | AI tutor | Partial (comprehension Q&A) | ❌ | ❌ | Free / paid tiers | Closest competitor but focuses on comprehension, not decoding errors |
| **OrCam Learn** | Hardware reading pen | ❌ | ❌ | ❌ | $1,990 (device) | Hardware-locked, no software diagnostic loop |
| **Goblin Tools** | Neurodivergent toolkit | ❌ | ❌ | ❌ | Free / paid | Broad ND support, not dyslexia-specific |

### 7.2 Decodex's Whitespace

Every competitor assumes the student's weaknesses are **already known** via a formal diagnosis and builds tools to work *around* them. Decodex sits **upstream** — surfacing the weaknesses continuously through normal reading practice, using LLM classification to turn an ordinary reading session into structured diagnostic signal at near-zero marginal cost.

---

## 8. Business Model

### 8.1 Revenue Streams

| Stream | Model | Price Point | Margin Notes |
|--------|-------|-------------|--------------|
| **B2C Freemium** | Free: 3 sessions/week, basic drill set. Paid: unlimited sessions, full dashboard, parent reports | ~₹650–1,000/mo ($8–12) | Lower margin, higher volume; acquisition funnel for B2School |
| **B2School** | Per-student/year licensing, bundled with teacher dashboard + class-level analytics | ~₹2,000–4,000/student/year | Higher margin, stickier; schools have special-ed budgets |
| **Data Licensing** (Phase 3) | Anonymized, aggregated error-pattern data → reading-curriculum researchers, structured-literacy publishers | Custom pricing | Opt-in only; no raw audio; privacy-preserving |

### 8.2 Unit Economics (Projected at Scale)

| Cost Component | Per Session | Notes |
|----------------|-------------|-------|
| Whisper API (STT) | ~$0.006/min | ~1–3 min audio per session |
| LLM API (classification + drills) | ~$0.02–0.05 | Depends on prompt length; cacheable taxonomy prompt |
| Hosting (Vercel/Render) | ~$0.001 | Amortized |
| **Total COGS per session** | **~$0.03–0.07** | |
| **Revenue per session (paid user, 12 sessions/mo)** | **~$0.67–1.00** | |
| **Gross margin** | **~90%+** | |

---

## 9. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **ASR error vs. reading error conflation** | 🔴 Critical | Confidence gating: low-ASR-confidence segments flagged "uncertain," not classified |
| **Unvalidated classification accuracy** | 🔴 Critical | Anchor to Orton-Gillingham taxonomy; validate against SLP assessment in pilot |
| **Child data privacy / COPPA-type liability** | 🔴 Critical | No raw audio retention; explicit parental consent; session-only processing |
| **"Diagnostic" framing → medical claim liability** | 🟡 High | Explicit disclaimer: "educational screening tool, not a clinical diagnosis" |
| **Indian-accent / regional pronunciation ASR accuracy** | 🟡 High | Fine-tune Whisper on Indian English child speech samples; regional pronunciation allowlist |
| **Live demo mic failure** | 🟡 Medium | Pre-recorded test samples as fallback; seeded error demonstrations |
| **LLM cost scaling** | 🟢 Low | Cacheable taxonomy prompts; batch processing; potential fine-tune for classification |
| **Competitor fast-follow** | 🟢 Low | Persistent error profile = data moat; classification taxonomy = defensible IP |

---

## 10. Assumptions & Dependencies

### 10.1 Assumptions

1. Whisper API provides sufficient accuracy on child speech in English to produce usable transcripts (>85% WER on clear recordings).
2. Word-level + phoneme-level alignment is sufficient to detect the five core Orton-Gillingham error categories without requiring a trained phonologist.
3. Schools and parents are willing to consent to voice recording for educational purposes with appropriate safeguards.
4. LLM classification, when prompted against a structured taxonomy, produces consistent and repeatable error labels.

### 10.2 Dependencies

| Dependency | Type | Risk Level |
|------------|------|------------|
| OpenAI Whisper API availability | External service | Low |
| LLM API (GPT-4o / Claude) availability & pricing | External service | Low |
| Browser MediaRecorder API support | Platform | Low (supported in all modern browsers) |
| G2P (Grapheme-to-Phoneme) library for phoneme alignment | Open-source library | Medium (quality varies) |
| Orton-Gillingham error taxonomy reference | Domain knowledge | Low (well-documented) |

---

## 11. Out of Scope (MVP)

- Clinical diagnosis or medical claims
- Real-time streaming transcription (batch processing per session is sufficient)
- Non-English language support
- Mobile native app (browser-first)
- Integration with school SIS/LMS systems
- Gamification beyond basic progress indicators
- Peer comparison or class rankings

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Orton-Gillingham (O-G)** | A structured-literacy approach to teaching reading, widely used for dyslexia intervention. Defines error categories used in Decodex's classification taxonomy. |
| **Phoneme** | The smallest unit of sound in speech (e.g., the /b/ in "bat"). |
| **Grapheme** | A letter or group of letters representing a phoneme (e.g., "ph" → /f/). |
| **G2P** | Grapheme-to-Phoneme conversion — mapping written letters to their expected sounds. |
| **Blend breakdown** | Difficulty combining individual phonemes into a fluid syllable or word (e.g., reading "s-t-r-ong" as "song"). |
| **Reversal** | Confusing visually similar letters (b/d, p/q) or transposing letter order ("was" → "saw"). |
| **ASR** | Automatic Speech Recognition — the technology that converts audio to text. |
| **WER** | Word Error Rate — the standard metric for ASR accuracy. |
| **IEP** | Individualized Education Program — a formal plan for students with learning disabilities in schools. |
| **SLP** | Speech-Language Pathologist — a clinical professional who diagnoses communication disorders. |
| **STT** | Speech-to-Text — synonym for ASR. |
| **Confidence gating** | The practice of withholding classification on data points where the upstream system (ASR) reports low confidence. |

---

*End of PRD — Version 1.0*
