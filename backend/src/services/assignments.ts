import { query } from '../db';
import { awardXP, checkAchievements } from './gamification';
import { generateLearningPath, getActiveLearningPath, LearningPathResult } from './learningPath';

const ASSIGNMENT_XP = {
  complete: 30,
  score75: 15,
  score90: 35,
};

// Threshold below which an improvement plan is auto-generated
const IMPROVEMENT_PLAN_THRESHOLD = 75;

export interface AssignmentCompletionResult {
  assignmentStudentId: string;
  score: number;
  rewardXp: number;
  newAchievements: string[];
  improvementPlan?: LearningPathResult | null;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function xpForScore(score: number): number {
  if (score >= 90) return ASSIGNMENT_XP.complete + ASSIGNMENT_XP.score90;
  if (score >= 75) return ASSIGNMENT_XP.complete + ASSIGNMENT_XP.score75;
  return ASSIGNMENT_XP.complete;
}

export async function resolveAssignmentScore(sessionId: string): Promise<number> {
  const healthScore = await query(
    `SELECT score
     FROM health_scores
     WHERE session_id = $1
     ORDER BY computed_at DESC
     LIMIT 1`,
    [sessionId]
  );

  if (healthScore.rows[0]?.score != null) {
    return clampScore(Number(healthScore.rows[0].score));
  }

  const profile = await query(
    `SELECT error_rate
     FROM error_profiles
     WHERE session_id = $1
     ORDER BY computed_at DESC
     LIMIT 1`,
    [sessionId]
  );

  const errorRate = Number(profile.rows[0]?.error_rate ?? 1);
  return clampScore(100 - errorRate * 100);
}

/**
 * Generate an improvement plan for a student who scored below threshold.
 * Returns the generated learning path or null if not applicable/already exists.
 */
export async function generateImprovementPlanIfNeeded(
  studentId: string,
  assignmentScore: number
): Promise<LearningPathResult | null> {
  if (assignmentScore >= IMPROVEMENT_PLAN_THRESHOLD) {
    return null; // Score is good, no improvement plan needed
  }

  // Check if student already has an active learning path
  const existingPath = await getActiveLearningPath(studentId);
  if (existingPath && existingPath.status === 'active') {
    return existingPath; // Already has an active plan
  }

  try {
    const newPath = await generateLearningPath(studentId);
    return newPath;
  } catch (error: any) {
    // If insufficient sessions, that's expected - just log and return null
    if (error.code === 'INSUFFICIENT_SESSIONS') {
      console.log(`Cannot generate improvement plan for student ${studentId}: ${error.message}`);
      return null;
    }
    // Other errors - log but don't fail the assignment completion
    console.error(`Failed to generate improvement plan for student ${studentId}:`, error);
    return null;
  }
}

export async function completeAssignmentForSession(sessionId: string): Promise<AssignmentCompletionResult | null> {
  const assignmentLink = await query(
    `SELECT
       ast.id,
       ast.student_id,
       ast.rewards_awarded,
       ast.reward_xp,
       a.due_date
     FROM assignment_students ast
     JOIN reading_sessions rs ON rs.assignment_student_id = ast.id
     JOIN assignments a ON a.id = ast.assignment_id
     WHERE rs.id = $1`,
    [sessionId]
  );

  if (assignmentLink.rows.length === 0) return null;

  const row = assignmentLink.rows[0];
  const score = await resolveAssignmentScore(sessionId);
  const isLate = row.due_date ? new Date(row.due_date).getTime() < Date.now() : false;
  let rewardXp = Number(row.reward_xp ?? 0);
  let newAchievements: string[] = [];

  if (!row.rewards_awarded) {
    rewardXp = xpForScore(score);
    const claimReward = await query(
      `UPDATE assignment_students
       SET rewards_awarded = TRUE,
           reward_xp = $2,
           updated_at = NOW()
       WHERE id = $1
         AND rewards_awarded = FALSE
       RETURNING reward_xp`,
      [row.id, rewardXp]
    );

    if (claimReward.rows.length > 0) {
      rewardXp = Number(claimReward.rows[0].reward_xp ?? rewardXp);
      await awardXP(row.student_id, rewardXp, `assignment_completed:${row.id}`);
      newAchievements = await checkAchievements(row.student_id);
    } else {
      const currentReward = await query(
        `SELECT reward_xp
         FROM assignment_students
         WHERE id = $1`,
        [row.id]
      );
      rewardXp = Number(currentReward.rows[0]?.reward_xp ?? 0);
    }
  }

  await query(
    `UPDATE assignment_students
     SET status = $2,
         score = $3,
         completed_at = COALESCE(completed_at, NOW()),
         rewards_awarded = TRUE,
         reward_xp = $4,
         updated_at = NOW()
     WHERE id = $1`,
    [row.id, isLate ? 'late' : 'completed', score, rewardXp]
  );

  // Generate improvement plan if score is below threshold
  const improvementPlan = await generateImprovementPlanIfNeeded(row.student_id, score);

  return {
    assignmentStudentId: row.id,
    score,
    rewardXp,
    newAchievements,
    improvementPlan,
  };
}
