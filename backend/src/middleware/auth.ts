import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

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
    req.user = {
      id: decoded.id,
      role: decoded.role,
      preferredLanguage: decoded.preferredLanguage,
    };
    next();
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
