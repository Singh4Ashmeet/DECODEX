-- =============================================================================
-- Decodex Schema V4 — Streak Freeze Mechanism
-- Run AFTER migration_v3.sql has been applied.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Streak Freeze Tracking — Allow up to 2 missed days per calendar month
--    before the streak resets.
-- ---------------------------------------------------------------------------
ALTER TABLE gamification_profiles
ADD COLUMN IF NOT EXISTS freeze_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS freeze_month VARCHAR(7);  -- Format: 'YYYY-MM'

-- Index for efficient freeze queries
CREATE INDEX IF NOT EXISTS idx_gamification_profiles_freeze_month ON gamification_profiles(freeze_month);