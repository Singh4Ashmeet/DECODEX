/**
 * Classification Corrections tests — validates teacher feedback flow and cache invalidation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';
import { getCache, deleteCache, setCache } from '../services/cache';

const mockedGetCache = vi.mocked(getCache);
const mockedSetCache = vi.mocked(setCache);
const mockedDeleteCache = vi.mocked(deleteCache);

describe('POST /api/v1/sessions/:id/classifications/:errorIndex/feedback', () => {
  const teacherToken = generateTestToken(TEST_USERS.teacher);
  const sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const errorIndex = '0';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all cache mocks
    mockedGetCache.mockResolvedValue(null);
    mockedSetCache.mockResolvedValue(undefined);
    mockedDeleteCache.mockResolvedValue(undefined);
    // Reset mockQuery completely to clear any previous implementations/queues
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  function setupFeedbackMocks(classificationRow: any, correctionRow: any) {
    let callCount = 0;
    mockQuery.mockImplementation(async (sql: string) => {
      callCount++;
      if (callCount === 1) {
        // First call: fetch classification
        return { rows: classificationRow ? [classificationRow] : [] };
      } else if (callCount === 2) {
        // Second call: insert correction
        return { rows: correctionRow ? [correctionRow] : [] };
      }
      return { rows: [] };
    });
  }

  it('should allow teacher to submit correction', async () => {
    setupFeedbackMocks(
      { source_word: 'saw', spoken_word: 'was' },
      {
        id: 'correction-id',
        error_id: 'error-id',
        teacher_id: TEST_USERS.teacher.id,
        original_category: 'SUB',
        corrected_category: 'REV',
        created_at: new Date().toISOString(),
      }
    );

    await request(app)
      .post(`/api/v1/sessions/${sessionId}/classifications/${errorIndex}/feedback`)
      .set('Cookie', `token=${teacherToken}`)
      .send({ corrected_category: 'REV' });

    expect(mockedDeleteCache).toHaveBeenCalledWith('classify:sub:saw:was');
  });

  it('should deny non-teacher from submitting correction', async () => {
    const studentToken = generateTestToken(TEST_USERS.studentA);

    const res = await request(app)
      .post(`/api/v1/sessions/${sessionId}/classifications/${errorIndex}/feedback`)
      .set('Cookie', `token=${studentToken}`)
      .send({ corrected_category: 'REV' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should return 400 for invalid category', async () => {
    const res = await request(app)
      .post(`/api/v1/sessions/${sessionId}/classifications/${errorIndex}/feedback`)
      .set('Cookie', `token=${teacherToken}`)
      .send({ corrected_category: 'INVALID' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 when classification not found', async () => {
    setupFeedbackMocks(null, null);

    const res = await request(app)
      .post(`/api/v1/sessions/${sessionId}/classifications/${errorIndex}/feedback`)
      .set('Cookie', `token=${teacherToken}`)
      .send({ corrected_category: 'REV' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should invalidate classification cache when correction is submitted (omission)', async () => {
    setupFeedbackMocks(
      { source_word: 'the', spoken_word: null },
      {
        id: 'correction-id',
        error_id: 'error-id',
        teacher_id: TEST_USERS.teacher.id,
        original_category: 'SUB',
        corrected_category: 'OMI',
        created_at: new Date().toISOString(),
      }
    );

    await request(app)
      .post(`/api/v1/sessions/${sessionId}/classifications/${errorIndex}/feedback`)
      .set('Cookie', `token=${teacherToken}`)
      .send({ corrected_category: 'OMI' });

    expect(mockedDeleteCache).toHaveBeenCalledWith('classify:omi:the');
  });

  it('should invalidate classification cache when correction is submitted (insertion)', async () => {
    setupFeedbackMocks(
      { source_word: null, spoken_word: 'extra' },
      {
        id: 'correction-id',
        error_id: 'error-id',
        teacher_id: TEST_USERS.teacher.id,
        original_category: 'SUB',
        corrected_category: 'INS',
        created_at: new Date().toISOString(),
      }
    );

    await request(app)
      .post(`/api/v1/sessions/${sessionId}/classifications/${errorIndex}/feedback`)
      .set('Cookie', `token=${teacherToken}`)
      .send({ corrected_category: 'INS' });

    expect(mockedDeleteCache).toHaveBeenCalledWith('classify:ins:extra');
  });

  it('should normalize case and trim whitespace when computing cache key', async () => {
    setupFeedbackMocks(
      { source_word: '  Saw  ', spoken_word: '  WAS  ' },
      {
        id: 'correction-id',
        error_id: 'error-id',
        teacher_id: TEST_USERS.teacher.id,
        original_category: 'SUB',
        corrected_category: 'REV',
        created_at: new Date().toISOString(),
      }
    );

    await request(app)
      .post(`/api/v1/sessions/${sessionId}/classifications/${errorIndex}/feedback`)
      .set('Cookie', `token=${teacherToken}`)
      .send({ corrected_category: 'REV' });

    expect(mockedDeleteCache).toHaveBeenCalledWith('classify:sub:saw:was');
  });
});