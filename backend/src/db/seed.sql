-- =============================================================================
-- Decodex Demo Seed Data
-- Runs only when the users table is empty (see db/init.ts guard).
-- All bcrypt hashes generated at cost 12 for password: password123
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Demo School
-- ---------------------------------------------------------------------------

INSERT INTO schools (id, name, district)
VALUES ('99999999-9999-9999-9999-999999999999', 'Decodex Demo School', 'Demo District')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    district = EXCLUDED.district;

-- ---------------------------------------------------------------------------
-- 1. Demo Users
-- ---------------------------------------------------------------------------

-- Original test student (kept for backward compatibility)
INSERT INTO users (email, password_hash, role, display_name, school_id, grade_level, invite_code, date_of_birth) VALUES
('student@decodex.com', '$2b$12$UbTLYYnuUKm8U3V5/U/UP.g.g0Ya2CA6.kKoFI.d6bG8zSsxKLBC.', 'student', 'Aarav', '99999999-9999-9999-9999-999999999999', 4, 'AARAV2026', '2016-04-15')
ON CONFLICT (email) DO NOTHING;

-- Demo teacher
INSERT INTO users (id, email, password_hash, role, display_name, school_id)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'teacher@decodex.com',
        '$2b$12$yIemge/MYhyjI.BAc4eDkeD1Ou2QuUJYsNCZ6oDbGHJ1Vtnnqmqqi',
        'teacher',
        'Ms. Rivera',
        '99999999-9999-9999-9999-999999999999')
ON CONFLICT (email) DO NOTHING;

-- Demo admin
INSERT INTO users (id, email, password_hash, role, display_name)
VALUES ('dddddddd-1111-2222-3333-444444444444',
        'admin@decodex.com',
        '$2b$12$yIemge/MYhyjI.BAc4eDkeD1Ou2QuUJYsNCZ6oDbGHJ1Vtnnqmqqi',
        'admin',
        'Admin User')
ON CONFLICT (email) DO NOTHING;

-- Demo student (invite_code + date_of_birth for consent KBV flow)
INSERT INTO users (id, email, password_hash, role, display_name, school_id, grade_level, invite_code, date_of_birth)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'demostudent@decodex.com',
        '$2b$12$z4d5ohfZ4LBonaoA9ErWdu/wSswymg13ms/uCkExv.uir4oRYkkSO',
        'student',
        'Sam',
        '99999999-9999-9999-9999-999999999999',
        3,
        'DEMO01',
        '2017-03-22')
ON CONFLICT (email) DO NOTHING;

-- Demo parent (pre-consented so demo works without live email)
INSERT INTO users (id, email, password_hash, role, display_name)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc',
        'parent@decodex.com',
        '$2b$12$iWn3Y7ACEAZK9Bk.qMWOg.IS2ecHTVkdv54X4OvPrxNuI5pLasAWa',
        'parent',
        'Jordan (Parent)')
ON CONFLICT (email) DO NOTHING;

-- Parent-student link with pre-granted consent
INSERT INTO parent_student_links (parent_id, student_id, consent_granted, consent_date)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        TRUE,
        NOW())
ON CONFLICT (parent_id, student_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Passages (unchanged from original seed)
-- ---------------------------------------------------------------------------

INSERT INTO passages (id, title, content, grade_level, lexile_score, word_count) VALUES
('11111111-1111-1111-1111-111111111111', 'The Cat in the Tree', 'The small orange cat ran up the big green tree. It was very scared. A dog barked loud at the bottom. The cat went higher and higher. Then a man came with a tall ladder. He climbed up and saved the little cat. The cat purred and was happy to be down.', 1, 250, 48),

('22222222-2222-2222-2222-222222222222', 'A Trip to the Moon', 'Imagine taking a rocket ship to the moon. You would need a special suit to breathe because there is no air in space. The moon has no wind or rain, so footprints stay there forever. You could jump very high because gravity is much weaker there than on Earth. It would be a quiet and dusty place.', 3, 600, 59),

('33333333-3333-3333-3333-333333333333', 'The Water Cycle', 'Water is always moving on Earth. The sun heats up water in oceans and lakes, causing it to turn into an invisible gas called water vapor. This is evaporation. As the vapor rises into the cool sky, it turns back into tiny liquid drops, forming clouds. This is condensation. When the drops get heavy, they fall as rain or snow, which is precipitation. Finally, the water flows back into rivers and oceans, and the cycle begins again.', 5, 850, 77)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Completed Reading Sessions for demo student
-- ---------------------------------------------------------------------------

-- Session 1: "The Cat in the Tree" (passage 1, grade 1)
-- Transcript deliberately includes word-level errors:
--   "saw" for "was" (REV — classic b/d-family reversal)
--   "house" for "higher" (SUB — visually similar substitution)
--   skipped "loud" (OMI — omission)
--   "happy" → "glad" (SUB)

INSERT INTO reading_sessions (id, student_id, passage_id, started_at, completed_at, duration_seconds, words_per_minute, transcript, alignment_result, status)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '95 seconds',
  95,
  30.3,
  'The small orange cat ran up the big green tree. It saw very scared. A dog barked at the bottom. The cat went house and higher. Then a man came with a tall ladder. He climbed up and saved the little cat. The cat purred and was glad to be down.',
  '[
    {"sourceWord":"the","spokenWord":"the","type":"match","index":0},
    {"sourceWord":"small","spokenWord":"small","type":"match","index":1},
    {"sourceWord":"orange","spokenWord":"orange","type":"match","index":2},
    {"sourceWord":"cat","spokenWord":"cat","type":"match","index":3},
    {"sourceWord":"ran","spokenWord":"ran","type":"match","index":4},
    {"sourceWord":"up","spokenWord":"up","type":"match","index":5},
    {"sourceWord":"the","spokenWord":"the","type":"match","index":6},
    {"sourceWord":"big","spokenWord":"big","type":"match","index":7},
    {"sourceWord":"green","spokenWord":"green","type":"match","index":8},
    {"sourceWord":"tree","spokenWord":"tree","type":"match","index":9},
    {"sourceWord":"it","spokenWord":"it","type":"match","index":10},
    {"sourceWord":"was","spokenWord":"saw","type":"substitution","index":11},
    {"sourceWord":"very","spokenWord":"very","type":"match","index":12},
    {"sourceWord":"scared","spokenWord":"scared","type":"match","index":13},
    {"sourceWord":"a","spokenWord":"a","type":"match","index":14},
    {"sourceWord":"dog","spokenWord":"dog","type":"match","index":15},
    {"sourceWord":"barked","spokenWord":"barked","type":"match","index":16},
    {"sourceWord":"loud","spokenWord":null,"type":"omission","index":17},
    {"sourceWord":"at","spokenWord":"at","type":"match","index":18},
    {"sourceWord":"the","spokenWord":"the","type":"match","index":19},
    {"sourceWord":"bottom","spokenWord":"bottom","type":"match","index":20},
    {"sourceWord":"the","spokenWord":"the","type":"match","index":21},
    {"sourceWord":"cat","spokenWord":"cat","type":"match","index":22},
    {"sourceWord":"went","spokenWord":"went","type":"match","index":23},
    {"sourceWord":"higher","spokenWord":"house","type":"substitution","index":24},
    {"sourceWord":"and","spokenWord":"and","type":"match","index":25},
    {"sourceWord":"higher","spokenWord":"higher","type":"match","index":26},
    {"sourceWord":"then","spokenWord":"then","type":"match","index":27},
    {"sourceWord":"a","spokenWord":"a","type":"match","index":28},
    {"sourceWord":"man","spokenWord":"man","type":"match","index":29},
    {"sourceWord":"came","spokenWord":"came","type":"match","index":30},
    {"sourceWord":"with","spokenWord":"with","type":"match","index":31},
    {"sourceWord":"a","spokenWord":"a","type":"match","index":32},
    {"sourceWord":"tall","spokenWord":"tall","type":"match","index":33},
    {"sourceWord":"ladder","spokenWord":"ladder","type":"match","index":34},
    {"sourceWord":"he","spokenWord":"he","type":"match","index":35},
    {"sourceWord":"climbed","spokenWord":"climbed","type":"match","index":36},
    {"sourceWord":"up","spokenWord":"up","type":"match","index":37},
    {"sourceWord":"and","spokenWord":"and","type":"match","index":38},
    {"sourceWord":"saved","spokenWord":"saved","type":"match","index":39},
    {"sourceWord":"the","spokenWord":"the","type":"match","index":40},
    {"sourceWord":"little","spokenWord":"little","type":"match","index":41},
    {"sourceWord":"cat","spokenWord":"cat","type":"match","index":42},
    {"sourceWord":"the","spokenWord":"the","type":"match","index":43},
    {"sourceWord":"cat","spokenWord":"cat","type":"match","index":44},
    {"sourceWord":"purred","spokenWord":"purred","type":"match","index":45},
    {"sourceWord":"and","spokenWord":"and","type":"match","index":46},
    {"sourceWord":"was","spokenWord":"was","type":"match","index":47},
    {"sourceWord":"happy","spokenWord":"glad","type":"substitution","index":48},
    {"sourceWord":"to","spokenWord":"to","type":"match","index":49},
    {"sourceWord":"be","spokenWord":"be","type":"match","index":50},
    {"sourceWord":"down","spokenWord":"down","type":"match","index":51}
  ]',
  'completed'
)
ON CONFLICT (id) DO NOTHING;

-- Session 2: "A Trip to the Moon" (passage 2, grade 3)
-- Transcript errors:
--   "taking" → "talking" (SUB — visually similar)
--   "breathe" → "breath" (SUB — suffix confusion)
--   omitted "no" before "wind" (OMI)
--   "weaker" → "weeker" (REV-style phoneme reversal, classified REV)
--   inserted "really" before "quiet" (INS)

INSERT INTO reading_sessions (id, student_id, passage_id, started_at, completed_at, duration_seconds, words_per_minute, transcript, alignment_result, status)
VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day' + INTERVAL '130 seconds',
  130,
  27.2,
  'Imagine talking a rocket ship to the moon. You would need a special suit to breath because there is no air in space. The moon has wind or rain, so footprints stay there forever. You could jump very high because gravity is much weeker there than on Earth. It would be a really quiet and dusty place.',
  '[
    {"sourceWord":"imagine","spokenWord":"imagine","type":"match","index":0},
    {"sourceWord":"taking","spokenWord":"talking","type":"substitution","index":1},
    {"sourceWord":"a","spokenWord":"a","type":"match","index":2},
    {"sourceWord":"rocket","spokenWord":"rocket","type":"match","index":3},
    {"sourceWord":"ship","spokenWord":"ship","type":"match","index":4},
    {"sourceWord":"to","spokenWord":"to","type":"match","index":5},
    {"sourceWord":"the","spokenWord":"the","type":"match","index":6},
    {"sourceWord":"moon","spokenWord":"moon","type":"match","index":7},
    {"sourceWord":"you","spokenWord":"you","type":"match","index":8},
    {"sourceWord":"would","spokenWord":"would","type":"match","index":9},
    {"sourceWord":"need","spokenWord":"need","type":"match","index":10},
    {"sourceWord":"a","spokenWord":"a","type":"match","index":11},
    {"sourceWord":"special","spokenWord":"special","type":"match","index":12},
    {"sourceWord":"suit","spokenWord":"suit","type":"match","index":13},
    {"sourceWord":"to","spokenWord":"to","type":"match","index":14},
    {"sourceWord":"breathe","spokenWord":"breath","type":"substitution","index":15},
    {"sourceWord":"because","spokenWord":"because","type":"match","index":16},
    {"sourceWord":"there","spokenWord":"there","type":"match","index":17},
    {"sourceWord":"is","spokenWord":"is","type":"match","index":18},
    {"sourceWord":"no","spokenWord":"no","type":"match","index":19},
    {"sourceWord":"air","spokenWord":"air","type":"match","index":20},
    {"sourceWord":"in","spokenWord":"in","type":"match","index":21},
    {"sourceWord":"space","spokenWord":"space","type":"match","index":22},
    {"sourceWord":"the","spokenWord":"the","type":"match","index":23},
    {"sourceWord":"moon","spokenWord":"moon","type":"match","index":24},
    {"sourceWord":"has","spokenWord":"has","type":"match","index":25},
    {"sourceWord":"no","spokenWord":null,"type":"omission","index":26},
    {"sourceWord":"wind","spokenWord":"wind","type":"match","index":27},
    {"sourceWord":"or","spokenWord":"or","type":"match","index":28},
    {"sourceWord":"rain","spokenWord":"rain","type":"match","index":29},
    {"sourceWord":"so","spokenWord":"so","type":"match","index":30},
    {"sourceWord":"footprints","spokenWord":"footprints","type":"match","index":31},
    {"sourceWord":"stay","spokenWord":"stay","type":"match","index":32},
    {"sourceWord":"there","spokenWord":"there","type":"match","index":33},
    {"sourceWord":"forever","spokenWord":"forever","type":"match","index":34},
    {"sourceWord":"you","spokenWord":"you","type":"match","index":35},
    {"sourceWord":"could","spokenWord":"could","type":"match","index":36},
    {"sourceWord":"jump","spokenWord":"jump","type":"match","index":37},
    {"sourceWord":"very","spokenWord":"very","type":"match","index":38},
    {"sourceWord":"high","spokenWord":"high","type":"match","index":39},
    {"sourceWord":"because","spokenWord":"because","type":"match","index":40},
    {"sourceWord":"gravity","spokenWord":"gravity","type":"match","index":41},
    {"sourceWord":"is","spokenWord":"is","type":"match","index":42},
    {"sourceWord":"much","spokenWord":"much","type":"match","index":43},
    {"sourceWord":"weaker","spokenWord":"weeker","type":"substitution","index":44},
    {"sourceWord":"there","spokenWord":"there","type":"match","index":45},
    {"sourceWord":"than","spokenWord":"than","type":"match","index":46},
    {"sourceWord":"on","spokenWord":"on","type":"match","index":47},
    {"sourceWord":"earth","spokenWord":"earth","type":"match","index":48},
    {"sourceWord":"it","spokenWord":"it","type":"match","index":49},
    {"sourceWord":"would","spokenWord":"would","type":"match","index":50},
    {"sourceWord":"be","spokenWord":"be","type":"match","index":51},
    {"sourceWord":"a","spokenWord":"a","type":"match","index":52},
    {"sourceWord":null,"spokenWord":"really","type":"insertion","index":53},
    {"sourceWord":"quiet","spokenWord":"quiet","type":"match","index":54},
    {"sourceWord":"and","spokenWord":"and","type":"match","index":55},
    {"sourceWord":"dusty","spokenWord":"dusty","type":"match","index":56},
    {"sourceWord":"place","spokenWord":"place","type":"match","index":57}
  ]',
  'completed'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Error Classifications (O-G taxonomy)
-- ---------------------------------------------------------------------------

-- Session 1 errors:
--   index 11: "was"→"saw"  — REV (classic reversal)
--   index 17: "loud"→null  — OMI (omission)
--   index 24: "higher"→"house" — SUB (visually similar substitution)
--   index 48: "happy"→"glad"  — SUB (semantic substitution)

INSERT INTO error_classifications (id, session_id, word_index, source_word, spoken_word, category, rationale) VALUES
('dd000001-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 11, 'was', 'saw', 'REV',
 'Letter sequence reversed: w-a-s read as s-a-w, a common directional reversal.'),
('dd000002-0000-0000-0000-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 17, 'loud', NULL, 'OMI',
 'Word "loud" was skipped entirely during reading.'),
('dd000003-0000-0000-0000-000000000003', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 24, 'higher', 'house', 'SUB',
 'Visually similar initial letter "h" but wrong word; substitution.'),
('dd000004-0000-0000-0000-000000000004', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 48, 'happy', 'glad', 'SUB',
 'Semantic substitution — meaning preserved but wrong word read.')
ON CONFLICT (id) DO NOTHING;

-- Session 2 errors:
--   index 1:  "taking"→"talking" — SUB (minimal-pair substitution)
--   index 15: "breathe"→"breath"  — SUB (suffix dropped)
--   index 26: "no"→null           — OMI (omission)
--   index 44: "weaker"→"weeker"   — REV (vowel digraph reversal ea→ee)
--   index 53: null→"really"       — INS (inserted word)

INSERT INTO error_classifications (id, session_id, word_index, source_word, spoken_word, category, rationale) VALUES
('ee000001-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1, 'taking', 'talking', 'SUB',
 'Minimal-pair substitution: added "l" producing a different word.'),
('ee000002-0000-0000-0000-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 15, 'breathe', 'breath', 'SUB',
 'Final-e suffix dropped, changing pronunciation and word class.'),
('ee000003-0000-0000-0000-000000000003', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 26, 'no', NULL, 'OMI',
 'Skipped the word "no", changing the sentence meaning.'),
('ee000004-0000-0000-0000-000000000004', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 44, 'weaker', 'weeker', 'REV',
 'Vowel digraph reversal: "ea" read as "ee" — a common phoneme confusion.'),
('ee000005-0000-0000-0000-000000000005', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 53, NULL, 'really', 'INS',
 'Inserted word "really" not present in the source passage.')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Error Profiles (aggregated per session)
-- ---------------------------------------------------------------------------

-- Session 1: 1 REV, 2 SUB, 1 OMI = 4 errors out of 48 words → 0.083 error rate
INSERT INTO error_profiles (id, student_id, session_id, rev_count, sub_count, omi_count, ins_count, bld_count, pac_count, uncertain_count, total_words_read, total_errors, error_rate)
VALUES ('dd000010-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        1, 2, 1, 0, 0, 0, 0, 48, 4, 0.083)
ON CONFLICT (id) DO NOTHING;

-- Session 2: 1 REV, 2 SUB, 1 OMI, 1 INS = 5 errors out of 59 words → 0.085 error rate
INSERT INTO error_profiles (id, student_id, session_id, rev_count, sub_count, omi_count, ins_count, bld_count, pac_count, uncertain_count, total_words_read, total_errors, error_rate)
VALUES ('ee000010-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        1, 2, 1, 1, 0, 0, 0, 59, 5, 0.085)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Drills (derived from error patterns — matches drills.ts logic)
-- ---------------------------------------------------------------------------

-- Session 1: dominant drillable category = SUB (2 hits) → Sight Word Practice
INSERT INTO drills (id, session_id, student_id, target_category, drill_type, content) VALUES
('dd000020-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'SUB', 'Sight Word Practice',
 '{"instructions":"Read these high-frequency words.","target":"Common substitutions","words":["higher","happy","house","glad"]}')
ON CONFLICT (id) DO NOTHING;

-- Session 1: secondary drill for REV (1 hit) → Visual Discrimination
INSERT INTO drills (id, session_id, student_id, target_category, drill_type, content) VALUES
('dd000020-0000-0000-0000-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'REV', 'Visual Discrimination',
 '{"instructions":"Select the letter that matches the sound.","target":"b/d distinction","words":["was","saw"]}')
ON CONFLICT (id) DO NOTHING;

-- Session 2: dominant drillable category = SUB (2 hits) → Sight Word Practice
INSERT INTO drills (id, session_id, student_id, target_category, drill_type, content) VALUES
('ee000020-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'SUB', 'Sight Word Practice',
 '{"instructions":"Read these high-frequency words.","target":"Common substitutions","words":["taking","talking","breathe","breath"]}')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. V2 Seed Data — AI Intervention Ecosystem
-- ---------------------------------------------------------------------------

-- Seed Health Scores for Demo Student (Sam)
INSERT INTO health_scores (id, student_id, session_id, score, risk_level, fluency, accuracy, wpm_normalized, error_frequency, error_severity, improvement_trend, components)
VALUES ('dd000030-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 68, 'medium', 55, 91, 40, 83, 70, 50, '{"wpmNormalized":40,"accuracy":91,"fluency":55,"errorFrequency":83,"errorSeverity":70,"improvementTrend":50}')
ON CONFLICT (id) DO NOTHING;

-- Seed Gamification Profile for Demo Student (Sam)
INSERT INTO gamification_profiles (id, student_id, xp, level, current_streak, longest_streak, total_sessions, total_drills_completed, total_stories_read)
VALUES ('dd000040-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 185, 2, 3, 5, 2, 3, 1)
ON CONFLICT (student_id) DO UPDATE SET xp = 185, level = 2, current_streak = 3;

-- Seed Risk Screening for Demo Student (Sam)
INSERT INTO risk_screenings (id, student_id, risk_level, confidence, indicators, evidence, sessions_analyzed)
VALUES (
  'dd000050-0000-0000-0000-000000000001',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'medium',
  75,
  '["Moderate letter reversal pattern", "Word substitution frequency above average"]',
  '[{"indicator":"Letter reversals","category":"REV","frequency":2,"severity":"moderate","details":"2 reversals detected across 2 sessions."},{"indicator":"Substitutions","category":"SUB","frequency":4,"severity":"moderate","details":"4 substitutions detected across 2 sessions."}]',
  2
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Minimal Teacher Activity for teacher@decodex.com (V12 backfill signal)
--    Creates 1 assignment assigned to both students in the demo school,
--    so teacher_student_links backfill finds 2 real relationships.
-- ---------------------------------------------------------------------------

-- Create assignment by teacher for both demo students
WITH teacher AS (
  SELECT id FROM users WHERE email = 'teacher@decodex.com' AND deleted_at IS NULL
),
student_aarav AS (
  SELECT id FROM users WHERE email = 'student@decodex.com' AND deleted_at IS NULL
),
student_sam AS (
  SELECT id FROM users WHERE email = 'demostudent@decodex.com' AND deleted_at IS NULL
),
passage AS (
  SELECT id FROM passages WHERE title = 'The Cat in the Tree' LIMIT 1
),
new_assignment AS (
  INSERT INTO assignments (teacher_id, title, instructions, passage_id, scope, status)
  SELECT teacher.id, 'Demo Assignment: The Cat in the Tree', 'Read and practice this passage', passage.id, 'selected', 'active'
  FROM teacher, passage
  RETURNING id
)
INSERT INTO assignment_students (assignment_id, student_id, status)
SELECT new_assignment.id, student.id, 'assigned'
FROM new_assignment
JOIN student_aarav student ON true
UNION ALL
SELECT new_assignment.id, student.id, 'assigned'
FROM new_assignment
JOIN student_sam student ON true
ON CONFLICT (assignment_id, student_id) DO NOTHING;