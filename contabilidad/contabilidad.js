// Contabilidad Module - Lógica del perfil de contabilidad
import { db } from '../database.js';

// Variables globales
let currentUser = null;
let currentUserType = null;
let currentTiendaCuenta = null; // Tienda seleccionada en la vista de cuentas
const contabilidadTabBadgeMap = {
    pendientes: 'tab-count-pendientes-pago-contabilidad',
    cuentas: 'tab-count-cuentas-contabilidad',
    especiales: 'tab-count-pedidos-especiales-contabilidad',
    facturas: 'tab-count-facturas-pendientes-contabilidad',
    historico: 'tab-count-historico-contabilidad'
};

const PAGO_ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

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
        const promptInput = document.getElementById('custom-prompt-input');
        const promptOk = document.getElementById('custom-prompt-ok');
        const promptCancel = document.getElementById('custom-prompt-cancel');
        
        promptTitle.textContent = title;
        promptMessage.textContent = message;
        promptInput.value = defaultValue;
        promptPopup.classList.add('active');
        
        setTimeout(() => promptInput.focus(), 100);
        
        const closePrompt = (result) => {
            promptPopup.classList.remove('active');
            promptOk.removeEventListener('click', () => closePrompt(true));
            promptCancel.removeEventListener('click', () => closePrompt(false));
            promptInput.removeEventListener('keypress', handleKeyPress);
            promptPopup.querySelector('.custom-popup-overlay').removeEventListener('click', () => closePrompt(false));
            resolve(result);
        };
        
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                closePrompt(true);
            }
        };
        
        promptOk.addEventListener('click', () => closePrompt(true));
        promptCancel.addEventListener('click', () => closePrompt(false));
        promptInput.addEventListener('keypress', handleKeyPress);
        promptPopup.querySelector('.custom-popup-overlay').addEventListener('click', () => closePrompt(false));
    }).then((confirmed) => {
        if (confirmed) {
            return document.getElementById('custom-prompt-input').value;
        }
        return null;
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

window.togglePedidoSection = function(sectionId, triggerEl) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const isHidden = section.style.display === 'none' || getComputedStyle(section).display === 'none';
    section.style.display = isHidden ? 'block' : 'none';
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

function updateContabilidadTabBadge(tabKey, count) {
    const badgeId = contabilidadTabBadgeMap[tabKey];
    if (!badgeId) return;
    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.textContent = count;
    }
}

function reloadActiveContabilidadTab() {
    const active = document.querySelector('#contabilidad-gestion-view .tab-btn.active');
    if (!active) return;
    const tab = active.dataset.tab;
    if (tab === 'pendientes-pago-contabilidad') {
        loadPedidosContabilidad();
    } else if (tab === 'historico-contabilidad') {
        loadPedidosPagadosContabilidad();
    } else if (tab === 'cuentas-contabilidad') {
        loadCuentasContabilidad();
    } else if (tab === 'pedidos-especiales-contabilidad') {
        loadPedidosEspecialesContabilidad();
    } else if (tab === 'facturas-pendientes-contabilidad') {
        loadFacturasPendientesContabilidad();
    }
}

function switchTabContabilidad(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tab === 'pendientes-pago-contabilidad') {
        document.getElementById('pendientes-pago-contabilidad').classList.add('active');
        loadPedidosContabilidad();
    } else if (tab === 'historico-contabilidad') {
        document.getElementById('historico-contabilidad').classList.add('active');
        loadPedidosPagadosContabilidad();
    } else if (tab === 'cuentas-contabilidad') {
        document.getElementById('cuentas-contabilidad').classList.add('active');
        loadCuentasContabilidad();
    } else if (tab === 'pedidos-especiales-contabilidad') {
        document.getElementById('pedidos-especiales-contabilidad').classList.add('active');
        loadPedidosEspecialesContabilidad();
    } else if (tab === 'facturas-pendientes-contabilidad') {
        document.getElementById('facturas-pendientes-contabilidad').classList.add('active');
        loadFacturasPendientesContabilidad();
    }
}

// Funciones de carga de datos
async function loadPedidosContabilidad() {
    const todosPedidos = await db.getAll('pedidos');
    const todosPedidosEspeciales = await db.getAll('pedidosEspeciales');
    
    // Filtrar pedidos normales pendientes de pago
    const pedidosPendientes = todosPedidos.filter(pedido => {
        if (pedido.estado === 'Completado') return false;
        if (pedido.estadoPago !== 'Pendiente de pago') return false;
        if (!pedido.pedidoSistemaPDF) return false;
        if (pedido.transferenciaPDF) return false;
        return true;
    });
    
    // Filtrar pedidos especiales pendientes de pago con documento adjunto
    const pedidosEspecialesPendientes = todosPedidosEspeciales.filter(pedido => {
        const estadoPago = pedido.estadoPago || 'Pendiente de pago';
        if (estadoPago === 'Sin Asignar' || !estadoPago) {
            // Tratar como pendiente si no tiene estado
        } else if (estadoPago !== 'Pendiente de pago') {
            return false;
        }
        // Debe tener documento adjunto
        if (!pedido.documentoPago) return false;
        // No debe estar pagado ya
        if (pedido.estadoPago === 'Pagado') return false;
        return true;
    });
    
    // Combinar ambos tipos de pedidos
    const todosPendientes = [...pedidosPendientes, ...pedidosEspecialesPendientes];
    
    // Ordenar de más nuevo a más viejo
    todosPendientes.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : (a.fecha ? new Date(a.fecha) : new Date(a.fechaCreacion || 0));
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : (b.fecha ? new Date(b.fecha) : new Date(b.fechaCreacion || 0));
        return fechaB - fechaA;
    });
    
    const container = document.getElementById('pendientes-pago-contabilidad-list');
    const emptyState = document.getElementById('pendientes-pago-contabilidad-empty');
    container.innerHTML = '';
    
    if (todosPendientes.length === 0) {
        emptyState.style.display = 'block';
        updateContabilidadTabBadge('pendientes', 0);
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Mostrar pedidos directamente sin agrupar por obras
    for (const pedido of todosPendientes) {
        // Si es pedido especial, usar la card especial; si no, la card normal
        const card = isPedidoEspecial(pedido) 
            ? await createPedidoEspecialContabilidadCard(pedido)
            : await createPedidoContabilidadCard(pedido);
        container.appendChild(card);
    }
    
    updateContabilidadTabBadge('pendientes', todosPendientes.length);
}

async function loadPedidosPagadosContabilidad() {
    const todosPedidos = await db.getAll('pedidos');
    const pedidosPagados = todosPedidos.filter(p => {
        if (isPedidoEspecial(p)) {
            return p.estadoPago === 'Pagado' && p.documentoPago;
        } else {
            return p.transferenciaPDF && p.albaran;
        }
    });
    const container = document.getElementById('historico-contabilidad-list');
    const emptyState = document.getElementById('historico-contabilidad-empty');
    container.innerHTML = '';
    
    const obras = await getObrasCatalog(pedidosPagados);
    if (obras.length === 0) {
        emptyState.style.display = 'block';
        updateContabilidadTabBadge('historico', 0);
        return;
    }
    
    emptyState.style.display = 'none';
    let totalCount = 0;
    
    // Crear grid de cards de obras
    const grid = document.createElement('div');
    grid.className = 'tiendas-grid';
    
    for (const obra of obras) {
        const obraId = obra.id || 'sin-obra';
        const pedidosObra = pedidosPagados.filter(p => (p.obraId || 'sin-obra') === obraId);
        totalCount += pedidosObra.length;
        
        const card = createObraHistoricoCard(obra, pedidosObra.length, obraId);
        grid.appendChild(card);
    }
    
    container.appendChild(grid);
    updateContabilidadTabBadge('historico', totalCount);
}

function createObraHistoricoCard(obra, pedidosCount, obraId) {
    const card = document.createElement('div');
    card.className = 'obra-card';
    
    const nombreObra = obra.nombreComercial || obra.nombre || 'Obra sin nombre';
    
    card.innerHTML = `
        <div class="obra-card-content">
            <div class="tienda-card-icon">🏗️</div>
            <h3 class="obra-card-nombre">${escapeHtml(nombreObra)}</h3>
            <div class="obra-card-count">
                <strong>${pedidosCount}</strong> pedido${pedidosCount !== 1 ? 's' : ''} histórico${pedidosCount !== 1 ? 's' : ''}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        loadPedidosObraHistorico(obraId);
    });
    
    return card;
}

async function loadPedidosObraHistorico(obraId) {
    const container = document.getElementById('historico-contabilidad-list');
    const emptyState = document.getElementById('historico-contabilidad-empty');
    
    container.innerHTML = '';
    emptyState.style.display = 'none';
    
    // Botón Volver
    const btnVolver = document.createElement('button');
    btnVolver.className = 'btn-volver-historico';
    btnVolver.innerHTML = '← Volver a obras';
    btnVolver.addEventListener('click', () => {
        loadPedidosPagadosContabilidad();
    });
    container.appendChild(btnVolver);
    
    // Obtener pedidos normales de la obra
    const todosPedidos = await db.getAll('pedidos');
    const todosPedidosEspeciales = await db.getAll('pedidosEspeciales');
    
    const pedidosObraNormales = todosPedidos.filter(p => {
        const pObraId = p.obraId || 'sin-obra';
        if (pObraId !== obraId) return false;
        // Excluir pedidos especiales (ya los manejaremos por separado)
        if (isPedidoEspecial(p)) return false;
        return p.transferenciaPDF && p.albaran;
    });
    
    // Obtener pedidos especiales de la obra
    const pedidosObraEspeciales = todosPedidosEspeciales.filter(p => {
        const pObraId = p.obraId || 'sin-obra';
        if (pObraId !== obraId) return false;
        return p.estadoPago === 'Pagado' && p.documentoPago;
    });
    
    // Combinar ambos tipos
    const pedidosObra = [...pedidosObraNormales, ...pedidosObraEspeciales];
    
    pedidosObra.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    if (pedidosObra.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-state';
        emptyMsg.innerHTML = '<p>No hay pedidos históricos para esta obra</p>';
        container.appendChild(emptyMsg);
        return;
    }
    
    // Mostrar pedidos
    for (const pedido of pedidosObra) {
        const card = isPedidoEspecial(pedido)
            ? await createPedidoEspecialContabilidadCard(pedido)
            : await createPedidoContabilidadCard(pedido, true);
        container.appendChild(card);
    }
}

async function loadCuentasContabilidad() {
    const tiendas = await db.getAll('tiendas');
    const tiendasConCuenta = tiendas.filter(t => t.tieneCuenta);
    
    const container = document.getElementById('cuentas-contabilidad-list');
    const emptyState = document.getElementById('cuentas-contabilidad-empty');
    
    container.innerHTML = '';
    currentTiendaCuenta = null;
    
    if (tiendasConCuenta.length === 0) {
        emptyState.style.display = 'block';
        updateContabilidadTabBadge('cuentas', 0);
        return;
    }
    
    emptyState.style.display = 'none';
    
    const todosPedidos = await db.getAll('pedidos');
    const pedidosCuentaGlobal = todosPedidos.filter(p => 
        p.estadoPago === 'Pago A cuenta' &&
        p.estado !== 'Completado' &&
        p.pedidoSistemaPDF &&
        !p.transferenciaPDF
    );
    
    let totalPedidos = 0;
    
    // Crear grid de cards de tiendas
    const grid = document.createElement('div');
    grid.className = 'tiendas-grid';
    
    for (const tienda of tiendasConCuenta) {
        const pedidosTienda = pedidosCuentaGlobal.filter(p => p.tiendaId === tienda.id);
        totalPedidos += pedidosTienda.length;
        
        const card = await createTiendaCuentaCard(tienda, pedidosTienda.length);
        grid.appendChild(card);
    }
    
    container.appendChild(grid);
    updateContabilidadTabBadge('cuentas', totalPedidos);
}

async function createTiendaCuentaCard(tienda, pedidosCount) {
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
        currentTiendaCuenta = tienda;
        loadPedidosTiendaCuenta(tienda.id);
    });
    
    return card;
}

async function loadPedidosTiendaCuenta(tiendaId) {
    const container = document.getElementById('cuentas-contabilidad-list');
    const emptyState = document.getElementById('cuentas-contabilidad-empty');
    
    container.innerHTML = '';
    emptyState.style.display = 'none';
    
    // Botón Volver
    const btnVolver = document.createElement('button');
    btnVolver.className = 'btn-volver-cuentas';
    btnVolver.innerHTML = '← Volver a tiendas';
    btnVolver.addEventListener('click', () => {
        loadCuentasContabilidad();
    });
    container.appendChild(btnVolver);
    
    // Obtener pedidos de la tienda
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
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-state';
        emptyMsg.innerHTML = '<p>No hay pedidos pendientes de pago a cuenta para esta tienda</p>';
        container.appendChild(emptyMsg);
        return;
    }
    
    // Mostrar pedidos
    for (const pedido of pedidosTienda) {
        const card = await createPedidoContabilidadCard(pedido, false);
        container.appendChild(card);
    }
}

async function loadPedidosEspecialesContabilidad() {
    const todosPedidos = await db.getAll('pedidos');
    const pedidosEspeciales = todosPedidos.filter(p => 
        isPedidoEspecial(p) && (p.estadoPago === 'Pendiente de pago' || !p.estadoPago || p.estadoPago === 'Sin Asignar')
    );
    
    // Ordenar de más nuevo a más viejo
    pedidosEspeciales.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    const container = document.getElementById('pedidos-especiales-contabilidad-list');
    const emptyState = document.getElementById('pedidos-especiales-contabilidad-empty');
    container.innerHTML = '';
    
    if (pedidosEspeciales.length === 0) {
        emptyState.style.display = 'block';
        updateContabilidadTabBadge('especiales', 0);
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Mostrar pedidos directamente sin agrupar por obras
    for (const pedido of pedidosEspeciales) {
        const card = await createPedidoEspecialContabilidadCard(pedido);
        container.appendChild(card);
    }
    
    updateContabilidadTabBadge('especiales', pedidosEspeciales.length);
}

async function loadFacturasPendientesContabilidad() {
    const todosPedidos = await db.getAll('pedidos');
    const facturasPendientes = todosPedidos.filter(pedido => {
        if (isPedidoEspecial(pedido)) return false;
        const pagado = pedido.estadoPago === 'Pagado' || Boolean(pedido.transferenciaPDF);
        const sinFactura = !pedido.albaran;
        return pagado && sinFactura;
    });
    
    // Ordenar de más nuevo a más viejo
    facturasPendientes.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    const container = document.getElementById('facturas-pendientes-contabilidad-list');
    const emptyState = document.getElementById('facturas-pendientes-contabilidad-empty');
    container.innerHTML = '';
    
    if (facturasPendientes.length === 0) {
        emptyState.style.display = 'block';
        updateContabilidadTabBadge('facturas', 0);
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Mostrar pedidos directamente sin agrupar por obras
    for (const pedido of facturasPendientes) {
        const card = await createPedidoContabilidadCard(pedido, true);
        container.appendChild(card);
    }
    
    updateContabilidadTabBadge('facturas', facturasPendientes.length);
}

// Funciones auxiliares
async function calcularGastadoCuenta(tiendaId) {
    const pedidos = await db.getPedidosByTienda(tiendaId);
    let gastado = 0;
    
    for (const pedido of pedidos) {
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

function createCuentaInfoBlock(tienda, gastado) {
    const info = document.createElement('div');
    info.className = 'cascade-store-info';
    
    if (tienda.limiteCuenta) {
        const limite = Number(tienda.limiteCuenta) || 0;
        const porcentaje = limite ? (gastado / limite) * 100 : 0;
        const disponible = Math.max(0, limite - gastado);
        const colorBarra = porcentaje >= 100 ? '#ef4444' : porcentaje >= 80 ? '#f59e0b' : '#10b981';
        
        info.innerHTML = `
            <h4>Resumen de cuenta</h4>
            <p><strong>Límite:</strong> ${limite.toFixed(2)} €</p>
            <p><strong>Gastado:</strong> ${gastado.toFixed(2)} €</p>
            <p><strong>Disponible:</strong> ${disponible.toFixed(2)} €</p>
            <div style="margin-top: 0.5rem; height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                <div style="height: 100%; width: ${Math.min(100, porcentaje)}%; background: ${colorBarra};"></div>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">${porcentaje.toFixed(1)}% utilizado</p>
        `;
    } else {
        info.innerHTML = `
            <h4>Resumen de cuenta</h4>
            <p><strong>Gastado:</strong> ${gastado.toFixed(2)} €</p>
            <p style="margin-top: 0.5rem; padding: 0.5rem; background: #d1fae5; border-radius: 6px; color: #065f46; font-weight: 600;">
                Cuenta sin límite de gasto
            </p>
        `;
    }
    
    return info;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Validar tamaño de archivo antes de subirlo a Firestore
// Firestore tiene un límite de 1 MB por documento, y base64 aumenta el tamaño en ~33%
// Por lo tanto, limitamos el archivo original a 750 KB
const MAX_FILE_SIZE_FIRESTORE = 750 * 1024; // 750 KB
const MAX_IMAGE_DIMENSION = 2000; // Máximo de ancho/alto en píxeles

// Comprimir imagen usando Canvas API
async function comprimirImagen(file, maxWidth = MAX_IMAGE_DIMENSION, maxHeight = MAX_IMAGE_DIMENSION, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Calcular nuevas dimensiones manteniendo aspecto
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }
                
                // Crear canvas y dibujar imagen redimensionada
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convertir a blob (JPG para mejor compresión)
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Error al comprimir la imagen'));
                        return;
                    }
                    
                    // Convertir blob a File
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.onerror = () => reject(new Error('Error al cargar la imagen'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsDataURL(file);
    });
}

// Procesar archivo: comprimir si es imagen, validar si es PDF
async function procesarArchivoParaUpload(file) {
    // Si es una imagen, intentar comprimirla
    if (file.type.startsWith('image/')) {
        // Si la imagen ya es pequeña, no comprimir
        if (file.size <= MAX_FILE_SIZE_FIRESTORE) {
            return file;
        }
        
        try {
            // Compresión progresiva: intentar diferentes niveles hasta conseguir el tamaño adecuado
            let compressedFile = await comprimirImagen(file, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, 0.85);
            
            // Si sigue siendo grande, reducir dimensiones y calidad
            if (compressedFile.size > MAX_FILE_SIZE_FIRESTORE) {
                compressedFile = await comprimirImagen(file, 1500, 1500, 0.75);
            }
            
            // Si aún es grande, comprimir más agresivamente
            if (compressedFile.size > MAX_FILE_SIZE_FIRESTORE) {
                compressedFile = await comprimirImagen(file, 1200, 1200, 0.65);
            }
            
            // Último intento: compresión muy agresiva
            if (compressedFile.size > MAX_FILE_SIZE_FIRESTORE) {
                compressedFile = await comprimirImagen(file, 1000, 1000, 0.55);
            }
            
            // Si después de todas las compresiones sigue siendo grande, avisar al usuario
            if (compressedFile.size > MAX_FILE_SIZE_FIRESTORE) {
                const fileSizeKB = (compressedFile.size / 1024).toFixed(0);
                console.warn(`Imagen comprimida pero aún grande: ${fileSizeKB} KB`);
                // Intentar una última compresión más agresiva
                compressedFile = await comprimirImagen(file, 800, 800, 0.45);
            }
            
            return compressedFile;
        } catch (error) {
            console.error('Error al comprimir imagen:', error);
            // Si falla la compresión y el archivo es muy grande, lanzar error
            if (file.size > MAX_FILE_SIZE_FIRESTORE * 2) {
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                throw new Error(`No se pudo comprimir la imagen suficientemente (${fileSizeMB} MB). Por favor, use una imagen más pequeña o comprímala manualmente.`);
            }
            // Si el archivo no es extremadamente grande, devolver el original
            return file;
        }
    }
    
    // Para PDFs, solo validar tamaño
    if (file.type === 'application/pdf') {
        if (file.size > MAX_FILE_SIZE_FIRESTORE) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            throw new Error(`El PDF es demasiado grande (${fileSizeMB} MB). El tamaño máximo permitido es 750 KB. Por favor, comprima el PDF usando una herramienta externa o use un archivo más pequeño.`);
        }
    }
    
    return file;
}

// Descargar o abrir documento desde data URL
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
    }
};

// Funciones de upload
window.uploadPagoCuenta = async function(pedidoId, file, tiendaId) {
    if (!file) return;
    
    if (!PAGO_ALLOWED_MIME.includes(file.type)) {
        await showAlert('Formato no soportado. Adjunte un PDF o imagen (JPG/PNG).', 'Error');
        return;
    }
    
    try {
        // Procesar archivo: comprimir imágenes si es necesario
        const processedFile = await procesarArchivoParaUpload(file);
        
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        const transferenciaPDF = await fileToBase64(processedFile);
        
        pedido.transferenciaPDF = transferenciaPDF;
        pedido.estadoPago = 'Pagado';
        await db.update('pedidos', pedido);
        
        const tienda = await db.get('tiendas', tiendaId);
        if (tienda && tienda.limiteCuenta) {
            const gastado = await calcularGastadoCuenta(tiendaId);
        }
        
        await showAlert('PDF del pago adjuntado correctamente. El pedido se ha marcado como pagado.', 'Éxito');
        
        reloadActiveContabilidadTab();
        loadFacturasPendientesContabilidad();
    } catch (error) {
        console.error('Error al subir pago de cuenta:', error);
        await showAlert('Error al subir el PDF: ' + error.message, 'Error');
        // Limpiar input en caso de error
        const input = document.querySelector(`input[type="file"]:not([id*="pedido-real"]):not([id*="factura"])`);
        if (input) input.value = '';
    }
};

window.uploadTransferencia = async function(pedidoId, file) {
    if (!file) return;
    
    if (!PAGO_ALLOWED_MIME.includes(file.type)) {
        await showAlert('Formato no soportado. Adjunte un PDF o imagen (JPG/PNG).', 'Error');
        return;
    }
    
    try {
        // Procesar archivo: comprimir imágenes si es necesario
        const processedFile = await procesarArchivoParaUpload(file);
        
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        const transferenciaPDF = await fileToBase64(processedFile);
        const estadoAnterior = pedido.estadoPago;
        
        pedido.transferenciaPDF = transferenciaPDF;
        pedido.estadoPago = 'Pagado';
        await db.update('pedidos', pedido);
        
        const tienda = await db.get('tiendas', pedido.tiendaId);
        if (tienda && tienda.limiteCuenta && estadoAnterior === 'Pago A cuenta') {
            const gastado = await calcularGastadoCuenta(tienda.id);
        }
        
        await showAlert('PDF de transferencia adjuntado y pedido marcado como pagado', 'Éxito');
        
        reloadActiveContabilidadTab();
        loadFacturasPendientesContabilidad();
    } catch (error) {
        console.error('Error al subir transferencia:', error);
        await showAlert('Error al subir el PDF: ' + error.message, 'Error');
        // Limpiar input en caso de error
        const input = document.querySelector(`input[type="file"]:not([id*="pedido-real"]):not([id*="factura"])`);
        if (input) input.value = '';
    }
};

window.handlePedidoPagoUpload = async function(pedidoId, inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('No se pudo encontrar el pedido seleccionado', 'Error');
            return;
        }
        if (pedido.estadoPago === 'Pago A cuenta') {
            await uploadPagoCuenta(pedidoId, file, pedido.tiendaId);
        } else {
            await uploadTransferencia(pedidoId, file);
        }
    } catch (error) {
        console.error('Error al adjuntar documento de pago:', error);
        await showAlert('No se pudo adjuntar el documento: ' + error.message, 'Error');
    } finally {
        input.value = '';
    }
};

window.removePedidoPaymentDocument = async function(pedidoId) {
    const confirmar = await showConfirm('¿Desea eliminar el documento de pago adjunto?', 'Eliminar documento');
    if (!confirmar) return;
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido || !pedido.transferenciaPDF) {
            await showAlert('Este pedido no tiene documento de pago para eliminar', 'Información');
            return;
        }
        
        const tienda = await db.get('tiendas', pedido.tiendaId);
        const tieneCuenta = tienda && tienda.tieneCuenta;
        
        pedido.transferenciaPDF = null;
        if (pedido.estadoPago === 'Pagado') {
            pedido.estadoPago = tieneCuenta ? 'Pago A cuenta' : 'Pendiente de pago';
        }
        
        await db.update('pedidos', pedido);
        await showAlert('Documento eliminado correctamente', 'Éxito');
        
        reloadActiveContabilidadTab();
        loadFacturasPendientesContabilidad();
        if (tieneCuenta) {
            loadCuentasContabilidad();
        } else {
            loadPedidosContabilidad();
        }
    } catch (error) {
        console.error('Error al eliminar documento de pago:', error);
        await showAlert('No se pudo eliminar el documento: ' + error.message, 'Error');
    }
};

window.confirmarPagoPedidoEspecial = async function(pedidoId) {
    const confirmar = await showConfirm('¿Desea confirmar que este pedido especial ha sido pagado?', 'Confirmar Pago');
    if (!confirmar) return;
    
    try {
        // Buscar primero en pedidosEspeciales
        let pedido = await db.get('pedidosEspeciales', pedidoId);
        let coleccion = 'pedidosEspeciales';
        
        // Si no lo encuentra, buscar en pedidos
        if (!pedido) {
            pedido = await db.get('pedidos', pedidoId);
            coleccion = 'pedidos';
        }
        
        if (!pedido) {
            await showAlert('No se pudo encontrar el pedido seleccionado', 'Error');
            return;
        }
        
        if (!isPedidoEspecial(pedido)) {
            await showAlert('Este no es un pedido especial', 'Error');
            return;
        }
        
        pedido.estadoPago = 'Pagado';
        
        await db.update(coleccion, pedido);
        await showAlert('Pago confirmado correctamente. El pedido se ha movido al histórico.', 'Éxito');
        
        reloadActiveContabilidadTab();
        loadPedidosPagadosContabilidad();
        
        // Actualizar badge de pendientes
        const todosPedidos = await db.getAll('pedidos');
        const todosPedidosEspeciales = await db.getAll('pedidosEspeciales');
        const pedidosPendientes = todosPedidos.filter(pedido => {
            if (pedido.estado === 'Completado') return false;
            if (pedido.estadoPago !== 'Pendiente de pago') return false;
            if (!pedido.pedidoSistemaPDF) return false;
            if (pedido.transferenciaPDF) return false;
            return true;
        });
        const pedidosEspecialesPendientes = todosPedidosEspeciales.filter(pedido => {
            const estadoPago = pedido.estadoPago || 'Pendiente de pago';
            if (estadoPago === 'Sin Asignar' || !estadoPago) {
                // Tratar como pendiente si no tiene estado
            } else if (estadoPago !== 'Pendiente de pago') {
                return false;
            }
            if (!pedido.documentoPago) return false;
            if (pedido.estadoPago === 'Pagado') return false;
            return true;
        });
        updateContabilidadTabBadge('pendientes', pedidosPendientes.length + pedidosEspecialesPendientes.length);
    } catch (error) {
        console.error('Error al confirmar pago:', error);
        await showAlert('No se pudo confirmar el pago: ' + error.message, 'Error');
    }
};

// Funciones para crear cards de pedidos
// Esta función es muy larga, la incluyo simplificada
async function createPedidoContabilidadCard(pedido, isPagado = false) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card contab-pedido-card';
    
    const tienda = await db.get('tiendas', pedido.tiendaId);
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
    const estadoPago = pedido.estadoPago || (isPagado ? 'Pagado' : 'Pendiente de pago');
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
            const placeholderId = `foto-placeholder-${pedido.id}-${index}`.replace(/[^a-zA-Z0-9-]/g, '-');
            const fotoHtml = fotoUrl
                ? `<img src="${fotoUrl}" alt="${nombre}" class="pedido-item-foto" onerror="this.style.display='none'; document.getElementById('${placeholderId}').style.display='flex';">`
                : '';
            const fotoPlaceholder = `<div id="${placeholderId}" class="pedido-item-foto-placeholder" style="${fotoUrl ? 'display: none;' : ''}">📦</div>`;
            const refEanParts = [];
            if (referencia) refEanParts.push(referencia);
            if (ean) refEanParts.push(ean);
            const refEanText = refEanParts.length > 0 ? refEanParts.join(' | ') : '';
            return `
                <div class="pedido-item" style="display: flex; align-items: center; gap: 1rem;">
                    ${fotoHtml}
                    ${fotoPlaceholder}
                    <div class="pedido-item-info" style="flex: 1;">
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
    
    const tienePago = Boolean(pedido.transferenciaPDF);
    const tieneFactura = Boolean(pedido.albaran);
    const puedeGestionarPago = currentUserType === 'Contabilidad';
    // No permitir eliminar documento de pago solo si el pedido está en histórico (tiene pago Y factura)
    // En histórico: tienePago && tieneFactura = true → puedeEliminarPago = false
    // En otros lugares: puede ser que tenga pago sin factura, o sin pago, etc. → puedeEliminarPago = true (si tiene pago)
    const estaEnHistorico = tienePago && tieneFactura;
    const puedeEliminarPago = puedeGestionarPago && tienePago && !estaEnHistorico;
    const pagoInputId = `pago-upload-${pedido.id}`;
    
    const documentoPagoContent = `
        ${tienePago ? `<a href="#" onclick="descargarDocumento('${pedido.transferenciaPDF.replace(/'/g, "\\'")}', 'documento-pago.pdf'); return false;" class="doc-link">📄 Ver pago</a>` : '<span class="doc-placeholder">Sin documento</span>'}
        ${puedeGestionarPago ? (
            tienePago
                ? (puedeEliminarPago ? `<button class="emoji-btn danger" type="button" aria-label="Eliminar documento de pago" onclick="removePedidoPaymentDocument('${pedido.id}')">✖️</button>` : '')
                : `<button class="emoji-btn" type="button" aria-label="Adjuntar documento de pago" onclick="document.getElementById('${pagoInputId}').click()">➕</button>`
        ) : ''}
    `;
    
    const itemsSectionId = `pedido-items-${pedido.id}`;
    const notasSectionId = `pedido-notas-${pedido.id}`;
    const notasListId = `pedido-notas-list-${pedido.id}`;
    const notasCountId = `pedido-notas-count-${pedido.id}`;
    const notaInputId = `pedido-nota-input-${pedido.id}`;
    
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
                    <span class="estado-pago-pill ${estadoPagoClass}">${escapeHtml(estadoPago)}</span>
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
                ${puedeGestionarPago ? `<input type="file" id="${pagoInputId}" style="display: none;" accept=".pdf,.jpg,.jpeg,.png" onchange="handlePedidoPagoUpload('${pedido.id}', '${pagoInputId}')">` : ''}
            </div>
            
            <!-- Card: Artículos (siempre visible) -->
            <div class="contab-info-card-compact contab-card-articulos" id="articulos-card-${pedido.id}">
                <div class="contab-card-title-compact">
                    <span>Artículos (${items.length})</span>
                    <span class="contab-total-compact" style="font-size: 0.7rem; color: var(--primary-color);">Total: ${formatCurrency(totalPedido)}</span>
                </div>
                <div class="pedido-items-list-compact">
                    ${itemsHtml}
                </div>
                ${items.length > 3 ? `
                    <button class="expand-arrow" type="button" onclick="toggleExpandArticulos('${pedido.id}')" title="Expandir para ver todos los artículos">
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
    
    return card;
}

// Función para expandir/colapsar artículos
function toggleExpandArticulos(pedidoId) {
    const articulosCard = document.getElementById(`articulos-card-${pedidoId}`);
    if (articulosCard) {
        articulosCard.classList.toggle('expanded');
    }
}

// Esta función es muy larga, la incluyo simplificada
async function createPedidoEspecialContabilidadCard(pedido) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card contab-pedido-card';
    
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
    let estadoPago = pedido.estadoPago || 'Pendiente de pago';
    if (estadoPago === 'Sin Asignar' || !estadoPago) {
        estadoPago = 'Pendiente de pago';
    }
    const estadoPagoClass = getEstadoPagoPillClass(estadoPago);
    
    const proveedorNombre = escapeHtml(pedido.proveedorNombre || 'Proveedor desconocido');
    const proveedorDescripcion = escapeHtml(pedido.proveedorDescripcion || '');
    const persona = escapeHtml(pedido.persona || 'Sin especificar');
    const obraNombreTexto = obraInfo?.nombreComercial || pedido.obraNombre || 'Obra no especificada';
    const obraNombre = escapeHtml(obraNombreTexto);
    const obraLink = buildObraMapsLink(obraInfo, obraNombreTexto);
    const obraLinkHref = obraLink ? escapeHtml(obraLink) : null;
    const encargado = escapeHtml(obraInfo?.encargado || 'No asignado');
    const telefonoEncargado = escapeHtml(obraInfo?.telefonoEncargado || '');
    const encargadoInfo = telefonoEncargado ? `${encargado} | ${telefonoEncargado}` : encargado;
    
    const articulos = Array.isArray(pedido.articulos) ? pedido.articulos : [];
    let notas = [];
    if (Array.isArray(pedido.notas)) {
        notas = pedido.notas;
    } else if (pedido.notas && typeof pedido.notas === 'string') {
        notas = [{
            id: 'nota-original',
            usuarioId: null,
            usuarioNombre: pedido.persona || 'Usuario',
            usuarioTipo: 'Técnico',
            mensaje: pedido.notas,
            timestamp: pedido.fecha?.toDate ? pedido.fecha.toDate().toISOString() : (pedido.fecha ? new Date(pedido.fecha).toISOString() : new Date().toISOString())
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
            const placeholderId = `foto-placeholder-especial-contab-${pedido.id}-${index}`.replace(/[^a-zA-Z0-9-]/g, '-');
            const fotoHtml = fotoUrl
                ? `<img src="${fotoUrl}" alt="${nombre}" class="pedido-item-foto" onerror="this.style.display='none'; document.getElementById('${placeholderId}').style.display='flex';">`
                : '';
            const fotoPlaceholder = `<div id="${placeholderId}" class="pedido-item-foto-placeholder" style="${fotoUrl ? 'display: none;' : ''}">✕</div>`;
            return `
                <div class="pedido-item">
                    ${fotoHtml}
                    ${fotoPlaceholder}
                    <div class="pedido-item-info">
                        <p class="pedido-item-name">${nombre}</p>
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
    
    const tieneDocumentoPago = Boolean(pedido.documentoPago);
    const puedeConfirmarPago = currentUserType === 'Contabilidad';
    const documentoPagoContent = tieneDocumentoPago
        ? `<a href="#" onclick="descargarDocumento('${pedido.documentoPago.replace(/'/g, "\\'")}', 'documento-pago.pdf'); return false;" class="doc-link">📄 Ver documento de pago</a>`
        : '<span class="doc-placeholder">Sin documento</span>';
    
    const itemsSectionId = `pedido-items-especial-contab-${pedido.id}`;
    const notasSectionId = `pedido-notas-especial-contab-${pedido.id}`;
    const notasListId = `pedido-notas-list-especial-contab-${pedido.id}`;
    const notasCountId = `pedido-notas-count-especial-contab-${pedido.id}`;
    const notaInputId = `pedido-nota-input-especial-contab-${pedido.id}`;
    
    card.innerHTML = `
        <div class="contab-pedido-header">
            <div>
                <p class="pedido-code">Pedido Especial #${escapeHtml(pedido.id)}</p>
                <div class="contab-estado-envio">
                    <span>Estado de envío:</span>
                    <span class="estado-envio-pill estado-${estadoEnvioClass}">${escapeHtml(estadoEnvio)}</span>
                </div>
            </div>
        </div>
        <div class="contab-info-grid">
            <div class="contab-info-card">
                <div class="contab-card-title">Datos del pedido</div>
                <div class="contab-info-row"><span>Proveedor</span><strong>${proveedorNombre}</strong></div>
                ${proveedorDescripcion ? `<div class="contab-info-row"><span>Descripción</span><strong>${proveedorDescripcion}</strong></div>` : ''}
                <div class="contab-info-row"><span>Pedido por</span><strong>${persona}</strong></div>
                <div class="contab-info-row">
                    <span>Obra</span>
                    <strong>${obraLinkHref ? `<a href="${obraLinkHref}" target="_blank" rel="noopener">${obraNombre}</a>` : obraNombre}</strong>
                </div>
                <div class="contab-info-row"><span>Encargado de la obra</span><strong>${encargadoInfo}</strong></div>
                <div class="contab-info-row"><span>Fecha</span><strong>${escapeHtml(fechaFormateada || '')}</strong></div>
            </div>
            <div class="contab-info-card">
                <div class="contab-card-title">Estado de pago</div>
                <div class="contab-info-row">
                    <span>Estado</span>
                    <span class="estado-pago-pill ${estadoPagoClass}">${escapeHtml(estadoPago)}</span>
                </div>
                <div class="contab-info-row">
                    <span>Documento de pago</span>
                    <div class="doc-actions">${documentoPagoContent}</div>
                </div>
                ${puedeConfirmarPago && tieneDocumentoPago && estadoPago === 'Pendiente de pago' ? `
                <div class="contab-info-row">
                    <span></span>
                    <button class="btn btn-primary" type="button" onclick="confirmarPagoPedidoEspecial('${pedido.id}')" style="width: 100%; margin-top: 0.5rem;">
                        ✓ Confirmar Pago
                    </button>
                </div>
                ` : ''}
            </div>
        </div>
        <div>
            <button class="contab-toggle" type="button" data-open-label="Ocultar artículos" data-close-label="Ver artículos del pedido" onclick="togglePedidoSection('${itemsSectionId}', this)">
                <span class="toggle-text">Ver artículos del pedido</span>
                <span class="chevron">▼</span>
            </button>
            <div id="${itemsSectionId}" class="contab-collapse" style="display: none;">
                <div class="pedido-items-header">
                    <p class="contab-total">Total pedido: ${formatCurrency(totalPedido)}</p>
                </div>
                <div class="pedido-items-list">
                    ${itemsHtml}
                </div>
            </div>
        </div>
        <div class="contab-notes-block">
            <button class="contab-toggle" type="button" data-open-label="Ocultar comentarios" data-close-label="Ver comentarios del pedido" onclick="togglePedidoSection('${notasSectionId}', this)">
                <div class="toggle-label">
                    <span class="toggle-text">Ver comentarios del pedido</span>
                    <span class="toggle-extra">( <span id="${notasCountId}">${notas.length}</span> )</span>
                </div>
                <span class="chevron">▼</span>
            </button>
            <div id="${notasSectionId}" class="contab-collapse" style="display: none;">
                <textarea id="${notaInputId}" class="contab-note-input" placeholder="Escribe un comentario para este pedido..."></textarea>
                <div class="contab-note-actions">
                    <button class="btn btn-primary" type="button" onclick="guardarNotaPedido('${pedido.id}', '${notaInputId}', '${notasListId}', '${notasCountId}')">Guardar</button>
                </div>
                <div id="${notasListId}" class="pedido-notas-list"></div>
            </div>
        </div>
    `;
    
    const notasListElement = card.querySelector(`#${notasListId}`);
    const notasCountElement = card.querySelector(`#${notasCountId}`);
    renderPedidoNotasUI(pedido.id, notas, notasListElement, notasCountElement);
    
    return card;
}

function renderPedidoNotasUI(pedidoId, notas = [], listElement, countElement) {
    const listEl = listElement || document.getElementById(`pedido-notas-list-${pedidoId}`);
    const countEl = countElement || document.getElementById(`pedido-notas-count-${pedidoId}`);
    if (countEl) {
        countEl.textContent = notas.length || 0;
    }
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!Array.isArray(notas) || notas.length === 0) {
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
    } catch (error) {
        console.error('Error al guardar nota:', error);
        await showAlert('No se pudo guardar la nota: ' + error.message, 'Error');
    }
};

// Event listeners
// Función para mostrar vista de contabilidad
function showContabilidadView(viewName) {
    // Ocultar todas las vistas
    document.querySelectorAll('.admin-content-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Mostrar la vista seleccionada
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
    }
}

// Event listeners - Usar delegación de eventos para máxima robustez
let contabilidadEventListenersSetup = false;

function setupContabilidadEventListeners() {
    // Evitar agregar listeners múltiples veces
    if (contabilidadEventListenersSetup) {
        return;
    }
    contabilidadEventListenersSetup = true;

    // Toggle sidebar contabilidad - delegación en el documento
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-toggle-sidebar-contabilidad')) {
            e.preventDefault();
            e.stopPropagation();
            const sidebar = document.getElementById('contabilidad-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
            }
        }
    });

    // Logout - delegación en el documento
    document.addEventListener('click', async (e) => {
        if (e.target.closest('#btn-logout-contabilidad')) {
            e.preventDefault();
            e.stopPropagation();
            await db.clearSesion();
            currentUser = null;
            currentUserType = null;
            window.location.href = '../index.html';
        }
    });

    // Contabilidad sidebar navigation - delegación en el sidebar
    const sidebar = document.getElementById('contabilidad-sidebar');
    if (sidebar) {
        sidebar.addEventListener('click', (e) => {
            const navItem = e.target.closest('.admin-nav-item');
            if (!navItem || navItem.id === 'btn-logout-contabilidad') return;
            
            const viewName = navItem.dataset.view;
            if (viewName) {
                e.preventDefault();
                e.stopPropagation();
                showContabilidadView(viewName);
                
                // Actualizar estado activo
                document.querySelectorAll('#contabilidad-sidebar .admin-nav-item').forEach(btn => {
                    if (btn.id !== 'btn-logout-contabilidad') {
                        btn.classList.remove('active');
                    }
                });
                navItem.classList.add('active');
            }
        });
    }

    // Tabs principales - delegación de eventos en el documento (más robusto)
    document.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('#contabilidad-gestion-view .tab-btn');
        if (tabBtn && tabBtn.dataset.tab) {
            e.preventDefault();
            e.stopPropagation();
            const tab = tabBtn.dataset.tab;
            if (typeof switchTabContabilidad === 'function') {
                switchTabContabilidad(tab);
            }
        }
    });
    
    // Escuchar eventos de cambio de estado de pedidos desde tienda
    window.addEventListener('pedidoEstadoCambiado', async (e) => {
        const { nuevoEstado } = e.detail;
        // Si el estado es "Pendiente de pago" y estamos en la vista de contabilidad,
        // recargar la pestaña de pendientes de pago
        if (nuevoEstado === 'Pendiente de pago') {
            const activeTab = document.querySelector('#contabilidad-gestion-view .tab-btn.active');
            if (activeTab && activeTab.dataset.tab === 'pendientes-pago-contabilidad') {
                // Si estamos viendo la pestaña de pendientes, recargar
                loadPedidosContabilidad();
            } else {
                // Si no, solo actualizar el badge
                const todosPedidos = await db.getAll('pedidos');
                const todosPedidosEspeciales = await db.getAll('pedidosEspeciales');
                const pedidosPendientes = todosPedidos.filter(pedido => {
                    if (pedido.estado === 'Completado') return false;
                    if (pedido.estadoPago !== 'Pendiente de pago') return false;
                    if (!pedido.pedidoSistemaPDF) return false;
                    if (pedido.transferenciaPDF) return false;
                    return true;
                });
                const pedidosEspecialesPendientes = todosPedidosEspeciales.filter(pedido => {
                    const estadoPago = pedido.estadoPago || 'Pendiente de pago';
                    if (estadoPago === 'Sin Asignar' || !estadoPago) {
                        // Tratar como pendiente si no tiene estado
                    } else if (estadoPago !== 'Pendiente de pago') {
                        return false;
                    }
                    if (!pedido.documentoPago) return false;
                    if (pedido.estadoPago === 'Pagado') return false;
                    return true;
                });
                updateContabilidadTabBadge('pendientes', pedidosPendientes.length + pedidosEspecialesPendientes.length);
            }
        }
    });
}

// Inicialización
async function initContabilidad() {
    try {
        // Cargar sesión
        const sesion = await db.getSesionCompleta();
        
        if (!sesion || !sesion.userId) {
            window.location.href = '../index.html';
            return;
        }
        
        // Cargar el usuario
        const usuario = await db.get('usuarios', sesion.userId);
        
        if (!usuario) {
            window.location.href = '../index.html';
            return;
        }
        
        // Validar que el usuario sea de tipo Contabilidad
        if (usuario.tipo !== 'Contabilidad') {
            window.location.href = '../index.html';
            return;
        }
        
        // Usuario válido, continuar
        currentUser = usuario;
        currentUserType = 'Contabilidad';

        // Mostrar vista inicial de Gestión primero
        showContabilidadView('contabilidad-gestion');

        // Esperar a que el DOM esté completamente renderizado
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Configurar event listeners
                setupContabilidadEventListeners();

                // Cargar vista inicial
                if (typeof switchTabContabilidad === 'function') {
                    switchTabContabilidad('pendientes-pago-contabilidad');
                }
            });
        });
    } catch (error) {
        console.error('Error al inicializar contabilidad:', error);
        window.location.href = '../index.html';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicializar base de datos primero
        await db.init();
        await db.initDefaultData();
        
        // Inicializar contabilidad
        await initContabilidad();
    } catch (error) {
        console.error('Error al inicializar base de datos:', error);
        window.location.href = '../index.html';
    }
});

