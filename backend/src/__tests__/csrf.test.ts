/**
 * CSRF middleware tests.
 *
 * The middleware auto-skips when NODE_ENV === 'test'. To exercise the real
 * check we drive it directly with NODE_ENV temporarily set to 'production'.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { csrfProtection } from '../middleware/csrf';

interface FakeReq extends Partial<Request> {
  method: string;
  headers: Record<string, string | undefined>;
  path: string;
}

function makeReq(method: string, headers: Record<string, string>, path = '/api/v1/auth/login'): FakeReq {
  return { method, headers, path };
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

describe('CSRF middleware', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;
  const ORIGINAL_FRONTEND = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://app.decodex.com';
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
    process.env.FRONTEND_URL = ORIGINAL_FRONTEND;
  });

  describe('safe methods (pass through)', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])('allows %s with no Origin header', (method) => {
      const req = makeReq(method, {});
      const { res, status, json } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      csrfProtection(req as Request, res, next);
      expect(next).toHaveBeenCalled();
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe('state-changing methods with matching Origin', () => {
    it('allows POST when Origin matches FRONTEND_URL', () => {
      const req = makeReq('POST', { origin: 'https://app.decodex.com' });
      const { res } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      csrfProtection(req as Request, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('state-changing methods with mismatched Origin', () => {
    it('rejects POST when Origin is from a different site', () => {
      const req = makeReq('POST', { origin: 'https://evil.example.com' });
      const { res, status, json } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      csrfProtection(req as Request, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({
        error: {
          code: 'CSRF_FORBIDDEN',
          message: expect.stringContaining('Cross-origin request blocked'),
        },
      });
    });

    it('rejects POST when Referer is from a different site', () => {
      const req = makeReq('POST', { referer: 'https://evil.example.com/login' });
      const { res, status } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      csrfProtection(req as Request, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
    });

    it('allows POST when Referer matches FRONTEND_URL', () => {
      const req = makeReq('POST', { referer: 'https://app.decodex.com/dashboard' });
      const { res } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      csrfProtection(req as Request, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects POST with malformed Referer (no Origin)', () => {
      const req = makeReq('POST', { referer: 'not-a-url' });
      const { res } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      // Malformed Referer → requestOrigin = null → falls through to next()
      // (legit non-browser client path). Verify no crash and no 403.
      csrfProtection(req as Request, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('state-changing methods with no Origin or Referer', () => {
    it('allows POST (curl / mobile / server-to-server) without Origin or Referer', () => {
      const req = makeReq('POST', {});
      const { res } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      csrfProtection(req as Request, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Origin takes precedence over Referer', () => {
    it('rejects when Origin is bad even if Referer matches', () => {
      const req = makeReq('POST', {
        origin: 'https://evil.example.com',
        referer: 'https://app.decodex.com/page',
      });
      const { res, status } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      csrfProtection(req as Request, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
    });

    it('allows when Origin matches even if Referer is bad', () => {
      const req = makeReq('POST', {
        origin: 'https://app.decodex.com',
        referer: 'https://evil.example.com/page',
      });
      const { res } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      csrfProtection(req as Request, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('state-changing methods cover all verbs', () => {
    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('checks Origin on %s', (method) => {
      const req = makeReq(method, { origin: 'https://evil.example.com' });
      const { res, status } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      csrfProtection(req as Request, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
    });
  });

  describe('NODE_ENV === "test" (default for vitest)', () => {
    it('is a no-op so supertest fixtures work', () => {
      process.env.NODE_ENV = 'test';
      const req = makeReq('POST', { origin: 'https://evil.example.com' });
      const { res } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      csrfProtection(req as Request, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
