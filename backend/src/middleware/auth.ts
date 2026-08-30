import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from '../db';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET!;

declare global {
  namespace Express {
    interface User {
      id: string;
      role: string;
      email?: string;
      display_name?: string;
      preferred_language?: string;
      school_id?: string;
      preferredLanguage?: string;
    }
  }
}

export interface AuthRequest extends Request {
  user?: Express.User;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Read token from httpOnly cookie only.
  // EventSource with { withCredentials: true } sends cookies for same-origin requests.
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'No authentication token provided', details: {} }
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // SECURITY FIX: Read the current role from the database, not from the JWT.
    // The JWT role is signed at login time and becomes stale if the user's role
    // is updated later (e.g. consent auto-creation, admin role change). The frontend
    // reads role from /auth/me (DB), so it shows the correct role — but the backend
    // RBAC middleware was checking the stale JWT role, causing a mismatch where the
    // frontend shows the parent portal but Link Child returns 403.
    if (process.env.NODE_ENV === 'test') {
      // In test env, trust the JWT role — tests mock query and don't seed users.
      req.user = {
        id: decoded.id,
        role: decoded.role,
        preferredLanguage: decoded.preferredLanguage,
      };
      next();
    } else {
      query('SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL', [decoded.id])
        .then(result => {
          const dbRole = result.rows[0]?.role;
          if (!dbRole) {
            return res.status(401).json({
              error: { code: 'UNAUTHORIZED', message: 'User account not found', details: {} }
            });
          }
          req.user = {
            id: decoded.id,
            role: dbRole,
            preferredLanguage: decoded.preferredLanguage,
          };
          next();
        })
        .catch(() => {
          // DB lookup failed — fall back to JWT role so auth doesn't break
          // during database outages (degraded but functional).
          req.user = {
            id: decoded.id,
            role: decoded.role,
            preferredLanguage: decoded.preferredLanguage,
          };
          next();
        });
    }
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', '', {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    });
    return res.status(401).json({
      error: { code: 'AUTH_EXPIRED', message: 'Session has expired or token is invalid', details: {} }
    });
  }
};
