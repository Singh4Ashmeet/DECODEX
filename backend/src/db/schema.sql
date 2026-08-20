-- Decodex Schema V1

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    district VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,    -- bcrypt hash (cost factor 12)
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher', 'parent', 'admin')),
    display_name VARCHAR(255) NOT NULL,
    school_id UUID REFERENCES schools(id),
    grade_level INTEGER,
    invite_code VARCHAR(10),                -- nullable for non-student roles
    date_of_birth DATE,                      -- nullable for non-student roles
    password_reset_token VARCHAR(255),       -- for password reset/set flow
    password_reset_expires TIMESTAMPTZ,      -- token expiry
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                   -- soft-delete support
);

-- Additive schema update for existing databases.
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;

-- Parent-Student Links
CREATE TABLE IF NOT EXISTS parent_student_links (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    consent_granted BOOLEAN DEFAULT FALSE,
    consent_date TIMESTAMPTZ,
    consent_ip INET,
    withdrawn_at TIMESTAMPTZ,
    hard_delete_at TIMESTAMPTZ,
    purged_at TIMESTAMPTZ,
    PRIMARY KEY (parent_id, student_id)
);

-- Additive schema update for existing databases.
ALTER TABLE parent_student_links ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();
ALTER TABLE parent_student_links ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
ALTER TABLE parent_student_links ADD COLUMN IF NOT EXISTS hard_delete_at TIMESTAMPTZ;
ALTER TABLE parent_student_links ADD COLUMN IF NOT EXISTS consent_ip INET;
ALTER TABLE parent_student_links ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ;

-- One-time email consent links. Knowledge-based verification is completed by the
-- future consent handler before a token can be marked as used.
-- parent_id is nullable to support pre-account verification (email + invite_code).
-- When parent_id is NULL, the token stores the parent's email; on confirm, we
-- either link to an existing parent account or auto-create one.
CREATE TABLE IF NOT EXISTS consent_tokens (
    token VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE consent_tokens ALTER COLUMN parent_id DROP NOT NULL;

-- Passages
CREATE TABLE IF NOT EXISTS passages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    grade_level INTEGER NOT NULL,
    lexile_score INTEGER,
    word_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS reading_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    passage_id UUID NOT NULL REFERENCES passages(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    words_per_minute REAL,
    transcript TEXT,                          -- STT output
    alignment_result JSONB,                  -- Full alignment diff
    audio_storage_key TEXT,                  -- Object storage key (e.g., studentId/sessionId.webm)
    audio_mime_type VARCHAR(50),             -- MIME type of stored audio
    audio_size_bytes INTEGER,                -- Size of stored audio in bytes
    audio_storage_provider VARCHAR(20) DEFAULT 'local', -- Storage provider: 'local' or 'supabase'
    status VARCHAR(20) DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'abandoned', 'error')),
    deleted_at TIMESTAMPTZ                   -- soft-delete support
);

-- New object storage columns (V5)
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS audio_storage_key TEXT;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS audio_mime_type VARCHAR(50);
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS audio_size_bytes INTEGER;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS audio_storage_provider VARCHAR(20) DEFAULT 'local';

-- Error classifications
-- NOTE: 'UNC' (Uncertain) is a valid fallback when the LLM is not confident.
-- 'PAC' (Pacing/Self-correction) is a valid teacher-assigned category.
CREATE TABLE IF NOT EXISTS error_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
    word_index INTEGER NOT NULL,
    source_word VARCHAR(100),
    spoken_word VARCHAR(100),
    category VARCHAR(3) NOT NULL
        CHECK (category IN ('REV', 'SUB', 'OMI', 'INS', 'BLD', 'PAC', 'UNC')),
    rationale TEXT,
    asr_confidence REAL,
    confidence_flag BOOLEAN DEFAULT FALSE,   -- true = uncertain classification
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                   -- soft-delete support
);

-- Classification Feedback (Teacher Corrections)
CREATE TABLE IF NOT EXISTS classification_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    error_id UUID NOT NULL REFERENCES error_classifications(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_category VARCHAR(3) NOT NULL,
    corrected_category VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregated error profiles (updated per session)
CREATE TABLE IF NOT EXISTS error_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
    rev_count INTEGER DEFAULT 0,
    sub_count INTEGER DEFAULT 0,
    omi_count INTEGER DEFAULT 0,
    ins_count INTEGER DEFAULT 0,
    bld_count INTEGER DEFAULT 0,
    pac_count INTEGER DEFAULT 0,
    uncertain_count INTEGER DEFAULT 0,
    total_words_read INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    error_rate REAL,                         -- total_errors / total_words_read
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                   -- soft-delete support
);

-- Generated drills
CREATE TABLE IF NOT EXISTS drills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_category VARCHAR(3) NOT NULL,
    drill_type VARCHAR(50),
    content JSONB NOT NULL,                  -- Drill content and instructions
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                   -- soft-delete support
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_student ON reading_sessions(student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_passage ON reading_sessions(passage_id);
CREATE INDEX IF NOT EXISTS idx_errors_session ON error_classifications(session_id);
CREATE INDEX IF NOT EXISTS idx_errors_category ON error_classifications(session_id, category);
CREATE INDEX IF NOT EXISTS idx_profiles_student ON error_profiles(student_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_drills_student ON drills(student_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code) WHERE invite_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_tokens_token ON consent_tokens(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_student_links_id ON parent_student_links(id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_hard_delete_at ON parent_student_links(hard_delete_at) WHERE hard_delete_at IS NOT NULL;

-- Partial indexes for soft-delete filtering
CREATE INDEX IF NOT EXISTS idx_users_active ON users(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_active ON reading_sessions(student_id, started_at DESC) WHERE deleted_at IS NULL;

-- V5: Audio storage indexes
CREATE INDEX IF NOT EXISTS idx_sessions_storage_key ON reading_sessions(audio_storage_key) WHERE audio_storage_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_student_storage ON reading_sessions(student_id, started_at DESC) WHERE audio_storage_key IS NOT NULL;
