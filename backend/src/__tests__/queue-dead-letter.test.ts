/**
 * Queue dead-letter handling tests — verifies that failed jobs are only
 * inserted into the failed_jobs table when retries are exhausted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockQuery } from './helpers/setup';

// Unmock the queue module so we can test the actual implementation
vi.unmock('../queue');

// Mock dependencies before importing the queue module
vi.mock('../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

vi.mock('../db', () => ({
  query: mockQuery,
}));

// Mock Redis/Bull to avoid real connections
vi.mock('bull', () => {
  const EventEmitter = require('events');
  class MockQueue extends EventEmitter {
    constructor(name: string, url: string, opts: any = {}) {
      super();
      this.name = name;
      this.opts = opts;
      // Simulate the failed event handler registration
      if (opts.defaultJobOptions?.attempts) {
        this.defaultAttempts = opts.defaultJobOptions.attempts;
      } else {
        this.defaultAttempts = 1;
      }
    }
    defaultAttempts = 1;
    on(event: string, handler: Function) {
      if (event === 'failed') {
        this.failedHandler = handler;
      }
      return super.on(event, handler);
    }
    // Helper to trigger the failed handler for testing
    _triggerFailed(job: any, err: Error) {
      if (this.failedHandler) {
        return this.failedHandler(job, err);
      }
    }
  }
  return { default: MockQueue };
});

// Import after mocks are set up
import { audioQueue } from '../queue/index';
import { logger } from '../lib/logger';
import * as Sentry from '@sentry/node';

const mockedLogger = vi.mocked(logger);
const mockedSentry = vi.mocked(Sentry.captureException);
const mockedQuery = vi.mocked(mockQuery);

describe('Queue Dead-Letter Handling', () => {
  const sessionId = 'test-session-id';
  const jobId = 'test-job-id';
  const errorMessage = 'Processing failed';
  const jobData = { sessionId, passageText: 'test passage', filePath: '/tmp/test.wav' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedQuery.mockResolvedValue({ rows: [] });
    // Set SENTRY_DSN so Sentry capture is triggered
    process.env.SENTRY_DSN = 'https://test@sentry.io/123';
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.SENTRY_DSN;
  });

  it('should insert into failed_jobs when attemptsMade equals configured attempts (retries exhausted)', async () => {
    // Create a mock job with attemptsMade = 3 (equal to default attempts: 3)
    const mockJob = {
      id: jobId,
      data: jobData,
      attemptsMade: 3,
      opts: { attempts: 3 },
    };

    const mockError = new Error(errorMessage);

    // Trigger the failed handler directly
    await (audioQueue as any)._triggerFailed(mockJob, mockError);

    // Verify logger.error was called with structured fields
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId,
        sessionId,
        attemptsMade: 3,
      }),
      'Job permanently failed after all retries'
    );

    // Verify Sentry.captureException was called
    expect(mockedSentry).toHaveBeenCalledWith(mockError, {
      extra: { jobId, sessionId },
    });

    // Verify query was called to insert into failed_jobs
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO failed_jobs'),
      ['audio-processing', sessionId, errorMessage, 3, JSON.stringify(jobData)]
    );
  });

  it('should NOT insert into failed_jobs when attemptsMade is less than configured attempts (retry in progress)', async () => {
    // Create a mock job with attemptsMade = 1 (less than default attempts: 3)
    const mockJob = {
      id: jobId,
      data: jobData,
      attemptsMade: 1,
      opts: { attempts: 3 },
    };

    const mockError = new Error(errorMessage);

    await (audioQueue as any)._triggerFailed(mockJob, mockError);

    // Verify logger.error was NOT called (since retries are still in progress)
    expect(mockedLogger.error).not.toHaveBeenCalled();

    // Verify Sentry.captureException was NOT called
    expect(mockedSentry).not.toHaveBeenCalled();

    // Verify query was NOT called to insert into failed_jobs
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('should insert into failed_jobs with correct session_id and attempts_made when retries exhausted', async () => {
    const customSessionId = 'custom-session-123';
    const customJobData = { sessionId: customSessionId, passageText: 'custom passage', filePath: '/tmp/custom.wav' };

    const mockJob = {
      id: jobId,
      data: customJobData,
      attemptsMade: 3,
      opts: { attempts: 3 },
    };

    const mockError = new Error('Custom error');

    await (audioQueue as any)._triggerFailed(mockJob, mockError);

    // Verify the insert was called with correct session_id and attempts_made
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO failed_jobs'),
      ['audio-processing', customSessionId, 'Custom error', 3, JSON.stringify(customJobData)]
    );
  });

  it('should handle job with null sessionId gracefully', async () => {
    const mockJob = {
      id: jobId,
      data: { passageText: 'test', filePath: '/tmp/test.wav' }, // No sessionId
      attemptsMade: 3,
      opts: { attempts: 3 },
    };

    const mockError = new Error('No session error');

    await (audioQueue as any)._triggerFailed(mockJob, mockError);

    // Verify query was called with null session_id
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO failed_jobs'),
      ['audio-processing', null, 'No session error', 3, JSON.stringify(mockJob.data)]
    );
  });

  it('should use job.opts.attempts when available, defaulting to 1', async () => {
    // Job with custom attempts setting
    const mockJob = {
      id: jobId,
      data: jobData,
      attemptsMade: 5,
      opts: { attempts: 5 },
    };

    const mockError = new Error('Custom attempts error');

    await (audioQueue as any)._triggerFailed(mockJob, mockError);

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO failed_jobs'),
      ['audio-processing', sessionId, 'Custom attempts error', 5, JSON.stringify(jobData)]
    );
  });

  it('should default to 1 attempt when job.opts.attempts is undefined', async () => {
    const mockJob = {
      id: jobId,
      data: jobData,
      attemptsMade: 1,
      opts: {}, // No attempts configured
    };

    const mockError = new Error('Default attempts error');

    await (audioQueue as any)._triggerFailed(mockJob, mockError);

    // Should insert since attemptsMade (1) >= default (1)
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO failed_jobs'),
      ['audio-processing', sessionId, 'Default attempts error', 1, JSON.stringify(jobData)]
    );
  });
});