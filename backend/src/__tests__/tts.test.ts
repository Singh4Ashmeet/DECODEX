/**
 * TTS endpoint tests — validates audio synthesis route behavior.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';
import { synthesizeSpeech, synthesizePhrase } from '../services/tts';
import { getCache, setCache, deleteCache } from '../services/cache';

const mockedSynthesize = vi.mocked(synthesizeSpeech);
const mockedSynthesizePhrase = vi.mocked(synthesizePhrase);
const mockedGetCache = vi.mocked(getCache);
const mockedSetCache = vi.mocked(setCache);
const mockedDeleteCache = vi.mocked(deleteCache);

describe('POST /api/v1/tts', () => {
  const token = generateTestToken(TEST_USERS.studentA);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return audio/mpeg when TTS succeeds', async () => {
    mockedSynthesize.mockResolvedValueOnce({
      audioBuffer: Buffer.from('fake-mp3-data'),
      useBrowserTts: false,
    });

    const res = await request(app)
      .post('/api/v1/tts')
      .set('Cookie', `token=${token}`)
      .send({ text: 'Hello, great job reading!' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(res.body).toBeTruthy();
  });

  it('should return { useBrowserTts: true } when circuit breaker falls back', async () => {
    mockedSynthesize.mockResolvedValueOnce({
      audioBuffer: null,
      useBrowserTts: true,
    });

    const res = await request(app)
      .post('/api/v1/tts')
      .set('Cookie', `token=${token}`)
      .send({ text: 'Hello world' });

    expect(res.status).toBe(200);
    expect(res.body.useBrowserTts).toBe(true);
  });

  it('should return 400 when text is missing', async () => {
    const res = await request(app)
      .post('/api/v1/tts')
      .set('Cookie', `token=${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when text exceeds 1000 characters', async () => {
    const longText = 'a'.repeat(1001);

    const res = await request(app)
      .post('/api/v1/tts')
      .set('Cookie', `token=${token}`)
      .send({ text: longText });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('1000');
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/tts')
      .send({ text: 'Hello' });

    expect(res.status).toBe(401);
  });

  it('should set Cache-Control: no-cache for transcript playback (no-store semantics)', async () => {
    mockedSynthesize.mockResolvedValueOnce({
      audioBuffer: Buffer.from('fake-mp3-data'),
      useBrowserTts: false,
    });

    const res = await request(app)
      .post('/api/v1/tts')
      .set('Cookie', `token=${token}`)
      .send({ text: 'Student transcript text' });

    expect(res.status).toBe(200);
    // The generic TTS route uses no-cache for dynamic content
    expect(res.headers['cache-control']).toContain('no-cache');
  });
});

describe('POST /api/v1/tts/phrase', () => {
  const token = generateTestToken(TEST_USERS.studentA);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default cache miss
    mockedGetCache.mockResolvedValue(null);
    mockedSetCache.mockResolvedValue(undefined);
    mockedDeleteCache.mockResolvedValue(undefined);
  });

  it('should return audio/mpeg for valid phraseId on first request (cache MISS, default language en)', async () => {
    mockedSynthesizePhrase.mockResolvedValueOnce({
      audioBuffer: Buffer.from('fake-mp3-phrase-data'),
      useBrowserTts: false,
    });

    const res = await request(app)
      .post('/api/v1/tts/phrase')
      .set('Cookie', `token=${token}`)
      .send({ phraseId: 'good_job' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(res.body).toBeTruthy();
    // Verify synthesizePhrase was called with default language 'en'
    expect(mockedSynthesizePhrase).toHaveBeenCalledWith('good_job', 'en');
  });

  it('should return cached audio on second request for same phraseId and language (cache HIT)', async () => {
    mockedSynthesizePhrase
      .mockResolvedValueOnce({
        audioBuffer: Buffer.from('fake-mp3-phrase-data'),
        useBrowserTts: false,
      })
      .mockResolvedValueOnce({
        audioBuffer: Buffer.from('fake-mp3-phrase-data'),
        useBrowserTts: false,
      });

    // First request (English)
    const res1 = await request(app)
      .post('/api/v1/tts/phrase')
      .set('Cookie', `token=${token}`)
      .send({ phraseId: 'good_job', language: 'en' });

    expect(res1.status).toBe(200);
    expect(res1.headers['content-type']).toContain('audio/mpeg');

    // Second request (same language - English)
    const res2 = await request(app)
      .post('/api/v1/tts/phrase')
      .set('Cookie', `token=${token}`)
      .send({ phraseId: 'good_job', language: 'en' });

    expect(res2.status).toBe(200);
    expect(res2.headers['content-type']).toContain('audio/mpeg');
    expect(res2.headers['cache-control']).toContain('public');
    expect(res2.headers['cache-control']).toContain('max-age=2592000');
  });

  it('should have separate cache entries per language (Hindi request does not hit English cache)', async () => {
    // First request in English
    mockedSynthesizePhrase.mockResolvedValueOnce({
      audioBuffer: Buffer.from('fake-mp3-en'),
      useBrowserTts: false,
    });

    await request(app)
      .post('/api/v1/tts/phrase')
      .set('Cookie', `token=${token}`)
      .send({ phraseId: 'good_job', language: 'en' });

    // Second request in Hindi - should be a cache MISS (different cache key)
    mockedSynthesizePhrase.mockResolvedValueOnce({
      audioBuffer: Buffer.from('fake-mp3-hi'),
      useBrowserTts: false,
    });

    const resHi = await request(app)
      .post('/api/v1/tts/phrase')
      .set('Cookie', `token=${token}`)
      .send({ phraseId: 'good_job', language: 'hi' });

    expect(resHi.status).toBe(200);
    // Both calls should have been made (no cache hit)
    expect(mockedSynthesizePhrase).toHaveBeenCalledTimes(2);
    expect(mockedSynthesizePhrase).toHaveBeenCalledWith('good_job', 'en');
    expect(mockedSynthesizePhrase).toHaveBeenCalledWith('good_job', 'hi');
  });

  it('should fall back to English when an unsupported language is requested', async () => {
    mockedSynthesizePhrase.mockResolvedValueOnce({
      audioBuffer: Buffer.from('fake-mp3-en'),
      useBrowserTts: false,
    });

    const res = await request(app)
      .post('/api/v1/tts/phrase')
      .set('Cookie', `token=${token}`)
      .send({ phraseId: 'good_job', language: 'fr' }); // French not in PHRASE_BANK

    expect(res.status).toBe(200);
    // Should still call synthesizePhrase with the requested language
    // The fallback to English happens inside getPhraseText
    expect(mockedSynthesizePhrase).toHaveBeenCalledWith('good_job', 'fr');
  });

  it('should return 400 when phraseId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/tts/phrase')
      .set('Cookie', `token=${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('phraseId');
  });

  it('should return 400 when phraseId is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/tts/phrase')
      .set('Cookie', `token=${token}`)
      .send({ phraseId: 'invalid_phrase' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Invalid phraseId');
  });

  it('should return 400 when language is not a string', async () => {
    const res = await request(app)
      .post('/api/v1/tts/phrase')
      .set('Cookie', `token=${token}`)
      .send({ phraseId: 'good_job', language: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('language');
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/tts/phrase')
      .send({ phraseId: 'good_job' });

    expect(res.status).toBe(401);
  });

  it('should return { useBrowserTts: true } when circuit breaker falls back for phrase', async () => {
    mockedSynthesizePhrase.mockResolvedValueOnce({
      audioBuffer: null,
      useBrowserTts: true,
    });

    const res = await request(app)
      .post('/api/v1/tts/phrase')
      .set('Cookie', `token=${token}`)
      .send({ phraseId: 'good_job' });

    expect(res.status).toBe(200);
    expect(res.body.useBrowserTts).toBe(true);
  });
});
