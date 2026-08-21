import { query } from '../db';

// ---------------------------------------------------------------------------
// Gamification Service
// XP system, streaks, levels, achievement tracking.
// ---------------------------------------------------------------------------

export interface GamificationProfile {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  totalSessions: number;
  totalDrillsCompleted: number;
  totalStoriesRead: number;
  xpToNextLevel: number;
  levelProgress: number;
  freezeCount: number;
  freezeMonth: string | null;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  category: string;
  earned: boolean;
  earnedAt: string | null;
}

// Level thresholds: XP required to reach each level
const LEVEL_THRESHOLDS = [
  0,     // Level 1
  100,   // Level 2
  250,   // Level 3
  500,   // Level 4
  800,   // Level 5
  1200,  // Level 6
  1700,  // Level 7
  2300,  // Level 8
  3000,  // Level 9
  4000,  // Level 10
];

// XP awards for different actions
const XP_AWARDS = {
  sessionCompleted: 25,
  drillCompleted: 15,
  storyRead: 20,
  perfectAccuracy: 50,   // 100% accuracy bonus
  highAccuracy: 25,      // 95%+ accuracy bonus
  speedImprovement: 15,  // WPM improved over previous
  streakDay: 10,         // Per-day streak bonus
};

function computeLevel(xp: number): { level: number; xpToNext: number; progress: number } {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || (currentThreshold + 1000);
  const xpInLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  return {
    level,
    xpToNext: nextThreshold - xp,
    progress: Math.round((xpInLevel / xpNeeded) * 100),
  };
}

/**
 * Ensure a gamification profile exists for a student.
 */
export async function ensureProfile(studentId: string): Promise<void> {
  await query(
    `INSERT INTO gamification_profiles (student_id) VALUES ($1) ON CONFLICT (student_id) DO NOTHING`,
    [studentId]
  );
}

/**
 * Get a student's gamification profile.
 */
export async function getProfile(studentId: string): Promise<GamificationProfile> {
  await ensureProfile(studentId);
  const res = await query(
    `SELECT * FROM gamification_profiles WHERE student_id = $1`,
    [studentId]
  );
  const row = res?.rows?.[0] || { xp: 0, current_streak: 0, longest_streak: 0, last_activity_date: null, total_sessions: 0, total_drills_completed: 0, total_stories_read: 0, freeze_count: 0, freeze_month: null };
  const { level, xpToNext, progress } = computeLevel(row.xp || 0);
  return {
    xp: row.xp || 0,
    level,
    currentStreak: row.current_streak || 0,
    longestStreak: row.longest_streak || 0,
    lastActivityDate: row.last_activity_date,
    totalSessions: row.total_sessions || 0,
    totalDrillsCompleted: row.total_drills_completed || 0,
    totalStoriesRead: row.total_stories_read || 0,
    xpToNextLevel: xpToNext,
    levelProgress: progress,
    freezeCount: row.freeze_count || 0,
    freezeMonth: row.freeze_month,
  };
}

/**
 * Award XP to a student and update their profile.
 */
export async function awardXP(studentId: string, amount: number, reason: string): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
  await ensureProfile(studentId);
  const prev = await query(`SELECT xp FROM gamification_profiles WHERE student_id = $1`, [studentId]);
  const prevXP = prev?.rows?.[0]?.xp || 0;
  const prevLevel = computeLevel(prevXP).level;

  await query(
    `UPDATE gamification_profiles SET xp = xp + $2, updated_at = NOW() WHERE student_id = $1`,
    [studentId, amount]
  );

  const newXP = prevXP + amount;
  const newLevel = computeLevel(newXP).level;
  const leveledUp = newLevel > prevLevel;

  if (leveledUp) {
    await query(
      `UPDATE gamification_profiles SET level = $2 WHERE student_id = $1`,
      [studentId, newLevel]
    );
  }

  return { newXP, newLevel, leveledUp };
}

/**
 * Record a session completion and update streak with freeze mechanism.
 * Allows up to 2 missed days per calendar month before streak resets.
 */
export async function recordSessionCompletion(studentId: string): Promise<{ xpAwarded: number; newAchievements: string[] }> {
  await ensureProfile(studentId);
  const today = new Date().toISOString().split('T')[0];
  const todayDate = new Date(today);
  const currentMonth = todayDate.toISOString().slice(0, 7); // 'YYYY-MM'

  // Get current profile with freeze tracking fields
  const profileRes = await query(
    `SELECT last_activity_date, current_streak, longest_streak, total_sessions,
            freeze_count, freeze_month
     FROM gamification_profiles WHERE student_id = $1`,
    [studentId]
  );
  const profile = profileRes.rows[0];
  const lastDate = profile.last_activity_date;

  let newStreak = 1;
  let usedFreeze = false;

  if (lastDate) {
    const last = new Date(lastDate);
    const diffDays = Math.floor((todayDate.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      newStreak = profile.current_streak; // Same day, don't change
    } else if (diffDays === 1) {
      newStreak = profile.current_streak + 1; // Consecutive day
    } else {
      // Gap of 2+ days — check if we can use a freeze day
      const freezeMonth = profile.freeze_month;
      const freezeCount = freezeMonth === currentMonth ? profile.freeze_count : 0;

      if (freezeCount < 2) {
        // Use a freeze day — streak continues
        newStreak = profile.current_streak + 1;
        usedFreeze = true;
      }
      // else: streak resets to 1 (default)
    }
  }

  const newLongest = Math.max(profile.longest_streak, newStreak);
  const newTotalSessions = profile.total_sessions + 1;

  // Prepare freeze tracking updates
  const nextFreezeMonth = currentMonth;
  const nextFreezeCount = usedFreeze
    ? (profile.freeze_month === currentMonth ? profile.freeze_count + 1 : 1)
    : (profile.freeze_month === currentMonth ? profile.freeze_count : 0);

  await query(
    `UPDATE gamification_profiles
       SET current_streak = $2, longest_streak = $3, last_activity_date = $4,
           total_sessions = $5, freeze_count = $6, freeze_month = $7, updated_at = NOW()
     WHERE student_id = $1`,
    [studentId, newStreak, newLongest, today, newTotalSessions, nextFreezeCount, nextFreezeMonth]
  );

  // Award XP
  let xpAwarded = XP_AWARDS.sessionCompleted;
  if (newStreak > (profile.current_streak || 0)) {
    xpAwarded += XP_AWARDS.streakDay;
  }
  await awardXP(studentId, xpAwarded, 'session_completed');

  // Check achievements
  const newAchievements = await checkAchievements(studentId);

  return { xpAwarded, newAchievements };
}

/**
 * Record a drill completion.
 */
export async function recordDrillCompletion(studentId: string): Promise<void> {
  await ensureProfile(studentId);
  await query(
    `UPDATE gamification_profiles SET total_drills_completed = total_drills_completed + 1, updated_at = NOW() WHERE student_id = $1`,
    [studentId]
  );
  await awardXP(studentId, XP_AWARDS.drillCompleted, 'drill_completed');
}

/**
 * Check and award any newly earned achievements.
 */
export async function checkAchievements(studentId: string): Promise<string[]> {
  const profileRes = await query(
    `SELECT * FROM gamification_profiles WHERE student_id = $1`,
    [studentId]
  );
  if (profileRes.rows.length === 0) return [];
  const profile = profileRes.rows[0];

  // Get all achievements and which ones the student already has
  const allAchievements = await query(`SELECT * FROM achievements`);
  const earned = await query(
    `SELECT achievement_id FROM student_achievements WHERE student_id = $1`,
    [studentId]
  );
  const earnedIds = new Set(earned.rows.map((r: any) => r.achievement_id));

  const newlyEarned: string[] = [];

  for (const ach of allAchievements.rows) {
    if (earnedIds.has(ach.id)) continue;

    const criteria = ach.criteria || {};
    let qualifies = false;

    switch (criteria.type) {
      case 'sessions_completed':
        qualifies = profile.total_sessions >= (criteria.threshold || Infinity);
        break;
      case 'streak':
        qualifies = profile.current_streak >= (criteria.threshold || Infinity);
        break;
      case 'drills_completed':
        qualifies = profile.total_drills_completed >= (criteria.threshold || Infinity);
        break;
      case 'stories_read':
        qualifies = profile.total_stories_read >= (criteria.threshold || Infinity);
        break;
      case 'total_words': {
        const wordsRes = await query(
          `SELECT COALESCE(SUM(total_words_read), 0) as total FROM error_profiles WHERE student_id = $1`,
          [studentId]
        );
        qualifies = (wordsRes.rows[0]?.total || 0) >= (criteria.threshold || Infinity);
        break;
      }
      case 'health_score_single': {
        const hsRes = await query(
          `SELECT score FROM health_scores WHERE student_id = $1 ORDER BY computed_at DESC LIMIT 1`,
          [studentId]
        );
        qualifies = (hsRes.rows[0]?.score || 0) >= (criteria.threshold || Infinity);
        break;
      }
      // More types can be added here
    }

    if (qualifies) {
      await query(
        `INSERT INTO student_achievements (student_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [studentId, ach.id]
      );
      await awardXP(studentId, ach.xp_reward, `achievement:${ach.code}`);
      newlyEarned.push(ach.name);
    }
  }

  return newlyEarned;
}

/**
 * Get all achievements with earned status for a student.
 */
export async function getAchievements(studentId: string): Promise<Achievement[]> {
  const res = await query(
    `SELECT a.*, sa.earned_at
     FROM achievements a
     LEFT JOIN student_achievements sa ON sa.achievement_id = a.id AND sa.student_id = $1
     ORDER BY a.category, a.xp_reward ASC`,
    [studentId]
  );
  return res.rows.map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    icon: r.icon,
    xpReward: r.xp_reward,
    category: r.category,
    earned: !!r.earned_at,
    earnedAt: r.earned_at ? new Date(r.earned_at).toISOString() : null,
  }));
}