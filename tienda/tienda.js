// Tienda Module - Lógica del perfil de tienda
import { db } from '../database.js';

// Variables globales
let currentUser = null;
let currentUserType = null;
let currentTienda = null;

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

// Calcular gastado total de cuenta (suma de todos los pedidos con estadoPago = 'Pago A cuenta')
async function calcularGastadoTotalCuenta(tiendaId) {
    const pedidos = await db.getPedidosByTienda(tiendaId);
    let gastado = 0;
    
    for (const pedido of pedidos) {
        // Sumar todos los pedidos con estadoPago = 'Pago A cuenta'
        if (pedido.estadoPago === 'Pago A cuenta') {
            const totalPedido = pedido.items.reduce((total, item) => {
                const precioItem = item.precio || 0;
                const cantidad = item.cantidad || 0;
                return total + (precioItem * cantidad);
            }, 0);
            gastado += totalPedido;
        }
    }
    
    return gastado;
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

// Función auxiliar para actualizar badges
function updateTabBadge(tabName, count) {
    const badge = document.getElementById(`tab-count-${tabName}`);
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}

// Funciones de navegación (definidas más abajo para evitar duplicación)

// ========== FUNCIONES DE CARGA DE PEDIDOS PARA TIENDA ==========

// Pestaña 1: Seleccionar Pago
async function loadPedidosSeleccionarPago() {
    if (!currentTienda) return;
    
    const tiendaId = currentTienda.id;
    const pedidos = await db.getPedidosByTienda(tiendaId);
    
    // Pedidos que están en "Seleccionar Pago":
    // 1. Sin asignar método de pago y sin pedido real
    // 2. O tienen estado "Pendiente de pago" o "Pago A cuenta" pero aún NO tienen pedido real adjunto
    const pedidosSeleccionar = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        const tienePedidoReal = Boolean(p.pedidoSistemaPDF);
        // Debe estar sin pedido real adjunto Y (sin asignar método de pago O tener Pendiente de pago/Pago A cuenta sin pedido real)
        return !tienePedidoReal && 
               (estadoPago === 'Sin Asignar' || estadoPago === 'Pendiente de pago' || estadoPago === 'Pago A cuenta') &&
               p.estado !== 'Completado' && 
               !p.esPedidoEspecial;
    });
    
    const container = document.getElementById('seleccionar-pago-list');
    const emptyState = document.getElementById('seleccionar-pago-empty');
    
    updateTabBadge('seleccionar-pago', pedidosSeleccionar.length);
    
    if (pedidosSeleccionar.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    for (const pedido of pedidosSeleccionar) {
        const card = await createPedidoTiendaCard(pedido, 'seleccionar-pago');
        container.appendChild(card);
    }
}

// Pestaña 2: Modificación de Pedido
async function loadModificacionPedidoTienda() {
    if (!currentTienda) return;
    
    const tiendaId = currentTienda.id;
    const solicitudesModificacion = await db.getSolicitudesModificacionByTienda(tiendaId);
    
    // Filtrar solo las solicitudes pendientes
    const solicitudesPendientes = solicitudesModificacion.filter(s => s.estado === 'Pendiente');
    
    const container = document.getElementById('modificacion-pedido-list');
    const emptyState = document.getElementById('modificacion-pedido-empty');
    
    updateTabBadge('modificacion-pedido', solicitudesPendientes.length);
    
    if (solicitudesPendientes.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    // Ordenar por fecha (más recientes primero)
    solicitudesPendientes.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    for (const solicitud of solicitudesPendientes) {
        const pedido = await db.get('pedidos', solicitud.pedidoId);
        if (!pedido) continue;
        
        const usuario = await db.get('usuarios', solicitud.userId);
        const card = createSolicitudModificacionCard(solicitud, pedido, usuario);
        container.appendChild(card);
    }
}

// Pestaña 3: Pendientes de Pago
async function loadPedidosPendientesPago() {
    if (!currentTienda) return;
    
    const tiendaId = currentTienda.id;
    const pedidos = await db.getPedidosByTienda(tiendaId);
    
    // Pedidos con estadoPago = "Pendiente de pago" y pedido real adjunto
    const pedidosPendientes = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        const tienePedidoReal = Boolean(p.pedidoSistemaPDF);
        return estadoPago === 'Pendiente de pago' && tienePedidoReal && p.estado !== 'Completado' && !p.esPedidoEspecial;
    });
    
    const container = document.getElementById('pendientes-pago-list');
    const emptyState = document.getElementById('pendientes-pago-empty');
    
    updateTabBadge('pendientes-pago', pedidosPendientes.length);
    
    if (pedidosPendientes.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    for (const pedido of pedidosPendientes) {
        const card = await createPedidoTiendaCard(pedido, 'pendientes-pago');
        container.appendChild(card);
    }
}

// Pestaña 3: Pagados (con sub-pestañas)
async function loadPedidosPagadosTienda(estadoLogistico) {
    if (!currentTienda) return;
    
    const tiendaId = currentTienda.id;
    const pedidos = await db.getPedidosByTienda(tiendaId);
    
    // Pedidos con estadoPago = "Pagado" (tiene transferenciaPDF)
    const pedidosPagados = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        const tieneTransferencia = Boolean(p.transferenciaPDF);
        const estadoLog = p.estadoLogistico || 'Nuevo';
        return (estadoPago === 'Pagado' || tieneTransferencia) && 
               estadoLog === estadoLogistico && 
               p.estado !== 'Completado' && 
               !p.esPedidoEspecial;
    });
    
    // Normalizar nombre del estado para IDs
    const estadoNormalizado = estadoLogistico.toLowerCase().replace(/\s+/g, '-');
    const containerId = `pagados-${estadoNormalizado}-list`;
    const emptyStateId = `pagados-${estadoNormalizado}-empty`;
    const container = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyStateId);
    
    if (!container || !emptyState) return;
    
    // Actualizar badge total de pagados
    const todosPagados = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        const tieneTransferencia = Boolean(p.transferenciaPDF);
        return (estadoPago === 'Pagado' || tieneTransferencia) && p.estado !== 'Completado' && !p.esPedidoEspecial;
    });
    updateTabBadge('pagados', todosPagados.length);
    
    if (pedidosPagados.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    for (const pedido of pedidosPagados) {
        const card = await createPedidoTiendaCard(pedido, 'pagados');
        container.appendChild(card);
    }
}

// Pestaña 4: Pago A Cuenta (con sub-pestañas)
async function loadPedidosPagoCuentaTienda(estadoLogistico) {
    if (!currentTienda) return;
    
    const tiendaId = currentTienda.id;
    const pedidos = await db.getPedidosByTienda(tiendaId);
    
    // Pedidos con estadoPago = "Pago A cuenta"
    const pedidosCuenta = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        const estadoLog = p.estadoLogistico || 'Nuevo';
        return estadoPago === 'Pago A cuenta' && 
               estadoLog === estadoLogistico && 
               p.estado !== 'Completado' && 
               !p.esPedidoEspecial;
    });
    
    // Normalizar nombre del estado para IDs
    const estadoNormalizado = estadoLogistico.toLowerCase().replace(/\s+/g, '-');
    const containerId = `pago-cuenta-${estadoNormalizado}-list`;
    const emptyStateId = `pago-cuenta-${estadoNormalizado}-empty`;
    const container = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyStateId);
    
    if (!container || !emptyState) return;
    
    // Actualizar badge total de pago a cuenta
    const todosCuenta = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        return estadoPago === 'Pago A cuenta' && p.estado !== 'Completado' && !p.esPedidoEspecial;
    });
    updateTabBadge('pago-cuenta', todosCuenta.length);
    
    if (pedidosCuenta.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    for (const pedido of pedidosCuenta) {
        const card = await createPedidoTiendaCard(pedido, 'pago-cuenta');
        container.appendChild(card);
    }
}

// Pestaña 5: Facturas Pendientes
async function loadPedidosFacturasPendientesTienda() {
    if (!currentTienda) return;
    
    const tiendaId = currentTienda.id;
    const pedidos = await db.getPedidosByTienda(tiendaId);
    
    // Pedidos que deben ir a facturas pendientes:
    // 1. Camino 1: estadoPago = "Pagado" + estadoLogistico = "Entregado" (sin factura)
    // 2. Camino 2: estadoPago = "Pagado" (tiene transferencia) + estadoLogistico = "Entregado" (sin factura)
    const pedidosFacturas = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        const tieneTransferencia = Boolean(p.transferenciaPDF);
        const estadoLog = p.estadoLogistico || 'Nuevo';
        const tieneFactura = Boolean(p.albaran);
        
        const esPagado = estadoPago === 'Pagado' || tieneTransferencia;
        const esEntregado = estadoLog === 'Entregado';
        
        return esPagado && esEntregado && !tieneFactura && p.estado !== 'Completado' && !p.esPedidoEspecial;
    });
    
    const container = document.getElementById('facturas-pendientes-list');
    const emptyState = document.getElementById('facturas-pendientes-empty');
    
    updateTabBadge('facturas-pendientes', pedidosFacturas.length);
    
    if (pedidosFacturas.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    for (const pedido of pedidosFacturas) {
        const card = await createPedidoTiendaCard(pedido, 'facturas-pendientes');
        container.appendChild(card);
    }
}

// Pestaña 6: Histórico

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Funciones de upload
window.uploadPagoCuenta = async function(pedidoId, file, tiendaId) {
    if (!file) return;
    
    if (!PAGO_ALLOWED_MIME.includes(file.type)) {
        await showAlert('Formato no soportado. Adjunte un PDF o imagen (JPG/PNG).', 'Error');
        return;
    }
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        const transferenciaPDF = await fileToBase64(file);
        
        pedido.transferenciaPDF = transferenciaPDF;
        pedido.estadoPago = 'Pagado';
        await db.update('pedidos', pedido);
        
        // No necesitamos calcular gastado en tienda (eso es para contabilidad)
        
        await showAlert('PDF del pago adjuntado correctamente. El pedido se ha marcado como pagado.', 'Éxito');
        
        // Recargar pestañas relevantes
        loadPedidosSeleccionarPago();
        loadPedidosPendientesPago();
        loadPedidosFacturasPendientesTienda();
    } catch (error) {
        console.error('Error al subir pago de cuenta:', error);
        await showAlert('Error al subir el PDF: ' + error.message, 'Error');
    }
};

window.uploadTransferencia = async function(pedidoId, file) {
    if (!file) return;
    
    if (!PAGO_ALLOWED_MIME.includes(file.type)) {
        await showAlert('Formato no soportado. Adjunte un PDF o imagen (JPG/PNG).', 'Error');
        return;
    }
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        const transferenciaPDF = await fileToBase64(file);
        const estadoAnterior = pedido.estadoPago;
        
        pedido.transferenciaPDF = transferenciaPDF;
        pedido.estadoPago = 'Pagado';
        await db.update('pedidos', pedido);
        
        // No necesitamos calcular gastado en tienda (eso es para contabilidad)
        
        await showAlert('PDF de transferencia adjuntado y pedido marcado como pagado', 'Éxito');
        
        // Recargar pestañas relevantes
        loadPedidosSeleccionarPago();
        loadPedidosPendientesPago();
        loadPedidosFacturasPendientesTienda();
    } catch (error) {
        console.error('Error al subir transferencia:', error);
        await showAlert('Error al subir el PDF: ' + error.message, 'Error');
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
        
        // Recargar pestañas relevantes
        loadPedidosSeleccionarPago();
        loadPedidosPendientesPago();
        loadPedidosFacturasPendientesTienda();
    } catch (error) {
        console.error('Error al eliminar documento de pago:', error);
        await showAlert('No se pudo eliminar el documento: ' + error.message, 'Error');
    }
};

// Función eliminada: confirmarPagoPedidoEspecial - No se usa en tienda (solo en contabilidad)

// Funciones para crear cards de pedidos
function createSolicitudModificacionCard(solicitud, pedido, usuario) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card';
    
    let fecha;
    let fechaObj;
    if (solicitud.fecha && solicitud.fecha.toDate) {
        fechaObj = solicitud.fecha.toDate();
    } else if (solicitud.fecha) {
        fechaObj = new Date(solicitud.fecha);
    } else if (solicitud.createdAt && solicitud.createdAt.toDate) {
        fechaObj = solicitud.createdAt.toDate();
    } else if (solicitud.createdAt) {
        fechaObj = new Date(solicitud.createdAt);
    } else {
        fechaObj = new Date();
    }
    
    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const año = fechaObj.getFullYear();
    fecha = `${dia}/${mes}/${año}`;
    
    const obraNombre = pedido.obraNombreComercial || pedido.obra || 'Obra no especificada';
    
    const telefonoUsuario = usuario?.telefono || pedido.obraTelefono || 'No disponible';
    const usuarioNombre = usuario ? usuario.username : pedido.persona;
    
    card.innerHTML = `
        <div class="pedido-gestion-header">
            <div class="pedido-gestion-info">
                <h4>Solicitud de Modificación de Cantidad</h4>
                <p><strong>Usuario:</strong> ${usuarioNombre}${telefonoUsuario !== 'No disponible' ? ` | Tel: ${telefonoUsuario}` : ''}</p>
                <p><strong>Obra:</strong> ${obraNombre}</p>
                <p><strong>Pedido:</strong> #${pedido.id}</p>
                <p style="font-size: 0.75rem; color: var(--text-secondary);">${fecha}</p>
            </div>
            <span class="pedido-estado estado-pendiente">Pendiente</span>
        </div>
        <div class="pedido-items">
            <div class="pedido-item" style="padding: 0.75rem; background: var(--bg-color); border-radius: 8px;">
                <p><strong>Solicitud:</strong> Modificar cantidad de artículo</p>
                <div style="margin-top: 0.5rem;">
                    <strong>${solicitud.item.nombre}</strong>
                    ${solicitud.item.descripcion ? `<p style="font-size: 0.875rem; color: var(--text-secondary);">${solicitud.item.descripcion}</p>` : ''}
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                        Cantidad actual: <strong>x${solicitud.cantidadActual}</strong><br>
                        Cantidad solicitada: <strong>x${solicitud.cantidadSolicitada}</strong>
                    </p>
                </div>
            </div>
        </div>
        <div class="pedido-actions" style="display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <button class="btn btn-danger" onclick="rechazarSolicitudModificacion('${solicitud.id}')" style="flex: 1;">
                Rechazar
            </button>
            <button class="btn btn-primary" onclick="aceptarSolicitudModificacion('${solicitud.id}')" style="flex: 1;">
                Aceptar
            </button>
        </div>
    `;
    
    return card;
}

// Función para crear cards de pedidos de tienda
async function createPedidoTiendaCard(pedido, tabContext) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card contab-pedido-card';
    
    const tienda = await db.get('tiendas', pedido.tiendaId);
    const obraInfo = pedido.obraId ? await db.get('obras', pedido.obraId) : null;
    
    // Formatear fecha
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
    
    // Información de la obra
    const obraNombreTexto = obraInfo?.nombreComercial || pedido.obraNombreComercial || pedido.obra || 'Obra no especificada';
    const obraNombre = escapeHtml(obraNombreTexto);
    const obraLink = buildObraMapsLink(obraInfo || { direccionGoogleMaps: pedido.obraDireccionGoogleMaps }, obraNombreTexto);
    const obraLinkHref = obraLink ? escapeHtml(obraLink) : null;
    const encargado = escapeHtml(obraInfo?.encargado || pedido.obraEncargado || 'No asignado');
    const telefonoEncargado = escapeHtml(obraInfo?.telefonoEncargado || pedido.obraTelefono || '');
    const encargadoInfo = telefonoEncargado ? `${encargado} | ${telefonoEncargado}` : encargado;
    
    // Estado de pago y logístico
    const estadoPago = pedido.estadoPago || 'Sin Asignar';
    const estadoPagoClass = getEstadoPagoPillClass(estadoPago);
    const estadoEnvio = pedido.estado || 'Nuevo';
    const estadoEnvioClass = estadoEnvio.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
    const estadoLogistico = pedido.estadoLogistico || 'Nuevo';
    const tieneTransferencia = Boolean(pedido.transferenciaPDF);
    
    // Información de la tienda y persona
    const tiendaNombre = escapeHtml(tienda?.nombre || 'Desconocida');
    const persona = escapeHtml(pedido.persona || pedido.usuarioNombre || 'Sin especificar');
    
    // Generar contenido de estado de pago según el contexto
    let estadoPagoContent = '';
    let pedidoRealContent = '';
    let documentoPagoContent = '';
    let facturaContent = '';
    
    // IDs para inputs de archivos
    const pedidoRealInputId = `pedido-real-${pedido.id}`;
    const facturaInputId = `factura-${pedido.id}`;
    
    if (tabContext === 'seleccionar-pago') {
        // Pestaña 1: Seleccionar Pago - Permitir seleccionar método de pago con estilo pill
        const getPillColor = (estado) => {
            if (estado === 'Pendiente de pago') return '#ef4444';
            if (estado === 'Pago A cuenta') return '#3b82f6';
            if (estado === 'Pagado') return '#10b981';
            return '#9ca3af'; // "Sin Asignar" - blanco-grisáceo
        };
        const getTextColor = (estado) => {
            if (estado === 'Sin Asignar') return '#1f2937'; // Texto oscuro para fondo claro
            return 'white'; // Texto blanco para fondos de color
        };
        const getArrowColor = (estado) => {
            if (estado === 'Sin Asignar') return '#1f2937'; // Flecha oscura para fondo claro
            return 'white'; // Flecha blanca para fondos de color
        };
        
        const pillColor = getPillColor(estadoPago);
        const textColor = getTextColor(estadoPago);
        const arrowColor = getArrowColor(estadoPago);
        
        const selectId = `estado-pago-select-${pedido.id}`;
        estadoPagoContent = `
            <select id="${selectId}" class="estado-pago-select" 
                    onchange="updateEstadoPagoTiendaSelect('${pedido.id}', this.value, '${selectId}')" 
                    style="padding: 0.35rem 2rem 0.35rem 0.85rem; border-radius: 999px; font-size: 0.8rem; font-weight: 700; color: ${textColor}; border: none; cursor: pointer; appearance: none; background-color: ${pillColor}; background-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22${encodeURIComponent(arrowColor)}%22 stroke-width=%223%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>'); background-repeat: no-repeat; background-position: right 0.5rem center; background-size: 1rem;">
                <option value="Sin Asignar" ${estadoPago === 'Sin Asignar' ? 'selected' : ''}>Sin Asignar</option>
                <option value="Pendiente de pago" ${estadoPago === 'Pendiente de pago' ? 'selected' : ''}>Pendiente de pago</option>
                ${tienda?.tieneCuenta ? `<option value="Pago A cuenta" ${estadoPago === 'Pago A cuenta' ? 'selected' : ''}>Pago A cuenta</option>` : ''}
            </select>
        `;
        
        // Pedido real: botón + para adjuntar o ver si ya existe
        const pedidoRealLink = pedido.pedidoSistemaPDF ? escapeHtml(pedido.pedidoSistemaPDF) : null;
        pedidoRealContent = pedidoRealLink
            ? `<a href="${pedidoRealLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver documento</a>`
            : `<span class="doc-placeholder">Sin documento</span><button class="emoji-btn" type="button" aria-label="Adjuntar pedido real" onclick="document.getElementById('${pedidoRealInputId}').click()">➕</button>`;
        
        // Documento de pago: solo ver (contabilidad lo sube) - siempre visible
        documentoPagoContent = tieneTransferencia
            ? `<a href="${escapeHtml(pedido.transferenciaPDF)}" target="_blank" rel="noopener" class="doc-link">📄 Ver pago</a>`
            : '<span class="doc-placeholder">Sin documento</span>';
        
        // Factura: no disponible aún en esta pestaña
        facturaContent = '<span class="doc-placeholder">Sin factura</span>';
    } else if (tabContext === 'pendientes-pago') {
        // Pestaña 2: Pendientes de Pago - Permite editar pedido real
        estadoPagoContent = `<span class="estado-pago-pill ${estadoPagoClass}">${escapeHtml(estadoPago)}</span>`;
        
        // Pedido real: permite editar/reemplazar
        const pedidoRealLink = pedido.pedidoSistemaPDF ? escapeHtml(pedido.pedidoSistemaPDF) : null;
        pedidoRealContent = pedidoRealLink
            ? `<a href="${pedidoRealLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver documento</a><button class="emoji-btn" type="button" aria-label="Reemplazar pedido real" onclick="document.getElementById('${pedidoRealInputId}').click()" style="margin-left: 0.5rem;">➕</button>`
            : `<span class="doc-placeholder">Sin documento</span><button class="emoji-btn" type="button" aria-label="Adjuntar pedido real" onclick="document.getElementById('${pedidoRealInputId}').click()">➕</button>`;
        
        // Documento de pago: solo ver (contabilidad lo sube) - siempre visible
        documentoPagoContent = tieneTransferencia
            ? `<a href="${escapeHtml(pedido.transferenciaPDF)}" target="_blank" rel="noopener" class="doc-link">📄 Ver pago</a>`
            : '<span class="doc-placeholder">Sin documento</span>';
    } else if (tabContext === 'pagados') {
        // Pestaña 3: Pagados - Solo visualización (no editable)
        estadoPagoContent = `<span class="estado-pago-pill estado-pago-pagado">Pagado</span>`;
        
        const pedidoRealLink = pedido.pedidoSistemaPDF ? escapeHtml(pedido.pedidoSistemaPDF) : null;
        pedidoRealContent = pedidoRealLink
            ? `<a href="${pedidoRealLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver documento</a>`
            : '<span class="doc-placeholder">Sin documento</span>';
        
        // Documento de pago: solo ver (contabilidad lo sube) - siempre visible
        documentoPagoContent = tieneTransferencia
            ? `<a href="${escapeHtml(pedido.transferenciaPDF)}" target="_blank" rel="noopener" class="doc-link">📄 Ver pago</a>`
            : '<span class="doc-placeholder">Sin documento</span>';
        
        // Factura: botón + para adjuntar o ver si ya existe
        const facturaLink = pedido.albaran ? escapeHtml(pedido.albaran) : null;
        facturaContent = facturaLink
            ? `<a href="${facturaLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver factura</a>`
            : `<span class="doc-placeholder">Sin factura</span> <button class="emoji-btn" type="button" aria-label="Adjuntar factura" onclick="document.getElementById('${facturaInputId}').click()" style="margin-left: 0.5rem;">➕</button>`;
    } else if (tabContext === 'pago-cuenta') {
        // Pestaña 4: Pago A Cuenta - Permite editar pedido real
        estadoPagoContent = `<span class="estado-pago-pill estado-pago-cuenta">Pago A cuenta</span>`;
        
        // Pedido real: permite editar/reemplazar
        const pedidoRealLink = pedido.pedidoSistemaPDF ? escapeHtml(pedido.pedidoSistemaPDF) : null;
        pedidoRealContent = pedidoRealLink
            ? `<a href="${pedidoRealLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver documento</a><button class="emoji-btn" type="button" aria-label="Reemplazar pedido real" onclick="document.getElementById('${pedidoRealInputId}').click()" style="margin-left: 0.5rem;">➕</button>`
            : `<span class="doc-placeholder">Sin documento</span><button class="emoji-btn" type="button" aria-label="Adjuntar pedido real" onclick="document.getElementById('${pedidoRealInputId}').click()">➕</button>`;
        
        // Documento de pago: solo ver (contabilidad lo sube) - siempre visible
        documentoPagoContent = tieneTransferencia
            ? `<a href="${escapeHtml(pedido.transferenciaPDF)}" target="_blank" rel="noopener" class="doc-link">📄 Ver pago</a>`
            : '<span class="doc-placeholder">Sin documento</span>';
        
        // Factura: botón + para adjuntar o ver si ya existe
        const facturaLink = pedido.albaran ? escapeHtml(pedido.albaran) : null;
        facturaContent = facturaLink
            ? `<a href="${facturaLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver factura</a>`
            : `<span class="doc-placeholder">Sin factura</span> <button class="emoji-btn" type="button" aria-label="Adjuntar factura" onclick="document.getElementById('${facturaInputId}').click()" style="margin-left: 0.5rem;">➕</button>`;
    } else if (tabContext === 'facturas-pendientes') {
        // Pestaña 5: Facturas Pendientes
        estadoPagoContent = `<span class="estado-pago-pill estado-pago-pagado">Pagado</span>`;
        
        const pedidoRealLink = pedido.pedidoSistemaPDF ? escapeHtml(pedido.pedidoSistemaPDF) : null;
        pedidoRealContent = pedidoRealLink
            ? `<a href="${pedidoRealLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver documento</a>`
            : '<span class="doc-placeholder">Sin documento</span>';
        
        // Documento de pago: solo ver (contabilidad lo sube) - siempre visible
        documentoPagoContent = tieneTransferencia
            ? `<a href="${escapeHtml(pedido.transferenciaPDF)}" target="_blank" rel="noopener" class="doc-link">📄 Ver pago</a>`
            : '<span class="doc-placeholder">Sin documento</span>';
        
        // Factura: botón + para adjuntar o ver si ya existe
        const facturaLink = pedido.albaran ? escapeHtml(pedido.albaran) : null;
        facturaContent = facturaLink
            ? `<a href="${facturaLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver factura</a>`
            : `<span class="doc-placeholder">Sin factura</span> <button class="emoji-btn" type="button" aria-label="Adjuntar factura" onclick="document.getElementById('${facturaInputId}').click()" style="margin-left: 0.5rem;">➕</button>`;
    } else if (tabContext === 'historico') {
        // Pestaña 6: Histórico - Solo visualización
        estadoPagoContent = `<span class="estado-pago-pill estado-pago-pagado">Pagado</span>`;
        
        const pedidoRealLink = pedido.pedidoSistemaPDF ? escapeHtml(pedido.pedidoSistemaPDF) : null;
        pedidoRealContent = pedidoRealLink
            ? `<a href="${pedidoRealLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver documento</a>`
            : '<span class="doc-placeholder">Sin documento</span>';
        
        // Documento de pago: solo ver (contabilidad lo sube) - siempre visible
        documentoPagoContent = tieneTransferencia
            ? `<a href="${escapeHtml(pedido.transferenciaPDF)}" target="_blank" rel="noopener" class="doc-link">📄 Ver pago</a>`
            : '<span class="doc-placeholder">Sin documento</span>';
        
        const facturaLink = pedido.albaran ? escapeHtml(pedido.albaran) : null;
        facturaContent = facturaLink
            ? `<a href="${facturaLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver factura</a>`
            : '<span class="doc-placeholder">Sin factura</span>';
    }
    
    // Generar HTML de items
    const items = Array.isArray(pedido.items) ? pedido.items : [];
    const totalPedido = items.reduce((total, item) => {
        const precioItem = Number(item.precio) || 0;
        const cantidadItem = Number(item.cantidad) || 0;
        return total + precioItem * cantidadItem;
    }, 0);
    
    // Mostrar botones solo en las pestañas permitidas
    const mostrarBotones = (tabContext === 'seleccionar-pago' || tabContext === 'pendientes-pago' || tabContext === 'pago-cuenta');
    
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
            
            const botonesHtml = mostrarBotones ? `
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-left: auto;">
                    <button class="btn-icon-small" onclick="editarCantidadItemTienda('${pedido.id}', ${index}, ${cantidad})" title="Editar cantidad">
                        ✏️
                    </button>
                    <button class="btn-icon-small" onclick="duplicarLineaPedidoTienda('${pedido.id}', ${index})" title="Duplicar artículo">
                        📋
                    </button>
                    <button class="btn-icon-small" onclick="crearPedidoDesdeItemTienda('${pedido.id}', ${index})" title="Generar nuevo pedido">
                        ➕
                    </button>
                    <button class="btn-icon-small" onclick="eliminarItemPedidoTienda('${pedido.id}', ${index})" title="Eliminar artículo">
                        🗑️
                    </button>
                </div>
            ` : '';
            
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
                    ${botonesHtml}
                </div>
            `;
        }).join('')
        : '<p class="cascade-empty">No hay artículos en este pedido</p>';
    
    // Secciones colapsables
    const itemsSectionId = `pedido-items-tienda-${pedido.id}`;
    const notasSectionId = `pedido-notas-tienda-${pedido.id}`;
    const notasListId = `pedido-notas-list-tienda-${pedido.id}`;
    const notasCountId = `pedido-notas-count-tienda-${pedido.id}`;
    const notaInputId = `pedido-nota-input-tienda-${pedido.id}`;
    const notas = Array.isArray(pedido.notas) ? pedido.notas : [];
    
    // Estado de envío: desplegable siempre visible, solo editable en pagados/pago-cuenta
    const esEditable = (tabContext === 'pagados' || tabContext === 'pago-cuenta');
    const estadoEnvioHtml = `
        <select class="estado-select" ${esEditable ? `onchange="updateEstadoLogisticoTienda('${pedido.id}', this.value)"` : 'disabled'} ${!esEditable ? 'style="opacity: 0.6; cursor: not-allowed;"' : ''}>
            <option value="Nuevo" ${estadoLogistico === 'Nuevo' ? 'selected' : ''}>Nuevo</option>
            <option value="Preparando" ${estadoLogistico === 'Preparando' ? 'selected' : ''}>Preparando</option>
            <option value="En Ruta" ${estadoLogistico === 'En Ruta' ? 'selected' : ''}>En Ruta</option>
            <option value="Entregado" ${estadoLogistico === 'Entregado' ? 'selected' : ''}>Entregado</option>
        </select>
    `;
    
    card.innerHTML = `
        <!-- Header del pedido -->
        <div class="contab-pedido-header-compact">
            <p class="pedido-code">Pedido #${escapeHtml(pedido.id)}</p>
            <div class="contab-estado-envio">
                <span>Estado de envío:</span>
                ${estadoEnvioHtml}
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
                    ${estadoPagoContent}
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
                ${(tabContext === 'seleccionar-pago' || tabContext === 'pendientes-pago' || tabContext === 'pago-cuenta') ? `<input type="file" id="${pedidoRealInputId}" style="display: none;" accept=".pdf,.jpg,.jpeg,.png" onchange="uploadPedidoRealTienda('${pedido.id}', this)">` : ''}
                ${(tabContext === 'facturas-pendientes' || tabContext === 'pagados' || tabContext === 'pago-cuenta') ? `<input type="file" id="${facturaInputId}" style="display: none;" accept=".pdf,.jpg,.jpeg,.png" onchange="uploadFacturaTienda('${pedido.id}', this)">` : ''}
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
    
    // Renderizar notas
    const notasListElement = card.querySelector(`#${notasListId}`);
    const notasCountElement = card.querySelector(`#${notasCountId}`);
    if (notasListElement && notasCountElement) {
        renderPedidoNotasUI(pedido.id, notas, notasListElement, notasCountElement);
    }
    
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
    } catch (error) {
        console.error('Error al guardar nota:', error);
        await showAlert('No se pudo guardar la nota: ' + error.message, 'Error');
    }
};

// ========== FUNCIONES DE GESTIÓN DE PEDIDOS PARA TIENDA ==========

// Función auxiliar para recargar todas las pestañas relevantes cuando cambia un estado
function recargarPestañasTiendaRelevantes() {
    // Actualizar todos los badges primero
    actualizarTodosLosBadges();
    
    // Recargar todas las pestañas principales que pueden verse afectadas
    loadPedidosSeleccionarPago();
    loadPedidosPendientesPago();
    loadPedidosFacturasPendientesTienda();
    
    // Recargar todas las sub-pestañas de Pagados
    loadPedidosPagadosTienda('Nuevo');
    loadPedidosPagadosTienda('Preparando');
    loadPedidosPagadosTienda('En Ruta');
    loadPedidosPagadosTienda('Entregado');
    
    // Recargar todas las sub-pestañas de Pago A Cuenta
    loadPedidosPagoCuentaTienda('Nuevo');
    loadPedidosPagoCuentaTienda('Preparando');
    loadPedidosPagoCuentaTienda('En Ruta');
    loadPedidosPagoCuentaTienda('Entregado');
}

// Actualizar estado de pago desde la pestaña "Seleccionar Pago"
window.updateEstadoPagoTienda = async function(pedidoId, nuevoEstado) {
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        pedido.estadoPago = nuevoEstado;
        
        // Si se marca como "Pago A cuenta", inicializar estado logístico
        if (nuevoEstado === 'Pago A cuenta' && !pedido.estadoLogistico) {
            pedido.estadoLogistico = 'Nuevo';
        }
        
        await db.update('pedidos', pedido);
        
        // NO recargar pestañas automáticamente aquí
        // El pedido solo se moverá cuando se adjunte el pedido real
        // Solo recargar la pestaña actual para actualizar el select
        const activeTab = document.querySelector('#tienda-gestion-view .tab-btn.active')?.dataset.tab;
        if (activeTab === 'seleccionar-pago') {
            loadPedidosSeleccionarPago();
        }
        
    } catch (error) {
        console.error('Error al actualizar estado de pago:', error);
        await showAlert('Error al actualizar estado de pago: ' + error.message, 'Error');
    }
};

window.updateEstadoPagoTiendaSelect = async function(pedidoId, nuevoEstado, selectId) {
    try {
        // Actualizar el color del select según el estado
        const select = document.getElementById(selectId);
        if (select) {
            let bgColor = '#9ca3af'; // Por defecto: blanco-grisáceo para "Sin Asignar"
            let textColor = '#1f2937'; // Texto oscuro para fondo claro
            let arrowColor = '#1f2937'; // Flecha oscura para fondo claro
            
            if (nuevoEstado === 'Pendiente de pago') {
                bgColor = '#ef4444'; // Rojo
                textColor = 'white';
                arrowColor = 'white';
            } else if (nuevoEstado === 'Pago A cuenta') {
                bgColor = '#3b82f6'; // Azul
                textColor = 'white';
                arrowColor = 'white';
            } else if (nuevoEstado === 'Pagado') {
                bgColor = '#10b981'; // Verde
                textColor = 'white';
                arrowColor = 'white';
            }
            
            select.style.backgroundColor = bgColor;
            select.style.color = textColor;
            const arrowSvg = `url('data:image/svg+xml;charset=UTF-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22${encodeURIComponent(arrowColor)}%22 stroke-width=%223%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>')`;
            select.style.backgroundImage = arrowSvg;
        }
        
        // Actualizar el estado en la base de datos
        await updateEstadoPagoTienda(pedidoId, nuevoEstado);
        
    } catch (error) {
        console.error('Error al actualizar estado de pago:', error);
        await showAlert('Error al actualizar estado de pago: ' + error.message, 'Error');
    }
};

// Subir pedido real desde la pestaña "Seleccionar Pago"
window.uploadPedidoRealTienda = async function(pedidoId, input) {
    const file = input.files[0];
    if (!file) return;
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        // Leer archivo como base64
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const base64 = e.target.result;
                pedido.pedidoSistemaPDF = base64;
                await db.update('pedidos', pedido);
                
                const estadoPago = pedido.estadoPago || 'Sin Asignar';
                
                // Solo mover el pedido si tiene estado "Pendiente de pago" o "Pago A cuenta"
                // Y ahora tiene el pedido real adjunto (disparador doble)
                if (estadoPago === 'Pendiente de pago' || estadoPago === 'Pago A cuenta') {
                    await showAlert('Pedido real adjuntado correctamente. El pedido se ha movido a la pestaña correspondiente.', 'Éxito');
                    // Recargar todas las pestañas relevantes para que el pedido se mueva
                    recargarPestañasTiendaRelevantes();
                } else {
                    await showAlert('Pedido real adjuntado correctamente. Seleccione el método de pago para continuar.', 'Éxito');
                    // Solo recargar la pestaña actual
                    loadPedidosSeleccionarPago();
                }
            } catch (error) {
                console.error('Error al guardar pedido real:', error);
                await showAlert('Error al guardar pedido real: ' + error.message, 'Error');
            }
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error al leer archivo:', error);
        await showAlert('Error al leer archivo: ' + error.message, 'Error');
    }
};

// Actualizar estado logístico desde "Pagados" o "Pago A Cuenta"
window.updateEstadoLogisticoTienda = async function(pedidoId, nuevoEstadoLogistico) {
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        const estadoAnterior = pedido.estadoLogistico || 'Nuevo';
        pedido.estadoLogistico = nuevoEstadoLogistico;
        await db.update('pedidos', pedido);
        
        // Verificar si debe moverse a "Facturas Pendientes"
        const estadoPago = pedido.estadoPago || 'Sin Asignar';
        const tieneTransferencia = Boolean(pedido.transferenciaPDF);
        const esPagado = estadoPago === 'Pagado' || tieneTransferencia;
        const esEntregado = nuevoEstadoLogistico === 'Entregado';
        const tieneFactura = Boolean(pedido.albaran);
        
        // Camino 1: Pagado + Entregado -> Facturas Pendientes
        // Camino 2: Pago A cuenta + Entregado + tiene transferencia -> Facturas Pendientes
        if (esEntregado && !tieneFactura) {
            if (esPagado || (estadoPago === 'Pago A cuenta' && tieneTransferencia)) {
                // El pedido se moverá automáticamente a Facturas Pendientes
            }
        }
        
        // Recargar todas las pestañas relevantes: Pagados, Pago A Cuenta y Facturas Pendientes
        recargarPestañasTiendaRelevantes();
        
    } catch (error) {
        console.error('Error al actualizar estado logístico:', error);
        await showAlert('Error al actualizar estado logístico: ' + error.message, 'Error');
    }
};

// Subir factura desde "Facturas Pendientes"
window.uploadFacturaTienda = async function(pedidoId, input) {
    const file = input.files[0];
    if (!file) return;
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        // Leer archivo como base64
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const base64 = e.target.result;
                pedido.albaran = base64;
                await db.update('pedidos', pedido);
                
                await showAlert('Factura adjuntada. El pedido se ha movido al "Histórico".', 'Éxito');
                
                // Recargar pestañas relevantes: Facturas Pendientes e Histórico
                recargarPestañasTiendaRelevantes();
            } catch (error) {
                console.error('Error al guardar factura:', error);
                await showAlert('Error al guardar factura: ' + error.message, 'Error');
            }
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error al leer archivo:', error);
        await showAlert('Error al leer archivo: ' + error.message, 'Error');
    }
};

// Editar cantidad de artículo en pedido
window.editarCantidadItemTienda = async function(pedidoId, itemIndex, cantidadActual) {
    const nuevaCantidadStr = await showPrompt(`Cantidad actual: ${cantidadActual}\n\nIngrese la nueva cantidad:`, cantidadActual.toString(), 'Editar Cantidad');
    
    if (nuevaCantidadStr === null) return; // Usuario canceló
    
    const nuevaCantidad = parseInt(nuevaCantidadStr);
    
    if (isNaN(nuevaCantidad) || nuevaCantidad < 0) {
        await showAlert('Por favor, ingrese una cantidad válida', 'Error');
        return;
    }
    
    if (nuevaCantidad === cantidadActual) {
        return; // No hay cambios
    }
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido || !pedido.items || itemIndex >= pedido.items.length) {
            await showAlert('Error: No se pudo encontrar el artículo', 'Error');
            return;
        }
        
        const item = pedido.items[itemIndex];
        
        if (nuevaCantidad === 0) {
            // Si la cantidad es 0, eliminar el artículo
            const confirmar = await showConfirm('¿Eliminar este artículo del pedido?', 'Confirmar Eliminación');
            if (confirmar) {
                pedido.items.splice(itemIndex, 1);
                
                if (pedido.items.length === 0) {
                    await db.delete('pedidos', pedidoId);
                } else {
                    await db.update('pedidos', pedido);
                }
                
                recargarPestañasTiendaRelevantes();
                await showAlert('Artículo eliminado del pedido', 'Éxito');
            }
            return;
        }
        
        // Actualizar cantidad
        item.cantidad = nuevaCantidad;
        await db.update('pedidos', pedido);
        
        recargarPestañasTiendaRelevantes();
        await showAlert('Cantidad actualizada correctamente', 'Éxito');
    } catch (error) {
        console.error('Error al editar cantidad:', error);
        await showAlert('Error al editar la cantidad: ' + error.message, 'Error');
    }
};

// Duplicar línea de pedido en vista de tienda
window.duplicarLineaPedidoTienda = async function(pedidoId, itemIndex) {
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido || !pedido.items || itemIndex >= pedido.items.length) {
            await showAlert('Error: No se pudo encontrar el artículo', 'Error');
            return;
        }
        
        const item = pedido.items[itemIndex];
        
        // Crear una copia del artículo
        const itemDuplicado = {
            ...item,
            cantidad: item.cantidad || 1
        };
        
        // Agregar el artículo duplicado al mismo pedido
        pedido.items.push(itemDuplicado);
        await db.update('pedidos', pedido);
        
        recargarPestañasTiendaRelevantes();
        await showAlert('Artículo duplicado en el pedido', 'Éxito');
    } catch (error) {
        console.error('Error al duplicar línea:', error);
        await showAlert('Error al duplicar el artículo: ' + error.message, 'Error');
    }
};

// Crear nuevo pedido desde un artículo en vista de tienda
window.crearPedidoDesdeItemTienda = async function(pedidoId, itemIndex) {
    try {
        const pedidoOrigen = await db.get('pedidos', pedidoId);
        if (!pedidoOrigen || !pedidoOrigen.items || itemIndex >= pedidoOrigen.items.length) {
            await showAlert('Error: No se pudo encontrar el artículo', 'Error');
            return;
        }
        
        const itemAMover = pedidoOrigen.items[itemIndex];
        
        // Crear nuevo pedido
        const nuevoPedido = {
            tiendaId: pedidoOrigen.tiendaId,
            userId: pedidoOrigen.userId,
            persona: pedidoOrigen.persona,
            obraId: pedidoOrigen.obraId,
            obraNombreComercial: pedidoOrigen.obraNombreComercial,
            obraDireccionGoogleMaps: pedidoOrigen.obraDireccionGoogleMaps || '',
            obraEncargado: pedidoOrigen.obraEncargado || '',
            obraTelefono: pedidoOrigen.obraTelefono || '',
            items: [{ ...itemAMover }],
            estado: 'Nuevo',
            estadoPago: 'Sin Asignar',
            estadoLogistico: 'Nuevo',
            fecha: new Date(),
            esPedidoEspecial: pedidoOrigen.esPedidoEspecial || false,
            notas: []
        };
        
        const nuevoPedidoId = await db.add('pedidos', nuevoPedido);
        
        recargarPestañasTiendaRelevantes();
        await showAlert(`Nuevo pedido creado (#${nuevoPedidoId}) con el artículo seleccionado`, 'Éxito');
    } catch (error) {
        console.error('Error al crear nuevo pedido:', error);
        await showAlert('Error al crear nuevo pedido: ' + error.message, 'Error');
    }
};

// Eliminar artículo de pedido en vista de tienda
window.eliminarItemPedidoTienda = async function(pedidoId, itemIndex) {
    const confirmar = await showConfirm('¿Está seguro de eliminar este artículo del pedido?', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido || !pedido.items || itemIndex >= pedido.items.length) {
            await showAlert('Error: No se pudo encontrar el artículo', 'Error');
            return;
        }
        
        // Eliminar el artículo
        pedido.items.splice(itemIndex, 1);
        
        // Si el pedido queda sin items, eliminarlo
        if (pedido.items.length === 0) {
            await db.delete('pedidos', pedidoId);
        } else {
            await db.update('pedidos', pedido);
        }
        
        recargarPestañasTiendaRelevantes();
        await showAlert('Artículo eliminado del pedido', 'Éxito');
    } catch (error) {
        console.error('Error al eliminar artículo:', error);
        await showAlert('Error al eliminar el artículo: ' + error.message, 'Error');
    }
};

// Aceptar solicitud de modificación
window.aceptarSolicitudModificacion = async function(solicitudId) {
    const confirmar = await showConfirm('¿Está seguro de aceptar esta solicitud de modificación de cantidad?', 'Confirmar');
    if (!confirmar) return;
    
    try {
        const solicitud = await db.get('solicitudesModificacion', solicitudId);
        if (!solicitud) {
            await showAlert('Error: No se pudo encontrar la solicitud', 'Error');
            return;
        }
        
        const pedido = await db.get('pedidos', solicitud.pedidoId);
        if (!pedido || !pedido.items || solicitud.itemIndex >= pedido.items.length) {
            await showAlert('Error: No se pudo encontrar el pedido o el artículo', 'Error');
            return;
        }
        
        // Actualizar la cantidad del artículo
        pedido.items[solicitud.itemIndex].cantidad = solicitud.cantidadSolicitada;
        
        // Si la cantidad es 0, eliminar el artículo
        if (solicitud.cantidadSolicitada === 0) {
            pedido.items.splice(solicitud.itemIndex, 1);
            if (pedido.items.length === 0) {
                await db.delete('pedidos', solicitud.pedidoId);
            } else {
                await db.update('pedidos', pedido);
            }
        } else {
            await db.update('pedidos', pedido);
        }
        
        // Marcar solicitud como aceptada
        solicitud.estado = 'Aceptada';
        await db.update('solicitudesModificacion', solicitud);
        
        await showAlert('Solicitud aceptada. Cantidad actualizada.', 'Éxito');
        
        // Recargar pestaña de modificación de pedido si está activa
        const activeTab = document.querySelector('#tienda-gestion-view .tab-btn.active')?.dataset.tab;
        if (activeTab === 'modificacion-pedido') {
            loadModificacionPedidoTienda();
        }
        
        // Recargar pestañas relevantes
        recargarPestañasTiendaRelevantes();
    } catch (error) {
        console.error('Error al aceptar solicitud:', error);
        await showAlert('Error al aceptar solicitud: ' + error.message, 'Error');
    }
};

// Rechazar solicitud de modificación
window.rechazarSolicitudModificacion = async function(solicitudId) {
    const confirmar = await showConfirm('¿Está seguro de rechazar esta solicitud de modificación?', 'Confirmar');
    if (!confirmar) return;
    
    try {
        const solicitud = await db.get('solicitudesModificacion', solicitudId);
        if (!solicitud) {
            await showAlert('Error: No se pudo encontrar la solicitud', 'Error');
            return;
        }
        
        // Marcar solicitud como rechazada
        solicitud.estado = 'Rechazada';
        await db.update('solicitudesModificacion', solicitud);
        
        await showAlert('Solicitud rechazada', 'Éxito');
        
        // Recargar pestaña de modificación de pedido si está activa
        const activeTab = document.querySelector('#tienda-gestion-view .tab-btn.active')?.dataset.tab;
        if (activeTab === 'modificacion-pedido') {
            loadModificacionPedidoTienda();
        }
    } catch (error) {
        console.error('Error al rechazar solicitud:', error);
        await showAlert('Error al rechazar solicitud: ' + error.message, 'Error');
    }
};

// Funciones de navegación
function switchTabTienda(tab) {
    if (!tab) return;
    
    // Actualizar pestañas principales
    const gestionView = document.getElementById('tienda-gestion-view');
    if (!gestionView) return;
    
    gestionView.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });
    
    // Ocultar todos los contenidos de pestañas
    gestionView.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Mostrar el contenido de la pestaña seleccionada
    const tabContent = document.getElementById(tab);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Cargar contenido según la pestaña
    if (tab === 'seleccionar-pago' && typeof loadPedidosSeleccionarPago === 'function') {
        loadPedidosSeleccionarPago();
    } else if (tab === 'modificacion-pedido' && typeof loadModificacionPedidoTienda === 'function') {
        loadModificacionPedidoTienda();
    } else if (tab === 'pendientes-pago' && typeof loadPedidosPendientesPago === 'function') {
        loadPedidosPendientesPago();
    } else if (tab === 'pagados' && typeof switchSubTabTienda === 'function') {
        switchSubTabTienda('pagados', 'pagados-nuevo');
    } else if (tab === 'pago-cuenta' && typeof switchSubTabTienda === 'function') {
        switchSubTabTienda('pago-cuenta', 'pago-cuenta-nuevo');
    } else if (tab === 'facturas-pendientes' && typeof loadPedidosFacturasPendientesTienda === 'function') {
        loadPedidosFacturasPendientesTienda();
    }
}

function switchSubTabTienda(mainTab, subTab) {
    if (!mainTab || !subTab) return;
    
    // Ocultar todas las sub-pestañas del grupo
    const mainTabContent = document.getElementById(mainTab);
    if (!mainTabContent) return;
    
    mainTabContent.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    mainTabContent.querySelectorAll('.sub-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activar la sub-pestaña seleccionada
    const subTabBtn = mainTabContent.querySelector(`[data-sub-tab="${subTab}"]`);
    const subTabContent = document.getElementById(subTab);
    
    if (subTabBtn) subTabBtn.classList.add('active');
    if (subTabContent) subTabContent.classList.add('active');
    
    // Cargar contenido según la sub-pestaña
    if (subTab === 'pagados-nuevo' && typeof loadPedidosPagadosTienda === 'function') {
        loadPedidosPagadosTienda('Nuevo');
    } else if (subTab === 'pagados-preparando' && typeof loadPedidosPagadosTienda === 'function') {
        loadPedidosPagadosTienda('Preparando');
    } else if (subTab === 'pagados-en-ruta' && typeof loadPedidosPagadosTienda === 'function') {
        loadPedidosPagadosTienda('En Ruta');
    } else if (subTab === 'pagados-entregado' && typeof loadPedidosPagadosTienda === 'function') {
        loadPedidosPagadosTienda('Entregado');
    } else if (subTab === 'pago-cuenta-nuevo' && typeof loadPedidosPagoCuentaTienda === 'function') {
        loadPedidosPagoCuentaTienda('Nuevo');
    } else if (subTab === 'pago-cuenta-preparando' && typeof loadPedidosPagoCuentaTienda === 'function') {
        loadPedidosPagoCuentaTienda('Preparando');
    } else if (subTab === 'pago-cuenta-en-ruta' && typeof loadPedidosPagoCuentaTienda === 'function') {
        loadPedidosPagoCuentaTienda('En Ruta');
    } else if (subTab === 'pago-cuenta-entregado' && typeof loadPedidosPagoCuentaTienda === 'function') {
        loadPedidosPagoCuentaTienda('Entregado');
    }
}

// Función para mostrar vista de tienda
function showTiendaView(viewName) {
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
let tiendaEventListenersSetup = false;

function setupTiendaEventListeners() {
    // Evitar agregar listeners múltiples veces
    if (tiendaEventListenersSetup) {
        return;
    }
    tiendaEventListenersSetup = true;

    // Toggle sidebar tienda - delegación en el documento
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-toggle-sidebar-tienda')) {
            e.preventDefault();
            e.stopPropagation();
            const sidebar = document.getElementById('tienda-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
            }
        }
    });

    // Logout - delegación en el documento
    document.addEventListener('click', async (e) => {
        if (e.target.closest('#btn-logout-tienda')) {
            e.preventDefault();
            e.stopPropagation();
            await db.clearSesion();
            currentUser = null;
            currentUserType = null;
            currentTienda = null;
            window.location.href = '../index.html';
        }
    });

    // Tienda sidebar navigation - delegación en el sidebar
    const sidebar = document.getElementById('tienda-sidebar');
    if (sidebar) {
        sidebar.addEventListener('click', (e) => {
            const navItem = e.target.closest('.admin-nav-item');
            if (!navItem || navItem.id === 'btn-logout-tienda') return;
            
            const viewName = navItem.dataset.view;
            if (viewName) {
                e.preventDefault();
                e.stopPropagation();
                showTiendaView(viewName);
                
                // Actualizar estado activo
                document.querySelectorAll('#tienda-sidebar .admin-nav-item').forEach(btn => {
                    if (btn.id !== 'btn-logout-tienda') {
                        btn.classList.remove('active');
                    }
                });
                navItem.classList.add('active');
            }
        });
    }

    // Tabs principales - delegación de eventos en el documento (más robusto)
    document.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('#tienda-gestion-view .tab-btn');
        if (tabBtn && tabBtn.dataset.tab) {
            e.preventDefault();
            e.stopPropagation();
            const tab = tabBtn.dataset.tab;
            if (typeof switchTabTienda === 'function') {
                switchTabTienda(tab);
            }
        }
    });

    // Sub-tabs - delegación de eventos en el documento (funciona para todos los sub-tabs)
    document.addEventListener('click', (e) => {
        const subTabBtn = e.target.closest('.sub-tab-btn');
        if (!subTabBtn || !subTabBtn.dataset.subTab) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const subTab = subTabBtn.dataset.subTab;
        
        // Determinar el mainTab basado en el subTab
        let mainTab = null;
        if (subTab.startsWith('pagados-')) {
            mainTab = 'pagados';
        } else if (subTab.startsWith('pago-cuenta-')) {
            mainTab = 'pago-cuenta';
        }
        
        if (mainTab) {
            switchSubTabTienda(mainTab, subTab);
        }
    });
}

// Inicialización
async function initTienda() {
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
        
        // Validar que el usuario sea de tipo Tienda
        if (usuario.tipo !== 'Tienda') {
            window.location.href = '../index.html';
            return;
        }
        
        // Usuario válido, continuar
        currentUser = usuario;
        currentUserType = 'Tienda';
        
        // Si hay tiendaId en la sesión, cargar la tienda
        let tiendaId = sesion.tiendaId || usuario.tiendaId;
        
        if (tiendaId) {
            try {
                const tienda = await db.get('tiendas', tiendaId);
                if (tienda) {
                    currentTienda = tienda;
                } else {
                    console.error('Tienda no encontrada con ID:', tiendaId);
                    window.location.href = '../index.html';
                    return;
                }
            } catch (error) {
                console.error('Error al cargar tienda:', error);
                window.location.href = '../index.html';
                return;
            }
        } else {
            console.error('No se encontró tiendaId en sesión ni en usuario');
            window.location.href = '../index.html';
            return;
        }
        
        // Validación final
        if (!currentTienda) {
            console.error('currentTienda no se pudo cargar');
            window.location.href = '../index.html';
            return;
        }
    } catch (error) {
        console.error('Error al inicializar tienda:', error);
        window.location.href = '../index.html';
        return;
    }

    // Actualizar nombre de tienda y badge de cuenta
    if (currentTienda) {
        const nombreElement = document.getElementById('gestion-tienda-nombre');
        if (nombreElement) {
            nombreElement.textContent = `Gestión - ${currentTienda.nombre}`;
        }
        
        // Calcular gastado de cuenta (suma de todos los pedidos con estadoPago = 'Pago A cuenta')
        const gastado = await calcularGastadoTotalCuenta(currentTienda.id);
        
        const cuentaBadge = document.getElementById('gestion-tienda-cuenta-badge');
        if (cuentaBadge) {
            if (!currentTienda.tieneCuenta) {
                cuentaBadge.textContent = 'Sin Cuenta';
                cuentaBadge.style.backgroundColor = '#ef4444';
                cuentaBadge.style.color = 'white';
            } else if (!currentTienda.limiteCuenta) {
                // Cuenta sin límite: mostrar solo el gastado
                cuentaBadge.textContent = `${gastado.toFixed(2)}€ gastado`;
                cuentaBadge.style.backgroundColor = '#10b981';
                cuentaBadge.style.color = 'white';
            } else {
                // Cuenta con límite: mostrar gastado VS límite
                const limite = Number(currentTienda.limiteCuenta) || 0;
                cuentaBadge.textContent = `${gastado.toFixed(2)}€ / ${limite.toFixed(2)}€`;
                cuentaBadge.style.backgroundColor = '#f59e0b';
                cuentaBadge.style.color = 'white';
            }
        }
    }

    // Mostrar vista inicial de Gestión primero
    showTiendaView('tienda-gestion');

    // Esperar a que el DOM esté completamente renderizado
    // Usar múltiples frames para asegurar que todo esté listo
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Configurar event listeners
            setupTiendaEventListeners();

            // Cargar todos los badges al inicializar
            actualizarTodosLosBadges();

            // Cargar vista inicial
            if (typeof switchTabTienda === 'function') {
                switchTabTienda('seleccionar-pago');
            }
        });
    });
}

// Función para actualizar todos los badges de las pestañas
async function actualizarTodosLosBadges() {
    if (!currentTienda) return;
    
    const tiendaId = currentTienda.id;
    const pedidos = await db.getPedidosByTienda(tiendaId);
    const solicitudesModificacion = await db.getSolicitudesModificacionByTienda(tiendaId);
    
    // 1. Seleccionar Pago
    const pedidosSeleccionar = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        const tienePedidoReal = Boolean(p.pedidoSistemaPDF);
        return !tienePedidoReal && 
               (estadoPago === 'Sin Asignar' || estadoPago === 'Pendiente de pago' || estadoPago === 'Pago A cuenta') &&
               p.estado !== 'Completado' && 
               !p.esPedidoEspecial;
    });
    updateTabBadge('seleccionar-pago', pedidosSeleccionar.length);
    
    // 2. Modificación de Pedido
    const solicitudesPendientes = solicitudesModificacion.filter(s => s.estado === 'Pendiente');
    updateTabBadge('modificacion-pedido', solicitudesPendientes.length);
    
    // 3. Pendientes de Pago
    const pedidosPendientes = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        const tienePedidoReal = Boolean(p.pedidoSistemaPDF);
        return estadoPago === 'Pendiente de pago' && tienePedidoReal && p.estado !== 'Completado' && !p.esPedidoEspecial;
    });
    updateTabBadge('pendientes-pago', pedidosPendientes.length);
    
    // 4. Pagados (suma de todos los estados logísticos)
    const todosPagados = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        const tieneTransferencia = Boolean(p.transferenciaPDF);
        return (estadoPago === 'Pagado' || tieneTransferencia) && p.estado !== 'Completado' && !p.esPedidoEspecial;
    });
    updateTabBadge('pagados', todosPagados.length);
    
    // 5. Pagado A Cuenta (suma de todos los estados logísticos)
    const todosCuenta = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        return estadoPago === 'Pago A cuenta' && p.estado !== 'Completado' && !p.esPedidoEspecial;
    });
    updateTabBadge('pago-cuenta', todosCuenta.length);
    
    // 6. Facturas Pendientes
    const pedidosFacturas = pedidos.filter(p => {
        const estadoPago = p.estadoPago || 'Sin Asignar';
        const tieneTransferencia = Boolean(p.transferenciaPDF);
        const estadoLog = p.estadoLogistico || 'Nuevo';
        const tieneFactura = Boolean(p.albaran);
        
        const esPagado = estadoPago === 'Pagado' || tieneTransferencia;
        const esEntregado = estadoLog === 'Entregado';
        
        return esPagado && esEntregado && !tieneFactura && p.estado !== 'Completado' && !p.esPedidoEspecial;
    });
    updateTabBadge('facturas-pendientes', pedidosFacturas.length);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicializar base de datos primero
        await db.init();
        await db.initDefaultData();
        
        // Inicializar tienda
        await initTienda();
    } catch (error) {
        console.error('Error al inicializar base de datos:', error);
        window.location.href = '../index.html';
    }
});

// Función para expandir/contraer la card de artículos
function toggleExpandArticulos(pedidoId) {
    const articulosCard = document.getElementById(`articulos-card-${pedidoId}`);
    if (articulosCard) {
        articulosCard.classList.toggle('expanded');
    }
}

