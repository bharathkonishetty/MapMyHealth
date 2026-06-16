-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS Table (Authentication & Core Identity)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. USER PROFILES Table (Physiological metrics)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER CHECK (age >= 0 AND age <= 120),
    gender VARCHAR(20),
    height_cm NUMERIC(5,2) CHECK (height_cm > 0),
    activity_level VARCHAR(50), -- 'sedentary', 'lightly_active', 'moderately_active', 'very_active'
    dietary_preference VARCHAR(50), -- 'veg', 'non_veg', 'vegan', 'eggitarian'
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. GOALS Table (Target Destination)
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    goal_name VARCHAR(100),
    goal_type VARCHAR(50) NOT NULL, -- 'weight_loss', 'muscle_gain', 'maintenance'
    start_weight NUMERIC(5,2) NOT NULL,
    target_weight NUMERIC(5,2) NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_date DATE NOT NULL,
    target_calories INTEGER CHECK (target_calories > 0),
    target_protein_g INTEGER CHECK (target_protein_g >= 0),
    target_carbs_g INTEGER CHECK (target_carbs_g >= 0),
    target_fats_g INTEGER CHECK (target_fats_g >= 0),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. PROGRESS LOGS Table (Daily tracking metrics)
CREATE TABLE IF NOT EXISTS progress_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight NUMERIC(5,2) CHECK (weight > 0),
    calories_consumed INTEGER CHECK (calories_consumed >= 0),
    protein_consumed_g INTEGER CHECK (protein_consumed_g >= 0),
    carbs_consumed_g INTEGER CHECK (carbs_consumed_g >= 0),
    fats_consumed_g INTEGER CHECK (fats_consumed_g >= 0),
    water_intake_ml INTEGER DEFAULT 0 CHECK (water_intake_ml >= 0),
    workout_completed BOOLEAN DEFAULT FALSE,
    workout_duration_mins INTEGER DEFAULT 0 CHECK (workout_duration_mins >= 0),
    steps_count INTEGER DEFAULT 0 CHECK (steps_count >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_daily_log UNIQUE (user_id, log_date)
);

-- 5. HEALTH SCORES Table (Historical Score records)
CREATE TABLE IF NOT EXISTS health_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    breakdown_nutrition INTEGER NOT NULL DEFAULT 0,
    breakdown_activity INTEGER NOT NULL DEFAULT 0,
    breakdown_consistency INTEGER NOT NULL DEFAULT 0,
    explanation TEXT NOT NULL,
    improvement_tips VARCHAR(255)[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_daily_score UNIQUE (user_id, log_date)
);

-- 6. JOURNEY CHECKPOINTS Table (Visual Journey landmarks)
CREATE TABLE IF NOT EXISTS journey_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    checkpoint_type VARCHAR(50) NOT NULL, -- 'start', 'milestone', 'destination'
    sequence_order INTEGER NOT NULL,
    target_value NUMERIC(5,2),
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. DIET RECOMMENDATIONS Table (Dynamic meal templates)
CREATE TABLE IF NOT EXISTS diet_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    target_calories INTEGER NOT NULL,
    protein_target_g INTEGER NOT NULL,
    carbs_target_g INTEGER NOT NULL,
    fats_target_g INTEGER NOT NULL,
    meal_plan_details JSONB NOT NULL,
    explanation TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. WORKOUT RECOMMENDATIONS Table (Dynamic workout routines)
CREATE TABLE IF NOT EXISTS workout_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    program_name VARCHAR(100) NOT NULL,
    difficulty_level VARCHAR(50) NOT NULL,
    workout_plan_details JSONB NOT NULL,
    explanation TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_progress_user_date ON progress_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_checkpoints_user_order ON journey_checkpoints(user_id, sequence_order);
