// ============================================
// KR-ADMIN - Categories
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', handleSaveCategory);
    }
});

async function loadCategories() {
    const tbody = document.getElementById('categories-tbody');
    if (!tbody) return;

    try {
        const { data, error } = await supabaseAdmin
            .from('categories')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        tbody.innerHTML = data.map(cat => `
            <tr>
                <td>${cat.name}</td>
                <td class="actions">
                    <button class="btn-icon" onclick="editCategory('${cat.id}', '${cat.name}')">✏️</button>
                    <button class="btn-icon" onclick="deleteCategory('${cat.id}')">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading categories:', error);
        toast.error('No se pudieron cargar las categorías.');
    }
}

function showCategoryModal(id = null, name = '') {
    const modal = document.getElementById('category-modal');
    document.getElementById('category-id').value = id || '';
    document.getElementById('category-name').value = name || '';
    document.getElementById('category-modal-title').textContent = id ? 'Editar Categoría' : 'Nueva Categoría';
    modal.classList.add('active');
}

async function handleSaveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value;

    try {
        let response;
        const upsertData = { id: id || undefined, name };

        if (id) {
             response = await supabaseAdmin.from('categories').update({ name }).eq('id', id);
        } else {
             response = await supabaseAdmin.from('categories').insert({ name });
        }

        if (response.error) throw response.error;

        toast.success(`Categoría ${id ? 'actualizada' : 'creada'} con éxito.`);
        closeModal('category-modal');
        loadCategories();
        // Also reload products to reflect category changes if needed
        loadProducts(); 
    } catch (error) {
        console.error('Error saving category:', error);
        toast.error('Error al guardar la categoría.');
    }
}

function editCategory(id, name) {
    showCategoryModal(id, name);
}

async function deleteCategory(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta categoría?')) return;

    try {
        const { error } = await supabaseAdmin.from('categories').delete().eq('id', id);
        if (error) throw error;
        toast.success('Categoría eliminada.');
        loadCategories();
        loadProducts();
    } catch (error) {
        console.error('Error deleting category:', error);
        toast.error('No se pudo eliminar la categoría. Asegúrate de que no esté siendo usada por ningún producto.');
    }
}
