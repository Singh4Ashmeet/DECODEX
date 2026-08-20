import { query } from '../db';
import { awardXP } from './gamification';
import { runRiskScreening } from './riskScreening';

// ---------------------------------------------------------------------------
// Learning Path Generator — Personalized, Day-by-Day Interactive Plans
// Dynamically scales difficulty step-by-step based on student growth trend.
// (Accelerates level if improving, degrades difficulty for support if struggling)
// ---------------------------------------------------------------------------

export const REQUIRED_SESSIONS_FOR_PLAN = 2;

export interface DayTask {
  dayNumber: number;
  title: string;
  activityType: 'drill' | 'story' | 'reading' | 'phonics';
  description: string;
  targetSkill: string;
  targetUrl: string;
  actionLabel: string;
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string | null;
}

export interface LearningWeek {
  id: string;
  weekNumber: number;
  focusArea: string;
  description: string;
  days: DayTask[];
  completed: boolean;
  completedAt: string | null;
}

export interface LearningPathResult {
  id: string;
  title: string;
  totalWeeks: number;
  currentWeek: number;
  status: string;
  planSummary: string;
  canGenerate: boolean;
  completedSessionsCount: number;
  requiredSessionsCount: number;
  riskLevel: 'low' | 'medium' | 'high';
  stageNumber: number;
  trackMode: string;
  weeks: LearningWeek[];
}

const CATEGORY_SKILL_MAP: Record<string, { title: string; skill: string; focus: string }> = {
  REV: { title: 'Visual Discrimination (b/d, p/q)', skill: 'REV', focus: 'Letter Reversals' },
  BLD: { title: 'Phoneme Blending & Clusters', skill: 'BLD', focus: 'Blend Breakdowns' },
  SUB: { title: 'Sight Word & Pattern Mastery', skill: 'SUB', focus: 'Word Substitutions' },
  OMI: { title: 'Tracking & Precise Word Reading', skill: 'OMI', focus: 'Word Omissions' },
  INS: { title: 'Exact Match & Insertion Prevention', skill: 'INS', focus: 'Word Insertions' },
  PAC: { title: 'Fluency, Pacing & Self-Correction', skill: 'PAC', focus: 'Pacing Issues' },
};

/**
 * Check how many completed sessions a student has.
 */
export async function getCompletedSessionsCount(studentId: string): Promise<number> {
  const res = await query(
    `SELECT COUNT(*) as cnt FROM reading_sessions
     WHERE student_id = $1 AND status = 'completed' AND deleted_at IS NULL`,
    [studentId]
  );
  return parseInt(res.rows[0]?.cnt || '0', 10);
}

/**
 * Generate a personalized 4-week, 20-day interactive learning path.
 * Evaluates student's growth trend to step-by-step accelerate or degrade difficulty.
 */
export async function generateLearningPath(studentId: string): Promise<LearningPathResult> {
  const sessionCount = await getCompletedSessionsCount(studentId);

  if (sessionCount < REQUIRED_SESSIONS_FOR_PLAN) {
    const error: any = new Error(
      `At least ${REQUIRED_SESSIONS_FOR_PLAN} completed reading assessment sessions are required before generating a personalized learning path. (Current: ${sessionCount}/${REQUIRED_SESSIONS_FOR_PLAN})`
    );
    error.code = 'INSUFFICIENT_SESSIONS';
    error.details = { current: sessionCount, required: REQUIRED_SESSIONS_FOR_PLAN };
    throw error;
  }

  // 1. Determine Stage Number based on past paths
  const prevPathsRes = await query(
    `SELECT COUNT(*) as cnt FROM learning_paths WHERE student_id = $1`,
    [studentId]
  );
  const stageNumber = parseInt(prevPathsRes.rows[0]?.cnt || '0', 10) + 1;

  // 2. Run Risk Screening & Calculate Growth Trend
  const screening = await runRiskScreening(studentId);
  const riskLevel = screening.risk; // 'low' | 'medium' | 'high'

  const sessionsRes = await query(
    `SELECT rs.words_per_minute, ep.error_rate, ep.total_errors, ep.total_words_read
     FROM reading_sessions rs
     JOIN error_profiles ep ON ep.session_id = rs.id
     WHERE rs.student_id = $1 AND rs.status = 'completed' AND rs.deleted_at IS NULL
     ORDER BY rs.started_at ASC`,
    [studentId]
  );
  const sessions = sessionsRes.rows;

  let initialWpm = 0;
  let recentWpm = 0;
  let initialErrorRate = 0;
  let recentErrorRate = 0;

  if (sessions.length >= 2) {
    initialWpm = parseFloat(sessions[0].words_per_minute || '0');
    recentWpm = parseFloat(sessions[sessions.length - 1].words_per_minute || '0');
    initialErrorRate = parseFloat(sessions[0].error_rate || '0');
    recentErrorRate = parseFloat(sessions[sessions.length - 1].error_rate || '0');
  }

  const wpmGrowth = recentWpm - initialWpm;
  const errorReduction = initialErrorRate - recentErrorRate;

  // Determine Adaptive Track Mode
  let trackMode = 'Steady Mastery Track';
  let levelAdjustment = 0;

  if (wpmGrowth >= 5 || errorReduction > 0.02 || (riskLevel === 'low' && sessionCount >= 3)) {
    trackMode = 'Accelerated Track (+1 Level)';
    levelAdjustment = 1;
  } else if (wpmGrowth < 0 || errorReduction < -0.02 || riskLevel === 'high') {
    trackMode = 'High-Support Track (Foundational)';
    levelAdjustment = -1;
  }

  // 3. Aggregate error profile
  const errorRes = await query(
    `SELECT
       SUM(rev_count) as rev, SUM(sub_count) as sub,
       SUM(omi_count) as omi, SUM(ins_count) as ins,
       SUM(bld_count) as bld, SUM(pac_count) as pac,
       AVG(words_per_minute) as avg_wpm
     FROM error_profiles ep
     JOIN reading_sessions rs ON rs.id = ep.session_id
     WHERE ep.student_id = $1 AND rs.status = 'completed' AND rs.deleted_at IS NULL`,
    [studentId]
  );
  const errors = errorRes.rows[0] || {};
  const avgWpm = Math.round(parseFloat(errors.avg_wpm || '0'));

  const errorCounts: Array<[string, number]> = [
    ['REV', Number(errors.rev || 0)],
    ['BLD', Number(errors.bld || 0)],
    ['SUB', Number(errors.sub || 0)],
    ['OMI', Number(errors.omi || 0)],
    ['INS', Number(errors.ins || 0)],
    ['PAC', Number(errors.pac || 0)],
  ];
  errorCounts.sort((a, b) => b[1] - a[1]);

  const primaryCategory = errorCounts[0][1] > 0 ? errorCounts[0][0] : 'SUB';
  const secondaryCategory = errorCounts[1][1] > 0 ? errorCounts[1][0] : 'BLD';

  const studentRes = await query(`SELECT display_name, grade_level FROM users WHERE id = $1`, [studentId]);
  const studentName = studentRes.rows[0]?.display_name || 'Student';
  const baseGradeLevel = studentRes.rows[0]?.grade_level || 3;
  const effectiveGradeLevel = Math.max(1, Math.min(6, baseGradeLevel + levelAdjustment));

  const primaryMeta = CATEGORY_SKILL_MAP[primaryCategory] || CATEGORY_SKILL_MAP['SUB'];
  const secondaryMeta = CATEGORY_SKILL_MAP[secondaryCategory] || CATEGORY_SKILL_MAP['BLD'];

  const title = `Stage ${stageNumber}: ${studentName}'s Reading Curriculum (${trackMode})`;

  const planSummary = `Stage ${stageNumber} Plan for ${studentName} (Grade ${effectiveGradeLevel}, ${trackMode}, ${sessionCount} sessions analyzed). ` +
    `Targeting ${primaryMeta.focus} (${errorCounts[0][1]} errors) and ${secondaryMeta.focus} (${errorCounts[1][1]} errors). Average speed: ${avgWpm} WPM. ` +
    `Daily Practice Rule: You must practice reading every single day — if not an entire story, reading even a small part or a few 3-4 word phrases of a story daily will continuously improve your reading skills!`;

  // Deactivate any old active paths
  await query(`UPDATE learning_paths SET status = 'paused', updated_at = NOW() WHERE student_id = $1 AND status = 'active'`, [studentId]);

  // Insert main path record
  const pathRes = await query(
    `INSERT INTO learning_paths (student_id, title, total_weeks, plan_summary)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [studentId, title, 4, planSummary]
  );
  const pathId = pathRes.rows[0].id;

  const weeks: LearningWeek[] = [];

  weeks.push(buildWeekData(pathId, 1, `Week 1: ${primaryMeta.title}`, `Focus on reducing ${primaryMeta.focus} errors using Orton-Gillingham techniques.`, primaryCategory, effectiveGradeLevel, riskLevel, levelAdjustment));
  weeks.push(buildWeekData(pathId, 2, `Week 2: ${secondaryMeta.title}`, `Address ${secondaryMeta.focus} patterns and strengthen core phonics.`, secondaryCategory, effectiveGradeLevel, riskLevel, levelAdjustment));
  weeks.push(buildWeekData(pathId, 3, 'Week 3: Fluency & Pacing Building', `Build reading speed toward Grade ${effectiveGradeLevel} benchmarks with repeated exposure.`, 'PAC', effectiveGradeLevel, riskLevel, levelAdjustment));
  weeks.push(buildWeekData(pathId, 4, 'Week 4: Mastery & Progress Assessment', 'Apply all learned strategies to new passages and complete progress re-assessment.', primaryCategory, effectiveGradeLevel, riskLevel, levelAdjustment));

  for (const week of weeks) {
    const weekRes = await query(
      `INSERT INTO learning_path_weeks (path_id, week_number, focus_area, description, exercises)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [pathId, week.weekNumber, week.focusArea, week.description, JSON.stringify(week.days)]
    );
    week.id = weekRes.rows[0].id;
  }

  return {
    id: pathId,
    title,
    totalWeeks: 4,
    currentWeek: 1,
    status: 'active',
    planSummary,
    canGenerate: true,
    completedSessionsCount: sessionCount,
    requiredSessionsCount: REQUIRED_SESSIONS_FOR_PLAN,
    riskLevel,
    stageNumber,
    trackMode,
    weeks,
  };
}

function buildWeekData(
  pathId: string,
  weekNum: number,
  title: string,
  description: string,
  category: string,
  grade: number,
  riskLevel: 'low' | 'medium' | 'high',
  levelAdjustment: number
): LearningWeek {
  const meta = CATEGORY_SKILL_MAP[category] || CATEGORY_SKILL_MAP['SUB'];
  const minutesMultiplier = riskLevel === 'high' ? 1.5 : riskLevel === 'medium' ? 1.2 : 1.0;
  const trackTag = levelAdjustment > 0 ? ' [Accelerated]' : levelAdjustment < 0 ? ' [High-Support]' : ' [Mastery]';

  let days: DayTask[] = [];

  if (weekNum === 1) {
    days = [
      {
        dayNumber: 1,
        title: `Day 1: ${meta.focus} ${levelAdjustment < 0 ? 'Foundation Tracing' : 'Multisensory Drill'}`,
        activityType: 'drill',
        description: levelAdjustment < 0
          ? `High-support multi-sensory tracing and explicit phoneme isolation for ${meta.focus}.`
          : `Advanced Orton-Gillingham letter tracing and phoneme isolation for ${meta.focus}.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Tracing Drill',
        estimatedMinutes: Math.round(10 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 2,
        title: `Day 2: Sound-by-Sound Blending Slider`,
        activityType: 'phonics',
        description: `Build words phoneme-by-phoneme using an interactive slider card.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Blending Slider',
        estimatedMinutes: Math.round(12 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 3,
        title: `Day 3: Visual Discrimination Card Sort`,
        activityType: 'drill',
        description: `Sort visually similar letter pairs (b/d, p/q, was/saw) with immediate audio feedback.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Card Sort',
        estimatedMinutes: Math.round(12 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 4,
        title: `Day 4: AI Adaptive Story Reading #1`,
        activityType: 'story',
        description: `Read a custom AI story generated for ${meta.focus} practice at Grade ${grade} level.`,
        targetSkill: meta.skill,
        targetUrl: '/stories',
        actionLabel: 'Read AI Story',
        estimatedMinutes: Math.round(14 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 5,
        title: `Day 5: Baseline Fluency & Speed Check`,
        activityType: 'reading',
        description: `Complete a reading assessment passage to record initial speed (WPM) and accuracy.`,
        targetSkill: 'MASTERY',
        targetUrl: '/passages',
        actionLabel: 'Take Reading Passage',
        estimatedMinutes: Math.round(15 * minutesMultiplier),
        completed: false,
      },
    ];
  } else if (weekNum === 2) {
    days = [
      {
        dayNumber: 1,
        title: `Day 1: Syllable Chunking & Segmenting`,
        activityType: 'drill',
        description: `Break complex words into prefix, root, and suffix syllables.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Syllable Drill',
        estimatedMinutes: Math.round(10 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 2,
        title: `Day 2: High-Frequency Sight Word Flashcards`,
        activityType: 'phonics',
        description: `Rapid 10-word flashcard drill to build instant sight-word recognition.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Flashcards',
        estimatedMinutes: Math.round(10 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 3,
        title: `Day 3: Consonant Cluster Sorting (str, spl, br)`,
        activityType: 'drill',
        description: `Identify and sort words by initial and final consonant clusters.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Cluster Drill',
        estimatedMinutes: Math.round(12 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 4,
        title: `Day 4: AI Adaptive Story Reading #2`,
        activityType: 'story',
        description: `Read a second custom AI story targeting phoneme confidence and speed.`,
        targetSkill: meta.skill,
        targetUrl: '/stories',
        actionLabel: 'Read AI Story',
        estimatedMinutes: Math.round(12 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 5,
        title: `Day 5: Timed Fluency Passage Assessment`,
        activityType: 'reading',
        description: `Read a fresh passage to measure WPM speed improvement and error reduction.`,
        targetSkill: 'MASTERY',
        targetUrl: '/passages',
        actionLabel: 'Take Passage Test',
        estimatedMinutes: Math.round(15 * minutesMultiplier),
        completed: false,
      },
    ];
  } else if (weekNum === 3) {
    days = [
      {
        dayNumber: 1,
        title: `Day 1: Phrase Boundary & Pacing Practice`,
        activityType: 'drill',
        description: `Read pre-marked phrase chunks to develop smooth natural reading rhythm.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Phrase Drill',
        estimatedMinutes: Math.round(12 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 2,
        title: `Day 2: Echo Reading & Expressive Intonation`,
        activityType: 'phonics',
        description: `Listen to a sentence model, then match pace and expression with live voice verification.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Echo Drill',
        estimatedMinutes: Math.round(12 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 3,
        title: `Day 3: AI Adaptive Story #3: Advanced Phonics`,
        activityType: 'story',
        description: `Practice an advanced adaptive story targeting multi-syllable phonemes.`,
        targetSkill: meta.skill,
        targetUrl: '/stories',
        actionLabel: 'Read AI Story',
        estimatedMinutes: Math.round(14 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 4,
        title: `Day 4: Directional Tracking & Omission Prevention`,
        activityType: 'drill',
        description: `Use a digital line guide to track text left-to-right without skipping words.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Tracking Drill',
        estimatedMinutes: Math.round(10 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 5,
        title: `Day 5: Mid-Point Progress Assessment`,
        activityType: 'reading',
        description: `Complete a progress assessment to re-calculate your dyslexia risk screening & WPM.`,
        targetSkill: 'MASTERY',
        targetUrl: '/passages',
        actionLabel: 'Take Assessment',
        estimatedMinutes: Math.round(15 * minutesMultiplier),
        completed: false,
      },
    ];
  } else {
    days = [
      {
        dayNumber: 1,
        title: `Day 1: Sentence Building & Word Matching Quiz`,
        activityType: 'drill',
        description: `Construct correct sentences from scrambled target vocabulary cards.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Sentence Quiz',
        estimatedMinutes: Math.round(12 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 2,
        title: `Day 2: High-Frequency Word Wall Hunt`,
        activityType: 'phonics',
        description: `Locate and pronounce target words hidden within a reading passage.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Start Word Hunt',
        estimatedMinutes: Math.round(10 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 3,
        title: `Day 3: AI Story Reading #4: Final Story Challenge`,
        activityType: 'story',
        description: `Read the final 4-week story challenge combining all learned phoneme skills.`,
        targetSkill: meta.skill,
        targetUrl: '/stories',
        actionLabel: 'Read Final Story',
        estimatedMinutes: Math.round(15 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 4,
        title: `Day 4: Orton-Gillingham Master Phonics Quiz`,
        activityType: 'drill',
        description: `Interactive 5-question speech & phonics quiz with live voice validation.`,
        targetSkill: meta.skill,
        targetUrl: '/learning-path',
        actionLabel: 'Take Master Quiz',
        estimatedMinutes: Math.round(15 * minutesMultiplier),
        completed: false,
      },
      {
        dayNumber: 5,
        title: `Day 5: Final Comprehensive Reading Assessment`,
        activityType: 'reading',
        description: `Final assessment session to unlock your Curriculum Graduation Certificate!`,
        targetSkill: 'MASTERY',
        targetUrl: '/passages',
        actionLabel: 'Complete Final Assessment',
        estimatedMinutes: Math.round(20 * minutesMultiplier),
        completed: false,
      },
    ];
  }

  return {
    id: '',
    weekNumber: weekNum,
    focusArea: `${title}${trackTag}`,
    description,
    days,
    completed: false,
    completedAt: null,
  };
}

/**
 * Get active learning path for student.
 */
export async function getActiveLearningPath(studentId: string): Promise<LearningPathResult | null> {
  const sessionCount = await getCompletedSessionsCount(studentId);

  const prevPathsRes = await query(
    `SELECT COUNT(*) as cnt FROM learning_paths WHERE student_id = $1`,
    [studentId]
  );
  const stageNumber = Math.max(1, parseInt(prevPathsRes.rows[0]?.cnt || '0', 10));

  const pathRes = await query(
    `SELECT * FROM learning_paths
     WHERE student_id = $1 AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`,
    [studentId]
  );
  if (pathRes.rows.length === 0) {
    return {
      id: '',
      title: 'Personalized Reading Plan',
      totalWeeks: 4,
      currentWeek: 1,
      status: 'none',
      planSummary: '',
      canGenerate: sessionCount >= REQUIRED_SESSIONS_FOR_PLAN,
      completedSessionsCount: sessionCount,
      requiredSessionsCount: REQUIRED_SESSIONS_FOR_PLAN,
      riskLevel: 'low',
      stageNumber,
      trackMode: 'Steady Mastery Track',
      weeks: [],
    };
  }

  const path = pathRes.rows[0];
  const weeksRes = await query(
    `SELECT * FROM learning_path_weeks WHERE path_id = $1 ORDER BY week_number ASC`,
    [path.id]
  );

  return {
    id: path.id,
    title: path.title,
    totalWeeks: path.total_weeks,
    currentWeek: path.current_week,
    status: path.status,
    planSummary: path.plan_summary,
    canGenerate: sessionCount >= REQUIRED_SESSIONS_FOR_PLAN,
    completedSessionsCount: sessionCount,
    requiredSessionsCount: REQUIRED_SESSIONS_FOR_PLAN,
    riskLevel: 'low',
    stageNumber,
    trackMode: 'Steady Mastery Track',
    weeks: weeksRes.rows.map((w: any) => ({
      id: w.id,
      weekNumber: w.week_number,
      focusArea: w.focus_area,
      description: w.description,
      days: w.exercises || [],
      completed: w.completed,
      completedAt: w.completed_at ? new Date(w.completed_at).toISOString() : null,
    })),
  };
}

/**
 * Complete a specific day task in a learning path.
 * Tracks progress, awards XP, advances weeks, and triggers graduation upon 20-day plan completion.
 */
export async function completeDayTask(pathId: string, weekNumber: number, dayNumber: number, studentId: string): Promise<void> {
  const weekRes = await query(
    `SELECT id, exercises FROM learning_path_weeks WHERE path_id = $1 AND week_number = $2`,
    [pathId, weekNumber]
  );
  if (weekRes.rows.length === 0) return;

  const weekId = weekRes.rows[0].id;
  const days: DayTask[] = weekRes.rows[0].exercises || [];

  const targetDay = days.find(d => d.dayNumber === dayNumber);
  if (targetDay) {
    targetDay.completed = true;
    targetDay.completedAt = new Date().toISOString();
  }

  const allCompleted = days.every(d => d.completed);

  await query(
    `UPDATE learning_path_weeks SET exercises = $1, completed = $2, completed_at = $3 WHERE id = $4`,
    [JSON.stringify(days), allCompleted, allCompleted ? new Date() : null, weekId]
  );

  // Award +25 XP for completing a daily learning task
  try {
    await awardXP(studentId, 25, 'learning_path_day');
  } catch (err) {
    console.error('Failed to award XP for day completion:', err);
  }

  // Advance week if all days in week completed
  if (allCompleted) {
    const remaining = await query(
      `SELECT COUNT(*) as cnt FROM learning_path_weeks WHERE path_id = $1 AND completed = FALSE`,
      [pathId]
    );

    if (parseInt(remaining.rows[0].cnt, 10) === 0) {
      await query(`UPDATE learning_paths SET status = 'completed', updated_at = NOW() WHERE id = $1`, [pathId]);
      // Award +500 Bonus XP & Graduation Badge for completing full 20-day curriculum!
      try {
        await awardXP(studentId, 500, 'curriculum_graduation_bonus');
      } catch (err) {
        console.error('Failed to award graduation XP bonus:', err);
      }
    } else {
      await query(`UPDATE learning_paths SET current_week = $2, updated_at = NOW() WHERE id = $1`, [pathId, weekNumber + 1]);
    }
  }
}
