-- Migration V5: Audio Object Storage
-- Adds object storage columns to reading_sessions for moving audio from base64 in PG to object storage

-- Add new audio storage columns (idempotent)
ALTER TABLE reading_sessions
    ADD COLUMN IF NOT EXISTS audio_storage_key TEXT,
    ADD COLUMN IF NOT EXISTS audio_mime_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS audio_size_bytes INTEGER,
    ADD COLUMN IF NOT EXISTS audio_storage_provider VARCHAR(20) DEFAULT 'local';

-- Add deprecation comments only if the legacy columns actually exist (safe on fresh DBs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reading_sessions' AND column_name = 'audio_file_path'
  ) THEN
    COMMENT ON COLUMN reading_sessions.audio_file_path IS 'DEPRECATED: Path to temp audio file (moved to object storage in V5)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reading_sessions' AND column_name = 'audio_base64'
  ) THEN
    COMMENT ON COLUMN reading_sessions.audio_base64 IS 'DEPRECATED: Base64 encoded audio (moved to object storage in V5)';
  END IF;
END $$;

COMMENT ON COLUMN reading_sessions.audio_storage_key IS 'Object storage key (e.g., studentId/sessionId.webm)';
COMMENT ON COLUMN reading_sessions.audio_mime_type IS 'MIME type of stored audio';
COMMENT ON COLUMN reading_sessions.audio_size_bytes IS 'Size of stored audio in bytes';
COMMENT ON COLUMN reading_sessions.audio_storage_provider IS 'Storage provider: local or supabase';

-- Indexes for audio storage queries
CREATE INDEX IF NOT EXISTS idx_sessions_storage_key ON reading_sessions(audio_storage_key) WHERE audio_storage_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_student_storage ON reading_sessions(student_id, started_at DESC) WHERE audio_storage_key IS NOT NULL;