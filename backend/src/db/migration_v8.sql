-- Migration V8: Dead-letter table for failed audio processing jobs
-- Stores jobs that have exhausted all retry attempts for debugging and replay.

CREATE TABLE IF NOT EXISTS failed_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_name VARCHAR(100) NOT NULL,
    session_id UUID REFERENCES reading_sessions(id) ON DELETE SET NULL,
    error_message TEXT,
    attempts_made INTEGER,
    job_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_jobs_session ON failed_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_failed_jobs_created ON failed_jobs(created_at);