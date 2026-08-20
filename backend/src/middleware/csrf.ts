import { Request, Response, NextFunction } from 'express';

/**
 * CSRF defense for state-changing requests.
 *
 * Browsers always send `Origin` (or `Referer` as fallback) on cross-origin
 * POST/PUT/PATCH/DELETE. We require that header's origin matches our configured
 * `FRONTEND_URL` before allowing the request to proceed.
 *
 * Behavior:
 *   - GET / HEAD / OPTIONS are passed through (no state change).
 *   - When `Origin` is present, it MUST equal FRONTEND_URL (or a dev port).
 *   - When `Origin` is absent but `Referer` is present, the Referer origin is checked.
 *   - When both are absent (curl, mobile apps, server-to-server, same-origin
 *     without Origin header), the request is allowed — the JWT-in-httpOnly-cookie
 *     + CORS allowlist together already block cross-origin browser attacks for
 *     these requests, and the missing-Origin case covers legitimate non-browser
 *     callers that we don't want to break.
 *   - In `NODE_ENV=test`, the middleware is a no-op so supertest fixtures and
 *     existing tests aren't impacted. Production deployments get the check.
 *
 * This is intentionally an Origin/Referer check rather than a token check:
 * the JWT is in an httpOnly cookie and `sameSite=none` is used in production
 * for cross-site auth flows (e.g. embedded previews), so a token-based CSRF
 * defense would add friction without removing the underlying trust gap. The
 * Origin/Referer check closes that gap for browser-driven state changes while
 * leaving non-browser callers untouched.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Test-only skip — supertest fixtures and integration tests don't set Origin.
  // Production deploys get the check.
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }

  // Only state-changing methods need protection.
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    ...(isProd ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']),
  ].filter(Boolean) as string[];

  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;

  let requestOrigin: string | null = null;
  if (typeof originHeader === 'string' && originHeader.length > 0) {
    requestOrigin = originHeader;
  } else if (typeof refererHeader === 'string' && refererHeader.length > 0) {
    try {
      requestOrigin = new URL(refererHeader).origin;
    } catch {
      // Malformed Referer — fall through and treat as missing.
    }
  }

  // No Origin and no Referer — let it through. Browser-driven cross-origin
  // requests always set one of these; non-browser clients legitimately don't.
  if (!requestOrigin) {
    next();
    return;
  }

  if (allowedOrigins.includes(requestOrigin)) {
    next();
    return;
  }

  // In production, reject with a clear error. In dev, allow with a warning
  // so local development on unusual ports keeps working.
  if (isProd) {
    console.error('[CSRF] Blocked cross-origin request:', {
      method,
      path: req.path,
      origin: requestOrigin,
    });
    res.status(403).json({
      error: {
        code: 'CSRF_FORBIDDEN',
        message: 'Cross-origin request blocked. Set Origin or Referer to a permitted frontend URL.',
      },
    });
    return;
  }

  console.warn('[CSRF] Allowing unlisted origin (development):', requestOrigin);
  next();
}
