import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { Skeleton } from '../components/Skeleton';
import { HealthScoreGauge } from '../components/HealthScoreGauge';

interface LinkedChild {
  id: string;
  display_name: string;
  grade_level: number | null;
  consent_granted: boolean;
  consent_date: string | null;
  withdrawn_at: string | null;
  hard_delete_at: string | null;
  session_count?: number;
  health_score?: number | null;
  latest_wpm?: number | null;
}

interface RiskScreening {
  risk: 'low' | 'medium' | 'high';
  confidence: number;
  indicators: string[];
  evidence: Array<{ indicator: string; category: string; frequency: number; severity: string; details: string }>;
  sessionsAnalyzed: number;
  disclaimer: string;
}

interface ChildProgress {
  student: { id: string; display_name: string; grade_level: number | null };
  healthScore: { score: number; riskLevel: string; fluency: number; accuracy: number; wpmNormalized: number } | null;
  recentSessions: any[];
  strengthAreas: string[];
  recommendations: string[];
}

const riskBadgeMap: Record<string, string> = {
  low: 'risk-good',
  medium: 'risk-medium',
  high: 'risk-high',
};

export default function ParentHome() {
  const [children, setChildren] = useState<LinkedChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [childProgress, setChildProgress] = useState<ChildProgress | null>(null);
  const [screening, setScreening] = useState<RiskScreening | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<LinkedChild | null>(null);
  const [notice, setNotice] = useState<{ studentId: string; message: string } | null>(null);
  const [error, setError] = useState('');

  const loadChildren = useCallback(async () => {
    try {
      const response = await apiFetch<{ children: LinkedChild[] }>('/parent/children');
      setChildren(response.children);
      setError('');
      if (response.children.length > 0 && !selectedChildId) {
        setSelectedChildId(response.children[0].id);
      }
    } catch {
      try {
        const response = await apiFetch<{ children: LinkedChild[] }>('/consent/children');
        setChildren(response.children);
        setError('');
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load linked children.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    if (selectedChildId) {
      apiFetch<ChildProgress>(`/parent/children/${selectedChildId}/progress`)
        .then(setChildProgress)
        .catch(() => setChildProgress(null));

      apiFetch<{ screening: RiskScreening }>(`/risk-screening/${selectedChildId}`)
        .then(res => setScreening(res.screening))
        .catch(() => setScreening(null));
    }
  }, [selectedChildId]);

  const requestConsentEmail = async (studentId: string, studentName: string) => {
    setError('');
    setResendingId(studentId);
    try {
      const result = await apiFetch<{ consent_email_requested: boolean; consent_email_sent?: boolean }>('/consent/request', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId }),
      });
      if (result.consent_email_sent === false) {
        setNotice({ studentId, message: `Consent request recorded for ${studentName}, but the email could not be delivered right now. You can try again — the consent link is still valid.` });
      } else {
        setNotice({ studentId, message: `A consent verification email was sent to you for ${studentName}. Please check your inbox and complete the date-of-birth step.` });
      }
      await loadChildren();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send consent email.');
    } finally {
      setResendingId(null);
    }
  };

  const linkChild = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice(null);
    setLinking(true);
    try {
      const response = await apiFetch<{ student: any }>('/consent/link', {
        method: 'POST',
        body: JSON.stringify({ invite_code: inviteCode.trim() }),
      });
      setInviteCode('');
      setNotice({ studentId: response.student.id, message: `Account linked for ${response.student.display_name}!` });
      await loadChildren();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to link this child.');
    } finally {
      setLinking(false);
    }
  };

  const withdrawConsent = async () => {
    if (!pendingWithdrawal) return;
    setWithdrawing(true);
    setError('');
    try {
      await apiFetch('/consent/withdraw', {
        method: 'POST',
        body: JSON.stringify({ student_id: pendingWithdrawal.id }),
      });
      setNotice({ studentId: pendingWithdrawal.id, message: `Consent was withdrawn for ${pendingWithdrawal.display_name}.` });
      setPendingWithdrawal(null);
      await loadChildren();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to withdraw consent.');
    } finally {
      setWithdrawing(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[960px] px-container-padding py-8 sm:py-12">
        <Skeleton className="h-48 w-full mb-8" />
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <Skeleton className="h-48 w-full mb-8" />
      </main>
    );
  }

  return (
    <motion.main 
      initial="hidden" 
      animate="show" 
      variants={containerVariants}
      className="mx-auto w-full max-w-[960px] px-container-padding py-8 sm:py-12 text-on-surface"
    >
      {/* Header */}
      <motion.section variants={itemVariants} className="mb-8 stat-card stat-card-hover rounded-3xl p-7 sm:p-9 shadow-sm relative overflow-hidden" style={{ borderLeftColor: 'var(--color-secondary)' }}>
        <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-secondary">Parent Portal</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-primary">Child Reading & Screening Dashboard</h1>
        <p className="mt-2 max-w-2xl font-body text-base text-on-surface-variant leading-relaxed student-text">
          Monitor your child's reading health score, preliminary dyslexia risk screening, practice sessions, and manage recording consent.
        </p>
      </motion.section>

      {/* Child Selection Tabs */}
      {children.length > 1 && (
        <motion.div variants={itemVariants} className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`px-5 py-2.5 rounded-2xl font-display text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                selectedChildId === child.id 
                  ? 'bg-primary text-on-primary shadow-sm' 
                  : 'bg-surface-container-low text-on-surface-variant hover:border-primary/30 hover:bg-white/80 border border-transparent'
              }`}
            >
              {child.consent_granted ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Consent granted" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500" title="Consent pending" />
              )}
              {child.display_name}
            </button>
          ))}
        </motion.div>
      )}

      {/* Preliminary Dyslexia Risk Screening Report */}
      {screening && (
        <motion.section variants={itemVariants} className="mb-8 stat-card stat-card-hover rounded-3xl p-6 sm:p-8 shadow-md" style={{ borderLeftColor: screening.risk === 'low' ? 'var(--risk-good-border)' : screening.risk === 'medium' ? 'var(--risk-medium-border)' : 'var(--risk-high-border)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-surface-container-highest">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-secondary-container/20 flex items-center justify-center text-secondary shadow-inner">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-on-surface">Preliminary Dyslexia Risk Screening Report</h2>
                <p className="font-body text-xs text-on-surface-variant student-text">Based on {screening.sessionsAnalyzed} reading sessions</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-display text-xs font-bold uppercase tracking-wider border badge-risk ${riskBadgeMap[screening.risk] || ''}`}>
              <span className={`w-2 h-2 rounded-full ${screening.risk === 'low' ? 'bg-emerald-500' : screening.risk === 'medium' ? 'bg-amber-500' : 'bg-red-500'}`} />
              {screening.risk.toUpperCase()} RISK INDICATOR ({screening.confidence}% Confidence)
            </span>
          </div>

          {/* Indicators & Evidence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Identified Speech & Error Patterns</h3>
              <ul className="space-y-2">
                {screening.indicators.map((ind, i) => (
                  <li key={i} className="font-body text-xs text-on-surface flex items-start gap-2 p-2.5 rounded-xl bg-white/40 border border-surface-container-highest student-text">
                    <span className="material-symbols-outlined text-amber-600 text-sm mt-0.5 shrink-0">warning</span>
                    {ind}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Required Parent Actions</h3>
              <ul className="space-y-2">
                {childProgress?.recommendations.map((rec, i) => (
                  <li key={i} className="font-body text-xs text-on-surface flex items-start gap-2 p-2.5 rounded-xl bg-primary-container/10 border border-primary-container/20 student-text">
                    <span className="material-symbols-outlined text-primary text-sm mt-0.5 shrink-0">check_circle</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="font-body text-[11px] text-on-surface-variant/80 bg-surface-container-low p-3 rounded-xl border border-surface-container-high leading-relaxed student-text">
            <strong className="font-semibold text-on-surface">Educational Disclaimer:</strong> {screening.disclaimer}
          </p>
        </motion.section>
      )}

      {/* Child Progress Card */}
      {childProgress && (
        <motion.div variants={itemVariants} className="space-y-6 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Health Score Box — with gauge */}
            <div className="stat-card stat-card-hover p-6 border border-white/80 flex flex-col items-center text-center shadow-sm relative overflow-hidden" style={{ borderLeftColor: 'var(--color-primary)' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 relative z-10">Reading Health Score</p>
              {childProgress.healthScore ? (
                <div className="relative z-10">
                  <HealthScoreGauge score={childProgress.healthScore.score} riskLevel={childProgress.healthScore.riskLevel} />
                  <span className="inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider badge-risk risk-good mt-3">
                    {childProgress.healthScore.riskLevel}
                  </span>
                </div>
              ) : (
                <p className="font-body text-sm text-on-surface-variant py-4 relative z-10 student-text">No health score computed yet</p>
              )}
            </div>

            {/* Strengths */}
            <div className="stat-card stat-card-hover p-6 border border-white/80 shadow-sm flex flex-col justify-between" style={{ borderLeftColor: 'var(--risk-excellent-border)' }}>
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2">Strength Areas</p>
              <ul className="space-y-1.5 flex-grow">
                {childProgress.strengthAreas.map((area, i) => (
                  <li key={i} className="font-body text-xs text-on-surface flex items-center gap-2 student-text">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                    {area}
                  </li>
                ))}
              </ul>
            </div>

            {/* Parent Action Steps */}
            <div className="stat-card stat-card-hover p-6 border border-white/80 shadow-sm flex flex-col justify-between" style={{ borderLeftColor: 'var(--color-secondary)' }}>
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">Recommended Parent Actions</p>
              <ul className="space-y-1.5 flex-grow">
                {childProgress.recommendations.map((rec, i) => (
                  <li key={i} className="font-body text-xs text-on-surface flex items-center gap-2 student-text">
                    <span className="material-symbols-outlined text-secondary text-sm">lightbulb</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recent Sessions */}
          {childProgress.recentSessions?.length > 0 && (
            <div className="stat-card stat-card-hover p-6 border border-white/80 shadow-sm">
              <h3 className="font-display text-lg font-bold text-on-surface mb-3">Recent Reading Sessions</h3>
              <div className="space-y-2">
                {childProgress.recentSessions.slice(0, 5).map((s: any) => (
                  <Link
                    key={s.id}
                    to={`/parent/children/${selectedChildId}/sessions/${s.id}`}
                    className="stat-card-hover p-3 rounded-2xl bg-white/40 border border-surface-container-highest flex items-center justify-between transition-all group"
                  >
                    <div>
                      <p className="font-display text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{s.passage_title || 'Reading Session'}</p>
                      <p className="font-body text-xs text-on-surface-variant student-text">{new Date(s.started_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-display text-sm font-bold text-primary teacher-mono">{s.words_per_minute != null ? Math.round(s.words_per_minute) : '—'} WPM</p>
                        <p className="font-body text-xs text-on-surface-variant student-text">
                          {s.error_rate != null ? `${100 - Math.round(s.error_rate * 100)}% accuracy` : ''}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant text-sm group-hover:text-primary group-hover:translate-x-0.5 transition-all">chevron_right</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Link Child Form */}
      <motion.section variants={itemVariants} className="stat-card stat-card-hover rounded-3xl p-6 sm:p-8 shadow-sm mb-8" style={{ borderLeftColor: 'var(--color-primary)' }}>
        <h2 className="font-display text-2xl font-bold text-on-surface">Link a Child Account</h2>
        <p className="mt-1 font-body text-on-surface-variant text-sm student-text">Enter the invite code shown in your child's Decodex dashboard.</p>
        <form onSubmit={linkChild} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            placeholder="INVITE CODE (e.g. DEMO01)"
            className="h-12 flex-1 rounded-2xl glass-input px-4 font-display text-base font-bold tracking-[0.12em] text-on-surface placeholder:text-outline/65 outline-none"
            required
          />
          <button
            disabled={linking}
            className="h-12 rounded-2xl bg-primary px-6 font-display text-xs font-bold uppercase tracking-[0.08em] text-on-primary transition-all shadow-md hover:bg-primary-container hover:text-on-primary-container cursor-pointer"
          >
            {linking ? 'Linking…' : 'Link Child'}
          </button>
        </form>
      </motion.section>

      {error ? (
        <div role="alert" className="mb-6 rounded-2xl bg-red-50 p-4 font-body text-sm text-red-800 border border-red-200 student-text">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-6 p-4 rounded-2xl bg-primary-container/20 text-primary font-body text-sm flex items-center justify-between student-text">
          <span>{notice.message}</span>
        </div>
      ) : null}

      {/* Linked Children Consent Management */}
      <motion.section variants={itemVariants}>
        <h2 className="font-display text-2xl font-bold text-on-surface mb-4">Consent & Accounts</h2>
        <div className="grid gap-3">
          {children.map((child) => {
            const isGranted = child.consent_granted;
            return (
              <article key={child.id} className="stat-card stat-card-hover p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-shadow">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${isGranted ? 'bg-emerald-500' : 'bg-amber-500'}`} title={isGranted ? 'Consent confirmed' : 'Consent pending'} />
                  <div>
                    <h3 className="font-display text-lg font-bold text-on-surface">{child.display_name}</h3>
                    <p className="font-body text-xs text-on-surface-variant student-text">
                      {child.grade_level ? `Grade ${child.grade_level}` : 'Grade not set'} • {isGranted ? 'Consent confirmed' : 'Consent pending'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isGranted && (
                    <button
                      onClick={() => void requestConsentEmail(child.id, child.display_name)}
                      disabled={resendingId === child.id}
                      className="rounded-xl bg-primary px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-on-primary cursor-pointer hover:bg-primary-container hover:text-on-primary-container transition-colors"
                    >
                      {resendingId === child.id ? 'Sending…' : 'Send Consent Email'}
                    </button>
                  )}
                  {isGranted && (
                    <button
                      onClick={() => setPendingWithdrawal(child)}
                      className="rounded-xl border border-red-400 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Withdraw Consent
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </motion.section>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {pendingWithdrawal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="w-full max-w-lg rounded-3xl stat-card p-7 shadow-2xl bg-white/95"
            >
            <h2 className="font-display text-2xl font-bold text-on-surface">Withdraw consent?</h2>
            <p className="mt-3 font-body text-sm text-on-surface-variant leading-relaxed student-text">
              This disables recording for <strong className="text-on-surface font-semibold">{pendingWithdrawal.display_name}</strong> immediately.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setPendingWithdrawal(null)} className="px-4 py-2 font-display font-bold text-primary text-sm">Cancel</button>
              <button onClick={() => void withdrawConsent()} disabled={withdrawing} className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-display text-xs font-bold uppercase tracking-wider">
                {withdrawing ? 'Withdrawing…' : 'Confirm Withdraw'}
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}