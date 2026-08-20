import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useApiQuery } from '../lib/api';
import AnnotatedText from '../components/AnnotatedText';
import DrillCard from '../components/DrillCard';
import { AnimatedCounter } from '../components/AnimatedCounter';
import DexAvatar from '../components/DexAvatar';
import EducationalDisclaimer from '../components/EducationalDisclaimer';

export default function SessionResults() {
  const { id } = useParams();
  const { data, loading, error } = useApiQuery<any>(`/sessions/${id}/results`);

  useEffect(() => {
    if (data?.session) {
      const duration = 3 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#2563EB', '#7f5018', '#eab308']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#2563EB', '#7f5018', '#eab308']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [data?.session]);

  if (loading) return <div className="p-8 text-center text-on-surface-variant font-body student-text">Loading results...</div>;
  if (error) return <div className="p-8 text-center text-error font-body student-text">Error: {error.message}</div>;
  if (!data || !data.session) return <div className="p-8 text-center text-on-surface-variant font-body student-text">No session results found.</div>;

  const { session, classifications = [], drills = [] } = data;
  const drill = Array.isArray(drills) && drills.length > 0 ? drills[0] : null;

  const tempAudioUrl = id ? sessionStorage.getItem(`temp_audio_${id}`) : null;

  const displayWpm = session.words_per_minute != null
    ? Math.round(session.words_per_minute)
    : null;

  const accuracyPct = 100 - Math.round((session.error_rate || 0) * 100);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const accuracyRiskTier = accuracyPct >= 90 ? 'excellent' : accuracyPct >= 75 ? 'good' : accuracyPct >= 60 ? 'medium' : accuracyPct >= 40 ? 'high' : 'critical';

  return (
    <motion.main initial="hidden" animate="show" variants={containerVariants} className="w-full max-w-max-content-width mx-auto px-container-padding py-8 space-y-8 pb-24 text-on-surface">
      {/* Sub-header Area */}
      <motion.div variants={itemVariants} className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary font-display text-sm font-bold tracking-[0.08em] transition-all group w-fit">
          <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          Back to Dashboard
        </Link>
        <div>
          <h1 className="font-display text-[28px] sm:text-[36px] md:text-[48px] leading-[1.2] tracking-[0.02em] font-extrabold text-on-surface mb-2">Reading Results</h1>
          <p className="font-body text-[16px] sm:text-[20px] leading-[1.6] tracking-[0.05em] text-on-surface-variant flex flex-wrap items-center gap-2 student-text">
            <span className="material-symbols-outlined text-outline">description</span>
            Passage: <span className="font-medium text-on-surface">{session.title || 'Untitled Passage'}</span>
          </p>
        </div>
      </motion.div>

      {/* Temporary Session Audio Playback (In-Memory Only) */}
      {tempAudioUrl ? (
        <motion.div variants={itemVariants} className="stat-card stat-card-hover p-6 border-l-4 border-primary flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm" style={{ background: 'var(--color-primary-container)', opacity: 0.2 }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-2xl">graphic_eq</span>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-on-surface">Session Audio Playback</h3>
              <p className="font-body text-xs text-on-surface-variant student-text">Temporary recording playback • Automatically deleted when window is closed</p>
            </div>
          </div>
          <audio controls src={tempAudioUrl} className="w-full sm:w-80 h-10 outline-none rounded-xl" />
        </motion.div>
      ) : null}

      {/* Dex Celebration */}
      <motion.div variants={itemVariants} className="stat-card stat-card-hover text-center p-8 bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/10">
        <DexAvatar state="celebrating" size="lg" showCaptionBubble={true} caption={`Amazing work! You read ${displayWpm || 'this passage'} WPM with ${accuracyPct}% accuracy!`} />
      </motion.div>

      {/* Stats Row — achievement tiles with accent bars and micro-messages */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-card-gap">
        <motion.div variants={itemVariants} className="stat-card stat-card-hover p-6 border-l-4 border-primary shadow-sm" style={{ borderLeftColor: 'var(--color-primary)' }}>
          <div className="flex items-center gap-4">
            <div className="stat-icon bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-3xl">speed</span>
            </div>
            <div className="flex-1">
              <p className="stat-label" style={{ color: 'var(--color-primary)' }}>Speed</p>
              <div className="flex items-baseline gap-1">
                <span className="stat-value text-primary">
                  {displayWpm != null ? <AnimatedCounter value={displayWpm} /> : '—'}
                </span>
                <span className="font-body text-base text-outline">WPM</span>
              </div>
              <p className="stat-sublabel text-on-surface-variant mt-1 student-text">{displayWpm && displayWpm > 80 ? 'Getting faster! 🚀' : displayWpm && displayWpm > 50 ? 'Good pace!' : 'Building speed...'}</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="stat-card stat-card-hover p-6 border-l-4 border-secondary shadow-sm" style={{ borderLeftColor: 'var(--color-secondary)' }}>
          <div className="flex items-center gap-4">
            <div className="stat-icon bg-secondary/10 text-secondary">
              <span className="material-symbols-outlined text-3xl">menu_book</span>
            </div>
            <div className="flex-1">
              <p className="stat-label" style={{ color: 'var(--color-secondary)' }}>Words Read</p>
              <div className="flex items-baseline gap-1">
                <span className="stat-value text-primary">
                  {session.total_words_read != null ? <AnimatedCounter value={session.total_words_read} /> : '—'}
                </span>
              </div>
              <p className="stat-sublabel text-on-surface-variant mt-1 student-text">Every word counts! 📖</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="stat-card stat-card-hover p-6 border-l-4 shadow-sm" style={{ borderLeftColor: `var(--risk-${accuracyRiskTier}-border)` }}>
          <div className="flex items-center gap-4">
            <div className={`stat-icon badge-cat ${accuracyRiskTier === 'excellent' ? 'cat-omi' : accuracyRiskTier === 'good' ? 'cat-omi' : accuracyRiskTier === 'medium' ? 'cat-pac' : accuracyRiskTier === 'high' ? 'cat-pac' : 'cat-rev'}`}>
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <div className="flex-1">
              <p className="stat-label" style={{ color: `var(--risk-${accuracyRiskTier}-border)` }}>Accuracy</p>
              <div className="flex items-baseline gap-1">
                <span className="stat-value" style={{ color: `var(--risk-${accuracyRiskTier}-border)` }}>
                  <AnimatedCounter value={accuracyPct} />%
                </span>
              </div>
              <p className="stat-sublabel text-on-surface-variant mt-1 student-text">{accuracyPct >= 90 ? 'Nailed it! 🎯' : accuracyPct >= 75 ? 'Great job!' : 'Keep practicing!'}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
          <div className="stat-card stat-card-hover rounded-3xl border border-white/80 shadow-sm bg-white/40 relative">
            <div className="px-6 sm:px-8 py-5 border-b border-white/60 bg-white/20 backdrop-blur-md flex justify-between items-center rounded-t-3xl">
              <h2 className="font-display text-[20px] sm:text-[24px] font-bold text-on-surface">Detailed Error Analysis</h2>
            </div>
            
            <div className="px-6 sm:px-8 md:px-10 py-6 sm:py-10 bg-transparent">
              <AnnotatedText sessionId={session.id} originalText={session.original_passage || ''} classifications={classifications} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 px-6 py-4 bg-white/30 backdrop-blur-md rounded-2xl border border-white/60 border-dashed">
            <span className="font-body text-xs sm:text-sm font-bold text-on-surface-variant mr-2">Error Types:</span>
            <div className="flex items-center gap-1.5">
              <span className="badge-cat cat-omi">OMI</span>
              <span className="font-body text-xs sm:text-sm text-on-surface-variant">Omission</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="badge-cat cat-ins">INS</span>
              <span className="font-body text-xs sm:text-sm text-on-surface-variant">Insertion</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="badge-cat cat-sub">SUB</span>
              <span className="font-body text-xs sm:text-sm text-on-surface-variant">Substitution</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="badge-cat cat-rev">REV</span>
              <span className="font-body text-xs sm:text-sm text-on-surface-variant">Reversal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="badge-cat cat-unc">UNC</span>
              <span className="font-body text-xs sm:text-sm text-on-surface-variant">Uncertain</span>
            </div>
          </div>
        </motion.div>
        
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
          {drill ? (
            <div className="stat-card stat-card-hover p-6 border border-white/80 shadow-sm flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-tertiary-container/15 flex items-center justify-center text-tertiary-container shrink-0 mt-1 shadow-inner">
                  <span className="material-symbols-outlined text-2xl">neurology</span>
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-on-surface mb-1">Recommended Practice</h3>
                  <p className="font-body text-sm text-on-surface-variant leading-relaxed student-text">Based on this assessment, AI suggests focusing on specific phoneme patterns.</p>
                </div>
              </div>
              <DrillCard drill={drill} />
            </div>
          ) : (
            <div className="stat-card stat-card-hover p-8 text-center border border-white/80 text-on-surface-variant font-body shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-container/20 text-primary flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-4xl" style={{fontVariationSettings: "'FILL' 1"}}>emoji_events</span>
              </div>
              <h3 className="font-display text-lg font-bold text-on-surface mb-1">Great Job!</h3>
              <p className="font-body text-sm text-on-surface-variant student-text">No specific drills recommended for this session.</p>
            </div>
          )}
        </motion.div>
      </div>

      <EducationalDisclaimer variant="card" className="mt-8" />
    </motion.main>
  );
}