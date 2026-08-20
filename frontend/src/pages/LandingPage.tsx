import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import decodexLogo from '../assets/decodex-logo.jpg';
import DexAvatar from '../components/DexAvatar';
import EducationalDisclaimer from '../components/EducationalDisclaimer';
import { TUTOR_NAME } from '../lib/constants';

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const dashboardPath = user?.role === 'parent' 
    ? '/parent/home' 
    : (user?.role === 'teacher' || user?.role === 'admin') 
    ? '/teacher/dashboard' 
    : '/dashboard';

  const encouragementMessages = [
    "Every child deserves to read with confidence! 🌟",
    "Where AI meets heart in reading education! 💙",
    "Building readers, one word at a time! 📚",
    "Your partner in literacy success! 🤝",
  ];
  const [msgIndex, setMsgIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % encouragementMessages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [encouragementMessages.length]);

  return (
    <div className="w-full text-on-surface">
      {/* Hero Section */}
      <section className="relative py-12 sm:py-16 flex flex-col items-center text-center">
        {/* Animated background blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-secondary/10 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-10 left-10 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '4s' }} />

        <div className="relative z-10 max-w-4xl mx-auto px-4 flex flex-col items-center">
          <img
            src={decodexLogo}
            alt="Decodex Logo"
            className="w-28 h-28 object-contain mb-4 drop-shadow-md"
          />

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-container/20 text-primary border border-primary/20 font-display text-xs font-bold uppercase tracking-widest mb-6">
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            AI Reading Screening & Dyslexia Intervention Platform
          </div>

          <h1 className="font-display text-4xl sm:text-6xl font-extrabold text-on-surface tracking-tight leading-[1.15] mb-6">
            Understand How Every Child Reads — <span className="text-primary">Powered by AI</span>
          </h1>

          <p className="font-body text-lg sm:text-xl text-on-surface-variant max-w-2xl leading-relaxed mb-8 student-text">
            Decodex transcribes speech in real-time, screens reading difficulties using structured Orton-Gillingham taxonomy, and delivers adaptive multisensory learning plans.
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            {isAuthenticated ? (
              <button
                onClick={() => navigate(dashboardPath)}
                className="w-full sm:w-auto h-14 px-8 rounded-2xl btn-clay flex items-center justify-center gap-2 text-base uppercase tracking-wider transition-all shadow-lg cursor-pointer"
              >
                Go to My Dashboard
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="w-full sm:w-auto h-14 px-10 rounded-2xl bg-primary text-on-primary font-display text-base font-bold uppercase tracking-wider transition-all shadow-lg hover:bg-on-primary-fixed-variant active:scale-95 flex items-center justify-center gap-2"
                >
                  Log In
                  <span className="material-symbols-outlined text-xl">login</span>
                </Link>
                <Link
                  to="/register"
                  className="w-full sm:w-auto h-14 px-10 rounded-2xl bg-white text-primary border-2 border-primary/40 hover:border-primary font-display text-base font-bold uppercase tracking-wider transition-all shadow-md hover:bg-primary/5 active:scale-95 flex items-center justify-center gap-2"
                >
                  Register Free
                  <span className="material-symbols-outlined text-xl">person_add</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* MEET DEX — Cartoon Voice Tutor Spotlight */}
      <section className="py-12 px-4 max-w-6xl mx-auto">
        <div className="stat-card stat-card-hover rounded-[36px] p-8 sm:p-12 border-2 border-secondary/30 bg-gradient-to-br from-white/90 via-amber-50/40 to-indigo-50/40 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-10">
          {/* Left Mascot Display */}
          <div className="flex flex-col items-center shrink-0">
            <DexAvatar
              state="celebrating"
              caption={`Hi there! I'm ${TUTOR_NAME}, your AI reading companion! Let's read stories and master words together!`}
              size="lg"
              showCaptionBubble={true}
            />
          </div>

          {/* Right Spotlight Content */}
          <div className="space-y-6 max-w-xl text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-secondary-container/30 text-secondary font-display text-xs font-bold uppercase tracking-widest">
              <span className="material-symbols-outlined text-base">face_5</span>
              Meet Your AI Companion
            </div>

            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-on-surface leading-tight">
              Interactive Voice Reading with <span className="text-secondary">{TUTOR_NAME}</span>
            </h2>

            <p className="font-body text-base text-on-surface-variant leading-relaxed student-text">
              {TUTOR_NAME} acts like an interactive cartoon tutor that listens, speaks, and reacts to students in real-time. With expressional victory dances, soothing narration, and instant line repeat evaluation, {TUTOR_NAME} makes learning to read fun and stress-free!
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="stat-card stat-card-hover p-4 border border-white/80 shadow-xs flex items-start gap-3 text-left">
                <span className="material-symbols-outlined text-secondary text-2xl">auto_stories</span>
                <div>
                  <h4 className="font-display text-sm font-bold text-on-surface">Line-by-Line Pacing</h4>
                  <p className="font-body text-xs text-on-surface-variant student-text">Dex reads each line aloud, then listens continuously as students repeat it.</p>
                </div>
              </div>

              <div className="stat-card stat-card-hover p-4 border border-white/80 shadow-xs flex items-start gap-3 text-left">
                <span className="material-symbols-outlined text-emerald-600 text-2xl">record_voice_over</span>
                <div>
                  <h4 className="font-display text-sm font-bold text-on-surface">Soothing Female Voice</h4>
                  <p className="font-body text-xs text-on-surface-variant student-text">Warm, clear educational narration designed specifically for young learners.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                to={isAuthenticated ? "/stories" : "/login"}
                className="px-8 py-3.5 rounded-2xl bg-secondary text-on-secondary font-display text-sm font-bold uppercase tracking-wider shadow-md hover:bg-secondary-container hover:text-on-secondary-container transition-all active:scale-95 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">play_arrow</span>
                Read Stories with {TUTOR_NAME}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-12 border-t border-surface-variant/40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-extrabold text-on-surface">Why Decodex Works</h2>
            <p className="font-body text-base text-on-surface-variant mt-2 student-text">Built on proven structured literacy and speech-processing technology</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stat-card stat-card-hover rounded-3xl p-8 border border-white/80 flex flex-col justify-between" style={{ borderLeftColor: 'var(--color-primary)' }}>
              <div>
                <div className="w-14 h-14 rounded-2xl bg-primary-container/20 text-primary flex items-center justify-center mb-6 shadow-inner">
                  <span className="material-symbols-outlined text-3xl">mic</span>
                </div>
                <h3 className="font-display text-xl font-bold text-on-surface mb-3">Real-Time Speech STT Engine</h3>
                <p className="font-body text-on-surface-variant text-sm leading-relaxed student-text">
                  Students read aloud into the microphone. Decodex aligns speech to target text, calculating exact Words Per Minute (WPM) and word mispronunciations.
                </p>
              </div>
            </div>

            <div className="stat-card stat-card-hover rounded-3xl p-8 border border-white/80 flex flex-col justify-between" style={{ borderLeftColor: 'var(--color-secondary)' }}>
              <div>
                <div className="w-14 h-14 rounded-2xl bg-secondary-container/30 text-secondary flex items-center justify-center mb-6 shadow-inner">
                  <span className="material-symbols-outlined text-3xl">psychology</span>
                </div>
                <h3 className="font-display text-xl font-bold text-on-surface mb-3">Orton-Gillingham Taxonomy</h3>
                <p className="font-body text-on-surface-variant text-sm leading-relaxed student-text">
                  Classifies errors into clinical categories (Reversals like b/d, Substitutions, Omissions, Insertions, Blend Breakdowns) powered by Groq LLM intelligence.
                </p>
              </div>
            </div>

            <div className="stat-card stat-card-hover rounded-3xl p-8 border border-white/80 flex flex-col justify-between" style={{ borderLeftColor: 'var(--risk-excellent-border)' }}>
              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-6 shadow-inner">
                  <span className="material-symbols-outlined text-3xl">calendar_month</span>
                </div>
                <h3 className="font-display text-xl font-bold text-on-surface mb-3">20-Day Interactive Plans</h3>
                <p className="font-body text-on-surface-variant text-sm leading-relaxed student-text">
                  Generates personalized, non-repeating daily activities with Web Speech API audio read-aloud and live voice validation for guaranteed accuracy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (3 Steps) */}
      <section className="py-12 bg-white/40 rounded-3xl border border-white/60 shadow-sm my-8">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl font-extrabold text-on-surface mb-2">How Decodex Operates</h2>
          <p className="font-body text-base text-on-surface-variant mb-10 student-text">Three simple steps to personalized reading growth</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-primary/20" style={{ zIndex: 0 }} />
            
            <div className="flex flex-col items-center text-center relative" style={{ zIndex: 1 }}>
              <div className="w-12 h-12 rounded-full bg-primary text-on-primary font-display text-xl font-bold flex items-center justify-center mb-4 shadow-md">
                1
              </div>
              <h4 className="font-display text-lg font-bold text-on-surface mb-2">Take Reading Assessment</h4>
              <p className="font-body text-xs text-on-surface-variant leading-relaxed student-text">
                Student reads Grade-level passages aloud. Live speech alignment records baseline accuracy and speed.
              </p>
            </div>

            <div className="flex flex-col items-center text-center relative" style={{ zIndex: 1 }}>
              <div className="w-12 h-12 rounded-full bg-primary text-on-primary font-display text-xl font-bold flex items-center justify-center mb-4 shadow-md">
                2
              </div>
              <h4 className="font-display text-lg font-bold text-on-surface mb-2">Reading Risk Screening</h4>
              <p className="font-body text-xs text-on-surface-variant leading-relaxed student-text">
                Parents & teachers view preliminary dyslexia risk reports, error profiles, and legal action guidelines.
              </p>
            </div>

            <div className="flex flex-col items-center text-center relative" style={{ zIndex: 1 }}>
              <div className="w-12 h-12 rounded-full bg-primary text-on-primary font-display text-xl font-bold flex items-center justify-center mb-4 shadow-md">
                3
              </div>
              <h4 className="font-display text-lg font-bold text-on-surface mb-2">Follow 20-Day Path</h4>
              <p className="font-body text-xs text-on-surface-variant leading-relaxed student-text">
                Student completes daily voice activities and fresh AI stories with {TUTOR_NAME}, advancing step-by-step.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA with Dex */}
      <section className="py-12 text-center">
        <div className="stat-card stat-card-hover rounded-3xl p-8 sm:p-12 border border-white/80 max-w-3xl mx-auto shadow-lg" style={{ borderLeftColor: 'var(--color-secondary)' }}>
          <DexAvatar state="idle" size="sm" showCaptionBubble={true} caption={encouragementMessages[msgIndex]} className="mx-auto mb-4" />
          <h2 className="font-display text-3xl font-extrabold text-on-surface mb-3">Ready to Help Every Child Read?</h2>
          <p className="font-body text-base text-on-surface-variant mb-6 student-text">
            Get started in seconds with personalized reading screening and {TUTOR_NAME}.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-primary text-on-primary font-display text-sm font-bold uppercase tracking-wider transition-all shadow-md hover:bg-on-primary-fixed-variant flex items-center justify-center gap-2"
            >
              Log In to Decodex
            </Link>
            <Link
              to="/register"
              className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-white text-primary border border-primary/40 font-display text-sm font-bold uppercase tracking-wider transition-all hover:bg-primary/5 flex items-center justify-center gap-2"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>

      <EducationalDisclaimer className="mt-8" />
    </div>
  );
}