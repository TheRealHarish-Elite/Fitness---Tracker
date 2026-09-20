const form = document.getElementById('auth-form');
const errorEl = document.getElementById('auth-error');
const hintEl = document.getElementById('auth-hint');
const submitBtn = document.getElementById('auth-submit');
const tabs = document.querySelectorAll('.tab');
let mode = 'login';

async function redirectIfLoggedIn() {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (data.user) {
        window.location.href = '/dashboard.html';
    }
}

tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        mode = tab.dataset.mode;
        tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
        submitBtn.textContent = mode === 'login' ? 'Log in' : 'Create account';
        form.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
        hintEl.textContent = mode === 'login'
            ? 'New here? Click Register first — logging in only works after an account exists.'
            : 'Username: letters, numbers, underscore. Password: at least 6 characters.';
        errorEl.hidden = true;
    });
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const payload = {
        username: form.username.value.trim(),
        password: form.password.value,
    };

    const res = await fetch(mode === 'login' ? '/api/login' : '/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        errorEl.textContent = data.error || 'Something went wrong.';
        errorEl.hidden = false;
        return;
    }
    window.location.href = '/dashboard.html';
});

redirectIfLoggedIn();
