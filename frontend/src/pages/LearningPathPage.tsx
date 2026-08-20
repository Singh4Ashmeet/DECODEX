import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, useApiQuery } from '../lib/api';
import { useDex } from '../hooks/useDex';
import DexAvatar from '../components/DexAvatar';
import { Skeleton } from '../components/Skeleton';

interface ActiveActivity {
  pathId: string;
  weekNumber: number;
  dayNumber: number;
  title: string;
  activityType: 'drill' | 'story' | 'reading' | 'phonics';
  targetSkill: string;
  description: string;
}

export default function LearningPathPage() {
  const { user } = useAuth();
  const studentId = user?.id;
  const navigate = useNavigate();

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeActivity, setActiveActivity] = useState<ActiveActivity | null>(null);
  const { state: dexState, caption: dexCaption, speak: dexSpeak } = useDex();
  const hasNarrated = useRef(false);

  const { data, loading, error, refetch } = useApiQuery<any>(`/learning-paths/${studentId}`);
  const learningPath = data?.learningPath;

  // Auto-narrate learning path summary when page loads with valid data
  useEffect(() => {
    if (hasNarrated.current || !learningPath || !learningPath.weeks?.length) return;
    hasNarrated.current = true;

    const currentWeek = learningPath.weeks.find(
      (w: any) => w.weekNumber === learningPath.currentWeek
    );
    const focusArea = currentWeek?.focusArea || 'your reading skills';
    const narration = learningPath.planSummary
      ? `Here's your learning path! This week we're focusing on ${focusArea}. ${learningPath.planSummary}`
      : `Welcome to your learning path! This week we're working on ${focusArea}.`;

    void dexSpeak(narration);
  }, [learningPath, dexSpeak]);

  const handleGenerate = async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      await apiFetch(`/learning-paths/${studentId}/generate`, { method: 'POST' });
      refetch();
    } catch (err: any) {
      if (err.code === 'INSUFFICIENT_SESSIONS') {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err.message || 'Failed to generate learning path');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCompleteDay = async (pathId: string, weekNumber: number, dayNumber: number) => {
    try {
      await apiFetch(`/learning-paths/${pathId}/weeks/${weekNumber}/days/${dayNumber}/complete`, { method: 'PATCH' });
      refetch();
    } catch (err) {
      console.error('Failed to complete day task:', err);
    }
  };

  const handleLaunchActivity = (weekNumber: number, day: any) => {
    if (day.activityType === 'reading') {
      navigate('/passages');
    } else if (day.activityType === 'story') {
      navigate('/stories');
    } else {
      setActiveActivity({
        pathId: learningPath.id,
        weekNumber,
        dayNumber: day.dayNumber,
        title: day.title,
        activityType: day.activityType,
        targetSkill: day.targetSkill || 'REV',
        description: day.description,
      });
    }
  };

  if (loading) {
    return (
      <main className="flex-grow w-full max-w-[1000px] mx-auto px-container-padding py-8 sm:py-12">
        <Skeleton className="h-32 w-full mb-8" />
        <Skeleton className="h-40 w-full mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </main>
    );
  }
  if (error) return <div className="stat-card p-8 text-center text-error font-body student-text">Error loading learning path: {error.message}</div>;

  const canGenerate = learningPath?.canGenerate ?? true;
  const currentSessions = learningPath?.completedSessionsCount ?? 0;
  const requiredSessions = learningPath?.requiredSessionsCount ?? 2;
  const hasPath = learningPath && learningPath.weeks?.length > 0;
  const isCompleted = learningPath?.status === 'completed' || (hasPath && learningPath.weeks.every((w: any) => w.completed));
  const stageNumber = learningPath?.stageNumber || 1;
  const trackMode = learningPath?.trackMode || 'Steady Mastery Track';
  const riskLevel = learningPath?.riskLevel || 'low';

  type RiskLevel = 'low' | 'medium' | 'high';

  const riskConfig = {
    low: { badge: 'risk-good', icon: 'sentiment_very_satisfied' },
    medium: { badge: 'risk-medium', icon: 'sentiment_neutral' },
    high: { badge: 'risk-high', icon: 'sentiment_dissatisfied' },
  }[(riskLevel as RiskLevel)] || { badge: 'risk-good', icon: 'sentiment_very_satisfied' };

  return (
    <main className="flex-grow w-full max-w-[1000px] mx-auto px-container-padding py-8 sm:py-12 text-on-surface">
      <Link to="/" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary font-display text-sm font-bold tracking-[0.08em] uppercase transition-all group mb-6">
        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
        Back to Dashboard
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/20 text-primary font-display text-[10px] font-bold uppercase tracking-widest mb-2">
            <span className="material-symbols-outlined text-sm">route</span>
            Stage {stageNumber} Adaptive Curriculum
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-primary">Your Reading Learning Path</h1>
          <p className="font-body text-base text-on-surface-variant mt-1">A day-by-day plan tailored to your reading assessment context</p>
          <div className="mt-3">
            <DexAvatar state={dexState} caption={dexCaption} />
          </div>
        </div>

        {hasPath && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="h-12 px-6 rounded-xl bg-surface-container-high text-on-surface font-display text-xs font-bold uppercase tracking-wider transition-all hover:bg-surface-container-highest active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {generating ? 'Regenerating…' : `Re-Analyze & Update Stage ${stageNumber}`}
          </button>
        )}
      </div>

      {/* Daily Practice Commitment Card */}
      <div className="stat-card stat-card-hover p-6 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent mb-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ borderLeftColor: 'var(--color-secondary)' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">menu_book</span>
          </div>
          <div>
            <span className="badge-cat cat-sub">Student Core Rule</span>
            <h3 className="font-display text-lg font-bold text-on-surface mt-1">Daily Story Practice Commitment</h3>
            <p className="font-body text-sm text-on-surface-variant max-w-2xl mt-0.5 student-text">
              You must practice reading every single day — even if you cannot finish a whole story, reading even a small part or a few phrases of a story daily will continuously improve your skills!
            </p>
          </div>
        </div>
        <Link
          to="/stories"
          className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-display text-xs font-bold uppercase tracking-wider transition-all shadow-sm shrink-0 flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">auto_stories</span>
          Practice Story
        </Link>
      </div>

      {errorMsg && (
        <div className="stat-card stat-card-hover p-4 rounded-2xl border-l-4 border-red-500 text-red-800 font-body text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6" style={{ borderLeftColor: 'var(--risk-high-border)' }}>
          <div>
            <p className="font-display font-bold text-base">Generation Error</p>
            <p className="mt-0.5 student-text">{errorMsg}</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-display text-xs font-bold uppercase tracking-wider transition-all shadow-md shrink-0 cursor-pointer disabled:opacity-60"
          >
            {generating ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      )}

      {/* Graduation Banner when 100% completed */}
      {isCompleted && (
        <div className="stat-card stat-card-hover p-8 sm:p-10 border border-emerald-500/50 bg-emerald-500/10 mb-8 shadow-xl text-center flex flex-col items-center" style={{ borderLeftColor: 'var(--risk-excellent-border)' }}>
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-inner">
            <span className="material-symbols-outlined text-4xl">workspace_premium</span>
          </div>
          <span className="badge-cat cat-omi">🏆 Stage {stageNumber} Curriculum Mastered! (+500 Bonus XP Awarded)</span>
          <h2 className="font-display text-3xl font-extrabold text-on-surface mb-2">Congratulations! Stage {stageNumber} Finished!</h2>
          <p className="font-body text-base text-on-surface-variant max-w-xl mb-6 leading-relaxed student-text">
            You completed all 20 interactive days of Stage {stageNumber}. Decodex has analyzed your newest reading speed and error reduction rates to adapt your next level!
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="h-14 px-8 rounded-2xl bg-emerald-600 text-white font-display text-base font-bold uppercase tracking-wider transition-all shadow-lg hover:bg-emerald-700 active:scale-95 disabled:opacity-60 cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined">rocket_launch</span>
            {generating ? 'Constructing Next Stage…' : `Generate Stage ${stageNumber + 1} Advanced Plan →`}
          </button>
        </div>
      )}

      {/* Gating Screen if under 2 sessions */}
      {!canGenerate && !hasPath && (
        <div className="stat-card stat-card-hover p-8 sm:p-12 border border-amber-500/30 text-center flex flex-col items-center justify-center shadow-lg bg-amber-500/5" style={{ borderLeftColor: 'var(--color-secondary)' }}>
          <div className="w-20 h-20 mb-4 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>assignment_late</span>
          </div>
          <span className="badge-cat cat-pac">Assessment Required ({currentSessions} / {requiredSessions} Completed)</span>
          <h3 className="font-display text-2xl font-bold text-on-surface mb-2">Complete Reading Assessments First</h3>
          <p className="font-body text-base text-on-surface-variant max-w-lg mb-6 leading-relaxed student-text">
            To build a truly personalized day-by-day plan, Decodex needs at least {requiredSessions} reading assessment sessions to analyze your specific speech, speed, and error patterns.
          </p>
          <button
            onClick={() => navigate('/passages')}
            className="h-14 px-8 rounded-2xl bg-primary text-on-primary font-display text-base font-bold uppercase tracking-wider transition-all shadow-lg hover:bg-primary-container hover:text-on-primary-container active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined">mic</span>
            Take Reading Assessment #{currentSessions + 1}
          </button>
        </div>
      )}

      {/* Ready to generate initial plan */}
      {canGenerate && !hasPath && (
        <div className="stat-card stat-card-hover p-12 border border-white/80 text-center flex flex-col items-center justify-center" style={{ borderLeftColor: 'var(--color-primary)' }}>
          <div className="w-20 h-20 mb-4 rounded-2xl bg-primary-container/20 text-primary flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
          </div>
          <span className="badge-cat cat-omi">Context Ready ({currentSessions} Reading Sessions Analyzed)</span>
          <h3 className="font-display text-2xl font-bold text-on-surface mb-2">Generate Your Stage {stageNumber} Plan</h3>
          <p className="font-body text-base text-on-surface-variant max-w-md mb-6 student-text">
            Click below to construct your custom 4-week, 20-day Orton-Gillingham intervention roadmap based on your reading assessment results.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="h-14 px-8 rounded-2xl bg-primary text-on-primary font-display text-base font-bold uppercase tracking-wider transition-all shadow-lg hover:bg-primary-container hover:text-on-primary-container active:scale-95 disabled:opacity-60 cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined">{generating ? 'hourglass_top' : 'auto_awesome'}</span>
            {generating ? 'Constructing Plan…' : `Generate Stage {stageNumber} Plan`}
          </button>
        </div>
      )}

      {/* Active Day-by-Day Learning Path */}
      {hasPath && !isCompleted && (
        <div className="space-y-8">
          <div className="stat-card stat-card-hover p-6 sm:p-8 border border-white/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6" style={{ borderLeftColor: 'var(--color-primary)' }}>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="badge-cat cat-sub">Stage {stageNumber} • Week {learningPath.currentWeek} of {learningPath.totalWeeks}</span>
                <span className="badge-cat cat-bld">{trackMode.toUpperCase()}</span>
                <span className={`badge-risk ${riskConfig.badge}`}>
                  <span className="material-symbols-outlined text-sm mr-1">{riskConfig.icon}</span>
                  {riskLevel.toUpperCase()} RISK INTENSITY
                </span>
              </div>
              <h2 className="font-display text-2xl font-bold text-on-surface">{learningPath.title}</h2>
              <p className="font-body text-sm text-on-surface-variant mt-2 max-w-2xl student-text">{learningPath.planSummary}</p>
            </div>
            <div className="w-full md:w-48 stat-card p-4 border border-surface-container-highest flex flex-col items-center text-center shrink-0" style={{ background: 'var(--color-muted)' }}>
              <span className="font-display text-3xl font-extrabold text-primary teacher-mono">
                {Math.round(
                  (learningPath.weeks.flatMap((w: any) => w.days || []).filter((d: any) => d.completed).length /
                    Math.max(1, learningPath.weeks.flatMap((w: any) => w.days || []).length)) * 100
                )}%
              </span>
              <span className="font-body text-xs text-on-surface-variant uppercase tracking-wider">Overall Progress</span>
            </div>
          </div>

          <div className="space-y-6">
            {learningPath.weeks.map((week: any) => (
              <div
                key={week.id || week.weekNumber}
                className={`stat-card stat-card-hover p-6 sm:p-8 rounded-3xl transition-all ${
                  week.completed
                    ? 'border-emerald-500/40 bg-emerald-50/20'
                    : week.weekNumber === learningPath.currentWeek
                    ? 'border-primary/40 bg-white/60 shadow-md ring-2 ring-primary/20'
                    : 'border-white/80 opacity-80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-surface-container-highest">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-display text-base font-extrabold shadow-inner ${
                        week.completed
                          ? 'bg-emerald-600 text-white'
                          : week.weekNumber === learningPath.currentWeek
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {week.completed ? <span className="material-symbols-outlined text-xl">check</span> : week.weekNumber}
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-bold text-on-surface">{week.focusArea}</h3>
                      <p className="font-body text-xs text-on-surface-variant student-text">{week.description}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {(week.days || []).map((day: any) => (
                    <div
                      key={day.dayNumber}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        day.completed
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-surface-container-lowest border-surface-container-highest hover:bg-white/80 shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className={`px-2 py-0.5 rounded-md font-display text-[9px] font-bold uppercase tracking-wider ${
                            day.completed ? 'bg-emerald-600 text-white' : 'bg-primary-container/20 text-primary'
                          }`}>
                            Day {day.dayNumber}
                          </span>
                          <span className="font-body text-[9px] text-outline student-text">~{day.estimatedMinutes}m</span>
                        </div>
                        <h4 className="font-display text-xs font-bold text-on-surface mb-1 line-clamp-2">{day.title}</h4>
                        <p className="font-body text-[10px] text-on-surface-variant leading-relaxed line-clamp-3 mb-3 student-text">{day.description}</p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-surface-container-highest">
                        <button
                          onClick={() => handleLaunchActivity(week.weekNumber, day)}
                          className="w-full py-1.5 px-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-display text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[12px]">volume_up</span>
                          {day.actionLabel || 'Launch Activity'}
                        </button>

                        {!day.completed ? (
                          <button
                            onClick={() => handleCompleteDay(learningPath.id, week.weekNumber, day.dayNumber)}
                            className="w-full py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[12px]">check</span>
                            Complete (+25 XP)
                          </button>
                        ) : (
                          <span className="w-full py-1 block text-center font-display text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 rounded-xl">
                            ✓ Done (+25 XP)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Activity Modal */}
      {activeActivity && (
        <InteractiveActivityModal
          activity={activeActivity}
          onClose={() => setActiveActivity(null)}
          onComplete={async () => {
            await handleCompleteDay(activeActivity.pathId, activeActivity.weekNumber, activeActivity.dayNumber);
            setActiveActivity(null);
          }}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Procedural Infinite Question Generator
// ---------------------------------------------------------------------------
interface QuestionItem {
  type: 'choice' | 'voice';
  target: string;
  question: string;
  options?: string[];
  correct?: string;
  expectedSpeech?: string;
  readText: string;
}

interface RawQuestion {
  target: string;
  question: string;
  options?: string[];
  correct?: string;
  expectedSpeech?: string;
  readText: string;
}

function generateDynamicQuestions(activity: ActiveActivity): QuestionItem[] {
  const REV_POOLS: RawQuestion[] = [
    { target: 'b vs d Discrimination', question: 'Which letter matches the sound /b/ as in "ball"?', options: ['b', 'd', 'p', 'q'], correct: 'b', readText: 'Which letter matches the sound b as in ball?' },
    { target: 'p vs q Discrimination', question: 'Which letter matches the sound /p/ as in "pen"?', options: ['p', 'q', 'b', 'd'], correct: 'p', readText: 'Which letter matches the sound p as in pen?' },
    { target: 'Reversal Identification', question: 'Select the correctly spelled word:', options: ['was', 'saw', 'waz', 'zaw'], correct: 'was', readText: 'Select the correctly spelled word.' },
    { target: 'Directional Reading', question: 'Which word means the opposite of "on"?', options: ['no', 'on', 'nu', 'un'], correct: 'no', readText: 'Which word means the opposite of on?' },
    { target: 'Reversal Pair', question: 'Select the word spelled from left to right:', options: ['form', 'from', 'fram', 'farm'], correct: 'from', readText: 'Select the word spelled from left to right.' },
  ];

  const BLD_POOLS: RawQuestion[] = [
    { target: 'Blend Building', question: 'Which letter cluster completes "_ _ eet" (street)?', options: ['str', 'spl', 'br', 'cl'], correct: 'str', readText: 'Which letter cluster completes street?' },
    { target: 'Initial Blend', question: 'Which cluster completes "_ _ og" (frog)?', options: ['fr', 'fl', 'tr', 'dr'], correct: 'fr', readText: 'Which cluster completes frog?' },
    { target: 'Consonant Cluster', question: 'Which cluster completes "_ _ aze" (blaze)?', options: ['bl', 'br', 'cl', 'gl'], correct: 'bl', readText: 'Which cluster completes blaze?' },
    { target: 'Triple Cluster', question: 'Which cluster completes "_ _ _ ash" (splash)?', options: ['spl', 'str', 'scr', 'spr'], correct: 'spl', readText: 'Which cluster completes splash?' },
  ];

  const SUB_POOLS: RawQuestion[] = [
    { target: 'Pattern Mastery', question: 'Which word matches the vowel team /ea/?', options: ['clean', 'clene', 'cleen', 'clain'], correct: 'clean', readText: 'Which word matches the vowel team ea?' },
    { target: 'Sight Word Discrimination', question: 'Select the correct spelling of "rain":', options: ['rain', 'rane', 'rayn', 'raen'], correct: 'rain', readText: 'Select the correct spelling of rain.' },
    { target: 'Long Vowel Team', question: 'Select the correct spelling of "boat":', options: ['boat', 'bote', 'boet', 'bawtt'], correct: 'boat', readText: 'Select the correct spelling of boat.' },
  ];

  const VOICE_POOLS: RawQuestion[] = [
    { target: 'Live Voice Speech Test', question: 'Read aloud into your microphone: "ball"', expectedSpeech: 'ball', readText: 'Read aloud into your microphone: ball' },
    { target: 'Live Voice Speech Test', question: 'Read aloud into your microphone: "street"', expectedSpeech: 'street', readText: 'Read aloud into your microphone: street' },
    { target: 'Live Voice Speech Test', question: 'Read aloud into your microphone: "shadow"', expectedSpeech: 'shadow', readText: 'Read aloud into your microphone: shadow' },
    { target: 'Live Voice Speech Test', question: 'Read aloud into your microphone: "bright"', expectedSpeech: 'bright', readText: 'Read aloud into your microphone: bright' },
    { target: 'Live Voice Speech Test', question: 'Read aloud into your microphone: "dragon"', expectedSpeech: 'dragon', readText: 'Read aloud into your microphone: dragon' },
    { target: 'Live Voice Speech Test', question: 'Read aloud into your microphone: "thunder"', expectedSpeech: 'thunder', readText: 'Read aloud into your microphone: thunder' },
  ];

  const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  const targetCategoryPool = activity.targetSkill === 'REV' ? REV_POOLS : activity.targetSkill === 'BLD' ? BLD_POOLS : SUB_POOLS;
  const choicePool = shuffle([...targetCategoryPool, ...REV_POOLS, ...BLD_POOLS]).slice(0, 3);
  const voicePool = shuffle(VOICE_POOLS).slice(0, 2);

  const merged = shuffle([...choicePool, ...voicePool]);
  return merged.map(item => ({
    type: item.expectedSpeech ? 'voice' : 'choice',
    target: item.target,
    question: item.question,
    options: item.options,
    correct: item.correct,
    expectedSpeech: item.expectedSpeech,
    readText: item.readText,
  }));
}

// ---------------------------------------------------------------------------
// Voice-Enabled Interactive Activity Modal
// ---------------------------------------------------------------------------
function InteractiveActivityModal({
  activity,
  onClose,
  onComplete,
}: {
  activity: ActiveActivity;
  onClose: () => void;
  onComplete: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [spokenText, setSpokenText] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voicePassed, setVoicePassed] = useState(false);
  const { speak: speakModalText } = useDex();

  const questions = useMemo(() => generateDynamicQuestions(activity), [activity]);
  const currentQ = questions[step % questions.length];

  const modalRef = useRef<HTMLDivElement | null>(null);

  const speakText = useCallback((text: string) => {
    void speakModalText(text);
  }, [speakModalText]);

  useEffect(() => {
    modalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  useEffect(() => {
    speakText(currentQ.readText);
    setSelectedOption(null);
    setSpokenText(null);
    setVoiceError(null);
    setVoicePassed(false);
    setAttempts(0);
  }, [currentQ.readText, speakText]);

  const startVoiceInput = async () => {
    // Cancel ongoing TTS audio and give browser 200ms to release audio device
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    await new Promise(r => setTimeout(r, 200));

    setListening(true);
    setVoiceError(null);
    setSpokenText(null);

    // Warm up mic explicitly via getUserMedia
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (permErr) {
      console.warn('Microphone permission error:', permErr);
      setListening(false);
      setVoiceError('Microphone permission blocked. Please allow mic access in your browser bar.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const input = prompt(`[Voice Test Engine] Please type how you pronounced "${currentQ.expectedSpeech}":`);
      evaluateSpeech(input || '');
      setListening(false);
      return;
    }

    let timeoutId: any = null;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      // 8-second max safety timeout
      timeoutId = setTimeout(() => {
        try { recognition.abort(); } catch {}
        setListening(false);
        setVoiceError('Listening timed out. Click the microphone to try speaking again!');
      }, 8000);

      recognition.onresult = (event: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        const transcript = event.results[0][0].transcript;
        evaluateSpeech(transcript);
        setListening(false);
      };

      recognition.onerror = (event: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn('Modal SpeechRecognition error:', event?.error);
        if (event?.error === 'aborted') return;

        const msg = event?.error === 'not-allowed'
          ? 'Microphone permission blocked. Allow mic access in your browser address bar.'
          : 'Could not detect speech clearly. Click microphone and try speaking into your mic!';

        setVoiceError(msg);
        setListening(false);
      };

      recognition.onend = () => {
        if (timeoutId) clearTimeout(timeoutId);
        setListening(false);
      };

      recognition.start();
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('Modal SpeechRecognition start failed:', err);
      setVoiceError('Speech recognition unavailable. Click microphone to try again.');
      setListening(false);
    }
  };

  const [attempts, setAttempts] = useState(0);

  const editDistance = (s1: string, s2: string): number => {
    const m = s1.length, n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
        else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  };

  const evaluateSpeech = (spoken: string) => {
    const normSpoken = spoken.trim().toLowerCase().replace(/[.,!?]/g, '');
    const normTarget = (currentQ.expectedSpeech || '').trim().toLowerCase().replace(/[.,!?]/g, '');

    setSpokenText(spoken);
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const spokenWords = normSpoken.split(/\s+/).filter(w => w.length > 0);
    const isMatch = normSpoken === normTarget ||
      normSpoken.includes(normTarget) ||
      normTarget.includes(normSpoken) ||
      spokenWords.some(w => w === normTarget || (normTarget.length >= 4 && editDistance(w, normTarget) <= 1));

    if (isMatch) {
      setVoicePassed(true);
      setVoiceError(null);
      setScore(s => s + 1);
      speakText('Great job! That pronunciation is correct!');
    } else {
      if (newAttempts >= 2) {
        setVoicePassed(true);
        setVoiceError(`Good effort! You said "${spoken}". Expected target was "${normTarget}". Let's move to the next question!`);
        speakText('Good effort! Let\'s try the next question.');
      } else {
        setVoicePassed(false);
        setVoiceError(`Not quite — you said "${spoken}". Target is "${normTarget}". Click microphone to try again!`);
        speakText('Not quite! Listen closely and try again.');
      }
    }
  };

  const handleSelectOption = (option: string) => {
    setSelectedOption(option);
    const normOpt = option.trim().toLowerCase();
    const normCorrect = (currentQ.correct || '').trim().toLowerCase();

    if (normOpt === normCorrect) {
      setScore(s => s + 1);
      speakText('Correct!');
    } else {
      speakText('Not quite — try another option or click Next!');
    }
  };

  const handleNext = async () => {
    if (step + 1 >= questions.length) {
      setCompleted(true);
      await onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const canProceed = currentQ.type === 'voice' ? voicePassed : (selectedOption !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md p-4">
      <div className="w-full max-w-xl rounded-3xl stat-card border border-white/80 p-8 shadow-2xl bg-white/95 text-on-surface">
        <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-surface-container-highest">
          <div>
            <span className="badge-cat cat-sub">{activity.title} • Infinite Generator</span>
            <h2 className="font-display text-xl font-bold text-on-surface mt-1">Multisensory Orton-Gillingham Exercise</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container-high text-on-surface-variant cursor-pointer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {!completed ? (
          <div>
            <div className="flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider text-outline mb-4">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-primary">record_voice_over</span>
                Question {step + 1} of {questions.length}
              </span>
              <button
                onClick={() => speakText(currentQ.readText)}
                className="px-3 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-1 text-[10px] cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">volume_up</span>
                Re-play Audio
              </button>
            </div>

            <div className="stat-card p-6 rounded-2xl border border-surface-container-high text-center mb-6" style={{ background: 'var(--color-muted)' }}>
              <span className="font-display text-xs font-bold text-primary uppercase tracking-widest block mb-2">{currentQ.target}</span>
              <p className="font-display text-xl font-bold text-on-surface mb-2">{currentQ.question}</p>
            </div>

            {currentQ.type === 'choice' && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {currentQ.options?.map(option => (
                  <button
                    key={option}
                    onClick={() => handleSelectOption(option)}
                    disabled={selectedOption !== null && selectedOption === currentQ.correct}
                    className={`p-4 rounded-2xl font-display text-xl font-extrabold transition-all cursor-pointer border ${
                      selectedOption === option
                        ? option === currentQ.correct
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                          : 'bg-red-600 text-white border-red-600 shadow-md'
                        : selectedOption !== null && option === currentQ.correct
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-white hover:bg-primary-container/10 border-surface-container-highest text-on-surface'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {currentQ.type === 'voice' && (
              <div className="text-center space-y-4 mb-6">
                <button
                  onClick={startVoiceInput}
                  disabled={listening || voicePassed}
                  className={`h-20 px-8 rounded-3xl font-display text-base font-extrabold uppercase tracking-wider transition-all shadow-lg cursor-pointer flex items-center justify-center gap-3 mx-auto ${
                    voicePassed
                      ? 'bg-emerald-600 text-white cursor-default'
                      : listening
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-3xl">
                    {voicePassed ? 'check_circle' : listening ? 'graphic_eq' : 'mic'}
                  </span>
                  {voicePassed ? '✓ Pronunciation Approved!' : listening ? 'Listening… Speak Now!' : 'Click & Speak Answer'}
                </button>

                {spokenText && (
                  <p className="font-body text-xs text-on-surface-variant student-text">
                    Voice Analysis Result: <strong className="font-semibold text-on-surface">"{spokenText}"</strong>
                  </p>
                )}

                {voiceError && (
                  <div className="stat-card p-3 rounded-2xl border-l-4 border-red-500 text-red-800 font-body text-xs leading-relaxed" style={{ borderLeftColor: 'var(--risk-high-border)' }}>
                    <span className="font-bold block mb-1">❌ Speech Mismatch</span>
                    {voiceError}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-surface-container-highest">
              <span className="font-body text-xs text-on-surface-variant student-text">
                {!canProceed ? '⚠️ Master current question to continue' : '✓ Ready for next step!'}
              </span>
              <button
                onClick={handleNext}
                disabled={!canProceed}
                className="h-12 px-6 rounded-2xl bg-primary text-on-primary font-display text-xs font-bold uppercase tracking-wider transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-container hover:text-on-primary-container cursor-pointer flex items-center gap-2"
              >
                {step + 1 >= questions.length ? 'Finish & Claim +25 XP' : 'Next Question →'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-6xl text-emerald-600 mb-2">military_tech</span>
            <h3 className="font-display text-2xl font-extrabold text-on-surface mb-2">Voice Exercise Complete!</h3>
            <p className="font-body text-base text-on-surface-variant mb-6 student-text">
              You scored <strong className="text-primary font-bold teacher-mono">{score} of {questions.length}</strong> and earned <strong className="text-primary font-bold">+25 XP</strong> for your daily plan!
            </p>
            <button
              onClick={onClose}
              className="h-12 px-8 rounded-2xl bg-primary text-on-primary font-display text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              Continue Learning Path
            </button>
          </div>
        )}
      </div>
    </div>
  );
}