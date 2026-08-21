/**
 * Dex grading endpoint tests — validates spoken-answer grading behavior.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';
import { gradeSpokenAnswer } from '../services/dexTutor';
import { vi } from 'vitest';

const mockedGrade = vi.mocked(gradeSpokenAnswer);

const mockConsentGranted = () => {
  mockQuery.mockResolvedValueOnce({ rows: [{ consent_date: new Date().toISOString() }] });
};

describe('POST /api/v1/dex/grade-answer', () => {
  const token = generateTestToken(TEST_USERS.studentA);

  const validBody = {
    question: 'What color was the cat?',
    expectedAnswer: 'orange',
    studentTranscript: 'orange',
  };

  it('should return correct=true with encouraging feedback for a correct answer', async () => {
    mockConsentGranted();
    mockedGrade.mockResolvedValueOnce({
      correct: true,
      feedback: 'That\'s exactly right, great job!',
    });

    const res = await request(app)
      .post('/api/v1/dex/grade-answer')
      .set('Cookie', `token=${token}`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(true);
    expect(res.body.feedback).toBeTruthy();
    expect(typeof res.body.feedback).toBe('string');
  });

  it('should return correct=false with encouraging feedback for an incorrect answer', async () => {
    mockConsentGranted();
    mockedGrade.mockResolvedValueOnce({
      correct: false,
      feedback: 'Not quite — let\'s try that one again!',
    });

    const res = await request(app)
      .post('/api/v1/dex/grade-answer')
      .set('Cookie', `token=${token}`)
      .send({
        question: 'What color was the cat?',
        expectedAnswer: 'orange',
        studentTranscript: 'blue',
      });

    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(false);
    expect(res.body.feedback).toBeTruthy();
  });

  it('should return 400 when question is missing', async () => {
    mockConsentGranted();
    const res = await request(app)
      .post('/api/v1/dex/grade-answer')
      .set('Cookie', `token=${token}`)
      .send({ expectedAnswer: 'orange', studentTranscript: 'orange' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when expectedAnswer is missing', async () => {
    mockConsentGranted();
    const res = await request(app)
      .post('/api/v1/dex/grade-answer')
      .set('Cookie', `token=${token}`)
      .send({ question: 'What?', studentTranscript: 'orange' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when studentTranscript is missing', async () => {
    mockConsentGranted();
    const res = await request(app)
      .post('/api/v1/dex/grade-answer')
      .set('Cookie', `token=${token}`)
      .send({ question: 'What?', expectedAnswer: 'orange' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/dex/grade-answer')
      .send(validBody);

    expect(res.status).toBe(401);
  });
});
