/**
 * Copilot Parent Language tests — verifies that the parent communication draft
 * is generated in the parent's preferred_language, independent of the student's language.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQuery } from './helpers/setup';
import { generateStrategy } from '../services/copilot';

vi.mock('../services/healthScore', () => ({
  getLatestHealthScore: vi.fn().mockResolvedValue({ score: 65, riskLevel: 'moderate' }),
  computeHealthScore: vi.fn(),
  getHealthScoreHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/riskScreening', () => ({
  getLatestScreening: vi.fn().mockResolvedValue({ risk: 'moderate', confidence: 80 }),
  runRiskScreening: vi.fn(),
}));

vi.mock('../queue/consentErasure', () => ({
  eraseConsentDataForLink: vi.fn(),
}));

const mockedQuery = vi.mocked(mockQuery);

describe('Copilot Parent Communication Language', () => {
  const studentId = '11111111-1111-1111-1111-111111111111';
  const teacherId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
    mockedQuery.mockReset();
  });

  it('should generate parent communication draft in Hindi when parent preferred_language is "hi"', async () => {
    // Mock student data
    mockedQuery.mockResolvedValueOnce({
      rows: [{ display_name: 'Test Student', grade_level: 3 }],
    });

    // Mock error aggregation
    mockedQuery.mockResolvedValueOnce({
      rows: [{
        rev: '5', sub: '3', omi: '2', ins: '1', bld: '4', pac: '2',
        uncertain: '0', total_errors: '17', total_words: '200', session_count: '3',
      }],
    });

    // Mock trends
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { words_per_minute: 45, error_rate: 0.08, started_at: new Date().toISOString() },
        { words_per_minute: 42, error_rate: 0.09, started_at: new Date().toISOString() },
      ],
    });

    // Mock parent language lookup — returns 'hi'
    mockedQuery.mockResolvedValueOnce({
      rows: [{ preferred_language: 'hi' }],
    });

    // Mock copilot session insert
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const strategy = await generateStrategy(studentId, teacherId);

    // Verify the parent communication draft is in Hindi (Devanagari script)
    expect(strategy.parentCommunicationDraft).toBeDefined();
    expect(typeof strategy.parentCommunicationDraft).toBe('string');
    expect(strategy.parentCommunicationDraft).toContain('प्रिय अभिभावक/पालक');
    expect(strategy.parentCommunicationDraft).toContain('रीडिंग प्रगति');
    expect(strategy.parentCommunicationDraft).toContain('हेल्थ स्कोर');
    expect(strategy.parentCommunicationDraft).toContain('सुधार योजना');
    expect(strategy.parentCommunicationDraft).toContain('घर पर आप कैसे मदद कर सकते हैं');
    expect(strategy.parentCommunicationDraft).toContain('सादर');
    expect(strategy.parentCommunicationDraft).toContain('डिकोडेक्स टीचिंग टीम');
  });

  it('should generate parent communication draft in English when parent preferred_language is "en"', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ display_name: 'Test Student', grade_level: 3 }],
    });

    mockedQuery.mockResolvedValueOnce({
      rows: [{
        rev: '5', sub: '3', omi: '2', ins: '1', bld: '4', pac: '2',
        uncertain: '0', total_errors: '17', total_words: '200', session_count: '3',
      }],
    });

    mockedQuery.mockResolvedValueOnce({
      rows: [
        { words_per_minute: 45, error_rate: 0.08, started_at: new Date().toISOString() },
        { words_per_minute: 42, error_rate: 0.09, started_at: new Date().toISOString() },
      ],
    });

    // Mock parent language lookup — returns 'en'
    mockedQuery.mockResolvedValueOnce({
      rows: [{ preferred_language: 'en' }],
    });

    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const strategy = await generateStrategy(studentId, teacherId);

    // Verify the parent communication draft is in English
    expect(strategy.parentCommunicationDraft).toBeDefined();
    expect(strategy.parentCommunicationDraft).toContain('Dear Parent/Guardian');
    expect(strategy.parentCommunicationDraft).toContain('reading progress');
    expect(strategy.parentCommunicationDraft).toContain('Health Score');
    expect(strategy.parentCommunicationDraft).toContain('improvement plan');
    expect(strategy.parentCommunicationDraft).toContain('How you can help at home');
    expect(strategy.parentCommunicationDraft).toContain('Warm regards');
    expect(strategy.parentCommunicationDraft).toContain('Decodex Teaching Team');
  });

  it('should default to English when parent preferred_language is not set', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ display_name: 'Test Student', grade_level: 3 }],
    });

    mockedQuery.mockResolvedValueOnce({
      rows: [{
        rev: '5', sub: '3', omi: '2', ins: '1', bld: '4', pac: '2',
        uncertain: '0', total_errors: '17', total_words: '200', session_count: '3',
      }],
    });

    mockedQuery.mockResolvedValueOnce({
      rows: [
        { words_per_minute: 45, error_rate: 0.08, started_at: new Date().toISOString() },
        { words_per_minute: 42, error_rate: 0.09, started_at: new Date().toISOString() },
      ],
    });

    // Mock parent language lookup — returns null (no parent linked or no preference)
    mockedQuery.mockResolvedValueOnce({
      rows: [{ preferred_language: null }],
    });

    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const strategy = await generateStrategy(studentId, teacherId);

    // Should default to English
    expect(strategy.parentCommunicationDraft).toBeDefined();
    expect(strategy.parentCommunicationDraft).toContain('Dear Parent/Guardian');
    expect(strategy.parentCommunicationDraft).not.toContain('प्रिय अभिभावक');
  });

  it('should use parent language independent of student language', async () => {
    // Student prefers Hindi, but parent prefers English
    mockedQuery.mockResolvedValueOnce({
      rows: [{ display_name: 'Test Student', grade_level: 3 }],
    });

    mockedQuery.mockResolvedValueOnce({
      rows: [{
        rev: '5', sub: '3', omi: '2', ins: '1', bld: '4', pac: '2',
        uncertain: '0', total_errors: '17', total_words: '200', session_count: '3',
      }],
    });

    mockedQuery.mockResolvedValueOnce({
      rows: [
        { words_per_minute: 45, error_rate: 0.08, started_at: new Date().toISOString() },
      ],
    });

    // Parent language is English
    mockedQuery.mockResolvedValueOnce({
      rows: [{ preferred_language: 'en' }],
    });

    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const strategy = await generateStrategy(studentId, teacherId);

    // Draft should be in English (parent's language), not Hindi (student's language)
    expect(strategy.parentCommunicationDraft).toBeDefined();
    expect(strategy.parentCommunicationDraft).toContain('Dear Parent/Guardian');
    expect(strategy.parentCommunicationDraft).not.toContain('प्रिय अभिभावक');
  });
});