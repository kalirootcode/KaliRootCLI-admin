/**
 * KR-CLI DOMINION - Admin Courses Management
 * Manages AI course generation and publishing
 */

// API Base URL - uses render backend
const COURSES_API = 'https://kalirootcli.onrender.com/api/education';

// State
let courseLinks = [];
let currentPreviewCourse = null;

// Initialize on section change
document.addEventListener('DOMContentLoaded', () => {
    // Add form listener
    const addForm = document.getElementById('add-course-link-form');
    if (addForm) {
        addForm.addEventListener('submit', handleAddCourseLink);
    }

    // Filter change listener
    const filter = document.getElementById('course-status-filter');
    if (filter) {
        filter.addEventListener('change', renderCourseLinks);
    }
});

// ===== Course Links CRUD =====

async function loadCourseLinks() {
    const client = await initAdminClient();
    if (!client) return;

    try {
        const { data, error } = await client
            .from('course_links')
            .select('*, ai_courses(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        courseLinks = data || [];
        renderCourseLinks();

        // Update badge count
        const pendingCount = courseLinks.filter(l => l.status === 'pending' || l.status === 'completed').length;
        document.getElementById('courses-count').textContent = pendingCount;
    } catch (e) {
        console.error('Error loading course links:', e);
        showToast('Error cargando links de cursos', 'error');
    }
}

async function handleAddCourseLink(e) {
    e.preventDefault();

    const urlInput = document.getElementById('course-url');
    const url = urlInput.value.trim();

    if (!url) return;

    const client = await initAdminClient();
    if (!client) return;

    try {
        const admin = getAdminSession();

        const { error } = await client
            .from('course_links')
            .insert({
                url: url,
                status: 'pending',
                created_by: admin?.id
            });

        if (error) throw error;

        showToast('Link agregado correctamente', 'success');
        urlInput.value = '';
        loadCourseLinks();
    } catch (e) {
        console.error('Error adding course link:', e);
        showToast('Error agregando link: ' + e.message, 'error');
    }
}

async function deleteCourseLink(linkId) {
    if (!confirm('¿Eliminar este link y su curso asociado?')) return;

    const client = await initAdminClient();
    if (!client) return;

    try {
        const { error } = await client
            .from('course_links')
            .delete()
            .eq('id', linkId);

        if (error) throw error;

        showToast('Link eliminado', 'success');
        loadCourseLinks();
    } catch (e) {
        console.error('Error deleting link:', e);
        showToast('Error eliminando link', 'error');
    }
}

// ===== Course Generation =====

async function generateCourse(linkId) {
    const client = await initAdminClient();
    if (!client) return;

    // Update status to generating
    await client
        .from('course_links')
        .update({ status: 'generating' })
        .eq('id', linkId);

    loadCourseLinks();
    showToast('Iniciando generación de curso con IA...', 'info');

    try {
        // Call the backend API to generate course
        const response = await fetch(`${COURSES_API}/admin/generate-course/${linkId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            showToast('¡Curso generado exitosamente!', 'success');
            loadCourseLinks();
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
    } catch (e) {
        console.error('Error generating course:', e);

        // Update status to error
        await client
            .from('course_links')
            .update({
                status: 'error',
                error_message: e.message
            })
            .eq('id', linkId);

        showToast('Error generando curso: ' + e.message, 'error');
        loadCourseLinks();
    }
}

// ===== Preview & Publish =====

async function previewCourse(linkId) {
    const link = courseLinks.find(l => l.id === linkId);
    if (!link || !link.ai_courses || link.ai_courses.length === 0) {
        showToast('No hay curso generado para previsualizar', 'error');
        return;
    }

    const course = link.ai_courses[0];
    currentPreviewCourse = course;

    const modal = document.getElementById('course-preview-modal');
    const titleEl = document.getElementById('preview-title');
    const contentEl = document.getElementById('preview-content');
    const publishBtn = document.getElementById('publish-btn');

    titleEl.textContent = course.title;
    publishBtn.style.display = course.is_published ? 'none' : 'block';

    // Render course preview
    contentEl.innerHTML = renderCoursePreview(course);

    modal.classList.add('active');
}

function renderCoursePreview(course) {
    const content = course.content || {};

    let html = `
        <div class="course-preview-header">
            <span class="course-icon">${course.icon || '📚'}</span>
            <div class="course-meta">
                <span class="difficulty ${course.difficulty}">${course.difficulty}</span>
                <span class="duration">⏱️ ${course.duration || '2-4 horas'}</span>
            </div>
        </div>
        <p class="course-description">${course.description || ''}</p>
    `;

    // Introduction
    if (content.intro) {
        html += `<div class="preview-intro"><h3>📖 Introducción</h3><p>${content.intro}</p></div>`;
    }

    // Objectives
    if (content.objectives && content.objectives.length) {
        html += `
            <div class="preview-objectives">
                <h3>🎯 Objetivos</h3>
                <ul>${content.objectives.map(o => `<li>${o}</li>`).join('')}</ul>
            </div>
        `;
    }

    // Modules
    if (content.modules && content.modules.length) {
        html += '<div class="preview-modules"><h3>📚 Módulos</h3>';
        content.modules.forEach((module, idx) => {
            html += `
                <div class="preview-module">
                    <h4>${idx + 1}. ${module.title}</h4>
                    ${module.sections ? module.sections.map(section => `
                        <div class="preview-section">
                            <h5>${section.title}</h5>
                            <p>${section.theory?.substring(0, 300)}...</p>
                            ${section.commands ? `
                                <div class="preview-commands">
                                    ${section.commands.slice(0, 2).map(cmd => `
                                        <code>${cmd.command}</code>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('') : ''}
                </div>
            `;
        });
        html += '</div>';
    }

    return html;
}

async function publishCurrentCourse() {
    if (!currentPreviewCourse) return;

    const client = await initAdminClient();
    if (!client) return;

    try {
        const { error } = await client
            .from('ai_courses')
            .update({
                is_published: true,
                published_at: new Date().toISOString()
            })
            .eq('id', currentPreviewCourse.id);

        if (error) throw error;

        // Also update link status
        await client
            .from('course_links')
            .update({ status: 'published' })
            .eq('id', currentPreviewCourse.link_id);

        showToast('¡Curso publicado exitosamente!', 'success');
        closeModal('course-preview-modal');
        loadCourseLinks();
    } catch (e) {
        console.error('Error publishing course:', e);
        showToast('Error publicando curso', 'error');
    }
}

async function unpublishCourse(courseId) {
    const client = await initAdminClient();
    if (!client) return;

    try {
        const { data: course, error: fetchError } = await client
            .from('ai_courses')
            .select('link_id')
            .eq('id', courseId)
            .single();

        if (fetchError) throw fetchError;

        const { error } = await client
            .from('ai_courses')
            .update({ is_published: false, published_at: null })
            .eq('id', courseId);

        if (error) throw error;

        // Update link status back to completed
        await client
            .from('course_links')
            .update({ status: 'completed' })
            .eq('id', course.link_id);

        showToast('Curso despublicado', 'success');
        loadCourseLinks();
    } catch (e) {
        console.error('Error unpublishing:', e);
        showToast('Error despublicando curso', 'error');
    }
}

// ===== Rendering =====

function renderCourseLinks() {
    const container = document.getElementById('course-links-list');
    if (!container) return;

    const filter = document.getElementById('course-status-filter')?.value || 'all';

    let filtered = courseLinks;
    if (filter !== 'all') {
        filtered = courseLinks.filter(link => link.status === filter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>📭</span>
                <p>No hay links de cursos${filter !== 'all' ? ' con este estado' : ''}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(link => {
        const course = link.ai_courses?.[0];
        const statusClass = link.status;
        const hasError = link.status === 'error';
        const hasCourse = course && link.status !== 'pending' && link.status !== 'generating';

        return `
            <div class="course-link-item ${statusClass}">
                <div class="link-status">
                    <span class="status-dot ${statusClass}"></span>
                </div>
                <div class="link-info">
                    <a href="${link.url}" target="_blank" class="link-url">${truncateUrl(link.url)}</a>
                    ${course ? `<span class="course-title">${course.title}</span>` : ''}
                    ${hasError ? `<span class="error-msg">${link.error_message || 'Error desconocido'}</span>` : ''}
                    <span class="link-date">${formatDate(link.created_at)}</span>
                </div>
                <div class="link-actions">
                    ${link.status === 'pending' ? `
                        <button class="btn-small btn-primary" onclick="generateCourse('${link.id}')">
                            🤖 Generar
                        </button>
                    ` : ''}
                    ${link.status === 'generating' ? `
                        <span class="generating-indicator">⏳ Generando...</span>
                    ` : ''}
                    ${hasCourse && !course.is_published ? `
                        <button class="btn-small btn-secondary" onclick="previewCourse('${link.id}')">
                            👁️ Preview
                        </button>
                        <button class="btn-small btn-primary" onclick="publishCourse('${course.id}')">
                            🚀 Publicar
                        </button>
                    ` : ''}
                    ${course?.is_published ? `
                        <span class="published-badge">✅ Publicado</span>
                        <button class="btn-small btn-secondary" onclick="unpublishCourse('${course.id}')">
                            ↩️ Despublicar
                        </button>
                    ` : ''}
                    ${hasError ? `
                        <button class="btn-small btn-secondary" onclick="generateCourse('${link.id}')">
                            🔄 Reintentar
                        </button>
                    ` : ''}
                    <button class="btn-small btn-danger" onclick="deleteCourseLink('${link.id}')">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Course categories with colors
const COURSE_CATEGORIES = {
    'reconnaissance': { name: 'Reconocimiento', color: '#3b82f6', icon: 'fa-search' },
    'resource-development': { name: 'Desarrollo de Recursos', color: '#8b5cf6', icon: 'fa-tools' },
    'initial-access': { name: 'Acceso Inicial', color: '#ef4444', icon: 'fa-door-open' },
    'execution': { name: 'Ejecución', color: '#f59e0b', icon: 'fa-play' },
    'persistence': { name: 'Persistencia', color: '#10b981', icon: 'fa-anchor' },
    'privilege-escalation': { name: 'Escalada de Privilegios', color: '#ec4899', icon: 'fa-arrow-up' },
    'defense-evasion': { name: 'Evasión de Defensas', color: '#6366f1', icon: 'fa-eye-slash' },
    'credential-access': { name: 'Acceso a Credenciales', color: '#14b8a6', icon: 'fa-key' },
    'discovery': { name: 'Descubrimiento', color: '#84cc16', icon: 'fa-binoculars' },
    'lateral-movement': { name: 'Movimiento Lateral', color: '#f97316', icon: 'fa-arrows-alt-h' },
    'collection': { name: 'Recolección', color: '#06b6d4', icon: 'fa-database' },
    'exfiltration': { name: 'Exfiltración', color: '#dc2626', icon: 'fa-upload' },
    'forensics': { name: 'Forense Digital', color: '#0ea5e9', icon: 'fa-microscope' },
    'web-security': { name: 'Seguridad Web', color: '#a855f7', icon: 'fa-globe' },
    'malware-analysis': { name: 'Análisis de Malware', color: '#be123c', icon: 'fa-virus' }
};

// Publish with category selection
async function publishCourse(courseId) {
    // Show category selection modal
    showCategoryModal(courseId);
}

function showCategoryModal(courseId) {
    // Remove existing modal if any
    const existing = document.getElementById('category-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'category-modal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content glass" style="max-width: 500px;">
            <div class="modal-header">
                <h2>Seleccionar Categoría</h2>
                <button class="modal-close" onclick="closeCategoryModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 15px; color: rgba(255,255,255,0.7);">Selecciona la categoría del curso antes de publicar:</p>
                <select id="course-category-select" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(6,182,212,0.3); border-radius: 8px; color: #fff; font-size: 1rem;">
                    ${Object.entries(COURSE_CATEGORIES).map(([key, cat]) => `
                        <option value="${key}" style="background: #1a1a2e;">${cat.name}</option>
                    `).join('')}
                </select>
            </div>
            <div class="modal-footer" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn-secondary" onclick="closeCategoryModal()">Cancelar</button>
                <button class="btn-primary" onclick="confirmPublish('${courseId}')">
                    <i class="fas fa-rocket"></i> Publicar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (modal) modal.remove();
}

async function confirmPublish(courseId) {
    const category = document.getElementById('course-category-select').value;
    closeCategoryModal();

    const client = await initAdminClient();
    if (!client) return;

    try {
        const { data: course, error: fetchErr } = await client
            .from('ai_courses')
            .select('link_id')
            .eq('id', courseId)
            .single();

        if (fetchErr) throw fetchErr;

        const { error } = await client
            .from('ai_courses')
            .update({
                is_published: true,
                published_at: new Date().toISOString(),
                category: category
            })
            .eq('id', courseId);

        if (error) throw error;

        await client
            .from('course_links')
            .update({ status: 'published' })
            .eq('id', course.link_id);

        showToast('¡Curso publicado!', 'success');
        loadCourseLinks();
        loadPublishedCourses();
    } catch (e) {
        console.error('Error publishing:', e);
        showToast('Error publicando', 'error');
    }
}

function refreshCourseLinks() {
    loadCourseLinks();
    loadPublishedCourses();
}

// ===== Published Courses Management =====

let publishedCourses = [];

async function loadPublishedCourses() {
    const client = await initAdminClient();
    if (!client) return;

    try {
        const { data, error } = await client
            .from('ai_courses')
            .select('*, course_links(url)')
            .eq('is_published', true)
            .order('published_at', { ascending: false });

        if (error) throw error;

        publishedCourses = data || [];
        renderPublishedCourses();
    } catch (e) {
        console.error('Error loading published courses:', e);
    }
}

function renderPublishedCourses() {
    const container = document.getElementById('published-courses-list');
    if (!container) return;

    if (publishedCourses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>📭</span>
                <p>No hay cursos publicados</p>
            </div>
        `;
        return;
    }

    container.innerHTML = publishedCourses.map(course => {
        return `
            <div class="course-link-item published">
                <div class="link-status">
                    <span class="status-dot published"></span>
                </div>
                <div class="link-info">
                    <span class="course-title">${course.icon || '📚'} ${course.title}</span>
                    <span class="link-date">Publicado: ${formatDate(course.published_at)}</span>
                    <span class="link-date">👁️ ${course.total_views || 0} vistas</span>
                </div>
                <div class="link-actions">
                    <a href="https://kalirootcode.com/curso.html?slug=${course.slug}" target="_blank" class="btn-small btn-secondary">
                        🔗 Ver en Web
                    </a>
                    <button class="btn-small btn-secondary" onclick="hidePublishedCourse('${course.id}')">
                        👁️‍🗨️ Ocultar
                    </button>
                    <button class="btn-small btn-danger" onclick="deletePublishedCourse('${course.id}')">
                        🗑️ Eliminar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function hidePublishedCourse(courseId) {
    if (!confirm('¿Ocultar este curso? Ya no será visible en la web pero se mantendrá en la base de datos.')) return;

    const client = await initAdminClient();
    if (!client) return;

    try {
        const { data: course, error: fetchError } = await client
            .from('ai_courses')
            .select('link_id')
            .eq('id', courseId)
            .single();

        if (fetchError) throw fetchError;

        const { error } = await client
            .from('ai_courses')
            .update({ is_published: false, published_at: null })
            .eq('id', courseId);

        if (error) throw error;

        // Update link status
        if (course?.link_id) {
            await client
                .from('course_links')
                .update({ status: 'completed' })
                .eq('id', course.link_id);
        }

        showToast('Curso ocultado de la web', 'success');
        loadPublishedCourses();
        loadCourseLinks();
    } catch (e) {
        console.error('Error hiding course:', e);
        showToast('Error ocultando curso', 'error');
    }
}

async function deletePublishedCourse(courseId) {
    if (!confirm('¿ELIMINAR PERMANENTEMENTE este curso? Esta acción no se puede deshacer.')) return;

    const client = await initAdminClient();
    if (!client) return;

    try {
        const { error } = await client
            .from('ai_courses')
            .delete()
            .eq('id', courseId);

        if (error) throw error;

        showToast('Curso eliminado permanentemente', 'success');
        loadPublishedCourses();
        loadCourseLinks();
    } catch (e) {
        console.error('Error deleting course:', e);
        showToast('Error eliminando curso', 'error');
    }
}

// ===== Helpers =====

function truncateUrl(url) {
    try {
        const u = new URL(url);
        let path = u.pathname;
        if (path.length > 40) {
            path = path.substring(0, 40) + '...';
        }
        return u.hostname + path;
    } catch {
        return url.length > 60 ? url.substring(0, 60) + '...' : url;
    }
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Initialize when section becomes visible
const coursesObserver = new MutationObserver((mutations) => {
    const section = document.getElementById('section-courses');
    if (section && section.classList.contains('active')) {
        loadCourseLinks();
        loadPublishedCourses();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        coursesObserver.observe(mainContent, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    // Also trigger on nav click
    document.querySelectorAll('.nav-item[data-section="courses"]').forEach(el => {
        el.addEventListener('click', () => {
            setTimeout(() => {
                loadCourseLinks();
                loadPublishedCourses();
            }, 100);
        });
    });
});
