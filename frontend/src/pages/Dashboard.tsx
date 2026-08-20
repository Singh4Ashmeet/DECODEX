import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch, useApiQuery } from '../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { Skeleton } from '../components/Skeleton';
import DexAvatar from '../components/DexAvatar';
import { TUTOR_NAME } from '../lib/constants';
import { HealthScoreGauge } from '../components/HealthScoreGauge';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [consentStatus, setConsentStatus] = useState<{ invite_code: string | null; consent_granted: boolean; consent_date: string | null; pending_parent_name?: string | null; pending_parent_email?: string | null } | null>(null);
  const [approving, setApproving] = useState(false);

  // Encouragement message rotation state (must be before early returns)
  const encouragementMessages = [
    "Every word you read makes you stronger! 💪",
    "You're building a reading superpower! 🦸‍♀️",
    "Small steps every day lead to big victories! 🌟",
    "Your brain grows with every story! 🧠✨",
    "Keep going — you're doing amazing! 🎉",
  ];
  const [encouragementIndex, setEncouragementIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setEncouragementIndex(prev => (prev + 1) % encouragementMessages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [encouragementMessages.length]);

  const { data: trendsData, loading } = useApiQuery<any>('/analytics/student/trends');
  const { data: healthData } = useApiQuery<any>(user?.role === 'student' ? `/health-score/${user?.id}` : '/health-score/skip');
  const { data: gamData } = useApiQuery<any>(user?.role === 'student' ? `/gamification/${user?.id}/profile` : '/gamification/skip');
  const { data: pathData } = useApiQuery<any>(user?.role === 'student' ? `/learning-paths/${user?.id}` : '/learning-paths/skip');
  const { data: achievementData } = useApiQuery<any>(user?.role === 'student' ? `/gamification/${user?.id}/achievements` : '/gamification/skip');
  const { data: assignmentData, refetch: refetchAssignments } = useApiQuery<any>(user?.role === 'student' ? '/assignments/student/me' : '/assignments/skip');

  const healthScore = healthData?.healthScore;
  const gamProfile = gamData?.profile;
  const learningPath = pathData?.learningPath;
  const achievements = achievementData?.achievements || [];
  const earnedAchievements = achievements.filter((a: any) => a.earned);
  const assignedPractice = assignmentData?.assignments || [];

  const fetchConsentStatus = useCallback(() => {
    if (user?.role !== 'student') return;
    apiFetch<{ invite_code: string | null; consent_granted: boolean; consent_date: string | null; pending_parent_name?: string | null; pending_parent_email?: string | null }>('/students/me/consent-status')
      .then(setConsentStatus)
      .catch(() => setConsentStatus(null));
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'student') {
      fetchConsentStatus();
    }
  }, [user?.role, fetchConsentStatus]);

  if (user?.role === 'parent') {
    return <Navigate to="/parent/home" replace />;
  }
  if (user?.role === 'teacher') {
    return <Navigate to="/teacher/dashboard" replace />;
  }

  const handleRequestConsentEmail = async () => {
    setApproving(true);
    try {
      await apiFetch('/consent/request', { method: 'POST', body: JSON.stringify({ student_id: user!.id }) });
      fetchConsentStatus();
    } catch (err) {
      console.error('Failed to request consent email', err);
    } finally {
      setApproving(false);
    }
  };

  const handleStartAssignment = async (assignment: any) => {
    try {
      const result = await apiFetch<{ session: { id: string; passage_id: string } }>(`/assignments/${assignment.assignment_id}/start`, { method: 'POST' });
      refetchAssignments();
      navigate(`/session/${result.session.passage_id}?sessionId=${result.session.id}`);
    } catch (startError) {
      console.error('Failed to start assignment', startError);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      }
    }
  };

  const bouncyItemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 15
      }
    }
  };

  return (
    <motion.main 
      initial="hidden" 
      animate="show" 
      variants={containerVariants}
      className="flex-grow w-full max-w-[1000px] mx-auto px-container-padding py-8 sm:py-12 relative z-10"
    >
      <motion.section variants={bouncyItemVariants} className="mb-8 sm:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <DexAvatar state="idle" size="sm" showCaptionBubble={false} />
          <div>
            <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold text-primary mb-2">
              Welcome back, {user?.display_name}! 🌟
            </h1>
            <p className="font-body text-base sm:text-xl text-on-surface-variant student-text">Ready to grow your reading skills today?</p>
          </div>
        </div>
        {gamProfile && (
          <div className="inline-flex items-center gap-3 glass-card px-4 py-2 rounded-full border border-primary/20 w-max">
            <span className="material-symbols-outlined text-primary text-sm">star</span>
            <span className="font-display text-xs font-bold tracking-[0.06em] text-on-surface">Level {gamProfile.level}</span>
            <span className="text-on-surface-variant">•</span>
            <span className="font-display text-xs font-bold tracking-[0.06em] text-primary">{gamProfile.xp} XP</span>
            {gamProfile.currentStreak > 0 && (
              <>
                <span className="text-on-surface-variant">•</span>
                <span className="font-display text-xs font-bold text-amber-600">🔥 {gamProfile.currentStreak} day streak</span>
              </>
            )}
          </div>
        )}
      </motion.section>

      {/* Dex Companion Banner — persistent warm anchor */}
      {user?.role === 'student' && (
        <motion.section variants={bouncyItemVariants} className="mb-8 p-6 rounded-3xl bg-gradient-to-br from-white/95 via-blue-50/60 to-indigo-50/60 border-2 border-blue-200/50 shadow-[0_8px_32px_rgba(37,99,235,0.12)] flex flex-col lg:flex-row items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left flex-wrap md:flex-nowrap relative z-10">
            <DexAvatar
              state="idle"
              size="md"
              showCaptionBubble={false}
            />
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/30 text-secondary font-display text-[10px] font-bold uppercase tracking-wider mb-2">
                <span className="material-symbols-outlined text-xs">auto_awesome</span>
                Your AI Voice Companion
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-on-surface">
                Hi {user.display_name.split(' ')[0]}! I'm {TUTOR_NAME}!
              </h2>
              <p className="font-body text-sm text-on-surface-variant mt-1 max-w-md student-text">
                {encouragementMessages[encouragementIndex]}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0 relative z-10">
            <Link
              to="/stories"
              className="w-full sm:w-auto h-12 px-8 rounded-full btn-clay flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-lg">auto_stories</span>
              Read with {TUTOR_NAME}
            </Link>
          </div>
        </motion.section>
      )}

      {/* Consent banner */}
      {user?.role === 'student' && consentStatus && !consentStatus.consent_granted && consentStatus.pending_parent_name ? (
        <motion.section variants={bouncyItemVariants} className="mb-8 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 font-display text-xs font-bold uppercase tracking-wider mb-2">
              <span className="material-symbols-outlined text-sm">notifications_active</span> Pending Consent Request
            </span>
            <h2 className="font-display text-xl font-bold text-on-surface">Parent Linked: {consentStatus.pending_parent_name}</h2>
            <p className="font-body text-sm text-on-surface-variant mt-1">Your parent ({consentStatus.pending_parent_email}) linked to your account and requested voice recording consent.</p>
          </div>
          <button
            onClick={handleRequestConsentEmail}
            disabled={approving}
            className="h-12 px-8 rounded-full btn-clay flex items-center justify-center gap-2 text-sm uppercase tracking-[0.08em] disabled:opacity-60 flex-shrink-0 cursor-pointer"
          >
            {approving ? 'Sending Email…' : 'Send Consent Email to Parent'}
          </button>
        </motion.section>
      ) : null}

      {/* V2: Health Score + Gamification Hero Row */}
      {(user?.role === 'student' || user?.role === 'admin') && healthScore && (
        <motion.section variants={bouncyItemVariants} className="mb-10 grid gap-card-gap grid-cols-1 md:grid-cols-3">
          {/* Health Score Card */}
          <div className="stat-card stat-card-hover flex flex-col items-center text-center relative overflow-hidden" style={{ borderLeftColor: 'var(--color-primary)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <p className="stat-label relative z-10" style={{ color: 'var(--color-primary)' }}>Reading Health Score</p>
            <div className="relative z-10 mb-3">
              <HealthScoreGauge score={healthScore.score} riskLevel={healthScore.riskLevel} />
            </div>
            <div className="relative z-10">
              <p className="stat-sublabel text-on-surface-variant mt-3 student-text">
                {healthScore.score >= 75 ? 'Great progress! Keep it up.' : healthScore.score >= 50 ? 'You\'re improving! Practice daily.' : 'Let\'s work on building your skills.'}
              </p>
            </div>
          </div>

          {/* XP & Level Card */}
          {gamProfile && (
            <div className="stat-card stat-card-hover flex flex-col relative overflow-hidden" style={{ borderLeftColor: 'var(--color-secondary)' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent" />
              <p className="stat-label relative z-10" style={{ color: 'var(--color-secondary)' }}>Your Progress</p>
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center shadow-inner">
                  <span className="material-symbols-outlined text-2xl text-primary" style={{fontVariationSettings: "'FILL' 1"}}>military_tech</span>
                </div>
                <div>
                  <p className="stat-value text-primary">Level {gamProfile.level}</p>
                  <p className="stat-sublabel text-on-surface-variant">{gamProfile.xpToNextLevel} XP to next level</p>
                </div>
              </div>
              {/* XP Progress Bar */}
              <div className="w-full bg-surface-container-high h-3 rounded-full overflow-hidden mb-4 relative z-10">
                <div
                  className="progress-bar-fill bg-gradient-to-r from-primary to-primary/60"
                  style={{ width: `${gamProfile.levelProgress}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center relative z-10">
                <div className="p-2 rounded-xl bg-primary-container/10">
                  <p className="font-display text-lg font-bold text-on-surface">{gamProfile.totalSessions}</p>
                  <p className="font-body text-[10px] text-on-surface-variant uppercase tracking-wider">Sessions</p>
                </div>
                <div className="p-2 rounded-xl bg-secondary-container/10">
                  <p className="font-display text-lg font-bold text-on-surface">{gamProfile.totalDrillsCompleted}</p>
                  <p className="font-body text-[10px] text-on-surface-variant uppercase tracking-wider">Drills</p>
                </div>
                <div className="p-2 rounded-xl bg-amber-100">
                  <p className="font-display text-lg font-bold text-amber-700">{gamProfile.currentStreak}</p>
                  <p className="font-body text-[10px] text-on-surface-variant uppercase tracking-wider">Day Streak</p>
                </div>
              </div>
            </div>
          )}

          {/* Achievements Showcase */}
          <div className="stat-card stat-card-hover flex flex-col relative overflow-hidden" style={{ borderLeftColor: 'var(--risk-excellent-border)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald/5 to-transparent" />
            <p className="stat-label relative z-10" style={{ color: 'var(--risk-excellent-border)' }}>Achievements</p>
            {earnedAchievements.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 flex-grow relative z-10">
                {earnedAchievements.slice(0, 6).map((ach: any) => (
                  <div key={ach.id} className="flex flex-col items-center text-center p-2 rounded-xl bg-primary-container/10 hover:bg-primary-container/20 hover:scale-105 transition-all duration-200 cursor-pointer">
                    <span className="material-symbols-outlined text-2xl text-primary mb-1" style={{fontVariationSettings: "'FILL' 1"}}>{ach.icon}</span>
                    <span className="font-display text-[9px] font-bold text-on-surface leading-tight">{ach.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center text-center relative z-10">
                <DexAvatar state="celebrating" size="sm" showCaptionBubble={false} />
                <p className="font-body text-sm text-on-surface-variant mt-2 student-text">Complete sessions to earn badges!</p>
              </div>
            )}
            {achievements.length > 0 && (
              <p className="font-body text-xs text-on-surface-variant mt-3 text-center relative z-10">{earnedAchievements.length} / {achievements.length} earned</p>
            )}
          </div>
        </motion.section>
      )}

      {/* Learning Path Preview */}
      {(user?.role === 'student' || user?.role === 'admin') && learningPath && (
        <motion.section variants={bouncyItemVariants} className="mb-10">
          <div className="stat-card stat-card-hover">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center shadow-inner">
                  <span className="material-symbols-outlined text-xl text-primary" style={{fontVariationSettings: "'FILL' 1"}}>route</span>
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-on-surface">{learningPath.title}</p>
                  <p className="font-body text-xs text-on-surface-variant">Week {learningPath.currentWeek} of {learningPath.totalWeeks}</p>
                </div>
              </div>
              <Link to="/learning-path" className="text-primary font-display text-xs font-bold uppercase tracking-wider hover:underline">View Plan →</Link>
            </div>
            {/* Mini progress bar — connected pills with clearer state colors */}
            <div className="flex gap-1.5 relative">
              {learningPath.weeks?.map((week: any, i: number) => (
                <div
                  key={i}
                  className={`flex-1 h-2.5 rounded-full transition-all duration-300 relative ${
                    week.completed ? 'bg-emerald-500' : i + 1 === learningPath.currentWeek ? 'bg-primary animate-pulse' : 'bg-surface-container-high'
                  }`}
                />
              ))}
              {/* Connector line between pills */}
              <div className="absolute top-1/2 -translate-y-1/2 w-full h-0.5 bg-surface-container-high pointer-events-none" style={{ zIndex: -1 }} />
            </div>
          </div>
        </motion.section>
      )}

      {/* Consent + Invite Section */}
      {user?.role === 'student' && consentStatus ? (
        <motion.section variants={bouncyItemVariants} className="mb-10 grid gap-4 md:grid-cols-[1.1fr_1fr]">
          <div className="stat-card stat-card-hover">
            <p className="stat-label" style={{ color: 'var(--color-secondary)' }}>Share with a parent</p>
            <p className="font-body text-on-surface-variant mt-2 student-text">Ask a parent to enter this invite code in their Decodex account.</p>
            <p className="mt-4 inline-block rounded-2xl bg-white/90 shadow-sm border border-primary/20 px-4 py-3 font-display text-xl font-bold tracking-[0.12em] text-primary">{consentStatus.invite_code || 'Invite code unavailable'}</p>
          </div>
          <div className={`stat-card stat-card-hover ${consentStatus.consent_granted ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
            <p className="stat-label" style={{ color: consentStatus.consent_granted ? 'var(--risk-excellent-border)' : 'var(--risk-medium-border)' }}>Recording consent</p>
            <p className="font-body text-lg mt-2 student-text">{consentStatus.consent_granted ? 'Parent consent is confirmed. Recording is ready when you are.' : 'Recording is locked until a parent confirms consent.'}</p>
          </div>
        </motion.section>
      ) : null}

      {user?.role === 'student' && assignedPractice.length > 0 && (
        <motion.section variants={bouncyItemVariants} className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-on-surface">Assigned Practice</h2>
              <p className="font-body text-sm text-on-surface-variant mt-1 student-text">Reading work your teacher has shared with you.</p>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary" aria-hidden="true">assignment</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignedPractice.map((assignment: any) => {
              const completed = assignment.status === 'completed' || assignment.status === 'late';
              const statusConfig = completed 
                ? { badge: 'risk-excellent', border: 'var(--risk-excellent-border)' }
                : assignment.status === 'in_progress'
                ? { badge: 'bg-primary/10 text-primary border-primary/30', border: 'var(--color-primary)' }
                : { badge: 'risk-medium', border: 'var(--risk-medium-border)' };
              return (
                <article key={assignment.id} className={`glass-card stat-card-hover border-l-4 p-5 shadow-sm flex flex-col gap-4`} style={{ borderLeftColor: statusConfig.border }}>
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-bold text-on-surface">{assignment.title}</h3>
                      <span className={`font-display text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${typeof statusConfig.badge === 'string' && statusConfig.badge.startsWith('risk-') ? `badge-risk ${statusConfig.badge}` : statusConfig.badge}`}>{completed ? 'Complete' : assignment.status.replace('_', ' ')}</span>
                    </div>
                    <p className="font-body text-sm text-on-surface-variant mt-2 student-text">{assignment.passage_title}</p>
                    {assignment.instructions && <p className="font-body text-sm text-on-surface-variant mt-2 student-text">{assignment.instructions}</p>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-body text-on-surface-variant student-text">
                    <span>{assignment.due_date ? `Due ${new Date(assignment.due_date).toLocaleDateString()}` : 'No due date'}</span>
                    {completed && assignment.score != null && <span>Score {assignment.score}/100</span>}
                    {completed && assignment.reward_xp > 0 && <span>+{assignment.reward_xp} XP</span>}
                  </div>
                  {completed ? (
                    <Link to={`/sessions/${assignment.session_id}/results`} className="inline-flex items-center justify-center gap-2 border border-primary text-primary px-4 py-2.5 rounded-xl font-display text-sm font-bold hover:bg-primary/5 transition-colors">
                      View results <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </Link>
                  ) : (
                    <button onClick={() => handleStartAssignment(assignment)} className="inline-flex items-center justify-center gap-2 btn-clay px-4 py-2.5 rounded-xl font-display text-sm font-bold">
                      {assignment.status === 'in_progress' ? 'Continue assignment' : 'Start assignment'} <span className="material-symbols-outlined text-lg">play_arrow</span>
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Action Cards — with Dex companion as persistent sidebar on desktop */}
      <motion.section variants={containerVariants} className="relative mb-12 sm:mb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-card-gap">
          <motion.div variants={bouncyItemVariants}>
            <Link to="/passages" className="h-full stat-card stat-card-hover flex flex-col items-center text-center group focus:outline-none focus:ring-4 focus:ring-primary/20" style={{ borderLeftColor: 'var(--color-primary)' }}>
              <div className="stat-icon bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>book</span>
              </div>
              <h2 className="font-display text-xl font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">Start Reading</h2>
              <p className="font-body text-sm text-on-surface-variant student-text">Choose a passage and read aloud.</p>
            </Link>
          </motion.div>

          <motion.div variants={bouncyItemVariants}>
            <Link to="/stories" className="h-full stat-card stat-card-hover flex flex-col items-center text-center group focus:outline-none focus:ring-4 focus:ring-secondary/20" style={{ borderLeftColor: 'var(--color-secondary)' }}>
              <div className="stat-icon bg-secondary/10 text-secondary">
                <span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>auto_stories</span>
              </div>
              <h2 className="font-display text-xl font-bold text-on-surface mb-1 group-hover:text-secondary transition-colors">AI Stories</h2>
              <p className="font-body text-sm text-on-surface-variant student-text">Practice with stories made for you.</p>
            </Link>
          </motion.div>

          <motion.div variants={bouncyItemVariants}>
            <Link to="/learning-path" className="h-full stat-card stat-card-hover flex flex-col items-center text-center group focus:outline-none focus:ring-4 focus:ring-primary/20" style={{ borderLeftColor: 'var(--color-accent)' }}>
              <div className="stat-icon bg-accent/10 text-accent">
                <span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>route</span>
              </div>
              <h2 className="font-display text-xl font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">Learning Path</h2>
              <p className="font-body text-sm text-on-surface-variant student-text">Follow your personalized plan.</p>
            </Link>
          </motion.div>

          {/* Dex Companion — persistent sidebar on desktop, card on mobile */}
          <motion.div variants={bouncyItemVariants} className="hidden lg:flex flex-col items-center justify-center gap-4 p-4 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-3xl border border-primary/10 stat-card-hover">
            <DexAvatar state="idle" size="md" showCaptionBubble={true} caption={encouragementMessages[encouragementIndex]} />
            <p className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant text-center">Your Reading Buddy</p>
          </motion.div>
        </div>
        
        {/* Mobile Dex Companion */}
        <div className="lg:hidden mt-4">
          <motion.div variants={bouncyItemVariants} className="stat-card stat-card-hover p-4 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-3xl border border-primary/10">
            <div className="flex items-center justify-center gap-4">
              <DexAvatar state="idle" size="sm" showCaptionBubble={true} caption={encouragementMessages[encouragementIndex]} />
              <p className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant text-center">Your Reading Buddy</p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Progress Charts */}
      {(user?.role === 'student' || user?.role === 'admin') && (
        <motion.section variants={bouncyItemVariants} className="mb-16">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-on-surface mb-8">Your Progress</h2>
          
          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-card-gap">
              <div className="stat-card stat-card-hover flex flex-col h-80">
                <Skeleton className="h-full w-full" />
              </div>
              <div className="stat-card stat-card-hover flex flex-col h-80">
                <Skeleton className="h-full w-full" />
              </div>
            </div>
          ) : trendsData?.trends && trendsData.trends.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-card-gap">
              <div className="stat-card stat-card-hover flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-display text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Reading Speed (WPM)</h3>
                  <span className="material-symbols-outlined text-primary">trending_up</span>
                </div>
                <div className="flex-grow h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsData.trends.map((t: any, i: number) => ({ name: `S${i+1}`, wpm: t.words_per_minute != null ? Math.round(t.words_per_minute) : 0 }))}>
                      <defs>
                        <linearGradient id="wpmGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1d8d4" strokeOpacity={0.3} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6f797c', fontFamily: 'var(--font-display)'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#6f797c', fontFamily: 'var(--font-display)'}} />
                      <Tooltip contentStyle={{ borderRadius: '16px', background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(255, 255, 255, 0.8)', boxShadow: '0 8px 24px rgba(45, 41, 38, 0.1)', fontFamily: 'var(--font-body)' }} />
                      <Area type="monotone" dataKey="wpm" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#wpmGradient)" />
                      <Line type="monotone" dataKey="wpm" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-primary)' }} activeDot={{ r: 6, fill: 'var(--color-primary)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="stat-card stat-card-hover flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-display text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Error Rate (%)</h3>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-tertiary)' }}>trending_down</span>
                </div>
                <div className="flex-grow h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsData.trends.map((t: any, i: number) => ({ name: `S${i+1}`, errorRate: Math.round(t.error_rate * 100) }))}>
                      <defs>
                        <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-tertiary)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--color-tertiary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1d8d4" strokeOpacity={0.3} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6f797c', fontFamily: 'var(--font-display)'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#6f797c', fontFamily: 'var(--font-display)'}} />
                      <Tooltip contentStyle={{ borderRadius: '16px', background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(255, 255, 255, 0.8)', boxShadow: '0 8px 24px rgba(45, 41, 38, 0.1)', fontFamily: 'var(--font-body)' }} />
                      <Area type="monotone" dataKey="errorRate" stroke="var(--color-tertiary)" strokeWidth={3} fillOpacity={1} fill="url(#errorGradient)" />
                      <Line type="monotone" dataKey="errorRate" stroke="var(--color-tertiary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-tertiary)' }} activeDot={{ r: 6, fill: 'var(--color-tertiary)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="stat-card stat-card-hover text-center flex flex-col items-center justify-center">
              <DexAvatar state="concerned" size="lg" showCaptionBubble={false} />
              <h3 className="font-display text-2xl font-bold text-on-surface mb-2">No sessions yet</h3>
              <p className="font-body text-lg text-on-surface-variant student-text">Click "Start Reading" above to begin your journey!</p>
            </div>
          )}
        </motion.section>
      )}
    </motion.main>
  );
}