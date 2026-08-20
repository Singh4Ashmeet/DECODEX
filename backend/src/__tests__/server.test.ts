import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { mockQuery } from './helpers/setup';
import app from '../server';

describe('Server readiness and error boundaries', () => {
  it('returns structured JSON for unknown API routes', async () => {
    const response = await request(app).get('/api/v1/not-a-real-route');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'API route not found',
    });
  });

  it('marks health as unavailable when assignment tables are not queryable', async () => {
    mockQuery.mockRejectedValueOnce(Object.assign(
      new Error('relation "assignments" does not exist'),
      { code: '42P01' }
    ));

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database readiness check failed',
    });
  });
});
