# Decodex — Security Analysis Document

**Version:** 1.0  
**Date:** 2026-07-19  
**Team:** TeraBytes  
**Classification:** Internal — Confidential  
**Status:** Draft — Awaiting Security Review  

---

## 1. Executive Summary

Decodex processes **children's voice recordings** and builds **persistent learning profiles**, making it a high-sensitivity application from a privacy and security perspective. This document identifies threat vectors, regulatory obligations, and architectural controls required to ship responsibly — especially in the Indian education market where COPPA-equivalent protections (DPDP Act 2023) and the "diagnostic" framing create specific legal surface area.

### 1.1 Risk Classification

| Data Category | Sensitivity | Volume | Regulatory Exposure |
|---------------|------------|--------|---------------------|
| Children's voice audio | 🔴 **Critical** | Transient (not stored) | COPPA, DPDP Act, FERPA |
| Student PII (name, email, grade) | 🟡 **High** | Persistent | DPDP Act, FERPA |
| Reading error profiles | 🟡 **High** | Persistent | FERPA (educational records) |
| Teacher/Parent PII | 🟡 **High** | Persistent | DPDP Act |
| Passage content | 🟢 **Low** | Persistent | Copyright (if not original) |
| Aggregated analytics | 🟢 **Low** | Persistent | Anonymization requirements |

---

## 2. Regulatory & Compliance Framework

### 2.1 Applicable Regulations

| Regulation | Jurisdiction | Applicability | Key Requirements |
|------------|-------------|---------------|------------------|
| **DPDP Act 2023** (Digital Personal Data Protection) | India | 🔴 Primary | Verifiable parental consent for children under 18; data minimization; purpose limitation; right to erasure; Data Protection Officer required above threshold |
| **COPPA** (Children's Online Privacy Protection Act) | USA | 🟡 If US users exist | Verifiable parental consent for children under 13; no behavioral advertising to children; data minimization |
| **FERPA** (Family Educational Rights and Privacy Act) | USA (B2School) | 🟡 If US school contracts | Schools act as consent intermediary; no re-disclosure of education records without consent |
| **GDPR** | EU | 🟡 If EU users exist | Consent (Art. 6+8 for children); right to erasure; DPIA required for profiling children |
| **IT Act 2000 + SPDI Rules** | India | 🟡 Supplementary | Reasonable security practices for sensitive personal data |

### 2.2 "Diagnostic" Framing — Legal Risk

**Issue:** Using the word "diagnostic" in marketing or UI may imply a **medical/clinical assessment**, which in India could trigger regulation under the Clinical Establishments Act or require endorsement from a licensed professional.

**Mitigation:**
1. Never use "diagnosis" or "diagnostic" in user-facing copy without qualification
2. Every public surface (website, app, reports) includes the disclaimer: *"Decodex is an educational screening and practice tool. It does not provide clinical diagnosis. For formal assessment, consult a qualified speech-language pathologist or educational psychologist."*
3. Internal taxonomy uses "diagnostic" as a technical descriptor; external language uses **"reading insights"** or **"error pattern analysis"**
4. Terms of Service explicitly disclaim medical advice

### 2.3 Parental Consent Flow

```
┌───────────────────────────────────────────────────────────┐
│                  CONSENT FLOW                              │
│                                                            │
│  1. Teacher/Parent creates student account                 │
│     ├─ Student is MINOR (under 18 in India)               │
│     ├─ System requires parental consent BEFORE any         │
│     │  recording or data collection                        │
│     └─ No audio capture permitted without active consent   │
│                                                            │
│  2. Consent verification method (COPPA-compliant)          │
│     ├─ B2School: School acts as consent intermediary       │
│     │  (FERPA school official exception)                   │
│     ├─ B2C: Parent receives email with one-time link +    │
│     │  must confirm via knowledge-based verification      │
│     │  (child's DOB + parent email on file)                │
│     ├─ Consent form explains:                              │
│     │  ├─ What data is collected (voice → text, no audio)  │
│     │  ├─ How it's used (error analysis, drill generation) │
│     │  ├─ How long it's retained                          │
│     │  ├─ Who can access it (teacher, parent, student)    │
│     │  └─ How to withdraw consent / delete data           │
│     └─ Consent is recorded with timestamp + IP            │
│                                                            │
│  3. Consent granted → student can use recording features   │
│     ├─ Consent status stored in DB                        │
│     ├─ Re-consent required annually                       │
│     └─ Consent can be withdrawn at any time → data deleted │
│                                                            │
│  4. Consent denied/withdrawn → student can still:          │
│     ├─ Browse passages (read silently)                    │
│     ├─ Complete text-based drills                          │
│     └─ NOT use microphone or generate error profiles       │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Threat Model

### 3.1 STRIDE Analysis

| Threat | Category | Description | Severity | Likelihood | Risk |
|--------|----------|-------------|----------|------------|------|
| **T-01** | Spoofing | Attacker impersonates a teacher to access student profiles | 🔴 Critical | Medium | High |
| **T-02** | Spoofing | Attacker impersonates a parent to gain consent and access child data | 🔴 Critical | Low | Medium |
| **T-03** | Tampering | Attacker modifies alignment results or error classifications in transit | 🟡 High | Low | Medium |
| **T-04** | Repudiation | Teacher denies accessing/exporting student data | 🟢 Low | Low | Low |
| **T-05** | Information Disclosure | Student error profiles leaked via API vulnerability | 🔴 Critical | Medium | High |
| **T-06** | Information Disclosure | Audio data intercepted during upload | 🟡 High | Low | Medium |
| **T-07** | Information Disclosure | LLM provider retains/trains on student data | 🟡 High | Medium | High |
| **T-08** | Denial of Service | Attacker floods audio upload endpoint | 🟡 High | Medium | High |
| **T-09** | Elevation of Privilege | Student escalates to teacher role to view other profiles | 🔴 Critical | Low | Medium |
| **T-10** | Information Disclosure | Database breach exposes all student PII and profiles | 🔴 Critical | Low | High |

### 3.2 Attack Surface Map

```
┌─────────────────────────────────────────────────────────────┐
│                     ATTACK SURFACE                           │
│                                                              │
│  EXTERNAL                                                    │
│  ├─ Browser Client                                          │
│  │  ├─ XSS via passage content (if user-uploaded)           │
│  │  ├─ CSRF on state-changing API calls                     │
│  │  ├─ Audio blob tampering (fake audio upload)             │
│  │  └─ localStorage token theft                             │
│  │                                                          │
│  ├─ API Server                                              │
│  │  ├─ Authentication bypass                                │
│  │  ├─ Authorization bypass (IDOR on student profiles)      │
│  │  ├─ SQL injection via passage search/filter              │
│  │  ├─ Rate limiting bypass on audio upload                 │
│  │  └─ File upload vulnerabilities (audio blob processing)  │
│  │                                                          │
│  ├─ Third-Party APIs                                        │
│  │  ├─ OpenAI API key exposure in client bundle             │
│  │  ├─ OpenAI data retention policy (training on inputs)    │
│  │  └─ API response manipulation (MITM)                     │
│  │                                                          │
│  INTERNAL                                                    │
│  ├─ Database                                                │
│  │  ├─ Unencrypted PII at rest                             │
│  │  ├─ Overly permissive access controls                   │
│  │  └─ Backup exposure                                      │
│  │                                                          │
│  └─ Infrastructure                                          │
│     ├─ Environment variable leakage                        │
│     ├─ Unpatched dependencies                              │
│     └─ Insecure deployment configuration                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Security Architecture & Controls

### 4.1 Authentication

| Control | Implementation | Phase |
|---------|---------------|-------|
| **JWT-based auth** | Stateless tokens with RS256 signing; **stored in httpOnly, Secure, SameSite=Strict cookies** (NOT localStorage); 7-day expiry; refresh token rotation | MVP |
| **Password hashing** | bcrypt with cost factor 12 | MVP |
| **Password policy** | Minimum 8 chars, at least one uppercase, one number | MVP |
| **Account lockout** | 5 failed attempts → 15-minute lockout | MVP |
| **Session invalidation** | Token blacklist on logout; invalidate all sessions on password change | V1 |
| **MFA** | TOTP-based MFA for teacher and admin accounts | V2 |
| **SSO** | Google OAuth for B2C; SAML/OIDC for B2School | V2 |

### 4.2 Authorization

| Control | Implementation |
|---------|---------------|
| **Role-based access control (RBAC)** | Four roles: `student`, `teacher`, `parent`, `admin` |
| **Resource-level authorization** | Every API endpoint checks that the requesting user has a valid relationship to the requested resource |
| **IDOR prevention** | No sequential IDs; UUIDs for all entities; server-side ownership validation on every request |
| **Teacher-student binding** | Teacher can only access students in their class (verified via `teacher_student_links` table) |
| **Parent-student binding** | Parent can only access their own linked children (verified via `parent_student_links` table + consent) |
| **Student isolation** | Students can only access their own sessions and profiles |

#### Authorization Matrix

| Resource | Student (own) | Student (other) | Teacher (own class) | Teacher (other class) | Parent (own child) | Admin |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| Student profile | ✅ Read | ❌ | ✅ Read | ❌ | ✅ Read | ✅ Full |
| Reading session | ✅ Full | ❌ | ✅ Read | ❌ | ✅ Read | ✅ Full |
| Error profile | ✅ Read | ❌ | ✅ Read | ❌ | ✅ Read | ✅ Full |
| Drills | ✅ Full | ❌ | ✅ Read | ❌ | ✅ Read | ✅ Full |
| Class analytics | ❌ | ❌ | ✅ Read | ❌ | ❌ | ✅ Full |
| Passage (public) | ✅ Read | ✅ Read | ✅ Full | ✅ Read | ✅ Read | ✅ Full |
| Passage (custom) | ❌ | ❌ | ✅ Full (own) | ❌ | ❌ | ✅ Full |
| User management | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Full |

### 4.3 Data Protection

#### 4.3.1 Encryption

| Layer | Control | Implementation |
|-------|---------|---------------|
| **In transit** | TLS 1.3 | Enforced via Vercel/Render HTTPS; HSTS header with 1-year max-age |
| **At rest (DB)** | AES-256 encryption | Render/Supabase managed encryption at rest; application-level encryption for PII fields (name, email) |
| **At rest (backups)** | Encrypted backups | Managed by hosting provider; verified in infrastructure review |
| **API keys** | Environment variables | Never in source code; rotated quarterly; separate keys per environment |

#### 4.3.2 Audio Data Handling

```
┌──────────────────────────────────────────────────────────────┐
│                  AUDIO DATA LIFECYCLE                          │
│                                                               │
│  1. CAPTURE (Client)                                         │
│     └─ Audio exists only in browser memory (Blob)            │
│                                                               │
│  2. UPLOAD (HTTPS)                                           │
│     └─ Encrypted in transit via TLS 1.3                      │
│     └─ Audio blob sent to /api/sessions/:id/audio            │
│                                                               │
│  3. PROCESSING (Server — in-memory)                          │
│     └─ Server receives blob → holds in memory                │
│     └─ Sends to Whisper API for transcription                │
│     └─ Whisper API processes and returns transcript          │
│     └─ ⚠️  OpenAI data retention: see §4.3.3                │
│                                                               │
│  4. DELETION (Immediate)                                     │
│     └─ Audio blob DELETED from server memory after STT       │
│     └─ Audio blob NEVER written to disk or database          │
│     └─ Only the TEXT transcript persists                     │
│                                                               │
│  5. CLIENT CLEANUP                                           │
│     └─ Browser Blob URL revoked after upload confirmation    │
│     └─ No local storage of audio data                        │
│                                                               │
│  RESULT: No raw audio exists anywhere after processing       │
└──────────────────────────────────────────────────────────────┘
```

#### 4.3.3 Third-Party LLM Data Handling

**Risk:** OpenAI's API may retain input data for abuse monitoring (30 days) or model training (opt-out required).

**Mitigations:**

| Control | Implementation |
|---------|---------------|
| **API data usage opt-out** | Enable OpenAI's zero-data-retention (ZDR) option via API org settings |
| **Data minimization in prompts** | Never include student names, IDs, or PII in LLM prompts — only the passage text and alignment diff |
| **Prompt structure** | Prompts contain only: (1) source passage text, (2) anonymized alignment diff, (3) taxonomy instructions |
| **Contractual** | DPA (Data Processing Agreement) with OpenAI for B2School contracts |
| **Alternative providers** | Anthropic (Claude) with similar DPA; self-hosted Llama models as fallback for high-sensitivity deployments |

**Example of data minimization in LLM prompt:**
```
✅ GOOD (no PII):
"Source: 'The fox jumped over the lazy dog'
Alignment: [{'index': 2, 'source': 'jumped', 'spoken': 'jumpt', 'type': 'substitution'}]
Classify each divergence."

❌ BAD (contains PII):
"Student Rahul Sharma (Grade 3, Class 3B) read the following passage..."
```

### 4.4 API Security

| Control | Implementation | Phase |
|---------|---------------|-------|
| **HTTPS only** | Redirect all HTTP → HTTPS; HSTS header | MVP |
| **CORS** | Whitelist only the frontend domain; no wildcard origins; `credentials: true` for httpOnly cookies | MVP |
| **CSRF protection** | SameSite=Strict cookie attribute prevents CSRF on all API calls; consent form uses CSRF token (csurf middleware) as additional protection | MVP |
| **Rate limiting** | 100 requests/15min per IP (general); 10 audio uploads/hour per user; **20 LLM calls/hour per user** (prevents cost abuse on compromised accounts) | MVP |
| **Request size limits** | 10MB max for audio uploads; 1MB for all other endpoints | MVP |
| **Input validation** | Validate all inputs server-side; sanitize passage content for XSS; Zod schema validation on all request bodies | MVP |
| **Parameterized queries** | All DB queries use parameterized statements (no string concatenation) | MVP |
| **Security headers** | Helmet.js middleware: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | MVP |
| **API versioning** | `/api/v1/` prefix for all endpoints | V1 |
| **Request signing** | HMAC-signed requests for webhook endpoints | V2 |

#### 4.4.1 Content Security Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.openai.com;
  media-src 'self' blob:;
  worker-src 'self' blob:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

### 4.5 Infrastructure Security

| Control | Implementation |
|---------|---------------|
| **Environment isolation** | Separate environments: development, staging, production |
| **Secret management** | Environment variables via hosting provider's secret store; never in source code or Docker images |
| **Dependency scanning** | `npm audit` in CI pipeline; Dependabot/Renovate for automated updates |
| **Container security** | Minimal base images; non-root user; read-only filesystem where possible |
| **Logging** | Structured JSON logs; NO PII in logs; log access attempts, auth failures, API errors |
| **Backup encryption** | Database backups encrypted at rest; tested restore procedure |
| **Network isolation** | Database not publicly accessible; only reachable from API server's VPC |

---

## 5. Data Lifecycle & Retention

### 5.1 Data Retention Policy

| Data Type | Retention Period | Deletion Trigger | Storage Location |
|-----------|-----------------|------------------|------------------|
| **Raw audio** | 0 (never stored) | Immediate after STT | In-memory only |
| **STT transcript** | Until account deletion | User request or 2 years inactive | PostgreSQL |
| **Alignment results** | Until account deletion | User request or 2 years inactive | PostgreSQL (JSONB) |
| **Error classifications** | Until account deletion | User request or 2 years inactive | PostgreSQL |
| **Error profiles** | Until account deletion | User request or 2 years inactive | PostgreSQL |
| **Generated drills** | Until account deletion | User request or 2 years inactive | PostgreSQL (JSONB) |
| **User PII** | Until account deletion | User request | PostgreSQL (encrypted) |
| **Consent records** | 7 years after last interaction | Regulatory requirement | PostgreSQL |
| **Audit logs** | 2 years | Automatic rotation | Log aggregation service |
| **Anonymized aggregates** | Indefinite | N/A | Separate analytics DB |

### 5.2 Right to Erasure (Data Deletion)

**Trigger:** Parent or teacher requests deletion of a student's data.

**Process:**
1. Verify identity of requestor (must be parent or admin)
2. Soft-delete all student data (mark as `deleted`, remove from queries)
3. Hard-delete within 30 days (irreversible)
4. Cascade: sessions, error classifications, error profiles, drills, transcripts
5. Retain: consent record (anonymized, for compliance audit)
6. Confirm deletion to requestor via email

```sql
-- Soft delete cascade
UPDATE users SET deleted_at = NOW() WHERE id = :student_id;
UPDATE reading_sessions SET deleted_at = NOW() WHERE student_id = :student_id;
UPDATE error_classifications SET deleted_at = NOW()
  WHERE session_id IN (SELECT id FROM reading_sessions WHERE student_id = :student_id);
UPDATE error_profiles SET deleted_at = NOW() WHERE student_id = :student_id;
UPDATE drills SET deleted_at = NOW() WHERE student_id = :student_id;

-- Hard delete (30-day cron job)
DELETE FROM drills WHERE deleted_at < NOW() - INTERVAL '30 days';
DELETE FROM error_classifications WHERE deleted_at < NOW() - INTERVAL '30 days';
DELETE FROM error_profiles WHERE deleted_at < NOW() - INTERVAL '30 days';
DELETE FROM reading_sessions WHERE deleted_at < NOW() - INTERVAL '30 days';
DELETE FROM users WHERE deleted_at < NOW() - INTERVAL '30 days';
```

---

## 6. Vulnerability Assessment

### 6.1 OWASP Top 10 Mapping

| OWASP Category | Risk Level | Decodex Exposure | Controls |
|----------------|-----------|------------------|----------|
| **A01: Broken Access Control** | 🔴 High | IDOR on student profiles; role escalation | UUID-based IDs; server-side ownership checks; RBAC middleware |
| **A02: Cryptographic Failures** | 🟡 Medium | PII at rest; passwords | bcrypt hashing; AES-256 at rest; TLS 1.3 in transit |
| **A03: Injection** | 🟡 Medium | SQL injection via search/filter; XSS via passage content | Parameterized queries; input sanitization; CSP headers |
| **A04: Insecure Design** | 🟡 Medium | Audio data flow; consent bypass | Privacy-by-design; no audio retention; consent gates |
| **A05: Security Misconfiguration** | 🟢 Low | Default configs; exposed endpoints | Helmet.js; environment isolation; CI security checks |
| **A06: Vulnerable Components** | 🟡 Medium | npm dependencies | `npm audit`; Dependabot; lockfile integrity |
| **A07: Auth Failures** | 🟡 Medium | Weak passwords; token theft | Password policy; JWT rotation; account lockout |
| **A08: Data Integrity Failures** | 🟢 Low | Classification result tampering | Server-side processing; no client-side classification |
| **A09: Logging Failures** | 🟢 Low | Missing audit trail | Structured logging; access logs; no PII in logs |
| **A10: SSRF** | 🟢 Low | Limited external calls | Whitelist OpenAI API domain; no user-controlled URLs |

### 6.2 Child-Specific Threat Vectors

| Threat | Description | Mitigation |
|--------|-------------|------------|
| **Predatory data collection** | Collecting more data than needed from minors | Data minimization: only transcript persists; no audio, no behavioral tracking, no cookies beyond session |
| **Profile inference** | Building psychological profiles of minors | Error profiles are strictly educational (reading patterns only); no personality or behavioral profiling |
| **Inappropriate content exposure** | Student encounters harmful content in passages or drills | All passages curated or teacher-uploaded; LLM drill generation constrained by system prompt; content moderation on custom passages |
| **Social comparison** | Students compare profiles or scores, causing stigma | No peer visibility; no leaderboards; no class rankings; profiles are private to student + teacher + parent |
| **Account takeover by peer** | Another child accesses a student's account | Session timeout (30 min idle); no "remember me" on shared devices; teacher can reset student passwords |

---

## 7. Incident Response Plan

### 7.1 Severity Classification

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **SEV-1** | Active data breach; child data exposed | Immediate (within 1 hour) | Database breach; API key compromised and used |
| **SEV-2** | Vulnerability discovered; no active exploitation | Within 4 hours | SQL injection found in production; XSS in passage display |
| **SEV-3** | Security misconfiguration; low exploitation risk | Within 24 hours | Missing rate limit on non-sensitive endpoint; outdated dependency |
| **SEV-4** | Best-practice deviation; no immediate risk | Within 1 week | Missing security header; suboptimal password policy |

### 7.2 Response Procedure

```
SEV-1 INCIDENT RESPONSE:

1. CONTAIN (0-1 hour)
   ├─ Isolate affected systems
   ├─ Revoke compromised credentials
   ├─ Enable maintenance mode if needed
   └─ Notify team leads

2. ASSESS (1-4 hours)
   ├─ Determine scope: what data was accessed?
   ├─ Identify affected users
   ├─ Preserve evidence (logs, access records)
   └─ Engage security consultant if needed

3. NOTIFY (4-24 hours)
   ├─ Notify affected users/parents
   ├─ Notify school administrators (B2School)
   ├─ File regulatory notification if required:
   │   ├─ DPDP Act: Data Protection Board of India
   │   ├─ GDPR: Supervisory authority within 72 hours
   │   └─ State breach notification laws (US)
   └─ Prepare public statement if needed

4. REMEDIATE (24-72 hours)
   ├─ Fix root cause
   ├─ Deploy patches
   ├─ Verify fix
   └─ Update security controls

5. POST-MORTEM (1 week)
   ├─ Document timeline and root cause
   ├─ Identify systemic improvements
   ├─ Update threat model
   └─ Share learnings (anonymized) with team
```

---

## 8. Security Testing Plan

### 8.1 Testing Schedule

| Test Type | Frequency | Scope | Phase |
|-----------|-----------|-------|-------|
| **Dependency audit** (`npm audit`) | Every CI build | All npm dependencies | MVP |
| **SAST** (Static Analysis) | Every PR | Source code | V1 |
| **DAST** (Dynamic Analysis) | Monthly | Deployed application | V1 |
| **Penetration testing** | Quarterly | Full application + infrastructure | V2 |
| **Access control review** | Quarterly | Authorization matrix validation | V1 |
| **Consent flow audit** | Bi-annually | End-to-end consent lifecycle | V1 |

### 8.2 Security Test Cases

| ID | Test Case | Priority | Expected Result |
|----|-----------|----------|-----------------|
| SEC-01 | Student A cannot access Student B's error profile via API | P0 | 403 Forbidden |
| SEC-02 | Teacher X cannot access Teacher Y's class data | P0 | 403 Forbidden |
| SEC-03 | Parent cannot access unlinked child's data | P0 | 403 Forbidden |
| SEC-04 | Audio upload without valid session token is rejected | P0 | 401 Unauthorized |
| SEC-05 | Audio upload exceeding 10MB is rejected | P0 | 413 Payload Too Large |
| SEC-06 | SQL injection attempt in passage search returns no data | P0 | 400 Bad Request |
| SEC-07 | XSS payload in custom passage is sanitized on display | P0 | Script not executed |
| SEC-08 | Rate limiter blocks >10 audio uploads/hour per user | P1 | 429 Too Many Requests |
| SEC-09 | JWT with expired token is rejected | P0 | 401 Unauthorized |
| SEC-10 | Student cannot modify their own role to 'teacher' | P0 | 403 Forbidden |
| SEC-11 | No raw audio data exists in database after session | P0 | Query returns empty |
| SEC-12 | No student PII appears in server logs | P0 | Log scan clean |
| SEC-13 | LLM prompts contain no student PII | P0 | Prompt audit clean |
| SEC-14 | Consent-denied student cannot initiate audio recording | P0 | Feature disabled |
| SEC-15 | Data deletion request removes all student data within 30 days | P0 | All related records deleted |

---

## 9. Compliance Checklist

### 9.1 Pre-Launch Checklist

| # | Item | Status | Owner |
|---|------|--------|-------|
| 1 | Privacy policy published and accessible from all pages | ⬜ Pending | Legal |
| 2 | Terms of service published with "not a clinical diagnosis" disclaimer | ⬜ Pending | Legal |
| 3 | Parental consent flow implemented and tested | ⬜ Pending | Engineering |
| 4 | No raw audio persisted anywhere (verified via DB + log audit) | ⬜ Pending | Engineering |
| 5 | All API endpoints have authentication and authorization checks | ⬜ Pending | Engineering |
| 6 | Rate limiting active on all endpoints | ⬜ Pending | Engineering |
| 7 | HTTPS enforced; HSTS header active | ⬜ Pending | DevOps |
| 8 | CSP headers configured | ⬜ Pending | DevOps |
| 9 | Database encryption at rest verified | ⬜ Pending | DevOps |
| 10 | OpenAI ZDR (zero data retention) enabled | ⬜ Pending | Engineering |
| 11 | No PII in LLM prompts (audit complete) | ⬜ Pending | Engineering |
| 12 | No PII in application logs (audit complete) | ⬜ Pending | Engineering |
| 13 | `npm audit` returns 0 critical/high vulnerabilities | ⬜ Pending | Engineering |
| 14 | Data deletion flow tested end-to-end | ⬜ Pending | Engineering |
| 15 | Cookie consent banner (if cookies used) | ⬜ Pending | Engineering |
| 16 | Incident response plan documented and team briefed | ⬜ Pending | Security |

---

## 10. Security Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                        SECURITY LAYERS                             │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  EDGE (Vercel/Render)                                        │  │
│  │  ├─ TLS 1.3 termination                                     │  │
│  │  ├─ DDoS protection (Cloudflare if needed)                  │  │
│  │  ├─ HSTS enforcement                                        │  │
│  │  └─ Geographic restrictions (optional for B2School)         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  APPLICATION LAYER                                           │  │
│  │  ├─ Helmet.js security headers                              │  │
│  │  ├─ CORS whitelist                                           │  │
│  │  ├─ Rate limiting (express-rate-limit)                      │  │
│  │  ├─ JWT authentication middleware                           │  │
│  │  ├─ RBAC authorization middleware                           │  │
│  │  ├─ Input validation & sanitization                         │  │
│  │  ├─ Parameterized SQL queries                               │  │
│  │  └─ Structured logging (no PII)                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  DATA LAYER                                                  │  │
│  │  ├─ PostgreSQL with encryption at rest                      │  │
│  │  ├─ Application-level PII field encryption                  │  │
│  │  ├─ UUID-based identifiers (no sequential IDs)              │  │
│  │  ├─ Row-level security policies                             │  │
│  │  ├─ Encrypted backups                                        │  │
│  │  └─ Network isolation (private VPC)                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  EXTERNAL SERVICES                                           │  │
│  │  ├─ OpenAI API (ZDR enabled; no PII in prompts)             │  │
│  │  ├─ DPA (Data Processing Agreement) in place                │  │
│  │  └─ API key rotation quarterly                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## 11. Recommendations & Priorities

### 11.1 MVP (Must Have)

1. ✅ No raw audio persistence — in-memory only
2. ✅ Parental consent flow before any recording
3. ✅ JWT authentication on all API endpoints
4. ✅ RBAC authorization with ownership checks
5. ✅ HTTPS + HSTS + security headers (Helmet.js)
6. ✅ Rate limiting on audio upload endpoint
7. ✅ Input validation and parameterized queries
8. ✅ "Not a clinical diagnosis" disclaimer on all user-facing surfaces
9. ✅ No PII in LLM prompts or application logs
10. ✅ OpenAI ZDR opt-in

### 11.2 V1 (Should Have)

1. SAST integration in CI pipeline
2. Monthly DAST scans
3. Application-level PII encryption
4. Data deletion flow with confirmation
5. Audit logging for all data access
6. Annual consent renewal workflow

### 11.3 V2 (Nice to Have)

1. MFA for teacher/admin accounts
2. SSO integration for B2School
3. Quarterly penetration testing
4. Self-hosted LLM option for high-sensitivity deployments
5. SOC 2 Type II compliance readiness

---

*End of Security Analysis — Version 1.0*
