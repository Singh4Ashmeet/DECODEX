-- Migration V6: Drop deprecated audio_base64 and audio_file_path columns
-- Run after backfill-audio-base64.ts script confirms zero rows remain with
-- audio_base64 IS NOT NULL and audio_file_path is equally unused post-migration

-- Drop the deprecated base64 column
ALTER TABLE reading_sessions DROP COLUMN IF EXISTS audio_base64;

-- Drop the deprecated file path column (also moved to object storage in V5)
ALTER TABLE reading_sessions DROP COLUMN IF EXISTS audio_file_path;