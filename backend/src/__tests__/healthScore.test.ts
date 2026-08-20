import { describe, it, expect, beforeEach, vi } from 'vitest';

// Unmock healthScore service so unit tests hit the real implementation
vi.unmock('../services/healthScore');

import {
  computeHealthScore,
  getLatestHealthScore,
  getHealthScoreHistory,
} from '../services/healthScore';
import * as db from '../db';

describe('Health Score Service (healthScore.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('computeHealthScore', () => {
    it('returns default zero result with critical risk level if session does not exist', async () => {
      vi.spyOn(db, 'query').mockResolvedValueOnce({ rows: [] } as any);

      const result = await computeHealthScore('nonexistent-session', 'nonexistent-student');
      expect(result).toEqual({
        score: 0,
        riskLevel: 'critical',
        fluency: 0,
        accuracy: 0,
        wpmNormalized: 0,
        errorFrequency: 0,
        errorSeverity: 0,
        improvementTrend: 0,
        components: {},
      });
    });

    it('computes a high health score for high WPM, zero errors, and grade 3 target', async () => {
      const mockSessionRow = {
        words_per_minute: 120,
        duration_seconds: 60,
        error_rate: 0,
        total_words_read: 120,
        total_errors: 0,
        rev_count: 0,
        sub_count: 0,
        omi_count: 0,
        ins_count: 0,
        bld_count: 0,
        pac_count: 0,
        uncertain_count: 0,
        grade_level: 3,
      };

      vi.spyOn(db, 'query')
        // 1. Session & Error Profile query
        .mockResolvedValueOnce({ rows: [mockSessionRow] } as any)
        // 2. Previous health scores query for trend
        .mockResolvedValueOnce({ rows: [{ score: 92 }, { score: 95 }] } as any)
        // 3. DB Insert query into health_scores
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await computeHealthScore('session-1', 'student-1');

      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(['good', 'excellent']).toContain(result.riskLevel);
      expect(result.accuracy).toBe(100);
      expect(result.errorSeverity).toBe(100);
      expect(result.components).toBeDefined();
    });

    it('computes a lower health score and high risk level when high error rate and reversals are present', async () => {
      const mockSessionRow = {
        words_per_minute: 40,
        duration_seconds: 120,
        error_rate: 0.45,
        total_words_read: 80,
        total_errors: 36,
        rev_count: 15,
        sub_count: 10,
        omi_count: 8,
        ins_count: 3,
        bld_count: 0,
        pac_count: 0,
        uncertain_count: 0,
        grade_level: 3,
      };

      vi.spyOn(db, 'query')
        .mockResolvedValueOnce({ rows: [mockSessionRow] } as any)
        .mockResolvedValueOnce({ rows: [{ score: 55 }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await computeHealthScore('session-2', 'student-2');

      expect(result.score).toBeLessThan(60);
      expect(['high', 'critical']).toContain(result.riskLevel);
      expect(result.errorSeverity).toBeLessThan(60);
    });
  });

  describe('getLatestHealthScore', () => {
    it('returns null if no health scores exist for the student', async () => {
      vi.spyOn(db, 'query').mockResolvedValueOnce({ rows: [] } as any);

      const score = await getLatestHealthScore('student-no-scores');
      expect(score).toBeNull();
    });

    it('returns formatted HealthScoreResult when record exists', async () => {
      const mockDbRow = {
        score: 82,
        risk_level: 'good',
        fluency: 78,
        accuracy: 90,
        wpm_normalized: 80,
        error_frequency: 85,
        error_severity: 80,
        improvement_trend: 60,
        components: { accuracy: 90 },
      };

      vi.spyOn(db, 'query').mockResolvedValueOnce({ rows: [mockDbRow] } as any);

      const score = await getLatestHealthScore('student-with-score');
      expect(score).toEqual({
        score: 82,
        riskLevel: 'good',
        fluency: 78,
        accuracy: 90,
        wpmNormalized: 80,
        errorFrequency: 85,
        errorSeverity: 80,
        improvementTrend: 60,
        components: { accuracy: 90 },
      });
    });
  });

  describe('getHealthScoreHistory', () => {
    it('fetches historical health scores sorted by computed_at ASC with specified limit', async () => {
      const mockRows = [
        { score: 70, risk_level: 'medium', computed_at: '2026-08-01' },
        { score: 78, risk_level: 'good', computed_at: '2026-08-10' },
      ];

      const querySpy = vi.spyOn(db, 'query').mockResolvedValueOnce({ rows: mockRows } as any);

      const history = await getHealthScoreHistory('student-history', 10);
      expect(history).toEqual(mockRows);
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY hs.computed_at ASC'),
        ['student-history', 10]
      );
    });
  });
});
