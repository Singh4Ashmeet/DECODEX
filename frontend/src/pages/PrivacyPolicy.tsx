import React from 'react';
import { Link } from 'react-router-dom';
import DexAvatar from '../components/DexAvatar';

export default function PrivacyPolicy() {
  return (
    <main className="flex-grow w-full max-w-[900px] mx-auto px-container-padding py-8 sm:py-12 text-on-surface">
      <Link to="/" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary font-display text-sm font-bold tracking-[0.08em] uppercase transition-all group mb-6">
        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
        Back to Home
      </Link>

      <article className="stat-card stat-card-hover p-6 sm:p-12 border border-white/80 shadow-lg space-y-8" style={{ borderLeftColor: 'var(--color-primary)' }}>
        {/* Header */}
        <header className="border-b border-surface-container-highest pb-6">
          <div className="flex items-center gap-3 mb-4">
            <DexAvatar state="idle" size="sm" showCaptionBubble={false} />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/20 text-primary font-display text-xs font-bold uppercase tracking-widest mb-3">
                <span className="material-symbols-outlined text-sm">shield</span>
                Legal & Regulatory Compliance
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-primary">Decodex Privacy Policy</h1>
              <p className="font-body text-sm text-on-surface-variant mt-2 student-text">
                <strong>Effective Date:</strong> August 8, 2026 | <strong>Jurisdiction:</strong> India (DPDP Act, 2023)
              </p>
            </div>
          </div>
        </header>

        {/* Disclaimer Banner */}
        <section className="stat-card stat-card-hover p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-on-surface" style={{ borderLeftColor: 'var(--risk-medium-border)' }}>
          <h2 className="font-display text-base font-bold text-amber-800 flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-amber-600">warning</span>
            Educational Screening Tool — Not a Medical Diagnosis
          </h2>
          <p className="font-body text-xs sm:text-sm text-on-surface-variant leading-relaxed student-text">
            Decodex is an educational screening and practice tool. It does <strong>not</strong> provide a clinical or medical diagnosis of dyslexia or any other neurological, developmental, or medical condition. For formal diagnostic assessment, consult a qualified speech-language pathologist, educational psychologist, or medical specialist.
          </p>
        </section>

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">1. Identity of Data Fiduciary & Grievance Redressal Officer</h2>
          <p className="font-body text-sm sm:text-base leading-relaxed text-on-surface-variant student-text">
            Under the Digital Personal Data Protection Act, 2023 ("DPDP Act"), Decodex acts as the <strong>Data Fiduciary</strong> responsible for determining the purpose and means of processing personal data.
          </p>
          <div className="stat-card stat-card-hover p-4 rounded-2xl border border-surface-container-high text-xs sm:text-sm space-y-1 font-body" style={{ background: 'var(--color-muted)', borderLeftColor: 'var(--color-secondary)' }}>
            <p><strong>Attn:</strong> Data Protection & Grievance Redressal Officer</p>
            <p><strong>Division:</strong> Decodex Legal & Privacy Division</p>
            <p><strong>Email:</strong> <a href="mailto:privacy@decodex.com" className="text-primary font-bold hover:underline">privacy@decodex.com</a> / <a href="mailto:grievance@decodex.com" className="text-primary font-bold hover:underline">grievance@decodex.com</a></p>
            <p><strong>Response SLA:</strong> Acknowledgement within 24 hours; resolution within 7 business days.</p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">2. Special Provisions for Children's Data (DPDP Act §9 Compliance)</h2>
          <p className="font-body text-sm sm:text-base leading-relaxed text-on-surface-variant student-text">
            In compliance with Section 2(f) of the DPDP Act, 2023, any individual who has not completed 18 years of age is defined as a child. Decodex is designed for primary and middle school students (ages 6–14):
          </p>
          <ul className="list-disc pl-5 font-body text-xs sm:text-sm text-on-surface-variant space-y-2 leading-relaxed student-text">
            <li><strong>Verifiable Parental Consent (VPC):</strong> We do not collect, process, or record personal data or voice audio from any child without prior, verifiable consent from a parent or lawful guardian.</li>
            <li><strong>Prohibition of Behavioral Tracking & Ads:</strong> In strict compliance with Section 9(2) of the DPDP Act, Decodex does <em>not</em> conduct behavioral tracking, serve targeted ads to children, or sell student data.</li>
            <li><strong>No Detrimental Processing:</strong> We do not process children's data in any manner likely to cause detrimental effects on a child's well-being.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">3. Personal Data We Collect</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-body text-xs sm:text-sm">
            <div className="stat-card stat-card-hover p-4 rounded-2xl border border-surface-container-high space-y-2" style={{ borderLeftColor: 'var(--color-primary)' }}>
              <h3 className="font-display text-sm font-bold text-on-surface">Account & Relationship Data</h3>
              <p className="text-on-surface-variant leading-relaxed student-text">Display name, email address, password hash (bcrypt cost 12), grade level, preferred language, date of birth (verification), invite codes, and parent-student linkage records.</p>
            </div>
            <div className="stat-card stat-card-hover p-4 rounded-2xl border border-surface-container-high space-y-2" style={{ borderLeftColor: 'var(--color-secondary)' }}>
              <h3 className="font-display text-sm font-bold text-on-surface">Voice Audio & Transcripts</h3>
              <p className="text-on-surface-variant leading-relaxed student-text">Raw audio recordings stored in a private object storage bucket (local disk or Supabase Storage) for playback, and verbatim speech-to-text transcripts generated via Whisper/Groq.</p>
            </div>
            <div className="stat-card stat-card-hover p-4 rounded-2xl border border-surface-container-high space-y-2" style={{ borderLeftColor: 'var(--risk-excellent-border)' }}>
              <h3 className="font-display text-sm font-bold text-on-surface">Error Profiles & Health Scores</h3>
              <p className="text-on-surface-variant leading-relaxed student-text">Needleman-Wunsch word alignment diffs, Orton-Gillingham error classifications (REV, SUB, OMI, INS, BLD, PAC, UNC), WPM metrics, and 0–100 reading health scores.</p>
            </div>
            <div className="stat-card stat-card-hover p-4 rounded-2xl border border-surface-container-high space-y-2" style={{ borderLeftColor: 'var(--color-accent)' }}>
              <h3 className="font-display text-sm font-bold text-on-surface">Special Education & IEP Records</h3>
              <p className="text-on-surface-variant leading-relaxed student-text">Individualized Education Program (IEP) strategies, Copilot intervention histories, teacher notes, decodable stories, and gamification XP/streaks.</p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">4. Audio Recording Storage & Retention Policy</h2>
          <p className="font-body text-sm sm:text-base leading-relaxed text-on-surface-variant student-text">
            As of V5, Decodex stores student voice recordings in a <strong>private object storage bucket</strong> rather than as base64 blobs in PostgreSQL. The storage backend is configurable: local disk (default for development) or Supabase Storage (production). Audio is referenced in the database by a canonical storage key (<code className="text-xs bg-surface-container px-1.5 py-0.5 rounded student-text">reading_sessions.audio_storage_key</code>), MIME type, size in bytes, and provider. Legacy <code className="text-xs bg-surface-container px-1.5 py-0.5 rounded student-text">audio_base64</code> and <code className="text-xs bg-surface-container px-1.5 py-0.5 rounded student-text">audio_file_path</code> columns have been removed from the database entirely — all session audio, including pre-migration recordings, now lives exclusively in object storage.
          </p>
          <p className="font-body text-xs sm:text-sm leading-relaxed text-on-surface-variant student-text">
            Parents have the absolute right to: (1) listen to all recorded audio sessions through the Parent Portal, (2) request immediate erasure of recorded audio sessions, and (3) withdraw consent, which immediately disables voice recording and triggers account-wide data purging.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">5. Subprocessors & Cross-Border Data Transfers</h2>
          <p className="font-body text-sm sm:text-base leading-relaxed text-on-surface-variant student-text">
            Decodex relies on trusted infrastructure sub-processors. In compliance with Section 16 of the DPDP Act, cross-border data transfer outside India is permitted subject to technical safeguards and parental notice:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-surface-container-highest text-on-surface">
                  <th className="py-2 pr-4 font-display font-bold">Subprocessor</th>
                  <th className="py-2 pr-4 font-display font-bold">Purpose</th>
                  <th className="py-2 font-display font-bold">Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high text-on-surface-variant">
                <tr><td className="py-2 pr-4 font-bold text-on-surface">Render Services Inc.</td><td className="py-2 pr-4">Backend API hosting</td><td className="py-2">Oregon, USA</td></tr>
                <tr><td className="py-2 pr-4 font-bold text-on-surface">Supabase Inc. / AWS</td><td className="py-2 pr-4">PostgreSQL database hosting</td><td className="py-2">Virginia / Oregon, USA</td></tr>
                <tr><td className="py-2 pr-4 font-bold text-on-surface">OpenAI LLC</td><td className="py-2 pr-4">Whisper STT & GPT-4o-mini classification (No student PII in prompts)</td><td className="py-2">California, USA</td></tr>
                <tr><td className="py-2 pr-4 font-bold text-on-surface">Groq Inc.</td><td className="py-2 pr-4">Whisper Large v3 STT fallback</td><td className="py-2">California, USA</td></tr>
                <tr><td className="py-2 pr-4 font-bold text-on-surface">Google LLC (Gmail)</td><td className="py-2 pr-4">Consent verification & notification emails</td><td className="py-2">Global / USA</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">6. Data Principal Rights & Contact</h2>
          <p className="font-body text-sm sm:text-base leading-relaxed text-on-surface-variant student-text">
            Parents (on behalf of child Data Principals) and adult account holders possess the rights to access, correction, erasure, consent withdrawal, and grievance redressal under Sections 11–14 of the DPDP Act.
          </p>
          <p className="font-body text-xs sm:text-sm text-on-surface-variant student-text">
            To exercise any data rights, please contact our Grievance Officer at <a href="mailto:privacy@decodex.com" className="text-primary font-bold hover:underline">privacy@decodex.com</a>.
          </p>
        </section>
      </article>
    </main>
  );
}