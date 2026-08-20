import Queue from 'bull';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import { logger } from '../lib/logger';
import { query } from '../db';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Track whether we've already warned about Redis being unavailable
let redisWarned = false;

const isTls = redisUrl.startsWith('rediss://');

const redisOptions: any = {
  maxRetriesPerRequest: null,
  retryStrategy(times: number): number | null {
    if (times === 1 && !redisWarned) {
      redisWarned = true;
      logger.warn({ redisUrl }, 'Redis is not available — Bull queues will not process jobs');
    }
    return Math.min(times * 2000, 30000);
  },
  enableReadyCheck: false,
};

if (isTls) {
  redisOptions.tls = { rejectUnauthorized: false };
}

export const audioQueue = new Queue('audio-processing', redisUrl, {
  redis: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

export const consentErasureQueue = new Queue('consent-erasure', redisUrl, {
  redis: redisOptions,
});

export interface AudioJobData {
  sessionId: string;
  passageText: string;
  filePath: string;
}

// Only log queue errors that are NOT ECONNREFUSED (those are already handled by retryStrategy)
audioQueue.on('error', (error: any) => {
  if (error?.code !== 'ECONNREFUSED') {
    logger.error({ err: error }, 'Bull queue error');
  }
});

consentErasureQueue.on('error', (error: any) => {
  if (error?.code !== 'ECONNREFUSED') {
    logger.error({ err: error }, 'Consent erasure queue error');
  }
});

// Dead-letter handling for audioQueue — fires only after all retries are exhausted
audioQueue.on('failed', async (job, err) => {
  if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
    logger.error({ jobId: job.id, sessionId: job.data?.sessionId, err, attemptsMade: job.attemptsMade }, 'Job permanently failed after all retries');
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, { extra: { jobId: job.id, sessionId: job.data?.sessionId } });
    }
    await query(
      `INSERT INTO failed_jobs (queue_name, session_id, error_message, attempts_made, job_data) VALUES ($1, $2, $3, $4, $5)`,
      ['audio-processing', job.data?.sessionId ?? null, err.message, job.attemptsMade, JSON.stringify(job.data)]
    );
  }
});
