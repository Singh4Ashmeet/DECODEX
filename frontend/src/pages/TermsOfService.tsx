import React from 'react';
import { Link } from 'react-router-dom';
import DexAvatar from '../components/DexAvatar';
import EducationalDisclaimer from '../components/EducationalDisclaimer';

export default function TermsOfService() {
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
                <span className="material-symbols-outlined text-sm">gavel</span>
                Terms & Conditions
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-primary">Decodex Terms of Service</h1>
              <p className="font-body text-sm text-on-surface-variant mt-2 student-text">
                <strong>Effective Date:</strong> August 8, 2026 | <strong>Governing Law:</strong> Laws of the Republic of India
              </p>
            </div>
          </div>
        </header>

        {/* Mandatory Legal Disclaimer Banner */}
        <EducationalDisclaimer variant="card" className="mt-0" />

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">1. Acceptance of Terms & Eligibility</h2>
          <p className="font-body text-sm sm:text-base leading-relaxed text-on-surface-variant student-text">
            By creating an account, accessing, or using Decodex, you agree to be bound by these Terms of Service and our Privacy Policy.
          </p>
          <ul className="list-disc pl-5 font-body text-xs sm:text-sm text-on-surface-variant space-y-2 leading-relaxed student-text">
            <li><strong>Minors (Students under 18):</strong> Students under 18 years of age cannot create accounts independently. Student accounts must be created by a parent, guardian, or authorized teacher.</li>
            <li><strong>Adult Account Holders:</strong> Parent and Teacher account holders must be at least 18 years of age and legally competent to enter into contracts under the Indian Contract Act, 1872.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">2. Verifiable Parental Consent & Child Usage</h2>
          <p className="font-body text-sm sm:text-base leading-relaxed text-on-surface-variant student-text">
            Microphone recording and speech processing features are strictly disabled until a parent or guardian completes consent verification. Parental consent remains valid for <strong>365 days</strong> and requires annual re-consent. Parents may withdraw consent at any time, initiating a 30-day grace period followed by hard data deletion.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">3. Account Roles & Scope of Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-body text-xs sm:text-sm">
            <div className="stat-card stat-card-hover p-4 rounded-2xl border border-surface-container-high space-y-1" style={{ borderLeftColor: 'var(--color-primary)' }}>
              <h3 className="font-display font-bold text-on-surface">Student Accounts</h3>
              <p className="text-on-surface-variant student-text">Read passages, record sessions, complete drills, view personal XP/streaks. Access isolated strictly to own sessions.</p>
            </div>
            <div className="stat-card stat-card-hover p-4 rounded-2xl border border-surface-container-high space-y-1" style={{ borderLeftColor: 'var(--color-secondary)' }}>
              <h3 className="font-display font-bold text-on-surface">Parent Accounts</h3>
              <p className="text-on-surface-variant student-text">Link child via Invite Code, grant/withdraw consent, review child WPM, error profiles, and listen to recorded audio.</p>
            </div>
            <div className="stat-card stat-card-hover p-4 rounded-2xl border border-surface-container-high space-y-1" style={{ borderLeftColor: 'var(--color-accent)' }}>
              <h3 className="font-display font-bold text-on-surface">Teacher Accounts</h3>
              <p className="text-on-surface-variant student-text">Review classroom trends, override AI classifications, generate Copilot strategies for assigned school students.</p>
            </div>
            <div className="stat-card stat-card-hover p-4 rounded-2xl border border-surface-container-high space-y-1" style={{ borderLeftColor: 'var(--risk-excellent-border)' }}>
              <h3 className="font-display font-bold text-on-surface">School Admins</h3>
              <p className="text-on-surface-variant student-text">Manage institutional roster and grade-level aggregated analytics under subscription domain.</p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">4. Subscriptions, Payments & Intellectual Property</h2>
          <p className="font-body text-sm sm:text-base leading-relaxed text-on-surface-variant student-text">
            Decodex is a paid software-as-a-service (SaaS) subscription platform. Fees are quoted in Indian Rupees (INR ₹) inclusive of applicable taxes. Decodex retains exclusive ownership of the platform, codebase, design system, and alignment algorithms. Users retain ownership of raw voice recordings and are granted a non-exclusive license to AI-generated practice drills and decodable stories.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-primary">5. Governing Law & Dispute Resolution</h2>
          <p className="font-body text-sm sm:text-base leading-relaxed text-on-surface-variant student-text">
            These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any disputes arising out of these Terms shall be resolved through binding arbitration under the Arbitration and Conciliation Act, 1996, in New Delhi, India. Subject to arbitration, the courts of New Delhi, India possess exclusive jurisdiction.
          </p>
        </section>
      </article>
    </main>
  );
}