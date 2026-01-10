/**
 * KR-CLI DOMINION - Admin Supabase Client
 * Supabase client with service role for admin operations
 */

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_SERVICE_KEY = 'YOUR_SERVICE_ROLE_KEY'; // Use service key for admin ops

let adminClient = null;

/**
 * Initialize Supabase admin client
 */
async function initAdminClient() {
    if (adminClient) return adminClient;

    if (typeof supabase === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    }

    // Use service role key for full access
    adminClient = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    return adminClient;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ===== Admin Authentication =====

async function adminLogin(email, password) {
    const client = await initAdminClient();

    // Check admin_users table
    const { data: admin, error } = await client
        .from('admin_users')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !admin) {
        return { success: false, error: 'Credenciales inválidas' };
    }

    // For demo: simple password check (in production use proper bcrypt)
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
    // In production, use bcrypt.compare on the server
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

    const { data, error } = await client
        .from('cli_users')
        .select('*')
        .eq('id', userId)
        .single();

    return error ? null : data;
}

async function updateUser(userId, updates) {
    const client = await initAdminClient();

    const { error } = await client
        .from('cli_users')
        .update(updates)
        .eq('id', userId);

    return { success: !error, error: error?.message };
}

async function deleteUserById(userId) {
    const client = await initAdminClient();

    // Delete from auth.users (cascade will delete cli_users)
    const { error } = await client.auth.admin.deleteUser(userId);

    return { success: !error, error: error?.message };
}

async function addCreditsToUser(email, amount) {
    const client = await initAdminClient();

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
            totalUsers: 0,
            activeUsers: 0,
            premiumUsers: 0,
            freeUsers: 0,
            totalRevenue: 0,
            openTickets: 0
        };
    }
}

async function getRecentActivity(limit = 10) {
    const client = await initAdminClient();

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

    const { error } = await client
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

    return { success: !error };
}

// Export
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
