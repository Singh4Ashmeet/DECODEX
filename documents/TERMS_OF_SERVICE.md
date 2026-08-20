# Decodex Terms of Service

**Effective Date:** August 8, 2026  
**Last Updated:** August 8, 2026  
**Governing Law:** Laws of the Republic of India  
**Jurisdiction:** Courts of New Delhi, India  

Welcome to Decodex. These Terms of Service ("**Terms**") constitute a legally binding agreement between **Decodex** ("**Platform**", "**we**", "**us**") and you ("**User**", "**you**", or "**your**", whether a Student, Parent, Teacher, or School Administrator).

---

## 1. Acceptance of Terms & Eligibility

1. **Acceptance:** By creating an account, accessing, or using Decodex, you agree to be bound by these Terms and our Privacy Policy.
2. **Age Eligibility:** 
   * **Students (Minors):** Students under 18 years of age are not permitted to create accounts independently. Student accounts must be created by a parent, legal guardian, or authorized school teacher.
   * **Adult Account Holders:** Parent and Teacher account holders must be at least 18 years of age and legally competent to enter into binding contracts under the **Indian Contract Act, 1872**.
3. **School Authority:** Teachers or school administrators creating student accounts represent and warrant that they possess legal authority from their educational institution to enroll students.

---

## 2. Mandatory Disclaimer — Screening vs. Medical Diagnosis

The following disclaimer applies to all surfaces of the Decodex Platform, including web dashboards, PDF exports, and AI-generated progress summaries:

> **⚠️ MANDATORY LEGAL DISCLAIMER**  
> **"This is an educational screening tool, not a medical diagnosis. Consult a qualified specialist for clinical assessment."**  
>  
> Decodex utilizes artificial intelligence and automated speech alignment algorithms to analyze oral reading fluency and classify error patterns using Orton-Gillingham educational concepts. Decodex is **NOT** a medical device, clinical diagnostic instrument, or healthcare service. Nothing contained on the Platform constitutes medical advice, clinical diagnosis, or treatment of dyslexia, dyspraxia, or any learning disorder.

---

## 3. Account Types & Scope of Access

| Role | Permitted Actions | Data Isolation Boundary |
|------|-------------------|--------------------------|
| **Student** | Read passages, record voice sessions, complete practice drills, view personal XP/streaks. | Access restricted strictly to student's own sessions via IDOR guards. |
| **Parent** | Link child via Invite Code, confirm/withdraw parental consent, view child's WPM, error profiles, listen to recorded audio. | Access restricted strictly to linked children via `parent_student_links`. |
| **Teacher** | Assign passages, review classroom WPM trends, override AI error classifications, generate Copilot intervention strategies. | Access restricted strictly to students enrolled at teacher's assigned `school_id`. |
| **School Admin** | Manage school roster, view aggregated grade-level analytics. | Scoped to institutional subscription domain. |

---

## 4. Verifiable Parental Consent & Child Minor Usage

1. **Consent Requirement:** Microphone recording and speech processing features are strictly disabled until a parent or guardian completes the consent verification workflow.
2. **Knowledge-Based Verification:** Parents confirm relationship and consent by supplying student invite codes and matching date-of-birth records.
3. **Consent Validity & Renewal:** Parental consent remains valid for **365 days** from the date of confirmation. Decodex will prompt the parent for annual re-consent. If re-consent is not granted, microphone recording privileges are suspended.
4. **Consent Withdrawal:** A parent may withdraw consent at any time through the Parent Portal. Consent withdrawal initiates a **30-day grace period**, after which all associated session recordings, transcripts, and error profiles are permanently deleted (`hard_delete_at`).

---

## 5. Subscriptions, Payments & Billing

1. **Paid Product:** Decodex is a paid software-as-a-service (SaaS) subscription platform offered to parents (B2C) and schools/districts (B2School).
2. **Billing Terms:** Subscriptions are billed on a recurring monthly or annual basis. Fees are quoted in Indian Rupees (INR ₹) for Indian users, inclusive of applicable Goods and Services Tax (GST).
3. **Refund Policy:** B2C monthly subscriptions may be canceled at any time, taking effect at the end of the current billing cycle. No pro-rated refunds are issued for partial billing periods unless required by applicable Indian consumer protection laws.

---

## 6. Acceptable Use & Conduct Rules

Users agree **NOT** to:
1. Upload, record, or transmit audio containing unlawful, abusive, defamatory, or inappropriate content.
2. Attempt to bypass or modify authentication checks, parental consent middleware (`requireConsent`), or IDOR relationship guards.
3. Reverse engineer, decompile, or extract source code, AI prompts, or proprietary Needleman-Wunsch alignment algorithms.
4. Use automated bots, scrapers, or scripts to extract passage content or benchmark data.
5. Impersonate any teacher, parent, or school administrator.

---

## 7. Intellectual Property Rights

1. **Decodex Ownership:** The Platform, codebase, design system, UI layout, logo, domain names, Orton-Gillingham prompt classification taxonomy, and algorithms are the exclusive intellectual property of Decodex.
2. **AI-Generated Content:** Practice drills, AI-generated decodable stories, and Copilot intervention roadmaps generated by the Platform are licensed to active Users under a non-exclusive, non-transferable, personal license for educational use only.
3. **User Content & Audio License:** Users retain ownership of their raw voice recordings. By uploading audio to the Platform, the parent/user grants Decodex a limited, worldwide, royalty-free license to store, process, transcribe, and playback the audio solely for delivering educational services to the User.

---

## 8. Limitation of Liability

1. **As-Is Provision:** Decodex is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, express or implied.
2. **No Clinical Reliance:** Decodex shall not be liable for any educational, academic, psychological, or medical decisions made by parents, teachers, or schools based on risk screening indicators or AI-generated suggestions.
3. **Liability Cap:** To the maximum extent permitted under Indian law, Decodex’s total aggregate liability for any claims arising out of these Terms shall not exceed the total fees paid by the User to Decodex during the three (3) months preceding the claim.

---

## 9. Governing Law & Dispute Resolution

1. **Governing Law:** These Terms, Privacy Policy, and any disputes arising hereunder shall be governed by and construed in accordance with the **laws of the Republic of India**.
2. **Arbitration:** Any dispute, controversy, or claim arising out of or relating to these Terms shall be referred to and finally resolved by binding arbitration in accordance with the **Arbitration and Conciliation Act, 1996**. The venue and seat of arbitration shall be **New Delhi, India**. The language of arbitration shall be English.
3. **Jurisdiction:** Subject to arbitration, the courts located in **New Delhi, India** shall have exclusive jurisdiction over all legal proceedings.
