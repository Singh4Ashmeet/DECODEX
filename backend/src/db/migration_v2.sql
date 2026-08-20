-- =============================================================================
-- Decodex Schema V2 — AI Intervention Platform Extension
-- Run AFTER schema.sql has been applied.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Reading Health Scores — Composite 0–100 score per session
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES reading_sessions(id) ON DELETE SET NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('critical', 'high', 'medium', 'good', 'excellent')),
    fluency REAL NOT NULL DEFAULT 0,
    accuracy REAL NOT NULL DEFAULT 0,
    wpm_normalized REAL NOT NULL DEFAULT 0,
    error_frequency REAL NOT NULL DEFAULT 0,
    error_severity REAL NOT NULL DEFAULT 0,
    improvement_trend REAL NOT NULL DEFAULT 0,
    components JSONB DEFAULT '{}',
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_scores_student ON health_scores(student_id, computed_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Risk Screenings — Early dyslexia risk detection (NOT diagnosis)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risk_screenings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    indicators JSONB NOT NULL DEFAULT '[]',
    evidence JSONB NOT NULL DEFAULT '[]',
    sessions_analyzed INTEGER NOT NULL DEFAULT 0,
    disclaimer TEXT NOT NULL DEFAULT 'This is an educational screening tool, not a medical diagnosis. Consult a qualified specialist for clinical assessment.',
    screened_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_screenings_student ON risk_screenings(student_id, screened_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Learning Paths — Personalized week-by-week intervention plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Personalized Reading Plan',
    total_weeks INTEGER NOT NULL DEFAULT 4,
    current_week INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'regenerating')),
    generated_by VARCHAR(20) NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai', 'teacher', 'system')),
    plan_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_paths_student ON learning_paths(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_path_weeks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    focus_area VARCHAR(255) NOT NULL,
    description TEXT,
    exercises JSONB NOT NULL DEFAULT '[]',
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_path_weeks_path ON learning_path_weeks(path_id, week_number ASC);

-- ---------------------------------------------------------------------------
-- 4. Generated Stories — AI-adaptive story content
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    difficulty_level INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
    target_phonemes JSONB NOT NULL DEFAULT '[]',
    target_weaknesses JSONB NOT NULL DEFAULT '[]',
    age_group VARCHAR(20),
    word_count INTEGER NOT NULL DEFAULT 0,
    times_read INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_stories_student ON generated_stories(student_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Gamification — XP, levels, streaks, achievements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gamification_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_drills_completed INTEGER NOT NULL DEFAULT 0,
    total_stories_read INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'emoji_events',
    xp_reward INTEGER NOT NULL DEFAULT 0,
    criteria JSONB NOT NULL DEFAULT '{}',
    category VARCHAR(30) NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'streak', 'accuracy', 'speed', 'volume', 'improvement')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON student_achievements(student_id, earned_at DESC);

-- ---------------------------------------------------------------------------
-- 6. IEP Documents — Individual Education Plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS iep_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    content JSONB NOT NULL DEFAULT '{}',
    strengths JSONB NOT NULL DEFAULT '[]',
    weaknesses JSONB NOT NULL DEFAULT '[]',
    goals JSONB NOT NULL DEFAULT '[]',
    weekly_milestones JSONB NOT NULL DEFAULT '[]',
    suggested_exercises JSONB NOT NULL DEFAULT '[]',
    teacher_notes TEXT,
    parent_recommendations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iep_documents_student ON iep_documents(student_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 7. Copilot Sessions — Decodex Copilot intervention strategy history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS copilot_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    summary TEXT NOT NULL,
    key_concerns JSONB NOT NULL DEFAULT '[]',
    weekly_roadmap JSONB NOT NULL DEFAULT '[]',
    recommended_exercises JSONB NOT NULL DEFAULT '[]',
    parent_communication_draft TEXT,
    health_score_at_generation INTEGER,
    risk_level_at_generation VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copilot_sessions_student ON copilot_sessions(student_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 8. Behavioral Metrics — Confidence & engagement analytics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS behavioral_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    engagement_score REAL CHECK (engagement_score >= 0 AND engagement_score <= 100),
    avg_pause_duration REAL,
    speed_variation REAL,
    hesitation_count INTEGER DEFAULT 0,
    self_correction_count INTEGER DEFAULT 0,
    metrics JSONB DEFAULT '{}',
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavioral_metrics_student ON behavioral_metrics(student_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavioral_metrics_session ON behavioral_metrics(session_id);

-- ---------------------------------------------------------------------------
-- 9. Seed Achievement Definitions
-- ---------------------------------------------------------------------------
INSERT INTO achievements (code, name, description, icon, xp_reward, category, criteria) VALUES
('first_read', 'First Steps', 'Complete your first reading session', 'menu_book', 50, 'general', '{"type": "sessions_completed", "threshold": 1}'),
('streak_3', 'Getting Started', 'Read for 3 days in a row', 'local_fire_department', 75, 'streak', '{"type": "streak", "threshold": 3}'),
('streak_7', '7-Day Streak', 'Read for 7 days in a row', 'whatshot', 150, 'streak', '{"type": "streak", "threshold": 7}'),
('streak_30', 'Monthly Master', 'Read for 30 days in a row', 'military_tech', 500, 'streak', '{"type": "streak", "threshold": 30}'),
('word_warrior', 'Word Warrior', 'Read 500 total words across all sessions', 'shield', 100, 'volume', '{"type": "total_words", "threshold": 500}'),
('bookworm', 'Bookworm', 'Complete 10 reading sessions', 'auto_stories', 200, 'volume', '{"type": "sessions_completed", "threshold": 10}'),
('speed_demon', 'Speed Reader', 'Achieve 100+ WPM in a session', 'speed', 150, 'speed', '{"type": "wpm_single", "threshold": 100}'),
('accuracy_ace', 'Accuracy Ace', 'Achieve 95%+ accuracy in a session', 'verified', 150, 'accuracy', '{"type": "accuracy_single", "threshold": 95}'),
('drill_master', 'Drill Master', 'Complete 10 practice drills', 'fitness_center', 200, 'volume', '{"type": "drills_completed", "threshold": 10}'),
('improving', 'On The Rise', 'Improve your health score by 10+ points', 'trending_up', 200, 'improvement', '{"type": "health_score_improvement", "threshold": 10}'),
('fluency_master', 'Fluency Master', 'Achieve a health score of 90+', 'workspace_premium', 300, 'accuracy', '{"type": "health_score_single", "threshold": 90}'),
('reading_champion', 'Reading Champion', 'Complete 25 reading sessions', 'emoji_events', 500, 'volume', '{"type": "sessions_completed", "threshold": 25}'),
('story_explorer', 'Story Explorer', 'Read 5 AI-generated stories', 'explore', 150, 'volume', '{"type": "stories_read", "threshold": 5}')
ON CONFLICT (code) DO NOTHING;
