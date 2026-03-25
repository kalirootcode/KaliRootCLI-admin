// ============================================
// KR-ADMIN - Productos (Infoproductos)
// ============================================

// --- DOM Elements ---
const productsTbody = document.getElementById('products-tbody');
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const productModalTitle = document.getElementById('product-modal-title');

// --- State ---
let currentProducts = [];
let filteredProducts = [];
let currentPage = 1;
const productsPerPage = 10;

// --- Functions ---

/**
 * Search and filter products
 */
function searchProducts() {
    const searchTerm = document.getElementById('product-search').value.toLowerCase();
    filteredProducts = currentProducts.filter(product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.type.toLowerCase().includes(searchTerm)
    );
    currentPage = 1;
    renderProducts();
}

/**
 * Fetch products from Supabase
 */
async function loadProducts() {
    if (!productsTbody) return;
    
    try {
        const { data, error } = await supabaseAdmin
            .from('products')
            .select('*, categories(name)') // Join with categories table
            .order('created_at', { ascending: false });

        if (error) throw error;

        currentProducts = data;
        filteredProducts = data; // Initialize filtered list
        renderProducts(); // Render immediately
    } catch (error) {
        console.error('Error loading products:', error);
        toast.error('No se pudieron cargar los productos');
    }
}

/**
 * Render products in the table
 */
function renderProducts() {
    if (!productsTbody) return;
    
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    productsTbody.innerHTML = paginatedProducts.map(product => `
        <tr>
            <td>${product.name}</td>
            <td>${product.categories ? product.categories.name : 'N/A'}</td>
            <td><span class="badge-type ${product.type}">${product.type}</span></td>
            <td>$${product.price.toFixed(2)}</td>
            <td>${product.stock === 0 ? 'Ilimitado' : product.stock}</td>
            <td>
                <span class="status ${product.is_published ? 'published' : 'draft'}">
                    ${product.is_published ? 'Publicado' : 'Borrador'}
                </span>
            </td>
            <td class="actions">
                <button class="btn-icon" onclick="editProduct('${product.id}')">✏️</button>
                <button class="btn-icon" onclick="deleteProduct('${product.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');

    renderPagination();
}

/**
 * Render pagination buttons
 */
function renderPagination() {
    const paginationContainer = document.getElementById('products-pagination');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.classList.add('pagination-btn');
        if (i === currentPage) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            currentPage = i;
            renderProducts();
        });
        paginationContainer.appendChild(button);
    }
}


/**
 * Show the modal for adding or editing a product
 */
async function showProductModal(productId = null) {
    productForm.reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-video-file').value = '';

    // --- Populate Categories Dropdown ---
    const categorySelect = document.getElementById('product-category');
    try {
        const { data: categories, error } = await supabaseAdmin.from('categories').select('id, name');
        if (error) throw error;
        categorySelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch(e) {
        toast.error('No se pudieron cargar las categorías.');
        return;
    }
    // ---

    if (productId) {
        const product = currentProducts.find(p => p.id === productId);
        if (product) {
            productModalTitle.textContent = 'Editar Infoproducto';
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-description').value = product.description;
            document.getElementById('product-type').value = product.type;
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-stock').value = product.stock;
            document.getElementById('product-image-url').value = product.image_url;
            document.getElementById('product-published').checked = product.is_published;
            categorySelect.value = product.category_id; // Set selected category

            const videoUrl = product.video_url;
            const videoUrlElement = document.getElementById('current-video-url');
            if (videoUrl) {
                if (!videoUrlElement) {
                    const newVideoUrlElement = document.createElement('p');
                    newVideoUrlElement.id = 'current-video-url';
                    newVideoUrlElement.innerHTML = `Video actual: <a href="${videoUrl}" target="_blank">Ver video</a>`;
                    document.getElementById('product-video-file').after(newVideoUrlElement);
                } else {
                    videoUrlElement.innerHTML = `Video actual: <a href="${videoUrl}" target="_blank">Ver video</a>`;
                }
            } else if(videoUrlElement) {
                videoUrlElement.remove();
            }
        }
    } else {
        productModalTitle.textContent = 'Agregar Infoproducto';
        const videoUrlElement = document.getElementById('current-video-url');
        if (videoUrlElement) {
            videoUrlElement.remove();
        }
    }

    productModal.style.display = 'flex';
}

/**
 * Handle form submission for product
 */
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const productId = document.getElementById('product-id').value;
    const videoFile = document.getElementById('product-video-file').files[0];
    let videoUrl = document.getElementById('current-video-url')?.querySelector('a')?.href || null;

    // 1. If a new video file is selected, upload it to S3
    if (videoFile) {
        try {
            // Get the currently logged-in user's token
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                toast.error("No estás autenticado. Por favor, inicia sesión de nuevo.");
                return;
            }
            const token = session.data.session.access_token;

            // Step 1: Get pre-signed URL from our backend
            const presignedResponse = await fetch('/api/s3/generate-upload-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    file_name: videoFile.name,
                    file_type: videoFile.type,
                }),
            });

            if (!presignedResponse.ok) {
                throw new Error('No se pudo obtener la URL de subida segura.');
            }

            const presignedData = await presignedResponse.json();
            
            // Step 2: Upload file to S3 using the pre-signed URL
            const formData = new FormData();
            Object.keys(presignedData.fields).forEach(key => {
                formData.append(key, presignedData.fields[key]);
            });
            formData.append('file', videoFile);

            const s3Response = await fetch(presignedData.url, {
                method: 'POST',
                body: formData,
            });

            if (!s3Response.ok) {
                throw new Error('Error al subir el archivo a S3.');
            }

            // The final URL of the object
            videoUrl = `${presignedData.url}/${presignedData.fields.key}`;
            toast.success('Video subido con éxito a S3.');

        } catch (error) {
            console.error('Error uploading video to S3:', error);
            toast.error(error.message || 'Error al subir el video a S3.');
            return; // Stop execution if upload fails
        }
    }

    // 2. Prepare product data for Supabase
    const productData = {
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value,
        type: document.getElementById('product-type').value,
        price: parseFloat(document.getElementById('product-price').value),
        stock: parseInt(document.getElementById('product-stock').value, 10),
        image_url: document.getElementById('product-image-url').value,
        is_published: document.getElementById('product-published').checked,
        video_url: videoUrl, // Add the new video URL (or existing one)
        category_id: document.getElementById('product-category').value,
    };

    // 3. Save product data to Supabase
    try {
        let response;
        if (productId) {
            // Update existing product
            response = await supabaseAdmin
                .from('products')
                .update(productData)
                .eq('id', productId);
        } else {
            // Create new product
            response = await supabaseAdmin
                .from('products')
                .insert([productData]);
        }

        if (response.error) throw response.error;

        toast.success(`Producto ${productId ? 'actualizado' : 'creado'} con éxito.`);
        closeModal('product-modal');
        loadProducts(); // Refresh the product list
    } catch (error) {
        console.error('Error saving product to Supabase:', error);
        toast.error('Error al guardar el producto en la base de datos.');
    }
});

/**
 * Set up product for editing
 */
function editProduct(productId) {
    showProductModal(productId);
}

/**
 * Delete a product
 */
async function deleteProduct(productId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        const { error } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) throw error;

        toast.success('Producto eliminado con éxito.');
        loadProducts();
    } catch (error) {
        console.error('Error deleting product:', error);
        toast.error('No se pudo eliminar el producto.');
    }
}

// Initial load for the section
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('section-products')) {
        loadProducts();

        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.addEventListener('input', searchProducts);
        }
    }
});
