import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch, useApiQuery } from '../lib/api';
import DexAvatar from '../components/DexAvatar';

export default function CopilotPanel() {
  const { studentId } = useParams();
  const [strategy, setStrategy] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: healthData } = useApiQuery<any>(`/health-score/${studentId}`);
  const { data: screeningData } = useApiQuery<any>(`/risk-screening/${studentId}`);
  const { data: historyData } = useApiQuery<any>(`/copilot/${studentId}/history`);

  const healthScore = healthData?.healthScore;
  const screening = screeningData?.screening;
  const history = historyData?.history || [];

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await apiFetch<any>(`/copilot/${studentId}/strategy`, { method: 'POST' });
      setStrategy(res.strategy);
    } catch (err: any) {
      setError(err.message || 'Failed to generate strategy');
    } finally {
      setGenerating(false);
    }
  };

  type RiskLevel = 'low' | 'medium' | 'high';
type HealthRiskLevel = 'excellent' | 'good' | 'medium' | 'high' | 'critical';

const riskConfig = {
    low: { badge: 'risk-good', icon: 'sentiment_very_satisfied' },
    medium: { badge: 'risk-medium', icon: 'sentiment_neutral' },
    high: { badge: 'risk-high', icon: 'sentiment_dissatisfied' },
  }[(screening?.risk as RiskLevel) || 'low'] || { badge: 'risk-good', icon: 'sentiment_very_satisfied' };

  const healthRiskConfig = {
    excellent: { color: 'var(--risk-excellent-border)', icon: 'sentiment_very_satisfied' },
    good: { color: 'var(--risk-good-border)', icon: 'sentiment_satisfied' },
    medium: { color: 'var(--risk-medium-border)', icon: 'sentiment_neutral' },
    high: { color: 'var(--risk-high-border)', icon: 'sentiment_dissatisfied' },
    critical: { color: 'var(--risk-critical-border)', icon: 'sentiment_very_dissatisfied' },
  }[(healthScore?.riskLevel as HealthRiskLevel) || 'medium'] || { color: 'var(--color-primary)', icon: 'help' };

  return (
    <main className="flex-grow w-full max-w-max-content-width mx-auto px-container-padding py-8 sm:py-12 text-on-surface">
      <Link to="/teacher/dashboard" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary font-display text-sm font-bold tracking-[0.08em] uppercase transition-all group mb-6">
        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
        Back to Classroom
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/20 text-primary font-display text-[10px] font-bold uppercase tracking-widest mb-2">
            <span className="material-symbols-outlined text-sm">smart_toy</span>
            Decodex Copilot
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-primary">AI Intervention Copilot</h1>
          <p className="font-body text-base text-on-surface-variant mt-1">Generate a comprehensive intervention strategy</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="h-14 px-8 rounded-xl bg-primary text-on-primary font-display text-base font-bold uppercase tracking-[0.06em] transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-60 flex items-center gap-3 cursor-pointer whitespace-nowrap"
        >
          <span className="material-symbols-outlined">{generating ? 'hourglass_top' : 'neurology'}</span>
          {generating ? 'Generating Strategy…' : 'Generate Strategy'}
        </button>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="stat-card stat-card-hover p-4 border border-white/80 flex items-center gap-3" style={{ borderLeftColor: 'var(--color-primary)' }}>
          <div className="stat-icon bg-primary/10 text-primary">
            <span className="material-symbols-outlined">favorite</span>
          </div>
          <div>
            <p className="stat-label" style={{ color: 'var(--color-primary)' }}>Health Score</p>
            {healthScore ? (
              <p className="stat-value teacher-mono" style={{ color: healthRiskConfig.color }}>
                {healthScore.score}/100
              </p>
            ) : (
              <p className="font-body text-sm text-on-surface-variant">Not computed</p>
            )}
          </div>
        </div>

        <div className="stat-card stat-card-hover p-4 border border-white/80 flex items-center gap-3" style={{ borderLeftColor: 'var(--color-secondary)' }}>
          <div className="stat-icon bg-secondary/10 text-secondary">
            <span className="material-symbols-outlined">shield</span>
          </div>
          <div>
            <p className="stat-label" style={{ color: 'var(--color-secondary)' }}>Risk Screening</p>
            {screening ? (
              <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold border badge-risk ${riskConfig.badge}`}>
                <span className="material-symbols-outlined text-sm">{riskConfig.icon}</span>
                {screening.risk.toUpperCase()} ({screening.confidence}% conf.)
              </span>
            ) : (
              <p className="font-body text-sm text-on-surface-variant">Not screened</p>
            )}
          </div>
        </div>

        <div className="stat-card stat-card-hover p-4 border border-white/80 flex items-center gap-3" style={{ borderLeftColor: 'var(--color-accent)' }}>
          <div className="stat-icon bg-accent/10 text-accent">
            <span className="material-symbols-outlined">history</span>
          </div>
          <div>
            <p className="stat-label" style={{ color: 'var(--color-accent)' }}>Previous Strategies</p>
            <p className="stat-value text-primary teacher-mono">{history.length}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="stat-card stat-card-hover p-4 rounded-2xl border-l-4 border-red-500 text-red-800 font-body text-sm mb-6" style={{ borderLeftColor: 'var(--risk-high-border)' }}>
          {error}
        </div>
      )}

      {/* Strategy Output */}
      {strategy && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary */}
          <div className="stat-card stat-card-hover p-6 sm:p-8 border border-white/80 shadow-sm" style={{ borderLeftColor: 'var(--color-primary)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="stat-icon bg-primary/10 text-primary">
                <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>summarize</span>
              </div>
              <h2 className="font-display text-xl font-bold text-on-surface">Strategy Summary</h2>
            </div>
            <p className="font-body text-base text-on-surface leading-relaxed student-text">{strategy.summary}</p>
          </div>

          {/* Key Concerns */}
          {strategy.keyConcerns?.length > 0 && (
            <div className="stat-card stat-card-hover p-6 sm:p-8 border border-white/80 shadow-sm" style={{ borderLeftColor: 'var(--risk-medium-border)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="stat-icon bg-amber-100 text-amber-700">
                  <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>warning</span>
                </div>
                <h2 className="font-display text-xl font-bold text-on-surface">Key Concerns</h2>
              </div>
              <ul className="space-y-2">
                {strategy.keyConcerns.map((concern: string, i: number) => (
                  <li key={i} className="stat-card p-3 rounded-xl border border-amber-200/50 flex items-start gap-3" style={{ background: 'var(--risk-medium-bg)', opacity: 0.5 }}>
                    <span className="material-symbols-outlined text-amber-600 mt-0.5 shrink-0 text-sm">priority_high</span>
                    <span className="font-body text-sm text-on-surface student-text">{concern}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weekly Roadmap */}
          {strategy.weeklyRoadmap?.length > 0 && (
            <div className="stat-card stat-card-hover p-6 sm:p-8 border border-white/80 shadow-sm" style={{ borderLeftColor: 'var(--color-primary)' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="stat-icon bg-primary/10 text-primary">
                  <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>calendar_month</span>
                </div>
                <h2 className="font-display text-xl font-bold text-on-surface">4-Week Intervention Roadmap</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {strategy.weeklyRoadmap.map((week: any) => (
                  <div key={week.week} className="stat-card stat-card-hover p-5 rounded-2xl border border-surface-container-high" style={{ background: 'var(--color-muted)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-on-primary font-display text-xs font-bold">{week.week}</span>
                      <h3 className="font-display text-sm font-bold text-on-surface">{week.focus}</h3>
                    </div>
                    <ul className="space-y-1.5 mb-3">
                      {week.objectives?.map((obj: string, i: number) => (
                        <li key={i} className="font-body text-xs text-on-surface-variant flex items-start gap-1.5 student-text">
                          <span className="material-symbols-outlined text-primary text-[12px] mt-0.5 shrink-0">check_circle</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-surface-container-high pt-2">
                      <p className="font-display text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Activities</p>
                      {week.activities?.map((act: string, i: number) => (
                        <span key={i} className="inline-block px-2 py-0.5 rounded-md bg-primary-container/15 text-primary font-body text-[10px] mr-1 mb-1">{act}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Exercises */}
          {strategy.recommendedExercises?.length > 0 && (
            <div className="stat-card stat-card-hover p-6 sm:p-8 border border-white/80 shadow-sm" style={{ borderLeftColor: 'var(--risk-excellent-border)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="stat-icon bg-emerald-100 text-emerald-700">
                  <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>fitness_center</span>
                </div>
                <h2 className="font-display text-xl font-bold text-on-surface">Recommended Exercises</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {strategy.recommendedExercises.map((ex: any, i: number) => (
                  <div key={i} className="stat-card stat-card-hover p-4 rounded-xl border border-surface-container-high flex items-start gap-3" style={{ background: 'var(--color-muted)' }}>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-display text-xs font-bold shrink-0">{ex.category}</span>
                    <div>
                      <p className="font-display text-sm font-bold text-on-surface">{ex.name}</p>
                      <p className="font-body text-xs text-on-surface-variant mt-0.5 student-text">{ex.description}</p>
                      <p className="font-body text-[10px] text-on-surface-variant mt-1 student-text">~{ex.estimatedMinutes} min • {ex.difficulty}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parent Communication Draft */}
          {strategy.parentCommunicationDraft && (
            <div className="stat-card stat-card-hover p-6 sm:p-8 border border-white/80 shadow-sm" style={{ borderLeftColor: 'var(--color-secondary)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="stat-icon bg-blue-100 text-blue-700">
                    <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>mail</span>
                  </div>
                  <h2 className="font-display text-xl font-bold text-on-surface">Parent Communication Draft</h2>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(strategy.parentCommunicationDraft)}
                  className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-display text-xs font-bold uppercase tracking-wider hover:bg-surface-container-highest transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  Copy
                </button>
              </div>
              <pre className="stat-card font-body text-sm text-on-surface whitespace-pre-wrap leading-relaxed rounded-xl p-5 border border-surface-variant" style={{ background: 'var(--color-muted)' }}>{strategy.parentCommunicationDraft}</pre>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!strategy && !generating && (
        <div className="stat-card stat-card-hover p-12 border border-white/80 text-center shadow-sm" style={{ borderLeftColor: 'var(--color-primary)' }}>
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary-container/20 text-primary flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-5xl" style={{fontVariationSettings: "'FILL' 1"}}>neurology</span>
          </div>
          <h3 className="font-display text-2xl font-bold text-on-surface mb-2">Ready to Generate</h3>
          <p className="font-body text-base text-on-surface-variant max-w-md mx-auto student-text">
            Click "Generate Strategy" to create a comprehensive intervention plan including weekly roadmaps, recommended exercises, and a parent communication draft.
          </p>
          <DexAvatar state="idle" size="md" showCaptionBubble={true} caption="I'll help create a personalized plan for this student! 🎯" className="mt-6 mx-auto" />
        </div>
      )}
    </main>
  );
}