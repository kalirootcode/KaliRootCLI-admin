/**
 * KR-CLI DOMINION - Admin Supabase Client
 * Supabase client for admin operations
 * Credentials are injected by GitHub Actions from secrets
 */

// Config is injected by GitHub Actions build process
// See .github/workflows/deploy.yml
function getConfig() {
    if (typeof window.SUPABASE_CONFIG === 'undefined') {
        console.error('⚠️ SUPABASE_CONFIG not found. Make sure config.js is loaded.');
        console.error('For local dev, create js/config.js with:');
        console.error('window.SUPABASE_CONFIG = { url: "...", anonKey: "..." }');
        return null;
    }
    return window.SUPABASE_CONFIG;
}

let adminClient = null;

/**
 * Initialize Supabase admin client
 */
async function initAdminClient() {
    if (adminClient) return adminClient;

    const config = getConfig();
    if (!config || !config.url || !config.anonKey) {
        console.error('❌ Invalid Supabase configuration');
        return null;
    }

    // Wait for Supabase SDK if not loaded
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase SDK not loaded');
        return null;
    }

    adminClient = supabase.createClient(config.url, config.anonKey);
    console.log('✅ Supabase admin client initialized');
    return adminClient;
}

// ===== Admin Authentication =====

async function adminLogin(email, password) {
    const client = await initAdminClient();
    if (!client) {
        return { success: false, error: 'Error de conexión con la base de datos' };
    }

    // Check admin_users table
    const { data: admin, error } = await client
        .from('admin_users')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !admin) {
        console.error('Admin lookup error:', error);
        return { success: false, error: 'Credenciales inválidas' };
    }

    // For demo: simple password check
    // The password hash in migration is for: krcli_admin_2026
    const isValid = await verifyPassword(password, admin.password_hash);

    if (!isValid) {
        return { success: false, error: 'Contraseña incorrecta' };
    }

    // Update last login
    await client
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', admin.id);

    // Store session
    sessionStorage.setItem('admin_session', JSON.stringify({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
    }));

    return { success: true, admin };
}

async function verifyPassword(password, hash) {
    // Simple verification for demo
    // In production, use bcrypt.compare on a server
    // For now, accept the default password
    if (password === 'krcli_admin_2026') {
        return true;
    }
    return false;
}

function getAdminSession() {
    const session = sessionStorage.getItem('admin_session');
    return session ? JSON.parse(session) : null;
}

function adminLogout() {
    sessionStorage.removeItem('admin_session');
    window.location.href = 'index.html';
}

// ===== User Management =====

async function getAllUsers(page = 1, limit = 20, search = '') {
    const client = await initAdminClient();
    if (!client) return { users: [], total: 0 };

    let query = client
        .from('cli_users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

    if (search) {
        query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching users:', error);
        return { users: [], total: 0 };
    }

    return { users: data, total: count };
}

async function getUserById(userId) {
    const client = await initAdminClient();
    if (!client) return null;

    const { data, error } = await client
        .from('cli_users')
        .select('*')
        .eq('id', userId)
        .single();

    return error ? null : data;
}

async function updateUser(userId, updates) {
    const client = await initAdminClient();
    if (!client) return { success: false, error: 'No connection' };

    const { error } = await client
        .from('cli_users')
        .update(updates)
        .eq('id', userId);

    return { success: !error, error: error?.message };
}

async function deleteUserById(userId) {
    const client = await initAdminClient();
    if (!client) return { success: false, error: 'No connection' };

    const { error } = await client
        .from('cli_users')
        .delete()
        .eq('id', userId);

    return { success: !error, error: error?.message };
}

async function addCreditsToUser(email, amount) {
    const client = await initAdminClient();
    if (!client) return { success: false, error: 'No connection' };

    const { data: user, error: findError } = await client
        .from('cli_users')
        .select('id, credit_balance')
        .eq('email', email)
        .single();

    if (findError || !user) {
        return { success: false, error: 'Usuario no encontrado' };
    }

    const { error } = await client
        .from('cli_users')
        .update({ credit_balance: user.credit_balance + amount })
        .eq('id', user.id);

    return { success: !error, error: error?.message };
}

async function activatePremium(email, days) {
    const client = await initAdminClient();
    if (!client) return { success: false, error: 'No connection' };

    const { data: user, error: findError } = await client
        .from('cli_users')
        .select('id')
        .eq('email', email)
        .single();

    if (findError || !user) {
        return { success: false, error: 'Usuario no encontrado' };
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    const { error } = await client
        .from('cli_users')
        .update({
            subscription_status: 'premium',
            subscription_expiry_date: expiryDate.toISOString()
        })
        .eq('id', user.id);

    return { success: !error, error: error?.message };
}

// ===== Analytics =====

async function getAnalytics() {
    const client = await initAdminClient();
    if (!client) return {
        totalUsers: 0, activeUsers: 0, premiumUsers: 0,
        freeUsers: 0, totalRevenue: 0, openTickets: 0
    };

    try {
        // Get counts
        const { count: totalUsers } = await client
            .from('cli_users')
            .select('*', { count: 'exact', head: true });

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { count: activeUsers } = await client
            .from('cli_users')
            .select('*', { count: 'exact', head: true })
            .gte('updated_at', thirtyDaysAgo.toISOString());

        const { count: premiumUsers } = await client
            .from('cli_users')
            .select('*', { count: 'exact', head: true })
            .eq('subscription_status', 'premium')
            .gte('subscription_expiry_date', new Date().toISOString());

        const { data: revenueData } = await client
            .from('cli_users')
            .select('total_spent');

        const totalRevenue = revenueData?.reduce((sum, u) => sum + (parseFloat(u.total_spent) || 0), 0) || 0;

        const { count: openTickets } = await client
            .from('support_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'open');

        return {
            totalUsers: totalUsers || 0,
            activeUsers: activeUsers || 0,
            premiumUsers: premiumUsers || 0,
            freeUsers: (totalUsers || 0) - (premiumUsers || 0),
            totalRevenue: totalRevenue,
            openTickets: openTickets || 0
        };
    } catch (e) {
        console.error('Analytics error:', e);
        return {
            totalUsers: 0, activeUsers: 0, premiumUsers: 0,
            freeUsers: 0, totalRevenue: 0, openTickets: 0
        };
    }
}

async function getRecentActivity(limit = 10) {
    const client = await initAdminClient();
    if (!client) return [];

    const { data, error } = await client
        .from('web_activity_log')
        .select('*, cli_users(email, username)')
        .order('created_at', { ascending: false })
        .limit(limit);

    return error ? [] : data;
}

// ===== Support Tickets =====

async function getTickets(status = 'all') {
    const client = await initAdminClient();
    if (!client) return [];

    let query = client
        .from('support_tickets')
        .select('*, support_messages(id, sender_type, is_read)')
        .order('updated_at', { ascending: false });

    if (status !== 'all') {
        query = query.eq('status', status);
    }

    const { data, error } = await query;
    return error ? [] : data;
}

async function getTicketMessages(ticketId) {
    const client = await initAdminClient();
    if (!client) return [];

    const { data, error } = await client
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

    // Mark as read
    await client
        .from('support_messages')
        .update({ is_read: true })
        .eq('ticket_id', ticketId)
        .eq('sender_type', 'user');

    return error ? [] : data;
}

async function sendAdminReply(ticketId, message) {
    const client = await initAdminClient();
    if (!client) return { success: false, error: 'No connection' };
    
    const admin = getAdminSession();

    const { error } = await client
        .from('support_messages')
        .insert({
            ticket_id: ticketId,
            sender_type: 'admin',
            sender_id: admin?.id,
            message: message
        });

    // Update ticket
    await client
        .from('support_tickets')
        .update({
            status: 'in_progress',
            updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

    return { success: !error, error: error?.message };
}

async function updateTicketStatus(ticketId, status) {
    const client = await initAdminClient();
    if (!client) return { success: false };

    const { error } = await client
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

    return { success: !error };
}

// Export globally
window.AdminSupabase = {
    init: initAdminClient,
    login: adminLogin,
    getSession: getAdminSession,
    logout: adminLogout,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser: deleteUserById,
    addCredits: addCreditsToUser,
    activatePremium,
    getAnalytics,
    getRecentActivity,
    getTickets,
    getTicketMessages,
    sendReply: sendAdminReply,
    updateTicketStatus
};
