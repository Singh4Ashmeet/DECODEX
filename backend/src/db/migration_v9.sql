-- Migration V9: User Reading Preferences
-- Stores per-user reading accessibility settings (font scale, line spacing, letter spacing)
-- as a single cohesive JSONB object to allow future extension without schema changes.

ALTER TABLE users ADD COLUMN IF NOT EXISTS reading_preferences JSONB;