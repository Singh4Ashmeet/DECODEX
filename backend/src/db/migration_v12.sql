-- =============================================================================
-- V12: Teacher-Student Links table for explicit access control
-- =============================================================================
-- This table replaces the over-broad school_id-based teacher access with
-- explicit teacher-student relationships. Backfilled from real signals:
--   1. assignments + assignment_students (teacher created assignment for student)
--   2. classification_corrections (teacher corrected student's errors)
--   3. copilot_sessions (teacher generated intervention strategy for student)
-- =============================================================================

CREATE TABLE IF NOT EXISTS teacher_student_links (
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_student_links_teacher
    ON teacher_student_links(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_student_links_student
    ON teacher_student_links(student_id);

-- Backfill from real signals
-- Signal 1: Teachers who created assignments for students
INSERT INTO teacher_student_links (teacher_id, student_id, class_name, created_at)
SELECT DISTINCT a.teacher_id, ast.student_id, 'Assignment: ' || a.title, a.created_at
FROM assignments a
JOIN assignment_students ast ON ast.assignment_id = a.id
WHERE a.deleted_at IS NULL
  AND a.teacher_id IS NOT NULL
  AND ast.student_id IS NOT NULL
ON CONFLICT (teacher_id, student_id) DO NOTHING;

-- Signal 2: Teachers who corrected student error classifications
INSERT INTO teacher_student_links (teacher_id, student_id, class_name, created_at)
SELECT DISTINCT cc.teacher_id, ep.student_id, 'Error Review', cc.created_at
FROM classification_corrections cc
JOIN error_classifications ec ON ec.id = cc.error_id
JOIN error_profiles ep ON ep.session_id = ec.session_id
WHERE cc.teacher_id IS NOT NULL
  AND ep.student_id IS NOT NULL
ON CONFLICT (teacher_id, student_id) DO NOTHING;

-- Signal 3: Teachers who generated copilot intervention strategies for students
INSERT INTO teacher_student_links (teacher_id, student_id, class_name, created_at)
SELECT DISTINCT cs.teacher_id, cs.student_id, 'Copilot Strategy', cs.created_at
FROM copilot_sessions cs
WHERE cs.teacher_id IS NOT NULL
  AND cs.student_id IS NOT NULL
ON CONFLICT (teacher_id, student_id) DO NOTHING;