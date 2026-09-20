const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const pool = require('./db/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const DAY_TYPES = ['push', 'pull', 'legs'];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'cs50-fitness-tracker-dev-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        },
    })
);
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Please log in first.' });
    }
    next();
}

function parseDayType(value) {
    if (!value) return null;
    const day = String(value).trim().toLowerCase();
    return DAY_TYPES.includes(day) ? day : null;
}

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ ok: true, db: 'connected' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, db: 'error' });
    }
});

app.get('/api/me', async (req, res) => {
    if (!req.session.userId) {
        return res.json({ user: null });
    }
    try {
        const result = await pool.query(
            'SELECT id, username FROM users WHERE id = $1',
            [req.session.userId]
        );
        res.json({ user: result.rows[0] || null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load user.' });
    }
});

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

app.post('/api/register', async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');

    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
        return res.status(400).json({
            error: 'Username must be 3–50 characters (letters, numbers, underscore).',
        });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    try {
        const existing = await pool.query(
            'SELECT id FROM users WHERE LOWER(username) = $1',
            [username]
        );
        if (existing.rowCount > 0) {
            return res.status(409).json({ error: 'That username is already taken.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const created = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, passwordHash]
        );
        req.session.userId = created.rows[0].id;
        res.status(201).json({ user: created.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed.' });
    }
});

app.post('/api/login', async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');

    try {
        const result = await pool.query(
            'SELECT id, username, password_hash FROM users WHERE LOWER(username) = $1',
            [username]
        );
        if (result.rowCount === 0) {
            return res.status(401).json({
                error: 'No account found for that username. Click Register to create one.',
            });
        }

        const user = result.rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Incorrect password.' });
        }

        req.session.userId = user.id;
        res.json({ user: { id: user.id, username: user.username } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed.' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Logout failed.' });
        }
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

async function fetchWorkouts(userId, dayType) {
    const params = [userId];
    let where = 'WHERE w.user_id = $1';
    if (dayType) {
        params.push(dayType);
        where += ` AND w.day_type = $${params.length}`;
    }

    const workoutResult = await pool.query(
        `SELECT w.id, w.day_type, w.notes, w.performed_at, w.created_at
         FROM workouts w
         ${where}
         ORDER BY w.performed_at DESC, w.id DESC`,
        params
    );

    const workouts = workoutResult.rows;
    if (workouts.length === 0) return [];

    const ids = workouts.map((w) => w.id);
    const detailResult = await pool.query(
        `SELECT e.workout_id, e.id AS exercise_id, e.name, e.sort_order,
                s.id AS set_id, s.set_number, s.reps, s.weight
         FROM exercises e
         LEFT JOIN sets s ON s.exercise_id = e.id
         WHERE e.workout_id = ANY($1::int[])
         ORDER BY e.sort_order ASC, e.id ASC, s.set_number ASC`,
        [ids]
    );

    const byWorkout = new Map(workouts.map((w) => [w.id, { ...w, exercises: [] }]));
    const exerciseIndex = new Map();

    for (const row of detailResult.rows) {
        const workout = byWorkout.get(row.workout_id);
        let exercise = exerciseIndex.get(row.exercise_id);
        if (!exercise) {
            exercise = { id: row.exercise_id, name: row.name, sets: [] };
            exerciseIndex.set(row.exercise_id, exercise);
            workout.exercises.push(exercise);
        }
        if (row.set_id) {
            exercise.sets.push({
                id: row.set_id,
                set_number: row.set_number,
                reps: row.reps,
                weight: Number(row.weight),
            });
        }
    }

    return [...byWorkout.values()];
}

app.get('/api/workouts', requireAuth, async (req, res) => {
    const dayType = parseDayType(req.query.day_type);
    if (req.query.day_type && !dayType) {
        return res.status(400).json({ error: 'day_type must be push, pull, or legs.' });
    }

    try {
        const workouts = await fetchWorkouts(req.session.userId, dayType);
        res.json({ workouts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load workouts.' });
    }
});

app.get('/api/workouts/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id FROM workouts WHERE id = $1 AND user_id = $2',
            [req.params.id, req.session.userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Workout not found.' });
        }
        const workouts = await fetchWorkouts(req.session.userId, null);
        const workout = workouts.find((w) => w.id === Number(req.params.id));
        res.json({ workout });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load workout.' });
    }
});

app.post('/api/workouts', requireAuth, async (req, res) => {
    const dayType = parseDayType(req.body.day_type);
    const notes = req.body.notes ? String(req.body.notes).slice(0, 500) : null;
    const exercises = Array.isArray(req.body.exercises) ? req.body.exercises : [];
    const performedAt = req.body.performed_at ? new Date(req.body.performed_at) : new Date();

    if (!dayType) {
        return res.status(400).json({ error: 'Choose a day type: push, pull, or legs.' });
    }
    if (Number.isNaN(performedAt.getTime())) {
        return res.status(400).json({ error: 'Invalid workout date.' });
    }
    if (exercises.length === 0) {
        return res.status(400).json({ error: 'Add at least one exercise.' });
    }

    const cleaned = [];
    for (const [index, exercise] of exercises.entries()) {
        const name = String(exercise.name || '').trim();
        if (!name) {
            return res.status(400).json({ error: `Exercise ${index + 1} needs a name.` });
        }
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        if (sets.length === 0) {
            return res.status(400).json({ error: `${name} needs at least one set.` });
        }

        const cleanedSets = [];
        for (const [setIndex, set] of sets.entries()) {
            const reps = Number(set.reps);
            const weight = Number(set.weight);
            if (!Number.isInteger(reps) || reps < 1 || reps > 1000) {
                return res.status(400).json({
                    error: `${name} set ${setIndex + 1}: reps must be a whole number from 1–1000.`,
                });
            }
            if (!Number.isFinite(weight) || weight < 0 || weight > 2000) {
                return res.status(400).json({
                    error: `${name} set ${setIndex + 1}: weight must be between 0 and 2000.`,
                });
            }
            cleanedSets.push({ reps, weight });
        }
        cleaned.push({ name, sets: cleanedSets });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const workoutResult = await client.query(
            `INSERT INTO workouts (user_id, day_type, notes, performed_at)
             VALUES ($1, $2, $3, $4)
             RETURNING id, day_type, notes, performed_at, created_at`,
            [req.session.userId, dayType, notes, performedAt]
        );
        const workout = workoutResult.rows[0];

        for (const [index, exercise] of cleaned.entries()) {
            const exerciseResult = await client.query(
                `INSERT INTO exercises (workout_id, name, sort_order)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [workout.id, exercise.name, index]
            );
            const exerciseId = exerciseResult.rows[0].id;
            for (const [setIndex, set] of exercise.sets.entries()) {
                await client.query(
                    `INSERT INTO sets (exercise_id, set_number, reps, weight)
                     VALUES ($1, $2, $3, $4)`,
                    [exerciseId, setIndex + 1, set.reps, set.weight]
                );
            }
        }

        await client.query('COMMIT');
        const workouts = await fetchWorkouts(req.session.userId, null);
        const full = workouts.find((w) => w.id === workout.id);
        res.status(201).json({ workout: full });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Could not save workout.' });
    } finally {
        client.release();
    }
});

app.delete('/api/workouts/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM workouts WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.session.userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Workout not found.' });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not delete workout.' });
    }
});

app.get('/api/plateaus', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `WITH session_max AS (
                SELECT
                    LOWER(e.name) AS key,
                    e.name,
                    w.id AS workout_id,
                    w.performed_at,
                    MAX(s.weight)::float AS max_weight
                FROM workouts w
                JOIN exercises e ON e.workout_id = w.id
                JOIN sets s ON s.exercise_id = e.id
                WHERE w.user_id = $1
                GROUP BY LOWER(e.name), e.name, w.id, w.performed_at
             ),
             ranked AS (
                SELECT
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY key
                        ORDER BY performed_at DESC, workout_id DESC
                    ) AS rn,
                    COUNT(*) OVER (PARTITION BY key) AS session_count
                FROM session_max
             )
             SELECT name, workout_id, performed_at, max_weight, rn, session_count
             FROM ranked
             WHERE rn <= 3 AND session_count >= 3
             ORDER BY key, rn`,
            [req.session.userId]
        );

        const grouped = new Map();
        for (const row of result.rows) {
            const key = row.name.toLowerCase();
            if (!grouped.has(key)) {
                grouped.set(key, { name: row.name, sessions: [] });
            }
            grouped.get(key).sessions.push({
                workout_id: row.workout_id,
                performed_at: row.performed_at,
                max_weight: Number(row.max_weight),
            });
        }

        const plateaus = [];
        for (const entry of grouped.values()) {
            const sessions = entry.sessions;
            if (sessions.length < 3) continue;

            const latest = sessions[0].max_weight;
            const previous = Math.max(sessions[1].max_weight, sessions[2].max_weight);
            if (latest > previous) continue;

            const increment = latest >= 100 ? 5 : 2.5;
            const suggested = Number((latest + increment).toFixed(2));
            const history = [...sessions].reverse().map((s) => s.max_weight);

            plateaus.push({
                exercise: entry.name,
                sessions: sessions.map((s) => ({
                    workout_id: s.workout_id,
                    performed_at: s.performed_at,
                    max_weight: s.max_weight,
                })),
                current_weight: latest,
                suggested_weight: suggested,
                message: `${entry.name} has not increased in 3 sessions (${history.join(' → ')}). Try ${suggested} next time.`,
            });
        }

        res.json({ plateaus });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not detect plateaus.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});
