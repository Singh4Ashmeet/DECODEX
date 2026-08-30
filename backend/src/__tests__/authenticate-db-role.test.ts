/**
 * Authenticate middleware — DB role override tests.
 *
 * Proves that the authenticate middleware reads the current role from the
 * database rather than trusting the stale JWT role claim. This was the root
 * cause of the "Link Child returns 403" bug: the JWT was signed with
 * role='student' at login time, but the DB had role='parent' (from a later
 * role update or consent auto-creation). The frontend showed the parent
 * portal (DB role), but RBAC rejected state-changing requests (JWT role).
 *
 * These tests temporarily set NODE_ENV to a non-test value so the middleware
 * exercises its production code path (DB query), then restore it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { mockQuery } from './helpers/setup';

const JWT_SECRET = process.env.JWT_SECRET!;

// We need to dynamically import the middleware after potentially tweaking
// NODE_ENV, but since the module is already loaded, we call the function
// directly. The middleware imports `query` from the mocked `../../db` module,
// so mockQuery applies.

// Re-import the authenticate function — it uses the mocked `query`
import { authenticate, AuthRequest } from '../middleware/auth';

// Helper to build a mock Express req/res/next
function mockReqResNext(cookieToken?: string) {
  const req = {
    cookies: cookieToken ? { token: cookieToken } : {},
    user: undefined as any,
  } as AuthRequest;

  let jsonBody: any = null;
  let statusCode = 200;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(body: any) { jsonBody = body; return this; },
    cookie() { return this; },
    get statusCode() { return statusCode; },
    get jsonBody() { return jsonBody; },
  } as any;

  const next = vi.fn();

  return { req, res, next };
}

describe('Authenticate middleware — DB role override', () => {
  const savedNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    // Restore NODE_ENV
    process.env.NODE_ENV = savedNodeEnv;
    mockQuery.mockReset();
  });

  it('reads the role from the DB instead of the JWT when NODE_ENV is production', async () => {
    // Simulate production environment
    process.env.NODE_ENV = 'production';

    // Create a JWT with role='student' (stale — simulates old login)
    const token = jwt.sign(
      { id: 'test-user-id', role: 'student', preferredLanguage: 'en' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Mock the DB query to return role='parent' (current DB state)
    mockQuery.mockResolvedValueOnce({
      rows: [{ role: 'parent' }],
    });

    const { req, res, next } = mockReqResNext(token);

    // Invoke the authenticate middleware
    authenticate(req, res, next);

    // Wait for the async DB query to resolve
    await new Promise(resolve => setTimeout(resolve, 50));

    // next() should have been called (auth succeeded)
    expect(next).toHaveBeenCalled();

    // req.user.role should be 'parent' — from the DB, NOT 'student' from the JWT
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('parent');
    expect(req.user.id).toBe('test-user-id');

    // The DB query should have been issued
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT role FROM users'),
      ['test-user-id']
    );
  });

  it('falls back to JWT role when the DB query fails', async () => {
    process.env.NODE_ENV = 'production';

    const token = jwt.sign(
      { id: 'test-user-id', role: 'student', preferredLanguage: 'en' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Simulate a DB failure
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));

    const { req, res, next } = mockReqResNext(token);

    authenticate(req, res, next);
    await new Promise(resolve => setTimeout(resolve, 50));

    // next() should still be called (graceful degradation)
    expect(next).toHaveBeenCalled();

    // req.user.role should fall back to JWT role ('student')
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('student');
  });

  it('returns 401 when the DB lookup finds no user', async () => {
    process.env.NODE_ENV = 'production';

    const token = jwt.sign(
      { id: 'deleted-user-id', role: 'admin', preferredLanguage: 'en' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // DB returns no rows (user deleted or not found)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { req, res, next } = mockReqResNext(token);

    authenticate(req, res, next);
    await new Promise(resolve => setTimeout(resolve, 50));

    // next() should NOT be called
    expect(next).not.toHaveBeenCalled();

    // Should return 401
    expect(res.statusCode).toBe(401);
    expect(res.jsonBody.error.code).toBe('UNAUTHORIZED');
  });

  it('trusts JWT role directly in test mode (NODE_ENV=test)', async () => {
    process.env.NODE_ENV = 'test';

    const token = jwt.sign(
      { id: 'test-user-id', role: 'student', preferredLanguage: 'en' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // No DB query should be made in test mode
    const { req, res, next } = mockReqResNext(token);

    authenticate(req, res, next);

    // next() should be called synchronously (no async DB query)
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('student'); // from JWT, not DB

    // No DB query should have been made
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('proves the JWT/DB role divergence scenario: student JWT, parent DB → parent role', async () => {
    // This is the EXACT scenario that caused the Link Child 403 bug.
    process.env.NODE_ENV = 'production';

    // User registered via /auth/register → JWT signed with role='student'
    const staleToken = jwt.sign(
      { id: 'ashmeet-id', role: 'student', preferredLanguage: 'en' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Later, admin or consent flow updated DB role to 'parent'
    mockQuery.mockResolvedValueOnce({
      rows: [{ role: 'parent' }],
    });

    const { req, res, next } = mockReqResNext(staleToken);

    authenticate(req, res, next);
    await new Promise(resolve => setTimeout(resolve, 50));

    // The middleware must use the DB role ('parent'), not the JWT role ('student')
    expect(req.user.role).toBe('parent');

    // If this were the OLD code (trusting JWT), req.user.role would be 'student'
    // and requireRole(['parent', 'admin']) would return 403 on Link Child.
    // With the fix, RBAC sees 'parent' and allows the request through.
  });
});
