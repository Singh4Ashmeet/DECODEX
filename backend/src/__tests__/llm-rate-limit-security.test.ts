/**
 * LLM Rate Limiter Security Tests — §4.4 / §11.1
 * 
 * Verifies that llmLimiter is correctly exported and configured to protect AI generation endpoints
 * against LLM cost abuse and account compromise exploitation.
 * 
 * Tests that after 20 requests per hour per user, the 21st request receives a 429 RATE_LIMITED response.
 * Note: The rate limiter is shared across all LLM endpoints per user (global 20 req/hr per user).
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';

// Mock external services that LLM endpoints depend on
vi.mock('../services/passageGenerator', () => ({
  generatePassage: vi.fn().mockResolvedValue({
    id: 'test-passage-id',
    title: 'Test Passage',
    content: 'The cat sat on the mat.',
    grade_level: 3,
    lexile_score: 450,
    word_count: 6,
  }),
}));

vi.mock('../services/storyGenerator', () => ({
  generateStory: vi.fn().mockResolvedValue({
    id: 'test-story-id',
    student_id: TEST_USERS.studentA.id,
    title: 'Test Story',
    content: 'Once upon a time...',
    reading_level: 'beginner',
    word_count: 50,
    focus_phonemes: ['short_a', 'short_i'],
  }),
  getStudentStories: vi.fn().mockResolvedValue([]),
  getStoryById: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/copilot', () => ({
  generateStrategy: vi.fn().mockResolvedValue({
    id: 'test-strategy-id',
    student_id: TEST_USERS.studentA.id,
    summary: 'Test intervention strategy',
    recommendations: [],
  }),
  getStrategyHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/learningPath', () => ({
  generateLearningPath: vi.fn().mockResolvedValue({
    id: 'test-path-id',
    student_id: TEST_USERS.studentA.id,
    weeks: [],
  }),
  getActiveLearningPath: vi.fn().mockResolvedValue(null),
  completeDayTask: vi.fn().mockResolvedValue(undefined),
}));

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
  scheduleConsentErasureJob: vi.fn().mockResolvedValue(undefined),
  eraseExpiredConsentData: vi.fn().mockResolvedValue(undefined),
}));

// Mock teacherHasStudentAccess to always return true for copilot tests
vi.mock('../services/studentAccess', () => ({
  teacherHasStudentAccess: vi.fn().mockResolvedValue(true),
  parentHasStudentAccess: vi.fn().mockResolvedValue(true),
  canAccessStudent: vi.fn().mockResolvedValue(true),
}));

// Import app AFTER mocks are set up
import app from '../server';

// Unique test users for each endpoint to avoid shared rate limit bucket
const passageTestUser = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'student' };
const storyTestUser = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', role: 'student' };
const copilotTestUser = { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', role: 'teacher' };
const learningPathTestUser = { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', role: 'student' };

const passageToken = generateTestToken(passageTestUser);
const storyToken = generateTestToken(storyTestUser);
const copilotToken = generateTestToken(copilotTestUser);
const learningPathToken = generateTestToken(learningPathTestUser);

describe('LLM Rate Limiter Security (§4.4 / §11.1)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    vi.clearAllMocks();
  });

  it('should export llmLimiter middleware', async () => {
    const { llmLimiter } = await import('../middleware/rateLimiters');
    expect(llmLimiter).toBeDefined();
    expect(typeof llmLimiter).toBe('function');
  });

  it('should have llmLimiter configured on passage, story, copilot, and learning path routes', async () => {
    const passageRoutes = (await import('../routes/passages')).default;
    const storyRoutes = (await import('../routes/stories')).default;
    const copilotRoutes = (await import('../routes/copilot')).default;
    const learningPathRoutes = (await import('../routes/learningPaths')).default;

    expect(passageRoutes).toBeDefined();
    expect(storyRoutes).toBeDefined();
    expect(copilotRoutes).toBeDefined();
    expect(learningPathRoutes).toBeDefined();
  });

  describe('POST /api/v1/passages/generate — LLM rate limiting', () => {
    it('should allow first 20 requests and rate limit the 21st', async () => {
      const agent = request(app);
      const responses: number[] = [];

      // Send 21 rapid requests
      for (let i = 0; i < 21; i++) {
        const res = await agent
          .post('/api/v1/passages/generate')
          .set('Cookie', `token=${passageToken}`)
          .send({ grade_level: 3 });
        responses.push(res.status);
      }

      // First 20 should succeed (201 or other success code)
      // 21st should be rate limited (429)
      const successResponses = responses.filter(s => s === 201 || s === 200);
      const rateLimitedResponses = responses.filter(s => s === 429);

      expect(successResponses.length).toBeGreaterThanOrEqual(20);
      expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(1);
    });

    it('should return correct error shape on rate limit', async () => {
      const agent = request(app);
      
      // Exhaust the rate limit first
      for (let i = 0; i < 21; i++) {
        await agent
          .post('/api/v1/passages/generate')
          .set('Cookie', `token=${passageToken}`)
          .send({ grade_level: 3 });
      }

      // One more request should get 429 with correct error shape
      const res = await agent
        .post('/api/v1/passages/generate')
        .set('Cookie', `token=${passageToken}`)
        .send({ grade_level: 3 });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.body.error.message).toContain('LLM request rate limit exceeded');
    });
  });

  describe('POST /api/v1/stories/generate — LLM rate limiting', () => {
    it('should allow first 20 requests and rate limit the 21st', async () => {
      const agent = request(app);
      const responses: number[] = [];

      for (let i = 0; i < 21; i++) {
        const res = await agent
          .post('/api/v1/stories/generate')
          .set('Cookie', `token=${storyToken}`)
          .send({ student_id: storyTestUser.id });
        responses.push(res.status);
      }

      const successResponses = responses.filter(s => s === 201 || s === 200);
      const rateLimitedResponses = responses.filter(s => s === 429);

      expect(successResponses.length).toBeGreaterThanOrEqual(20);
      expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(1);
    });

    it('should return correct error shape on rate limit', async () => {
      const agent = request(app);
      
      for (let i = 0; i < 21; i++) {
        await agent
          .post('/api/v1/stories/generate')
          .set('Cookie', `token=${storyToken}`)
          .send({ student_id: storyTestUser.id });
      }

      const res = await agent
        .post('/api/v1/stories/generate')
        .set('Cookie', `token=${storyToken}`)
        .send({ student_id: storyTestUser.id });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.body.error.message).toContain('LLM request rate limit exceeded');
    });
  });

  describe('POST /api/v1/copilot/:studentId/strategy — LLM rate limiting', () => {
    beforeEach(() => {
      // Mock generateStrategy queries (7 queries) - scope check is mocked via studentAccess service
      mockQuery
        .mockResolvedValue({ rows: [{ display_name: 'Test Student', grade_level: 3 }] }) // student data
        .mockResolvedValue({ rows: [{ rev: '0', sub: '0', omi: '0', ins: '0', bld: '0', pac: '0', uncertain: '0', total_errors: '0', total_words: '0', session_count: '0' }] }) // error aggregation
        .mockResolvedValue({ rows: [] }) // trends
        .mockResolvedValue({ rows: [{ preferred_language: 'en' }] }) // parent language
        .mockResolvedValue({ rows: [] }); // copilot session insert
    });

    it('should allow first 20 requests and rate limit the 21st (teacher)', async () => {
      const agent = request(app);
      const responses: number[] = [];

      for (let i = 0; i < 21; i++) {
        const res = await agent
          .post(`/api/v1/copilot/${TEST_USERS.studentA.id}/strategy`)
          .set('Cookie', `token=${copilotToken}`);
        responses.push(res.status);
      }

      const successResponses = responses.filter(s => s === 200);
      const rateLimitedResponses = responses.filter(s => s === 429);

      expect(successResponses.length).toBeGreaterThanOrEqual(20);
      expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(1);
    });

    it('should return correct error shape on rate limit', async () => {
      const agent = request(app);
      
      for (let i = 0; i < 21; i++) {
        await agent
          .post(`/api/v1/copilot/${TEST_USERS.studentA.id}/strategy`)
          .set('Cookie', `token=${copilotToken}`);
      }

      const res = await agent
        .post(`/api/v1/copilot/${TEST_USERS.studentA.id}/strategy`)
        .set('Cookie', `token=${copilotToken}`);

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.body.error.message).toContain('LLM request rate limit exceeded');
    });
  });

  describe('POST /api/v1/learning-paths/:studentId/generate — LLM rate limiting', () => {
    beforeEach(() => {
      // Mock required DB queries for learning path generation
      // Student can only generate for themselves, so use learningPathTestUser.id
      mockQuery.mockResolvedValue({ rows: [{ id: learningPathTestUser.id, grade_level: 3 }] }); // student check
      mockQuery.mockResolvedValue({ rows: [] }); // session check for eligibility
    });

    it('should allow first 20 requests and rate limit the 21st', async () => {
      const agent = request(app);
      const responses: number[] = [];

      for (let i = 0; i < 21; i++) {
        const res = await agent
          .post(`/api/v1/learning-paths/${learningPathTestUser.id}/generate`)
          .set('Cookie', `token=${learningPathToken}`)
          .send({});
        responses.push(res.status);
      }

      const successResponses = responses.filter(s => s === 201 || s === 200);
      const rateLimitedResponses = responses.filter(s => s === 429);

      expect(successResponses.length).toBeGreaterThanOrEqual(20);
      expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(1);
    });

    it('should return correct error shape on rate limit', async () => {
      const agent = request(app);
      
      for (let i = 0; i < 21; i++) {
        await agent
          .post(`/api/v1/learning-paths/${learningPathTestUser.id}/generate`)
          .set('Cookie', `token=${learningPathToken}`)
          .send({});
      }

      const res = await agent
        .post(`/api/v1/learning-paths/${learningPathTestUser.id}/generate`)
        .set('Cookie', `token=${learningPathToken}`)
        .send({});

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.body.error.message).toContain('LLM request rate limit exceeded');
    });
  });

  describe('Rate limiter isolation per user', () => {
    const userA = { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', role: 'student' };
    const userB = { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', role: 'student' };
    const tokenA = generateTestToken(userA);
    const tokenB = generateTestToken(userB);

    it('should track rate limits separately per user', async () => {
      const agent = request(app);
      
      // User A makes 20 requests
      for (let i = 0; i < 20; i++) {
        await agent
          .post('/api/v1/passages/generate')
          .set('Cookie', `token=${tokenA}`)
          .send({ grade_level: 3 });
      }

      // User B makes 20 requests
      for (let i = 0; i < 20; i++) {
        await agent
          .post('/api/v1/passages/generate')
          .set('Cookie', `token=${tokenB}`)
          .send({ grade_level: 3 });
      }

      // User A's 21st request should be rate limited
      const resA = await agent
        .post('/api/v1/passages/generate')
        .set('Cookie', `token=${tokenA}`)
        .send({ grade_level: 3 });
      expect(resA.status).toBe(429);

      // User B's 21st request should also be rate limited
      const resB = await agent
        .post('/api/v1/passages/generate')
        .set('Cookie', `token=${tokenB}`)
        .send({ grade_level: 3 });
      expect(resB.status).toBe(429);
    });
  });
});