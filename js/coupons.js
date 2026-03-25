// ============================================
// KR-ADMIN - Coupons
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const couponForm = document.getElementById('coupon-form');
    if (couponForm) {
        couponForm.addEventListener('submit', handleSaveCoupon);
    }
});

async function loadCoupons() {
    const tbody = document.getElementById('coupons-tbody');
    if (!tbody) return;

    try {
        const { data, error } = await supabaseAdmin
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = data.map(coupon => `
            <tr>
                <td><span class="badge-type">${coupon.code}</span></td>
                <td>${coupon.discount_percentage}%</td>
                <td>${new Date(coupon.expires_at).toLocaleDateString()}</td>
                <td>
                    <span class="status ${coupon.is_active ? 'published' : 'draft'}">
                        ${coupon.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn-icon" onclick="editCoupon('${coupon.id}', '${coupon.code}', ${coupon.discount_percentage}, '${coupon.expires_at.split('T')[0]}', ${coupon.is_active})">✏️</button>
                    <button class="btn-icon" onclick="deleteCoupon('${coupon.id}')">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading coupons:', error);
        toast.error('No se pudieron cargar los cupones.');
    }
}

function showCouponModal(id = null, code = '', discount = '', expires = '', active = true) {
    const modal = document.getElementById('coupon-modal');
    document.getElementById('coupon-id').value = id || '';
    document.getElementById('coupon-code').value = code || '';
    document.getElementById('coupon-discount').value = discount || '';
    document.getElementById('coupon-expires').value = expires || '';
    document.getElementById('coupon-active').checked = active;
    document.getElementById('coupon-modal-title').textContent = id ? 'Editar Cupón' : 'Nuevo Cupón';
    modal.style.display = 'flex';
}

async function handleSaveCoupon(e) {
    e.preventDefault();
    const id = document.getElementById('coupon-id').value;
    const couponData = {
        code: document.getElementById('coupon-code').value,
        discount_percentage: parseInt(document.getElementById('coupon-discount').value),
        expires_at: document.getElementById('coupon-expires').value,
        is_active: document.getElementById('coupon-active').checked,
    };

    try {
        let response;
        if (id) {
            response = await supabaseAdmin.from('coupons').update(couponData).eq('id', id);
        } else {
            response = await supabaseAdmin.from('coupons').insert(couponData);
        }

        if (response.error) throw response.error;

        toast.success(`Cupón ${id ? 'actualizado' : 'creado'} con éxito.`);
        closeModal('coupon-modal');
        loadCoupons();
    } catch (error) {
        console.error('Error saving coupon:', error);
        toast.error('Error al guardar el cupón. El código debe ser único.');
    }
}

function editCoupon(id, code, discount, expires, active) {
    showCouponModal(id, code, discount, expires, active);
}

async function deleteCoupon(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este cupón?')) return;

    try {
        const { error } = await supabaseAdmin.from('coupons').delete().eq('id', id);
        if (error) throw error;
        toast.success('Cupón eliminado.');
        loadCoupons();
    } catch (error) {
        console.error('Error deleting coupon:', error);
        toast.error('No se pudo eliminar el cupón.');
    }
}
