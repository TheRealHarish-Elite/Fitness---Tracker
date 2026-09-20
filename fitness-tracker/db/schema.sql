CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_type VARCHAR(10) NOT NULL CHECK (day_type IN ('push', 'pull', 'legs')),
    notes TEXT,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sets (
    id SERIAL PRIMARY KEY,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL CHECK (set_number > 0),
    reps INTEGER NOT NULL CHECK (reps > 0),
    weight NUMERIC(6, 2) NOT NULL CHECK (weight >= 0)
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_day
    ON workouts (user_id, day_type, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_exercises_workout
    ON exercises (workout_id);

CREATE INDEX IF NOT EXISTS idx_sets_exercise
    ON sets (exercise_id);
