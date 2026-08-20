import { query } from '../db';

// ---------------------------------------------------------------------------
// Risk Screening Engine
// Analyzes reading error patterns across sessions to produce a risk assessment.
// IMPORTANT: This is a SCREENING tool — NOT a medical diagnosis.
// ---------------------------------------------------------------------------

export interface RiskScreeningResult {
  risk: 'low' | 'medium' | 'high';
  confidence: number;
  indicators: string[];
  evidence: RiskEvidence[];
  sessionsAnalyzed: number;
  disclaimer: string;
}

export interface RiskEvidence {
  indicator: string;
  category: string;
  frequency: number;
  severity: 'mild' | 'moderate' | 'significant';
  details: string;
}

const DISCLAIMER = 'This is an educational screening tool, not a medical diagnosis. Consult a qualified specialist for clinical assessment.';

// Thresholds calibrated against O-G research for early indicators
const INDICATOR_THRESHOLDS = {
  reversalRate: { moderate: 0.03, significant: 0.06 },
  omissionRate: { moderate: 0.04, significant: 0.08 },
  blendRate: { moderate: 0.03, significant: 0.06 },
  insertionRate: { moderate: 0.03, significant: 0.06 },
  overallErrorRate: { moderate: 0.10, significant: 0.20 },
  wpmBelowGrade: { moderate: 0.7, significant: 0.5 }, // fraction of grade norm
};

const GRADE_WPM_NORMS: Record<number, number> = {
  1: 60, 2: 90, 3: 110, 4: 130, 5: 140,
};

/**
 * Run a risk screening for a student based on their reading history.
 */
export async function runRiskScreening(studentId: string): Promise<RiskScreeningResult> {
  // Fetch all error profiles and session data
  const profilesRes = await query(
    `SELECT ep.*, rs.words_per_minute, rs.duration_seconds, u.grade_level
     FROM error_profiles ep
     JOIN reading_sessions rs ON ep.session_id = rs.id
     JOIN users u ON u.id = ep.student_id
     WHERE ep.student_id = $1 AND rs.deleted_at IS NULL
     ORDER BY rs.started_at DESC
     LIMIT 20`,
    [studentId]
  );

  const profiles = profilesRes.rows;
  const sessionsAnalyzed = profiles.length;

  if (sessionsAnalyzed === 0) {
    return {
      risk: 'low',
      confidence: 0,
      indicators: [],
      evidence: [],
      sessionsAnalyzed: 0,
      disclaimer: DISCLAIMER,
    };
  }

  const gradeLevel = profiles[0].grade_level || 3;
  const indicators: string[] = [];
  const evidence: RiskEvidence[] = [];
  let riskPoints = 0;

  // Aggregate error counts across all sessions
  const totals = {
    rev: 0, sub: 0, omi: 0, ins: 0, bld: 0, pac: 0, unc: 0,
    totalWords: 0, totalErrors: 0, totalWpm: 0,
  };

  for (const p of profiles) {
    totals.rev += p.rev_count || 0;
    totals.sub += p.sub_count || 0;
    totals.omi += p.omi_count || 0;
    totals.ins += p.ins_count || 0;
    totals.bld += p.bld_count || 0;
    totals.pac += p.pac_count || 0;
    totals.unc += p.uncertain_count || 0;
    totals.totalWords += p.total_words_read || 0;
    totals.totalErrors += p.total_errors || 0;
    totals.totalWpm += p.words_per_minute || 0;
  }

  const avgWpm = totals.totalWpm / sessionsAnalyzed;
  const overallErrorRate = totals.totalWords > 0 ? totals.totalErrors / totals.totalWords : 0;

  // --- INDICATOR 1: Letter Reversals ---
  const reversalRate = totals.totalWords > 0 ? totals.rev / totals.totalWords : 0;
  if (reversalRate >= INDICATOR_THRESHOLDS.reversalRate.significant) {
    indicators.push('Frequent letter reversals (b/d, w/m, p/q patterns)');
    evidence.push({
      indicator: 'Letter reversals',
      category: 'REV',
      frequency: totals.rev,
      severity: 'significant',
      details: `${totals.rev} reversals across ${sessionsAnalyzed} sessions (rate: ${(reversalRate * 100).toFixed(1)}%). This pattern is a recognized early indicator of visual-spatial processing challenges.`,
    });
    riskPoints += 3;
  } else if (reversalRate >= INDICATOR_THRESHOLDS.reversalRate.moderate) {
    indicators.push('Moderate letter reversal pattern');
    evidence.push({
      indicator: 'Letter reversals',
      category: 'REV',
      frequency: totals.rev,
      severity: 'moderate',
      details: `${totals.rev} reversals detected (rate: ${(reversalRate * 100).toFixed(1)}%). Worth monitoring.`,
    });
    riskPoints += 1.5;
  }

  // --- INDICATOR 2: Word Omissions ---
  const omissionRate = totals.totalWords > 0 ? totals.omi / totals.totalWords : 0;
  if (omissionRate >= INDICATOR_THRESHOLDS.omissionRate.significant) {
    indicators.push('High word omission frequency');
    evidence.push({
      indicator: 'Word omissions',
      category: 'OMI',
      frequency: totals.omi,
      severity: 'significant',
      details: `${totals.omi} words omitted (rate: ${(omissionRate * 100).toFixed(1)}%). May indicate tracking or attention difficulties during reading.`,
    });
    riskPoints += 2;
  } else if (omissionRate >= INDICATOR_THRESHOLDS.omissionRate.moderate) {
    indicators.push('Moderate word omission pattern');
    evidence.push({
      indicator: 'Word omissions',
      category: 'OMI',
      frequency: totals.omi,
      severity: 'moderate',
      details: `${totals.omi} words omitted (rate: ${(omissionRate * 100).toFixed(1)}%).`,
    });
    riskPoints += 1;
  }

  // --- INDICATOR 3: Phonological Decoding (Blend Breakdowns) ---
  const blendRate = totals.totalWords > 0 ? totals.bld / totals.totalWords : 0;
  if (blendRate >= INDICATOR_THRESHOLDS.blendRate.significant) {
    indicators.push('Phonological decoding difficulties');
    evidence.push({
      indicator: 'Blend breakdowns',
      category: 'BLD',
      frequency: totals.bld,
      severity: 'significant',
      details: `${totals.bld} blend breakdowns suggest difficulty with phoneme blending — a core phonological awareness skill.`,
    });
    riskPoints += 3;
  } else if (blendRate >= INDICATOR_THRESHOLDS.blendRate.moderate) {
    indicators.push('Emerging phonological decoding issues');
    evidence.push({
      indicator: 'Blend breakdowns',
      category: 'BLD',
      frequency: totals.bld,
      severity: 'moderate',
      details: `${totals.bld} blend breakdowns detected.`,
    });
    riskPoints += 1.5;
  }

  // --- INDICATOR 4: Below-Grade Fluency ---
  const gradeNorm = GRADE_WPM_NORMS[gradeLevel] || 110;
  const wpmRatio = avgWpm / gradeNorm;
  if (wpmRatio < INDICATOR_THRESHOLDS.wpmBelowGrade.significant) {
    indicators.push('Reading speed significantly below grade level');
    evidence.push({
      indicator: 'Below-grade fluency',
      category: 'FLUENCY',
      frequency: Math.round(avgWpm),
      severity: 'significant',
      details: `Average ${Math.round(avgWpm)} WPM vs. grade ${gradeLevel} norm of ${gradeNorm} WPM (${Math.round(wpmRatio * 100)}% of expected).`,
    });
    riskPoints += 2;
  } else if (wpmRatio < INDICATOR_THRESHOLDS.wpmBelowGrade.moderate) {
    indicators.push('Reading speed below grade expectations');
    evidence.push({
      indicator: 'Below-grade fluency',
      category: 'FLUENCY',
      frequency: Math.round(avgWpm),
      severity: 'moderate',
      details: `Average ${Math.round(avgWpm)} WPM vs. grade ${gradeLevel} norm of ${gradeNorm} WPM.`,
    });
    riskPoints += 1;
  }

  // --- INDICATOR 5: High Overall Error Rate ---
  if (overallErrorRate >= INDICATOR_THRESHOLDS.overallErrorRate.significant) {
    indicators.push('Elevated overall error rate');
    evidence.push({
      indicator: 'High error rate',
      category: 'OVERALL',
      frequency: totals.totalErrors,
      severity: 'significant',
      details: `Overall error rate of ${(overallErrorRate * 100).toFixed(1)}% across ${totals.totalWords} words read.`,
    });
    riskPoints += 2;
  } else if (overallErrorRate >= INDICATOR_THRESHOLDS.overallErrorRate.moderate) {
    indicators.push('Moderately elevated error rate');
    evidence.push({
      indicator: 'Elevated error rate',
      category: 'OVERALL',
      frequency: totals.totalErrors,
      severity: 'moderate',
      details: `Overall error rate of ${(overallErrorRate * 100).toFixed(1)}%.`,
    });
    riskPoints += 1;
  }

  // --- INDICATOR 6: Worsening Trend ---
  if (profiles.length >= 3) {
    const recent = profiles.slice(0, Math.min(3, profiles.length));
    const older = profiles.slice(Math.min(3, profiles.length));
    if (older.length > 0) {
      const recentAvgRate = recent.reduce((a: number, p: any) => a + (p.error_rate || 0), 0) / recent.length;
      const olderAvgRate = older.reduce((a: number, p: any) => a + (p.error_rate || 0), 0) / older.length;
      if (recentAvgRate > olderAvgRate * 1.2) {
        indicators.push('Error rate trending upward');
        evidence.push({
          indicator: 'Worsening trend',
          category: 'TREND',
          frequency: 0,
          severity: 'moderate',
          details: `Recent error rate (${(recentAvgRate * 100).toFixed(1)}%) is higher than earlier sessions (${(olderAvgRate * 100).toFixed(1)}%).`,
        });
        riskPoints += 1.5;
      }
    }
  }

  // Compute risk level and confidence
  const maxPossiblePoints = 14.5;
  const riskRatio = riskPoints / maxPossiblePoints;

  let risk: RiskScreeningResult['risk'] = 'low';
  if (riskRatio >= 0.4) risk = 'high';
  else if (riskRatio >= 0.2) risk = 'medium';

  // Confidence increases with more data points and clearer signals
  const dataConfidence = Math.min(1, sessionsAnalyzed / 5); // Full confidence at 5+ sessions
  const signalStrength = indicators.length > 0 ? Math.min(1, riskPoints / 6) : 0;
  const confidence = Math.round(Math.max(20, (dataConfidence * 50 + signalStrength * 50)));

  const result: RiskScreeningResult = {
    risk,
    confidence,
    indicators,
    evidence,
    sessionsAnalyzed,
    disclaimer: DISCLAIMER,
  };

  // Persist screening
  await query(
    `INSERT INTO risk_screenings
      (student_id, risk_level, confidence, indicators, evidence, sessions_analyzed, disclaimer)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [studentId, risk, confidence, JSON.stringify(indicators), JSON.stringify(evidence), sessionsAnalyzed, DISCLAIMER]
  );

  return result;
}

/**
 * Get the latest risk screening for a student.
 */
export async function getLatestScreening(studentId: string): Promise<RiskScreeningResult | null> {
  const res = await query(
    `SELECT * FROM risk_screenings WHERE student_id = $1 ORDER BY screened_at DESC LIMIT 1`,
    [studentId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    risk: row.risk_level,
    confidence: row.confidence,
    indicators: row.indicators || [],
    evidence: row.evidence || [],
    sessionsAnalyzed: row.sessions_analyzed,
    disclaimer: row.disclaimer,
  };
}
