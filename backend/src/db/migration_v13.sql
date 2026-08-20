-- =============================================================================
-- V13: Account lockout on failed login (Security fix C-2)
-- =============================================================================
-- Adds failed_login_attempts and locked_until to support per-account brute-force
-- protection: 5 failed attempts → 15-minute lockout, reset on successful login.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until)
    WHERE locked_until IS NOT NULL;
