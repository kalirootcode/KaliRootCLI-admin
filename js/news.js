/**
 * KR-CLI DOMINION - Admin News Module
 * News and links management
 */

let newsData = [];
let currentCategory = 'all';

// Load news from API
async function loadNews(category = 'all') {
    currentCategory = category;
    
    try {
        // Load from the news API
        const response = await fetch('https://kr-clidn-api.onrender.com/api/news');
        const apiNews = await response.json();
        
        // Also load manual news from Supabase
        const manualNews = await loadManualNews();
        
        // Combine
        newsData = [
            ...(manualNews || []).map(n => ({ ...n, isManual: true })),
            ...(apiNews.news || [])
        ];
        
        renderNews();
    } catch (error) {
        console.error('Error loading news:', error);
        newsData = [];
        renderNews();
    }
}

async function loadManualNews() {
    const client = await AdminSupabase.init();
    if (!client) return [];
    
    const { data, error } = await client
        .from('admin_news_links')
        .select('*')
        .order('created_at', { ascending: false });
    
    return error ? [] : data;
}

function renderNews() {
    const grid = document.getElementById('news-grid');
    if (!grid) return;
    
    // Filter by category
    let filtered = newsData;
    if (currentCategory !== 'all') {
        filtered = newsData.filter(n => n.category === currentCategory);
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="no-news">
                <span>📰</span>
                <p>No hay noticias en esta categoría</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filtered.map(news => {
        const categoryIcon = getCategoryIcon(news.category);
        const isManual = news.isManual;
        
        return `
            <div class="news-card glass ${isManual ? 'manual-news' : ''}">
                <div class="news-header">
                    <span class="news-category">${categoryIcon} ${news.category || 'General'}</span>
                    ${isManual ? '<span class="manual-badge">📌 Manual</span>' : ''}
                </div>
                <h4 class="news-title">${news.title}</h4>
                <p class="news-desc">${news.description || news.summary || ''}</p>
                <div class="news-footer">
                    <a href="${news.url || news.link}" target="_blank" class="news-link">Ver más →</a>
                    ${isManual ? `
                        <button class="btn-icon delete-news" onclick="deleteNews('${news.id}')">🗑️</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getCategoryIcon(category) {
    const icons = {
        'vulnerabilities': '🔓',
        'exploits': '💥',
        'breaches': '🔴',
        'events': '📅',
        'tools': '🛠️'
    };
    return icons[category] || '📰';
}

// Add manual news
async function addNews(title, url, category, description) {
    const client = await AdminSupabase.init();
    if (!client) {
        showToast('Error de conexión', 'error');
        return false;
    }
    
    const { error } = await client
        .from('admin_news_links')
        .insert({
            title,
            url,
            category,
            description,
            created_by: AdminSupabase.getSession()?.id
        });
    
    if (error) {
        console.error('Error adding news:', error);
        showToast('Error al agregar noticia', 'error');
        return false;
    }
    
    showToast('Noticia agregada exitosamente', 'success');
    loadNews(currentCategory);
    return true;
}

// Delete manual news
async function deleteNews(newsId) {
    if (!confirm('¿Eliminar esta noticia?')) return;
    
    const client = await AdminSupabase.init();
    if (!client) return;
    
    const { error } = await client
        .from('admin_news_links')
        .delete()
        .eq('id', newsId);
    
    if (error) {
        showToast('Error al eliminar', 'error');
        return;
    }
    
    showToast('Noticia eliminada', 'success');
    loadNews(currentCategory);
}

// Show add news modal
function showAddNewsModal() {
    document.getElementById('add-news-modal').classList.add('active');
    document.getElementById('news-title').focus();
}

// Handle add news form
document.getElementById('add-news-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('news-title').value.trim();
    const url = document.getElementById('news-url').value.trim();
    const category = document.getElementById('news-category').value;
    const description = document.getElementById('news-description').value.trim();
    
    const success = await addNews(title, url, category, description);
    
    if (success) {
        closeModal('add-news-modal');
        e.target.reset();
    }
});

// Category filter buttons
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadNews(btn.dataset.cat);
    });
});

// Export
window.AdminNews = {
    load: loadNews,
    add: addNews,
    delete: deleteNews,
    showModal: showAddNewsModal
};
