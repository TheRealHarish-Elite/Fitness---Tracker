const workoutsEl = document.getElementById('workouts');
const plateausEl = document.getElementById('plateaus');
const errorEl = document.getElementById('list-error');
const greetingEl = document.getElementById('greeting');
let dayFilter = '';

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char]));
}

function formatDate(value) {
    return new Date(value).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

async function requireUser() {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!data.user) {
        window.location.href = '/';
        return null;
    }
    greetingEl.textContent = `Welcome back, ${data.user.username}`;
    return data.user;
}

function renderWorkouts(workouts) {
    if (workouts.length === 0) {
        workoutsEl.innerHTML = '<p class="empty">No workouts yet. Log your first session.</p>';
        return;
    }

    workoutsEl.innerHTML = workouts.map((workout) => {
        const exercises = workout.exercises.map((exercise) => {
            const sets = exercise.sets.map((set) => (
                `<div class="set-row">
                    <span>Set ${set.set_number}</span>
                    <span>${set.reps} reps</span>
                    <span>${set.weight} lb</span>
                </div>`
            )).join('');
            return `<div class="exercise"><h3>${escapeHtml(exercise.name)}</h3>${sets}</div>`;
        }).join('');

        return `<article class="card">
            <div class="card-head">
                <div>
                    <span class="day-badge ${workout.day_type}">${workout.day_type}</span>
                    <h2>${formatDate(workout.performed_at)}</h2>
                    ${workout.notes ? `<p class="muted">${escapeHtml(workout.notes)}</p>` : ''}
                </div>
                <button class="btn danger" type="button" data-delete="${workout.id}">Delete</button>
            </div>
            ${exercises}
        </article>`;
    }).join('');
}

function renderPlateaus(plateaus) {
    if (plateaus.length === 0) {
        plateausEl.hidden = true;
        plateausEl.innerHTML = '';
        return;
    }
    plateausEl.hidden = false;
    plateausEl.innerHTML = plateaus.map((p) => (
        `<article class="card plateau">
            <p class="eyebrow">Plateau</p>
            <h2>${escapeHtml(p.exercise)}</h2>
            <p>${escapeHtml(p.message)}</p>
        </article>`
    )).join('');
}

async function load() {
    errorEl.hidden = true;
    const query = dayFilter ? `?day_type=${dayFilter}` : '';
    const [workoutsRes, plateauRes] = await Promise.all([
        fetch(`/api/workouts${query}`),
        fetch('/api/plateaus'),
    ]);

    if (workoutsRes.status === 401) {
        window.location.href = '/';
        return;
    }

    const workoutsData = await workoutsRes.json();
    const plateauData = await plateauRes.json();

    if (!workoutsRes.ok) {
        errorEl.textContent = workoutsData.error || 'Could not load workouts.';
        errorEl.hidden = false;
        return;
    }

    renderWorkouts(workoutsData.workouts);
    renderPlateaus(plateauData.plateaus || []);
}

document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        dayFilter = chip.dataset.day;
        load();
    });
});

workoutsEl.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete]');
    if (!button) return;
    if (!confirm('Delete this workout?')) return;
    const res = await fetch(`/api/workouts/${button.dataset.delete}`, { method: 'DELETE' });
    if (res.ok) load();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

requireUser().then((user) => {
    if (user) load();
});
