import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';

// Initialize Sentry before other imports that might throw
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
  console.log('[Sentry] Initialized — error reporting active');
} else {
  console.log('[Sentry] DSN not set — error reporting disabled');
}

import authRoutes from './routes/auth';
import passageRoutes from './routes/passages';
import sessionRoutes from './routes/sessions';
import analyticsRoutes from './routes/analytics';
import teacherRoutes from './routes/teacher';
import consentRoutes from './routes/consent';
import studentRoutes from './routes/students';

// V2 route modules — AI Intervention Platform
import healthScoreRoutes from './routes/healthScore';
import copilotRoutes from './routes/copilot';
import learningPathRoutes from './routes/learningPaths';
import storyRoutes from './routes/stories';
import gamificationRoutes from './routes/gamification';
import riskScreeningRoutes from './routes/riskScreening';
import classroomAnalyticsRoutes from './routes/classroomAnalytics';
import parentDashboardRoutes from './routes/parentDashboard';
import assignmentRoutes from './routes/assignments';

// V2 Dex Voice-First Tutor
import ttsRoutes from './routes/tts';
import dexRoutes from './routes/dex';

// Initialize DB schema & migrations
import { initDBWithRetry } from './db/init';

// Initialize background workers
import './queue/worker';

dotenv.config();

// --- Startup validation ---
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET is missing or too short (minimum 32 characters).');
  console.error('Generate one with: openssl rand -base64 32');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security and utility middlewares
// Trust first proxy (Render / Vercel reverse proxy) so rate limiter
// sees real client IPs instead of the proxy's IP.
app.set('trust proxy', 1);
app.use(helmet());

const isProd = process.env.NODE_ENV === 'production';

// Build explicit allowlist — no wildcards.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  // Dev-only explicit ports (Vite default = 5173). Add others here if needed.
  ...(isProd ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']),
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (curl, mobile apps, SSR) with no Origin header.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In production, reject anything not in the explicit allowlist.
      // In development, allow ANY origin with a warning — this is intentional for
      // local developer machines where tools (Storybook, Playwright, random ports)
      // may need access. This is NOT a bug; production strictly enforces the allowlist.
      if (isProd) {
        console.error('CORS blocked origin (production):', origin);
        return callback(new Error('Not allowed by CORS'));
      } else {
        console.warn('CORS allowing unlisted origin (development):', origin);
        return callback(null, true);
      }
    },
    credentials: true,
  })
);

// --- Rate limiting (Section 1e) ---
// In test environment, disable globalLimiter to avoid 429 in tests, but keep authLimiter for rate-limiting tests
const isTest = process.env.NODE_ENV?.trim() === 'test';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
});

export const globalLimiter = isTest
  ? (req: Request, res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
    });

app.use(express.json());
app.use(cookieParser());

// Apply strict rate limiter to auth endpoints
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/register/parent', authLimiter);
app.use('/api/v1/auth/login', authLimiter);

// Apply moderate global rate limiter to all API routes
app.use('/api/v1', globalLimiter);

// Routes — V1 Core
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/passages', passageRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/teacher', teacherRoutes);
app.use('/api/v1/consent', consentRoutes);
app.use('/api/v1/students', studentRoutes);

// Routes — V2 AI Intervention Platform
app.use('/api/v1/health-score', healthScoreRoutes);
app.use('/api/v1/copilot', copilotRoutes);
app.use('/api/v1/learning-paths', learningPathRoutes);
app.use('/api/v1/stories', storyRoutes);
app.use('/api/v1/gamification', gamificationRoutes);
app.use('/api/v1/risk-screening', riskScreeningRoutes);
app.use('/api/v1/classroom', classroomAnalyticsRoutes);
app.use('/api/v1/parent', parentDashboardRoutes);
app.use('/api/v1/assignments', assignmentRoutes);

// Routes — Dex Voice-First Tutor
app.use('/api/v1/tts', ttsRoutes);
app.use('/api/v1/dex', dexRoutes);

// Root route redirect to frontend app
app.get('/', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(frontendUrl);
});

async function checkDatabaseReadiness() {
  await queryCriticalTable('assignments', 'SELECT 1 FROM assignments LIMIT 1');
  await queryCriticalTable('assignment_students', 'SELECT 1 FROM assignment_students LIMIT 1');

  return {
    assignments: 'ok',
    assignment_students: 'ok',
  };
}

async function queryCriticalTable(name: string, sql: string) {
  try {
    await import('./db').then(({ query }) => query(sql));
  } catch (error) {
    throw Object.assign(new Error(`Critical table is not queryable: ${name}`), { cause: error });
  }
}

// Health/readiness check endpoint. Render uses this path before routing traffic.
app.get('/health', async (req, res) => {
  try {
    const criticalTables = await checkDatabaseReadiness();
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        criticalTables,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database readiness check failed',
      },
    });
  }
});

app.use('/api/v1', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found' } });
});

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled request error:', err);

  if (res.headersSent) {
    return next(err);
  }

  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600
    ? err.status
    : 500;
  const code = status >= 500 ? 'INTERNAL_ERROR' : err?.code || 'REQUEST_ERROR';
  const message = status >= 500 ? 'Internal server error' : err?.message || 'Request failed';

  res.status(status).json({ error: { code, message } });
});

async function startServer() {
  try {
    await initDBWithRetry({ label: 'Database startup initialization' });
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize database on startup:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
