const SUGGESTIONS = {
    push: ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Tricep Pushdown', 'Lateral Raise'],
    pull: ['Deadlift', 'Barbell Row', 'Pull-up', 'Face Pull', 'Bicep Curl'],
    legs: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise'],
};

const form = document.getElementById('workout-form');
const exercisesEl = document.getElementById('exercises');
const suggestionsEl = document.getElementById('suggestions');
const dayTypeEl = document.getElementById('day-type');
const dateEl = document.getElementById('performed-at');
const errorEl = document.getElementById('form-error');

dateEl.value = new Date().toISOString().slice(0, 10);

async function requireUser() {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!data.user) window.location.href = '/';
}

function setTemplate() {
    const day = dayTypeEl.value;
    suggestionsEl.innerHTML = `Suggestions: ${SUGGESTIONS[day].map((name) => (
        `<button class="chip" type="button" data-suggest="${name}">${name}</button>`
    )).join(' ')}`;
}

function addSetRow(container, set = { reps: 8, weight: 0 }) {
    const row = document.createElement('div');
    row.className = 'set-fields';
    row.innerHTML = `
        <label>Reps
            <input type="number" min="1" max="1000" name="reps" value="${set.reps}" required>
        </label>
        <label>Weight (lb)
            <input type="number" min="0" max="2000" step="0.5" name="weight" value="${set.weight}" required>
        </label>
        <button class="btn ghost" type="button" data-remove-set>Remove</button>
    `;
    container.appendChild(row);
}

function addExercise(name = '') {
    const card = document.createElement('article');
    card.className = 'card exercise-card';
    card.innerHTML = `
        <header>
            <label>Exercise
                <input type="text" name="exercise_name" value="${name}" required maxlength="100">
            </label>
            <button class="btn ghost" type="button" data-remove-exercise>Remove</button>
        </header>
        <div class="sets"></div>
        <button class="btn ghost" type="button" data-add-set>Add set</button>
    `;
    exercisesEl.appendChild(card);
    addSetRow(card.querySelector('.sets'));
}

exercisesEl.addEventListener('click', (event) => {
    if (event.target.matches('[data-add-set]')) {
        addSetRow(event.target.previousElementSibling);
    }
    if (event.target.matches('[data-remove-set]')) {
        const rows = event.target.closest('.sets').querySelectorAll('.set-fields');
        if (rows.length > 1) event.target.closest('.set-fields').remove();
    }
    if (event.target.matches('[data-remove-exercise]')) {
        const cards = exercisesEl.querySelectorAll('.exercise-card');
        if (cards.length > 1) event.target.closest('.exercise-card').remove();
    }
});

document.getElementById('add-exercise').addEventListener('click', () => addExercise());
dayTypeEl.addEventListener('change', setTemplate);
suggestionsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-suggest]');
    if (button) addExercise(button.dataset.suggest);
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.hidden = true;

    const exercises = [...exercisesEl.querySelectorAll('.exercise-card')].map((card) => ({
        name: card.querySelector('[name="exercise_name"]').value.trim(),
        sets: [...card.querySelectorAll('.set-fields')].map((row) => ({
            reps: Number(row.querySelector('[name="reps"]').value),
            weight: Number(row.querySelector('[name="weight"]').value),
        })),
    }));

    const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            day_type: dayTypeEl.value,
            notes: form.notes.value.trim(),
            performed_at: dateEl.value,
            exercises,
        }),
    });
    const data = await res.json();
    if (!res.ok) {
        errorEl.textContent = data.error || 'Could not save workout.';
        errorEl.hidden = false;
        return;
    }
    window.location.href = '/dashboard.html';
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

addExercise();
setTemplate();
requireUser();
