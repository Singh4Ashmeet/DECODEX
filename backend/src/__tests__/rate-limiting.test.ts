/**
 * Rate limiting tests — proves repeated requests past the limit get 429.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { mockQuery } from './helpers/setup';
import app from '../server';

describe('Rate Limiting', () => {
  it('should return 429 after exceeding auth rate limit (50 requests / 15 min)', async () => {
    // Mock: each login attempt returns "invalid credentials" (not a server error)
    mockQuery.mockResolvedValue({ rows: [] });

    const agent = request(app);
    const responses: number[] = [];

    // Send 52 rapid requests to /api/v1/auth/login
    for (let i = 0; i < 52; i++) {
      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email: 'test@decodex.com', password: 'password123' });
      responses.push(res.status);
    }

    // The first 50 should go through (401 — invalid credentials)
    // Requests 51+ should get 429
    const rateLimited = responses.filter(s => s === 429);
    expect(rateLimited.length).toBeGreaterThanOrEqual(1);

    // Verify the 429 response has the correct error shape
    const lastRes = await agent
      .post('/api/v1/auth/login')
      .send({ email: 'test@decodex.com', password: 'password123' });

    if (lastRes.status === 429) {
      expect(lastRes.body.error.code).toBe('RATE_LIMITED');
    }
  });
});
