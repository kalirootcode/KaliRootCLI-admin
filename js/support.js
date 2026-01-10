/**
 * KR-CLI DOMINION - Admin Support Module
 * Ticket management and chat functionality
 */

let currentTicket = null;

async function loadTickets() {
    const filter = document.getElementById('ticket-filter').value;
    const tickets = await window.AdminSupabase.getTickets(filter);
    const list = document.getElementById('tickets-list');

    // Update badge
    const openCount = tickets.filter(t => t.status === 'open').length;
    document.getElementById('ticket-count').textContent = openCount;

    if (!tickets.length) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 30px;">No hay tickets</p>';
        return;
    }

    list.innerHTML = tickets.map(ticket => {
        const hasUnread = ticket.support_messages?.some(m => m.sender_type === 'user' && !m.is_read);
        const date = new Date(ticket.created_at).toLocaleDateString('es-ES');

        return `
            <div class="ticket-item ${hasUnread ? 'unread' : ''} ${currentTicket?.id === ticket.id ? 'active' : ''}" 
                 onclick="openTicket('${ticket.id}')">
                <div class="ticket-subject">${ticket.subject}</div>
                <div class="ticket-meta">
                    <span>${ticket.user_email}</span>
                    <span class="ticket-priority ${ticket.priority}">${ticket.priority}</span>
                </div>
                <div class="ticket-meta">
                    <span>${date}</span>
                    <span>${ticket.status}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function openTicket(ticketId) {
    const tickets = await window.AdminSupabase.getTickets('all');
    currentTicket = tickets.find(t => t.id === ticketId);

    if (!currentTicket) return;

    const messages = await window.AdminSupabase.getTicketMessages(ticketId);
    const chatContainer = document.getElementById('ticket-chat');

    chatContainer.innerHTML = `
        <div class="chat-header">
            <div>
                <h3>${currentTicket.subject}</h3>
                <span style="font-size: 0.85rem; color: var(--text-secondary);">${currentTicket.user_email}</span>
            </div>
            <div class="chat-actions">
                <select onchange="updateTicketStatus('${ticketId}', this.value)" id="status-select">
                    <option value="open" ${currentTicket.status === 'open' ? 'selected' : ''}>Abierto</option>
                    <option value="in_progress" ${currentTicket.status === 'in_progress' ? 'selected' : ''}>En Progreso</option>
                    <option value="resolved" ${currentTicket.status === 'resolved' ? 'selected' : ''}>Resuelto</option>
                    <option value="closed" ${currentTicket.status === 'closed' ? 'selected' : ''}>Cerrado</option>
                </select>
            </div>
        </div>
        <div class="chat-messages" id="chat-messages">
            ${messages.map(msg => {
        const time = new Date(msg.created_at).toLocaleString('es-ES');
        return `
                    <div class="message ${msg.sender_type}">
                        ${msg.message}
                        <span class="message-time">${time}</span>
                    </div>
                `;
    }).join('')}
        </div>
        <div class="chat-input">
            <textarea id="reply-message" placeholder="Escribe tu respuesta..."></textarea>
            <button onclick="sendReply()">Enviar</button>
        </div>
    `;

    // Scroll to bottom
    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Refresh ticket list to clear unread badge
    loadTickets();
}

async function sendReply() {
    if (!currentTicket) return;

    const messageInput = document.getElementById('reply-message');
    const message = messageInput.value.trim();

    if (!message) return;

    const result = await window.AdminSupabase.sendReply(currentTicket.id, message);

    if (result.success) {
        messageInput.value = '';
        openTicket(currentTicket.id); // Refresh chat
    } else {
        alert('Error al enviar: ' + result.error);
    }
}

async function updateTicketStatus(ticketId, status) {
    await window.AdminSupabase.updateTicketStatus(ticketId, status);
    loadTickets();
}

// Filter change handler
document.getElementById('ticket-filter')?.addEventListener('change', loadTickets);
