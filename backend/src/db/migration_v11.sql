-- =============================================================================
-- V11: Teacher Assignments + Student Assignment Rewards
-- =============================================================================

CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    instructions TEXT,
    due_date TIMESTAMPTZ,
    target_type VARCHAR(20) NOT NULL DEFAULT 'passage'
        CHECK (target_type IN ('passage')),
    passage_id UUID NOT NULL REFERENCES passages(id),
    scope VARCHAR(20) NOT NULL DEFAULT 'selected'
        CHECK (scope IN ('class', 'selected')),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS assignment_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned'
        CHECK (status IN ('assigned', 'in_progress', 'completed', 'late')),
    score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    session_id UUID REFERENCES reading_sessions(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    rewards_awarded BOOLEAN NOT NULL DEFAULT FALSE,
    reward_xp INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

ALTER TABLE reading_sessions
ADD COLUMN IF NOT EXISTS assignment_student_id UUID REFERENCES assignment_students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_passage ON assignments(passage_id);
CREATE INDEX IF NOT EXISTS idx_assignment_students_assignment ON assignment_students(assignment_id, status);
CREATE INDEX IF NOT EXISTS idx_assignment_students_student ON assignment_students(student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_students_session ON assignment_students(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_assignment_student ON reading_sessions(assignment_student_id) WHERE assignment_student_id IS NOT NULL;
