/**
 * KR-CLI DOMINION - Admin Credits Module
 * Credit and premium management
 */

document.addEventListener('DOMContentLoaded', () => {
    // Form handlers
    document.getElementById('add-credits-form')?.addEventListener('submit', handleAddCredits);
    document.getElementById('activate-premium-form')?.addEventListener('submit', handleActivatePremium);
});

async function handleAddCredits(e) {
    e.preventDefault();

    const email = document.getElementById('credit-email').value.trim();
    const amount = parseInt(document.getElementById('credit-amount').value);

    if (!email || !amount || amount < 1) {
        alert('Por favor completa todos los campos correctamente');
        return;
    }

    const result = await window.AdminSupabase.addCredits(email, amount);

    if (result.success) {
        showToast(`✓ ${amount} créditos agregados a ${email}`);
        document.getElementById('add-credits-form').reset();
        addToHistory('add', email, `+${amount} créditos`);
    } else {
        alert('Error: ' + result.error);
    }
}

async function handleActivatePremium(e) {
    e.preventDefault();

    const email = document.getElementById('premium-email').value.trim();
    const days = parseInt(document.getElementById('premium-days').value);

    if (!email || !days || days < 1) {
        alert('Por favor completa todos los campos correctamente');
        return;
    }

    const result = await window.AdminSupabase.activatePremium(email, days);

    if (result.success) {
        showToast(`✓ Premium activado por ${days} días para ${email}`);
        document.getElementById('activate-premium-form').reset();
        addToHistory('add', email, `Premium +${days} días`);
    } else {
        alert('Error: ' + result.error);
    }
}

// Local history for display
const creditsHistory = [];

function addToHistory(type, user, action) {
    creditsHistory.unshift({
        type,
        user,
        action,
        time: new Date().toLocaleString('es-ES')
    });

    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('credits-history');

    if (!creditsHistory.length) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Sin actividad reciente</p>';
        return;
    }

    container.innerHTML = creditsHistory.slice(0, 20).map(item => `
        <div class="history-item">
            <div class="history-info">
                <span class="history-action">${item.action}</span>
                <span class="history-user">${item.user}</span>
            </div>
            <span class="history-amount ${item.type}">${item.time}</span>
        </div>
    `).join('');
}

// Initialize history display
document.addEventListener('DOMContentLoaded', renderHistory);
