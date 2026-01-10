/**
 * KR-CLI DOMINION - Admin Auth
 * Login form handling and session management
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        // Check if already logged in
        const session = sessionStorage.getItem('admin_session');
        if (session) {
            window.location.href = 'panel.html';
            return;
        }

        loginForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    const btn = document.querySelector('.btn-login');

    // Clear previous error
    errorMsg.textContent = '';

    // Show loading
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const result = await window.AdminSupabase.login(email, password);

        if (result.success) {
            // Redirect to panel
            window.location.href = 'panel.html';
        } else {
            errorMsg.textContent = result.error || 'Error de autenticación';
        }
    } catch (error) {
        errorMsg.textContent = 'Error de conexión';
        console.error('Login error:', error);
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

function checkAdminAuth() {
    const session = window.AdminSupabase.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}

function adminLogout() {
    window.AdminSupabase.logout();
}
