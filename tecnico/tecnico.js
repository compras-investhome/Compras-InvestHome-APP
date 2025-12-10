// Técnico Module - Lógica del perfil de técnico
import { db } from '../database.js';

// Variables globales
let currentUser = null;
let currentUserType = null;
let currentObra = null;
let currentTienda = null;
let currentCategoria = null;
let carritoAdmin = [];
let searchResultsAdmin = [];
let pedidosFiltros = {
    obra: '',
    tienda: '',
    estadoEnvio: '',
    estadoPago: '',
    fecha: '',
    persona: ''
};
let pedidosCursoFiltros = {
    obra: '',
    tienda: '',
    estadoEnvio: '',
    estadoPago: ''
};
let previousAdminSubView = null;

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

function showPrompt(message, defaultValue = '', title = 'Ingresar') {
    return new Promise((resolve) => {
        const promptPopup = document.getElementById('custom-prompt');
        const promptTitle = document.getElementById('custom-prompt-title');
        const promptMessage = document.getElementById('custom-prompt-message');
        const promptBody = promptMessage.parentElement; // custom-popup-body
        const promptInput = document.getElementById('custom-prompt-input');
        const promptOk = document.getElementById('custom-prompt-ok');
        const promptCancel = document.getElementById('custom-prompt-cancel');
        
        // Limpiar contenido previo completamente
        promptMessage.innerHTML = '';
        promptMessage.textContent = '';
        promptMessage.style.display = '';
        promptInput.value = '';
        promptInput.style.display = '';
        
        // Remover cualquier contenido HTML previo del body
        const existingHTML = promptBody.querySelector('.prompt-html-content');
        if (existingHTML) {
            existingHTML.remove();
        }
        
        promptTitle.textContent = title;
        
        // Si el mensaje contiene HTML (como un selector), insertarlo en el body, sino usar textContent
        const hasHTML = message.includes('<') && message.includes('>');
        const hasSelect = hasHTML && message.includes('<select');
        
        let selectElement = null;
        
        if (hasHTML) {
            // Ocultar completamente el párrafo de mensaje y el input
            promptMessage.style.display = 'none';
            promptInput.style.display = 'none';
            
            // Crear un contenedor para el HTML
            const htmlContainer = document.createElement('div');
            htmlContainer.className = 'prompt-html-content';
            htmlContainer.style.width = '100%';
            htmlContainer.innerHTML = message;
            
            // Insertar el HTML antes del input (que está oculto)
            promptBody.insertBefore(htmlContainer, promptInput);
            
            // Buscar el selector dentro del contenedor HTML
            if (hasSelect) {
                selectElement = htmlContainer.querySelector('select');
                if (selectElement) {
                    selectElement.style.width = '100%';
                }
            }
        } else {
            // Mostrar el mensaje normal y el input
            promptMessage.style.display = '';
        promptMessage.textContent = message;
            promptInput.style.display = '';
        promptInput.value = defaultValue;
        }
        
        promptPopup.classList.add('active');
        
        // Función para cerrar el prompt
        let resolved = false;
        const closePrompt = (result) => {
            if (resolved) return;
            resolved = true;
            
            promptPopup.classList.remove('active');
            promptInput.style.display = '';
            promptMessage.style.display = '';
            promptMessage.innerHTML = '';
            promptMessage.textContent = '';
            
            // Remover contenido HTML si existe
            const htmlContent = promptBody.querySelector('.prompt-html-content');
            if (htmlContent) {
                htmlContent.remove();
            }
            
            // Remover event listeners
            promptOk.removeEventListener('click', handleOkClick);
            promptCancel.removeEventListener('click', handleCancelClick);
            if (selectElement) {
                selectElement.removeEventListener('keypress', handleSelectKeyPress);
            } else {
                promptInput.removeEventListener('keypress', handleInputKeyPress);
            }
            overlay.removeEventListener('click', handleCancelClick);
            
            // Resolver con el valor apropiado
            if (result) {
                if (selectElement) {
                    resolve(selectElement.value || null);
                } else {
                    resolve(promptInput.value || null);
                }
            } else {
                resolve(null);
            }
        };
        
        const overlay = promptPopup.querySelector('.custom-popup-overlay');
        const handleOkClick = () => closePrompt(true);
        const handleCancelClick = () => closePrompt(false);
        const handleInputKeyPress = (e) => {
            if (e.key === 'Enter') {
                closePrompt(true);
            }
        };
        const handleSelectKeyPress = (e) => {
            if (e.key === 'Enter') {
                closePrompt(true);
            }
        };
        
        // Agregar event listeners
        promptOk.addEventListener('click', handleOkClick);
        promptCancel.addEventListener('click', handleCancelClick);
        if (selectElement) {
            selectElement.addEventListener('keypress', handleSelectKeyPress);
            setTimeout(() => selectElement.focus(), 100);
        } else {
            promptInput.addEventListener('keypress', handleInputKeyPress);
            setTimeout(() => promptInput.focus(), 100);
        }
        overlay.addEventListener('click', handleCancelClick);
    });
}

// Funciones de utilidad
function sanitizeCascadeId(value) {
    const base = (value || 'sin-obra').toString();
    const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, '-');
    return sanitized || 'sin-obra';
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

function getEstadoPagoPillClass(estado) {
    const normalized = (estado || '').toLowerCase();
    if (normalized.includes('cuenta')) {
        return 'estado-pago-cuenta';
    }
    if (normalized.includes('pagad')) {
        return 'estado-pago-pagado';
    }
    return 'estado-pago-pendiente';
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
    return Boolean(
        pedido?.esPedidoEspecial ||
        pedido?.pedidoEspecial ||
        pedido?.tipo === 'Especial' ||
        pedido?.tipoPedido === 'Especial'
    );
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
        <div class="cascade-header" onclick="toggleTecnicoSection('${contentId}', '${arrowId}')">
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

window.toggleTecnicoSection = function(contentId, arrowId) {
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

window.togglePedidoSection = function(sectionId, triggerEl) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const isHidden = section.style.display === 'none' || getComputedStyle(section).display === 'none';
    section.style.display = isHidden ? 'block' : 'none';
    
    // Agregar/quitar clase para z-index en comentarios
    if (section.classList.contains('pedido-notas-list-compact-scroll') || sectionId.includes('notas')) {
        const comentariosCard = section.closest('.contab-card-comentarios');
        const pedidoCard = section.closest('.pedido-gestion-card');
        if (comentariosCard) {
            if (isHidden) {
                comentariosCard.classList.add('comentarios-expandidos');
                if (pedidoCard) {
                    pedidoCard.classList.add('comentarios-expandidos-card');
                }
            } else {
                comentariosCard.classList.remove('comentarios-expandidos');
                if (pedidoCard) {
                    pedidoCard.classList.remove('comentarios-expandidos-card');
                }
            }
        }
    }
    
    if (triggerEl) {
        const textEl = triggerEl.querySelector('.toggle-text');
        if (textEl) {
            textEl.textContent = isHidden
                ? (triggerEl.dataset.openLabel || textEl.textContent)
                : (triggerEl.dataset.closeLabel || textEl.textContent);
        }
        const chevron = triggerEl.querySelector('.chevron');
        if (chevron) {
            chevron.textContent = isHidden ? '▲' : '▼';
        }
    }
};

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ========== CARGA DE VISTAS ==========

function showView(viewName) {
    // Ocultar todas las vistas
    document.querySelectorAll('.admin-content-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Mostrar la vista seleccionada
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // Mostrar/ocultar botón de carrito según la vista
    const cartButton = document.getElementById('cart-button');
    if (cartButton) {
        if (viewName === 'tecnico-tienda' || viewName === 'productos' || viewName === 'categorias') {
            cartButton.style.display = 'flex';
        } else {
            cartButton.style.display = 'none';
        }
    }
    
    // Actualizar botones activos del sidebar
    document.querySelectorAll('.admin-nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        }
    });
    
    // Cargar datos según la vista
    if (viewName === 'tecnico-tienda') {
        loadTiendasAdminView();
        updateCartCountAdmin();
    } else if (viewName === 'tecnico-pedidos-curso') {
        loadPedidosEnCursoTecnico();
    } else if (viewName === 'tecnico-historico') {
        loadHistoricoTecnico();
    }
}

// ========== CARGA DE TIENDAS ==========

async function loadTiendasAdminView() {
    let tiendas = await db.getAll('tiendas');
    
    // Filtrar solo tiendas activas
    tiendas = tiendas.filter(t => t.activa !== false);
    
    const container = document.getElementById('tiendas-list-admin');
    const searchInput = document.getElementById('search-input-admin');
    const isSearching = searchInput && searchInput.value.trim().length > 2;
    
    if (isSearching && searchResultsAdmin.length === 0) {
        // Búsqueda activa pero sin resultados
        container.innerHTML = '';
        container.className = 'productos-list';
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-state';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '3rem 1rem';
        emptyMessage.innerHTML = '<p>Sin Resultados</p><p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">No se encontraron productos que coincidan con tu búsqueda</p>';
        container.appendChild(emptyMessage);
    } else if (searchResultsAdmin.length > 0) {
        // Mostrar resultados de búsqueda como productos
        container.innerHTML = '';
        container.className = 'productos-list';
        
        // Eliminar duplicados por ID, referencia+tiendaId, o EAN+tiendaId antes de mostrar
        const productosUnicos = [];
        const idsVistos = new Set();
        const referenciasVistas = new Set();
        const eansVistos = new Set();
        
        for (const producto of searchResultsAdmin) {
            // Verificar por ID
            if (!producto.id || idsVistos.has(producto.id)) {
                continue;
            }
            
            // Crear clave única para referencia+tiendaId
            const claveReferencia = producto.referencia && producto.tiendaId 
                ? `${producto.tiendaId}-${producto.referencia}` 
                : null;
            
            // Crear clave única para EAN+tiendaId
            const claveEAN = producto.ean && producto.tiendaId 
                ? `${producto.tiendaId}-${producto.ean}` 
                : null;
            
            // Verificar si ya existe un producto con la misma referencia o EAN en la misma tienda
            if (claveReferencia && referenciasVistas.has(claveReferencia)) {
                continue;
            }
            if (claveEAN && eansVistos.has(claveEAN)) {
                continue;
            }
            
            // Agregar a los sets de control
            idsVistos.add(producto.id);
            if (claveReferencia) referenciasVistas.add(claveReferencia);
            if (claveEAN) eansVistos.add(claveEAN);
            productosUnicos.push(producto);
        }
        
        for (const producto of productosUnicos) {
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
    const mainContent = document.querySelector('#view-tecnico-tienda .main-content');
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
    soloSinSubCategoria: true
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
        productosPaginacion.soloSinSubCategoria = tieneSubcategorias; // Solo filtrar si hay subcategorías
        
        // Cargar productos (siempre, incluso si no hay subcategorías)
        await cargarProductosPaginados(productosList, categoriaId, false);
    }
}

async function cargarProductosPaginados(container, id, esSubCategoria) {
    let resultado;
    
    try {
        if (esSubCategoria) {
            resultado = await db.getProductosBySubCategoriaPaginated(id, 5, productosPaginacion.offset);
        } else {
            // Si hay subcategorías, solo mostrar productos sin subcategoría
            // Si NO hay subcategorías, mostrar TODOS los productos
            const soloSinSubCategoria = productosPaginacion.soloSinSubCategoria !== undefined 
                ? productosPaginacion.soloSinSubCategoria 
                : true;
            resultado = await db.getProductosByCategoriaPaginated(id, 5, productosPaginacion.offset, soloSinSubCategoria);
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

async function createProductoCardAdmin(producto) {
    const card = document.createElement('div');
    card.className = 'producto-card-admin';
    card.dataset.productoId = producto.id;
    
    const cantidadEnCarrito = getCantidadEnCarritoAdmin(producto.id);
    const foto = producto.foto ? `<img src="${producto.foto}" alt="${escapeHtml(producto.nombre)}" class="producto-foto" onerror="this.style.display='none'">` : '<div class="producto-foto-placeholder">📦</div>';
    
    let vendidoPor = '';
    if (searchResultsAdmin.length > 0 && producto.tiendaId) {
        try {
            const tienda = await db.get('tiendas', producto.tiendaId);
            if (tienda) {
                vendidoPor = `<div class="producto-vendido-por">Vendido por: <strong>${escapeHtml(tienda.nombre)}</strong></div>`;
            }
        } catch (error) {
            console.error('Error al obtener tienda:', error);
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

// ========== BÚSQUEDA ==========

async function performSearchAdmin(query) {
    searchResultsAdmin = await db.searchProductos(query);
    loadTiendasAdminView();
}

// ========== CARRITO ==========

function getCantidadEnCarritoAdmin(productoId) {
    const item = carritoAdmin.find(item => item.productoId === productoId);
    return item ? item.cantidad : 0;
}

async function addToCartAdmin(productoId, cantidad = 1) {
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

window.incrementProductoAdmin = async function(productoId) {
    const item = carritoAdmin.find(item => item.productoId === productoId);
    if (item) {
        item.cantidad++;
    } else {
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
        // Mostrar botón de añadir
        if (actionsBasic) {
            actionsBasic.innerHTML = `
                <button class="btn-add-cart-small" data-producto-id="${productoId}">+</button>
            `;
            // Agregar event listener
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

function incrementCarritoItem(productoId) {
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

// ========== FINALIZAR PEDIDO ==========

async function finalizarPedidoAdmin() {
    if (carritoAdmin.length === 0) {
        await showAlert('El carrito está vacío', 'Error');
        return;
    }
    
    // Obtener obras asignadas al usuario
    const obrasAsignadas = currentUser?.obrasAsignadas || [];
    
    // Obtener todas las obras
    let obras = await db.getAll('obras');
    if (obras.length === 0) {
        await showAlert('No hay obras disponibles. Por favor, crea una obra primero.', 'Error');
        return;
    }
    
    // Filtrar obras según las asignadas al usuario
    // Si el usuario tiene obras asignadas, mostrar solo esas
    // Si no tiene obras asignadas, mostrar todas
    if (obrasAsignadas.length > 0) {
        obras = obras.filter(obra => obrasAsignadas.includes(obra.id));
        if (obras.length === 0) {
            await showAlert('No tienes obras asignadas disponibles.', 'Error');
            return;
        }
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
    
    // Mostrar prompt con selector de obra (el HTML va como primer parámetro)
    const obraId = await showPrompt(obraSelectHtml, '', 'Selecciona la obra para el pedido');
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
            
            // Estado inicial siempre "Sin Asignar" para todos los pedidos
            const estadoPago = 'Sin Asignar';
            
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

// ========== MIS PEDIDOS ==========

async function loadMisPedidos() {
    if (!currentUser) {
        const container = document.getElementById('pedidos-list');
        const emptyState = document.getElementById('pedidos-empty');
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    const todosPedidos = await db.getAll('pedidos');
    let pedidosFiltrados = todosPedidos.filter(p => {
        return p.estado !== 'Completado' && !(p.esPedidoEspecial === true);
    });
    
    pedidosFiltrados = aplicarFiltrosPedidos(pedidosFiltrados);
    
    const container = document.getElementById('pedidos-list');
    const emptyState = document.getElementById('pedidos-empty');
    
    if (pedidosFiltrados.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    pedidosFiltrados.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    const obras = await getObrasCatalog(pedidosFiltrados);
    
    let totalCount = 0;
    for (const obra of obras) {
        const obraId = obra.id || 'sin-obra';
        const pedidosObra = pedidosFiltrados.filter(p => (p.obraId || 'sin-obra') === obraId);
        totalCount += pedidosObra.length;
        
        const { section, content } = createCascadeSection({
            prefix: 'pedidos-obra',
            uniqueId: obraId,
            title: obra.nombreComercial || obra.nombre || 'Obra sin nombre',
            count: pedidosObra.length,
            emptyMessage: 'Sin pedidos para esta obra',
            defaultOpen: pedidosObra.length > 0
        });
        
        for (const pedido of pedidosObra) {
            const card = await createPedidoTecnicoCard(pedido);
            content.appendChild(card);
        }
        
        container.appendChild(section);
    }
    
    const badge = document.getElementById('pedidos-total-badge');
    const badgeNormal = document.getElementById('pedidos-normal-badge');
    if (badge) badge.textContent = totalCount;
    if (badgeNormal) badgeNormal.textContent = totalCount;
}

function aplicarFiltrosPedidos(pedidos) {
    let filtrados = [...pedidos];
    
    if (pedidosFiltros.obra) {
        filtrados = filtrados.filter(p => (p.obraId || 'sin-obra') === pedidosFiltros.obra);
    }
    
    if (pedidosFiltros.tienda) {
        filtrados = filtrados.filter(p => p.tiendaId === pedidosFiltros.tienda);
    }
    
    if (pedidosFiltros.estadoEnvio) {
        filtrados = filtrados.filter(p => p.estado === pedidosFiltros.estadoEnvio);
    }
    
    if (pedidosFiltros.estadoPago) {
        filtrados = filtrados.filter(p => {
            const estadoPago = p.estadoPago || 'Sin Asignar';
            return estadoPago === pedidosFiltros.estadoPago;
        });
    }
    
    if (pedidosFiltros.fecha) {
        const ahora = new Date();
        let fechaLimite = new Date();
        
        switch (pedidosFiltros.fecha) {
            case 'ultima-semana':
                fechaLimite.setDate(ahora.getDate() - 7);
                break;
            case 'ultimo-mes':
                fechaLimite.setMonth(ahora.getMonth() - 1);
                break;
            case 'ultimos-3-meses':
                fechaLimite.setMonth(ahora.getMonth() - 3);
                break;
            case 'ultimos-6-meses':
                fechaLimite.setMonth(ahora.getMonth() - 6);
                break;
        }
        
        filtrados = filtrados.filter(p => {
            let fechaPedido;
            if (p.fecha && p.fecha.toDate) {
                fechaPedido = p.fecha.toDate();
            } else if (p.fecha) {
                fechaPedido = new Date(p.fecha);
            } else if (p.createdAt && p.createdAt.toDate) {
                fechaPedido = p.createdAt.toDate();
            } else if (p.createdAt) {
                fechaPedido = new Date(p.createdAt);
            } else {
                return false;
            }
            return fechaPedido >= fechaLimite;
        });
    }
    
    if (pedidosFiltros.persona) {
        filtrados = filtrados.filter(p => {
            const persona = p.persona || p.usuarioNombre || '';
            return persona === pedidosFiltros.persona;
        });
    }
    
    return filtrados;
}

async function populatePedidosFilters() {
    const todosPedidos = await db.getAll('pedidos');
    const pedidosNoCompletados = todosPedidos.filter(p => p.estado !== 'Completado');
    
    const obras = await getObrasCatalog(pedidosNoCompletados);
    const selectObra = document.getElementById('filter-obra');
    if (selectObra) {
        const obrasOptions = obras.map(obra => {
            const selected = pedidosFiltros.obra === obra.id ? 'selected' : '';
            return `<option value="${obra.id || 'sin-obra'}" ${selected}>${escapeHtml(obra.nombreComercial || obra.nombre || 'Obra sin nombre')}</option>`;
        }).join('');
        selectObra.innerHTML = '<option value="">Todas las obras</option>' + obrasOptions;
    }
    
    const tiendasIds = [...new Set(pedidosNoCompletados.map(p => p.tiendaId).filter(Boolean))];
    const tiendas = await Promise.all(tiendasIds.map(id => db.get('tiendas', id)));
    const selectTienda = document.getElementById('filter-tienda');
    if (selectTienda) {
        const tiendasOptions = tiendas
            .filter(t => t)
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
            .map(tienda => {
                const selected = pedidosFiltros.tienda === tienda.id ? 'selected' : '';
                return `<option value="${tienda.id}" ${selected}>${escapeHtml(tienda.nombre || 'Sin nombre')}</option>`;
            }).join('');
        selectTienda.innerHTML = '<option value="">Todas las tiendas</option>' + tiendasOptions;
    }
    
    const personas = [...new Set(pedidosNoCompletados.map(p => p.persona || p.usuarioNombre).filter(Boolean))];
    const selectPersona = document.getElementById('filter-persona');
    if (selectPersona) {
        const personasOptions = personas
            .sort()
            .map(persona => {
                const selected = pedidosFiltros.persona === persona ? 'selected' : '';
                return `<option value="${escapeHtml(persona)}" ${selected}>${escapeHtml(persona)}</option>`;
            }).join('');
        selectPersona.innerHTML = '<option value="">Todas las personas</option>' + personasOptions;
    }
    
    const selectEstadoEnvio = document.getElementById('filter-estado-envio');
    if (selectEstadoEnvio && pedidosFiltros.estadoEnvio) {
        selectEstadoEnvio.value = pedidosFiltros.estadoEnvio;
    }
    
    const selectEstadoPago = document.getElementById('filter-estado-pago');
    if (selectEstadoPago && pedidosFiltros.estadoPago) {
        selectEstadoPago.value = pedidosFiltros.estadoPago;
    }
    
    const selectFecha = document.getElementById('filter-fecha');
    if (selectFecha && pedidosFiltros.fecha) {
        selectFecha.value = pedidosFiltros.fecha;
    }
}

function setupPedidosFiltersListeners() {
    const selectObra = document.getElementById('filter-obra');
    const selectTienda = document.getElementById('filter-tienda');
    const selectEstadoEnvio = document.getElementById('filter-estado-envio');
    const selectEstadoPago = document.getElementById('filter-estado-pago');
    const selectFecha = document.getElementById('filter-fecha');
    const selectPersona = document.getElementById('filter-persona');
    const btnLimpiar = document.getElementById('btn-limpiar-filtros');
    
    if (selectObra) {
        selectObra.addEventListener('change', (e) => {
            pedidosFiltros.obra = e.target.value;
            loadMisPedidos();
        });
    }
    
    if (selectTienda) {
        selectTienda.addEventListener('change', (e) => {
            pedidosFiltros.tienda = e.target.value;
            loadMisPedidos();
        });
    }
    
    if (selectEstadoEnvio) {
        selectEstadoEnvio.addEventListener('change', (e) => {
            pedidosFiltros.estadoEnvio = e.target.value;
            loadMisPedidos();
        });
    }
    
    if (selectEstadoPago) {
        selectEstadoPago.addEventListener('change', (e) => {
            pedidosFiltros.estadoPago = e.target.value;
            loadMisPedidos();
        });
    }
    
    if (selectFecha) {
        selectFecha.addEventListener('change', (e) => {
            pedidosFiltros.fecha = e.target.value;
            loadMisPedidos();
        });
    }
    
    if (selectPersona) {
        selectPersona.addEventListener('change', (e) => {
            pedidosFiltros.persona = e.target.value;
            loadMisPedidos();
        });
    }
    
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            pedidosFiltros = {
                obra: '',
                tienda: '',
                estadoEnvio: '',
                estadoPago: '',
                fecha: '',
                persona: ''
            };
            populatePedidosFilters().then(() => loadMisPedidos());
        });
    }
}

function switchTabPedidos(tab) {
    // Para técnico solo hay pedidos normales
    if (tab === 'pedidos-normal') {
        populatePedidosFilters().then(() => loadMisPedidos());
    }
}

// ========== PEDIDOS ESPECIALES ==========
// Los técnicos no pueden crear ni ver pedidos especiales

// ========== CREACIÓN DE CARDS ==========

async function createPedidoTecnicoCard(pedido) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card contab-pedido-card';
    
    const tienda = await db.get('tiendas', pedido.tiendaId);
    const obraInfo = pedido.obraId ? await db.get('obras', pedido.obraId) : null;
    
    let fechaObj;
    if (pedido.fecha && pedido.fecha.toDate) {
        fechaObj = pedido.fecha.toDate();
    } else if (pedido.fecha) {
        fechaObj = new Date(pedido.fecha);
    } else if (pedido.createdAt && pedido.createdAt.toDate) {
        fechaObj = pedido.createdAt.toDate();
    } else if (pedido.createdAt) {
        fechaObj = new Date(pedido.createdAt);
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
            const placeholderId = `foto-placeholder-tec-${pedido.id}-${index}`.replace(/[^a-zA-Z0-9-]/g, '-');
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
                    <div class="pedido-item-actions" style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="emoji-btn" type="button" aria-label="Solicitar cambio de cantidad" onclick="solicitarModificacionCantidad('${pedido.id}', ${index}, ${cantidad})" title="Solicitar cambio de cantidad">✏️</button>
                        <button class="emoji-btn danger" type="button" aria-label="Solicitar anulación del artículo" onclick="solicitarAnulacionItem('${pedido.id}', ${index})" title="Solicitar anulación del artículo">🗑️</button>
                    </div>
                </div>
            `;
        }).join('')
        : '<p class="cascade-empty">No hay artículos en este pedido</p>';
    
    const pedidoRealLink = pedido.pedidoSistemaPDF ? escapeHtml(pedido.pedidoSistemaPDF) : null;
    const pedidoRealContent = pedidoRealLink
        ? `<a href="${pedidoRealLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver documento</a>`
        : '<span class="doc-placeholder">Sin documento</span>';
    
    const facturaLink = pedido.albaran ? escapeHtml(pedido.albaran) : null;
    const facturaContent = facturaLink
        ? `<a href="${facturaLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver factura</a>`
        : '<span class="doc-placeholder">Sin factura</span>';
    
    const tienePago = Boolean(pedido.transferenciaPDF);
    const documentoPagoContent = tienePago
        ? `<a href="${escapeHtml(pedido.transferenciaPDF)}" target="_blank" rel="noopener" class="doc-link">📄 Ver pago</a>`
        : '<span class="doc-placeholder">Sin documento</span>';
    
    const itemsSectionId = `pedido-items-tec-${pedido.id}`;
    const notasSectionId = `pedido-notas-tec-${pedido.id}`;
    const notasListId = `pedido-notas-list-tec-${pedido.id}`;
    const notasCountId = `pedido-notas-count-tec-${pedido.id}`;
    const notaInputId = `pedido-nota-input-tec-${pedido.id}`;
    
    card.innerHTML = `
        <!-- Header del pedido -->
        <div class="contab-pedido-header-compact">
                <p class="pedido-code">Pedido #${escapeHtml(pedido.id)}</p>
                <div class="contab-estado-envio">
                    <span>Estado de envío:</span>
                    <span class="estado-envio-pill estado-${estadoEnvioClass}">${escapeHtml(estadoEnvio)}</span>
                </div>
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
                    <span class="estado-pago-pill ${estadoPagoClass}">${escapeHtml(estadoPago)}</span>
                </div>
                <div class="contab-info-row-compact">
                    <span>Pedido real</span>
                    <div class="doc-actions">${pedidoRealContent}</div>
                </div>
                <div class="contab-info-row-compact">
                    <span class="label-doc-pago">Documento de pago</span>
                    <div class="doc-actions">${documentoPagoContent}</div>
                </div>
                <div class="contab-info-row-compact">
                    <span>Factura</span>
                    <div class="doc-actions">${facturaContent}</div>
                </div>
            </div>
            
            <!-- Card: Artículos (siempre visible) -->
            <div class="contab-info-card-compact contab-card-articulos">
                <div class="contab-card-title-compact">
                    <span>Artículos (${items.length})</span>
                    <span class="contab-total-compact" style="font-size: 0.7rem; color: var(--primary-color);">Total: ${formatCurrency(totalPedido)}</span>
        </div>
                <div class="pedido-items-list-compact">
                    ${itemsHtml}
                </div>
                <div style="margin-top: 0.5rem;">
                    <button class="btn btn-secondary btn-sm" type="button" onclick="solicitarAnulacionPedido('${pedido.id}')" style="font-size: 0.75rem; padding: 0.4rem 0.75rem; width: 100%;">
                        Solicitar Anulación del Pedido
                    </button>
                </div>
                </div>
            
            <!-- Card: Comentarios -->
            <div class="contab-info-card-compact contab-card-comentarios">
                <div class="contab-card-title-compact">
                    <span>Comentarios <span class="comentarios-count">(${notas.length})</span></span>
            </div>
                <div class="comentarios-input-wrapper">
                    <textarea id="${notaInputId}" class="comentarios-input" placeholder="Escribe un comentario..."></textarea>
                    <div class="comentarios-buttons-row">
                        <button class="btn-ver-comentarios" type="button" onclick="togglePedidoSection('${notasSectionId}', this)" id="btn-ver-comentarios-${pedido.id}" data-open-label="Ocultar Comentarios" data-close-label="Ver Comentarios">
                            Ver Comentarios
                        </button>
                        <button class="btn btn-primary btn-xs" type="button" onclick="guardarNotaPedido('${pedido.id}', '${notaInputId}', '${notasListId}', '${notasCountId}')">Enviar</button>
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
    renderPedidoNotasUI(pedido.id, notas, notasListElement, notasCountElement);
    
    // Actualizar contador de comentarios en el título
    const comentariosCountElement = card.querySelector('.comentarios-count');
    if (comentariosCountElement) {
        comentariosCountElement.textContent = `(${notas.length})`;
    }
    
    return card;
}

// ========== PEDIDOS ESPECIALES - MODAL Y GESTIÓN ==========

async function openModalPedidoEspecialAdmin(pedidoId = null) {
    if (!currentUser || (currentUserType !== 'Técnico' && currentUserType !== 'Administrador')) {
        showAlert('Solo los técnicos y administradores pueden crear/editar pedidos especiales');
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
        // Obtener obras asignadas al usuario
        const obrasAsignadas = currentUser?.obrasAsignadas || [];
        
        // Obtener todas las obras
        let obras = await db.getAllObras();
        
        // Filtrar obras según las asignadas al usuario
        // Si el usuario tiene obras asignadas, mostrar solo esas
        // Si no tiene obras asignadas, mostrar todas
        if (obrasAsignadas.length > 0) {
            obras = obras.filter(obra => obrasAsignadas.includes(obra.id));
        }
        
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

window.openModalPedidoEspecial = function() {
    openModalPedidoEspecialAdmin();
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
        estado: 'Nuevo', // Estado inicial para que aparezca en la subpestaña "Nuevo"
        estadoPago: 'Sin Asignar' // Estado inicial de pago siempre "Sin Asignar"
    };
    
    // Si hay notas iniciales del formulario, convertirlas a formato de comentario
    if (notas && notas.trim()) {
        pedidoEspecial.notas.push({
            id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            usuarioId: currentUser.id || null,
            usuarioNombre: currentUser.username || currentUser.nombre || 'Usuario',
            usuarioTipo: currentUserType || currentUser?.tipo || 'Técnico',
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
                    usuarioTipo: currentUserType || currentUser?.tipo || 'Técnico',
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

window.guardarPedidoEspecial = guardarPedidoEspecial;

// ========== SOLICITUDES ==========

// Función auxiliar para verificar si un pedido tiene solicitudes pendientes
async function tieneSolicitudesPendientes(pedidoId) {
    try {
        // Obtener el pedido para verificar su tiendaId
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) return false;
        
        // Buscar solicitudes de modificación pendientes para esta tienda
        const solicitudesModificacion = await db.getSolicitudesModificacionByTienda(pedido.tiendaId);
        const tieneModificacionPendiente = solicitudesModificacion.some(s => 
            s.pedidoId === pedidoId && s.estado === 'Pendiente'
        );
        
        // Buscar solicitudes de anulación pendientes para esta tienda
        const solicitudesAnulacion = await db.getSolicitudesAnulacionByTienda(pedido.tiendaId);
        const tieneAnulacionPendiente = solicitudesAnulacion.some(s => 
            s.pedidoId === pedidoId && s.estado === 'Pendiente'
        );
        
        return tieneModificacionPendiente || tieneAnulacionPendiente;
    } catch (error) {
        console.error('Error al verificar solicitudes pendientes:', error);
        return false;
    }
}

window.solicitarModificacionCantidad = async function(pedidoId, itemIndex, cantidadActual) {
    // Verificar si ya hay una solicitud pendiente para este pedido
    const tienePendiente = await tieneSolicitudesPendientes(pedidoId);
    if (tienePendiente) {
        await showAlert('Este pedido ya tiene una solicitud pendiente. Por favor, espere a que sea atendida antes de crear una nueva solicitud.', 'Atención');
        return;
    }
    
    const nuevaCantidadStr = await showPrompt(`Cantidad actual: ${cantidadActual}\n\nIngrese la nueva cantidad que desea solicitar:`, cantidadActual.toString(), 'Modificar Cantidad');
    
    if (nuevaCantidadStr === null) return;
    
    const nuevaCantidad = parseInt(nuevaCantidadStr);
    
    if (isNaN(nuevaCantidad) || nuevaCantidad < 0) {
        await showAlert('Por favor, ingrese una cantidad válida', 'Error');
        return;
    }
    
    if (nuevaCantidad === cantidadActual) {
        await showAlert('La cantidad solicitada es igual a la actual', 'Información');
        return;
    }
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido || !pedido.items || itemIndex >= pedido.items.length) {
            await showAlert('Error: No se pudo encontrar el artículo', 'Error');
            return;
        }
        
        const item = pedido.items[itemIndex];
        const solicitud = {
            pedidoId: pedidoId,
            tiendaId: pedido.tiendaId,
            userId: pedido.userId,
            tipo: 'modificacion',
            itemIndex: itemIndex,
            item: item,
            cantidadActual: cantidadActual,
            cantidadSolicitada: nuevaCantidad,
            estado: 'Pendiente',
            fecha: new Date()
        };
        
        await db.add('solicitudesModificacion', solicitud);
        await showAlert('Solicitud de modificación de cantidad enviada a la tienda', 'Éxito');
        loadMisPedidos();
    } catch (error) {
        console.error('Error al solicitar modificación:', error);
        await showAlert('Error al solicitar modificación: ' + error.message, 'Error');
    }
};

window.solicitarAnulacionItem = async function(pedidoId, itemIndex) {
    // Verificar si ya hay una solicitud pendiente para este pedido
    const tienePendiente = await tieneSolicitudesPendientes(pedidoId);
    if (tienePendiente) {
        await showAlert('Este pedido ya tiene una solicitud pendiente. Por favor, espere a que sea atendida antes de crear una nueva solicitud.', 'Atención');
        return;
    }
    
    const confirmar = await showConfirm('¿Está seguro de solicitar la anulación de este artículo?', 'Confirmar Anulación');
    if (!confirmar) return;
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido || !pedido.items || itemIndex >= pedido.items.length) {
            await showAlert('Error: No se pudo encontrar el artículo', 'Error');
            return;
        }
        
        const item = pedido.items[itemIndex];
        const solicitud = {
            pedidoId: pedidoId,
            tiendaId: pedido.tiendaId,
            userId: pedido.userId,
            tipo: 'item',
            itemIndex: itemIndex,
            item: item,
            estado: 'Pendiente',
            fecha: new Date()
        };
        
        await db.add('solicitudesAnulacion', solicitud);
        await showAlert('Solicitud de anulación enviada a la tienda', 'Éxito');
        loadMisPedidos();
    } catch (error) {
        console.error('Error al solicitar anulación:', error);
        await showAlert('Error al solicitar anulación: ' + error.message, 'Error');
    }
};

window.solicitarAnulacionPedido = async function(pedidoId) {
    // Verificar si ya hay una solicitud pendiente para este pedido
    const tienePendiente = await tieneSolicitudesPendientes(pedidoId);
    if (tienePendiente) {
        await showAlert('Este pedido ya tiene una solicitud pendiente. Por favor, espere a que sea atendida antes de crear una nueva solicitud.', 'Atención');
        return;
    }
    
    const confirmar = await showConfirm('¿Está seguro de solicitar la anulación completa de este pedido?', 'Confirmar Anulación');
    if (!confirmar) return;
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        const solicitud = {
            pedidoId: pedidoId,
            tiendaId: pedido.tiendaId,
            userId: pedido.userId,
            tipo: 'pedido',
            estado: 'Pendiente',
            fecha: new Date()
        };
        
        await db.add('solicitudesAnulacion', solicitud);
        await showAlert('Solicitud de anulación del pedido enviada a la tienda', 'Éxito');
        loadMisPedidos();
    } catch (error) {
        console.error('Error al solicitar anulación:', error);
        await showAlert('Error al solicitar anulación: ' + error.message, 'Error');
    }
};

// ========== NOTAS ==========

function renderPedidoNotasUI(pedidoId, notas = [], listElement, countElement) {
    const listEl = listElement || document.getElementById(`pedido-notas-list-${pedidoId}`);
    const countEl = countElement || document.getElementById(`pedido-notas-count-${pedidoId}`);
    if (countEl) {
        countEl.textContent = notas.length || 0;
    }
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!Array.isArray(notas) || notas.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'cascade-empty';
        empty.textContent = 'No hay comentarios registrados';
        listEl.appendChild(empty);
        return;
    }
    const sorted = [...notas].sort((a, b) => {
        const fechaA = new Date(a.timestamp || 0).getTime();
        const fechaB = new Date(b.timestamp || 0).getTime();
        return fechaB - fechaA;
    });
    sorted.forEach((nota) => {
        const entry = document.createElement('div');
        entry.className = 'pedido-nota-entry';
        const meta = document.createElement('div');
        meta.className = 'nota-meta';

        const left = createNoteHeaderLeft(nota);
        const fecha = document.createElement('span');
        fecha.className = 'nota-fecha';
        fecha.textContent = formatDateTime(new Date(nota.timestamp || Date.now()));

        meta.appendChild(left);
        meta.appendChild(fecha);

        const body = document.createElement('p');
        body.textContent = nota.mensaje || '';

        entry.appendChild(meta);
        entry.appendChild(body);
        listEl.appendChild(entry);
    });
}

function createNoteHeaderLeft(nota) {
    const left = document.createElement('div');
    const nombre = document.createElement('strong');
    nombre.textContent = nota?.usuarioNombre || 'Usuario';
    left.appendChild(nombre);
    if (nota?.usuarioTipo) {
        const rol = document.createElement('span');
        rol.className = 'nota-rol';
        rol.textContent = nota.usuarioTipo;
        left.appendChild(rol);
    }
    return left;
}

window.guardarNotaPedido = async function(pedidoId, inputId, listId, countId) {
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
        renderPedidoNotasUI(pedidoId, notas, listEl, countEl);
        
        // Actualizar contador de comentarios en el título de la card
        const card = document.querySelector(`[id*="${pedidoId}"]`)?.closest('.pedido-gestion-card');
        if (card) {
            const comentariosCountElement = card.querySelector('.comentarios-count');
            if (comentariosCountElement) {
                comentariosCountElement.textContent = `(${notas.length})`;
            }
        }
    } catch (error) {
        console.error('Error al guardar nota:', error);
        await showAlert('No se pudo guardar la nota: ' + error.message, 'Error');
    }
};

// ========== FUNCIONES AUXILIARES PEDIDOS ESPECIALES ==========

window.modificarCantidadArticuloEspecial = async function(pedidoId, index, cantidadActual) {
    const nuevaCantidadStr = await showPrompt(`Cantidad actual: ${cantidadActual}\n\nIngrese la nueva cantidad:`, cantidadActual.toString(), 'Modificar Cantidad');
    if (nuevaCantidadStr === null) return;
    
    const nuevaCantidad = parseInt(nuevaCantidadStr);
    if (isNaN(nuevaCantidad) || nuevaCantidad < 0) {
        await showAlert('Por favor, ingrese una cantidad válida', 'Error');
        return;
    }
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido || !pedido.articulos || index >= pedido.articulos.length) {
            await showAlert('Error: No se pudo encontrar el artículo', 'Error');
            return;
        }
        
        pedido.articulos[index].cantidad = nuevaCantidad;
        await db.update('pedidos', pedido);
        await showAlert('Cantidad modificada correctamente', 'Éxito');
        loadPedidosEspecialesTecnico();
    } catch (error) {
        console.error('Error al modificar cantidad:', error);
        await showAlert('Error al modificar cantidad: ' + error.message, 'Error');
    }
};

window.eliminarArticuloEspecial = async function(pedidoId, index) {
    const confirmar = await showConfirm('¿Está seguro de eliminar este artículo?', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido || !pedido.articulos || index >= pedido.articulos.length) {
            await showAlert('Error: No se pudo encontrar el artículo', 'Error');
            return;
        }
        
        pedido.articulos.splice(index, 1);
        await db.update('pedidos', pedido);
        await showAlert('Artículo eliminado correctamente', 'Éxito');
        loadPedidosEspecialesTecnico();
    } catch (error) {
        console.error('Error al eliminar artículo:', error);
        await showAlert('Error al eliminar artículo: ' + error.message, 'Error');
    }
};

window.anularPedidoEspecial = async function(pedidoId) {
    const confirmar = await showConfirm('¿Está seguro de anular este pedido especial?', 'Confirmar Anulación');
    if (!confirmar) return;
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        pedido.estado = 'Anulado';
        await db.update('pedidos', pedido);
        await showAlert('Pedido anulado correctamente', 'Éxito');
        loadPedidosEspecialesTecnico();
    } catch (error) {
        console.error('Error al anular pedido:', error);
        await showAlert('Error al anular pedido: ' + error.message, 'Error');
    }
};

// ========== PEDIDOS EN CURSO ==========

// Variable global para almacenar el estado de paginación de pedidos en curso
let pedidosCursoPaginationState = {
    obraId: null,
    pedidos: [],
    currentIndex: 0,
    itemsPerPage: 5
};

async function loadPedidosEnCursoTecnico() {
    const obrasView = document.getElementById('pedidos-curso-obras-view');
    const pedidosView = document.getElementById('pedidos-curso-pedidos-view');
    const obrasList = document.getElementById('pedidos-curso-obras-list');
    const obrasEmpty = document.getElementById('pedidos-curso-obras-empty');
    
    if (!obrasView || !pedidosView || !obrasList) return;
    
    // Mostrar vista de obras, ocultar vista de pedidos
    obrasView.style.display = 'block';
    pedidosView.style.display = 'none';
    
    // Resetear estado de paginación
    pedidosCursoPaginationState = {
        obraId: null,
        pedidos: [],
        currentIndex: 0,
        itemsPerPage: 5
    };
    
    if (!currentUser) {
        obrasList.innerHTML = '';
        if (obrasEmpty) obrasEmpty.style.display = 'block';
        return;
    }
    
    try {
        const todosPedidos = await db.getAll('pedidos');
        const obrasAsignadas = currentUser?.obrasAsignadas || [];
        
        // Filtrar pedidos en curso (no completados, no cerrados, no finalizados)
        const pedidosEnCurso = todosPedidos.filter(p => {
            // Excluir pedidos especiales
            if (isPedidoEspecial(p)) {
                return false;
            }
            // Excluir pedidos completados (con transferenciaPDF y albaran)
            if (p.transferenciaPDF && p.albaran) {
                return false;
            }
            // Excluir pedidos cerrados o finalizados
            if (p.estado === 'Cerrado' || p.estado === 'Finalizado') {
                return false;
            }
            // Filtrar por usuario o por obras asignadas
            if (p.userId === currentUser.id) {
                return true;
            }
            if (p.obraId && obrasAsignadas.includes(p.obraId)) {
                return true;
            }
            return false;
        });
        
        if (pedidosEnCurso.length === 0) {
            obrasList.innerHTML = '';
            if (obrasEmpty) obrasEmpty.style.display = 'block';
            return;
        }
        
        if (obrasEmpty) obrasEmpty.style.display = 'none';
        
        // Agrupar pedidos por obra
        const pedidosPorObra = new Map();
        for (const pedido of pedidosEnCurso) {
            const obraId = pedido.obraId || 'sin-obra';
            if (!pedidosPorObra.has(obraId)) {
                pedidosPorObra.set(obraId, []);
            }
            pedidosPorObra.get(obraId).push(pedido);
        }
        
        // Si el usuario tiene obras asignadas, mostrar solo esas obras
        // Si no tiene obras asignadas, mostrar solo sus propios pedidos (agrupados por obra si tienen obraId)
        let obrasConPedidos = [];
        
        if (obrasAsignadas.length > 0) {
            // Obtener solo las obras asignadas al usuario
            const todasObras = await db.getAllObras();
            obrasConPedidos = todasObras.filter(obra => 
                obrasAsignadas.includes(obra.id) && pedidosPorObra.has(obra.id)
            );
            
            // Agregar "Sin obra" solo si hay pedidos sin obra asignada del usuario actual
            if (pedidosPorObra.has('sin-obra')) {
                const pedidosSinObra = pedidosPorObra.get('sin-obra');
                const pedidosDelUsuarioSinObra = pedidosSinObra.filter(p => p.userId === currentUser.id);
                if (pedidosDelUsuarioSinObra.length > 0) {
                    obrasConPedidos.push({
                        id: 'sin-obra',
                        nombre: 'Sin obra asignada',
                        nombreComercial: 'Sin obra asignada',
                        encargado: '',
                        telefonoEncargado: '',
                        direccionGoogleMaps: ''
                    });
                }
            }
        } else {
            // Si no tiene obras asignadas, mostrar solo sus propios pedidos agrupados por obra
            const todasObras = await db.getAllObras();
            const obrasIdsConPedidos = Array.from(pedidosPorObra.keys()).filter(id => id !== 'sin-obra');
            obrasConPedidos = todasObras.filter(obra => 
                obrasIdsConPedidos.includes(obra.id)
            );
            
            // Agregar "Sin obra" si hay pedidos sin obra asignada del usuario
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
            const card = createObraCardPedidosCursoTecnico(obra, pedidosCount);
            obrasList.appendChild(card);
        }
    } catch (error) {
        console.error('Error al cargar obras con pedidos en curso:', error);
        obrasList.innerHTML = '<p>Error al cargar obras</p>';
    }
}

function createObraCardPedidosCursoTecnico(obra, pedidosCount) {
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
            <span class="obra-pedidos-count">${pedidosCount} pedido${pedidosCount !== 1 ? 's' : ''} en curso</span>
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
        </div>
    `;
    
    // Agregar event listener para mostrar pedidos de esta obra
    card.addEventListener('click', () => {
        loadPedidosCursoPorObraTecnico(obra.id || 'sin-obra', obra.nombreComercial || obra.nombre || 'Sin obra asignada');
    });
    
    return card;
}

// Función para cargar pedidos en curso de una obra específica con paginación
async function loadPedidosCursoPorObraTecnico(obraId, obraNombre) {
    const obrasView = document.getElementById('pedidos-curso-obras-view');
    const pedidosView = document.getElementById('pedidos-curso-pedidos-view');
    const pedidosList = document.getElementById('pedidos-curso-pedidos-list');
    const pedidosEmpty = document.getElementById('pedidos-curso-pedidos-empty');
    const obraNombreElement = document.getElementById('pedidos-curso-obra-nombre');
    const cargarMasWrapper = document.getElementById('pedidos-curso-cargar-mas-wrapper');
    
    if (!obrasView || !pedidosView || !pedidosList) return;
    
    // Mostrar vista de pedidos, ocultar vista de obras
    obrasView.style.display = 'none';
    pedidosView.style.display = 'block';
    
    if (obraNombreElement) {
        obraNombreElement.textContent = obraNombre;
    }
    
    try {
        const todosPedidos = await db.getAll('pedidos');
        const obrasAsignadas = currentUser?.obrasAsignadas || [];
        // Filtrar pedidos en curso (a tienda, no especiales) de esta obra
        const pedidosEnCurso = todosPedidos.filter(p => {
            // Excluir pedidos especiales
            if (isPedidoEspecial(p)) {
                return false;
            }
            // Excluir pedidos completados
            if (p.transferenciaPDF && p.albaran) {
                return false;
            }
            // Excluir pedidos cerrados o finalizados
            if (p.estado === 'Cerrado' || p.estado === 'Finalizado') {
                return false;
            }
            // Filtrar por obra
            const obraMatch = obraId === 'sin-obra' ? !p.obraId : p.obraId === obraId;
            if (!obraMatch) return false;
            // Filtrar por usuario o por obras asignadas
            if (p.userId === currentUser.id) {
                return true;
            }
            if (p.obraId && obrasAsignadas.includes(p.obraId)) {
                return true;
            }
            return false;
        });
        
        // Ordenar por fecha (más recientes primero)
        pedidosEnCurso.sort((a, b) => {
            const fechaA = a.fechaCreacion || a.fecha ? new Date(a.fechaCreacion || a.fecha) : new Date(0);
            const fechaB = b.fechaCreacion || b.fecha ? new Date(b.fechaCreacion || b.fecha) : new Date(0);
            return fechaB - fechaA;
        });
        
        // Guardar estado de paginación
        pedidosCursoPaginationState.obraId = obraId;
        pedidosCursoPaginationState.pedidos = pedidosEnCurso;
        pedidosCursoPaginationState.currentIndex = 0;
        
        if (pedidosEnCurso.length === 0) {
            pedidosList.innerHTML = '';
            if (pedidosEmpty) pedidosEmpty.style.display = 'block';
            if (cargarMasWrapper) cargarMasWrapper.style.display = 'none';
            return;
        }
        
        if (pedidosEmpty) pedidosEmpty.style.display = 'none';
        pedidosList.innerHTML = '';
        
        // Cargar primeros 5 pedidos
        cargarMasPedidosCursoTecnico();
    } catch (error) {
        console.error('Error al cargar pedidos en curso por obra:', error);
        pedidosList.innerHTML = '<p>Error al cargar pedidos</p>';
    }
}

// Función para cargar más pedidos en curso (paginación)
async function cargarMasPedidosCursoTecnico() {
    const pedidosList = document.getElementById('pedidos-curso-pedidos-list');
    const cargarMasWrapper = document.getElementById('pedidos-curso-cargar-mas-wrapper');
    
    if (!pedidosList || !cargarMasWrapper) return;
    
    const { pedidos, currentIndex, itemsPerPage } = pedidosCursoPaginationState;
    
    // Calcular cuántos pedidos cargar
    const endIndex = Math.min(currentIndex + itemsPerPage, pedidos.length);
    const pedidosACargar = pedidos.slice(currentIndex, endIndex);
    
    // Crear cards para los pedidos a cargar
    for (const pedido of pedidosACargar) {
        const card = await createPedidoTecnicoCard(pedido);
        pedidosList.appendChild(card);
    }
    
    // Actualizar índice
    pedidosCursoPaginationState.currentIndex = endIndex;
    
    // Mostrar/ocultar botón "Cargar más"
    if (endIndex < pedidos.length) {
        cargarMasWrapper.style.display = 'block';
    } else {
        cargarMasWrapper.style.display = 'none';
    }
}

function aplicarFiltrosPedidosCursoTecnico(pedidos) {
    let filtrados = [...pedidos];
    
    if (pedidosCursoFiltros.obra) {
        filtrados = filtrados.filter(p => (p.obraId || 'sin-obra') === pedidosCursoFiltros.obra);
    }
    
    if (pedidosCursoFiltros.tienda) {
        filtrados = filtrados.filter(p => p.tiendaId === pedidosCursoFiltros.tienda);
    }
    
    if (pedidosCursoFiltros.estadoEnvio) {
        filtrados = filtrados.filter(p => p.estado === pedidosCursoFiltros.estadoEnvio);
    }
    
    if (pedidosCursoFiltros.estadoPago) {
        filtrados = filtrados.filter(p => {
            const estadoPago = p.estadoPago || 'Sin Asignar';
            return estadoPago === pedidosCursoFiltros.estadoPago;
        });
    }
    
    return filtrados;
}

async function populatePedidosCursoFiltersTecnico(pedidosEnCurso) {
    const obras = await getObrasCatalog(pedidosEnCurso);
    const selectObra = document.getElementById('filter-obra-curso');
    if (selectObra) {
        const obrasOptions = obras.map(obra => {
            const selected = pedidosCursoFiltros.obra === obra.id ? 'selected' : '';
            return `<option value="${obra.id || 'sin-obra'}" ${selected}>${escapeHtml(obra.nombreComercial || obra.nombre || 'Obra sin nombre')}</option>`;
        }).join('');
        selectObra.innerHTML = '<option value="">Todas las obras</option>' + obrasOptions;
    }
    
    const tiendasIds = [...new Set(pedidosEnCurso.map(p => p.tiendaId).filter(Boolean))];
    const tiendas = await Promise.all(tiendasIds.map(id => db.get('tiendas', id).catch(() => null)));
    const selectTienda = document.getElementById('filter-tienda-curso');
    if (selectTienda) {
        const tiendasOptions = tiendas
            .filter(t => t)
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
            .map(tienda => {
                const selected = pedidosCursoFiltros.tienda === tienda.id ? 'selected' : '';
                return `<option value="${tienda.id}" ${selected}>${escapeHtml(tienda.nombre || 'Sin nombre')}</option>`;
            }).join('');
        selectTienda.innerHTML = '<option value="">Todas las tiendas</option>' + tiendasOptions;
    }
    
    const selectEstadoEnvio = document.getElementById('filter-estado-envio-curso');
    if (selectEstadoEnvio && pedidosCursoFiltros.estadoEnvio) {
        selectEstadoEnvio.value = pedidosCursoFiltros.estadoEnvio;
    }
    
    const selectEstadoPago = document.getElementById('filter-estado-pago-curso');
    if (selectEstadoPago && pedidosCursoFiltros.estadoPago) {
        selectEstadoPago.value = pedidosCursoFiltros.estadoPago;
    }
}

function setupPedidosCursoFiltersListenersTecnico() {
    const selectObra = document.getElementById('filter-obra-curso');
    const selectTienda = document.getElementById('filter-tienda-curso');
    const selectEstadoEnvio = document.getElementById('filter-estado-envio-curso');
    const selectEstadoPago = document.getElementById('filter-estado-pago-curso');
    const btnLimpiar = document.getElementById('btn-limpiar-filtros-curso');
    
    if (selectObra) {
        selectObra.addEventListener('change', (e) => {
            pedidosCursoFiltros.obra = e.target.value;
            loadPedidosEnCursoTecnico();
        });
    }
    
    if (selectTienda) {
        selectTienda.addEventListener('change', (e) => {
            pedidosCursoFiltros.tienda = e.target.value;
            loadPedidosEnCursoTecnico();
        });
    }
    
    if (selectEstadoEnvio) {
        selectEstadoEnvio.addEventListener('change', (e) => {
            pedidosCursoFiltros.estadoEnvio = e.target.value;
            loadPedidosEnCursoTecnico();
        });
    }
    
    if (selectEstadoPago) {
        selectEstadoPago.addEventListener('change', (e) => {
            pedidosCursoFiltros.estadoPago = e.target.value;
            loadPedidosEnCursoTecnico();
        });
    }
    
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            pedidosCursoFiltros = {
                obra: '',
                tienda: '',
                estadoEnvio: '',
                estadoPago: ''
            };
            loadPedidosEnCursoTecnico();
        });
    }
}

// ========== HISTÓRICO ==========

// Estado de paginación para histórico
let historicoPaginationState = {
    obraId: null,
    pedidos: [],
    currentIndex: 0,
    itemsPerPage: 5
};

async function loadHistoricoTecnico() {
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
        // Filtrar solo pedidos a tienda (no especiales) que estén completados (con transferenciaPDF y albaran)
        // Y que pertenezcan al usuario actual o a sus obras asignadas
        const obrasAsignadas = currentUser?.obrasAsignadas || [];
        const pedidosHistoricos = todosPedidos.filter(p => {
            // Excluir pedidos especiales
            if (isPedidoEspecial(p)) {
                return false;
            }
            // Solo pedidos completados (con transferenciaPDF y albaran)
            if (!p.transferenciaPDF || !p.albaran) {
                return false;
            }
            // Filtrar por usuario o por obras asignadas
            if (p.userId === currentUser.id) {
                return true;
            }
            if (p.obraId && obrasAsignadas.includes(p.obraId)) {
                return true;
            }
            return false;
        });
        
        if (pedidosHistoricos.length === 0) {
            obrasList.innerHTML = '';
            if (obrasEmpty) obrasEmpty.style.display = 'block';
            return;
        }
        
        if (obrasEmpty) obrasEmpty.style.display = 'none';
        
        // Agrupar pedidos por obra
        const pedidosPorObra = new Map();
        for (const pedido of pedidosHistoricos) {
            const obraId = pedido.obraId || 'sin-obra';
            if (!pedidosPorObra.has(obraId)) {
                pedidosPorObra.set(obraId, []);
            }
            pedidosPorObra.get(obraId).push(pedido);
        }
        
        // Si el usuario tiene obras asignadas, mostrar solo esas obras
        // Si no tiene obras asignadas, mostrar solo sus propios pedidos (agrupados por obra si tienen obraId)
        let obrasConPedidos = [];
        
        if (obrasAsignadas.length > 0) {
            // Obtener solo las obras asignadas al usuario
            const todasObras = await db.getAllObras();
            obrasConPedidos = todasObras.filter(obra => 
                obrasAsignadas.includes(obra.id) && pedidosPorObra.has(obra.id)
            );
            
            // Agregar "Sin obra" solo si hay pedidos sin obra asignada Y el usuario tiene obras asignadas
            // (esto es raro, pero por si acaso)
            if (pedidosPorObra.has('sin-obra')) {
                // Verificar si hay pedidos sin obra del usuario actual
                const pedidosSinObra = pedidosPorObra.get('sin-obra');
                const pedidosDelUsuarioSinObra = pedidosSinObra.filter(p => p.userId === currentUser.id);
                if (pedidosDelUsuarioSinObra.length > 0) {
                    obrasConPedidos.push({
                        id: 'sin-obra',
                        nombre: 'Sin obra asignada',
                        nombreComercial: 'Sin obra asignada',
                        encargado: '',
                        telefonoEncargado: '',
                        direccionGoogleMaps: ''
                    });
                }
            }
        } else {
            // Si no tiene obras asignadas, mostrar solo sus propios pedidos agrupados por obra
            const todasObras = await db.getAllObras();
            const obrasIdsConPedidos = Array.from(pedidosPorObra.keys()).filter(id => id !== 'sin-obra');
            obrasConPedidos = todasObras.filter(obra => 
                obrasIdsConPedidos.includes(obra.id)
            );
            
            // Agregar "Sin obra" si hay pedidos sin obra asignada del usuario
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
            const card = createObraCardHistoricoTecnico(obra, pedidosCount);
            obrasList.appendChild(card);
        }
    } catch (error) {
        console.error('Error al cargar obras con pedidos históricos:', error);
        obrasList.innerHTML = '<p>Error al cargar obras</p>';
    }
}

function createObraCardHistoricoTecnico(obra, pedidosCount) {
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
        </div>
    `;
    
    // Agregar event listener para mostrar pedidos de esta obra
    card.addEventListener('click', () => {
        loadPedidosHistoricosPorObraTecnico(obra.id || 'sin-obra', obra.nombreComercial || obra.nombre || 'Sin obra asignada');
    });
    
    return card;
}

async function loadPedidosHistoricosPorObraTecnico(obraId, obraNombre) {
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
        const obrasAsignadas = currentUser?.obrasAsignadas || [];
        // Filtrar pedidos históricos (a tienda, no especiales) de esta obra
        const pedidosHistoricos = todosPedidos.filter(p => {
            // Excluir pedidos especiales
            if (isPedidoEspecial(p)) {
                return false;
            }
            // Solo pedidos completados
            if (!p.transferenciaPDF || !p.albaran) {
                return false;
            }
            // Filtrar por obra
            const obraMatch = obraId === 'sin-obra' ? !p.obraId : p.obraId === obraId;
            if (!obraMatch) return false;
            // Filtrar por usuario o por obras asignadas
            if (p.userId === currentUser.id) {
                return true;
            }
            if (p.obraId && obrasAsignadas.includes(p.obraId)) {
                return true;
            }
            return false;
        });
        
        // Ordenar por fecha (más recientes primero)
        pedidosHistoricos.sort((a, b) => {
            const fechaA = a.fechaCreacion || a.fecha ? new Date(a.fechaCreacion || a.fecha) : new Date(0);
            const fechaB = b.fechaCreacion || b.fecha ? new Date(b.fechaCreacion || b.fecha) : new Date(0);
            return fechaB - fechaA;
        });
        
        // Guardar estado de paginación
        historicoPaginationState.obraId = obraId;
        historicoPaginationState.pedidos = pedidosHistoricos;
        historicoPaginationState.currentIndex = 0;
        
        if (pedidosHistoricos.length === 0) {
            pedidosList.innerHTML = '';
            if (pedidosEmpty) pedidosEmpty.style.display = 'block';
            if (cargarMasWrapper) cargarMasWrapper.style.display = 'none';
            return;
        }
        
        if (pedidosEmpty) pedidosEmpty.style.display = 'none';
        pedidosList.innerHTML = '';
        
        // Cargar primeros 5 pedidos
        cargarMasPedidosHistoricosEncargado();
    } catch (error) {
        console.error('Error al cargar pedidos históricos por obra:', error);
        pedidosList.innerHTML = '<p>Error al cargar pedidos</p>';
    }
}

async function cargarMasPedidosHistoricosTecnico() {
    const pedidosList = document.getElementById('historico-pedidos-list');
    const cargarMasWrapper = document.getElementById('historico-cargar-mas-wrapper');
    
    if (!pedidosList || !cargarMasWrapper) return;
    
    const { pedidos, currentIndex, itemsPerPage } = historicoPaginationState;
    
    // Calcular cuántos pedidos cargar
    const endIndex = Math.min(currentIndex + itemsPerPage, pedidos.length);
    const pedidosACargar = pedidos.slice(currentIndex, endIndex);
    
    // Crear cards para los pedidos a cargar
    for (const pedido of pedidosACargar) {
        const card = await createPedidoTiendaCardTecnico(pedido);
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

async function createPedidoTiendaCardTecnico(pedido) {
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

// ========== EVENT LISTENERS ==========

function setupTecnicoEventListeners() {
    try {
        // Navegación del sidebar (debe ir primero)
        const navItems = document.querySelectorAll('.admin-nav-item[data-view]');
        if (navItems.length === 0) {
            console.error('No se encontraron elementos de navegación del sidebar');
            return;
        }
        navItems.forEach(btn => {
            btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const viewName = e.currentTarget.dataset.view;
            if (viewName) {
                showView(viewName);
            }
            });
        });
    
        // Toggle del sidebar (desktop)
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const sidebar = document.getElementById('admin-sidebar');
            if (sidebar) {
                // Solo colapsar/expandir en desktop
                if (window.innerWidth > 768) {
                sidebar.classList.toggle('collapsed');
                }
            }
        });
    }
    
    // Menú hamburguesa para móvil
    const hamburgerBtn = document.getElementById('btn-hamburger-menu');
    const hamburgerBtnPedidos = document.getElementById('btn-hamburger-menu-pedidos');
    const hamburgerBtnHistorico = document.getElementById('btn-hamburger-menu-historico');
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    function openMobileMenu() {
        if (sidebar) {
            sidebar.classList.add('mobile-open');
        }
        if (overlay) {
            overlay.classList.add('active');
        }
        document.body.style.overflow = 'hidden';
    }
    
    function closeMobileMenu() {
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
        }
        if (overlay) {
            overlay.classList.remove('active');
        }
        document.body.style.overflow = '';
    }
    
    function toggleMobileMenu(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }
    
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleMobileMenu);
    }
    
    if (hamburgerBtnPedidos) {
        hamburgerBtnPedidos.addEventListener('click', toggleMobileMenu);
    }
    
    if (hamburgerBtnHistorico) {
        hamburgerBtnHistorico.addEventListener('click', toggleMobileMenu);
    }
    
    // Cerrar menú al hacer clic en el overlay
    if (overlay) {
        overlay.addEventListener('click', () => {
            closeMobileMenu();
        });
    }
    
    // Cerrar menú al hacer clic en un item del menú en móvil
    if (navItems.length > 0) {
        navItems.forEach(btn => {
            const originalHandler = btn.onclick;
            btn.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    closeMobileMenu();
                }
            });
        });
    }
    
    // Cerrar menú al hacer clic en logout en móvil
    const logoutBtn = document.getElementById('btn-logout-tecnico');
    if (logoutBtn) {
        const originalLogoutHandler = logoutBtn.onclick;
        logoutBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
        });
    }
    
    // Cerrar menú al redimensionar la ventana si pasa de móvil a desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });

    // Logout
    document.getElementById('btn-logout-tecnico')?.addEventListener('click', async () => {
        await db.clearSesion();
        currentUser = null;
        currentUserType = null;
        currentObra = null;
        window.location.href = '../index.html';
    });

    // Búsqueda
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
        const container = document.getElementById('tiendas-list-admin');
        if (container) {
            container.className = 'tiendas-grid';
        }
        loadTiendasAdminView();
    });

    document.getElementById('search-input-admin')?.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length > 2) {
            await performSearchAdmin(query);
        } else if (query.length === 0) {
            searchResultsAdmin = [];
            const container = document.getElementById('tiendas-list-admin');
            if (container) {
                container.className = 'tiendas-grid';
            }
            loadTiendasAdminView();
        }
    });

    // Botón de carrito en admin
    document.getElementById('cart-button-admin')?.addEventListener('click', () => {
        showCarritoAdmin();
    });

    // Botones de volver (categorías, productos)
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => {
            const currentView = document.querySelector('.admin-content-view.active');
            if (currentView) {
                const viewId = currentView.id;
                if (viewId === 'view-categorias') {
                    showView('tecnico-tienda');
                    loadTiendasAdminView();
                } else if (viewId === 'view-productos') {
                    if (currentCategoria && currentTienda) {
                        showView('categorias');
                        loadCategoriasAdmin(currentTienda.id);
                    } else {
                        showView('tecnico-tienda');
                        loadTiendasAdminView();
                    }
                }
            }
        });
    });
    
    // Botones de pedidos en curso
    document.getElementById('pedidos-curso-volver-obras')?.addEventListener('click', () => {
        loadPedidosEnCursoTecnico();
    });
    
    document.getElementById('pedidos-curso-cargar-mas-btn')?.addEventListener('click', () => {
        cargarMasPedidosCursoTecnico();
    });
    
    // Botones de histórico
    document.getElementById('historico-volver-obras')?.addEventListener('click', () => {
        loadHistoricoTecnico();
    });
    
    document.getElementById('historico-cargar-mas-btn')?.addEventListener('click', () => {
        cargarMasPedidosHistoricosEncargado();
    });

    // Botón nuevo pedido especial
    document.getElementById('btn-nuevo-pedido-especial-admin')?.addEventListener('click', () => {
        openModalPedidoEspecialAdmin();
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
    }

    if (fotoFileInput) {
        fotoFileInput.addEventListener('change', handleArticuloFotoChangeModal);
    }

    if (fotoRemoveBtn) {
        fotoRemoveBtn.addEventListener('click', removeArticuloFotoModal);
    }

    // Modal pedido especial - cerrar con overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            closeAllModals();
        });
    });

    // Modal pedido especial - cerrar con botón X
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });
    
    } catch (error) {
        console.error('Error al configurar event listeners de encargado:', error);
    }
}

// ========== INICIALIZACIÓN ==========

async function initTecnico() {
    try {
        console.log('Iniciando técnico...');
        
        // Cargar sesión
        const sesion = await db.getSesionCompleta();
        console.log('Sesión cargada:', sesion);
        
        if (!sesion || !sesion.userId) {
            console.log('No hay sesión válida, redirigiendo...');
            window.location.href = '../index.html';
            return;
        }
        
        const usuario = await db.get('usuarios', sesion.userId);
        console.log('Usuario cargado:', usuario);
        console.log('Tipo de usuario:', usuario?.tipo);
        console.log('Comparación con "Técnico":', usuario?.tipo === 'Técnico');
        console.log('Comparación con "Técnico" (trim):', usuario?.tipo?.trim() === 'Técnico');
        
        if (!usuario) {
            console.log('Usuario no encontrado, redirigiendo...');
            window.location.href = '../index.html';
            return;
        }
        
        if (usuario.tipo !== 'Técnico') {
            console.log('Usuario no es técnico. Tipo recibido:', usuario.tipo, 'Tipo esperado: Técnico');
            window.location.href = '../index.html';
            return;
        }
        
        // Usuario válido, continuar
        console.log('Usuario válido, inicializando aplicación...');
        currentUser = usuario;
        currentUserType = 'Técnico';
        currentObra = sesion.obraId ? await db.get('obras', sesion.obraId) : null;

        // Configurar event listeners
        setupTecnicoEventListeners();

        // Cargar vista inicial
        showView('tecnico-tienda');
        // loadTiendas() ya se llama dentro de showView(), no hace falta llamarlo de nuevo
        updateCartCountAdmin();
        
        console.log('Inicialización completada');
    } catch (error) {
        console.error('Error al inicializar técnico:', error);
        console.error('Stack:', error.stack);
        window.location.href = '../index.html';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicializar base de datos primero
        await db.init();
        await db.initDefaultData();
        
        // Inicializar técnico
        await initTecnico();
    } catch (error) {
        console.error('Error al inicializar base de datos:', error);
        window.location.href = '../index.html';
    }
});
