import React, { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApiQuery, getApiBaseUrl } from '../lib/api';
import EducationalDisclaimer from '../components/EducationalDisclaimer';

const CATEGORY_STYLES: Record<string, { label: string; style: string }> = {
  REV: { label: 'Reversal (b/d)', style: 'cat-rev' },
  SUB: { label: 'Substitution', style: 'cat-sub' },
  OMI: { label: 'Omission', style: 'cat-omi' },
  INS: { label: 'Insertion', style: 'cat-ins' },
  BLD: { label: 'Blend Breakdown', style: 'cat-bld' },
  PAC: { label: 'Pacing / Self-Correction', style: 'cat-pac' },
  UNC: { label: 'Uncertain', style: 'cat-unc' },
};

function formatTranscript(text: string | null): string {
  if (!text || !text.trim()) return '';
  let cleaned = text.trim();

  const isMostlyCaps = (cleaned.match(/[A-Z]/g) || []).length > (cleaned.match(/[a-z]/g) || []).length;
  if (isMostlyCaps) {
    cleaned = cleaned.toLowerCase();
  }

  return cleaned.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
}

interface WeeklyPlan {
  week: number;
  focus: string;
  objectives: string[];
  activities: string[];
}

interface ImprovementPlan {
  summary: string;
  keyConcerns: string[];
  weeklyRoadmap: WeeklyPlan[];
  parentCommunicationDraft: string;
}

interface AlignmentPair {
  target: string;
  spoken: string;
  status: string;
}

interface Classification {
  word_index: number;
  source_word: string;
  spoken_word: string;
  category: string;
  rationale: string;
}

interface Drill {
  id: string;
  target_category: string;
  drill_type: string;
  content: any;
  completed: boolean;
}

interface ReportData {
  session: {
    id: string;
    started_at: string;
    completed_at: string | null;
    duration_seconds: number | null;
    words_per_minute: number | null;
    transcript: string | null;
  };
  passage: {
    id: string;
    title: string;
    content: string;
    grade_level: number;
    word_count: number;
  };
  errorProfile: {
    rev_count: number;
    sub_count: number;
    omi_count: number;
    ins_count: number;
    bld_count: number;
    pac_count: number;
    uncertain_count?: number;
    total_words_read: number;
    total_errors: number;
    error_rate: number;
  } | null;
  alignment: AlignmentPair[];
  classifications: Classification[];
  drills: Drill[];
  improvementPlan: ImprovementPlan | null;
  hasStudentRecording: boolean;
}

export default function ParentSessionReport() {
  const { studentId, sessionId } = useParams();
  const { data, loading, error } = useApiQuery<ReportData>(
    `/parent/children/${studentId}/sessions/${sessionId}/report`
  );

  const [activeTab, setActiveTab] = useState<'overview' | 'passage' | 'errors' | 'drills' | 'roadmap'>('overview');

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin mb-3">progress_activity</span>
<p className="font-body text-on-surface-variant font-medium">Generating Session Report…</p>
</div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="stat-card stat-card-hover p-6 rounded-2xl border-l-4 border-red-500 text-red-800">
          <h2 className="font-display text-xl font-bold mb-2">Failed to load session report</h2>
          <p className="font-body text-sm mb-4">{error?.message || 'Session not found'}</p>
          <Link to={`/parent/home`} className="px-4 py-2 rounded-xl bg-red-600 text-white font-display text-xs font-bold uppercase tracking-wider">
            Return to Parent Portal
          </Link>
        </div>
      </div>
    );
  }

  const { session, passage, errorProfile, classifications, drills, improvementPlan, hasStudentRecording } = data;

  const totalWords = errorProfile?.total_words_read || passage?.word_count || 0;
  const totalErrors = errorProfile?.total_errors || classifications.length || 0;
  const accuracyPercent = totalWords > 0 ? Math.max(0, Math.round(((totalWords - totalErrors) / totalWords) * 100)) : 100;
  const accuracyRiskTier = accuracyPercent >= 90 ? 'excellent' : accuracyPercent >= 75 ? 'good' : accuracyPercent >= 60 ? 'medium' : accuracyPercent >= 40 ? 'high' : 'critical';

  const errorMap = new Map<number, Classification>();
  classifications.forEach(c => errorMap.set(c.word_index, c));

  const passageWords = passage?.content ? passage.content.split(/\s+/) : [];
  const cleanTranscript = formatTranscript(session.transcript);

  const wpm = session.words_per_minute != null ? Math.round(session.words_per_minute) : '--';

  return (
    <main className="w-full max-w-5xl mx-auto px-container-padding py-8 sm:py-12 space-y-8 text-on-surface">
      {/* Header & Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-container-highest pb-6">
        <div>
          <Link
            to="/parent/home"
            className="inline-flex items-center gap-2 text-primary hover:text-primary-container font-display text-xs font-bold uppercase tracking-widest mb-3 transition-colors group"
          >
            <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to Parent Portal
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-display text-[10px] font-bold uppercase tracking-wider">
              Session Report
            </span>
            <span className="font-body text-xs text-on-surface-variant">
              {new Date(session.started_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-on-surface">{passage.title}</h1>
        </div>

        {/* Action button */}
        <Link
          to="/parent/home"
          className="px-5 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-display text-xs font-bold uppercase tracking-wider hover:bg-surface-container-highest transition-colors cursor-pointer self-start sm:self-auto"
        >
          Parent Dashboard
        </Link>
      </div>

      {/* Primary Key Metrics Cards — stat-card pattern with accent bars */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card stat-card-hover p-5 border-l-4 border-primary shadow-sm" style={{ borderLeftColor: 'var(--color-primary)' }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-primary">speed</span>
            <div className="text-left">
              <div className="font-display text-2xl font-extrabold text-on-surface teacher-mono">{wpm}</div>
              <div className="font-display text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Words Per Minute</div>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-hover p-5 border-l-4 shadow-sm" style={{ borderLeftColor: `var(--risk-${accuracyRiskTier}-border)` }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl" style={{ color: `var(--risk-${accuracyRiskTier}-border)` }}>verified</span>
            <div className="text-left">
              <div className="font-display text-2xl font-extrabold teacher-mono" style={{ color: `var(--risk-${accuracyRiskTier}-border)` }}>{accuracyPercent}%</div>
              <div className="font-display text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Reading Accuracy</div>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-hover p-5 border-l-4 border-secondary shadow-sm" style={{ borderLeftColor: 'var(--color-secondary)' }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-secondary">menu_book</span>
            <div className="text-left">
              <div className="font-display text-2xl font-extrabold text-on-surface teacher-mono">{totalWords}</div>
              <div className="font-display text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Words Read</div>
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-hover p-5 border-l-4 border-amber-500 shadow-sm" style={{ borderLeftColor: 'var(--risk-medium-border)' }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-amber-600">report_problem</span>
            <div className="text-left">
              <div className="font-display text-2xl font-extrabold text-amber-700 teacher-mono">{totalErrors}</div>
              <div className="font-display text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Misreadings</div>
            </div>
          </div>
        </div>
      </div>

      {/* Student Audio Recording Player */}
      <StudentAudioPlayer
        studentId={studentId || ''}
        sessionId={sessionId || ''}
        transcript={cleanTranscript}
        hasRecording={hasStudentRecording}
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-surface-container-highest gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-t-xl font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
          }`}
        >
          Session Overview
        </button>
        <button
          onClick={() => setActiveTab('passage')}
          className={`px-4 py-2.5 rounded-t-xl font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'passage'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
          }`}
        >
          Annotated Passage ({classifications.length} flags)
        </button>
        <button
          onClick={() => setActiveTab('errors')}
          className={`px-4 py-2.5 rounded-t-xl font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'errors'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
          }`}
        >
          Error Breakdown
        </button>
        <button
          onClick={() => setActiveTab('drills')}
          className={`px-4 py-2.5 rounded-t-xl font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'drills'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
          }`}
        >
          Practice Drills ({drills.length})
        </button>
        <button
          onClick={() => setActiveTab('roadmap')}
          className={`px-4 py-2.5 rounded-t-xl font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'roadmap'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
          }`}
        >
          Parent Action Plan
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Orton-Gillingham Error Distribution — using cat-* utility classes */}
          <div className="stat-card stat-card-hover p-6 border border-white/80 shadow-sm space-y-4">
            <h3 className="font-display text-lg font-bold text-on-surface">Orton-Gillingham Error Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(CATEGORY_STYLES).map(([code, meta]) => {
                let count = 0;
                if (code === 'REV') count = errorProfile?.rev_count || 0;
                else if (code === 'SUB') count = errorProfile?.sub_count || 0;
                else if (code === 'OMI') count = errorProfile?.omi_count || 0;
                else if (code === 'INS') count = errorProfile?.ins_count || 0;
                else if (code === 'BLD') count = errorProfile?.bld_count || 0;
                else if (code === 'PAC') count = errorProfile?.pac_count || 0;
                else if (code === 'UNC') count = errorProfile?.uncertain_count || 0;

                return (
                  <div key={code} className={`p-4 rounded-2xl border border-white/80 stat-card text-left flex flex-col justify-between badge-cat ${meta.style}`}>
                    <div className="font-display text-[11px] font-bold uppercase tracking-wider">
                      {code} — {meta.label}
                    </div>
                    <div className="font-display text-2xl font-extrabold mt-2 teacher-mono">
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Student Spoken Transcript */}
          {cleanTranscript && (
            <div className="stat-card stat-card-hover p-6 border border-white/80 shadow-sm space-y-2">
              <h3 className="font-display text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">record_voice_over</span>
                Speech-to-Text Transcript (Whisper)
              </h3>
              <p className="font-body text-sm text-on-surface bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high leading-relaxed">
                "{cleanTranscript}"
              </p>
            </div>
          )}

          {/* Improvement summary */}
          {improvementPlan?.summary && (
            <div className="stat-card stat-card-hover p-6 border border-primary/20 bg-primary/5 shadow-sm space-y-3" style={{ borderLeftColor: 'var(--color-primary)' }}>
              <h3 className="font-display text-base font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                AI Reading Summary for Parents
              </h3>
              <p className="font-body text-sm text-on-surface leading-relaxed">
                {improvementPlan.summary}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANNOTATED PASSAGE */}
      {activeTab === 'passage' && (
        <div className="stat-card stat-card-hover p-8 border border-white/80 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-surface-container-highest pb-4">
            <div>
              <h3 className="font-display text-xl font-bold text-on-surface">Annotated Reading Passage</h3>
              <p className="font-body text-xs text-on-surface-variant">Hover or click flagged words to view clinical Orton-Gillingham categories</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge-cat cat-rev">REV</span>
              <span className="badge-cat cat-sub">SUB</span>
              <span className="badge-cat cat-omi">OMI</span>
              <span className="badge-cat cat-ins">INS</span>
              <span className="badge-cat cat-bld">BLD</span>
              <span className="badge-cat cat-pac">PAC</span>
              <span className="badge-cat cat-unc">UNC</span>
            </div>
          </div>

          <div className="font-body text-lg leading-loose text-on-surface tracking-wide bg-surface-container-lowest p-8 rounded-2xl border border-surface-container-high shadow-inner flex flex-wrap gap-x-2 gap-y-3">
            {passageWords.map((word, idx) => {
              const err = errorMap.get(idx);
              if (!err) {
                return <span key={idx} className="hover:text-primary transition-colors">{word}</span>;
              }

              const meta = CATEGORY_STYLES[err.category] || CATEGORY_STYLES.UNC;
              const isTopLine = idx < 6;
              const isLeftColumn = idx % 8 < 2;
              const isRightColumn = idx % 8 >= 6;

              const vPos = isTopLine ? 'top-full mt-2' : 'bottom-full mb-2';
              const hPos = isLeftColumn
                ? 'left-0 translate-x-0'
                : isRightColumn
                ? 'right-0 left-auto translate-x-0'
                : 'left-1/2 -translate-x-1/2';

              return (
                <span key={idx} className="relative group inline-block">
                  <span className={`px-2 py-1 rounded-xl font-bold border cursor-help shadow-xs hover:scale-105 transition-transform badge-cat ${meta.style}`}>
                    {word}
                    <span className="ml-1 text-[10px] uppercase tracking-wider font-display opacity-95">({err.category})</span>
                  </span>

                  {/* Tooltip on hover */}
                  <span className={`absolute ${vPos} ${hPos} hidden group-hover:block w-52 p-3 rounded-2xl bg-on-surface text-surface font-body text-xs leading-relaxed shadow-2xl z-40 pointer-events-none transition-all`}>
                    <strong className="block font-display text-[10px] uppercase font-bold text-secondary mb-1">Spoken: "{err.spoken_word}"</strong>
                    {err.rationale}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ERROR BREAKDOWN */}
      {activeTab === 'errors' && (
        <div className="stat-card stat-card-hover p-6 border border-white/80 shadow-sm space-y-4 animate-in fade-in">
          <h3 className="font-display text-lg font-bold text-on-surface">Classified Reading Errors ({classifications.length})</h3>

          {classifications.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant font-body">No reading mispronunciations detected in this session! Great reading!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-body text-sm">
                <thead>
                  <tr className="border-b border-surface-container-highest font-display text-xs font-bold uppercase text-on-surface-variant">
                    <th className="py-3 px-4">Index</th>
                    <th className="py-3 px-4">Target Word</th>
                    <th className="py-3 px-4">Spoken Word</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Clinical Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {classifications.map((cls, i) => {
                    const meta = CATEGORY_STYLES[cls.category] || CATEGORY_STYLES.UNC;
                    return (
                      <tr key={i} className="table-row-hover">
                        <td className="py-3.5 px-4 font-mono text-xs text-outline teacher-mono">#{cls.word_index + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-on-surface">{cls.source_word}</td>
                        <td className="py-3.5 px-4 font-medium text-error">{cls.spoken_word || '—'}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-lg font-display text-[10px] font-bold uppercase tracking-wider border badge-cat ${meta.style}`}>
                            {cls.category} — {meta.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-on-surface-variant">{cls.rationale}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PRACTICE DRILLS */}
      {activeTab === 'drills' && (
        <div className="stat-card stat-card-hover p-6 border border-white/80 shadow-sm space-y-4 animate-in fade-in">
          <h3 className="font-display text-lg font-bold text-on-surface">Target Practice Drills ({drills.length})</h3>

          {drills.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant font-body">No specific drills generated for this session.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drills.map((drill) => (
                <div key={drill.id} className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="badge-cat cat-sub">
                      {drill.target_category} Drill
                    </span>
                    <span className="font-display text-[10px] font-bold uppercase text-outline">{drill.drill_type}</span>
                  </div>
                  <h4 className="font-display text-base font-bold text-on-surface">{drill.content?.title || 'Phonetic Practice'}</h4>
                  <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                    {drill.content?.instructions || drill.content?.description || JSON.stringify(drill.content)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PARENT ACTION PLAN */}
      {activeTab === 'roadmap' && (
        <div className="space-y-6 animate-in fade-in">
          {improvementPlan?.keyConcerns && improvementPlan.keyConcerns.length > 0 && (
            <div className="stat-card stat-card-hover p-6 border border-amber-200 bg-amber-50/50 shadow-sm space-y-3" style={{ borderLeftColor: 'var(--risk-medium-border)' }}>
              <h3 className="font-display text-base font-bold text-amber-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700">warning</span>
                Target Attention Areas
              </h3>
              <ul className="list-disc list-inside space-y-1 font-body text-sm text-amber-950">
                {improvementPlan.keyConcerns.map((concern, idx) => (
                  <li key={idx}>{concern}</li>
                ))}
              </ul>
            </div>
          )}

          {improvementPlan?.weeklyRoadmap && (
            <div className="stat-card stat-card-hover p-6 border border-white/80 shadow-sm space-y-4">
              <h3 className="font-display text-lg font-bold text-on-surface">Weekly Improvement Roadmap</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {improvementPlan.weeklyRoadmap.map((w) => (
                  <div key={w.week} className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high space-y-2">
                    <div className="font-display text-xs font-bold uppercase text-primary tracking-wider">Week {w.week}: {w.focus}</div>
                    <div className="font-body text-xs text-on-surface-variant space-y-1">
                      {w.activities?.map((act, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                          <span>{act}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <EducationalDisclaimer variant="card" className="mt-8" />
    </main>
  );
}

function StudentAudioPlayer({
  studentId,
  sessionId,
  transcript,
  hasRecording,
}: {
  studentId: string;
  sessionId: string;
  transcript: string | null;
  hasRecording: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayToggle = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      setStatusLabel('');
      return;
    }

    setIsLoading(true);
    setStatusLabel('Fetching audio recording…');

    try {
      const baseUrl = getApiBaseUrl();
      const endpoint = `/api/v1/parent/children/${studentId}/sessions/${sessionId}/student-audio`;
      const targetUrl = baseUrl ? `${baseUrl}${endpoint}` : endpoint;

      const res = await fetch(targetUrl, { credentials: 'include' });

      if (!res.ok) {
        throw new Error('Audio request failed');
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('audio/')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          setIsPlaying(false);
          setStatusLabel('');
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setIsPlaying(false);
          setStatusLabel('');
        };

        setIsLoading(false);
        setIsPlaying(true);
        setStatusLabel('Playing student recording…');
        await audio.play();
      } else {
        const data = await res.json();
        const textToSpeak = data.transcript || transcript || 'Reading recording playback';

        setIsLoading(false);
        setIsPlaying(true);
        setStatusLabel('Playing speech audio…');

        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          utterance.pitch = 1.25;
          utterance.rate = 0.88;
          utterance.onend = () => {
            setIsPlaying(false);
            setStatusLabel('');
          };
          utterance.onerror = () => {
            setIsPlaying(false);
            setStatusLabel('');
          };
          window.speechSynthesis.speak(utterance);
        } else {
          setIsPlaying(false);
          setStatusLabel('');
        }
      }
    } catch (err) {
      console.error('Failed to play audio:', err);
      setIsLoading(false);
      setIsPlaying(false);
      setStatusLabel('Audio unavailable');
    }
  };

  return (
    <div className="stat-card stat-card-hover p-6 border-2 border-secondary/30 bg-gradient-to-r from-secondary/10 via-amber-50/30 to-indigo-50/30 shadow-md space-y-4" style={{ borderLeftColor: 'var(--color-secondary)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-secondary/20 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-2xl">{isPlaying ? 'graphic_eq' : 'mic'}</span>
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-on-surface">Student's Live Reading Recording</h3>
            <p className="font-body text-xs text-on-surface-variant">Listen to your child's oral reading performance to monitor progress</p>
          </div>
        </div>

        <span className={`self-start sm:self-auto px-3 py-1 rounded-full font-display text-[10px] font-bold uppercase tracking-wider border badge-risk ${hasRecording ? 'risk-excellent' : 'risk-medium'}`}>
          {hasRecording ? '🎙️ Live Voice Recording' : '🔊 Audio Speech Playback'}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 p-4 rounded-2xl border border-secondary/20 shadow-inner">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handlePlayToggle}
            disabled={isLoading}
            className="h-12 px-6 rounded-xl bg-secondary text-on-secondary font-display text-xs font-bold uppercase tracking-wider hover:bg-secondary-container hover:text-on-secondary-container transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-md shrink-0"
          >
            <span className="material-symbols-outlined text-xl">{isLoading ? 'hourglass_top' : isPlaying ? 'pause' : 'play_arrow'}</span>
            {isLoading ? 'Loading Audio…' : isPlaying ? 'Pause Audio' : 'Play Audio Recording'}
          </button>

          {statusLabel && (
            <span className="font-display text-xs font-bold text-secondary animate-pulse">
              {statusLabel}
            </span>
          )}
        </div>

        <div className="font-body text-xs text-on-surface-variant italic">
          {isPlaying ? '▶️ Audio is actively playing' : 'Click Play to listen to this session'}
        </div>
      </div>
    </div>
  );
}