-- Migration V7: Harden DOB Knowledge-Based Verification (KBV)
-- Adds exponential backoff cooldown, dedicated rate limiting, and audit logging
-- for consent token verification attempts.

-- Add cooldown tracking column to consent_tokens
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- Create audit table for consent verification attempts
CREATE TABLE IF NOT EXISTS consent_verification_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(255) NOT NULL,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(64),
    success BOOLEAN NOT NULL,
    failed_attempts_at_time INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_attempts_token ON consent_verification_attempts(token);
CREATE INDEX IF NOT EXISTS idx_consent_attempts_ip ON consent_verification_attempts(ip_address, created_at);