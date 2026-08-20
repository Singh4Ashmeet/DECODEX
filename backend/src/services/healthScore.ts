import { query } from '../db';

// ---------------------------------------------------------------------------
// Reading Health Score Engine
// Computes a composite 0–100 score from multiple reading performance dimensions.
// ---------------------------------------------------------------------------

export interface HealthScoreResult {
  score: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'good' | 'excellent';
  fluency: number;
  accuracy: number;
  wpmNormalized: number;
  errorFrequency: number;
  errorSeverity: number;
  improvementTrend: number;
  components: Record<string, number>;
}

// Grade-level WPM norms (words per minute, approximate oral reading fluency benchmarks)
const GRADE_WPM_NORMS: Record<number, { low: number; target: number; high: number }> = {
  1: { low: 30, target: 60, high: 90 },
  2: { low: 50, target: 90, high: 130 },
  3: { low: 70, target: 110, high: 150 },
  4: { low: 90, target: 130, high: 170 },
  5: { low: 100, target: 140, high: 180 },
};

// Error severity weights by O-G category (higher = more concerning)
const ERROR_SEVERITY_WEIGHTS: Record<string, number> = {
  REV: 1.0,   // Reversals are a strong indicator
  BLD: 0.9,   // Blend breakdowns indicate phonological issues
  OMI: 0.7,   // Omissions can indicate tracking issues
  SUB: 0.6,   // Substitutions are common, less severe
  INS: 0.4,   // Insertions are often self-corrections
  PAC: 0.3,   // Pacing issues are developmental
  UNC: 0.5,   // Uncertain — moderate weight
};

// Score weights for composite calculation
const WEIGHTS = {
  wpm: 0.20,
  accuracy: 0.25,
  fluency: 0.20,
  errorFrequency: 0.15,
  errorSeverity: 0.10,
  trend: 0.10,
};

function normalizeWPM(wpm: number, gradeLevel: number): number {
  const norms = GRADE_WPM_NORMS[gradeLevel] || GRADE_WPM_NORMS[3];
  if (wpm >= norms.high) return 100;
  if (wpm <= 0) return 0;
  // Linear interpolation: 0 → 0, low → 40, target → 70, high → 100
  if (wpm <= norms.low) {
    return Math.round((wpm / norms.low) * 40);
  }
  if (wpm <= norms.target) {
    return Math.round(40 + ((wpm - norms.low) / (norms.target - norms.low)) * 30);
  }
  return Math.round(70 + ((wpm - norms.target) / (norms.high - norms.target)) * 30);
}

function computeAccuracyScore(errorRate: number): number {
  // errorRate is fraction (0.0 to 1.0), accuracy is 1 - errorRate
  const accuracy = Math.max(0, 1 - errorRate);
  // Non-linear: small errors don't penalize much, big errors penalize heavily
  return Math.round(Math.pow(accuracy, 0.7) * 100);
}

function computeFluencyScore(wpm: number, errorRate: number, durationSeconds: number, totalWords: number): number {
  // Fluency combines speed and smoothness
  const speedFactor = Math.min(1, wpm / 150); // normalize against upper bound
  const accuracyFactor = Math.max(0, 1 - errorRate);
  // Penalize very short sessions (likely incomplete)
  const completionFactor = totalWords > 0 ? Math.min(1, totalWords / 20) : 0.5;
  return Math.round(speedFactor * 40 + accuracyFactor * 40 + completionFactor * 20);
}

function computeErrorSeverityScore(errorCounts: Record<string, number>): number {
  let totalWeightedErrors = 0;
  let totalErrors = 0;
  for (const [cat, count] of Object.entries(errorCounts)) {
    const weight = ERROR_SEVERITY_WEIGHTS[cat] || 0.5;
    totalWeightedErrors += count * weight;
    totalErrors += count;
  }
  if (totalErrors === 0) return 100; // No errors = perfect severity score
  // Average severity: lower is worse
  const avgSeverity = totalWeightedErrors / totalErrors;
  // Invert: high severity → low score
  return Math.round(Math.max(0, (1 - avgSeverity) * 100));
}

function computeErrorFrequencyScore(errorRate: number): number {
  // Lower frequency = higher score
  return Math.round(Math.max(0, (1 - Math.min(1, errorRate * 2)) * 100));
}

function computeTrendScore(previousScores: number[], currentScore: number): number {
  if (previousScores.length === 0) return 50; // Neutral for first session
  const avgPrevious = previousScores.reduce((a, b) => a + b, 0) / previousScores.length;
  const improvement = currentScore - avgPrevious;
  // Map -50..+50 improvement to 0..100
  return Math.round(Math.max(0, Math.min(100, 50 + improvement)));
}

function determineRiskLevel(score: number): HealthScoreResult['riskLevel'] {
  if (score < 40) return 'critical';
  if (score < 60) return 'high';
  if (score < 75) return 'medium';
  if (score < 90) return 'good';
  return 'excellent';
}

/**
 * Compute a health score for a specific reading session.
 */
export async function computeHealthScore(
  sessionId: string,
  studentId: string
): Promise<HealthScoreResult> {
  // Fetch session data
  const sessionRes = await query(
    `SELECT rs.words_per_minute, rs.duration_seconds,
            ep.error_rate, ep.total_words_read, ep.total_errors,
            ep.rev_count, ep.sub_count, ep.omi_count, ep.ins_count,
            ep.bld_count, ep.pac_count, ep.uncertain_count,
            u.grade_level
     FROM reading_sessions rs
     LEFT JOIN error_profiles ep ON ep.session_id = rs.id
     JOIN users u ON u.id = rs.student_id
     WHERE rs.id = $1 AND rs.student_id = $2`,
    [sessionId, studentId]
  );

  if (sessionRes.rows.length === 0) {
    return {
      score: 0, riskLevel: 'critical', fluency: 0, accuracy: 0,
      wpmNormalized: 0, errorFrequency: 0, errorSeverity: 0,
      improvementTrend: 0, components: {},
    };
  }

  const row = sessionRes.rows[0];
  const wpm = row.words_per_minute || 0;
  const errorRate = row.error_rate || 0;
  const durationSeconds = row.duration_seconds || 0;
  const totalWords = row.total_words_read || 0;
  const gradeLevel = row.grade_level || 3;

  const errorCounts: Record<string, number> = {
    REV: row.rev_count || 0,
    SUB: row.sub_count || 0,
    OMI: row.omi_count || 0,
    INS: row.ins_count || 0,
    BLD: row.bld_count || 0,
    PAC: row.pac_count || 0,
    UNC: row.uncertain_count || 0,
  };

  // Compute individual dimension scores
  const wpmNormalized = normalizeWPM(wpm, gradeLevel);
  const accuracy = computeAccuracyScore(errorRate);
  const fluency = computeFluencyScore(wpm, errorRate, durationSeconds, totalWords);
  const errorFrequency = computeErrorFrequencyScore(errorRate);
  const errorSeverity = computeErrorSeverityScore(errorCounts);

  // Fetch previous health scores for trend
  const prevRes = await query(
    `SELECT score FROM health_scores
     WHERE student_id = $1
     ORDER BY computed_at DESC LIMIT 5`,
    [studentId]
  );
  const previousScores = prevRes.rows.map((r: any) => r.score);

  // Pre-composite score (without trend)
  const preScore = Math.round(
    wpmNormalized * WEIGHTS.wpm +
    accuracy * WEIGHTS.accuracy +
    fluency * WEIGHTS.fluency +
    errorFrequency * WEIGHTS.errorFrequency +
    errorSeverity * WEIGHTS.errorSeverity +
    50 * WEIGHTS.trend // placeholder for trend
  );

  const improvementTrend = computeTrendScore(previousScores, preScore);

  // Final composite score
  const score = Math.round(
    Math.max(0, Math.min(100,
      wpmNormalized * WEIGHTS.wpm +
      accuracy * WEIGHTS.accuracy +
      fluency * WEIGHTS.fluency +
      errorFrequency * WEIGHTS.errorFrequency +
      errorSeverity * WEIGHTS.errorSeverity +
      improvementTrend * WEIGHTS.trend
    ))
  );

  const riskLevel = determineRiskLevel(score);

  const result: HealthScoreResult = {
    score,
    riskLevel,
    fluency,
    accuracy,
    wpmNormalized,
    errorFrequency,
    errorSeverity,
    improvementTrend,
    components: { wpmNormalized, accuracy, fluency, errorFrequency, errorSeverity, improvementTrend },
  };

  // Persist to DB
  await query(
    `INSERT INTO health_scores
      (student_id, session_id, score, risk_level, fluency, accuracy,
       wpm_normalized, error_frequency, error_severity, improvement_trend, components)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      studentId, sessionId, score, riskLevel, fluency, accuracy,
      wpmNormalized, errorFrequency, errorSeverity, improvementTrend,
      JSON.stringify(result.components),
    ]
  );

  return result;
}

/**
 * Get the latest health score for a student.
 */
export async function getLatestHealthScore(studentId: string): Promise<HealthScoreResult | null> {
  const res = await query(
    `SELECT * FROM health_scores WHERE student_id = $1 ORDER BY computed_at DESC LIMIT 1`,
    [studentId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    score: row.score,
    riskLevel: row.risk_level,
    fluency: row.fluency,
    accuracy: row.accuracy,
    wpmNormalized: row.wpm_normalized,
    errorFrequency: row.error_frequency,
    errorSeverity: row.error_severity,
    improvementTrend: row.improvement_trend,
    components: row.components || {},
  };
}

/**
 * Get health score history for a student.
 */
export async function getHealthScoreHistory(studentId: string, limit: number = 20) {
  const res = await query(
    `SELECT hs.score, hs.risk_level, hs.fluency, hs.accuracy, hs.improvement_trend,
            hs.computed_at, hs.components
     FROM health_scores hs
     WHERE hs.student_id = $1
     ORDER BY hs.computed_at ASC
     LIMIT $2`,
    [studentId, limit]
  );
  return res.rows;
}
