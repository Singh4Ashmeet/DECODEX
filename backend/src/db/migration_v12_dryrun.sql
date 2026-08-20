-- =============================================================================
-- DRY-RUN: Preview backfill results for teacher_student_links
-- Run this to see expected counts BEFORE applying migration_v12.sql
-- =============================================================================

-- Signal 1: Assignments -> assignment_students
SELECT 'assignments' AS signal, COUNT(DISTINCT a.teacher_id || ':' || ast.student_id) AS pair_count
FROM assignments a
JOIN assignment_students ast ON ast.assignment_id = a.id
WHERE a.deleted_at IS NULL
  AND a.teacher_id IS NOT NULL
  AND ast.student_id IS NOT NULL

UNION ALL

-- Signal 2: classification_corrections -> error_classifications -> error_profiles
SELECT 'classification_corrections' AS signal, COUNT(DISTINCT cc.teacher_id || ':' || ep.student_id) AS pair_count
FROM classification_corrections cc
JOIN error_classifications ec ON ec.id = cc.error_id
JOIN error_profiles ep ON ep.session_id = ec.session_id
WHERE cc.teacher_id IS NOT NULL
  AND ep.student_id IS NOT NULL

UNION ALL

-- Signal 3: copilot_sessions
SELECT 'copilot_sessions' AS signal, COUNT(DISTINCT teacher_id || ':' || student_id) AS pair_count
FROM copilot_sessions
WHERE teacher_id IS NOT NULL
  AND student_id IS NOT NULL

UNION ALL

-- Total unique pairs across all signals (deduplicated)
SELECT 'TOTAL_UNIQUE' AS signal, COUNT(*) AS pair_count
FROM (
    SELECT a.teacher_id, ast.student_id
    FROM assignments a
    JOIN assignment_students ast ON ast.assignment_id = a.id
    WHERE a.deleted_at IS NULL
      AND a.teacher_id IS NOT NULL
      AND ast.student_id IS NOT NULL
    UNION
    SELECT cc.teacher_id, ep.student_id
    FROM classification_corrections cc
    JOIN error_classifications ec ON ec.id = cc.error_id
    JOIN error_profiles ep ON ep.session_id = ec.session_id
    WHERE cc.teacher_id IS NOT NULL
      AND ep.student_id IS NOT NULL
    UNION
    SELECT cs.teacher_id, cs.student_id
    FROM copilot_sessions cs
    WHERE cs.teacher_id IS NOT NULL
      AND cs.student_id IS NOT NULL
) combined;

-- Show which teachers would have ZERO links (need safety net)
SELECT t.id AS teacher_id, t.display_name, t.email,
       COALESCE(link_counts.link_count, 0) AS linked_students
FROM users t
LEFT JOIN (
    SELECT teacher_id, COUNT(*) AS link_count
    FROM (
        SELECT a.teacher_id, ast.student_id
        FROM assignments a
        JOIN assignment_students ast ON ast.assignment_id = a.id
        WHERE a.deleted_at IS NULL AND a.teacher_id IS NOT NULL AND ast.student_id IS NOT NULL
        UNION
        SELECT cc.teacher_id, ep.student_id
        FROM classification_corrections cc
        JOIN error_classifications ec ON ec.id = cc.error_id
        JOIN error_profiles ep ON ep.session_id = ec.session_id
        WHERE cc.teacher_id IS NOT NULL AND ep.student_id IS NOT NULL
        UNION
        SELECT cs.teacher_id, cs.student_id
        FROM copilot_sessions cs
        WHERE cs.teacher_id IS NOT NULL AND cs.student_id IS NOT NULL
    ) combined
    GROUP BY teacher_id
) link_counts ON link_counts.teacher_id = t.id
WHERE t.role = 'teacher' AND t.deleted_at IS NULL
ORDER BY linked_students ASC, t.display_name;

-- Show what the current school_id-based access would give (for comparison)
SELECT t.id AS teacher_id, t.display_name, COUNT(DISTINCT s.id) AS students_in_school
FROM users t
JOIN users s ON t.school_id = s.school_id
WHERE t.role = 'teacher' AND t.deleted_at IS NULL
  AND s.role = 'student' AND s.deleted_at IS NULL
  AND t.school_id IS NOT NULL
GROUP BY t.id, t.display_name;