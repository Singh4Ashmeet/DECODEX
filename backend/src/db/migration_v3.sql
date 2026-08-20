-- =============================================================================
-- Decodex Schema V3 — Multi-Language Support Foundation
-- Run AFTER migration_v2.sql has been applied.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. User Preferred Language — All roles (student, teacher, parent, admin)
--    Default 'en' (English). Students and parents in the same family
--    may have different preferred languages.
-- ---------------------------------------------------------------------------
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) NOT NULL DEFAULT 'en';

-- Index for querying users by language (useful for localized notifications, etc.)
CREATE INDEX IF NOT EXISTS idx_users_preferred_language ON users(preferred_language) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Seed Data Update — Ensure existing demo users have preferred_language set
--    (The ALTER TABLE DEFAULT handles new rows; this backfills existing rows.)
-- ---------------------------------------------------------------------------
UPDATE users SET preferred_language = 'en' WHERE preferred_language IS NULL;