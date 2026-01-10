/**
 * KR-CLI DOMINION - Admin Sessions Module
 * Real-time session monitoring
 */

let sessionsData = [];
let sessionsRefreshInterval = null;

async function loadSessions(filter = 'all') {
    const client = await AdminSupabase.init();
    if (!client) return;

    let query = client
        .from('cli_sessions')
        .select('*, cli_users(email, username)')
        .order('created_at', { ascending: false })
        .limit(100);

    // Apply filters
    const now = new Date();
    if (filter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', today);
    } else if (filter === 'week') {
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', weekAgo);
    } else if (filter === 'vpn') {
        query = query.eq('is_vpn', true);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error loading sessions:', error);
        return;
    }

    sessionsData = data || [];
    renderSessions();
    updateSessionStats();
}

function renderSessions() {
    const tbody = document.getElementById('sessions-tbody');
    if (!tbody) return;

    if (sessionsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">No hay sesiones para mostrar</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = sessionsData.map(session => {
        const user = session.cli_users;
        const username = user?.username || user?.email?.split('@')[0] || 'Anónimo';
        const country = session.country || session.country_code || '?';
        const countryFlag = getCountryFlag(session.country_code);
        const city = session.city || '-';
        const distro = session.distro || session.os_name || '-';
        const ip = session.public_ip || '-';
        const isVPN = session.is_vpn;
        const createdAt = formatRelativeTime(session.created_at);
        const lastActivity = session.last_activity ? formatRelativeTime(session.last_activity) : '-';
        const isActive = isSessionActive(session.last_activity || session.created_at);

        return `
            <tr class="${isActive ? 'row-active' : ''}">
                <td>
                    <span class="user-cell">
                        <span class="user-avatar">${username.charAt(0).toUpperCase()}</span>
                        ${username}
                    </span>
                </td>
                <td>${countryFlag} ${country}</td>
                <td>${city}</td>
                <td>
                    <span class="distro-badge ${getDistroBadgeClass(distro)}">${distro}</span>
                </td>
                <td class="ip-cell">${ip}</td>
                <td>
                    ${isVPN ? '<span class="vpn-badge">🛡️ VPN</span>' : '<span class="no-vpn">-</span>'}
                </td>
                <td>${createdAt}</td>
                <td>
                    ${isActive ? '<span class="status-live">🟢 Activo</span>' : lastActivity}
                </td>
            </tr>
        `;
    }).join('');
}

function updateSessionStats() {
    // Linux vs Termux
    const linuxCount = sessionsData.filter(s => 
        s.distro && !s.distro.toLowerCase().includes('termux') && !s.terminal?.includes('termux')
    ).length;
    
    const termuxCount = sessionsData.filter(s => 
        (s.distro && s.distro.toLowerCase().includes('termux')) || 
        (s.terminal && s.terminal.toLowerCase().includes('termux'))
    ).length;

    // VPN count
    const vpnCount = sessionsData.filter(s => s.is_vpn).length;

    // Unique countries
    const countries = new Set(sessionsData.map(s => s.country_code).filter(Boolean));

    // Update UI
    document.getElementById('sessions-linux').textContent = linuxCount;
    document.getElementById('sessions-termux').textContent = termuxCount;
    document.getElementById('sessions-vpn').textContent = vpnCount;
    document.getElementById('sessions-countries').textContent = countries.size;

    // Update live badge
    const activeSessions = sessionsData.filter(s => isSessionActive(s.last_activity || s.created_at)).length;
    document.getElementById('live-sessions').textContent = activeSessions;
    document.getElementById('active-sessions').textContent = activeSessions;
}

function isSessionActive(lastActivity) {
    if (!lastActivity) return false;
    const diff = Date.now() - new Date(lastActivity).getTime();
    return diff < 15 * 60 * 1000; // Active if within last 15 minutes
}

function getCountryFlag(countryCode) {
    if (!countryCode) return '🌐';
    // Convert country code to flag emoji
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

function getDistroBadgeClass(distro) {
    if (!distro) return '';
    const d = distro.toLowerCase();
    if (d.includes('kali')) return 'distro-kali';
    if (d.includes('parrot')) return 'distro-parrot';
    if (d.includes('ubuntu')) return 'distro-ubuntu';
    if (d.includes('debian')) return 'distro-debian';
    if (d.includes('arch')) return 'distro-arch';
    if (d.includes('termux')) return 'distro-termux';
    return '';
}

function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'ahora';
}

function refreshSessions() {
    const filter = document.getElementById('session-filter')?.value || 'all';
    loadSessions(filter);
    showToast('Sesiones actualizadas', 'success');
}

// Auto-refresh sessions every 30 seconds when on sessions tab
function startSessionsAutoRefresh() {
    if (sessionsRefreshInterval) clearInterval(sessionsRefreshInterval);
    sessionsRefreshInterval = setInterval(() => {
        const filter = document.getElementById('session-filter')?.value || 'all';
        loadSessions(filter);
    }, 30000);
}

function stopSessionsAutoRefresh() {
    if (sessionsRefreshInterval) {
        clearInterval(sessionsRefreshInterval);
        sessionsRefreshInterval = null;
    }
}

// Get session geolocation data for chart
async function getSessionGeoData() {
    const client = await AdminSupabase.init();
    if (!client) return [];

    const { data, error } = await client
        .from('cli_sessions')
        .select('country_code, country')
        .not('country_code', 'is', null);

    if (error) return [];

    // Count by country
    const countryCounts = {};
    data.forEach(s => {
        const country = s.country || s.country_code;
        countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    // Convert to array and sort
    return Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
}

// Initialize sessions filter listener
document.getElementById('session-filter')?.addEventListener('change', (e) => {
    loadSessions(e.target.value);
});

// Export
window.AdminSessions = {
    load: loadSessions,
    refresh: refreshSessions,
    startAutoRefresh: startSessionsAutoRefresh,
    stopAutoRefresh: stopSessionsAutoRefresh,
    getGeoData: getSessionGeoData
};
