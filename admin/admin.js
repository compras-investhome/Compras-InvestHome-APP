// Admin Module - Lógica del perfil de administrador
import { db } from '../database.js';

// Variables globales
let currentUser = null;
let currentUserType = null;
let currentObra = null;
let currentTienda = null;
let currentCategoria = null;
let carritoAdmin = [];
let searchResultsAdmin = [];
// Estado de paginación para búsqueda
let searchPaginationState = {
    query: '',
    productos: [],
    currentIndex: 0,
    itemsPerPage: 5,
    hasMore: false
};
let editingUsuarioId = null;
let editingObraId = null;
let editingTiendaId = null;
let previousAdminSubView = 'admin-tienda';
let obrasAsignadasUsuario = []; // Array de IDs de obras asignadas al usuario actual

// Funciones de utilidad para popups
function showAlert(message, title = 'Información') {
    return new Promise((resolve) => {
        const alertPopup = document.getElementById('custom-alert');
        const alertTitle = document.getElementById('custom-alert-title');
        const alertMessage = document.getElementById('custom-alert-message');
        const alertOk = document.getElementById('custom-alert-ok');
        
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        alertPopup.classList.add('active');
        
        const closeAlert = () => {
            alertPopup.classList.remove('active');
            alertOk.removeEventListener('click', closeAlert);
            alertPopup.querySelector('.custom-popup-overlay').removeEventListener('click', closeAlert);
            resolve();
        };
        
        alertOk.addEventListener('click', closeAlert);
        alertPopup.querySelector('.custom-popup-overlay').addEventListener('click', closeAlert);
    });
}

function showConfirm(message, title = 'Confirmar') {
    return new Promise((resolve) => {
        const confirmPopup = document.getElementById('custom-confirm');
        const confirmTitle = document.getElementById('custom-confirm-title');
        const confirmMessage = document.getElementById('custom-confirm-message');
        const confirmOk = document.getElementById('custom-confirm-ok');
        const confirmCancel = document.getElementById('custom-confirm-cancel');
        
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmPopup.classList.add('active');
        
        const closeConfirm = (result) => {
            confirmPopup.classList.remove('active');
            confirmOk.removeEventListener('click', () => closeConfirm(true));
            confirmCancel.removeEventListener('click', () => closeConfirm(false));
            confirmPopup.querySelector('.custom-popup-overlay').removeEventListener('click', () => closeConfirm(false));
            resolve(result);
        };
        
        confirmOk.addEventListener('click', () => closeConfirm(true));
        confirmCancel.addEventListener('click', () => closeConfirm(false));
        confirmPopup.querySelector('.custom-popup-overlay').addEventListener('click', () => closeConfirm(false));
    });
}

function showPrompt(message, htmlContent = '', title = 'Ingresar') {
    return new Promise((resolve) => {
        const promptPopup = document.getElementById('custom-prompt');
        const promptTitle = document.getElementById('custom-prompt-title');
        const promptMessage = document.getElementById('custom-prompt-message');
        const promptInput = document.getElementById('custom-prompt-input');
        const promptOk = document.getElementById('custom-prompt-ok');
        const promptCancel = document.getElementById('custom-prompt-cancel');
        
        promptTitle.textContent = title;
        if (htmlContent) {
            promptMessage.innerHTML = htmlContent;
            // Si hay un select, obtener su valor
            const select = promptMessage.querySelector('select');
            if (select) {
                promptInput.style.display = 'none';
                const handleOk = () => {
                    const value = select.value;
                    closePrompt(value || null);
                };
                promptOk.addEventListener('click', handleOk);
                promptOk.onclick = handleOk;
            } else {
                promptInput.style.display = 'block';
                promptInput.value = '';
                setTimeout(() => promptInput.focus(), 100);
            }
        } else {
            promptMessage.textContent = message;
            promptInput.style.display = 'block';
            // Si htmlContent tiene un valor, usarlo como valor inicial
            promptInput.value = htmlContent || '';
            promptInput.type = title.toLowerCase().includes('cantidad') || title.toLowerCase().includes('número') ? 'number' : 'text';
            setTimeout(() => promptInput.focus(), 100);
        }
        
        promptPopup.classList.add('active');
        
        const closePrompt = (result) => {
            promptPopup.classList.remove('active');
            promptOk.onclick = null;
            promptCancel.onclick = null;
            promptInput.removeEventListener('keypress', handleKeyPress);
            promptPopup.querySelector('.custom-popup-overlay').removeEventListener('click', () => closePrompt(null));
            resolve(result);
        };
        
        const handleKeyPress = (e) => {
            if (e.key === 'Enter' && promptInput.style.display !== 'none') {
                closePrompt(promptInput.value);
            }
        };
        
        if (promptInput.style.display !== 'none') {
            promptInput.addEventListener('keypress', handleKeyPress);
        }
        
        promptOk.addEventListener('click', () => {
            if (promptInput.style.display === 'none') {
                const select = promptMessage.querySelector('select');
                closePrompt(select ? select.value : null);
            } else {
                closePrompt(promptInput.value);
            }
        });
        promptCancel.addEventListener('click', () => closePrompt(null));
        promptPopup.querySelector('.custom-popup-overlay').addEventListener('click', () => closePrompt(null));
    });
}

// Funciones de utilidad
function sanitizeCascadeId(value) {
    const base = (value || 'sin-obra').toString();
    const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, '-');
    return sanitized || 'sin-obra';
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    editingUsuarioId = null;
    editingObraId = null;
    editingTiendaId = null;
}

function formatDateTime(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '';
    }
    return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatCurrency(value) {
    const number = Number(value) || 0;
    try {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(number);
    } catch (error) {
        return `${number.toFixed(2)} €`;
    }
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Función para descargar o abrir documento desde data URL
window.descargarDocumento = function(dataURL, nombreArchivo = 'documento') {
    if (!dataURL) return;
    
    try {
        // Convertir data URL a Blob
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) {
            u8arr[i] = bstr.charCodeAt(i);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobURL = URL.createObjectURL(blob);
        
        // Crear enlace temporal para descargar/abrir
        const link = document.createElement('a');
        link.href = blobURL;
        link.target = '_blank';
        link.click();
        
        // Limpiar después de un momento
        setTimeout(() => URL.revokeObjectURL(blobURL), 100);
    } catch (error) {
        console.error('Error al abrir documento:', error);
        alert('Error al abrir el documento');
    }
};

function getEstadoPagoPillClass(estado) {
    const normalized = (estado || '').toLowerCase();
    if (normalized.includes('cuenta')) {
        return 'estado-pago-cuenta';
    }
    if (normalized.includes('pagad')) {
        return 'estado-pago-pagado';
    }
    if (normalized.includes('pendiente')) {
        return 'estado-pago-pendiente';
    }
    if (normalized.includes('sin asignar') || !estado) {
        return 'estado-pago-sin-asignar';
    }
    return 'estado-pago-sin-asignar';
}

function getEstadoEnvioPillClass(estado) {
    const normalized = (estado || '').toLowerCase().replace(/[^a-z0-9]+/gi, '-');
    if (normalized.includes('nuevo')) {
        return 'estado-envio-nuevo';
    }
    if (normalized.includes('gestionando')) {
        return 'estado-envio-gestionando';
    }
    if (normalized.includes('sin-transporte')) {
        return 'estado-envio-sin-transporte';
    }
    if (normalized.includes('con-transporte')) {
        return 'estado-envio-con-transporte';
    }
    if (normalized.includes('online')) {
        return 'estado-envio-online';
    }
    if (normalized.includes('cerrado')) {
        return 'estado-envio-cerrado';
    }
    if (normalized.includes('en-espera') || normalized.includes('espera')) {
        return 'estado-envio-en-espera';
    }
    return 'estado-envio-nuevo';
}

function buildObraMapsLink(obraInfo, obraNombre) {
    let link = obraInfo?.direccionGoogleMaps || '';
    if (link && /^https?:\/\//i.test(link)) {
        return link;
    }
    const query = link || obraNombre;
    if (!query) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function isPedidoEspecial(pedido) {
    // Verificar flags explícitos
    if (pedido?.esPedidoEspecial || pedido?.pedidoEspecial || 
        pedido?.tipo === 'Especial' || pedido?.tipoPedido === 'Especial') {
        return true;
    }
    // Si no tiene tiendaId válido, es un pedido especial
    const tiendaId = pedido?.tiendaId;
    if (!tiendaId || (typeof tiendaId === 'string' && tiendaId.trim() === '')) {
        return true;
    }
    return false;
}

async function getObrasCatalog(pedidosReferencia = []) {
    let obras = [];
    if (typeof db.getAllObras === 'function') {
        const result = await db.getAllObras();
        if (Array.isArray(result)) {
            obras = result;
        }
    }
    
    const obraMap = new Map();
    obras.forEach(obra => {
        const obraId = obra.id || 'sin-obra';
        obraMap.set(obraId, {
            ...obra,
            id: obraId,
            nombreComercial: obra.nombreComercial || obra.nombre || obra.alias || 'Obra sin nombre'
        });
    });
    
    pedidosReferencia.forEach(pedido => {
        const obraId = pedido?.obraId || 'sin-obra';
        if (!obraMap.has(obraId)) {
            obraMap.set(obraId, {
                id: obraId,
                nombreComercial: pedido?.obraNombreComercial || pedido?.obra || 'Obra sin nombre'
            });
        }
    });
    
    const ordered = Array.from(obraMap.values());
    ordered.sort((a, b) => (a.nombreComercial || '').localeCompare(b.nombreComercial || '', 'es', { sensitivity: 'base' }));
    return ordered;
}

function createCascadeSection({ prefix, uniqueId, title, count, emptyMessage, defaultOpen = true }) {
    const sanitizedId = sanitizeCascadeId(uniqueId);
    const contentId = `${prefix}-content-${sanitizedId}`;
    const arrowId = `${prefix}-arrow-${sanitizedId}`;
    const section = document.createElement('div');
    section.className = 'cascade-section';
    section.innerHTML = `
        <div class="cascade-header" onclick="toggleContabSection('${contentId}', '${arrowId}')">
            <span class="cascade-header-title">${title}</span>
            <div class="cascade-header-meta">
                <span class="cascade-badge">${count}</span>
                <span class="cascade-arrow" id="${arrowId}">${defaultOpen ? '▼' : '▶'}</span>
            </div>
        </div>
        <div class="cascade-content" id="${contentId}" style="display: ${defaultOpen ? 'block' : 'none'};">
            ${count === 0 && emptyMessage ? `<p class="cascade-empty">${emptyMessage}</p>` : ''}
        </div>
    `;
    
    const content = section.querySelector(`#${contentId}`);
    return { section, content, contentId, arrowId };
}

window.toggleContabSection = function(contentId, arrowId) {
    const content = document.getElementById(contentId);
    const arrow = document.getElementById(arrowId);
    if (!content || !arrow) return;
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.textContent = '▼';
    } else {
        content.style.display = 'none';
        arrow.textContent = '▶';
    }
};

// Navegación y vistas
function showAdminView(viewName) {
    // Ocultar todas las vistas
    document.querySelectorAll('.admin-content-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Mostrar la vista seleccionada
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.add('active');
        previousAdminSubView = viewName;
    }
    
    // Mostrar/ocultar botón de carrito según la vista
    const cartButton = document.getElementById('cart-button-admin');
    if (cartButton) {
        if (viewName === 'admin-tienda' || viewName === 'admin-productos' || viewName === 'admin-categorias') {
            cartButton.style.display = 'flex';
        } else {
            cartButton.style.display = 'none';
        }
    }
    
    // Cargar datos según la vista
    if (viewName === 'admin-tienda') {
        loadTiendasAdminView();
        updateCartCountAdmin();
    } else if (viewName === 'admin-pedidos-especiales') {
        loadPedidosEspecialesAdmin();
        // Nota: loadPedidosEspecialesAdmin() ya activa la primera tab por defecto
    } else if (viewName === 'admin-cuentas') {
        loadCuentasAdmin();
    } else if (viewName === 'admin-historico') {
        loadHistoricoAdmin();
    } else if (viewName === 'admin-usuarios') {
        loadUsuarios('Técnico');
    } else if (viewName === 'admin-obras') {
        loadObras();
    } else if (viewName === 'admin-tiendas') {
        loadTiendasAdmin();
    }
}

// ========== FUNCIONES PARA VISTA DE TIENDA EN ADMIN ==========

async function loadTiendasAdminView() {
    let tiendas = await db.getAll('tiendas');
    
    // Filtrar solo tiendas activas
    tiendas = tiendas.filter(t => t.activa !== false);
    
    const container = document.getElementById('tiendas-list-admin');
    
    if (searchResultsAdmin.length > 0) {
        // Mostrar resultados de búsqueda como productos
        container.innerHTML = '';
        container.className = 'productos-list';
        
        // Optimización: Cargar todas las tiendas necesarias en batch antes de crear las cards
        const tiendasIds = [...new Set(searchResultsAdmin.map(p => p.tiendaId).filter(Boolean))];
        const tiendasMap = new Map();
        if (tiendasIds.length > 0) {
            // Cargar todas las tiendas en paralelo (el cache las optimizará automáticamente)
            const tiendasPromises = tiendasIds.map(tiendaId => 
                db.get('tiendas', tiendaId).then(tienda => ({ tiendaId, tienda }))
            );
            const tiendasResults = await Promise.all(tiendasPromises);
            tiendasResults.forEach(({ tiendaId, tienda }) => {
                if (tienda) {
                    tiendasMap.set(tiendaId, tienda);
                }
            });
        }
        
        // Crear cards con las tiendas ya cargadas
        for (const producto of searchResultsAdmin) {
            const card = await createProductoCardAdmin(producto, tiendasMap.get(producto.tiendaId));
            container.appendChild(card);
            
            // Agregar event listener al botón "Añadir"
            const btnAddSmall = card.querySelector('.btn-add-cart-small[data-producto-id]');
            if (btnAddSmall) {
                btnAddSmall.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const productoId = btnAddSmall.getAttribute('data-producto-id');
                    await addToCartAdmin(productoId, 1);
                });
            }
        }
        
        // Agregar botón "Cargar más" si hay más resultados
        const existingBtn = container.querySelector('.btn-cargar-mas-busqueda');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        if (searchPaginationState.hasMore) {
            const btnCargarMas = document.createElement('button');
            btnCargarMas.className = 'btn btn-primary btn-cargar-mas-busqueda';
            btnCargarMas.textContent = 'Cargar más resultados';
            btnCargarMas.style.marginTop = '1rem';
            btnCargarMas.style.width = '100%';
            btnCargarMas.addEventListener('click', async () => {
                btnCargarMas.disabled = true;
                btnCargarMas.textContent = 'Cargando...';
                await cargarMasResultadosBusqueda();
                loadTiendasAdminView(); // Recargar vista para mostrar nuevos resultados
                btnCargarMas.disabled = false;
                btnCargarMas.textContent = 'Cargar más resultados';
            });
            container.appendChild(btnCargarMas);
        }
    } else {
        container.innerHTML = '';
        container.className = 'tiendas-grid';
        // Limpiar estilos inline que puedan quedar de otras vistas
        container.style.display = '';
        container.style.flexDirection = '';
        container.style.padding = '';
        for (const tienda of tiendas) {
            const card = await createTiendaCardAdmin(tienda);
            container.appendChild(card);
        }
    }
}

// Calcular gastado de cuenta
async function calcularGastadoCuenta(tiendaId) {
    const pedidos = await db.getPedidosByTienda(tiendaId);
    let gastado = 0;
    
    for (const pedido of pedidos) {
        // Contar pedidos con estadoPago = 'Pago A cuenta' que tengan documento del sistema y no estén completados
        // NO contar los que tienen transferenciaPDF porque ya están pagados (se descuentan del gastado)
        if (pedido.estadoPago === 'Pago A cuenta' && pedido.estado !== 'Completado' && pedido.pedidoSistemaPDF && !pedido.transferenciaPDF) {
            // Usar precioReal si está disponible (precio que escribe la tienda)
            // Si no existe, calcular el total de los items como fallback
            let totalPedido = 0;
            if (pedido.precioReal !== null && pedido.precioReal !== undefined) {
                totalPedido = Number(pedido.precioReal) || 0;
            } else {
                // Fallback: calcular total de items
                totalPedido = pedido.items.reduce((total, item) => {
                    const precioItem = item.precio || 0;
                    const cantidad = item.cantidad || 0;
                    return total + (precioItem * cantidad);
                }, 0);
            }
            gastado += totalPedido;
        }
    }
    
    return gastado;
}

async function createTiendaCardAdmin(tienda) {
    const card = document.createElement('div');
    card.className = 'tienda-card';
    
    // Logo (arriba)
    let imagenHtml = '';
    const tieneLogo = tienda.logo && 
                      typeof tienda.logo === 'string' && 
                      tienda.logo.trim() !== '' && 
                      tienda.logo !== 'null' && 
                      tienda.logo !== 'undefined' &&
                      (tienda.logo.startsWith('data:image/') || tienda.logo.startsWith('http'));
    
    if (tieneLogo) {
        imagenHtml = `
            <img src="${tienda.logo}" alt="${escapeHtml(tienda.nombre)}" class="tienda-card-logo" onerror="this.style.display='none'; const icon = this.parentElement.querySelector('.tienda-card-icon'); if(icon) icon.style.display='flex';">
            <div class="tienda-card-icon" style="display: none;">${tienda.icono || '🏪'}</div>
        `;
    } else {
        imagenHtml = `<div class="tienda-card-icon">${tienda.icono || '🏪'}</div>`;
    }
    
    // Calcular gastado de cuenta
    let cuentaInfoHtml = '';
    if (tienda.servicios?.cuenta) {
        const gastado = await calcularGastadoCuenta(tienda.id);
        
        if (tienda.limiteCuenta) {
            // Tiene cuenta con límite
            const limite = Number(tienda.limiteCuenta) || 0;
            const porcentaje = limite > 0 ? (gastado / limite) * 100 : 0;
            const disponible = Math.max(0, limite - gastado);
            const colorBarra = porcentaje >= 100 ? '#ef4444' : porcentaje >= 80 ? '#f59e0b' : '#10b981';
            
            cuentaInfoHtml = `
                <div class="tienda-cuenta-info" style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-color); border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">Estado de Cuenta</div>
                    <div style="font-size: 0.875rem; margin-bottom: 0.25rem;">
                        <strong>${gastado.toFixed(2)}€</strong> gastado / <strong>${limite.toFixed(2)}€</strong> límite
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        Disponible: ${disponible.toFixed(2)}€
                    </div>
                    <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden; margin-bottom: 0.25rem;">
                        <div style="height: 100%; width: ${Math.min(100, porcentaje)}%; background: ${colorBarra}; transition: width 0.3s;"></div>
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); text-align: center;">
                        ${porcentaje.toFixed(1)}% utilizado
                    </div>
                </div>
            `;
        } else {
            // Cuenta sin límite
            cuentaInfoHtml = `
                <div class="tienda-cuenta-info" style="margin-top: 1rem; padding: 0.75rem; background: #d1fae5; border-radius: 8px; border: 1px solid #10b981;">
                    <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; color: #065f46;">Estado de Cuenta</div>
                    <div style="font-size: 0.875rem; color: #065f46;">
                        <strong>${gastado.toFixed(2)}€</strong> gastado
                    </div>
                    <div style="font-size: 0.75rem; color: #065f46; margin-top: 0.25rem; font-weight: 600;">
                        Cuenta sin límite
                    </div>
                </div>
            `;
        }
    } else {
        // No tiene cuenta
        cuentaInfoHtml = `
            <div class="tienda-cuenta-info" style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-color); border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">Estado de Cuenta</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                    Sin cuenta
                </div>
            </div>
        `;
    }
    
    // Construir el HTML de la card
    card.innerHTML = `
        <div class="tienda-card-content">
            ${imagenHtml}
            <h3 class="tienda-card-nombre">${escapeHtml(tienda.nombre)}</h3>
            ${tienda.sector ? `<div class="tienda-card-sector">${escapeHtml(tienda.sector)}</div>` : ''}
            ${cuentaInfoHtml}
        </div>
    `;
    
    card.addEventListener('click', () => {
        currentTienda = tienda;
        loadCategoriasAdmin(tienda.id);
    });
    
    return card;
}

async function loadCategoriasAdmin(tiendaId) {
    const categorias = await db.getCategoriasByTienda(tiendaId);
    const tienda = await db.get('tiendas', tiendaId);
    
    // Crear vista de categorías dinámicamente
    const mainContent = document.querySelector('#view-admin-tienda .main-content');
    const tiendasList = document.getElementById('tiendas-list-admin');
    
    if (tiendasList) {
        tiendasList.innerHTML = '';
        tiendasList.className = '';
        // Configurar contenedor con flex column como en loadProductosAdmin
        tiendasList.style.display = 'flex';
        tiendasList.style.flexDirection = 'column';
        tiendasList.style.padding = '1rem';
        
        // Agregar botón volver (mismo estilo que "Volver a categorías")
        const btnVolver = document.createElement('button');
        btnVolver.className = 'btn btn-secondary';
        btnVolver.textContent = '← Volver a tiendas';
        btnVolver.style.marginBottom = '1rem';
        btnVolver.style.width = '100%';
        btnVolver.addEventListener('click', () => {
            loadTiendasAdminView();
        });
        tiendasList.appendChild(btnVolver);
        
        // Crear grid para las categorías
        const categoriasGrid = document.createElement('div');
        categoriasGrid.className = 'categorias-grid';
        tiendasList.appendChild(categoriasGrid);
        
        categorias.forEach(categoria => {
            const card = document.createElement('div');
            card.className = 'categoria-card';
            card.innerHTML = `<h3>${categoria.nombre}</h3>`;
            card.addEventListener('click', () => {
                currentCategoria = categoria;
                loadProductosAdmin(categoria.id);
            });
            categoriasGrid.appendChild(card);
        });
    }
}

// Variables para paginación
let productosPaginacion = {
    offset: 0,
    hasMore: false,
    categoriaId: null,
    subCategoriaId: null,
    soloSinSubCategoria: true,
    lastDoc: null // Para paginación con cursor de Firestore
};

async function loadProductosAdmin(categoriaId, subCategoriaId = null) {
    const categoria = await db.get('categorias', categoriaId);
    if (!categoria) return;
    
    const container = document.getElementById('tiendas-list-admin');
    container.innerHTML = '';
    
    if (subCategoriaId) {
        // Vista de subcategoría: mostrar solo productos de esa subcategoría
        container.className = '';
        // Configurar contenedor con flex column (mismo estilo que otros botones de volver)
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.padding = '1rem';
        
        // Agregar botón volver (mismo estilo que otros botones de volver)
        const btnVolver = document.createElement('button');
        btnVolver.className = 'btn btn-secondary';
        btnVolver.textContent = '← Volver a subcategoría';
        btnVolver.style.marginBottom = '1rem';
        btnVolver.style.width = '100%';
        btnVolver.addEventListener('click', () => {
            loadProductosAdmin(categoriaId);
        });
        container.appendChild(btnVolver);
        
        // Crear contenedor para la lista de productos
        const productosList = document.createElement('div');
        productosList.className = 'productos-list';
        container.appendChild(productosList);
        
        // Actualizar referencia del contenedor para la paginación
        productosPaginacion.categoriaId = categoriaId;
        productosPaginacion.subCategoriaId = subCategoriaId;
        productosPaginacion.offset = 0;
        productosPaginacion.lastDoc = null; // Resetear cursor
        await cargarProductosPaginados(productosList, subCategoriaId, true);
    } else {
        // Vista de categoría: mostrar subcategorías + productos sin subcategoría
        container.className = '';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.padding = '1rem';
        
        // Agregar botón volver
        const btnVolver = document.createElement('button');
        btnVolver.className = 'btn btn-secondary';
        btnVolver.textContent = '← Volver a categorías';
        btnVolver.style.marginBottom = '1rem';
        btnVolver.style.width = '100%';
        btnVolver.addEventListener('click', () => {
            if (categoria.tiendaId) {
                loadCategoriasAdmin(categoria.tiendaId);
            }
        });
        container.appendChild(btnVolver);
        
        // 1. Cargar y mostrar subcategorías (si existen)
        const subcategorias = await db.getSubCategoriasByCategoria(categoriaId);
        const tieneSubcategorias = subcategorias.length > 0;
        
        if (tieneSubcategorias) {
            const subcategoriasGrid = document.createElement('div');
            subcategoriasGrid.className = 'categorias-grid';
            
            subcategorias.forEach(subcategoria => {
                const card = document.createElement('div');
                card.className = 'categoria-card';
                card.innerHTML = `<h3>${subcategoria.nombre}</h3>`;
                card.addEventListener('click', () => {
                    loadProductosAdmin(categoriaId, subcategoria.id);
                });
                subcategoriasGrid.appendChild(card);
            });
            
            container.appendChild(subcategoriasGrid);
            
            // Separador visual
            const separador = document.createElement('div');
            separador.style.height = '2px';
            separador.style.backgroundColor = 'var(--border-color)';
            separador.style.margin = '2rem 0 1rem 0';
            container.appendChild(separador);
        }
        
        // 2. Cargar y mostrar productos
        // Si hay subcategorías: solo productos sin subcategoría
        // Si NO hay subcategorías: TODOS los productos de la categoría
        const productosList = document.createElement('div');
        productosList.className = 'productos-list';
        container.appendChild(productosList);
        
        productosPaginacion.categoriaId = categoriaId;
        productosPaginacion.subCategoriaId = null;
        productosPaginacion.offset = 0;
        productosPaginacion.lastDoc = null; // Resetear cursor
        productosPaginacion.soloSinSubCategoria = tieneSubcategorias; // Solo filtrar si hay subcategorías
        
        // Cargar productos (siempre, incluso si no hay subcategorías)
        await cargarProductosPaginados(productosList, categoriaId, false);
    }
}

async function cargarProductosPaginados(container, id, esSubCategoria) {
    let resultado;
    
    try {
        if (esSubCategoria) {
            resultado = await db.getProductosBySubCategoriaPaginated(id, 5, productosPaginacion.offset, productosPaginacion.lastDoc);
        } else {
            // Si hay subcategorías, solo mostrar productos sin subcategoría
            // Si NO hay subcategorías, mostrar TODOS los productos
            const soloSinSubCategoria = productosPaginacion.soloSinSubCategoria !== undefined 
                ? productosPaginacion.soloSinSubCategoria 
                : true;
            resultado = await db.getProductosByCategoriaPaginated(id, 5, productosPaginacion.offset, soloSinSubCategoria, productosPaginacion.lastDoc);
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'empty-state';
        errorMessage.style.textAlign = 'center';
        errorMessage.style.padding = '2rem';
        errorMessage.style.color = 'var(--error-color, #e74c3c)';
        errorMessage.textContent = 'Error al cargar productos. Por favor, intenta de nuevo.';
        container.appendChild(errorMessage);
        productosPaginacion.hasMore = false;
        return;
    }
    
    // Si es la primera carga y no hay productos, mostrar mensaje
    if (productosPaginacion.offset === 0 && resultado.productos.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-state';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '2rem';
        emptyMessage.style.color = 'var(--text-secondary)';
        emptyMessage.textContent = esSubCategoria 
            ? 'No hay productos en esta subcategoría' 
            : 'No hay productos sin subcategoría en esta categoría';
        container.appendChild(emptyMessage);
        productosPaginacion.hasMore = false;
        return;
    }
    
    // Eliminar mensaje de vacío si existe
    const existingEmpty = container.querySelector('.empty-state');
    if (existingEmpty) {
        existingEmpty.remove();
    }
    
    for (const producto of resultado.productos) {
        const card = await createProductoCardAdmin(producto);
        container.appendChild(card);
        
        // Agregar event listener al botón "Añadir"
        const btnAddSmall = card.querySelector('.btn-add-cart-small[data-producto-id]');
        if (btnAddSmall) {
            btnAddSmall.addEventListener('click', async (e) => {
                e.stopPropagation();
                const productoId = btnAddSmall.getAttribute('data-producto-id');
                await addToCartAdmin(productoId, 1);
            });
        }
    }
    
    productosPaginacion.hasMore = resultado.hasMore;
    productosPaginacion.offset += resultado.productos.length;
    // Guardar último documento para paginación con cursor (si está disponible)
    if (resultado.lastDoc) {
        productosPaginacion.lastDoc = resultado.lastDoc;
    }
    
    // Agregar botón "Cargar más" si hay más productos
    const existingBtn = container.querySelector('.btn-cargar-mas-productos');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    if (resultado.hasMore) {
        const btnCargarMas = document.createElement('button');
        btnCargarMas.className = 'btn btn-primary btn-cargar-mas-productos';
        btnCargarMas.textContent = 'Cargar más Artículos';
        btnCargarMas.style.marginTop = '1rem';
        btnCargarMas.style.width = '100%';
        btnCargarMas.addEventListener('click', async () => {
            btnCargarMas.disabled = true;
            btnCargarMas.textContent = 'Cargando...';
            await cargarProductosPaginados(container, id, esSubCategoria);
            btnCargarMas.disabled = false;
            btnCargarMas.textContent = 'Cargar más Artículos';
        });
        container.appendChild(btnCargarMas);
    }
}

async function createProductoCardAdmin(producto, tiendaPrecargada = null) {
    const card = document.createElement('div');
    card.className = 'producto-card-admin';
    card.dataset.productoId = producto.id;
    
    const cantidadEnCarrito = getCantidadEnCarritoAdmin(producto.id);
    const foto = producto.foto ? `<img src="${producto.foto}" alt="${escapeHtml(producto.nombre)}" class="producto-foto" onerror="this.style.display='none'">` : '<div class="producto-foto-placeholder">📦</div>';
    
    let vendidoPor = '';
    if (searchResultsAdmin.length > 0 && producto.tiendaId) {
        // Si la tienda ya fue precargada, usarla directamente (optimización batch loading)
        let tienda = tiendaPrecargada;
        if (!tienda) {
            try {
                // Si no está precargada, usar cache (que ya está optimizado en db.get())
                tienda = await db.get('tiendas', producto.tiendaId);
            } catch (error) {
                console.error('Error al obtener tienda:', error);
            }
        }
        if (tienda) {
            vendidoPor = `<div class="producto-vendido-por">Vendido por: <strong>${escapeHtml(tienda.nombre)}</strong></div>`;
        }
    }
    
    // Información completa (siempre visible por defecto)
    const infoCompleta = `
        <div class="producto-card-header">
            ${foto}
            <div class="producto-card-info">
                <h3 class="producto-nombre">${escapeHtml(producto.nombre)}</h3>
                ${producto.precio ? `<div class="producto-precio">${producto.precio.toFixed(2)} €</div>` : ''}
            </div>
            <button class="btn-expand-producto" data-producto-id="${producto.id}" title="Ampliar" aria-label="Ampliar producto">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 2L6 2M6 2L6 6M6 2L2 6M14 2L10 2M10 2L10 6M10 2L14 6M2 14L6 14M6 14L6 10M6 14L2 10M14 14L10 14M10 14L10 10M10 14L14 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
        ${vendidoPor}
        ${producto.descripcion ? `<div class="producto-descripcion">${escapeHtml(producto.descripcion)}</div>` : ''}
        ${producto.referencia ? `<div class="producto-referencia"><strong>Referencia:</strong> ${escapeHtml(producto.referencia)}</div>` : ''}
        ${producto.ean ? `<div class="producto-ean"><strong>EAN:</strong> ${escapeHtml(producto.ean)}</div>` : ''}
    `;
    
    // Acciones básicas (siempre visibles)
    const accionesBasicas = `
        <div class="producto-actions-basic">
            ${cantidadEnCarrito > 0 ? `
                <div class="quantity-control">
                    <button class="quantity-btn quantity-btn-minus" onclick="decrementProductoAdmin('${producto.id}')">-</button>
                    <span class="quantity-value">${cantidadEnCarrito}</span>
                    <button class="quantity-btn quantity-btn-plus" onclick="incrementProductoAdmin('${producto.id}')">+</button>
                </div>
            ` : `
                <button class="btn-add-cart-small" data-producto-id="${producto.id}">+</button>
            `}
        </div>
    `;
    
    card.innerHTML = `
        ${infoCompleta}
        ${accionesBasicas}
    `;
    
    // Event listener para el botón de ampliar
    const btnExpand = card.querySelector('.btn-expand-producto');
    if (btnExpand) {
        btnExpand.addEventListener('click', (e) => {
            e.stopPropagation();
            expandProductoCard(producto.id);
        });
    }
    
    return card;
}

function expandProductoCard(productoId) {
    const card = document.querySelector(`.producto-card-admin[data-producto-id="${productoId}"]`);
    if (!card) return;
    
    // Si ya está ampliada, colapsarla
    if (card.classList.contains('ampliada')) {
        card.classList.remove('ampliada');
        // Remover overlay si existe
        const overlay = document.querySelector('.producto-card-overlay');
        if (overlay) overlay.remove();
        return;
    }
    
    // Ampliar la card (hacer más grande)
    card.classList.add('ampliada');
    
    // Crear overlay para cerrar
    const overlay = document.createElement('div');
    overlay.className = 'producto-card-overlay';
    overlay.addEventListener('click', () => {
        card.classList.remove('ampliada');
        overlay.remove();
    });
    document.body.appendChild(overlay);
    
    // Scroll suave a la card
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

window.collapseProductoCard = function(productoId) {
    const card = document.querySelector(`.producto-card-admin[data-producto-id="${productoId}"]`);
    if (!card) return;
    
    card.classList.remove('ampliada');
    const overlay = document.querySelector('.producto-card-overlay');
    if (overlay) overlay.remove();
};

// Búsqueda en admin
async function performSearchAdmin(query) {
    // Resetear paginación para nueva búsqueda
    searchPaginationState = {
        query: query,
        productos: [],
        currentIndex: 0,
        itemsPerPage: 5,
        hasMore: false
    };
    
    // Cargar primeros 5 resultados
    await cargarMasResultadosBusqueda();
    loadTiendasAdminView();
}

// Función para cargar más resultados de búsqueda (paginación)
async function cargarMasResultadosBusqueda() {
    const { query, currentIndex, itemsPerPage } = searchPaginationState;
    
    if (!query || query.length < 2) {
        searchResultsAdmin = [];
        return;
    }
    
    try {
        const resultado = await db.searchProductos(query, itemsPerPage, currentIndex);
        
        // Agregar a los resultados acumulados
        searchPaginationState.productos.push(...resultado.productos);
        searchPaginationState.currentIndex += resultado.productos.length;
        searchPaginationState.hasMore = resultado.hasMore;
        
        // Actualizar searchResultsAdmin para compatibilidad
        searchResultsAdmin = searchPaginationState.productos;
    } catch (error) {
        console.error('Error al cargar resultados de búsqueda:', error);
        searchResultsAdmin = [];
        searchPaginationState.hasMore = false;
    }
}

// Carrito en admin
function getCantidadEnCarritoAdmin(productoId) {
    const item = carritoAdmin.find(item => item.productoId === productoId);
    return item ? item.cantidad : 0;
}

async function addToCartAdmin(productoId, cantidad = 1) {
    // El cache ya está implementado en db.get(), así que esta llamada será optimizada automáticamente
    const producto = await db.get('productos', productoId);
    if (!producto) {
        await showAlert('Error: Producto no encontrado', 'Error');
        return;
    }
    
    const cantidadNum = parseInt(cantidad) || 1;
    if (cantidadNum < 1) {
        await showAlert('La cantidad debe ser al menos 1', 'Error');
        return;
    }
    
    const existingItem = carritoAdmin.find(item => item.productoId === productoId);
    
    if (existingItem) {
        existingItem.cantidad += cantidadNum;
    } else {
        carritoAdmin.push({
            productoId: productoId,
            producto: producto,
            cantidad: cantidadNum
        });
    }
    
    updateCartCountAdmin();
    updateProductoCardAdmin(productoId);
}

function updateCartCountAdmin() {
    const count = carritoAdmin.reduce((sum, item) => sum + item.cantidad, 0);
    const cartCountEl = document.getElementById('cart-count-admin');
    if (cartCountEl) {
        cartCountEl.textContent = count;
        cartCountEl.style.display = count > 0 ? 'flex' : 'none';
    }
}

function showCarritoAdmin() {
    const modal = document.getElementById('modal-carrito-admin');
    if (modal) {
        loadCarritoAdmin();
        modal.classList.add('active');
    }
}

async function loadCarritoAdmin() {
    const container = document.getElementById('carrito-items-admin');
    const emptyState = document.getElementById('carrito-empty-admin');
    const btnFinalizar = document.getElementById('btn-finalizar-pedido-admin');
    const totalElement = document.getElementById('carrito-total-admin');
    
    if (!container || !emptyState || !btnFinalizar || !totalElement) return;
    
    if (carritoAdmin.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        btnFinalizar.disabled = true;
        totalElement.textContent = '0.00 €';
        return;
    }
    
    emptyState.style.display = 'none';
    btnFinalizar.disabled = false;
    
    // Agrupar por tienda
    const itemsPorTienda = {};
    for (const item of carritoAdmin) {
        const tiendaId = item.producto?.tiendaId || item.tiendaId;
        if (!tiendaId) continue;
        
        if (!itemsPorTienda[tiendaId]) {
            try {
                const tienda = await db.get('tiendas', tiendaId);
                itemsPorTienda[tiendaId] = {
                    tienda: tienda,
                    items: []
                };
            } catch (error) {
                console.error('Error al obtener tienda:', error);
                continue;
            }
        }
        itemsPorTienda[tiendaId].items.push(item);
    }
    
    container.innerHTML = '';
    let total = 0;
    
    for (const [tiendaId, data] of Object.entries(itemsPorTienda)) {
        const grupo = document.createElement('div');
        grupo.className = 'carrito-item-admin';
        
        const itemsHtml = data.items.map(item => {
            const producto = item.producto || item;
            const precio = producto.precio || 0;
            const subtotal = precio * item.cantidad;
            total += subtotal;
            
            const foto = producto.foto ? `<img src="${producto.foto}" alt="${escapeHtml(producto.nombre)}" class="carrito-item-foto" onerror="this.style.display='none'">` : '<div class="carrito-item-foto-placeholder">📦</div>';
            
            return `
                <div class="carrito-item-producto-admin">
                    ${foto}
                    <div class="carrito-item-info">
                        <h4>${escapeHtml(producto.nombre)}</h4>
                        ${producto.descripcion ? `<p class="carrito-item-desc">${escapeHtml(producto.descripcion)}</p>` : ''}
                        <div class="carrito-item-precio-unitario">${precio.toFixed(2)} € / unidad</div>
                    </div>
                    <div class="carrito-item-controls">
                        <div class="carrito-quantity-control">
                            <button class="carrito-quantity-btn carrito-quantity-minus decrement-carrito-admin" data-producto-id="${item.productoId}" aria-label="Disminuir cantidad">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 8H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                            <span class="carrito-quantity-value">${item.cantidad}</span>
                            <button class="carrito-quantity-btn carrito-quantity-plus increment-carrito-admin" data-producto-id="${item.productoId}" aria-label="Aumentar cantidad">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 4V12M4 8H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                        </div>
                        <div class="carrito-item-subtotal">
                            <span class="carrito-subtotal-label">Subtotal</span>
                            <span class="carrito-subtotal-value">${subtotal.toFixed(2)} €</span>
                        </div>
                        <button class="btn-remove-item-carrito remove-carrito-admin" data-producto-id="${item.productoId}" title="Eliminar artículo" aria-label="Eliminar artículo">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M10 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M14 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        grupo.innerHTML = `
            <div class="carrito-item-header-admin">
                <span class="carrito-item-tienda">Vendido por: <strong>${escapeHtml(data.tienda.nombre)}</strong></span>
            </div>
            ${itemsHtml}
        `;
        
        container.appendChild(grupo);
        
        // Event listeners
        grupo.querySelectorAll('.increment-carrito-admin').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productoId = btn.getAttribute('data-producto-id');
                incrementCarritoItemAdmin(productoId);
            });
        });
        
        grupo.querySelectorAll('.decrement-carrito-admin').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productoId = btn.getAttribute('data-producto-id');
                decrementCarritoItemAdmin(productoId);
            });
        });
        
        grupo.querySelectorAll('.remove-carrito-admin').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productoId = btn.getAttribute('data-producto-id');
                removeCarritoItemAdmin(productoId);
            });
        });
    }
    
    totalElement.textContent = `${total.toFixed(2)} €`;
    
    // Event listener para finalizar pedido
    btnFinalizar.onclick = null; // Remover listeners anteriores
    btnFinalizar.addEventListener('click', finalizarPedidoAdmin);
}

function incrementCarritoItemAdmin(productoId) {
    const item = carritoAdmin.find(item => item.productoId === productoId);
    if (item) {
        item.cantidad++;
    } else {
        // Si no existe, intentar añadirlo
        db.get('productos', productoId).then(producto => {
            if (producto) {
                carritoAdmin.push({
                    productoId: productoId,
                    producto: producto,
                    cantidad: 1
                });
                updateCartCountAdmin();
                loadCarritoAdmin();
            }
        });
        return;
    }
    updateCartCountAdmin();
    loadCarritoAdmin();
}

function decrementCarritoItemAdmin(productoId) {
    const item = carritoAdmin.find(item => item.productoId === productoId);
    if (item) {
        item.cantidad--;
        if (item.cantidad <= 0) {
            const index = carritoAdmin.indexOf(item);
            carritoAdmin.splice(index, 1);
        }
        updateCartCountAdmin();
        loadCarritoAdmin();
    }
}

function removeCarritoItemAdmin(productoId) {
    carritoAdmin = carritoAdmin.filter(item => item.productoId !== productoId);
    updateCartCountAdmin();
    loadCarritoAdmin();
}

async function finalizarPedidoAdmin() {
    if (carritoAdmin.length === 0) {
        await showAlert('El carrito está vacío', 'Error');
        return;
    }
    
    // Pedir selección de obra
    const obras = await db.getAll('obras');
    if (obras.length === 0) {
        await showAlert('No hay obras disponibles. Por favor, crea una obra primero.', 'Error');
        return;
    }
    
    // Crear opciones de obras
    const obrasOptions = obras.map(obra => 
        `<option value="${obra.id}">${escapeHtml(obra.nombreComercial || obra.nombre || 'Sin nombre')}</option>`
    ).join('');
    
    const obraSelectHtml = `
        <div class="form-group">
            <label for="select-obra-pedido-admin">Selecciona la obra:</label>
            <select id="select-obra-pedido-admin" class="form-select" required>
                <option value="">-- Selecciona una obra --</option>
                ${obrasOptions}
            </select>
        </div>
    `;
    
    // Mostrar prompt con selector de obra
    const obraId = await showPrompt('Selecciona la obra para el pedido', obraSelectHtml);
    if (!obraId) return;
    
    const obra = await db.get('obras', obraId);
    if (!obra) {
        await showAlert('Obra no encontrada', 'Error');
        return;
    }
    
    // Agrupar por tienda
    const itemsPorTienda = {};
    for (const item of carritoAdmin) {
        const tiendaId = item.producto?.tiendaId || item.tiendaId;
        if (!tiendaId) continue;
        
        if (!itemsPorTienda[tiendaId]) {
            itemsPorTienda[tiendaId] = [];
        }
        itemsPorTienda[tiendaId].push(item);
    }
    
    const pedidosCreados = [];
    for (const [tiendaId, items] of Object.entries(itemsPorTienda)) {
        try {
            const tienda = await db.get('tiendas', tiendaId);
            
            let estadoPago = null;
            if (!tienda.servicios?.cuenta) {
                estadoPago = 'Pendiente de pago';
            } else {
                estadoPago = 'Sin Asignar';
            }
            
            const pedido = {
                tiendaId: tiendaId,
                userId: currentUser.id,
                persona: currentUser.username,
                obraId: obra.id,
                obraNombreComercial: obra.nombreComercial || obra.nombre,
                obraDireccionGoogleMaps: obra.direccionGoogleMaps || '',
                obraEncargado: obra.encargado || '',
                obraTelefono: obra.telefonoEncargado || '',
                items: items.map(item => {
                    const producto = item.producto || item;
                    return {
                        productoId: item.productoId,
                        nombre: producto.nombre,
                        designacion: producto.designacion || null,
                        referencia: producto.referencia || null,
                        ean: producto.ean || null,
                        foto: producto.foto || null,
                        descripcion: producto.descripcion,
                        precio: producto.precio || 0,
                        cantidad: item.cantidad
                    };
                }),
                estado: 'Pendiente',
                estadoPago: estadoPago,
                fechaCreacion: new Date().toISOString(),
                fechaActualizacion: new Date().toISOString()
            };
            
            const pedidoId = await db.add('pedidos', pedido);
            pedidosCreados.push({ id: pedidoId, tienda: tienda.nombre });
        } catch (error) {
            console.error('Error al crear pedido:', error);
            await showAlert(`Error al crear pedido para ${tienda.nombre}: ${error.message}`, 'Error');
        }
    }
    
    // Limpiar carrito
    carritoAdmin = [];
    updateCartCountAdmin();
    
    // Cerrar modal
    const modal = document.getElementById('modal-carrito-admin');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Mostrar mensaje de éxito
    const mensaje = pedidosCreados.length === 1 
        ? `Pedido creado exitosamente para ${pedidosCreados[0].tienda}`
        : `${pedidosCreados.length} pedidos creados exitosamente`;
    
    await showAlert(mensaje, 'Éxito');
    
    // Recargar vista si es necesario
    if (previousAdminSubView === 'admin-tienda') {
        loadTiendasAdminView();
    }
}

window.incrementProductoAdmin = async function(productoId) {
    const item = carritoAdmin.find(item => item.productoId === productoId);
    if (item) {
        item.cantidad++;
    } else {
        // El cache ya está implementado en db.get(), así que esta llamada será optimizada automáticamente
        const producto = await db.get('productos', productoId);
        if (producto) {
            carritoAdmin.push({
                productoId: productoId,
                producto: producto,
                cantidad: 1
            });
        }
    }
    updateCartCountAdmin();
    updateProductoCardAdmin(productoId);
};

window.decrementProductoAdmin = function(productoId) {
    const item = carritoAdmin.find(item => item.productoId === productoId);
    if (item) {
        item.cantidad--;
        if (item.cantidad <= 0) {
            const index = carritoAdmin.indexOf(item);
            carritoAdmin.splice(index, 1);
        }
        updateCartCountAdmin();
        updateProductoCardAdmin(productoId);
    }
};

function updateProductoCardAdmin(productoId) {
    const card = document.querySelector(`.producto-card-admin[data-producto-id="${productoId}"]`);
    if (!card) return;
    
    const cantidadEnCarrito = getCantidadEnCarritoAdmin(productoId);
    const actionsBasic = card.querySelector('.producto-actions-basic');
    
    if (cantidadEnCarrito > 0) {
        // Actualizar controles básicos
        if (actionsBasic) {
            actionsBasic.innerHTML = `
                <div class="quantity-control">
                    <button class="quantity-btn quantity-btn-minus" onclick="decrementProductoAdmin('${productoId}')">-</button>
                    <span class="quantity-value">${cantidadEnCarrito}</span>
                    <button class="quantity-btn quantity-btn-plus" onclick="incrementProductoAdmin('${productoId}')">+</button>
                </div>
            `;
        }
    } else {
        // Restaurar botón de añadir básico
        if (actionsBasic) {
            actionsBasic.innerHTML = `
                <button class="btn-add-cart-small" data-producto-id="${productoId}">+</button>
            `;
            const btnAdd = actionsBasic.querySelector('.btn-add-cart-small');
            if (btnAdd) {
                btnAdd.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await addToCartAdmin(productoId, 1);
                });
            }
        }
    }
}

// Configurar event listeners del admin
let adminEventListenersSetup = false;

function setupAdminEventListeners() {
    // Evitar agregar listeners múltiples veces
    if (adminEventListenersSetup) {
        return;
    }
    adminEventListenersSetup = true;

    // Toggle sidebar admin
    const toggleSidebarBtn = document.getElementById('btn-toggle-sidebar');
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('admin-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
            }
        });
    }

    // Admin sidebar navigation
    document.querySelectorAll('.admin-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // No hacer nada si es el botón de cerrar sesión
            if (e.currentTarget.id === 'btn-logout-admin') {
                return;
            }
            
            const viewName = e.currentTarget.dataset.view;
            if (viewName) {
                showAdminView(viewName);
                
                // Actualizar estado activo
                document.querySelectorAll('.admin-nav-item').forEach(btn => {
                    if (btn.id !== 'btn-logout-admin') {
                        btn.classList.remove('active');
                    }
                });
                e.currentTarget.classList.add('active');
            }
        });
    });

    // Botón de cerrar sesión en admin
    document.getElementById('btn-logout-admin')?.addEventListener('click', async () => {
        await db.clearSesion();
        currentUser = null;
        currentUserType = null;
        currentObra = null;
        currentTienda = null;
        carritoAdmin = [];
        
        // Redirigir al login
        window.location.href = '../index.html';
    });

    // Tabs de usuarios
    document.querySelectorAll('#view-admin-usuarios .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            switchTabUsuarios(tab);
        });
    });

    // Tabs de Pedidos Especiales
    document.querySelectorAll('#view-admin-pedidos-especiales .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            switchTabPedidosEspeciales(tab);
        });
    });

    // Botón de volver a obras en cerrados
    document.getElementById('cerrados-volver-obras')?.addEventListener('click', () => {
        loadCerradosEspeciales();
    });

    // Botón de cargar más pedidos en cerrados
    document.getElementById('cerrados-cargar-mas-btn')?.addEventListener('click', () => {
        cargarMasPedidosCerrados();
    });

    // Botón de volver a obras en histórico
    document.getElementById('historico-volver-obras')?.addEventListener('click', () => {
        loadHistoricoAdmin();
    });

    // Botón de cargar más pedidos en histórico
    document.getElementById('historico-cargar-mas-btn')?.addEventListener('click', () => {
        cargarMasPedidosHistoricos();
    });

    // Botón de volver a tiendas en cuentas
    document.getElementById('cuentas-volver-tiendas')?.addEventListener('click', () => {
        loadCuentasAdmin();
    });

    // Botón de cargar más pedidos en cuentas
    document.getElementById('cuentas-cargar-mas-btn')?.addEventListener('click', () => {
        cargarMasPedidosCuenta();
    });

    // Botones de nuevo pedido especial en admin
    document.getElementById('btn-nuevo-pedido-especial-admin')?.addEventListener('click', () => {
        openModalPedidoEspecialAdmin();
    });
    document.getElementById('btn-nuevo-pedido-especial-admin-pedidos')?.addEventListener('click', () => {
        openModalPedidoEspecialAdmin();
    });

    // Búsqueda en admin
    document.getElementById('btn-search-admin')?.addEventListener('click', () => {
        const searchContainer = document.getElementById('search-container-admin');
        if (searchContainer) {
            searchContainer.style.display = searchContainer.style.display === 'none' ? 'flex' : 'none';
            if (searchContainer.style.display === 'flex') {
                document.getElementById('search-input-admin')?.focus();
            }
        }
    });

    document.getElementById('btn-close-search-admin')?.addEventListener('click', () => {
        const searchContainer = document.getElementById('search-container-admin');
        if (searchContainer) {
            searchContainer.style.display = 'none';
        }
        const searchInput = document.getElementById('search-input-admin');
        if (searchInput) {
            searchInput.value = '';
        }
        searchResultsAdmin = [];
        loadTiendasAdminView();
    });

    document.getElementById('search-input-admin')?.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length > 2) {
            await performSearchAdmin(query);
        } else if (query.length === 0) {
            searchResultsAdmin = [];
            loadTiendasAdminView();
        }
    });

    // Botón de nueva tienda
    document.getElementById('btn-nueva-tienda')?.addEventListener('click', () => {
        openModalTienda();
    });

    // Botón de nuevo usuario
    document.getElementById('btn-nuevo-usuario')?.addEventListener('click', () => {
        openModalUsuario();
    });

    // Botón de nueva obra
    document.getElementById('btn-nueva-obra')?.addEventListener('click', () => {
        openModalObra();
    });

    // Botones de guardar
    document.getElementById('btn-guardar-tienda')?.addEventListener('click', () => {
        guardarTienda();
    });

    document.getElementById('btn-guardar-usuario')?.addEventListener('click', () => {
        guardarUsuario();
    });

    document.getElementById('btn-guardar-obra')?.addEventListener('click', () => {
        guardarObra();
    });

    // Botones de cancelar
    document.getElementById('btn-cancelar-tienda')?.addEventListener('click', () => {
        closeAllModals();
    });

    document.getElementById('btn-cancelar-usuario')?.addEventListener('click', () => {
        closeAllModals();
    });

    document.getElementById('btn-cancelar-obra')?.addEventListener('click', () => {
        closeAllModals();
    });

    document.getElementById('btn-cancelar-subir-articulos')?.addEventListener('click', () => {
        closeAllModals();
    });

    // Dropzone para subir archivo de artículos
    const dropzoneArticulos = document.getElementById('modal-subir-articulos-dropzone');
    const fileInputArticulos = document.getElementById('modal-subir-articulos-file');
    const previewArticulos = document.getElementById('modal-subir-articulos-preview');
    const nombreArchivoArticulos = document.getElementById('modal-subir-articulos-nombre');
    const btnRemoveArticulos = document.getElementById('btn-remove-articulos-file');
    const btnSubirArticulos = document.getElementById('btn-subir-articulos');

    if (dropzoneArticulos && fileInputArticulos) {
        dropzoneArticulos.addEventListener('click', () => {
            fileInputArticulos.click();
        });

        dropzoneArticulos.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzoneArticulos.style.borderColor = 'var(--primary-color)';
            dropzoneArticulos.style.backgroundColor = 'var(--card-bg)';
        });

        dropzoneArticulos.addEventListener('dragleave', () => {
            dropzoneArticulos.style.borderColor = 'var(--border-color)';
            dropzoneArticulos.style.backgroundColor = 'transparent';
        });

        dropzoneArticulos.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzoneArticulos.style.borderColor = 'var(--border-color)';
            dropzoneArticulos.style.backgroundColor = 'transparent';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelectArticulos(files[0]);
            }
        });

        fileInputArticulos.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelectArticulos(e.target.files[0]);
            }
        });

        btnRemoveArticulos?.addEventListener('click', () => {
            archivoArticulos = null;
            fileInputArticulos.value = '';
            previewArticulos.style.display = 'none';
            btnSubirArticulos.disabled = true;
        });

        btnSubirArticulos?.addEventListener('click', async () => {
            if (archivoArticulos && tiendaIdSubirArticulos) {
                await procesarYSubirArticulos(archivoArticulos, tiendaIdSubirArticulos);
            }
        });
    }

    // Listeners para modal de usuario
    const modalTipoUsuario = document.getElementById('modal-usuario-tipo');
    if (modalTipoUsuario) {
        modalTipoUsuario.addEventListener('change', async () => {
            const tipo = modalTipoUsuario.value;
            if (tipo === 'Tienda') {
                document.getElementById('modal-usuario-tienda-group').style.display = 'block';
                document.getElementById('modal-usuario-obras-group').style.display = 'none';
                // Cargar tiendas disponibles (no enlazadas)
                await cargarTiendasDisponibles();
            } else if (tipo === 'Técnico' || tipo === 'Encargado') {
                document.getElementById('modal-usuario-tienda-group').style.display = 'none';
                document.getElementById('modal-usuario-obras-group').style.display = 'block';
                // Cargar obras disponibles
                await cargarObrasDisponibles();
            } else {
                document.getElementById('modal-usuario-tienda-group').style.display = 'none';
                document.getElementById('modal-usuario-obras-group').style.display = 'none';
            }
        });
    }

    // Listener para agregar obra al usuario
    const btnAgregarObraUsuario = document.getElementById('btn-agregar-obra-usuario');
    if (btnAgregarObraUsuario) {
        btnAgregarObraUsuario.addEventListener('click', agregarObraAUsuario);
    }

    // Listeners para modal de tienda (checkboxes y radios)
    const sinWeb = document.getElementById('modal-tienda-sin-web');
    if (sinWeb) {
        sinWeb.addEventListener('change', updateTiendaModalVisibility);
    }

    const noCuenta = document.getElementById('modal-tienda-no-cuenta');
    const sinLimite = document.getElementById('modal-tienda-sin-limite');
    const conLimite = document.getElementById('modal-tienda-tiene-cuenta');
    
    if (noCuenta) noCuenta.addEventListener('change', updateTiendaModalVisibility);
    if (sinLimite) sinLimite.addEventListener('change', updateTiendaModalVisibility);
    if (conLimite) conLimite.addEventListener('change', updateTiendaModalVisibility);

    // Setup dropzone de logo de tienda
    const logoDropzone = document.getElementById('modal-tienda-logo-dropzone');
    const logoFileInput = document.getElementById('modal-tienda-logo-file');
    const logoPreview = document.getElementById('modal-tienda-logo-preview');
    const logoPreviewImg = document.getElementById('modal-tienda-logo-preview-img');
    
    if (logoDropzone && logoFileInput) {
        logoDropzone.addEventListener('click', () => logoFileInput.click());
        
        logoDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            logoDropzone.classList.add('dragover');
        });
        
        logoDropzone.addEventListener('dragleave', () => {
            logoDropzone.classList.remove('dragover');
        });
        
        logoDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            logoDropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                handleImageFile(files[0], logoPreview, logoPreviewImg);
            }
        });
        
        logoFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0], logoPreview, logoPreviewImg);
            }
        });
    }

    function handleImageFile(file, preview, previewImg) {
        if (!file.type.startsWith('image/')) {
            showAlert('Por favor, selecciona un archivo de imagen', 'Error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    // Cerrar modales al hacer clic en overlay o botón de cerrar
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', closeAllModals);
    });

    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Botón de carrito en admin
    document.getElementById('cart-button-admin')?.addEventListener('click', () => {
        showCarritoAdmin();
    });

    // Botón para añadir artículo en pedido especial
    document.getElementById('btn-add-articulo-especial')?.addEventListener('click', () => {
        openModalAddArticuloEspecial();
    });

    // Botón de cancelar pedido especial
    document.getElementById('btn-cancelar-pedido-especial')?.addEventListener('click', () => {
        closeModalPedidoEspecial();
    });

    // Botón de guardar pedido especial
    document.getElementById('btn-guardar-pedido-especial')?.addEventListener('click', () => {
        guardarPedidoEspecial();
    });

    // Botones del modal de añadir artículo
    document.getElementById('btn-cancelar-articulo-especial')?.addEventListener('click', () => {
        closeModalAddArticuloEspecial();
    });

    document.getElementById('btn-guardar-articulo-especial')?.addEventListener('click', () => {
        guardarArticuloEspecial();
    });

    // Cerrar modal de artículo con botón X
    document.querySelectorAll('.btn-close-modal-articulo').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModalAddArticuloEspecial();
        });
    });

    // Configurar dropzone de foto en modal de artículo
    const fotoDropzone = document.getElementById('articulo-especial-foto-dropzone');
    const fotoFileInput = document.getElementById('articulo-especial-foto-file');
    const fotoPlaceholder = document.getElementById('articulo-especial-foto-placeholder');
    const fotoPreview = document.getElementById('articulo-especial-foto-preview');
    const fotoRemoveBtn = document.getElementById('articulo-especial-foto-remove');

    if (fotoDropzone && fotoFileInput) {
        fotoDropzone.addEventListener('click', (e) => {
            if (e.target !== fotoRemoveBtn) {
                fotoFileInput.click();
            }
        });

        fotoFileInput.addEventListener('change', (e) => {
            handleArticuloFotoChangeModal(e);
        });

        // Drag and drop
        fotoDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fotoDropzone.classList.add('dragover');
        });

        fotoDropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fotoDropzone.classList.remove('dragover');
        });

        fotoDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fotoDropzone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    fotoFileInput.files = files;
                    handleArticuloFotoChangeModal({ target: fotoFileInput });
                } else {
                    showAlert('Por favor, selecciona solo archivos de imagen');
                }
            }
        });

        fotoRemoveBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            removeArticuloFotoModal();
        });
    }
}

function switchTabUsuarios(tab) {
    document.querySelectorAll('#view-admin-usuarios .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });

    const tipoMap = {
        'tecnicos': 'Técnico',
        'encargados': 'Encargado',
        'tiendas': 'Tienda',
        'contabilidad': 'Contabilidad'
    };
    loadUsuarios(tipoMap[tab] || 'Técnico');
}

// Función para cambiar entre tabs de Pedidos Especiales
function switchTabPedidosEspeciales(tab) {
    document.querySelectorAll('#view-admin-pedidos-especiales .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });

    // Ocultar todos los contenidos de tabs
    document.querySelectorAll('#view-admin-pedidos-especiales .tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    // Mostrar el contenido del tab seleccionado
    const targetContent = document.getElementById(tab);
    if (targetContent) {
        targetContent.classList.add('active');
        targetContent.style.display = 'block';
    }

    // Cargar datos según el tab
    if (tab === 'nuevo-especiales') {
        loadNuevoEspeciales();
    } else if (tab === 'gestionando-especiales') {
        loadGestionandoEspeciales();
    } else if (tab === 'sin-transporte-especiales') {
        loadSinTransporteEspeciales();
    } else if (tab === 'con-transporte-especiales') {
        loadConTransporteEspeciales();
    } else if (tab === 'online-especiales') {
        loadOnlineEspeciales();
    } else if (tab === 'cerrados-especiales') {
        loadCerradosEspeciales();
    }
}

// Abrir modal de pedido especial en admin (modo crear o editar)
async function openModalPedidoEspecialAdmin(pedidoId = null) {
    if (!currentUser || currentUserType !== 'Administrador') {
        showAlert('Solo los administradores pueden crear/editar pedidos especiales');
        return;
    }
    
    const modal = document.getElementById('modal-pedido-especial');
    if (!modal) {
        showAlert('Modal de pedido especial no encontrado');
        return;
    }
    
    // Establecer modo edición o creación
    modal.dataset.pedidoId = pedidoId || '';
    const modalTitle = modal.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.textContent = pedidoId ? 'Editar Pedido Especial' : 'Crear Pedido Especial';
    }
    
    const proveedorNombre = document.getElementById('pedido-especial-proveedor-nombre');
    const tituloCount = document.getElementById('pedido-especial-titulo-count');
    const obraSelect = document.getElementById('pedido-especial-obra');
    
    // Agregar contador de caracteres al título
    if (proveedorNombre && tituloCount) {
        const updateCount = () => {
            const length = proveedorNombre.value.length;
            tituloCount.textContent = `(${length}/60)`;
            if (length > 60) {
                tituloCount.style.color = 'red';
            } else {
                tituloCount.style.color = 'var(--text-secondary)';
            }
        };
        proveedorNombre.addEventListener('input', updateCount);
        updateCount();
    }
    const articulos = document.getElementById('pedido-especial-articulos');
    const notas = document.getElementById('pedido-especial-notas');
    const documentoPreview = document.getElementById('pedido-especial-documento-preview');
    const documentoFile = document.getElementById('pedido-especial-documento-file');
    
    // Cargar obras en el desplegable
    if (obraSelect) {
        const obras = await db.getAllObras();
        obraSelect.innerHTML = '<option value="">-- Selecciona una obra --</option>';
        obras.forEach(obra => {
            const option = document.createElement('option');
            option.value = obra.id;
            option.textContent = obra.nombreComercial || obra.nombre || 'Obra sin nombre';
            obraSelect.appendChild(option);
        });
    }
    
    // Si es modo edición, cargar datos del pedido
    if (pedidoId) {
        try {
            const pedido = await db.get('pedidosEspeciales', pedidoId);
            if (pedido) {
                if (proveedorNombre) proveedorNombre.value = pedido.proveedorNombre || '';
                if (obraSelect) obraSelect.value = pedido.obraId || '';
                if (notas) notas.value = '';
                
                // Cargar artículos
                articulosEspeciales = Array.isArray(pedido.articulos) ? pedido.articulos.map(a => ({
                    id: a.id || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    nombre: a.nombre || '',
                    cantidad: a.cantidad || 1,
                    precio: a.precio || 0,
                    foto: a.foto || null,
                    descripcion: a.descripcion || null
                })) : [];
                renderArticulosEspeciales();
                
                // Cargar documento si existe
                if (pedido.documento) {
                    if (documentoPreview) {
                        documentoPreview.style.display = 'block';
                        const previewImg = documentoPreview.querySelector('img');
                        if (previewImg) previewImg.src = pedido.documento;
                    }
                    modal.dataset.documentoBase64 = pedido.documento;
                } else {
                    if (documentoPreview) documentoPreview.style.display = 'none';
                    modal.dataset.documentoBase64 = '';
                }
            }
        } catch (error) {
            console.error('Error al cargar pedido para edición:', error);
            showAlert('Error al cargar los datos del pedido');
        }
    } else {
        // Modo creación - limpiar formulario
        if (proveedorNombre) proveedorNombre.value = '';
        if (obraSelect) obraSelect.value = '';
        if (articulos) articulos.innerHTML = '';
        if (notas) notas.value = '';
        if (documentoPreview) documentoPreview.style.display = 'none';
        if (documentoFile) documentoFile.value = '';
        modal.dataset.documentoBase64 = '';
        
        // Limpiar artículos
        articulosEspeciales = [];
        renderArticulosEspeciales();
    }
    
    // Configurar dropzone de documento de pago
    const documentoDropzone = document.getElementById('pedido-especial-documento-dropzone');
    const documentoFileInput = document.getElementById('pedido-especial-documento-file');
    if (documentoDropzone && documentoFileInput) {
        documentoDropzone.addEventListener('click', () => documentoFileInput.click());
        documentoFileInput.addEventListener('change', handleDocumentoEspecialChange);
    }
    document.getElementById('btn-remove-documento-especial')?.addEventListener('click', removeDocumentoEspecial);
    
    modal.classList.add('active');
}

// Función para editar pedido especial
window.editarPedidoEspecial = async function(pedidoId) {
    await openModalPedidoEspecialAdmin(pedidoId);
};

async function guardarPedidoEspecial() {
    const proveedorNombre = document.getElementById('pedido-especial-proveedor-nombre').value.trim();
    const obraId = document.getElementById('pedido-especial-obra').value;
    const notas = document.getElementById('pedido-especial-notas').value.trim();
    const documentoFile = document.getElementById('pedido-especial-documento-file').files[0];
    
    if (!proveedorNombre) {
        await showAlert('El título del pedido es obligatorio', 'Error');
        return;
    }
    
    if (!obraId) {
        await showAlert('Debes seleccionar una obra', 'Error');
        return;
    }
    
    if (articulosEspeciales.length === 0) {
        await showAlert('Debes añadir al menos un artículo', 'Error');
        return;
    }
    
    // Obtener información de la obra
    const obra = await db.get('obras', obraId);
    if (!obra) {
        await showAlert('Obra no encontrada', 'Error');
        return;
    }
    
    // Convertir documento a base64 si existe
    let documentoBase64 = null;
    if (documentoFile) {
        documentoBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(documentoFile);
        });
    }
    
    // Crear pedido especial
    const pedidoEspecial = {
        proveedorNombre: proveedorNombre, // Mantenemos el nombre del campo por compatibilidad, pero ahora es el título
        articulos: articulosEspeciales.map(a => ({
            nombre: a.nombre,
            cantidad: a.cantidad,
            precio: a.precio,
            foto: a.foto,
            descripcion: a.descripcion || null
        })),
        obraId: obraId,
        obraNombre: obra.nombreComercial || obra.nombre,
        notas: [], // Inicializar como array vacío, las notas se agregarán mediante comentarios
        documento: documentoBase64,
        documentoNombre: documentoFile ? documentoFile.name : null,
        userId: currentUser.id,
        persona: currentUser.username,
        fechaCreacion: new Date().toISOString(),
        estado: 'Nuevo' // Estado inicial para que aparezca en la subpestaña "Nuevo"
    };
    
    // Si hay notas iniciales del formulario, convertirlas a formato de comentario
    if (notas && notas.trim()) {
        pedidoEspecial.notas.push({
            id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            usuarioId: currentUser.id || null,
            usuarioNombre: currentUser.username || currentUser.nombre || 'Usuario',
            usuarioTipo: currentUserType || currentUser?.tipo || 'Administrador',
            mensaje: notas,
            timestamp: new Date().toISOString()
        });
    }
    
    try {
        const modal = document.getElementById('modal-pedido-especial');
        const pedidoId = modal?.dataset.pedidoId || null;
        const esEdicion = !!pedidoId;
        
        if (esEdicion) {
            // Modo edición - actualizar pedido existente
            const pedidoExistente = await db.get('pedidosEspeciales', pedidoId);
            if (!pedidoExistente) {
                await showAlert('Pedido no encontrado', 'Error');
                return;
            }
            
            // Obtener documento (nuevo o existente)
            let documentoBase64 = modal?.dataset.documentoBase64 || null;
            if (documentoFile) {
                documentoBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(documentoFile);
                });
            }
            
            // Actualizar pedido manteniendo datos que no se editan
            const pedidoActualizado = {
                ...pedidoExistente,
                proveedorNombre: proveedorNombre,
                articulos: articulosEspeciales.map(a => ({
                    id: a.id || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    nombre: a.nombre,
                    cantidad: a.cantidad,
                    precio: a.precio,
                    foto: a.foto,
                    descripcion: a.descripcion || null
                })),
                obraId: obraId,
                obraNombre: obra.nombreComercial || obra.nombre,
                documento: documentoBase64 || pedidoExistente.documento,
                documentoNombre: documentoFile ? documentoFile.name : pedidoExistente.documentoNombre
            };
            
            // Si hay notas nuevas del formulario, agregarlas a las existentes
            if (notas && notas.trim()) {
                const notasArray = Array.isArray(pedidoExistente.notas) ? [...pedidoExistente.notas] : [];
                notasArray.push({
                    id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    usuarioId: currentUser.id || null,
                    usuarioNombre: currentUser.username || currentUser.nombre || 'Usuario',
                    usuarioTipo: currentUserType || currentUser?.tipo || 'Administrador',
                    mensaje: notas,
                    timestamp: new Date().toISOString()
                });
                pedidoActualizado.notas = notasArray;
            }
            
            await db.update('pedidosEspeciales', { id: pedidoId, ...pedidoActualizado });
            await showAlert('Pedido especial actualizado correctamente', 'Éxito');
        } else {
            await db.add('pedidosEspeciales', pedidoEspecial);
            await showAlert('Pedido especial creado exitosamente', 'Éxito');
        }
        
        closeModalPedidoEspecial();
        
        // Recargar la vista de pedidos especiales
        const activeTab = document.querySelector('#view-admin-pedidos-especiales .tab-btn.active');
        if (activeTab) {
            switchTabPedidosEspeciales(activeTab.dataset.tab);
        } else if (previousAdminSubView === 'admin-pedidos-especiales') {
            loadPedidosEspecialesAdmin();
        }
    } catch (error) {
        const modal = document.getElementById('modal-pedido-especial');
        const esEdicion = !!modal?.dataset.pedidoId;
        console.error(`Error al ${esEdicion ? 'actualizar' : 'crear'} pedido especial:`, error);
        await showAlert(`No se pudo ${esEdicion ? 'actualizar' : 'crear'} el pedido especial: ` + error.message, 'Error');
    }
}

function handleDocumentoEspecialChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validar tipo de archivo
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        showAlert('Tipo de archivo no permitido. Solo se permiten PDF, PNG, JPG');
        event.target.value = '';
        return;
    }
    
    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showAlert('El archivo es demasiado grande. Máximo 10MB');
        event.target.value = '';
        return;
    }
    
    const preview = document.getElementById('pedido-especial-documento-preview');
    const nombre = document.getElementById('pedido-especial-documento-nombre');
    
    if (preview && nombre) {
        nombre.textContent = file.name;
        preview.style.display = 'block';
    }
}

function removeDocumentoEspecial() {
    const preview = document.getElementById('pedido-especial-documento-preview');
    const fileInput = document.getElementById('pedido-especial-documento-file');
    
    if (fileInput) fileInput.value = '';
    if (preview) preview.style.display = 'none';
}

let articulosEspeciales = [];

function openModalAddArticuloEspecial() {
    const modal = document.getElementById('modal-add-articulo-especial');
    if (!modal) return;
    
    // Limpiar formulario
    document.getElementById('articulo-especial-nombre').value = '';
    document.getElementById('articulo-especial-cantidad').value = '1';
    document.getElementById('articulo-especial-precio').value = '';
    document.getElementById('articulo-especial-descripcion').value = '';
    removeArticuloFotoModal();
    
    modal.classList.add('active');
}

function closeModalAddArticuloEspecial() {
    const modal = document.getElementById('modal-add-articulo-especial');
    if (modal) {
        modal.classList.remove('active');
    }
}

function handleArticuloFotoChangeModal(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
        showAlert('Por favor, selecciona solo archivos de imagen');
        return;
    }
    
    // Validar tamaño (máx. 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showAlert('La imagen es demasiado grande. Máximo 5MB');
        return;
    }
    
    const placeholder = document.getElementById('articulo-especial-foto-placeholder');
    const preview = document.getElementById('articulo-especial-foto-preview');
    const removeBtn = document.getElementById('articulo-especial-foto-remove');
    
    if (!placeholder || !preview || !removeBtn) return;
    
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        placeholder.style.display = 'none';
        preview.style.display = 'block';
        removeBtn.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeArticuloFotoModal() {
    const fileInput = document.getElementById('articulo-especial-foto-file');
    const placeholder = document.getElementById('articulo-especial-foto-placeholder');
    const preview = document.getElementById('articulo-especial-foto-preview');
    const removeBtn = document.getElementById('articulo-especial-foto-remove');
    
    if (fileInput) fileInput.value = '';
    if (placeholder) placeholder.style.display = 'block';
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    if (removeBtn) removeBtn.style.display = 'none';
}

function guardarArticuloEspecial() {
    const nombre = document.getElementById('articulo-especial-nombre').value.trim();
    const cantidad = parseInt(document.getElementById('articulo-especial-cantidad').value) || 1;
    const precio = parseFloat(document.getElementById('articulo-especial-precio').value) || 0;
    const descripcion = document.getElementById('articulo-especial-descripcion').value.trim();
    const fotoPreview = document.getElementById('articulo-especial-foto-preview');
    const fotoFile = document.getElementById('articulo-especial-foto-file').files[0];
    
    if (!nombre) {
        showAlert('El nombre del artículo es obligatorio', 'Error');
        return;
    }
    
    // Obtener foto como base64 si existe
    let fotoBase64 = null;
    if (fotoPreview && fotoPreview.style.display !== 'none' && fotoPreview.src) {
        fotoBase64 = fotoPreview.src;
    } else if (fotoFile) {
        // Si hay archivo pero no se ha mostrado el preview, leerlo
        const reader = new FileReader();
        reader.onload = (e) => {
            fotoBase64 = e.target.result;
            agregarArticuloALista(nombre, cantidad, precio, fotoBase64, descripcion);
        };
        reader.readAsDataURL(fotoFile);
        return;
    }
    
    agregarArticuloALista(nombre, cantidad, precio, fotoBase64, descripcion);
}

function agregarArticuloALista(nombre, cantidad, precio, foto, descripcion = null) {
    const itemId = Date.now() + Math.random();
    const articulo = {
        id: itemId,
        nombre: nombre,
        cantidad: cantidad,
        precio: precio,
        foto: foto,
        descripcion: descripcion || null
    };
    
    articulosEspeciales.push(articulo);
    renderArticulosEspeciales();
    closeModalAddArticuloEspecial();
}

function renderArticulosEspeciales() {
    const container = document.getElementById('pedido-especial-articulos');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (articulosEspeciales.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No hay artículos añadidos</p>';
        return;
    }
    
    articulosEspeciales.forEach(articulo => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'pedido-especial-item';
        itemDiv.dataset.articuloId = articulo.id;
        
        const fotoHtml = articulo.foto 
            ? `<img src="${articulo.foto}" alt="${escapeHtml(articulo.nombre)}" class="pedido-especial-item-foto" onerror="this.style.display='none'">`
            : '<div class="pedido-especial-item-foto-placeholder">📦</div>';
        
        itemDiv.innerHTML = `
            ${fotoHtml}
            <div class="pedido-especial-item-info">
                <h4>${escapeHtml(articulo.nombre)}</h4>
                <div class="pedido-especial-item-details">
                    <span>Cantidad: <strong>${articulo.cantidad}</strong></span>
                    ${articulo.precio > 0 ? `<span>Precio: <strong>${articulo.precio.toFixed(2)} €</strong></span>` : ''}
                </div>
                ${articulo.descripcion ? `<p style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">${escapeHtml(articulo.descripcion)}</p>` : ''}
            </div>
            <div class="pedido-especial-item-actions">
                <button type="button" class="btn-remove-articulo" onclick="removeArticuloEspecial('${articulo.id}')" aria-label="Eliminar artículo" title="Eliminar">
                    🗑️
                </button>
            </div>
        `;
        
        container.appendChild(itemDiv);
    });
}

window.removeArticuloEspecial = function(articuloId) {
    articulosEspeciales = articulosEspeciales.filter(a => a.id.toString() !== articuloId.toString());
    renderArticulosEspeciales();
};

function closeModalPedidoEspecial() {
    const modal = document.getElementById('modal-pedido-especial');
    if (modal) {
        modal.classList.remove('active');
        // Limpiar formulario
        document.getElementById('pedido-especial-proveedor-nombre').value = '';
        document.getElementById('pedido-especial-obra').value = '';
        document.getElementById('pedido-especial-notas').value = '';
        articulosEspeciales = [];
        renderArticulosEspeciales();
        removeDocumentoEspecial();
    }
}


// Funciones de carga de datos para las diferentes vistas
async function loadPedidosEspecialesAdmin() {
    // Cargar todas las tabs para actualizar badges (excepto 'nuevo' que se carga al activar la tab)
    loadGestionandoEspeciales();
    loadSinTransporteEspeciales();
    loadConTransporteEspeciales();
    loadOnlineEspeciales();
    loadCerradosEspeciales();
    
    // Cargar la primera tab por defecto (esto también carga loadNuevoEspeciales())
    switchTabPedidosEspeciales('nuevo-especiales');
}

// Variable global para almacenar el estado de paginación de cuentas
let cuentasPaginationState = {
    tiendaId: null,
    pedidos: [],
    currentIndex: 0,
    itemsPerPage: 5
};

async function loadCuentasAdmin() {
    const tiendasView = document.getElementById('cuentas-tiendas-view');
    const pedidosView = document.getElementById('cuentas-pedidos-view');
    const tiendasList = document.getElementById('cuentas-tiendas-list');
    const tiendasEmpty = document.getElementById('cuentas-tiendas-empty');
    
    if (!tiendasView || !pedidosView || !tiendasList) return;
    
    // Mostrar vista de tiendas, ocultar vista de pedidos
    tiendasView.style.display = 'block';
    pedidosView.style.display = 'none';
    
    // Resetear estado de paginación
    cuentasPaginationState = {
        tiendaId: null,
        pedidos: [],
        currentIndex: 0,
        itemsPerPage: 5
    };
    
    try {
        const tiendas = await db.getAll('tiendas');
        // Filtrar tiendas con cuenta (igual que contabilidad)
        const tiendasConCuenta = tiendas.filter(t => t.tieneCuenta);
        
        if (tiendasConCuenta.length === 0) {
            tiendasList.innerHTML = '';
            if (tiendasEmpty) tiendasEmpty.style.display = 'block';
            return;
        }
        
        if (tiendasEmpty) tiendasEmpty.style.display = 'none';
        tiendasList.innerHTML = '';
        tiendasList.className = 'tiendas-grid';
        
        // Obtener todos los pedidos para contar pendientes (igual que contabilidad)
        const todosPedidos = await db.getAll('pedidos');
        const pedidosCuentaGlobal = todosPedidos.filter(p => 
            p.estadoPago === 'Pago A cuenta' &&
            p.estado !== 'Completado' &&
            p.pedidoSistemaPDF &&
            !p.transferenciaPDF
        );
        
        // Crear cards para cada tienda con conteo de pedidos pendientes
        for (const tienda of tiendasConCuenta) {
            const pedidosTienda = pedidosCuentaGlobal.filter(p => p.tiendaId === tienda.id);
            const card = await createTiendaCardCuentas(tienda, pedidosTienda.length);
            tiendasList.appendChild(card);
        }
    } catch (error) {
        console.error('Error al cargar tiendas con cuenta:', error);
        tiendasList.innerHTML = '<p>Error al cargar tiendas</p>';
    }
}

// Función para crear card de tienda en vista de cuentas (igual que contabilidad)
async function createTiendaCardCuentas(tienda, pedidosCount) {
    const card = document.createElement('div');
    card.className = 'tienda-card';
    
    // Logo (arriba)
    let imagenHtml = '';
    const tieneLogo = tienda.logo && 
                      typeof tienda.logo === 'string' && 
                      tienda.logo.trim() !== '' && 
                      tienda.logo !== 'null' && 
                      tienda.logo !== 'undefined' && 
                      (tienda.logo.startsWith('data:image/') || tienda.logo.startsWith('http'));
    
    if (tieneLogo) {
        imagenHtml = `
            <img src="${tienda.logo}" alt="${escapeHtml(tienda.nombre)}" class="tienda-card-logo" onerror="this.style.display='none'; const icon = this.parentElement.querySelector('.tienda-card-icon'); if(icon) icon.style.display='flex';">
            <div class="tienda-card-icon" style="display: none;">${tienda.icono || '🏪'}</div>
        `;
    } else {
        imagenHtml = `<div class="tienda-card-icon">${tienda.icono || '🏪'}</div>`;
    }
    
    // Calcular gastado de cuenta (igual que contabilidad)
    const gastado = await calcularGastadoCuenta(tienda.id);
    let cuentaInfoHtml = '';
        
        if (tienda.limiteCuenta) {
            // Tiene cuenta con límite
            const limite = Number(tienda.limiteCuenta) || 0;
            const porcentaje = limite > 0 ? (gastado / limite) * 100 : 0;
            const disponible = Math.max(0, limite - gastado);
            const colorBarra = porcentaje >= 100 ? '#ef4444' : porcentaje >= 80 ? '#f59e0b' : '#10b981';
            
            cuentaInfoHtml = `
                <div class="tienda-cuenta-info" style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-color); border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">Estado de Cuenta</div>
                    <div style="font-size: 0.875rem; margin-bottom: 0.25rem;">
                        <strong>${gastado.toFixed(2)}€</strong> gastado / <strong>${limite.toFixed(2)}€</strong> límite
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        Disponible: ${disponible.toFixed(2)}€
                    </div>
                    <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden; margin-bottom: 0.25rem;">
                        <div style="height: 100%; width: ${Math.min(100, porcentaje)}%; background: ${colorBarra}; transition: width 0.3s;"></div>
                    </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-align: center;">
                        ${porcentaje.toFixed(1)}% utilizado
                    </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; text-align: center;">
                    <strong>${pedidosCount}</strong> pedido${pedidosCount !== 1 ? 's' : ''} pendiente${pedidosCount !== 1 ? 's' : ''}
                    </div>
                </div>
            `;
        } else {
            // Cuenta sin límite
            cuentaInfoHtml = `
                <div class="tienda-cuenta-info" style="margin-top: 1rem; padding: 0.75rem; background: #d1fae5; border-radius: 8px; border: 1px solid #10b981;">
                    <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; color: #065f46;">Estado de Cuenta</div>
                <div style="font-size: 0.875rem; color: #065f46;">
                        <strong>${gastado.toFixed(2)}€</strong> gastado
                    </div>
                <div style="font-size: 0.75rem; color: #065f46; margin-top: 0.25rem; font-weight: 600;">
                        Cuenta sin límite
                    </div>
                <div style="font-size: 0.75rem; color: #065f46; margin-top: 0.5rem; text-align: center;">
                    <strong>${pedidosCount}</strong> pedido${pedidosCount !== 1 ? 's' : ''} pendiente${pedidosCount !== 1 ? 's' : ''}
                    </div>
                </div>
            `;
    }
    
    // Construir el HTML de la card
    card.innerHTML = `
        <div class="tienda-card-content">
            ${imagenHtml}
            <h3 class="tienda-card-nombre">${escapeHtml(tienda.nombre)}</h3>
            ${tienda.sector ? `<div class="tienda-card-sector">${escapeHtml(tienda.sector)}</div>` : ''}
            ${cuentaInfoHtml}
        </div>
    `;
    
    card.addEventListener('click', () => {
        loadPedidosCuentaPorTienda(tienda.id);
    });
    
    return card;
}

// Función para cargar pedidos pendientes de pago a cuenta de una tienda (igual que contabilidad)
async function loadPedidosCuentaPorTienda(tiendaId) {
    const tiendasView = document.getElementById('cuentas-tiendas-view');
    const pedidosView = document.getElementById('cuentas-pedidos-view');
    const pedidosList = document.getElementById('cuentas-pedidos-list');
    const pedidosEmpty = document.getElementById('cuentas-pedidos-empty');
    const tiendaNombreElement = document.getElementById('cuentas-tienda-nombre');
    const cargarMasWrapper = document.getElementById('cuentas-cargar-mas-wrapper');
    
    if (!tiendasView || !pedidosView || !pedidosList) return;
    
    // Obtener información de la tienda
    const tienda = await db.get('tiendas', tiendaId);
    const tiendaNombre = tienda?.nombre || 'Tienda desconocida';
    
    // Mostrar vista de pedidos, ocultar vista de tiendas
    tiendasView.style.display = 'none';
    pedidosView.style.display = 'block';
    
    if (tiendaNombreElement) {
        tiendaNombreElement.textContent = tiendaNombre;
    }
    
    // Limpiar lista de pedidos (el botón volver ya existe en el HTML)
    pedidosList.innerHTML = '';
    
    try {
        // Obtener pedidos de la tienda (igual que contabilidad)
        const todosPedidos = await db.getAll('pedidos');
        const pedidosTienda = todosPedidos.filter(p => 
            p.tiendaId === tiendaId &&
            p.estadoPago === 'Pago A cuenta' && 
            p.estado !== 'Completado' &&
            p.pedidoSistemaPDF &&
            !p.transferenciaPDF
        );
        
        pedidosTienda.sort((a, b) => {
            const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
            const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
            return fechaB - fechaA;
        });
        
        if (pedidosTienda.length === 0) {
            if (pedidosEmpty) pedidosEmpty.style.display = 'block';
            if (cargarMasWrapper) cargarMasWrapper.style.display = 'none';
            return;
        }
        
        if (pedidosEmpty) pedidosEmpty.style.display = 'none';
        
        // Mostrar pedidos directamente (sin paginación, igual que contabilidad)
        for (const pedido of pedidosTienda) {
            const card = await createPedidoCuentaCardAdmin(pedido);
            pedidosList.appendChild(card);
        }
        
        if (cargarMasWrapper) cargarMasWrapper.style.display = 'none';
    } catch (error) {
        console.error('Error al cargar pedidos pendientes de pago a cuenta:', error);
        pedidosList.innerHTML = '<p>Error al cargar pedidos</p>';
    }
}

// Función para crear card de pedido en vista de cuentas admin (sin botones de adjuntar/eliminar documento)
async function createPedidoCuentaCardAdmin(pedido) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card contab-pedido-card';
    
    // Verificar que no sea un pedido especial (no tienen tiendaId válido)
    if (isPedidoEspecial(pedido)) {
        // Si es pedido especial, usar la función para pedidos especiales
        return await createPedidoEspecialAdminCard(pedido);
    }
    
    // Validar que tiendaId sea válido antes de hacer la consulta
    const tiendaId = pedido?.tiendaId;
    if (!tiendaId || (typeof tiendaId !== 'string') || (typeof tiendaId === 'string' && tiendaId.trim() === '')) {
        // Si no tiene tiendaId válido, tratarlo como pedido especial
        return await createPedidoEspecialAdminCard(pedido);
    }
    
    const tienda = await db.get('tiendas', tiendaId);
    const obraInfo = pedido.obraId ? await db.get('obras', pedido.obraId) : null;
    
    let fechaObj;
    if (pedido.fecha && pedido.fecha.toDate) {
        fechaObj = pedido.fecha.toDate();
    } else if (pedido.fecha) {
        fechaObj = new Date(pedido.fecha);
    } else {
        fechaObj = new Date();
    }
    const fechaFormateada = formatDateTime(fechaObj);
    
    const estadoEnvio = pedido.estado || 'Sin estado';
    const estadoEnvioClass = estadoEnvio.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
    const estadoPago = pedido.estadoPago || 'Pendiente de pago';
    const estadoPagoClass = getEstadoPagoPillClass(estadoPago);
    
    const tiendaNombre = escapeHtml(tienda?.nombre || 'Desconocida');
    const persona = escapeHtml(pedido.persona || pedido.usuarioNombre || 'Sin especificar');
    const obraNombreTexto = obraInfo?.nombreComercial || pedido.obraNombreComercial || pedido.obra || 'Obra no especificada';
    const obraNombre = escapeHtml(obraNombreTexto);
    const obraLink = buildObraMapsLink(obraInfo, obraNombreTexto);
    const obraLinkHref = obraLink ? escapeHtml(obraLink) : null;
    const encargado = escapeHtml(obraInfo?.encargado || 'No asignado');
    const telefonoEncargado = escapeHtml(obraInfo?.telefonoEncargado || '');
    const encargadoInfo = telefonoEncargado ? `${encargado} | ${telefonoEncargado}` : encargado;
    
    const items = Array.isArray(pedido.items) ? pedido.items : [];
    const notas = Array.isArray(pedido.notas) ? pedido.notas : [];
    const totalPedido = items.reduce((total, item) => {
        const precioItem = Number(item.precio) || 0;
        const cantidadItem = Number(item.cantidad) || 0;
        return total + precioItem * cantidadItem;
    }, 0);
    
    const itemsHtml = items.length
        ? items.map((item, index) => {
            const nombre = escapeHtml(item.nombre || item.designacion || 'Artículo sin nombre');
            const referencia = escapeHtml(item.designacion || item.referencia || '');
            const ean = escapeHtml(item.ean || '');
            const cantidad = Number(item.cantidad) || 0;
            const precio = formatCurrency(item.precio || 0);
            const subtotal = formatCurrency((item.precio || 0) * cantidad);
            const fotoUrl = item.foto ? escapeHtml(item.foto) : null;
            const placeholderId = `foto-placeholder-admin-${pedido.id}-${index}`.replace(/[^a-zA-Z0-9-]/g, '-');
            const fotoHtml = fotoUrl
                ? `<img src="${fotoUrl}" alt="${nombre}" class="pedido-item-foto" onerror="this.style.display='none'; document.getElementById('${placeholderId}').style.display='flex';">`
                : '';
            const fotoPlaceholder = `<div id="${placeholderId}" class="pedido-item-foto-placeholder" style="${fotoUrl ? 'display: none;' : ''}">📦</div>`;
            const refEanParts = [];
            if (referencia) refEanParts.push(referencia);
            if (ean) refEanParts.push(ean);
            const refEanText = refEanParts.length > 0 ? refEanParts.join(' | ') : '';
            return `
                <div class="pedido-item">
                    ${fotoHtml}
                    ${fotoPlaceholder}
                    <div class="pedido-item-info">
                        <p class="pedido-item-name">${nombre}</p>
                        ${refEanText ? `<p class="pedido-item-ref-ean">${refEanText}</p>` : ''}
                        <div class="pedido-item-meta">
                            <span>Cantidad: ${cantidad}</span>
                            <span>Precio unitario: ${precio}</span>
                            <span>Total línea: ${subtotal}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('')
        : '<p class="cascade-empty">No hay artículos en este pedido</p>';
    
    const pedidoRealContent = pedido.pedidoSistemaPDF
        ? `<a href="#" onclick="descargarDocumento('${pedido.pedidoSistemaPDF.replace(/'/g, "\\'")}', 'pedido-real.pdf'); return false;" class="doc-link">📄 Ver documento</a>`
        : '<span class="doc-placeholder">Sin documento</span>';
    
    const facturaContent = pedido.albaran
        ? `<a href="#" onclick="descargarDocumento('${pedido.albaran.replace(/'/g, "\\'")}', 'factura.pdf'); return false;" class="doc-link">📄 Ver factura</a>`
        : '<span class="doc-placeholder">Sin factura</span>';
    
    // ADMIN: Solo visualización, sin botones de adjuntar/eliminar
    const tienePago = Boolean(pedido.transferenciaPDF);
    const documentoPagoContent = tienePago 
        ? `<a href="#" onclick="descargarDocumento('${pedido.transferenciaPDF.replace(/'/g, "\\'")}', 'documento-pago.pdf'); return false;" class="doc-link">📄 Ver pago</a>` 
        : '<span class="doc-placeholder">Sin documento</span>';
    
    const itemsSectionId = `pedido-items-admin-${pedido.id}`;
    const notasSectionId = `pedido-notas-admin-${pedido.id}`;
    const notasListId = `pedido-notas-list-admin-${pedido.id}`;
    const notasCountId = `pedido-notas-count-admin-${pedido.id}`;
    const notaInputId = `pedido-nota-input-admin-${pedido.id}`;
    
    card.innerHTML = `
        <!-- Header del pedido -->
        <div class="contab-pedido-header-compact">
            <p class="pedido-code">Pedido #${escapeHtml(pedido.id)}</p>
        </div>
        
        <!-- Cards compactas: Datos del pedido, Estado de pago, Artículos y Comentarios -->
        <div class="contab-info-grid-compact">
            <!-- Card: Datos del pedido -->
            <div class="contab-info-card-compact contab-card-datos">
                <div class="contab-card-title-compact">Datos del pedido</div>
                <div class="contab-info-row-compact"><span>Tienda</span><strong>${tiendaNombre}</strong></div>
                <div class="contab-info-row-compact"><span>Pedido por</span><strong>${persona}</strong></div>
                <div class="contab-info-row-compact">
                    <span>Obra</span>
                    <strong>${obraLinkHref ? `<a href="${obraLinkHref}" target="_blank" rel="noopener">${obraNombre}</a>` : obraNombre}</strong>
                </div>
                <div class="contab-info-row-compact"><span>Encargado</span><strong>${encargadoInfo}</strong></div>
                <div class="contab-info-row-compact"><span>Fecha</span><strong>${escapeHtml(fechaFormateada || '')}</strong></div>
            </div>
            
            <!-- Card: Estado de pago -->
            <div class="contab-info-card-compact contab-card-estado">
                <div class="contab-card-title-compact">Estado de pago</div>
                <div class="contab-info-row-compact">
                    <span>Estado</span>
                    <span class="estado-pago-pill-small ${estadoPagoClass}">${escapeHtml(estadoPago)}</span>
                </div>
                <div class="contab-info-row-compact">
                    <span>Pedido real</span>
                    <div class="doc-actions">${pedidoRealContent}</div>
                </div>
                <div class="contab-info-row-compact">
                    <span>Doc. pago</span>
                    <div class="doc-actions">${documentoPagoContent}</div>
                </div>
                <div class="contab-info-row-compact">
                    <span>Factura</span>
                    <div class="doc-actions">${facturaContent || '<span class="doc-placeholder">Sin factura</span>'}</div>
                </div>
            </div>
            
            <!-- Card: Artículos (siempre visible) -->
            <div class="contab-info-card-compact contab-card-articulos" id="articulos-card-admin-${pedido.id}">
                <div class="contab-card-title-compact">
                    <span>Artículos (${items.length})</span>
                    <span class="contab-total-compact" style="font-size: 0.7rem; color: var(--primary-color);">Total: ${formatCurrency(totalPedido)}</span>
                </div>
                <div class="pedido-items-list-compact">
                    ${itemsHtml}
                </div>
                ${items.length > 3 ? `
                    <button class="expand-arrow" type="button" onclick="toggleExpandArticulosAdmin('${pedido.id}')" title="Expandir para ver todos los artículos">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                ` : ''}
            </div>
            
            <!-- Card: Comentarios (siempre visible) -->
            <div class="contab-info-card-compact contab-card-comentarios">
                <div class="contab-card-title-compact">
                    <span>Comentarios <span class="comentarios-count">(${notas.length})</span></span>
                </div>
                <div class="comentarios-input-wrapper">
                    <textarea id="${notaInputId}" class="comentarios-input" placeholder="Escribe un comentario..."></textarea>
                    <div class="comentarios-buttons-row">
                        <button class="btn-ver-comentarios" type="button" onclick="togglePedidoSection('${notasSectionId}', this)" id="btn-ver-comentarios-admin-${pedido.id}" data-open-label="Ocultar Comentarios" data-close-label="Ver Comentarios">
                            Ver Comentarios
                        </button>
                        <button class="btn btn-primary btn-xs" type="button" onclick="guardarNotaPedidoAdmin('${pedido.id}', '${notaInputId}', '${notasListId}', '${notasCountId}')">Enviar</button>
                    </div>
                </div>
                <div id="${notasSectionId}" class="contab-collapse" style="display: none; margin-top: 0.5rem;">
                    <div id="${notasListId}" class="pedido-notas-list-compact-scroll"></div>
                </div>
            </div>
        </div>
    `;
    
    const notasListElement = card.querySelector(`#${notasListId}`);
    const notasCountElement = card.querySelector(`#${notasCountId}`);
    renderPedidoNotasUIAdmin(pedido.id, notas, notas, notasListElement, notasCountElement, false);
    
    return card;
}

// Función para expandir/colapsar artículos en admin
window.toggleExpandArticulosAdmin = function(pedidoId) {
    const articulosCard = document.getElementById(`articulos-card-admin-${pedidoId}`);
    if (articulosCard) {
        articulosCard.classList.toggle('expanded');
    }
};

// Función para guardar nota de pedido en admin
window.guardarNotaPedidoAdmin = async function(pedidoId, inputId, listId, countId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const mensaje = input.value.trim();
    if (!mensaje) {
        await showAlert('Por favor, escribe un comentario antes de guardar', 'Atención');
        return;
    }
    if (!currentUser) {
        await showAlert('Debes iniciar sesión para añadir comentarios', 'Error');
        return;
    }
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('No se pudo encontrar el pedido', 'Error');
            return;
        }
        const notas = Array.isArray(pedido.notas) ? [...pedido.notas] : [];
        notas.push({
            id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            usuarioId: currentUser.id || null,
            usuarioNombre: currentUser.username || currentUser.nombre || 'Usuario',
            usuarioTipo: currentUserType || currentUser?.tipo || 'Usuario',
            mensaje,
            timestamp: new Date().toISOString()
        });
        await db.update('pedidos', { id: pedidoId, notas });
        input.value = '';
        const listEl = document.getElementById(listId);
        const countEl = document.getElementById(countId);
        renderPedidoNotasUIAdmin(pedidoId, notas, notas, listEl, countEl, false);
    } catch (error) {
        console.error('Error al guardar nota:', error);
        await showAlert('No se pudo guardar la nota: ' + error.message, 'Error');
    }
};

// Variable global para almacenar el estado de paginación del histórico
let historicoPaginationState = {
    obraId: null,
    pedidos: [],
    currentIndex: 0,
    itemsPerPage: 5
};

async function loadHistoricoAdmin() {
    const obrasView = document.getElementById('historico-obras-view');
    const pedidosView = document.getElementById('historico-pedidos-view');
    const obrasList = document.getElementById('historico-obras-list');
    const obrasEmpty = document.getElementById('historico-obras-empty');
    
    if (!obrasView || !pedidosView || !obrasList) return;
    
    // Mostrar vista de obras, ocultar vista de pedidos
    obrasView.style.display = 'block';
    pedidosView.style.display = 'none';
    
    // Resetear estado de paginación
    historicoPaginationState = {
        obraId: null,
        pedidos: [],
        currentIndex: 0,
        itemsPerPage: 5
    };
    
    try {
        const todosPedidos = await db.getAll('pedidos');
        const todosPedidosEspeciales = await db.getAll('pedidosEspeciales');
        
        // Filtrar pedidos normales completados (con transferenciaPDF y albaran)
        const pedidosHistoricos = todosPedidos.filter(p => {
            // Excluir pedidos especiales (los manejaremos por separado)
            if (isPedidoEspecial(p)) {
                return false;
            }
            // Solo pedidos completados (con transferenciaPDF y albaran)
            return p.transferenciaPDF && p.albaran;
        });
        
        // Filtrar pedidos especiales pagados
        const pedidosEspecialesHistoricos = todosPedidosEspeciales.filter(p => {
            return p.estadoPago === 'Pagado' && p.documento;
        });
        
        // También buscar pedidos especiales pagados que puedan estar en la colección 'pedidos'
        const pedidosEspecialesEnPedidos = todosPedidos.filter(p => {
            if (!isPedidoEspecial(p)) return false;
            return p.estadoPago === 'Pagado' && p.documento;
        });
        
        // Combinar todos los pedidos históricos
        const todosHistoricos = [...pedidosHistoricos, ...pedidosEspecialesHistoricos, ...pedidosEspecialesEnPedidos];
        
        if (todosHistoricos.length === 0) {
            obrasList.innerHTML = '';
            if (obrasEmpty) obrasEmpty.style.display = 'block';
            return;
        }
        
        if (obrasEmpty) obrasEmpty.style.display = 'none';
        
        // Obtener todas las obras
        const todasObras = await db.getAllObras();
        
        // Agrupar pedidos por obra
        const pedidosPorObra = new Map();
        for (const pedido of todosHistoricos) {
            const obraId = pedido.obraId || 'sin-obra';
            if (!pedidosPorObra.has(obraId)) {
                pedidosPorObra.set(obraId, []);
            }
            pedidosPorObra.get(obraId).push(pedido);
        }
        
        // Filtrar obras que tienen pedidos históricos
        const obrasConPedidos = todasObras.filter(obra => 
            pedidosPorObra.has(obra.id)
        );
        
        // Agregar "Sin obra" si hay pedidos sin obra asignada
        if (pedidosPorObra.has('sin-obra')) {
            obrasConPedidos.push({
                id: 'sin-obra',
                nombre: 'Sin obra asignada',
                nombreComercial: 'Sin obra asignada',
                encargado: '',
                telefonoEncargado: '',
                direccionGoogleMaps: ''
            });
        }
        
        if (obrasConPedidos.length === 0) {
            obrasList.innerHTML = '';
            if (obrasEmpty) obrasEmpty.style.display = 'block';
            return;
        }
        
        obrasList.innerHTML = '';
        
        // Crear cards para cada obra
        for (const obra of obrasConPedidos) {
            const pedidosCount = pedidosPorObra.get(obra.id || 'sin-obra').length;
            const card = createObraCardHistorico(obra, pedidosCount);
            obrasList.appendChild(card);
        }
    } catch (error) {
        console.error('Error al cargar obras con pedidos históricos:', error);
        obrasList.innerHTML = '<p>Error al cargar obras</p>';
    }
}

// Función para crear card de obra en vista de histórico (sin botones de editar/borrar)
function createObraCardHistorico(obra, pedidosCount) {
    const card = document.createElement('div');
    card.className = 'obra-card obra-card-cerrados';
    card.style.cursor = 'pointer';
    
    // Construir enlace de ubicación
    let ubicacionLink = '';
    if (obra.direccionGoogleMaps) {
        const direccionUrl = escapeHtml(obra.direccionGoogleMaps);
        ubicacionLink = `<a href="${direccionUrl}" target="_blank" rel="noopener noreferrer">Ubicación</a>`;
    } else {
        ubicacionLink = '<span class="info-value">No especificada</span>';
    }
    
    card.innerHTML = `
        <div class="obra-header">
            <h4>${escapeHtml(obra.nombreComercial || obra.nombre || 'Sin nombre')}</h4>
            <span class="obra-pedidos-count">${pedidosCount} pedido${pedidosCount !== 1 ? 's' : ''} histórico${pedidosCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="obra-details">
            <div class="obra-info">
                <strong>Encargado:</strong>
                <span class="info-value">${escapeHtml(obra.encargado || 'No especificado')}</span>
            </div>
            <div class="obra-info">
                <strong>Teléfono:</strong>
                <span class="info-value">${escapeHtml(obra.telefonoEncargado || 'No especificado')}</span>
            </div>
            <div class="obra-direccion">
                <strong>Ubicación:</strong>
                ${ubicacionLink}
            </div>
            ${obra.id && obra.id !== 'sin-obra' ? `
            <div class="obra-info">
                <strong>ID:</strong>
                <span class="info-value" style="font-size: 0.75rem; color: var(--text-secondary);">${escapeHtml(obra.id)}</span>
            </div>
            ` : ''}
        </div>
    `;
    
    // Agregar event listener para mostrar pedidos de esta obra
    card.addEventListener('click', () => {
        loadPedidosHistoricosPorObra(obra.id || 'sin-obra', obra.nombreComercial || obra.nombre || 'Sin obra asignada');
    });
    
    return card;
}

// Función para cargar pedidos históricos de una obra específica con paginación
async function loadPedidosHistoricosPorObra(obraId, obraNombre) {
    const obrasView = document.getElementById('historico-obras-view');
    const pedidosView = document.getElementById('historico-pedidos-view');
    const pedidosList = document.getElementById('historico-pedidos-list');
    const pedidosEmpty = document.getElementById('historico-pedidos-empty');
    const obraNombreElement = document.getElementById('historico-obra-nombre');
    const cargarMasWrapper = document.getElementById('historico-cargar-mas-wrapper');
    
    if (!obrasView || !pedidosView || !pedidosList) return;
    
    // Mostrar vista de pedidos, ocultar vista de obras
    obrasView.style.display = 'none';
    pedidosView.style.display = 'block';
    
    if (obraNombreElement) {
        obraNombreElement.textContent = obraNombre;
    }
    
    try {
        const todosPedidos = await db.getAll('pedidos');
        const todosPedidosEspeciales = await db.getAll('pedidosEspeciales');
        
        // Filtrar pedidos normales históricos de esta obra
        const pedidosHistoricos = todosPedidos.filter(p => {
            // Excluir pedidos especiales (los manejaremos por separado)
            if (isPedidoEspecial(p)) {
                return false;
            }
            // Solo pedidos completados
            if (!p.transferenciaPDF || !p.albaran) {
                return false;
            }
            // Filtrar por obra
            return obraId === 'sin-obra' ? !p.obraId : p.obraId === obraId;
        });
        
        // Filtrar pedidos especiales pagados de esta obra
        const pedidosEspecialesHistoricos = todosPedidosEspeciales.filter(p => {
            const pObraId = p.obraId || 'sin-obra';
            if (pObraId !== obraId) return false;
            return p.estadoPago === 'Pagado' && p.documento;
        });
        
        // También buscar pedidos especiales pagados que puedan estar en la colección 'pedidos'
        const pedidosEspecialesEnPedidos = todosPedidos.filter(p => {
            if (!isPedidoEspecial(p)) return false;
            const pObraId = p.obraId || 'sin-obra';
            if (pObraId !== obraId) return false;
            return p.estadoPago === 'Pagado' && p.documento;
        });
        
        // Combinar todos los pedidos históricos
        const todosHistoricos = [...pedidosHistoricos, ...pedidosEspecialesHistoricos, ...pedidosEspecialesEnPedidos];
        
        // Ordenar por fecha (más recientes primero)
        todosHistoricos.sort((a, b) => {
            const fechaA = a.fechaCreacion || a.fecha ? new Date(a.fechaCreacion || a.fecha) : new Date(0);
            const fechaB = b.fechaCreacion || b.fecha ? new Date(b.fechaCreacion || b.fecha) : new Date(0);
            return fechaB - fechaA;
        });
        
        // Guardar estado de paginación
        historicoPaginationState.obraId = obraId;
        historicoPaginationState.pedidos = todosHistoricos;
        historicoPaginationState.currentIndex = 0;
        
        if (todosHistoricos.length === 0) {
            pedidosList.innerHTML = '';
            if (pedidosEmpty) pedidosEmpty.style.display = 'block';
            if (cargarMasWrapper) cargarMasWrapper.style.display = 'none';
            return;
        }
        
        if (pedidosEmpty) pedidosEmpty.style.display = 'none';
        pedidosList.innerHTML = '';
        
        // Cargar primeros 5 pedidos
        cargarMasPedidosHistoricos();
    } catch (error) {
        console.error('Error al cargar pedidos históricos por obra:', error);
        pedidosList.innerHTML = '<p>Error al cargar pedidos</p>';
    }
}

// Función para cargar más pedidos históricos (paginación)
async function cargarMasPedidosHistoricos() {
    const pedidosList = document.getElementById('historico-pedidos-list');
    const cargarMasWrapper = document.getElementById('historico-cargar-mas-wrapper');
    
    if (!pedidosList || !cargarMasWrapper) return;
    
    const { pedidos, currentIndex, itemsPerPage } = historicoPaginationState;
    
    // Calcular cuántos pedidos cargar
    const endIndex = Math.min(currentIndex + itemsPerPage, pedidos.length);
    const pedidosACargar = pedidos.slice(currentIndex, endIndex);
    
    // Crear cards para los pedidos a cargar (usar diseño compacto igual que cuentas)
    for (const pedido of pedidosACargar) {
        // Si es pedido especial, usar la card especial; si no, la card normal
        const card = isPedidoEspecial(pedido) 
            ? await createPedidoEspecialAdminCard(pedido)
            : await createPedidoCuentaCardAdmin(pedido);
        pedidosList.appendChild(card);
    }
    
    // Actualizar índice
    historicoPaginationState.currentIndex = endIndex;
    
    // Mostrar/ocultar botón "Cargar más"
    if (endIndex < pedidos.length) {
        cargarMasWrapper.style.display = 'block';
    } else {
        cargarMasWrapper.style.display = 'none';
    }
}

// Función para crear card de pedido a tienda (no especial)
async function createPedidoTiendaCard(pedido) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card contab-pedido-card';
    
    // Obtener información de obra y tienda
    const obraInfo = pedido.obraId ? await db.get('obras', pedido.obraId) : null;
    const tiendaInfo = pedido.tiendaId ? await db.get('tiendas', pedido.tiendaId) : null;
    
    // Formatear fecha
    let fechaObj;
    if (pedido.fechaCreacion) {
        fechaObj = new Date(pedido.fechaCreacion);
    } else if (pedido.fecha) {
        fechaObj = new Date(pedido.fecha);
    } else {
        fechaObj = new Date();
    }
    const fechaFormateada = formatDateTime(fechaObj);
    
    const persona = escapeHtml(pedido.persona || 'Sin especificar');
    const obraNombreTexto = obraInfo?.nombreComercial || obraInfo?.nombre || pedido.obraNombreComercial || 'Obra no especificada';
    const obraNombre = escapeHtml(obraNombreTexto);
    const obraLink = buildObraMapsLink(obraInfo, obraNombreTexto);
    const obraLinkHref = obraLink ? escapeHtml(obraLink) : null;
    const tiendaNombre = escapeHtml(tiendaInfo?.nombre || 'Tienda desconocida');
    
    const items = Array.isArray(pedido.items) ? pedido.items : [];
    const totalPedido = items.reduce((sum, item) => sum + (item.precio || 0) * (item.cantidad || 0), 0);
    
    const itemsHtml = items.length
        ? items.map((item, index) => {
            const nombre = escapeHtml(item.nombre || 'Artículo sin nombre');
            const cantidad = item.cantidad || 0;
            const precio = item.precio || 0;
            const subtotal = cantidad * precio;
            const foto = item.foto;
            
            const fotoHtml = foto ? `
                <img src="${escapeHtml(foto)}" alt="${nombre}" class="pedido-item-foto" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            ` : '';
            const fotoPlaceholder = `
                <div class="pedido-item-foto-placeholder" style="${foto ? 'display: none;' : ''}">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </div>
            `;
            
            return `
                <div class="pedido-item">
                    ${fotoHtml}
                    ${fotoPlaceholder}
                    <div class="pedido-item-info">
                        <p class="pedido-item-name">${nombre}</p>
                        <div class="pedido-item-meta">
                            <span>Cantidad: <strong>${cantidad}</strong></span>
                            <span>Precio unitario: ${precio.toFixed(2)}€</span>
                            <span>Total línea: <strong>${subtotal.toFixed(2)}€</strong></span>
                        </div>
                    </div>
                </div>
            `;
        }).join('')
        : '<p class="pedido-sin-items">No hay artículos en este pedido</p>';
    
    card.innerHTML = `
        <div class="contab-pedido-header-compact">
            <div>
                <h3 class="pedido-code">Pedido #${pedido.id}</h3>
                <p class="pedido-fecha">${fechaFormateada}</p>
            </div>
        </div>
        <div class="contab-info-grid-compact">
            <div class="contab-info-card-compact contab-card-datos">
                <h4>Datos del pedido</h4>
                <div class="contab-info-item">
                    <strong>Tienda:</strong>
                    <span>${tiendaNombre}</span>
                </div>
                <div class="contab-info-item">
                    <strong>Obra:</strong>
                    ${obraLinkHref ? `<a href="${obraLinkHref}" target="_blank" rel="noopener noreferrer">${obraNombre}</a>` : `<span>${obraNombre}</span>`}
                </div>
                <div class="contab-info-item">
                    <strong>Persona:</strong>
                    <span>${persona}</span>
                </div>
                <div class="contab-info-item">
                    <strong>Total:</strong>
                    <span><strong>${totalPedido.toFixed(2)}€</strong></span>
                </div>
            </div>
            <div class="contab-info-card-compact contab-card-articulos">
                <h4>Artículos (${items.length})</h4>
                <div class="pedido-items-list-compact">
                    ${itemsHtml}
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// Funciones de carga para cada subpestaña de Pedidos Especiales
let isLoadingNuevoEspeciales = false; // Bandera para evitar ejecuciones concurrentes

async function loadNuevoEspeciales() {
    const container = document.getElementById('nuevo-especiales-list');
    const emptyState = document.getElementById('nuevo-especiales-empty');
    
    if (!container) return;
    
    // Evitar ejecuciones concurrentes
    if (isLoadingNuevoEspeciales) {
        return;
    }
    
    isLoadingNuevoEspeciales = true;
    
    try {
        const todosPedidos = await db.getAll('pedidosEspeciales');
        // Filtrar pedidos nuevos (estado: Pendiente o sin estado específico, excluyendo Cerrado)
        // "En Espera" se muestra en la pestaña correspondiente según su estado base
        const pedidosNuevos = todosPedidos.filter(p => {
            const estadoBase = p.estado === 'En Espera' ? (p.estadoAnterior || 'Nuevo') : p.estado;
            return (!estadoBase || estadoBase === 'Pendiente' || estadoBase === 'Nuevo') && 
                   p.estado !== 'Cerrado';
        });
        
        // Actualizar badge
        const badge = document.getElementById('tab-count-nuevo-especiales');
        if (badge) badge.textContent = pedidosNuevos.length;
        
        if (pedidosNuevos.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        container.innerHTML = '';
        
        // Ordenar por fecha (más recientes primero)
        pedidosNuevos.sort((a, b) => {
            const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
            const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
            return fechaB - fechaA;
        });
        
        // Crear cards para cada pedido
        for (const pedido of pedidosNuevos) {
            const card = await createPedidoEspecialAdminCard(pedido);
            container.appendChild(card);
        }
    } catch (error) {
        console.error('Error al cargar pedidos nuevos:', error);
        container.innerHTML = '<p>Error al cargar pedidos</p>';
    } finally {
        isLoadingNuevoEspeciales = false;
    }
}

async function loadSinTransporteEspeciales() {
    const container = document.getElementById('sin-transporte-especiales-list');
    const emptyState = document.getElementById('sin-transporte-especiales-empty');
    
    if (!container) return;
    
    try {
        const todosPedidos = await db.getAll('pedidosEspeciales');
        // Filtrar pedidos sin transporte (excluyendo Cerrado)
        // "En Espera" se muestra en la pestaña correspondiente según su estado base
        const pedidosSinTransporte = todosPedidos.filter(p => {
            const estadoBase = p.estado === 'En Espera' ? (p.estadoAnterior || p.estado) : p.estado;
            return (estadoBase === 'Sin Transporte' || (p.transporte === false && estadoBase !== 'Gestionando')) &&
                   p.estado !== 'Cerrado';
        });
        
        // Actualizar badge
        const badgeSinTransporte = document.getElementById('tab-count-sin-transporte-especiales');
        if (badgeSinTransporte) badgeSinTransporte.textContent = pedidosSinTransporte.length;
        
        if (pedidosSinTransporte.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        container.innerHTML = '';
        
        // Ordenar por fecha (más recientes primero)
        pedidosSinTransporte.sort((a, b) => {
            const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
            const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
            return fechaB - fechaA;
        });
        
        // Crear cards para cada pedido
        for (const pedido of pedidosSinTransporte) {
            const card = await createPedidoEspecialAdminCard(pedido);
            container.appendChild(card);
        }
    } catch (error) {
        console.error('Error al cargar pedidos sin transporte:', error);
        container.innerHTML = '<p>Error al cargar pedidos</p>';
    }
}

async function loadConTransporteEspeciales() {
    const container = document.getElementById('con-transporte-especiales-list');
    const emptyState = document.getElementById('con-transporte-especiales-empty');
    
    if (!container) return;
    
    try {
        const todosPedidos = await db.getAll('pedidosEspeciales');
        // Filtrar pedidos con transporte (excluyendo Cerrado)
        // "En Espera" se muestra en la pestaña correspondiente según su estado base
        const pedidosConTransporte = todosPedidos.filter(p => {
            const estadoBase = p.estado === 'En Espera' ? (p.estadoAnterior || p.estado) : p.estado;
            return (estadoBase === 'Con Transporte' || (p.transporte === true && estadoBase !== 'Gestionando')) &&
                   p.estado !== 'Cerrado';
        });
        
        // Actualizar badge
        const badgeConTransporte = document.getElementById('tab-count-con-transporte-especiales');
        if (badgeConTransporte) badgeConTransporte.textContent = pedidosConTransporte.length;
        
        if (pedidosConTransporte.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        container.innerHTML = '';
        
        // Ordenar por fecha (más recientes primero)
        pedidosConTransporte.sort((a, b) => {
            const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
            const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
            return fechaB - fechaA;
        });
        
        // Crear cards para cada pedido
        for (const pedido of pedidosConTransporte) {
            const card = await createPedidoEspecialAdminCard(pedido);
            container.appendChild(card);
        }
    } catch (error) {
        console.error('Error al cargar pedidos con transporte:', error);
        container.innerHTML = '<p>Error al cargar pedidos</p>';
    }
}

async function loadOnlineEspeciales() {
    const container = document.getElementById('online-especiales-list');
    const emptyState = document.getElementById('online-especiales-empty');
    
    if (!container) return;
    
    try {
        const todosPedidos = await db.getAll('pedidosEspeciales');
        // Filtrar pedidos online (excluyendo Cerrado)
        // "En Espera" se muestra en la pestaña correspondiente según su estado base
        const pedidosOnline = todosPedidos.filter(p => {
            const estadoBase = p.estado === 'En Espera' ? (p.estadoAnterior || p.estado) : p.estado;
            return (estadoBase === 'Online' || p.tipo === 'Online' || p.pedidoOnline === true) &&
                   p.estado !== 'Cerrado';
        });
        
        // Actualizar badge
        const badgeOnline = document.getElementById('tab-count-online-especiales');
        if (badgeOnline) badgeOnline.textContent = pedidosOnline.length;
        
        if (pedidosOnline.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        container.innerHTML = '';
        
        // Ordenar por fecha (más recientes primero)
        pedidosOnline.sort((a, b) => {
            const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
            const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
            return fechaB - fechaA;
        });
        
        // Crear cards para cada pedido
        for (const pedido of pedidosOnline) {
            const card = await createPedidoEspecialAdminCard(pedido);
            container.appendChild(card);
        }
    } catch (error) {
        console.error('Error al cargar pedidos online:', error);
        container.innerHTML = '<p>Error al cargar pedidos</p>';
    }
}

async function loadGestionandoEspeciales() {
    const container = document.getElementById('gestionando-especiales-list');
    const emptyState = document.getElementById('gestionando-especiales-empty');
    
    if (!container) return;
    
    try {
        const todosPedidos = await db.getAll('pedidosEspeciales');
        // Filtrar pedidos gestionando (excluyendo Cerrado)
        // "En Espera" se muestra en la pestaña correspondiente según su estado base
        const pedidosGestionando = todosPedidos.filter(p => {
            const estadoBase = p.estado === 'En Espera' ? (p.estadoAnterior || p.estado) : p.estado;
            return (estadoBase === 'Gestionando' || estadoBase === 'En Proceso') &&
                   p.estado !== 'Cerrado';
        });
        
        // Actualizar badge
        const badgeGestionando = document.getElementById('tab-count-gestionando-especiales');
        if (badgeGestionando) badgeGestionando.textContent = pedidosGestionando.length;
        
        if (pedidosGestionando.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        container.innerHTML = '';
        
        // Ordenar por fecha (más recientes primero)
        pedidosGestionando.sort((a, b) => {
            const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
            const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
            return fechaB - fechaA;
        });
        
        // Crear cards para cada pedido
        for (const pedido of pedidosGestionando) {
            const card = await createPedidoEspecialAdminCard(pedido);
            container.appendChild(card);
        }
    } catch (error) {
        console.error('Error al cargar pedidos gestionando:', error);
        container.innerHTML = '<p>Error al cargar pedidos</p>';
    }
}

// Variable global para almacenar el estado de paginación
let cerradosPaginationState = {
    obraId: null,
    pedidos: [],
    currentIndex: 0,
    itemsPerPage: 5
};

async function loadCerradosEspeciales() {
    const obrasView = document.getElementById('cerrados-obras-view');
    const pedidosView = document.getElementById('cerrados-pedidos-view');
    const obrasList = document.getElementById('cerrados-obras-list');
    const obrasEmpty = document.getElementById('cerrados-obras-empty');
    
    if (!obrasView || !pedidosView || !obrasList) return;
    
    // Mostrar vista de obras, ocultar vista de pedidos
    obrasView.style.display = 'block';
    pedidosView.style.display = 'none';
    
    // Resetear estado de paginación
    cerradosPaginationState = {
        obraId: null,
        pedidos: [],
        currentIndex: 0,
        itemsPerPage: 5
    };
    
    try {
        const todosPedidos = await db.getAll('pedidosEspeciales');
        // Filtrar pedidos cerrados
        const pedidosCerrados = todosPedidos.filter(p => 
            p.estado === 'Cerrado'
        );
        
        // Actualizar badge
        const badgeCerrados = document.getElementById('tab-count-cerrados-especiales');
        if (badgeCerrados) badgeCerrados.textContent = pedidosCerrados.length;
        
        if (pedidosCerrados.length === 0) {
            obrasList.innerHTML = '';
            if (obrasEmpty) obrasEmpty.style.display = 'block';
            return;
        }
        
        if (obrasEmpty) obrasEmpty.style.display = 'none';
        
        // Obtener todas las obras
        const todasObras = await db.getAllObras();
        
        // Agrupar pedidos por obra
        const pedidosPorObra = new Map();
        for (const pedido of pedidosCerrados) {
            const obraId = pedido.obraId || 'sin-obra';
            if (!pedidosPorObra.has(obraId)) {
                pedidosPorObra.set(obraId, []);
            }
            pedidosPorObra.get(obraId).push(pedido);
        }
        
        // Filtrar obras que tienen pedidos cerrados
        const obrasConPedidos = todasObras.filter(obra => 
            pedidosPorObra.has(obra.id)
        );
        
        // Agregar "Sin obra" si hay pedidos sin obra asignada
        if (pedidosPorObra.has('sin-obra')) {
            obrasConPedidos.push({
                id: 'sin-obra',
                nombre: 'Sin obra asignada',
                nombreComercial: 'Sin obra asignada',
                encargado: '',
                telefonoEncargado: '',
                direccionGoogleMaps: ''
            });
        }
        
        if (obrasConPedidos.length === 0) {
            obrasList.innerHTML = '';
            if (obrasEmpty) obrasEmpty.style.display = 'block';
            return;
        }
        
        obrasList.innerHTML = '';
        
        // Crear cards para cada obra
        for (const obra of obrasConPedidos) {
            const pedidosCount = pedidosPorObra.get(obra.id || 'sin-obra').length;
            const card = createObraCardCerrados(obra, pedidosCount);
            obrasList.appendChild(card);
        }
    } catch (error) {
        console.error('Error al cargar obras con pedidos cerrados:', error);
        obrasList.innerHTML = '<p>Error al cargar obras</p>';
    }
}

// Función para crear card de obra en vista de cerrados (sin botones de editar/borrar)
function createObraCardCerrados(obra, pedidosCount) {
    const card = document.createElement('div');
    card.className = 'obra-card obra-card-cerrados';
    card.style.cursor = 'pointer';
    
    // Construir enlace de ubicación
    let ubicacionLink = '';
    if (obra.direccionGoogleMaps) {
        const direccionUrl = escapeHtml(obra.direccionGoogleMaps);
        ubicacionLink = `<a href="${direccionUrl}" target="_blank" rel="noopener noreferrer">Ubicación</a>`;
    } else {
        ubicacionLink = '<span class="info-value">No especificada</span>';
    }
    
    card.innerHTML = `
        <div class="obra-header">
            <h4>${escapeHtml(obra.nombreComercial || obra.nombre || 'Sin nombre')}</h4>
            <span class="obra-pedidos-count">${pedidosCount} pedido${pedidosCount !== 1 ? 's' : ''} cerrado${pedidosCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="obra-details">
            <div class="obra-info">
                <strong>Encargado:</strong>
                <span class="info-value">${escapeHtml(obra.encargado || 'No especificado')}</span>
            </div>
            <div class="obra-info">
                <strong>Teléfono:</strong>
                <span class="info-value">${escapeHtml(obra.telefonoEncargado || 'No especificado')}</span>
            </div>
            <div class="obra-direccion">
                <strong>Ubicación:</strong>
                ${ubicacionLink}
            </div>
            ${obra.id && obra.id !== 'sin-obra' ? `
            <div class="obra-info">
                <strong>ID:</strong>
                <span class="info-value" style="font-size: 0.75rem; color: var(--text-secondary);">${escapeHtml(obra.id)}</span>
            </div>
            ` : ''}
        </div>
    `;
    
    // Agregar event listener para mostrar pedidos de esta obra
    card.addEventListener('click', () => {
        loadPedidosCerradosPorObra(obra.id || 'sin-obra', obra.nombreComercial || obra.nombre || 'Sin obra asignada');
    });
    
    return card;
}

// Función para cargar pedidos cerrados de una obra específica con paginación
async function loadPedidosCerradosPorObra(obraId, obraNombre) {
    const obrasView = document.getElementById('cerrados-obras-view');
    const pedidosView = document.getElementById('cerrados-pedidos-view');
    const pedidosList = document.getElementById('cerrados-pedidos-list');
    const pedidosEmpty = document.getElementById('cerrados-pedidos-empty');
    const obraNombreElement = document.getElementById('cerrados-obra-nombre');
    const cargarMasWrapper = document.getElementById('cerrados-cargar-mas-wrapper');
    
    if (!obrasView || !pedidosView || !pedidosList) return;
    
    // Mostrar vista de pedidos, ocultar vista de obras
    obrasView.style.display = 'none';
    pedidosView.style.display = 'block';
    
    if (obraNombreElement) {
        obraNombreElement.textContent = obraNombre;
    }
    
    try {
        const todosPedidos = await db.getAll('pedidosEspeciales');
        // Filtrar pedidos cerrados de esta obra
        const pedidosCerrados = todosPedidos.filter(p => 
            p.estado === 'Cerrado' && (obraId === 'sin-obra' ? !p.obraId : p.obraId === obraId)
        );
        
        // Ordenar por fecha (más recientes primero)
        pedidosCerrados.sort((a, b) => {
            const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
            const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
            return fechaB - fechaA;
        });
        
        // Guardar estado de paginación
        cerradosPaginationState.obraId = obraId;
        cerradosPaginationState.pedidos = pedidosCerrados;
        cerradosPaginationState.currentIndex = 0;
        
        if (pedidosCerrados.length === 0) {
            pedidosList.innerHTML = '';
            if (pedidosEmpty) pedidosEmpty.style.display = 'block';
            if (cargarMasWrapper) cargarMasWrapper.style.display = 'none';
            return;
        }
        
        if (pedidosEmpty) pedidosEmpty.style.display = 'none';
        pedidosList.innerHTML = '';
        
        // Cargar primeros 5 pedidos
        cargarMasPedidosCerrados();
    } catch (error) {
        console.error('Error al cargar pedidos cerrados por obra:', error);
        pedidosList.innerHTML = '<p>Error al cargar pedidos</p>';
    }
}

// Función para cargar más pedidos (paginación)
async function cargarMasPedidosCerrados() {
    const pedidosList = document.getElementById('cerrados-pedidos-list');
    const cargarMasWrapper = document.getElementById('cerrados-cargar-mas-wrapper');
    
    if (!pedidosList || !cargarMasWrapper) return;
    
    const { pedidos, currentIndex, itemsPerPage } = cerradosPaginationState;
    
    // Calcular cuántos pedidos cargar
    const endIndex = Math.min(currentIndex + itemsPerPage, pedidos.length);
    const pedidosACargar = pedidos.slice(currentIndex, endIndex);
    
    // Crear cards para los pedidos a cargar
    for (const pedido of pedidosACargar) {
        const card = await createPedidoEspecialAdminCard(pedido);
        pedidosList.appendChild(card);
    }
    
    // Actualizar índice
    cerradosPaginationState.currentIndex = endIndex;
    
    // Mostrar/ocultar botón "Cargar más"
    if (endIndex < pedidos.length) {
        cargarMasWrapper.style.display = 'block';
    } else {
        cargarMasWrapper.style.display = 'none';
    }
}

// Función para crear card de pedido especial en admin
async function createPedidoEspecialAdminCard(pedido) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card contab-pedido-card';
    
    // Obtener información de obra si existe
    const obraInfo = pedido.obraId ? await db.get('obras', pedido.obraId) : null;
    
    // Formatear fecha
    let fechaObj;
    if (pedido.fechaCreacion) {
        fechaObj = new Date(pedido.fechaCreacion);
    } else {
        fechaObj = new Date();
    }
    const fechaFormateada = formatDateTime(fechaObj);
    
    const estadoEnvio = pedido.estado || 'Nuevo';
    const estadoEnvioClass = getEstadoEnvioPillClass(estadoEnvio);
    
    const proveedorNombre = escapeHtml(pedido.proveedorNombre || 'Proveedor desconocido');
    const proveedorDescripcion = escapeHtml(pedido.proveedorDescripcion || '');
    const persona = escapeHtml(pedido.persona || 'Sin especificar');
    
    const obraNombreTexto = obraInfo?.nombreComercial || obraInfo?.nombre || 'Obra no especificada';
    const obraNombre = escapeHtml(obraNombreTexto);
    const obraLink = buildObraMapsLink(obraInfo, obraNombreTexto);
    const obraLinkHref = obraLink ? escapeHtml(obraLink) : null;
    const encargado = escapeHtml(obraInfo?.encargado || 'No asignado');
    const telefonoEncargado = escapeHtml(obraInfo?.telefonoEncargado || '');
    const encargadoInfo = telefonoEncargado ? `${encargado} | ${telefonoEncargado}` : encargado;
    
    const articulos = Array.isArray(pedido.articulos) ? pedido.articulos : [];
    
    // Procesar notas (pueden ser string o array de objetos con usuario)
    let notasArray = [];
    if (Array.isArray(pedido.notas)) {
        notasArray = pedido.notas;
    } else if (pedido.notas && typeof pedido.notas === 'string') {
        // Convertir nota antigua a formato nuevo
        notasArray = [{
            id: 'nota-original',
            usuarioId: pedido.userId || null,
            usuarioNombre: pedido.persona || 'Usuario',
            usuarioTipo: 'Administrador',
            mensaje: pedido.notas,
            timestamp: pedido.fechaCreacion || new Date().toISOString()
        }];
    }
    
    const totalPedido = articulos.reduce((total, articulo) => {
        const precioItem = Number(articulo.precio) || 0;
        const cantidadItem = Number(articulo.cantidad) || 1;
        return total + precioItem * cantidadItem;
    }, 0);
    
    const itemsHtml = articulos.length
        ? articulos.map((articulo, index) => {
            const nombre = escapeHtml(articulo.nombre || 'Artículo sin nombre');
            const cantidad = Number(articulo.cantidad) || 1;
            const precio = formatCurrency(articulo.precio || 0);
            const subtotal = formatCurrency((articulo.precio || 0) * cantidad);
            const fotoUrl = articulo.foto ? escapeHtml(articulo.foto) : null;
            const placeholderId = `foto-placeholder-especial-admin-${pedido.id}-${index}`.replace(/[^a-zA-Z0-9-]/g, '-');
            const fotoHtml = fotoUrl
                ? `<img src="${fotoUrl}" alt="${nombre}" class="pedido-item-foto" onerror="this.style.display='none'; document.getElementById('${placeholderId}').style.display='flex';">`
                : '';
            const fotoPlaceholder = `<div id="${placeholderId}" class="pedido-item-foto-placeholder" style="${fotoUrl ? 'display: none;' : ''}">📦</div>`;
            const articuloId = articulo.id || `articulo-${pedido.id}-${index}`;
            const descripcion = articulo.descripcion ? escapeHtml(articulo.descripcion) : '';
            return `
                <div class="pedido-item" data-articulo-id="${articuloId}" data-articulo-index="${index}">
                    ${fotoHtml}
                    ${fotoPlaceholder}
                    <div class="pedido-item-info">
                        <p class="pedido-item-name">${nombre}</p>
                        ${descripcion ? `<p class="pedido-item-description">${descripcion}</p>` : ''}
                        <div class="pedido-item-meta">
                            <span>Cantidad: <strong id="cantidad-display-${pedido.id}-${index}">${cantidad}</strong></span>
                            <span>Precio unitario: ${precio}</span>
                            <span>Total línea: <strong id="subtotal-display-${pedido.id}-${index}">${subtotal}</strong></span>
                        </div>
                    </div>
                    <div class="pedido-item-actions">
                        <button class="btn-item-action btn-duplicar" onclick="duplicarArticuloPedido('${pedido.id}', ${index})" title="Duplicar artículo" aria-label="Duplicar">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="2" width="6" height="6" rx="1"/>
                                <rect x="8" y="8" width="6" height="6" rx="1"/>
                                <path d="M5 5h6M5 11h6"/>
                            </svg>
                        </button>
                        <button class="btn-item-action btn-nuevo-pedido" onclick="generarPedidoDesdeArticulo('${pedido.id}', ${index})" title="Generar nuevo pedido desde este artículo" aria-label="Nuevo pedido">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M8 2v12M2 8h12"/>
                            </svg>
                        </button>
                        <button class="btn-item-action btn-editar" onclick="editarCantidadArticuloPedido('${pedido.id}', ${index}, ${cantidad})" title="Editar cantidad" aria-label="Editar">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11.5 2.5a2.121 2.121 0 0 1 3 3L6.5 13.5H2.5v-4L11.5 2.5z"/>
                            </svg>
                        </button>
                        <button class="btn-item-action btn-eliminar" onclick="eliminarArticuloPedido('${pedido.id}', ${index})" title="Eliminar artículo" aria-label="Eliminar">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1v1m2 0v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4h10z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('')
        : '<p class="cascade-empty">No hay artículos en este pedido</p>';
    
    const documentoInputId = `pedido-documento-file-${pedido.id}`;
    const tieneDocumento = Boolean(pedido.documento);
    const documentoContent = tieneDocumento
        ? `
            <div class="doc-actions-with-buttons">
                <a href="#" onclick="verDocumentoPedidoEspecial('${escapeHtml(pedido.id || '')}'); return false;" class="doc-link">📄 Ver</a>
                <button class="btn-doc-action btn-doc-editar" onclick="editarDocumentoPedidoEspecial('${escapeHtml(pedido.id || '')}')" title="Editar documento" aria-label="Editar">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11.5 2.5a2.121 2.121 0 0 1 3 3L6.5 13.5H2.5v-4L11.5 2.5z"/>
                    </svg>
                </button>
                <button class="btn-doc-action btn-doc-eliminar" onclick="eliminarDocumentoPedidoEspecial('${escapeHtml(pedido.id || '')}')" title="Eliminar documento" aria-label="Eliminar">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1v1m2 0v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4h10z"/>
                    </svg>
                </button>
            </div>
        `
        : `<button class="btn-adjuntar-documento" onclick="adjuntarDocumentoPedidoEspecial('${escapeHtml(pedido.id || '')}', '${documentoInputId}')" type="button">Sin documento adjunto</button>
           <input type="file" id="${documentoInputId}" accept="application/pdf,image/png,image/jpeg,image/jpg" style="display: none;" onchange="handleDocumentoPedidoEspecialChange('${escapeHtml(pedido.id || '')}', this)">`;
    
    const notasSectionId = `pedido-notas-especial-admin-${pedido.id}`;
    const notasListId = `pedido-notas-list-especial-admin-${pedido.id}`;
    const notasCountId = `pedido-notas-count-especial-admin-${pedido.id}`;
    const notaInputId = `pedido-nota-input-especial-admin-${pedido.id}`;
    const estadoSelectId = `pedido-estado-select-${pedido.id}`;
    const tiendaSelectId = `pedido-tienda-select-${pedido.id}`;
    
    // Estado de pago
    const estadoPago = pedido.estadoPago || 'Sin asignar';
    const estadoPagoClass = getEstadoPagoPillClass(estadoPago);
    const estadoPagoSelectId = `pedido-estado-pago-select-${pedido.id}`;
    
    // Cargar tiendas para el desplegable
    const tiendas = await db.getAll('tiendas');
    const tiendasOptions = tiendas
        .filter(t => t.activa !== false)
        .map(t => `<option value="${t.id}" ${pedido.tiendaId === t.id ? 'selected' : ''} class="tienda-asignada">${escapeHtml(t.nombre || 'Tienda sin nombre')}</option>`)
        .join('');
    
    card.innerHTML = `
        <!-- Header del pedido -->
        <div class="contab-pedido-header-compact">
            <p class="pedido-code">Pedido Especial #${escapeHtml(pedido.id || 'N/A')}</p>
            <div class="pedido-header-actions">
                <div class="pedido-estado-select-wrapper">
                    <label for="${estadoSelectId}" style="font-size: 0.75rem; color: var(--text-secondary); margin-right: 0.5rem;">Estado:</label>
                    <select id="${estadoSelectId}" class="pedido-estado-select ${estadoEnvioClass}" onchange="cambiarEstadoPedidoEspecial('${escapeHtml(pedido.id || '')}', this.value)">
                        <option value="Nuevo" ${estadoEnvio === 'Nuevo' ? 'selected' : ''} class="estado-envio-nuevo">Nuevo</option>
                        <option value="Gestionando" ${estadoEnvio === 'Gestionando' ? 'selected' : ''} class="estado-envio-gestionando">Gestionando</option>
                        <option value="Sin Transporte" ${estadoEnvio === 'Sin Transporte' ? 'selected' : ''} class="estado-envio-sin-transporte">Sin Transporte</option>
                        <option value="Con Transporte" ${estadoEnvio === 'Con Transporte' ? 'selected' : ''} class="estado-envio-con-transporte">Con Transporte</option>
                        <option value="Online" ${estadoEnvio === 'Online' ? 'selected' : ''} class="estado-envio-online">Online</option>
                        <option value="Cerrado" ${estadoEnvio === 'Cerrado' ? 'selected' : ''} class="estado-envio-cerrado">Cerrado</option>
                        <option value="En Espera" ${estadoEnvio === 'En Espera' ? 'selected' : ''} class="estado-envio-en-espera">En Espera</option>
                    </select>
                </div>
                <div class="pedido-tienda-select-wrapper">
                    <label for="${tiendaSelectId}" style="font-size: 0.75rem; color: var(--text-secondary); margin-right: 0.5rem;">${pedido.tiendaId ? 'Asignado a:' : 'Asignar a:'}</label>
                    <select id="${tiendaSelectId}" class="pedido-tienda-select ${pedido.tiendaId ? 'tienda-asignada' : 'tienda-sin-asignar'}" ${pedido.tiendaId ? 'disabled' : ''} onchange="asignarTiendaPedidoEspecial('${escapeHtml(pedido.id || '')}', this.value)">
                        ${!pedido.tiendaId ? '<option value="" selected class="tienda-sin-asignar">-- Sin asignar --</option>' : ''}
                        ${tiendasOptions}
                    </select>
                </div>
                <button class="btn-editar-pedido" onclick="editarPedidoEspecial('${escapeHtml(pedido.id || '')}')" title="Editar pedido" aria-label="Editar pedido">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11.5 2.5a2.121 2.121 0 0 1 3 3L6.5 13.5H2.5v-4L11.5 2.5z"/>
                    </svg>
                </button>
                <button class="btn-eliminar-pedido" onclick="eliminarPedidoEspecial('${escapeHtml(pedido.id || '')}')" title="Eliminar pedido" aria-label="Eliminar pedido">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1v1m2 0v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4h10z"/>
                    </svg>
                </button>
            </div>
        </div>
        
        <!-- Cards compactas: Datos del pedido, Estado de pago y Comentarios -->
        <div class="contab-info-grid-compact">
            <!-- Card: Datos del pedido -->
            <div class="contab-info-card-compact contab-card-datos">
                <div class="contab-card-title-compact">Datos del pedido</div>
                <div class="contab-info-row-compact"><span>Proveedor</span><strong>${proveedorNombre}</strong></div>
                ${proveedorDescripcion ? `<div class="contab-info-row-compact"><span>Descripción</span><strong>${proveedorDescripcion}</strong></div>` : ''}
                <div class="contab-info-row-compact"><span>Pedido por</span><strong>${persona}</strong></div>
                ${obraInfo ? `
                <div class="contab-info-row-compact">
                    <span>Obra</span>
                    <strong>${obraLinkHref ? `<a href="${obraLinkHref}" target="_blank" rel="noopener">${obraNombre}</a>` : obraNombre}</strong>
                </div>
                <div class="contab-info-row-compact"><span>Encargado</span><strong>${encargadoInfo}</strong></div>
                ` : ''}
                <div class="contab-info-row-compact"><span>Fecha</span><strong>${escapeHtml(fechaFormateada || '')}</strong></div>
            </div>
            
            <!-- Card: Estado de pago -->
            <div class="contab-info-card-compact contab-card-estado">
                <div class="contab-card-title-compact">Estado de pago</div>
                <div class="contab-info-row-compact">
                    <span>Estado</span>
                    <select id="${estadoPagoSelectId}" class="estado-pago-select-small ${estadoPagoClass}" onchange="cambiarEstadoPagoPedidoEspecial('${pedido.id}', this.value)">
                        <option value="Sin asignar" ${estadoPago === 'Sin asignar' || !estadoPago ? 'selected' : ''} class="estado-pago-sin-asignar">Sin asignar</option>
                        <option value="Pendiente de pago" ${estadoPago === 'Pendiente de pago' ? 'selected' : ''} class="estado-pago-pendiente">Pendiente de pago</option>
                        <option value="Pagado" ${estadoPago === 'Pagado' ? 'selected' : ''} class="estado-pago-pagado">Pagado</option>
                    </select>
                </div>
                <div class="contab-info-row-compact">
                    <span>Documento</span>
                    <div class="doc-actions">${documentoContent}</div>
                </div>
            </div>
            
            <!-- Card: Artículos (siempre visible) -->
            <div class="contab-info-card-compact contab-card-articulos">
                <div class="contab-card-title-compact">
                    <span>Artículos (${articulos.length})</span>
                    <span class="contab-total-compact" style="font-size: 0.7rem; color: var(--primary-color);">Total: ${formatCurrency(totalPedido)}</span>
                </div>
                <div class="pedido-items-list-compact">
                    ${itemsHtml}
                </div>
            </div>
            
            <!-- Card: Comentarios -->
            <div class="contab-info-card-compact contab-card-comentarios">
                <div class="contab-card-title-compact">
                    <span>Comentarios <span class="comentarios-count">(${notasArray.length})</span></span>
                </div>
                <div class="comentarios-input-wrapper">
                    <textarea id="${notaInputId}" class="comentarios-input" placeholder="Escribe un comentario..."></textarea>
                    <div class="comentarios-buttons-row">
                        <button class="btn-ver-comentarios" type="button" onclick="toggleVerComentarios('${pedido.id}', '${notasListId}')" id="btn-ver-comentarios-${pedido.id}">
                            Ver Comentarios
                        </button>
                        <button class="btn btn-primary btn-xs" type="button" onclick="guardarNotaPedidoEspecial('${pedido.id}', '${notaInputId}', '${notasListId}', '${notasCountId}')">Enviar</button>
                    </div>
                </div>
                <div class="comentarios-list-wrapper" id="comentarios-wrapper-${pedido.id}" style="display: none;">
                    <div id="${notasListId}" class="pedido-notas-list-compact-scroll"></div>
                </div>
            </div>
        </div>
        <!-- Resize handle -->
        <div class="pedido-card-resize-handle" data-pedido-id="${pedido.id}"></div>
    `;
    
    // No renderizar notas inicialmente, solo actualizar contador
    const comentariosCountElement = card.querySelector('.comentarios-count');
    if (comentariosCountElement) {
        comentariosCountElement.textContent = `(${notasArray.length})`;
    }
    
    // Configurar resize handle
    const resizeHandle = card.querySelector('.pedido-card-resize-handle');
    if (resizeHandle) {
        setupPedidoCardResize(card, resizeHandle);
    }
    
    return card;
}

// Función para configurar el redimensionamiento de la card de pedido
function setupPedidoCardResize(card, resizeHandle) {
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    let minHeight = 0;
    let initialArticulosMaxHeight = 0;
    let initialComentariosMaxHeight = 0;
    
    // Guardar altura mínima y altura inicial de artículos y comentarios
    const saveInitialValues = () => {
        if (minHeight === 0) {
            minHeight = card.offsetHeight;
            card.style.minHeight = `${minHeight}px`;
            
            // Guardar altura máxima inicial de la lista de artículos
            const articulosCard = card.querySelector('.contab-card-articulos');
            if (articulosCard) {
                const articulosList = articulosCard.querySelector('.pedido-items-list-compact');
                if (articulosList) {
                    initialArticulosMaxHeight = parseInt(window.getComputedStyle(articulosList).maxHeight) || 200;
                }
            }
            
            // Guardar altura máxima inicial de la card de comentarios
            const comentariosCard = card.querySelector('.contab-card-comentarios');
            if (comentariosCard) {
                initialComentariosMaxHeight = parseInt(window.getComputedStyle(comentariosCard).maxHeight) || 200;
            }
        }
    };
    
    saveInitialValues();
    
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = card.offsetHeight;
        saveInitialValues();
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    const handleMouseMove = (e) => {
        if (!isResizing) return;
        
        const deltaY = e.clientY - startY;
        const newHeight = startHeight + deltaY;
        
        if (newHeight >= minHeight) {
            card.style.height = `${newHeight}px`;
            
            // Calcular el incremento de altura
            const heightIncrease = newHeight - minHeight;
            
            // Ajustar altura de las cards internas que tienen scroll
            const articulosCard = card.querySelector('.contab-card-articulos');
            if (articulosCard) {
                const articulosList = articulosCard.querySelector('.pedido-items-list-compact');
                if (articulosList) {
                    // Aumentar la altura máxima de la lista de artículos proporcionalmente
                    const newMaxHeight = initialArticulosMaxHeight + heightIncrease;
                    articulosList.style.maxHeight = `${newMaxHeight}px`;
                }
                
                // También ajustar la altura máxima de la card de artículos
                const newCardMaxHeight = 200 + heightIncrease;
                articulosCard.style.maxHeight = `${newCardMaxHeight}px`;
            }
            
            // Ajustar altura de la card de comentarios
            const comentariosCard = card.querySelector('.contab-card-comentarios');
            if (comentariosCard) {
                // Aumentar la altura máxima de la card de comentarios igual que artículos
                const newComentariosCardMaxHeight = initialComentariosMaxHeight + heightIncrease;
                comentariosCard.style.maxHeight = `${newComentariosCardMaxHeight}px`;
                
                // Ajustar también la lista de comentarios si existe
                const comentariosList = comentariosCard.querySelector('.pedido-notas-list-compact-scroll');
                if (comentariosList) {
                    const currentListMaxHeight = parseInt(window.getComputedStyle(comentariosList).maxHeight) || 250;
                    const newComentariosListMaxHeight = currentListMaxHeight + heightIncrease;
                    comentariosList.style.maxHeight = `${newComentariosListMaxHeight}px`;
                }
            }
        }
    };
    
    const handleMouseUp = () => {
        isResizing = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
}

// Función auxiliar para toggle de secciones (debe estar disponible globalmente)
window.togglePedidoSection = function(sectionId, button) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const isOpen = section.style.display !== 'none';
    section.style.display = isOpen ? 'none' : 'block';
    
    const toggleText = button.querySelector('.toggle-text');
    const chevron = button.querySelector('.chevron');
    
    if (isOpen) {
        toggleText.textContent = button.dataset.closeLabel || 'Ver';
        chevron.textContent = '▼';
    } else {
        toggleText.textContent = button.dataset.openLabel || 'Ocultar';
        chevron.textContent = '▲';
    }
};

// Función para renderizar notas de pedido especial en admin
function renderPedidoNotasUIAdmin(pedidoId, notasToShow = [], allNotas = [], listElement, countElement, hasMore = false) {
    if (countElement) {
        const total = allNotas.length > 0 ? allNotas.length : notasToShow.length;
        countElement.textContent = `(${total})`;
    }
    if (!listElement) return;
    listElement.innerHTML = '';
    
    const notas = notasToShow.length > 0 ? notasToShow : allNotas;
    
    if (!Array.isArray(notas) || notas.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'cascade-empty';
        empty.textContent = 'No hay comentarios registrados';
        listElement.appendChild(empty);
        return;
    }
    const sorted = [...notas].sort((a, b) => {
        const fechaA = new Date(a.timestamp || 0).getTime();
        const fechaB = new Date(b.timestamp || 0).getTime();
        return fechaB - fechaA;
    });
    sorted.forEach((nota) => {
        const entry = document.createElement('div');
        entry.className = 'pedido-nota-entry-compact';
        const meta = document.createElement('div');
        meta.className = 'nota-meta-compact';

        const left = document.createElement('div');
        const nombre = document.createElement('strong');
        nombre.textContent = nota?.usuarioNombre || 'Usuario';
        left.appendChild(nombre);
        if (nota?.usuarioTipo) {
            const rol = document.createElement('span');
            rol.className = 'nota-rol-compact';
            rol.textContent = ` (${nota.usuarioTipo})`;
            left.appendChild(rol);
        }
        
        const fecha = document.createElement('span');
        fecha.className = 'nota-fecha-compact';
        fecha.textContent = formatDateTime(new Date(nota.timestamp || Date.now()));

        meta.appendChild(left);
        meta.appendChild(fecha);

        const body = document.createElement('p');
        body.className = 'nota-mensaje-compact';
        body.textContent = nota.mensaje || '';

        entry.appendChild(meta);
        entry.appendChild(body);
        listElement.appendChild(entry);
    });
}

// Función para mostrar/ocultar comentarios
window.toggleVerComentarios = async function(pedidoId, notasListId) {
    const wrapper = document.getElementById(`comentarios-wrapper-${pedidoId}`);
    const listElement = document.getElementById(notasListId);
    const btnVer = document.getElementById(`btn-ver-comentarios-${pedidoId}`);
    
    if (!wrapper || !listElement) return;
    
    const isVisible = wrapper.style.display === 'flex' || (wrapper.style.display !== 'none' && wrapper.offsetHeight > 0);
    
    if (isVisible) {
        // Ocultar comentarios
        wrapper.style.display = 'none';
        if (btnVer) btnVer.textContent = 'Ver Comentarios';
    } else {
        // Mostrar comentarios - cargar desde la base de datos
        try {
            const pedido = await db.get('pedidosEspeciales', pedidoId);
            if (!pedido) return;
            
            let notasArray = [];
            if (Array.isArray(pedido.notas)) {
                notasArray = pedido.notas;
            } else if (pedido.notas && typeof pedido.notas === 'string') {
                notasArray = [{
                    id: 'nota-original',
                    usuarioId: pedido.userId || null,
                    usuarioNombre: pedido.persona || 'Usuario',
                    usuarioTipo: 'Administrador',
                    mensaje: pedido.notas,
                    timestamp: pedido.fechaCreacion || new Date().toISOString()
                }];
            }
            
            const card = wrapper.closest('.contab-card-comentarios');
            const countElement = card?.querySelector('.comentarios-count');
            
            // Renderizar todos los comentarios (más recientes primero)
            renderPedidoNotasUIAdmin(pedidoId, notasArray, notasArray, listElement, countElement, false);
            
            wrapper.style.display = 'flex';
            if (btnVer) btnVer.textContent = 'Ocultar Comentarios';
            
            // Scroll al inicio (comentario más reciente está arriba)
            if (listElement) {
                listElement.scrollTop = 0;
            }
        } catch (error) {
            console.error('Error al cargar comentarios:', error);
        }
    }
};

// Función para guardar nota de pedido especial
window.guardarNotaPedidoEspecial = async function(pedidoId, inputId, listId, countId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const mensaje = input.value.trim();
    if (!mensaje) {
        await showAlert('Por favor, escribe un comentario antes de guardar', 'Atención');
        return;
    }
    if (!currentUser) {
        await showAlert('Debes iniciar sesión para añadir comentarios', 'Error');
        return;
    }
    try {
        const pedido = await db.get('pedidosEspeciales', pedidoId);
        if (!pedido) {
            await showAlert('No se pudo encontrar el pedido', 'Error');
            return;
        }
        const notas = Array.isArray(pedido.notas) ? [...pedido.notas] : [];
        notas.push({
            id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            usuarioId: currentUser.id || null,
            usuarioNombre: currentUser.username || currentUser.nombre || 'Usuario',
            usuarioTipo: currentUserType || currentUser?.tipo || 'Administrador',
            mensaje,
            timestamp: new Date().toISOString()
        });
        await db.update('pedidosEspeciales', { id: pedidoId, notas });
        input.value = '';
        
        // Solo actualizar el contador, no mostrar los comentarios
        const card = input.closest('.contab-card-comentarios');
        const countEl = card?.querySelector('.comentarios-count');
        if (countEl) {
            countEl.textContent = `(${notas.length})`;
        }
        
        await showAlert('Comentario guardado correctamente', 'Éxito');
    } catch (error) {
        console.error('Error al guardar nota:', error);
        await showAlert('No se pudo guardar la nota: ' + error.message, 'Error');
    }
};

// Función para duplicar artículo en pedido
window.duplicarArticuloPedido = async function(pedidoId, articuloIndex) {
    try {
        const pedido = await db.get('pedidosEspeciales', pedidoId);
        if (!pedido) {
            await showAlert('No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        const articulos = Array.isArray(pedido.articulos) ? [...pedido.articulos] : [];
        if (articuloIndex < 0 || articuloIndex >= articulos.length) {
            await showAlert('Artículo no encontrado', 'Error');
            return;
        }
        
        const articuloOriginal = articulos[articuloIndex];
        const articuloDuplicado = {
            ...articuloOriginal,
            id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };
        
        articulos.push(articuloDuplicado);
        await db.update('pedidosEspeciales', { id: pedidoId, articulos });
        
        // Recargar la card
        await recargarCardPedidoEspecial(pedidoId);
    } catch (error) {
        console.error('Error al duplicar artículo:', error);
        await showAlert('No se pudo duplicar el artículo: ' + error.message, 'Error');
    }
};

// Función para editar cantidad de artículo
window.editarCantidadArticuloPedido = async function(pedidoId, articuloIndex, cantidadActual) {
    try {
        const nuevaCantidad = await showPrompt(
            `Cantidad actual: ${cantidadActual}`,
            cantidadActual.toString(),
            'Editar cantidad'
        );
        
        if (nuevaCantidad === null || nuevaCantidad === '') return;
        
        const cantidad = parseInt(nuevaCantidad);
        if (isNaN(cantidad) || cantidad < 1) {
            await showAlert('La cantidad debe ser un número mayor a 0', 'Error');
            return;
        }
        
        const pedido = await db.get('pedidosEspeciales', pedidoId);
        if (!pedido) {
            await showAlert('No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        const articulos = Array.isArray(pedido.articulos) ? [...pedido.articulos] : [];
        if (articuloIndex < 0 || articuloIndex >= articulos.length) {
            await showAlert('Artículo no encontrado', 'Error');
            return;
        }
        
        articulos[articuloIndex].cantidad = cantidad;
        await db.update('pedidosEspeciales', { id: pedidoId, articulos });
        
        // Recargar la card
        await recargarCardPedidoEspecial(pedidoId);
    } catch (error) {
        console.error('Error al editar cantidad:', error);
        await showAlert('No se pudo editar la cantidad: ' + error.message, 'Error');
    }
};

// Función para eliminar artículo del pedido
window.eliminarArticuloPedido = async function(pedidoId, articuloIndex) {
    try {
        const confirmar = await showConfirm(
            '¿Estás seguro de que quieres eliminar este artículo del pedido?',
            'Eliminar artículo'
        );
        
        if (!confirmar) return;
        
        const pedido = await db.get('pedidosEspeciales', pedidoId);
        if (!pedido) {
            await showAlert('No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        const articulos = Array.isArray(pedido.articulos) ? [...pedido.articulos] : [];
        if (articuloIndex < 0 || articuloIndex >= articulos.length) {
            await showAlert('Artículo no encontrado', 'Error');
            return;
        }
        
        articulos.splice(articuloIndex, 1);
        await db.update('pedidosEspeciales', { id: pedidoId, articulos });
        
        // Recargar la card
        await recargarCardPedidoEspecial(pedidoId);
    } catch (error) {
        console.error('Error al eliminar artículo:', error);
        await showAlert('No se pudo eliminar el artículo: ' + error.message, 'Error');
    }
};

// Función auxiliar para recargar card de pedido especial
async function recargarCardPedidoEspecial(pedidoId) {
    try {
        const pedido = await db.get('pedidosEspeciales', pedidoId);
        if (!pedido) return;
        
        // Buscar la card actual por el código del pedido
        const cards = document.querySelectorAll('.contab-pedido-card');
        for (const card of cards) {
            const codeElement = card.querySelector('.pedido-code');
            if (codeElement && codeElement.textContent.includes(pedidoId)) {
                const nuevaCard = await createPedidoEspecialAdminCard(pedido);
                card.replaceWith(nuevaCard);
                return;
            }
        }
    } catch (error) {
        console.error('Error al recargar card:', error);
    }
}

// Función para cambiar el estado del pedido especial
// Función para asignar tienda a pedido especial
window.asignarTiendaPedidoEspecial = async function(pedidoId, tiendaId) {
    try {
        const pedidoEspecial = await db.get('pedidosEspeciales', pedidoId);
        if (!pedidoEspecial) {
            await showAlert('Pedido no encontrado', 'Error');
            return;
        }
        
        // Validar que se haya seleccionado una tienda
        if (!tiendaId || tiendaId.trim() === '') {
            await showAlert('Debe seleccionar una tienda para convertir el pedido especial en pedido normal', 'Atención');
            return;
        }
        
        // Si ya tiene tienda asignada, no permitir cambiar
        if (pedidoEspecial.tiendaId) {
            await showAlert('Este pedido ya ha sido asignado a una tienda y convertido en pedido normal. No se puede desasignar.', 'Atención');
            // Recargar para mantener el estado
            await loadPedidosEspecialesAdmin();
            return;
        }
        
        // Convertir articulos a items
        const items = Array.isArray(pedidoEspecial.articulos) ? pedidoEspecial.articulos.map(articulo => ({
            nombre: articulo.nombre || '',
            designacion: articulo.descripcion || articulo.nombre || '',
            cantidad: Number(articulo.cantidad) || 0,
            precio: Number(articulo.precio) || 0,
            foto: articulo.foto || null,
            ean: null,
            referencia: null
        })) : [];
        
        // Crear pedido normal con la estructura correcta
        const pedidoNormal = {
            tiendaId: tiendaId,
            userId: pedidoEspecial.userId || null,
            usuarioNombre: pedidoEspecial.persona || null,
            persona: pedidoEspecial.persona || 'Sin especificar',
            obraId: pedidoEspecial.obraId || null,
            obraNombreComercial: pedidoEspecial.obraNombre || null,
            obraDireccionGoogleMaps: null,
            obraEncargado: null,
            obraTelefono: null,
            items: items,
            estado: pedidoEspecial.estado || 'Nuevo',
            estadoPago: 'Sin Asignar',
            estadoLogistico: 'Nuevo',
            fecha: pedidoEspecial.fechaCreacion ? new Date(pedidoEspecial.fechaCreacion) : new Date(),
            fechaCreacion: pedidoEspecial.fechaCreacion || new Date().toISOString(),
            notas: Array.isArray(pedidoEspecial.notas) ? pedidoEspecial.notas : [],
            precioReal: null,
            pedidoSistemaPDF: null,
            transferenciaPDF: null,
            albaran: null
        };
        
        // Crear el pedido normal en la colección 'pedidos'
        await db.add('pedidos', pedidoNormal);
        
        // Eliminar el pedido especial
        await db.delete('pedidosEspeciales', pedidoId);
        
        await showAlert('Pedido especial convertido en pedido normal y asignado a la tienda correctamente', 'Éxito');
        
        // Recargar la vista de pedidos especiales (el pedido ya no aparecerá)
        await loadPedidosEspecialesAdmin();
    } catch (error) {
        console.error('Error al asignar tienda:', error);
        await showAlert('Error al asignar tienda: ' + error.message, 'Error');
    }
};

// Función para eliminar pedido especial
window.eliminarPedidoEspecial = async function(pedidoId) {
    const confirmar = await showConfirm('¿Está seguro de eliminar este pedido especial? Esta acción no se puede deshacer.', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        await db.delete('pedidosEspeciales', pedidoId);
        await showAlert('Pedido eliminado correctamente', 'Éxito');
        await loadPedidosEspecialesAdmin();
    } catch (error) {
        console.error('Error al eliminar pedido:', error);
        await showAlert('Error al eliminar pedido: ' + error.message, 'Error');
    }
};

// Función para adjuntar documento de pago desde la card
window.adjuntarDocumentoPedidoEspecial = function(pedidoId, inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.click();
    }
};

// Función para manejar el cambio de documento desde la card
window.handleDocumentoPedidoEspecialChange = async function(pedidoId, input) {
    const file = input.files[0];
    if (!file) return;
    
    // Validar tipo de archivo
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        await showAlert('Tipo de archivo no permitido. Solo se permiten PDF, PNG, JPG', 'Error');
        input.value = '';
        return;
    }
    
    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
        await showAlert('El archivo es demasiado grande. Máximo 10MB', 'Error');
        input.value = '';
        return;
    }
    
    try {
        // Convertir a base64
        const documentoBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsDataURL(file);
        });
        
        // Actualizar pedido
        const pedido = await db.get('pedidosEspeciales', pedidoId);
        if (!pedido) {
            await showAlert('Pedido no encontrado', 'Error');
            return;
        }
        
        pedido.documento = documentoBase64;
        pedido.documentoNombre = file.name;
        await db.update('pedidosEspeciales', pedido);
        
        await showAlert('Documento adjuntado correctamente', 'Éxito');
        await loadPedidosEspecialesAdmin();
    } catch (error) {
        console.error('Error al adjuntar documento:', error);
        await showAlert('Error al adjuntar documento: ' + error.message, 'Error');
    }
};

// Función para editar documento de pago
window.editarDocumentoPedidoEspecial = function(pedidoId) {
    const inputId = `pedido-documento-file-${pedidoId}`;
    let input = document.getElementById(inputId);
    
    // Si no existe el input, crearlo temporalmente
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = inputId;
        input.accept = 'application/pdf,image/png,image/jpeg,image/jpg';
        input.style.display = 'none';
        input.onchange = () => handleDocumentoPedidoEspecialChange(pedidoId, input);
        document.body.appendChild(input);
    }
    
    input.click();
};

// Función para cambiar estado de pago
window.cambiarEstadoPagoPedidoEspecial = async function(pedidoId, nuevoEstadoPago) {
    try {
        const pedido = await db.get('pedidosEspeciales', pedidoId);
        if (!pedido) {
            await showAlert('Pedido no encontrado', 'Error');
            return;
        }
        
        pedido.estadoPago = nuevoEstadoPago;
        await db.update('pedidosEspeciales', pedido);
        
        // Recargar la vista
        await loadPedidosEspecialesAdmin();
    } catch (error) {
        console.error('Error al cambiar estado de pago:', error);
        await showAlert('Error al cambiar estado de pago: ' + error.message, 'Error');
    }
};

// Función para eliminar documento de pago
// Función para ver documento de pedido especial
window.verDocumentoPedidoEspecial = async function(pedidoId) {
    try {
        const pedido = await db.get('pedidosEspeciales', pedidoId);
        if (!pedido || !pedido.documento) {
            await showAlert('No se encontró el documento', 'Error');
            return;
        }
        
        const nombreArchivo = pedido.documentoNombre || 'documento.pdf';
        descargarDocumento(pedido.documento, nombreArchivo);
    } catch (error) {
        console.error('Error al abrir documento:', error);
        await showAlert('Error al abrir el documento: ' + error.message, 'Error');
    }
};

window.eliminarDocumentoPedidoEspecial = async function(pedidoId) {
    const confirmar = await showConfirm('¿Desea eliminar el documento de pago adjunto?', 'Eliminar documento');
    if (!confirmar) return;
    
    try {
        const pedido = await db.get('pedidosEspeciales', pedidoId);
        if (!pedido) {
            await showAlert('Pedido no encontrado', 'Error');
            return;
        }
        
        pedido.documento = null;
        pedido.documentoNombre = null;
        await db.update('pedidosEspeciales', pedido);
        
        await showAlert('Documento eliminado correctamente', 'Éxito');
        await loadPedidosEspecialesAdmin();
    } catch (error) {
        console.error('Error al eliminar documento:', error);
        await showAlert('Error al eliminar documento: ' + error.message, 'Error');
    }
};

// Función para generar un nuevo pedido desde un artículo
window.generarPedidoDesdeArticulo = async function(pedidoId, articuloIndex) {
    try {
        const pedidoOriginal = await db.get('pedidosEspeciales', pedidoId);
        if (!pedidoOriginal || !pedidoOriginal.articulos || articuloIndex >= pedidoOriginal.articulos.length) {
            await showAlert('No se pudo encontrar el artículo', 'Error');
            return;
        }
        
        const articulo = pedidoOriginal.articulos[articuloIndex];
        
        // Crear nuevo pedido con los mismos datos pero solo con este artículo
        const nuevoPedido = {
            proveedorNombre: pedidoOriginal.proveedorNombre || 'Pedido desde artículo',
            articulos: [{
                nombre: articulo.nombre,
                cantidad: articulo.cantidad || 1,
                precio: articulo.precio || 0,
                foto: articulo.foto || null,
                descripcion: articulo.descripcion || null
            }],
            obraId: pedidoOriginal.obraId || null,
            obraNombre: pedidoOriginal.obraNombre || null,
            notas: [],
            documento: null,
            documentoNombre: null,
            userId: currentUser.id,
            persona: currentUser.username,
            fechaCreacion: new Date().toISOString(),
            estado: 'Nuevo',
            tiendaId: pedidoOriginal.tiendaId || null
        };
        
        // Validar que tenga obra
        if (!nuevoPedido.obraId) {
            await showAlert('El pedido original no tiene obra asignada. Debe asignar una obra antes de crear el nuevo pedido.', 'Error');
            return;
        }
        
        const nuevoId = await db.add('pedidosEspeciales', nuevoPedido);
        await showAlert('Nuevo pedido creado correctamente', 'Éxito');
        
        // Recargar la vista
        await loadPedidosEspecialesAdmin();
        
        // Opcional: abrir el modal de edición del nuevo pedido
        setTimeout(() => {
            editarPedidoEspecial(nuevoId);
        }, 500);
    } catch (error) {
        console.error('Error al generar pedido desde artículo:', error);
        await showAlert('Error al generar pedido: ' + error.message, 'Error');
    }
};

window.cambiarEstadoPedidoEspecial = async function(pedidoId, nuevoEstado) {
    try {
        const pedido = await db.get('pedidosEspeciales', pedidoId);
        if (!pedido) {
            await showAlert('No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        // Si el estado actual es "En Espera", guardar el estado anterior
        // Si el nuevo estado es "En Espera", guardar el estado actual como estadoAnterior
        if (nuevoEstado === 'En Espera') {
            // Guardar el estado actual como estadoAnterior para poder volver
            if (pedido.estado !== 'En Espera') {
                pedido.estadoAnterior = pedido.estado;
            }
            pedido.estado = 'En Espera';
        } else {
            // Si estaba en "En Espera" y cambia a otro estado, usar estadoAnterior si existe
            if (pedido.estado === 'En Espera' && pedido.estadoAnterior) {
                // El nuevo estado reemplaza al estadoAnterior
                pedido.estadoAnterior = null;
            }
            pedido.estado = nuevoEstado;
        }
        
        await db.update('pedidosEspeciales', pedido);
        
        // Si el nuevo estado es "En Espera", no cambiar de pestaña, solo actualizar la vista actual
        if (nuevoEstado === 'En Espera') {
            // Recargar solo la pestaña actual
            const activeTab = document.querySelector('#view-admin-pedidos-especiales .tab-btn.active');
            if (activeTab) {
                switchTabPedidosEspeciales(activeTab.dataset.tab);
            }
        } else {
            // Para otros estados, recargar todas las tabs para que la card se mueva a la correcta
            const activeTab = document.querySelector('#view-admin-pedidos-especiales .tab-btn.active');
            if (activeTab) {
                switchTabPedidosEspeciales(activeTab.dataset.tab);
            }
            
            // También recargar las otras tabs en segundo plano para que se actualicen
            setTimeout(() => {
                loadNuevoEspeciales();
                loadGestionandoEspeciales();
                loadSinTransporteEspeciales();
                loadConTransporteEspeciales();
                loadOnlineEspeciales();
                loadCerradosEspeciales();
            }, 100);
        }
        
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        await showAlert('No se pudo cambiar el estado: ' + error.message, 'Error');
    }
};

async function loadUsuarios(tipo) {
    const usuarios = await db.getUsuariosByTipo(tipo);
    const container = document.getElementById('usuarios-list');
    const emptyState = document.getElementById('usuarios-empty');

    if (!container) return;

    if (usuarios.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = '';

    // Crear cards de forma asíncrona para obtener información de tiendas
    for (const usuario of usuarios) {
        const card = await createUsuarioCard(usuario);
        container.appendChild(card);
    }
}

async function createUsuarioCard(usuario) {
    const card = document.createElement('div');
    card.className = 'usuario-card';
    
    // Obtener nombre de tienda si tiene tiendaId
    let tiendaNombre = '';
    if (usuario.tiendaId) {
        try {
            const tienda = await db.get('tiendas', usuario.tiendaId);
            if (tienda) {
                tiendaNombre = tienda.nombre;
            }
        } catch (error) {
            console.error('Error al obtener tienda:', error);
        }
    }
    
    // Obtener nombres de obras asignadas si es Técnico o Encargado
    let obrasAsignadasHtml = '';
    if ((usuario.tipo === 'Técnico' || usuario.tipo === 'Encargado') && usuario.obrasAsignadas && usuario.obrasAsignadas.length > 0) {
        const obrasNombres = [];
        for (const obraId of usuario.obrasAsignadas) {
            try {
                const obra = await db.get('obras', obraId);
                if (obra) {
                    obrasNombres.push(obra.nombreComercial || obra.nombre || 'Sin nombre');
                }
            } catch (error) {
                console.error('Error al obtener obra:', error);
            }
        }
        if (obrasNombres.length > 0) {
            obrasAsignadasHtml = `
            <div class="usuario-detail-item">
                <strong>Obras Asignadas:</strong>
                <span class="detail-value" style="display: block; margin-top: 0.25rem;">
                    ${obrasNombres.map(nombre => `<span style="display: inline-block; background: var(--primary-color-light); color: var(--primary-color); padding: 0.25rem 0.5rem; border-radius: 4px; margin: 0.125rem; font-size: 0.875rem;">${escapeHtml(nombre)}</span>`).join('')}
                </span>
            </div>
            `;
        }
    }
    
    // Badge de tipo con clase CSS
    const tipoLower = (usuario.tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tipoClass = tipoLower.replace(/\s+/g, '-');
    
    card.innerHTML = `
        <div class="usuario-card-header">
            <div class="usuario-info">
                <h4>${escapeHtml(usuario.username || 'Sin nombre')}</h4>
                <span class="usuario-tipo-badge ${tipoClass}">${escapeHtml(usuario.tipo || 'Sin tipo')}</span>
            </div>
        </div>
        <div class="usuario-details">
            <div class="usuario-detail-item">
                <strong>Usuario:</strong>
                <span class="detail-value">${escapeHtml(usuario.username || 'N/A')}</span>
            </div>
            <div class="usuario-detail-item">
                <strong>Tipo:</strong>
                <span class="detail-value">${escapeHtml(usuario.tipo || 'N/A')}</span>
            </div>
            ${usuario.tiendaId && tiendaNombre ? `
            <div class="usuario-detail-item">
                <strong>Tienda:</strong>
                <span class="detail-value">${escapeHtml(tiendaNombre)}</span>
            </div>
            ` : ''}
            ${obrasAsignadasHtml}
            ${usuario.password ? `
            <div class="usuario-detail-item">
                <strong>Contraseña:</strong>
                <span class="detail-value">${escapeHtml(usuario.password)}</span>
            </div>
            ` : ''}
            ${usuario.id ? `
            <div class="usuario-detail-item">
                <strong>ID:</strong>
                <span class="detail-value" style="font-size: 0.75rem; color: var(--text-secondary);">${escapeHtml(usuario.id)}</span>
            </div>
            ` : ''}
        </div>
        <div class="usuario-actions">
            <button class="btn-icon" onclick="editarUsuario('${usuario.id}')" title="Editar" aria-label="Editar usuario">✏️</button>
            <button class="btn-icon danger" onclick="eliminarUsuario('${usuario.id}')" title="Eliminar" aria-label="Eliminar usuario">🗑️</button>
        </div>
    `;
    return card;
}

window.editarUsuario = async function(usuarioId) {
    const usuario = await db.get('usuarios', usuarioId);
    if (!usuario) return;

    editingUsuarioId = usuarioId;
    document.getElementById('modal-usuario-titulo').textContent = 'Editar Usuario';
    document.getElementById('modal-usuario-nombre').value = usuario.username || '';
    document.getElementById('modal-usuario-tipo').value = usuario.tipo || 'Técnico';
    document.getElementById('modal-usuario-password').value = '';
    
    if (usuario.tipo === 'Tienda') {
        document.getElementById('modal-usuario-tienda-group').style.display = 'block';
        document.getElementById('modal-usuario-obras-group').style.display = 'none';
        // Cargar tiendas disponibles, incluyendo la tienda actual del usuario
        await cargarTiendasDisponibles(usuario.tiendaId);
        obrasAsignadasUsuario = [];
    } else if (usuario.tipo === 'Técnico' || usuario.tipo === 'Encargado') {
        document.getElementById('modal-usuario-tienda-group').style.display = 'none';
        document.getElementById('modal-usuario-obras-group').style.display = 'block';
        // Cargar obras asignadas
        obrasAsignadasUsuario = usuario.obrasAsignadas || [];
        await renderizarObrasAsignadas();
        await cargarObrasDisponibles();
    } else {
        document.getElementById('modal-usuario-tienda-group').style.display = 'none';
        document.getElementById('modal-usuario-obras-group').style.display = 'none';
        obrasAsignadasUsuario = [];
    }

    document.getElementById('modal-usuario').classList.add('active');
};

window.eliminarUsuario = async function(usuarioId) {
    const confirmar = await showConfirm('¿Está seguro de eliminar este usuario?', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        await db.eliminarUsuario(usuarioId);
        const tipo = document.querySelector('#view-admin-usuarios .tab-btn.active')?.dataset.tab || 'tecnicos';
        const tipoMap = {
            'tecnicos': 'Técnico',
            'encargados': 'Encargado',
            'tiendas': 'Tienda',
            'contabilidad': 'Contabilidad'
        };
        loadUsuarios(tipoMap[tipo] || 'Técnico');
    } catch (error) {
        await showAlert('Error al eliminar usuario: ' + error.message, 'Error');
    }
};

async function loadObras() {
    const obras = await db.getAllObras();
    const container = document.getElementById('obras-list');
    const emptyState = document.getElementById('obras-empty');

    if (!container) return;

    if (obras.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = '';

    obras.forEach(obra => {
        const card = createObraCard(obra);
        container.appendChild(card);
    });
}

function createObraCard(obra) {
    const card = document.createElement('div');
    card.className = 'obra-card';
    
    // Construir enlace de ubicación
    let ubicacionLink = '';
    if (obra.direccionGoogleMaps) {
        const direccionUrl = escapeHtml(obra.direccionGoogleMaps);
        ubicacionLink = `<a href="${direccionUrl}" target="_blank" rel="noopener noreferrer">Ubicación</a>`;
    } else {
        ubicacionLink = '<span class="info-value">No especificada</span>';
    }
    
    card.innerHTML = `
        <div class="obra-header">
            <h4>${escapeHtml(obra.nombreComercial || obra.nombre || 'Sin nombre')}</h4>
        </div>
        <div class="obra-details">
            <div class="obra-info">
                <strong>Encargado:</strong>
                <span class="info-value">${escapeHtml(obra.encargado || 'No especificado')}</span>
            </div>
            <div class="obra-info">
                <strong>Teléfono:</strong>
                <span class="info-value">${escapeHtml(obra.telefonoEncargado || 'No especificado')}</span>
            </div>
            <div class="obra-direccion">
                <strong>Ubicación:</strong>
                ${ubicacionLink}
            </div>
            ${obra.id ? `
            <div class="obra-info">
                <strong>ID:</strong>
                <span class="info-value" style="font-size: 0.75rem; color: var(--text-secondary);">${escapeHtml(obra.id)}</span>
            </div>
            ` : ''}
        </div>
        <div class="obra-actions">
            <button class="btn-icon" onclick="editarObra('${obra.id}')" title="Editar" aria-label="Editar obra">✏️</button>
            <button class="btn-icon danger" onclick="eliminarObra('${obra.id}')" title="Eliminar" aria-label="Eliminar obra">🗑️</button>
        </div>
    `;
    return card;
}

window.editarObra = async function(obraId) {
    const obra = await db.get('obras', obraId);
    if (!obra) return;

    editingObraId = obraId;
    document.getElementById('modal-obra-titulo').textContent = 'Editar Obra';
    document.getElementById('modal-obra-nombre').value = obra.nombreComercial || obra.nombre || '';
    document.getElementById('modal-obra-direccion').value = obra.direccionGoogleMaps || '';
    document.getElementById('modal-obra-encargado').value = obra.encargado || '';
    document.getElementById('modal-obra-telefono').value = obra.telefonoEncargado || '';

    document.getElementById('modal-obra').classList.add('active');
};

window.eliminarObra = async function(obraId) {
    const confirmar = await showConfirm('¿Está seguro de eliminar esta obra?', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        await db.eliminarObra(obraId);
        loadObras();
    } catch (error) {
        await showAlert('Error al eliminar obra: ' + error.message, 'Error');
    }
};

async function loadTiendasAdmin() {
    const tiendas = await db.getAll('tiendas');
    const container = document.getElementById('tiendas-admin-list');
    const emptyState = document.getElementById('tiendas-admin-empty');

    if (!container) return;

    if (tiendas.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = '';

    tiendas.forEach(tienda => {
        const card = createTiendaAdminCard(tienda);
        container.appendChild(card);
    });
}

function createTiendaAdminCard(tienda) {
    const card = document.createElement('div');
    card.className = `tienda-admin-card ${tienda.activa !== false ? 'activa' : 'inactiva'}`;
    
    const logoHtml = tienda.logo 
        ? `<img src="${escapeHtml(tienda.logo)}" alt="${escapeHtml(tienda.nombre)}" class="tienda-admin-logo" onerror="this.style.display='none';">`
        : '';
    
    card.innerHTML = `
        <div class="tienda-admin-header">
            ${logoHtml}
            <h4>
                ${escapeHtml(tienda.nombre || 'Sin nombre')}
                <span class="tienda-admin-badge ${tienda.activa !== false ? 'activa' : 'inactiva'}">
                    ${tienda.activa !== false ? 'Activa' : 'Inactiva'}
                </span>
            </h4>
        </div>
        <div class="tienda-admin-details">
            ${tienda.sector ? `
            <div class="tienda-admin-info">
                <strong>Sector:</strong>
                <span class="info-value">${escapeHtml(tienda.sector)}</span>
            </div>
            ` : ''}
            ${tienda.ubicacion ? `
            <div class="tienda-admin-info">
                <strong>Ubicación:</strong>
                <span class="info-value">${escapeHtml(tienda.ubicacion)}</span>
            </div>
            ` : ''}
            ${tienda.web ? `
            <div class="tienda-admin-info">
                <strong>Web:</strong>
                <a href="${escapeHtml(tienda.web)}" target="_blank" rel="noopener noreferrer">Enlace Web</a>
            </div>
            ` : ''}
            ${tienda.tieneCuenta !== undefined ? `
            <div class="tienda-admin-info">
                <strong>Tiene cuenta:</strong>
                <span class="info-value">${tienda.tieneCuenta ? 'Sí' : 'No'}</span>
            </div>
            ` : ''}
            ${tienda.limiteCuenta ? `
            <div class="tienda-admin-info">
                <strong>Límite cuenta:</strong>
                <span class="info-value">${tienda.limiteCuenta}€</span>
            </div>
            ` : tienda.tieneCuenta && !tienda.limiteCuenta ? `
            <div class="tienda-admin-info">
                <strong>Límite cuenta:</strong>
                <span class="info-value">Sin límite</span>
            </div>
            ` : ''}
            ${tienda.contactos ? `
            <div class="tienda-admin-info">
                <strong>Contactos:</strong>
                <span class="info-value" style="white-space: pre-line; font-size: 0.875rem;">${escapeHtml(tienda.contactos)}</span>
            </div>
            ` : ''}
            ${tienda.notas ? `
            <div class="tienda-admin-info">
                <strong>Notas:</strong>
                <span class="info-value" style="white-space: pre-line; font-size: 0.875rem;">${escapeHtml(tienda.notas)}</span>
            </div>
            ` : ''}
            ${tienda.id ? `
            <div class="tienda-admin-info">
                <strong>ID:</strong>
                <span class="info-value" style="font-size: 0.75rem; color: var(--text-secondary);">${escapeHtml(tienda.id)}</span>
            </div>
            ` : ''}
        </div>
        <div class="tienda-admin-actions">
            <button class="btn-icon" onclick="subirArticulosTienda('${tienda.id}')" title="Subir artículos" aria-label="Subir base de datos de artículos">📂</button>
            <button class="btn-icon" onclick="editarTienda('${tienda.id}')" title="Editar" aria-label="Editar tienda">✏️</button>
            <button class="btn-icon danger" onclick="eliminarTienda('${tienda.id}')" title="Eliminar" aria-label="Eliminar tienda">🗑️</button>
        </div>
    `;
    return card;
}

// Variable global para almacenar el ID de la tienda actual al subir artículos
let tiendaIdSubirArticulos = null;
let archivoArticulos = null;

window.subirArticulosTienda = async function(tiendaId) {
    tiendaIdSubirArticulos = tiendaId;
    archivoArticulos = null;
    
    const tienda = await db.get('tiendas', tiendaId);
    if (!tienda) return;
    
    document.getElementById('modal-subir-articulos-titulo').textContent = `Subir Artículos - ${tienda.nombre}`;
    
    // Resetear el modal
    document.getElementById('modal-subir-articulos-file').value = '';
    document.getElementById('modal-subir-articulos-preview').style.display = 'none';
    document.getElementById('modal-subir-articulos-progress').style.display = 'none';
    document.getElementById('modal-subir-articulos-resultado').style.display = 'none';
    document.getElementById('btn-subir-articulos').disabled = true;
    
    // Mostrar modal
    document.getElementById('modal-subir-articulos').classList.add('active');
}

window.editarTienda = async function(tiendaId) {
    const tienda = await db.get('tiendas', tiendaId);
    if (!tienda) return;

    editingTiendaId = tiendaId;
    document.getElementById('modal-tienda-titulo').textContent = 'Editar Tienda';
    document.getElementById('modal-tienda-nombre').value = tienda.nombre || '';
    document.getElementById('modal-tienda-sector').value = tienda.sector || '';
    document.getElementById('modal-tienda-ubicacion').value = tienda.ubicacion || '';
    document.getElementById('modal-tienda-sin-web').checked = !tienda.web;
    document.getElementById('modal-tienda-web').value = tienda.web || '';
    
    // Configurar radio buttons de cuenta
    if (!tienda.tieneCuenta && !tienda.limiteCuenta) {
        document.getElementById('modal-tienda-no-cuenta').checked = true;
    } else if (tienda.tieneCuenta && !tienda.limiteCuenta) {
        document.getElementById('modal-tienda-sin-limite').checked = true;
    } else if (tienda.tieneCuenta && tienda.limiteCuenta) {
        document.getElementById('modal-tienda-tiene-cuenta').checked = true;
    } else {
        document.getElementById('modal-tienda-no-cuenta').checked = true;
    }
    document.getElementById('modal-tienda-limite').value = tienda.limiteCuenta || '';
    document.getElementById('modal-tienda-contactos').value = tienda.contactos || '';
    document.getElementById('modal-tienda-notas').value = tienda.notas || '';
    document.getElementById('modal-tienda-activa').checked = tienda.activa !== false;
    
    // Cargar logo si existe
    const logoPreview = document.getElementById('modal-tienda-logo-preview');
    const logoPreviewImg = document.getElementById('modal-tienda-logo-preview-img');
    if (tienda.logo) {
        logoPreviewImg.src = tienda.logo;
        logoPreview.style.display = 'block';
    } else {
        logoPreview.style.display = 'none';
    }
    document.getElementById('modal-tienda-logo-file').value = '';

    updateTiendaModalVisibility();
    document.getElementById('modal-tienda').classList.add('active');
};

window.eliminarTienda = async function(tiendaId) {
    const confirmar = await showConfirm('¿Está seguro de eliminar esta tienda?', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        await db.delete('tiendas', tiendaId);
        loadTiendasAdmin();
    } catch (error) {
        await showAlert('Error al eliminar tienda: ' + error.message, 'Error');
    }
};

function openModalTienda() {
    editingTiendaId = null;
    document.getElementById('modal-tienda-titulo').textContent = 'Nueva Tienda';
    document.getElementById('modal-tienda-nombre').value = '';
    document.getElementById('modal-tienda-sector').value = '';
    document.getElementById('modal-tienda-ubicacion').value = '';
    document.getElementById('modal-tienda-sin-web').checked = false;
    document.getElementById('modal-tienda-web').value = '';
    document.getElementById('modal-tienda-no-cuenta').checked = true;
    document.getElementById('modal-tienda-sin-limite').checked = false;
    document.getElementById('modal-tienda-tiene-cuenta').checked = false;
    document.getElementById('modal-tienda-limite').value = '';
    document.getElementById('modal-tienda-contactos').value = '';
    document.getElementById('modal-tienda-notas').value = '';
    document.getElementById('modal-tienda-activa').checked = true;
    
    // Limpiar logo
    document.getElementById('modal-tienda-logo-preview').style.display = 'none';
    document.getElementById('modal-tienda-logo-file').value = '';

    updateTiendaModalVisibility();
    document.getElementById('modal-tienda').classList.add('active');
}

function updateTiendaModalVisibility() {
    const sinWeb = document.getElementById('modal-tienda-sin-web').checked;
    const conLimite = document.getElementById('modal-tienda-tiene-cuenta').checked;
    
    document.getElementById('modal-tienda-web-group').style.display = sinWeb ? 'none' : 'block';
    document.getElementById('modal-tienda-limite-group').style.display = conLimite ? 'block' : 'none';
}

async function guardarTienda() {
    const nombre = document.getElementById('modal-tienda-nombre').value.trim();
    const sector = document.getElementById('modal-tienda-sector').value.trim();
    const ubicacion = document.getElementById('modal-tienda-ubicacion').value.trim();
    const sinWeb = document.getElementById('modal-tienda-sin-web').checked;
    const web = sinWeb ? '' : document.getElementById('modal-tienda-web').value.trim();
    const noCuenta = document.getElementById('modal-tienda-no-cuenta').checked;
    const sinLimite = document.getElementById('modal-tienda-sin-limite').checked;
    const conLimite = document.getElementById('modal-tienda-tiene-cuenta').checked;
    
    const tieneCuenta = sinLimite || conLimite;
    const limite = conLimite ? parseFloat(document.getElementById('modal-tienda-limite').value) : null;
    const contactos = document.getElementById('modal-tienda-contactos').value.trim();
    // Servicios se establece automáticamente basado en tieneCuenta para mantener compatibilidad
    const servicios = {
        cuenta: tieneCuenta,
        transporte: false,
        preparacion: false,
        baseDatos: false
    };
    const notas = document.getElementById('modal-tienda-notas').value.trim();
    const activa = document.getElementById('modal-tienda-activa').checked;
    const logoFileInput = document.getElementById('modal-tienda-logo-file');

    if (!nombre) {
        await showAlert('Por favor, ingrese un nombre para la tienda', 'Error');
        return;
    }

    try {
        let logo = null;
        
        if (logoFileInput.files.length > 0) {
            logo = await fileToBase64(logoFileInput.files[0]);
        } else if (editingTiendaId) {
            const tiendaExistente = await db.get('tiendas', editingTiendaId);
            logo = tiendaExistente?.logo || null;
        }

        const tiendaData = {
            nombre: nombre,
            sector: sector || null,
            ubicacion: ubicacion || null,
            web: web || null,
            tieneCuenta: tieneCuenta,
            limiteCuenta: limite || null,
            contactos: contactos || null,
            servicios: servicios,
            notas: notas || null,
            activa: activa,
            logo: logo
        };

        if (editingTiendaId) {
            tiendaData.id = editingTiendaId;
            await db.update('tiendas', tiendaData);
        } else {
            await db.add('tiendas', tiendaData);
        }

        closeAllModals();
        loadTiendasAdmin();
    } catch (error) {
        await showAlert('Error al guardar tienda: ' + error.message, 'Error');
    }
}

// Función para cargar tiendas disponibles (no enlazadas a usuarios)
async function cargarTiendasDisponibles(tiendaIdActual = null) {
    const selectTienda = document.getElementById('modal-usuario-tienda');
    if (!selectTienda) return;
    
    // Obtener todos los usuarios de tipo Tienda
    const usuariosTienda = await db.getUsuariosByTipo('Tienda');
    const tiendasEnlazadas = new Set(usuariosTienda
        .filter(u => u.tiendaId && u.id !== editingUsuarioId) // Excluir el usuario actual si se está editando
        .map(u => u.tiendaId));
    
    // Obtener todas las tiendas
    const todasLasTiendas = await db.getAll('tiendas');
    
    // Filtrar tiendas disponibles (no enlazadas o la tienda actual si se está editando)
    const tiendasDisponibles = todasLasTiendas.filter(tienda => 
        !tiendasEnlazadas.has(tienda.id) || tienda.id === tiendaIdActual
    );
    
    selectTienda.innerHTML = '<option value="">Seleccione una tienda</option>';
    tiendasDisponibles.forEach(tienda => {
        const option = document.createElement('option');
        option.value = tienda.id;
        option.textContent = tienda.nombre;
        if (tienda.id === tiendaIdActual) {
            option.selected = true;
        }
        selectTienda.appendChild(option);
    });
}

// Función para cargar obras disponibles
async function cargarObrasDisponibles() {
    const selectObra = document.getElementById('modal-usuario-obras-select');
    if (!selectObra) return;
    
    const todasLasObras = await db.getAllObras();
    
    selectObra.innerHTML = '<option value="">Seleccione una obra para agregar</option>';
    todasLasObras.forEach(obra => {
        // Solo mostrar obras que no estén ya asignadas
        if (!obrasAsignadasUsuario.includes(obra.id)) {
            const option = document.createElement('option');
            option.value = obra.id;
            option.textContent = obra.nombreComercial || obra.nombre;
            selectObra.appendChild(option);
        }
    });
}

// Función para renderizar la lista de obras asignadas
async function renderizarObrasAsignadas() {
    const obrasList = document.getElementById('modal-usuario-obras-list');
    if (!obrasList) return;
    
    if (obrasAsignadasUsuario.length === 0) {
        obrasList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0;">No hay obras asignadas</p>';
        return;
    }
    
    obrasList.innerHTML = '';
    
    for (const obraId of obrasAsignadasUsuario) {
        try {
            const obra = await db.get('obras', obraId);
            if (obra) {
                const obraItem = document.createElement('div');
                obraItem.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: var(--card-bg); border-radius: 4px; margin-bottom: 0.5rem; border: 1px solid var(--border-color);';
                obraItem.innerHTML = `
                    <span>${escapeHtml(obra.nombreComercial || obra.nombre || 'Sin nombre')}</span>
                    <button type="button" class="btn-icon danger" onclick="eliminarObraDeUsuario('${obraId}')" title="Eliminar">✕</button>
                `;
                obrasList.appendChild(obraItem);
            }
        } catch (error) {
            console.error('Error al cargar obra:', error);
        }
    }
}

// Función para agregar obra al usuario
window.agregarObraAUsuario = async function() {
    const selectObra = document.getElementById('modal-usuario-obras-select');
    if (!selectObra || !selectObra.value) return;
    
    const obraId = selectObra.value;
    
    if (obrasAsignadasUsuario.includes(obraId)) {
        await showAlert('Esta obra ya está asignada', 'Error');
        return;
    }
    
    obrasAsignadasUsuario.push(obraId);
    selectObra.value = '';
    
    await renderizarObrasAsignadas();
    await cargarObrasDisponibles();
}

// Función para eliminar obra del usuario
window.eliminarObraDeUsuario = async function(obraId) {
    obrasAsignadasUsuario = obrasAsignadasUsuario.filter(id => id !== obraId);
    await renderizarObrasAsignadas();
    await cargarObrasDisponibles();
}

function openModalUsuario() {
    editingUsuarioId = null;
    obrasAsignadasUsuario = [];
    document.getElementById('modal-usuario-titulo').textContent = 'Nuevo Usuario';
    document.getElementById('modal-usuario-nombre').value = '';
    document.getElementById('modal-usuario-tipo').value = 'Técnico';
    document.getElementById('modal-usuario-password').value = '';
    document.getElementById('modal-usuario-tienda-group').style.display = 'none';
    document.getElementById('modal-usuario-obras-group').style.display = 'block';
    
    renderizarObrasAsignadas();
    cargarObrasDisponibles();

    document.getElementById('modal-usuario').classList.add('active');
}

async function guardarUsuario() {
    const nombre = document.getElementById('modal-usuario-nombre').value.trim();
    const tipo = document.getElementById('modal-usuario-tipo').value;
    const password = document.getElementById('modal-usuario-password').value;
    const tiendaId = document.getElementById('modal-usuario-tienda').value;

    if (!nombre) {
        await showAlert('Por favor, ingrese un nombre de usuario', 'Error');
        return;
    }

    if (!password || password.length !== 4 || !/^\d{4}$/.test(password)) {
        await showAlert('Por favor, ingrese una contraseña de 4 dígitos', 'Error');
        return;
    }

    if (tipo === 'Tienda' && !tiendaId) {
        await showAlert('Por favor, seleccione una tienda', 'Error');
        return;
    }

    try {
        const usuarioData = {
            username: nombre,
            tipo: tipo,
            password: password
        };

        if (tipo === 'Tienda') {
            usuarioData.tiendaId = tiendaId;
        } else if (tipo === 'Técnico' || tipo === 'Encargado') {
            usuarioData.obrasAsignadas = obrasAsignadasUsuario;
        }

        if (editingUsuarioId) {
            usuarioData.id = editingUsuarioId;
            await db.actualizarUsuario(usuarioData);
        } else {
            await db.crearUsuario(usuarioData);
        }

        closeAllModals();
        const tipoTab = document.querySelector('#view-admin-usuarios .tab-btn.active')?.dataset.tab || 'tecnicos';
        const tipoMap = {
            'tecnicos': 'Técnico',
            'encargados': 'Encargado',
            'tiendas': 'Tienda',
            'contabilidad': 'Contabilidad'
        };
        loadUsuarios(tipoMap[tipoTab] || 'Técnico');
    } catch (error) {
        await showAlert('Error al guardar usuario: ' + error.message, 'Error');
    }
}

function openModalObra() {
    editingObraId = null;
    document.getElementById('modal-obra-titulo').textContent = 'Nueva Obra';
    document.getElementById('modal-obra-nombre').value = '';
    document.getElementById('modal-obra-direccion').value = '';
    document.getElementById('modal-obra-encargado').value = '';
    document.getElementById('modal-obra-telefono').value = '';

    document.getElementById('modal-obra').classList.add('active');
}

async function guardarObra() {
    const nombre = document.getElementById('modal-obra-nombre').value.trim();
    const direccion = document.getElementById('modal-obra-direccion').value.trim();
    const encargado = document.getElementById('modal-obra-encargado').value.trim();
    const telefono = document.getElementById('modal-obra-telefono').value.trim();

    if (!nombre) {
        await showAlert('Por favor, ingrese un nombre comercial', 'Error');
        return;
    }

    try {
        const obraData = {
            nombreComercial: nombre,
            direccionGoogleMaps: direccion,
            encargado: encargado,
            telefonoEncargado: telefono
        };

        if (editingObraId) {
            obraData.id = editingObraId;
            await db.actualizarObra(obraData);
        } else {
            await db.crearObra(obraData);
        }

        closeAllModals();
        loadObras();
    } catch (error) {
        await showAlert('Error al guardar obra: ' + error.message, 'Error');
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await db.init();
        await db.initDefaultData();
        
        // Cargar sesión
        const sesion = await db.getSesionCompleta();
        if (sesion && sesion.userId) {
            const usuario = await db.get('usuarios', sesion.userId);
            if (usuario && usuario.tipo === 'Administrador') {
                currentUser = usuario;
                currentUserType = 'Administrador';
                
                // Configurar event listeners
                setupAdminEventListeners();
                
                // Mostrar vista inicial
                showAdminView('admin-tienda');
            } else {
                // No es administrador, redirigir al login
                window.location.href = '../index.html';
            }
        } else {
            // No hay sesión, redirigir al login
            window.location.href = '../index.html';
        }
    } catch (error) {
        console.error('Error al inicializar:', error);
        window.location.href = '../index.html';
    }
});

// Función para manejar la selección del archivo de artículos
function handleFileSelectArticulos(file) {
    const validTypes = ['application/json', 'text/csv', 'text/plain'];
    const validExtensions = ['.json', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        showAlert('Por favor, seleccione un archivo JSON o CSV', 'Error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
        showAlert('El archivo es demasiado grande. Máximo 10MB', 'Error');
        return;
    }
    
    archivoArticulos = file;
    document.getElementById('modal-subir-articulos-nombre').textContent = file.name;
    document.getElementById('modal-subir-articulos-preview').style.display = 'block';
    document.getElementById('btn-subir-articulos').disabled = false;
}

// Función para procesar y subir los artículos
async function procesarYSubirArticulos(file, tiendaId) {
    const progressDiv = document.getElementById('modal-subir-articulos-progress');
    const progressBar = document.getElementById('modal-subir-articulos-progress-bar');
    const statusText = document.getElementById('modal-subir-articulos-status');
    const resultadoDiv = document.getElementById('modal-subir-articulos-resultado');
    const mensajeDiv = document.getElementById('modal-subir-articulos-mensaje');
    const btnSubir = document.getElementById('btn-subir-articulos');
    
    progressDiv.style.display = 'block';
    resultadoDiv.style.display = 'none';
    btnSubir.disabled = true;
    progressBar.style.width = '0%';
    statusText.textContent = 'Leyendo archivo...';
    
    try {
        // Leer el archivo
        const text = await file.text();
        let articulos = [];
        
        // Determinar si es JSON o CSV
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (fileExtension === '.json') {
            // Procesar JSON
            try {
                const data = JSON.parse(text);
                articulos = Array.isArray(data) ? data : [data];
            } catch (error) {
                throw new Error('El archivo JSON no es válido: ' + error.message);
            }
        } else if (fileExtension === '.csv') {
            // Procesar CSV
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                throw new Error('El archivo CSV debe tener al menos una fila de encabezado y una fila de datos');
            }
            
            // Parsear encabezados
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const nombreIndex = headers.findIndex(h => h.includes('nombre') || h.includes('name'));
            const descripcionIndex = headers.findIndex(h => h.includes('descripcion') || h.includes('description') || h.includes('desc'));
            const precioIndex = headers.findIndex(h => h.includes('precio') || h.includes('price'));
            const categoriaIndex = headers.findIndex(h => h.includes('categoria') || h.includes('category') || h.includes('cat'));
            
            if (nombreIndex === -1 || precioIndex === -1) {
                throw new Error('El CSV debe tener columnas "nombre" y "precio"');
            }
            
            // Procesar filas
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length < headers.length) continue;
                
                const nombre = values[nombreIndex];
                const precio = parseFloat(values[precioIndex]);
                
                if (!nombre || isNaN(precio)) continue;
                
                articulos.push({
                    nombre: nombre,
                    descripcion: descripcionIndex !== -1 ? values[descripcionIndex] : '',
                    precio: precio,
                    categoria: categoriaIndex !== -1 ? values[categoriaIndex] : ''
                });
            }
        }
        
        if (articulos.length === 0) {
            throw new Error('No se encontraron artículos válidos en el archivo');
        }
        
        statusText.textContent = `Procesando ${articulos.length} artículos...`;
        progressBar.style.width = '30%';
        
        // Obtener o crear categoría "General" para la tienda
        const categorias = await db.getAll('categorias');
        let categoriaGeneral = categorias.find(c => c.tiendaId === tiendaId && c.nombre === 'General');
        
        if (!categoriaGeneral) {
            categoriaGeneral = await db.add('categorias', {
                tiendaId: tiendaId,
                nombre: 'General'
            });
        }
        
        const categoriaGeneralId = categoriaGeneral.id || categoriaGeneral;
        
        progressBar.style.width = '50%';
        statusText.textContent = `Subiendo artículos a la base de datos...`;
        
        // Subir artículos
        let exitosos = 0;
        let errores = 0;
        
        for (let i = 0; i < articulos.length; i++) {
            const articulo = articulos[i];
            
            try {
                // Determinar la categoría
                let categoriaId = categoriaGeneralId;
                if (articulo.categoria) {
                    let categoria = categorias.find(c => 
                        c.tiendaId === tiendaId && 
                        c.nombre.toLowerCase() === articulo.categoria.toLowerCase()
                    );
                    
                    if (!categoria) {
                        categoria = await db.add('categorias', {
                            tiendaId: tiendaId,
                            nombre: articulo.categoria
                        });
                    }
                    
                    categoriaId = categoria.id || categoria;
                }
                
                // Crear el producto
                await db.add('productos', {
                    tiendaId: tiendaId,
                    categoriaId: categoriaId,
                    nombre: articulo.nombre || 'Sin nombre',
                    descripcion: articulo.descripcion || '',
                    precio: parseFloat(articulo.precio) || 0
                });
                
                exitosos++;
            } catch (error) {
                console.error('Error al subir artículo:', articulo, error);
                errores++;
            }
            
            // Actualizar progreso
            const progress = 50 + ((i + 1) / articulos.length) * 50;
            progressBar.style.width = progress + '%';
            statusText.textContent = `Subiendo artículos... ${i + 1}/${articulos.length}`;
        }
        
        progressBar.style.width = '100%';
        statusText.textContent = 'Completado';
        
        // Mostrar resultado
        resultadoDiv.style.display = 'block';
        resultadoDiv.style.backgroundColor = errores === 0 ? '#d1fae5' : '#fef3c7';
        resultadoDiv.style.border = `2px solid ${errores === 0 ? '#10b981' : '#f59e0b'}`;
        
        if (errores === 0) {
            mensajeDiv.textContent = `✓ Se subieron exitosamente ${exitosos} artículos.`;
            mensajeDiv.style.color = '#065f46';
        } else {
            mensajeDiv.textContent = `Se subieron ${exitosos} artículos. ${errores} artículos tuvieron errores.`;
            mensajeDiv.style.color = '#92400e';
        }
        
        // Recargar la vista si estamos en la sección de productos
        setTimeout(() => {
            if (currentView === 'admin-productos') {
                loadCategoriasAdmin();
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error al procesar archivo:', error);
        resultadoDiv.style.display = 'block';
        resultadoDiv.style.backgroundColor = '#fee2e2';
        resultadoDiv.style.border = '2px solid #ef4444';
        mensajeDiv.textContent = 'Error: ' + error.message;
        mensajeDiv.style.color = '#991b1b';
    } finally {
        btnSubir.disabled = false;
    }
}
