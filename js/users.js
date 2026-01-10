/**
 * KR-CLI DOMINION - Admin Users Module
 * User management functionality
 */

let currentPage = 1;
let totalPages = 1;
let currentEditUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check auth first
    const admin = checkAdminAuth();
    if (!admin) return;

    // Set admin name
    document.getElementById('admin-name').textContent = admin.name || admin.email;

    // Initialize navigation
    initNavigation();

    // Load initial data
    loadDashboard();
});

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const pageTitle = document.getElementById('page-title');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            const sectionId = item.dataset.section;

            // Update active states
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(`section-${sectionId}`).classList.add('active');

            // Update page title
            const titles = {
                'dashboard': 'Dashboard',
                'users': 'Gestión de Usuarios',
                'support': 'Soporte',
                'credits': 'Créditos'
            };
            pageTitle.textContent = titles[sectionId] || 'Dashboard';

            // Load section data
            if (sectionId === 'dashboard') loadDashboard();
            if (sectionId === 'users') loadUsers();
            if (sectionId === 'support') loadTickets();

            // Close mobile menu
            sidebar.classList.remove('active');
        });
    });

    // Mobile menu toggle
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Form handlers
    document.getElementById('add-user-form')?.addEventListener('submit', handleAddUser);
    document.getElementById('edit-user-form')?.addEventListener('submit', handleEditUser);
}

// ===== Dashboard =====

async function loadDashboard() {
    const analytics = await window.AdminSupabase.getAnalytics();

    document.getElementById('total-users').textContent = analytics.totalUsers;
    document.getElementById('active-users').textContent = analytics.activeUsers;
    document.getElementById('premium-users').textContent = analytics.premiumUsers;
    document.getElementById('total-revenue').textContent = `$${analytics.totalRevenue.toFixed(2)}`;

    // Update ticket badge
    document.getElementById('ticket-count').textContent = analytics.openTickets;

    // Load charts
    loadCharts(analytics);

    // Load activity
    loadRecentActivity();
}

async function loadRecentActivity() {
    const activity = await window.AdminSupabase.getRecentActivity();
    const list = document.getElementById('activity-list');

    if (!activity.length) {
        list.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Sin actividad reciente</p>';
        return;
    }

    list.innerHTML = activity.map(a => {
        const user = a.cli_users?.email || 'Usuario';
        const time = new Date(a.created_at).toLocaleString('es-ES');
        const icons = {
            'page_visit': '📄',
            'web_login': '🔐',
            'support_ticket': '💬'
        };

        return `
            <div class="activity-item">
                <div class="activity-icon">${icons[a.action] || '📌'}</div>
                <div class="activity-text">
                    <strong>${user}</strong> - ${a.action} ${a.page_visited || ''}
                </div>
                <span class="activity-time">${time}</span>
            </div>
        `;
    }).join('');
}

// ===== Users =====

async function loadUsers(search = '') {
    const { users, total } = await window.AdminSupabase.getAllUsers(currentPage, 20, search);
    const tbody = document.getElementById('users-tbody');

    totalPages = Math.ceil(total / 20);

    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No hay usuarios</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const isPremium = user.subscription_status === 'premium' &&
            new Date(user.subscription_expiry_date) > new Date();
        const isActive = new Date(user.updated_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        return `
            <tr>
                <td>${user.email}</td>
                <td>${user.username || '-'}</td>
                <td><span class="status-badge ${isPremium ? 'premium' : 'free'}">${isPremium ? 'Premium' : 'Free'}</span></td>
                <td>${user.credit_balance}</td>
                <td>$${user.total_spent || 0}</td>
                <td><span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? 'Activo' : 'Inactivo'}</span></td>
                <td class="action-btns">
                    <button class="action-btn" onclick="editUser('${user.id}')">✏️</button>
                </td>
            </tr>
        `;
    }).join('');

    updatePagination();
}

function searchUsers() {
    const search = document.getElementById('user-search').value;
    currentPage = 1;
    loadUsers(search);
}

function updatePagination() {
    const pagination = document.getElementById('users-pagination');
    let html = '';

    if (currentPage > 1) {
        html += `<button class="action-btn" onclick="goToPage(${currentPage - 1})">← Anterior</button>`;
    }

    html += `<span style="margin: 0 15px; color: var(--text-secondary);">Página ${currentPage} de ${totalPages}</span>`;

    if (currentPage < totalPages) {
        html += `<button class="action-btn" onclick="goToPage(${currentPage + 1})">Siguiente →</button>`;
    }

    pagination.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    loadUsers();
}

// ===== Modals =====

function showAddUserModal() {
    document.getElementById('add-user-modal').classList.add('active');
}

async function editUser(userId) {
    const user = await window.AdminSupabase.getUserById(userId);
    if (!user) return;

    currentEditUser = user;

    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-email').value = user.email;
    document.getElementById('edit-user-username').value = user.username || '';
    document.getElementById('edit-user-credits').value = user.credit_balance;
    document.getElementById('edit-user-status').value = user.subscription_status;

    document.getElementById('edit-user-modal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    currentEditUser = null;
}

async function handleAddUser(e) {
    e.preventDefault();

    // Note: In a real implementation, you'd create the user via Supabase Auth
    // For demo purposes, show a message
    alert('Para crear usuarios, deben registrarse desde el CLI.');
    closeModal('add-user-modal');
}

async function handleEditUser(e) {
    e.preventDefault();

    const userId = document.getElementById('edit-user-id').value;
    const username = document.getElementById('edit-user-username').value;
    const credits = parseInt(document.getElementById('edit-user-credits').value);
    const status = document.getElementById('edit-user-status').value;

    let updates = {
        username: username,
        credit_balance: credits,
        subscription_status: status
    };

    // If upgrading to premium, set expiry
    if (status === 'premium' && currentEditUser?.subscription_status !== 'premium') {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        updates.subscription_expiry_date = expiry.toISOString();
    }

    const result = await window.AdminSupabase.updateUser(userId, updates);

    if (result.success) {
        closeModal('edit-user-modal');
        loadUsers();
        showToast('Usuario actualizado');
    } else {
        alert('Error: ' + result.error);
    }
}

async function deleteUser() {
    if (!currentEditUser) return;

    if (!confirm(`¿Eliminar usuario ${currentEditUser.email}? Esta acción no se puede deshacer.`)) {
        return;
    }

    const result = await window.AdminSupabase.deleteUser(currentEditUser.id);

    if (result.success) {
        closeModal('edit-user-modal');
        loadUsers();
        showToast('Usuario eliminado');
    } else {
        alert('Error: ' + result.error);
    }
}

// Toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--cyan);
        color: #000;
        padding: 15px 25px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(style);
