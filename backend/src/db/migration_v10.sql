-- =============================================================================
-- V10: Demo school backfill for teacher-scoped classroom/Copilot access
-- =============================================================================

INSERT INTO schools (id, name, district)
VALUES ('99999999-9999-9999-9999-999999999999', 'Decodex Demo School', 'Demo District')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    district = EXCLUDED.district;

UPDATE users
SET school_id = '99999999-9999-9999-9999-999999999999',
    updated_at = NOW()
WHERE email IN ('teacher@decodex.com', 'student@decodex.com', 'demostudent@decodex.com')
  AND deleted_at IS NULL;
