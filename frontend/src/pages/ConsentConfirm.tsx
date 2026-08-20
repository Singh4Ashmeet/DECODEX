import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { type ApiError, apiFetch } from '../lib/api';
import DexAvatar from '../components/DexAvatar';

interface ConsentTokenData {
  student: { display_name: string; grade_level: number | null };
  attempts_remaining: number;
}

export default function ConsentConfirm() {
  const { token } = useParams();
  const [tokenData, setTokenData] = useState<ConsentTokenData | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This consent link is invalid or has expired.');
      setLoading(false);
      return;
    }

    let active = true;
    apiFetch<ConsentTokenData>(`/consent/${token}`)
      .then((data) => {
        if (!active) return;
        setTokenData(data);
        setAttemptsRemaining(data.attempts_remaining);
      })
      .catch(() => {
        if (active) setError('This consent link is invalid, expired, or has already been used.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  const submitConsent = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setError('');
    setSubmitting(true);
    try {
      await apiFetch(`/consent/${token}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ date_of_birth: dateOfBirth, agree: agreed }),
      });
      setConfirmed(true);
    } catch (requestError) {
      const apiError = requestError as ApiError;
      if (apiError.code === 'KBV_FAILED') {
        const remaining = apiError.details?.attempts_remaining;
        if (typeof remaining === 'number') setAttemptsRemaining(remaining);
        setError(`${apiError.message}. ${typeof remaining === 'number' ? `${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Please try again carefully.'}`);
      } else if (apiError.code === 'KBV_ATTEMPTS_EXCEEDED') {
        setAttemptsRemaining(0);
        setError('Too many verification attempts. Ask the parent account holder to request a new consent email.');
      } else {
        setError(apiError.message || 'We could not confirm consent. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ConsentShell><div className="stat-card p-8 text-center"><DexAvatar state="thinking" size="md" showCaptionBubble={true} caption="Checking your consent link…" /><p className="mt-4 font-body text-on-surface-variant student-text">Checking your consent link…</p></div></ConsentShell>;
  if (error && !tokenData) return <ConsentShell><ErrorState message={error} /></ConsentShell>;
  if (!tokenData) return null;
  if (confirmed) return <ConsentShell><div className="stat-card p-7 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center"><DexAvatar state="celebrating" size="lg" showCaptionBubble={true} caption="Consent confirmed! Recording is now enabled." /><h1 className="mt-3 font-display text-3xl font-bold">Consent confirmed</h1><p className="mt-2 font-body text-lg student-text">{tokenData.student.display_name} can now use Decodex recording features. You may close this page.</p></div></ConsentShell>;

  return (
    <ConsentShell>
      <div className="flex items-center gap-3 mb-6">
        <DexAvatar state="idle" size="md" showCaptionBubble={false} />
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-[0.12em] text-secondary">Parent consent</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-primary">Confirm consent for {tokenData.student.display_name}</h1>
        </div>
      </div>
      <p className="mb-6 font-body text-lg text-on-surface-variant student-text">{tokenData.student.grade_level ? `Grade ${tokenData.student.grade_level}` : 'Student account'}</p>

      <form onSubmit={submitConsent} className="space-y-6">
        <section className="stat-card stat-card-hover p-6 rounded-2xl border border-white/80" aria-labelledby="disclosure-heading" style={{ borderLeftColor: 'var(--color-primary)' }}>
          <h2 id="disclosure-heading" className="font-display text-xl font-bold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">info</span>
            Before you confirm
          </h2>
          <dl className="grid gap-4 font-body text-on-surface-variant student-text">
            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high"><dt className="font-display font-bold text-on-surface mb-1">What data is collected</dt><dd className="mt-1">Voice audio (stored securely) and text transcript.</dd></div>
            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high"><dt className="font-display font-bold text-on-surface mb-1">How it is used</dt><dd className="mt-1">Error analysis and drill generation.</dd></div>
            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high"><dt className="font-display font-bold text-on-surface mb-1">Retention & Subprocessors</dt><dd className="mt-1">The <Link to="/privacy" target="_blank" className="text-primary font-bold hover:underline">Privacy Policy</Link> explains data retention, base64 audio storage, and named subprocessors (OpenAI, Groq, Gmail, Render, Supabase).</dd></div>
            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high"><dt className="font-display font-bold text-on-surface mb-1">Who can access it</dt><dd className="mt-1">Assigned teacher, parent, and student.</dd></div>
            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high"><dt className="font-display font-bold text-on-surface mb-1">Your choices</dt><dd className="mt-1">You can withdraw consent or delete data at any time via the Parent Portal.</dd></div>
          </dl>
        </section>

        <div className="flex flex-col gap-2">
          <label htmlFor="child-dob" className="font-display text-sm font-bold uppercase tracking-[0.08em] text-on-surface-variant">Child's date of birth</label>
          <input id="child-dob" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="h-14 rounded-xl glass-input px-4 font-body text-lg text-on-surface outline-none student-text" required />
          {attemptsRemaining !== null ? <p className="font-body text-sm text-on-surface-variant student-text">{attemptsRemaining} verification attempt{attemptsRemaining === 1 ? '' : 's'} remaining.</p> : null}
        </div>

        <label className="flex cursor-pointer gap-3 rounded-xl stat-card stat-card-hover p-4 font-body text-on-surface" style={{ borderLeftColor: 'var(--color-secondary)' }}>
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1 h-5 w-5 accent-primary shrink-0" required />
          <span className="text-xs sm:text-sm leading-relaxed student-text">
            I am the parent or legal guardian of {tokenData.student.display_name}. I have read and agree to the{' '}
            <Link to="/privacy" target="_blank" className="text-primary font-bold hover:underline">Privacy Policy</Link>{' '}
            and{' '}
            <Link to="/terms" target="_blank" className="text-primary font-bold hover:underline">Terms of Service</Link>,
            and confirm verifiable parental consent for voice recording and reading analysis for educational screening.
          </span>
        </label>
        {error ? <div role="alert" className="stat-card p-4 rounded-xl border-l-4 border-red-500 font-body text-on-error-container student-text" style={{ borderLeftColor: 'var(--risk-high-border)' }}>{error}</div> : null}
        <button disabled={submitting || attemptsRemaining === 0} className="mt-4 h-14 w-full rounded-xl bg-primary font-body text-lg font-bold text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container disabled:cursor-not-allowed disabled:opacity-60 btn-clay">{submitting ? 'Confirming…' : 'Confirm consent'}</button>
      </form>
      <DexAvatar state="idle" size="md" showCaptionBubble={true} caption="Thanks for helping keep reading safe! 🛡️" className="mt-8 mx-auto" />
    </ConsentShell>
  );
}

function ConsentShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-background px-container-padding py-12 text-on-surface"><div className="mx-auto w-full max-w-[680px] rounded-2xl stat-card p-7 shadow-[0_16px_32px_rgba(45,41,38,0.05)] sm:p-10">{children}</div></main>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="stat-card p-7 rounded-2xl border-l-4 border-red-500 text-red-800" style={{ borderLeftColor: 'var(--risk-high-border)' }}><DexAvatar state="concerned" size="lg" showCaptionBubble={true} caption="Something went wrong. Let's try again." /><h1 className="mt-3 font-display text-2xl font-bold">Consent link unavailable</h1><p className="mt-2 font-body student-text">{message}</p></div>;
}