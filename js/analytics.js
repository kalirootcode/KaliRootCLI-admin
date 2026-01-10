/**
 * KR-CLI DOMINION - Admin Analytics Module
 * Enhanced charts and statistics
 */

let usersChart = null;
let ticketsChart = null;
let creditsUsageChart = null;
let geoChart = null;

async function loadDashboard() {
    const analytics = await AdminSupabase.getAnalytics();
    
    // Update stat cards with animation
    animateCounter('total-users', analytics.totalUsers);
    animateCounter('active-users', analytics.activeUsers);
    animateCounter('premium-users', analytics.premiumUsers);
    document.getElementById('total-revenue').textContent = `$${analytics.totalRevenue.toFixed(2)}`;
    
    // Load additional stats
    await loadAdditionalStats();
    
    // Load charts
    loadCharts(analytics);
    
    // Load activity
    loadRecentActivity();
}

async function loadAdditionalStats() {
    try {
        const client = await AdminSupabase.init();
        
        // Active sessions (last 15 min)
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { count: activeSessions } = await client
            .from('cli_sessions')
            .select('*', { count: 'exact', head: true })
            .gte('last_activity', fifteenMinsAgo);
        
        animateCounter('active-sessions', activeSessions || 0);
        document.getElementById('live-sessions').textContent = activeSessions || 0;
        
        // Average API latency
        const { data: latencyData } = await client
            .from('cli_usage_log')
            .select('latency_ms')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (latencyData && latencyData.length > 0) {
            const avgLatency = Math.round(
                latencyData.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / latencyData.length
            );
            document.getElementById('avg-latency').textContent = `${avgLatency}ms`;
        }
        
    } catch (e) {
        console.error('Error loading additional stats:', e);
    }
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startValue = parseInt(element.textContent) || 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const currentValue = Math.round(startValue + (targetValue - startValue) * easeOut);
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function loadCharts(analytics) {
    // Users chart (Doughnut)
    const usersCtx = document.getElementById('users-chart')?.getContext('2d');

    if (usersCtx) {
        if (usersChart) usersChart.destroy();

        usersChart = new Chart(usersCtx, {
            type: 'doughnut',
            data: {
                labels: ['Premium', 'Free'],
                datasets: [{
                    data: [analytics.premiumUsers, analytics.freeUsers],
                    backgroundColor: [
                        'rgba(0, 255, 255, 0.8)',
                        'rgba(255, 255, 255, 0.2)'
                    ],
                    borderColor: [
                        'rgba(0, 255, 255, 1)',
                        'rgba(255, 255, 255, 0.3)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                family: "'JetBrains Mono', monospace"
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    // Tickets chart (Bar)
    const ticketsCtx = document.getElementById('tickets-chart')?.getContext('2d');

    if (ticketsCtx) {
        if (ticketsChart) ticketsChart.destroy();
        
        loadTicketStats().then(ticketStats => {
            ticketsChart = new Chart(ticketsCtx, {
                type: 'bar',
                data: {
                    labels: ['Abiertos', 'En Progreso', 'Resueltos'],
                    datasets: [{
                        label: 'Tickets',
                        data: [ticketStats.open, ticketStats.in_progress, ticketStats.resolved],
                        backgroundColor: [
                            'rgba(255, 95, 86, 0.7)',
                            'rgba(255, 189, 46, 0.7)',
                            'rgba(39, 201, 63, 0.7)'
                        ],
                        borderColor: [
                            'rgba(255, 95, 86, 1)',
                            'rgba(255, 189, 46, 1)',
                            'rgba(39, 201, 63, 1)'
                        ],
                        borderWidth: 1,
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.5)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.5)',
                                font: {
                                    family: "'JetBrains Mono', monospace",
                                    size: 10
                                }
                            }
                        }
                    }
                }
            });
        });
    }

    // Credits Usage Chart (Line)
    loadCreditsUsageChart();
    
    // Geo Chart
    loadGeoChart();
}

async function loadTicketStats() {
    const client = await AdminSupabase.init();
    
    try {
        const [open, inProgress, resolved] = await Promise.all([
            client.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
            client.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
            client.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved')
        ]);
        
        return {
            open: open.count || 0,
            in_progress: inProgress.count || 0,
            resolved: resolved.count || 0
        };
    } catch (e) {
        return { open: 0, in_progress: 0, resolved: 0 };
    }
}

async function loadCreditsUsageChart() {
    const ctx = document.getElementById('credits-usage-chart')?.getContext('2d');
    if (!ctx) return;
    
    const client = await AdminSupabase.init();
    
    // Get usage for last 7 days
    const days = [];
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();
        
        const { count } = await client
            .from('cli_usage_log')
            .select('*', { count: 'exact', head: true })
            .eq('action_type', 'ai_query')
            .gte('created_at', dayStart)
            .lt('created_at', dayEnd);
        
        days.push(date.toLocaleDateString('es', { weekday: 'short' }));
        data.push(count || 0);
    }
    
    if (creditsUsageChart) creditsUsageChart.destroy();
    
    creditsUsageChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Consultas AI',
                data: data,
                borderColor: 'rgba(0, 255, 255, 1)',
                backgroundColor: 'rgba(0, 255, 255, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(0, 255, 255, 1)',
                pointBorderColor: '#000',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)'
                    }
                }
            }
        }
    });
}

async function loadGeoChart() {
    const ctx = document.getElementById('geo-chart')?.getContext('2d');
    if (!ctx) return;
    
    const client = await AdminSupabase.init();
    
    // Get sessions by country
    const { data: sessions } = await client
        .from('cli_sessions')
        .select('country_code, country')
        .not('country_code', 'is', null);
    
    if (!sessions || sessions.length === 0) {
        return;
    }
    
    // Count by country
    const countryCounts = {};
    sessions.forEach(s => {
        const country = s.country || s.country_code;
        countryCounts[country] = (countryCounts[country] || 0) + 1;
    });
    
    const sorted = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    
    if (geoChart) geoChart.destroy();
    
    geoChart = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: sorted.map(([c]) => c),
            datasets: [{
                data: sorted.map(([, count]) => count),
                backgroundColor: [
                    'rgba(0, 255, 255, 0.7)',
                    'rgba(0, 102, 255, 0.7)',
                    'rgba(147, 51, 234, 0.7)',
                    'rgba(255, 189, 46, 0.7)',
                    'rgba(39, 201, 63, 0.7)',
                    'rgba(255, 95, 86, 0.7)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            family: "'JetBrains Mono', monospace",
                            size: 10
                        }
                    }
                }
            },
            scales: {
                r: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        display: false
                    }
                }
            }
        }
    });
}

async function loadRecentActivity() {
    const activity = await AdminSupabase.getRecentActivity(10);
    const list = document.getElementById('activity-list');
    
    if (!list) return;
    
    if (!activity || activity.length === 0) {
        list.innerHTML = '<p class="no-data">No hay actividad reciente</p>';
        return;
    }
    
    list.innerHTML = activity.map(item => {
        const user = item.cli_users?.email || item.cli_users?.username || 'Sistema';
        const action = getActionLabel(item.action);
        const time = formatTime(item.created_at);
        const icon = getActionIcon(item.action);
        
        return `
            <div class="activity-item">
                <span class="activity-icon">${icon}</span>
                <div class="activity-info">
                    <span class="activity-user">${user}</span>
                    <span class="activity-action">${action}</span>
                </div>
                <span class="activity-time">${time}</span>
            </div>
        `;
    }).join('');
}

function getActionLabel(action) {
    const labels = {
        'login': 'Inició sesión',
        'page_view': 'Visitó página',
        'ai_query': 'Consulta AI',
        'purchase': 'Compra realizada',
        'logout': 'Cerró sesión'
    };
    return labels[action] || action;
}

function getActionIcon(action) {
    const icons = {
        'login': '🔓',
        'page_view': '👁️',
        'ai_query': '🤖',
        'purchase': '💳',
        'logout': '🚪'
    };
    return icons[action] || '📌';
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    
    return date.toLocaleDateString('es');
}

// Toast helper
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span> ${message}`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Make showToast global
window.showToast = showToast;

// Export
window.AdminAnalytics = {
    loadDashboard,
    loadCharts,
    showToast
};
