/**
 * Dex Transcribe Language tests — verifies that the /transcribe endpoint
 * uses the student's preferred_language for transcription.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';
import { transcribeAudio } from '../services/openai';

// Mock transcribeAudio
vi.mock('../services/openai', () => ({
  transcribeAudio: vi.fn().mockResolvedValue('transcribed text'),
}));

const mockedTranscribeAudio = vi.mocked(transcribeAudio);

describe('Dex Transcribe Language Wiring', () => {
  const filePath = '/tmp/test-audio.wav';

  beforeEach(() => {
    vi.clearAllMocks();
    mockedTranscribeAudio.mockResolvedValue('transcribed text');
    mockQuery.mockReset();
  });

  it('should use student preferredLanguage "hi" for transcription when set on JWT', async () => {
    // Create token with preferredLanguage = 'hi'
    const hiToken = generateTestToken({ ...TEST_USERS.studentA, preferredLanguage: 'hi' });

    // Mock consent check (requireConsent middleware)
    mockQuery.mockResolvedValueOnce({
      rows: [{ consent_date: new Date().toISOString() }],
    });

    const res = await request(app)
      .post('/api/v1/dex/transcribe')
      .set('Cookie', `token=${hiToken}`)
      .attach('audio', Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), 'test.webm');

    expect(res.status).toBe(200);
    expect(res.body.transcript).toBe('transcribed text');

    // Verify transcribeAudio was called with language: 'hi'
    expect(mockedTranscribeAudio).toHaveBeenCalledWith(
      expect.any(String), // filePath
      undefined, // passageText
      'hi'
    );
  });

  it('should default to "en" when student preferredLanguage is not set on JWT', async () => {
    // Create token WITHOUT preferredLanguage
    const enToken = generateTestToken({ ...TEST_USERS.studentA });

    // Mock consent check (requireConsent middleware)
    mockQuery.mockResolvedValueOnce({
      rows: [{ consent_date: new Date().toISOString() }],
    });

    const res = await request(app)
      .post('/api/v1/dex/transcribe')
      .set('Cookie', `token=${enToken}`)
      .attach('audio', Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), 'test.webm');

    expect(res.status).toBe(200);
    expect(res.body.transcript).toBe('transcribed text');

    // Verify transcribeAudio was called with default language: 'en'
    expect(mockedTranscribeAudio).toHaveBeenCalledWith(
      expect.any(String), // filePath
      undefined, // passageText
      'en'
    );
  });

it('should use "en" when student preferredLanguage is explicitly "en" on JWT', async () => {
    const enToken = generateTestToken({ ...TEST_USERS.studentA, preferredLanguage: 'en' });

    // Mock consent check (requireConsent middleware)
    mockQuery.mockResolvedValueOnce({
      rows: [{ consent_date: new Date().toISOString() }],
    });

    const res = await request(app)
      .post('/api/v1/dex/transcribe')
      .set('Cookie', `token=${enToken}`)
      .attach('audio', Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), 'test.webm');

    expect(res.status).toBe(200);
    expect(res.body.transcript).toBe('transcribed text');

    expect(mockedTranscribeAudio).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      'en'
    );
  });
});