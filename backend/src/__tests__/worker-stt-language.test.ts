/**
 * Worker STT Language tests — verifies that the audio processing pipeline
 * uses the student's preferred_language for transcription.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQuery } from './helpers/setup';
import { processAudioJob } from '../queue/worker';
import { transcribeAudio } from '../services/openai';
import { alignText } from '../services/alignment';
import { classifyErrors } from '../services/classifier';
import { saveClassifications, updateErrorProfile } from '../db/analytics';
import { generateDrill } from '../services/drills';

// Mock all external dependencies
vi.mock('../services/openai', () => ({
  transcribeAudio: vi.fn().mockResolvedValue('transcribed text'),
}));

vi.mock('../services/alignment', () => ({
  alignText: vi.fn().mockResolvedValue({
    alignedPairs: [],
    alignmentScore: 1.0,
    statistics: { matched: 10, substituted: 0, omitted: 0, inserted: 0 },
  }),
}));

vi.mock('../services/classifier', () => ({
  classifyErrors: vi.fn().mockResolvedValue([]),
}));

vi.mock('../db/analytics', () => ({
  saveClassifications: vi.fn().mockResolvedValue(undefined),
  updateErrorProfile: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/drills', () => ({
  generateDrill: vi.fn().mockResolvedValue(undefined),
}));

// Mock dynamic imports used in the worker
vi.mock('../services/healthScore', () => ({
  computeHealthScore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/gamification', () => ({
  recordSessionCompletion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/assignments', () => ({
  completeAssignmentForSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('../routes/sessions', () => ({
  getSSEClient: vi.fn().mockReturnValue({ sendEvent: vi.fn() }),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    unlink: vi.fn((path, cb) => cb?.(null)),
  };
});

const mockedTranscribeAudio = vi.mocked(transcribeAudio);
const mockedQuery = vi.mocked(mockQuery);

describe('Worker STT Language Wiring', () => {
  const sessionId = 'test-session-id';
  const studentId = '11111111-1111-1111-1111-111111111111';
  const passageText = 'The small orange cat ran up the big green tree.';
  const filePath = '/tmp/test-audio.wav';

  beforeEach(() => {
    vi.clearAllMocks();
    mockedTranscribeAudio.mockResolvedValue('transcribed text');
    mockedQuery.mockReset();
  });

  it('should use student preferred_language "hi" for transcription when set', async () => {
    // Mock session lookup
    mockedQuery.mockResolvedValueOnce({
      rows: [{ student_id: studentId, started_at: new Date().toISOString() }],
    });

    // Mock student language lookup — returns 'hi'
    mockedQuery.mockResolvedValueOnce({
      rows: [{ preferred_language: 'hi' }],
    });

    // Mock subsequent DB calls (saveClassifications, updateErrorProfile, etc.)
    mockedQuery.mockResolvedValue({ rows: [] });

    const result = await processAudioJob({ sessionId, passageText, filePath });

    expect(result.success).toBe(true);

    // Verify transcribeAudio was called with language: 'hi'
    expect(mockedTranscribeAudio).toHaveBeenCalledWith(
      filePath,
      passageText,
      'hi'
    );
  });

  it('should default to "en" when student preferred_language is not set', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ student_id: studentId, started_at: new Date().toISOString() }],
    });

    // Mock student language lookup — returns null (no preference set)
    mockedQuery.mockResolvedValueOnce({
      rows: [{ preferred_language: null }],
    });

    mockedQuery.mockResolvedValue({ rows: [] });

    const result = await processAudioJob({ sessionId, passageText, filePath });

    expect(result.success).toBe(true);

    // Verify transcribeAudio was called with default language: 'en'
    expect(mockedTranscribeAudio).toHaveBeenCalledWith(
      filePath,
      passageText,
      'en'
    );
  });

  it('should use "en" when student preferred_language is explicitly "en"', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ student_id: studentId, started_at: new Date().toISOString() }],
    });

    mockedQuery.mockResolvedValueOnce({
      rows: [{ preferred_language: 'en' }],
    });

    mockedQuery.mockResolvedValue({ rows: [] });

    const result = await processAudioJob({ sessionId, passageText, filePath });

    expect(result.success).toBe(true);
    expect(mockedTranscribeAudio).toHaveBeenCalledWith(
      filePath,
      passageText,
      'en'
    );
  });
});
