# Decodex Privacy Policy

**Effective Date:** August 8, 2026  
**Last Updated:** August 8, 2026  
**Applicable Jurisdiction:** India (Primary Launch Market)

Decodex ("**Decodex**", "**we**", "**us**", or "**our**") operates the AI-powered reading screening and assessment platform accessible at `decodex-five.vercel.app` and associated backend API services (the "**Platform**"). Decodex is designed for educational use by students (ages 6–14), parents, teachers, and school administrators.

This Privacy Policy explains how we collect, use, store, disclose, and protect personal data in compliance with the **Digital Personal Data Protection Act, 2023 ("DPDP Act")**, the **Information Technology Act, 2000**, and the **Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 ("SPDI Rules")**.

---

## 1. Important Notice & Educational Disclaimer

> **⚠️ Educational Screening Tool — Not a Medical Diagnosis**  
> **Decodex is an educational screening and practice tool. It does not provide a clinical or medical diagnosis of dyslexia or any other neurological, developmental, or medical condition. For formal diagnostic assessment, consult a qualified speech-language pathologist, educational psychologist, or medical specialist.**

---

## 2. Identity of Data Fiduciary & Grievance Redressal Officer

Under the DPDP Act, 2023, Decodex acts as the **Data Fiduciary** responsible for determining the purpose and means of processing personal data.

### 2.1 Grievance Redressal Officer
In accordance with Section 13 of the DPDP Act and Rule 5(9) of the SPDI Rules, Decodex has designated a Grievance Officer to address questions, concerns, or complaints regarding data processing, consent, or privacy rights:

* **Attn:** Data Protection & Grievance Redressal Officer  
* **Platform:** Decodex Legal & Privacy Division  
* **Email:** `privacy@decodex.com` / `grievance@decodex.com`  
* **Response Window:** Acknowledgement within 24 hours; resolution within 7 business days.

---

## 3. Special Provisions for Children’s Data (DPDP Act §9 Compliance)

In compliance with **Section 2(f)** of the DPDP Act, 2023, any individual who has not completed 18 years of age is defined as a **child**. Because Decodex is intended for primary and middle school students (ages 6–14):

1. **Verifiable Parental Consent (VPC):** We do not collect, process, or record personal data or voice audio from any child without prior, verifiable consent from a parent or lawful guardian.
2. **Prohibition of Behavioral Tracking & Targeted Ads:** In strict compliance with **Section 9(2)** of the DPDP Act, Decodex does **NOT**:
   * Conduct behavioral monitoring or tracking of children across third-party websites or services.
   * Serve targeted, personalized, or behavioral advertisements to children.
   * Sell, monetize, or rent student personal data or voice recordings to third parties.
3. **No Detrimental Processing:** We do not process children's personal data in any manner that is likely to cause detrimental effects on the well-being of a child (DPDP Act §9(3)).

---

## 4. Personal Data We Collect

We collect only the personal data necessary to provide reading screening, error pattern analysis, and personalized practice drills.

### 4.1 Account Information
* **Student Accounts:** Display name, grade level (ages 6–14), preferred language (`en`/`hi`), unique invite code, and date of birth (used strictly for verification).
* **Parent & Teacher Accounts:** Email address, password hash (encrypted using `bcrypt` with cost factor 12), display name, role (`parent`, `teacher`, `admin`), preferred language, and assigned school ID (`school_id`).

### 4.2 Voice Audio Recordings & Speech Transcripts
* **Raw Audio Recordings:** When a student reads a passage aloud, their voice recording is captured by the browser microphone and transmitted to our server. **Decodex stores the raw audio recording in a private object storage bucket** (local disk by default, or Supabase Storage when configured) — **not in the PostgreSQL database**. Audio is referenced in the database by a storage key (`reading_sessions.audio_storage_key`), MIME type, size, and provider. Legacy `audio_base64` and `audio_file_path` columns are deprecated and no longer written for new uploads.
* **Speech-to-Text (STT) Transcripts:** Text transcriptions generated from student voice recordings via speech-to-text engines (OpenAI Whisper / Groq).

### 4.3 Educational & Error Analysis Data
* **Word Alignment & Error Profiles:** Needleman-Wunsch word alignment diffs, Orton-Gillingham error classifications (`REV` Reversal, `SUB` Substitution, `OMI` Omission, `INS` Insertion, `BLD` Blend breakdown, `PAC` Pacing, `UNC` Uncertain), error frequency, and Words Per Minute (WPM).
* **Reading Health Scores & Risk Screenings:** Composite 0–100 reading health scores, fluency metrics, risk indicator levels (`low`, `medium`, `high`), and historical screening records.
* **Special Education & Copilot Records:** Individualized Education Program (IEP) strategies, copilot intervention histories, teacher notes, and parent communication drafts.
* **Gamification & Practice Data:** Reading XP, active streaks, monthly freeze counts, generated practice stories, and completed drills.

### 4.4 Technical & Consent Verification Data
* Consent timestamps, parent IP addresses (`consent_ip`), verification token records (`consent_tokens`), HTTP-only authentication cookie identifiers, and server access logs.

---

## 5. Purpose of Processing & Legal Basis

Under Section 4 of the DPDP Act, 2023, we process personal data strictly for lawful, specified purposes based on **affirmative, verifiable consent**:

| Data Category | Purpose of Processing | Legal Basis (DPDP Act) |
|---------------|-----------------------|------------------------|
| **Voice Audio (`audio_base64`)** | Speech-to-text transcription, playback for parents & teachers to review reading progress. | Verifiable Parental Consent (DPDP §6 & §9) |
| **Transcripts & Alignment** | Identifying misread words, calculating WPM, and mapping speech errors to text. | Verifiable Parental Consent (DPDP §6 & §9) |
| **Error Profiles & Risk Screenings** | Classifying Orton-Gillingham error patterns and computing preliminary dyslexia risk indicators. | Verifiable Parental Consent (DPDP §6 & §9) |
| **IEP & Copilot Strategies** | Assisting teachers with tailored classroom intervention roadmaps. | Verifiable Parental Consent & Educational Contract |
| **Account PII (Email, Password)** | User authentication, account management, and security. | Contract Performance & Consent |
| **Parent Consent Records** | Regulatory audit compliance, establishing proof of verifiable consent. | Legal Obligation (DPDP §9) |

---

## 6. Audio Recording Storage & Retention Policy

### 6.1 Object Storage Architecture (V5)
As of V5, Decodex stores student voice recordings in a **private object storage bucket** rather than as base64 blobs in PostgreSQL. The storage backend is configurable:
* **Local Disk (default for development/testing):** Files stored under `./audio-storage/{studentId}/{sessionId}.{ext}` with access restricted to the application process.
* **Supabase Storage (production):** Files stored in a private Supabase Storage bucket (`decodex-audio` by default) with row-level security and signed URL access.
* **Future S3-compatible:** The storage abstraction layer supports pluggable providers.

Audio is referenced in the database by a canonical storage key (`reading_sessions.audio_storage_key`), MIME type (`audio_mime_type`), size in bytes (`audio_size_bytes`), and provider (`audio_storage_provider`). Legacy columns `audio_base64` and `audio_file_path` are retained for backward compatibility with pre-V5 sessions but are **no longer written for new uploads** (set to `NULL`).

### 6.2 Parental Rights Over Audio
Parents have the absolute right to:
1. **Listen** to all recorded audio sessions through the Parent Portal (`/parent/children/:id/sessions/:sessionId`).
2. **Request Immediate Erasure** of recorded audio sessions.
3. **Withdraw Consent**, which immediately disables voice recording and triggers account-wide data purging.

---

## 7. Third-Party Subprocessors & Cross-Border Data Transfers

To deliver real-time speech processing and cloud database management, Decodex shares specific data elements with trusted third-party service providers (**Data Processors**).

### 7.1 Named Subprocessors

| Subprocessor | Purpose | Data Transferred | Location / Region |
|--------------|---------|------------------|-------------------|
| **Render Services Inc.** | Backend API Application Hosting | Encrypted web requests, transient processing payloads | Oregon, USA (`us-west-2`) |
| **Supabase Inc. / AWS** | Managed PostgreSQL Database Hosting | All persistent database records (encrypted at rest) | Virginia / Oregon, USA |
| **Supabase Storage** | Private Audio Object Storage (when configured) | Student voice recordings (encrypted at rest, private bucket) | Virginia / Oregon, USA |
| **OpenAI LLC** | Speech-to-Text (Whisper) & Error Classification (GPT-4o-mini) | Audio files (for STT) and anonymized word alignment diffs. **No student names or PII are included in LLM prompts.** | California, USA |
| **Groq Inc.** | High-speed Whisper STT Fallback Processing | Audio files (for STT) | California, USA |
| **Google LLC (Gmail SMTP)** | Consent Verification & Notification Email Delivery | Parent email address, student display name, verification link | Global / USA |

### 7.2 Cross-Border Transfer Disclosure (DPDP Act §16)
Decodex’s backend servers, databases, and AI processing infrastructure are hosted in the **United States (Oregon & California)**. 

Under **Section 16 of the DPDP Act, 2023**, cross-border transfer of personal data outside India is permitted unless explicitly restricted by a notification issued by the Central Government of India. Currently, no negative-list restriction prohibits educational data transfers to the United States. By granting parental consent, parents explicitly authorize the transfer, processing, and storage of encrypted personal data and voice recordings on secure servers located in the United States, subject to equivalent technical safeguards (TLS 1.3 encryption in transit, AES-256 at rest).

---

## 8. Verifiable Parental Consent Flow & Lifecycle

Decodex implements a two-step consent verification mechanism before microphone access is unlocked (`requireConsent` middleware):

```
1. PARENT REGISTRATION & LINKING
   Parent creates account -> enters Student Invite Code -> link created (consent_granted = FALSE).

2. KNOWLEDGE-BASED VERIFICATION
   Parent receives verification token via Email (Gmail SMTP) OR enters Student's Date of Birth.
   System validates relationship -> sets consent_granted = TRUE & records consent_ip + timestamp.

3. ANNUAL RE-CONSENT & CONSENT EXPIRY
   Consent records automatically expire after 365 days (AND consent_date >= NOW() - 365 days).
   Annual re-consent is required to maintain microphone recording privileges.

4. CONSENT WITHDRAWAL & HARD DELETE
   Parent clicks "Withdraw Consent" -> sets withdrawn_at timestamp -> microphone access blocked.
   System schedules HARD DELETE of all session data, audio, and profiles in 30 days (hard_delete_at).
```

---

## 9. Security Safeguards

Decodex enforces technical and organizational security measures to protect sensitive educational data:

* **Password Security:** Passwords are hashed using `bcrypt` with a cost factor of 12. Plaintext passwords are never stored or logged.
* **Authentication Security:** Authentication credentials use JSON Web Tokens (JWT) stored exclusively in `httpOnly`, `Secure`, `SameSite=Strict` cookies. Tokens are not stored in unencrypted browser `localStorage`.
* **Database & Query Protection:** All PostgreSQL queries use parameterized prepared statements, preventing SQL injection vulnerabilities.
* **Transport Encryption:** All network traffic between browser, backend, and subprocessors is encrypted using TLS 1.3.
* **Authorization Guards:** Server-side Role-Based Access Control (RBAC) and IDOR relationship checks ensure students can access only their own data, and teachers can access data only for students enrolled at their assigned school (`school_id`).

---

## 10. Data Principal Rights (DPDP Act §§11–14)

Under the DPDP Act, 2023, parents (on behalf of child Data Principals) and adult users possess the following rights:

1. **Right to Access Information (DPDP §11):** Request a summary of personal data processed, error profiles, and third parties with whom data has been shared.
2. **Right to Correction and Erasure (DPDP §12):** Request correction of inaccurate personal data or complete erasure of student accounts, voice recordings, and reading histories.
3. **Right of Grievance Redressal (DPDP §13):** Contact our Grievance Officer (`grievance@decodex.com`) for resolution of any complaints within 7 business days.
4. **Right to Nominate (DPDP §14):** Nominate an individual to exercise data rights in the event of death or incapacity.

To exercise any of these rights, email `privacy@decodex.com`. Requests are processed free of charge after identity verification.

---

## 11. Threshold Notice: Significant Data Fiduciary (SDF) Status

Under **Section 10 of the DPDP Act, 2023**, the Central Government of India may designate certain entities as **Significant Data Fiduciaries (SDFs)** based on the volume and sensitivity of personal data processed, especially children's data.

**Decodex Flag:** Decodex currently operates as a standard Data Fiduciary. However, because we process children's voice recordings, reading health metrics, and special education records at scale, Decodex monitors its processing volume against government notification thresholds. Upon crossing SDF thresholds, Decodex will formally appoint a resident Data Protection Officer (DPO) in India, conduct periodic Data Protection Impact Assessments (DPIAs), and engage independent data auditors.

---

## 12. Data Breach Notification Commitment

In the event of a personal data breach affecting student records or voice audio, Decodex will, in accordance with the DPDP Act and CERT-In guidelines:
1. Notify the **Data Protection Board of India (DPBI)** without delay.
2. Notify affected parents, teachers, and school administrators detailing the nature of the breach, affected data categories, and remedial steps taken.
