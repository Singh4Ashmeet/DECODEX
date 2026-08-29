-- Migration V14: Add email_hash for deterministic email lookup
-- Emails are PII-encrypted with random IV, so we can't query by ciphertext.
-- This HMAC-SHA256 hash is deterministic and allows O(1) email lookups.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);

-- Backfill existing users (plaintext emails get hashed directly)
-- Encrypted emails must be decrypted first — this is handled by the application.
-- For now, create the index on the new column.

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash ON users (email_hash) WHERE deleted_at IS NULL AND email_hash IS NOT NULL;
