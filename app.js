// Aplicación Principal
// Importar la instancia de db desde database.js
import { db } from './database.js';

let currentUser = null;
let currentObra = null;
let currentTienda = null;
let currentCategoria = null;
let carrito = [];
let searchResults = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await db.init();
        await db.initDefaultData();
        
        // Verificar si hay sesión activa
        const sesion = await db.getSesion();
        if (sesion) {
            currentUser = sesion.persona;
            currentObra = sesion.obra;
            showView('main');
            loadTiendas();
            updateCartCount();
        } else {
            // Intentar cargar desde localStorage como respaldo
            const savedUser = localStorage.getItem('currentUser');
            const savedObra = localStorage.getItem('currentObra');
            if (savedUser && savedObra) {
                currentUser = savedUser;
                currentObra = savedObra;
                showView('main');
                loadTiendas();
                updateCartCount();
            } else {
                showView('login');
            }
        }
    } catch (error) {
        console.error('Error al inicializar Firebase:', error);
        // Intentar cargar desde localStorage
        const savedUser = localStorage.getItem('currentUser');
        const savedObra = localStorage.getItem('currentObra');
        if (savedUser && savedObra) {
            currentUser = savedUser;
            currentObra = savedObra;
            showView('main');
            loadTiendas();
            updateCartCount();
        } else {
            showView('login');
        }
    }

    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Login
    document.getElementById('btn-login').addEventListener('click', handleLogin);

    // Navegación
    document.getElementById('btn-menu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('active');
    });

    document.getElementById('btn-menu-pedidos').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('active');
    });

    document.getElementById('btn-close-sidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
    });

    document.querySelector('.sidebar-overlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
    });

    // Búsqueda
    document.getElementById('btn-search').addEventListener('click', () => {
        const searchContainer = document.getElementById('search-container');
        searchContainer.style.display = searchContainer.style.display === 'none' ? 'flex' : 'none';
        if (searchContainer.style.display === 'flex') {
            document.getElementById('search-input').focus();
        }
    });

    document.getElementById('btn-close-search').addEventListener('click', () => {
        document.getElementById('search-container').style.display = 'none';
        document.getElementById('search-input').value = '';
        searchResults = [];
        const container = document.getElementById('tiendas-list');
        container.className = 'tiendas-grid';
        loadTiendas();
    });

    document.getElementById('search-input').addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length > 2) {
            await performSearch(query);
        } else {
            searchResults = [];
            loadTiendas();
        }
    });

    // Carrito
    document.getElementById('cart-button').addEventListener('click', () => {
        showView('carrito');
        loadCarrito();
    });

    // Footer
    document.querySelectorAll('.footer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            if (view === 'main') {
                showView('main');
                loadTiendas();
            } else if (view === 'pedidos') {
                showView('pedidos');
                loadMisPedidos();
            }
            
            // Actualizar estado activo
            document.querySelectorAll('.footer-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // Gestión de tienda
    document.getElementById('btn-gestion-tienda').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
        showGestionTienda();
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await db.clearSesion();
        currentUser = null;
        currentObra = null;
        carrito = [];
        showView('login');
    });

    // Tabs de gestión
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            switchTab(tab);
        });
    });
}

// Manejo de Login
async function handleLogin() {
    const persona = document.getElementById('select-persona').value;
    const obra = document.getElementById('select-obra').value;

    if (!persona || !obra) {
        alert('Por favor, seleccione ambas opciones');
        return;
    }

    try {
        currentUser = persona;
        currentObra = obra;
        
        // Intentar guardar sesión (puede fallar si Firebase no está configurado)
        try {
            await db.saveSesion(persona, obra);
        } catch (error) {
            console.warn('No se pudo guardar la sesión en Firebase:', error);
            // Continuar aunque falle, usando localStorage como respaldo
            localStorage.setItem('currentUser', persona);
            localStorage.setItem('currentObra', obra);
        }
        
        // Actualizar sidebar
        document.getElementById('sidebar-usuario').textContent = persona;
        document.getElementById('sidebar-obra').textContent = obra;

        showView('main');
        loadTiendas();
        updateCartCount();
    } catch (error) {
        console.error('Error en login:', error);
        alert('Error al iniciar sesión. Por favor, inténtalo de nuevo.');
    }
}

// Navegación de Vistas
function showView(viewName) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`view-${viewName}`).classList.add('active');
}

// Cargar Tiendas
async function loadTiendas() {
    const tiendas = await db.getAll('tiendas');
    const container = document.getElementById('tiendas-list');
    
    if (searchResults.length > 0) {
        // Mostrar resultados de búsqueda como productos
        container.innerHTML = '';
        container.className = 'productos-list';
        
        for (const producto of searchResults) {
            const card = createProductoCard(producto);
            container.appendChild(card);
        }
    } else {
        container.innerHTML = '';
        container.className = 'tiendas-grid';
        tiendas.forEach(tienda => {
            const card = createTiendaCard(tienda);
            container.appendChild(card);
        });
    }
}

function createTiendaCard(tienda) {
    const card = document.createElement('div');
    card.className = 'tienda-card';
    card.innerHTML = `
        <div class="tienda-card-icon">${tienda.icono || '🏪'}</div>
        <h3>${tienda.nombre}</h3>
    `;
    card.addEventListener('click', () => {
        currentTienda = tienda;
        showView('categorias');
        loadCategorias(tienda.id);
    });
    return card;
}

// Cargar Categorías
async function loadCategorias(tiendaId) {
    const categorias = await db.getCategoriasByTienda(tiendaId);
    const container = document.getElementById('categorias-list');
    const tienda = await db.get('tiendas', tiendaId);
    
    document.getElementById('categorias-tienda-nombre').textContent = tienda.nombre;
    container.innerHTML = '';
    
    categorias.forEach(categoria => {
        const card = document.createElement('div');
        card.className = 'categoria-card';
        card.innerHTML = `<h3>${categoria.nombre}</h3>`;
        card.addEventListener('click', () => {
            currentCategoria = categoria;
            showView('productos');
            loadProductos(categoria.id);
        });
        container.appendChild(card);
    });
}

// Cargar Productos
async function loadProductos(categoriaId) {
    const productos = await db.getProductosByCategoria(categoriaId);
    const container = document.getElementById('productos-list');
    const categoria = await db.get('categorias', categoriaId);
    
    document.getElementById('productos-categoria-nombre').textContent = categoria.nombre;
    container.innerHTML = '';
    
    productos.forEach(producto => {
        const card = createProductoCard(producto);
        container.appendChild(card);
    });
}

function createProductoCard(producto) {
    const card = document.createElement('div');
    card.className = 'producto-card';
    
    const cantidadEnCarrito = getCantidadEnCarrito(producto.id);
    
    card.innerHTML = `
        <div class="producto-info">
            <h3>${producto.nombre}</h3>
            <p>${producto.descripcion}</p>
            ${producto.precio ? `<p style="color: var(--primary-color); font-weight: 600;">${producto.precio.toFixed(2)} €</p>` : ''}
        </div>
        <div class="producto-actions">
            ${cantidadEnCarrito > 0 ? `
                <div class="quantity-control">
                    <button class="quantity-btn" onclick="decrementProducto(${producto.id})">-</button>
                    <span class="quantity-value">${cantidadEnCarrito}</span>
                    <button class="quantity-btn" onclick="incrementProducto(${producto.id})">+</button>
                </div>
            ` : `
                <button class="btn-add-cart" onclick="addToCart(${producto.id})">Añadir</button>
            `}
        </div>
    `;
    return card;
}

// Búsqueda
async function performSearch(query) {
    searchResults = await db.searchProductos(query);
    loadTiendas();
}

// Carrito
function getCantidadEnCarrito(productoId) {
    const item = carrito.find(item => item.productoId === productoId);
    return item ? item.cantidad : 0;
}

// Funciones globales para uso en HTML onclick
window.addToCart = async function(productoId) {
    const producto = await db.get('productos', productoId);
    const existingItem = carrito.find(item => item.productoId === productoId);
    
    if (existingItem) {
        existingItem.cantidad++;
    } else {
        carrito.push({
            productoId: productoId,
            producto: producto,
            cantidad: 1
        });
    }
    
    updateCartCount();
    refreshCurrentView();
}

window.incrementProducto = function(productoId) {
    const item = carrito.find(item => item.productoId === productoId);
    if (item) {
        item.cantidad++;
        updateCartCount();
        refreshCurrentView();
    }
}

window.decrementProducto = function(productoId) {
    const item = carrito.find(item => item.productoId === productoId);
    if (item) {
        item.cantidad--;
        if (item.cantidad <= 0) {
            carrito = carrito.filter(i => i.productoId !== productoId);
        }
        updateCartCount();
        refreshCurrentView();
    }
}

function refreshCurrentView() {
    if (currentCategoria) {
        loadProductos(currentCategoria.id);
    } else if (searchResults.length > 0) {
        loadTiendas(); // Recargar resultados de búsqueda
    }
}

function updateCartCount() {
    const total = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('cart-count').textContent = total;
    document.getElementById('cart-count').style.display = total > 0 ? 'flex' : 'none';
}

async function loadCarrito() {
    const container = document.getElementById('carrito-items');
    const emptyState = document.getElementById('carrito-empty');
    const btnFinalizar = document.getElementById('btn-finalizar-pedido');
    
    if (carrito.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        btnFinalizar.disabled = true;
        return;
    }
    
    emptyState.style.display = 'none';
    btnFinalizar.disabled = false;
    
    // Agrupar por tienda
    const itemsPorTienda = {};
    for (const item of carrito) {
        const tiendaId = item.producto.tiendaId;
        if (!itemsPorTienda[tiendaId]) {
            const tienda = await db.get('tiendas', tiendaId);
            itemsPorTienda[tiendaId] = {
                tienda: tienda,
                items: []
            };
        }
        itemsPorTienda[tiendaId].items.push(item);
    }
    
    container.innerHTML = '';
    for (const [tiendaId, data] of Object.entries(itemsPorTienda)) {
        const grupo = document.createElement('div');
        grupo.className = 'carrito-item';
        grupo.innerHTML = `
            <div class="carrito-item-header">
                <span class="carrito-item-tienda">${data.tienda.nombre}</span>
            </div>
            ${data.items.map(item => `
                <div class="carrito-item-producto">
                    <h4>${item.producto.nombre}</h4>
                    <p>${item.producto.descripcion}</p>
                    <div class="carrito-item-controls">
                        <div class="quantity-control">
                            <button class="quantity-btn" onclick="decrementCarritoItem(${item.productoId})">-</button>
                            <span class="quantity-value">${item.cantidad}</span>
                            <button class="quantity-btn" onclick="incrementCarritoItem(${item.productoId})">+</button>
                        </div>
                        <button class="btn-remove-item" onclick="removeCarritoItem(${item.productoId})" title="Eliminar">✕</button>
                    </div>
                </div>
            `).join('')}
        `;
        container.appendChild(grupo);
    }
    
    btnFinalizar.addEventListener('click', finalizarPedido);
}

window.incrementCarritoItem = function(productoId) {
    incrementProducto(productoId);
    loadCarrito();
}

window.decrementCarritoItem = function(productoId) {
    decrementProducto(productoId);
    loadCarrito();
}

window.removeCarritoItem = function(productoId) {
    carrito = carrito.filter(item => item.productoId !== productoId);
    updateCartCount();
    loadCarrito();
}

// Finalizar Pedido
async function finalizarPedido() {
    if (carrito.length === 0) return;
    
    // Agrupar por tienda
    const itemsPorTienda = {};
    for (const item of carrito) {
        const tiendaId = item.producto.tiendaId;
        if (!itemsPorTienda[tiendaId]) {
            itemsPorTienda[tiendaId] = [];
        }
        itemsPorTienda[tiendaId].push(item);
    }
    
    // Crear un pedido por cada tienda
    // La fecha se establecerá automáticamente con serverTimestamp() en Firestore
    for (const [tiendaId, items] of Object.entries(itemsPorTienda)) {
        const pedido = {
            tiendaId: tiendaId, // Firestore acepta strings
            persona: currentUser,
            obra: currentObra,
            items: items.map(item => ({
                productoId: item.productoId,
                nombre: item.producto.nombre,
                descripcion: item.producto.descripcion,
                cantidad: item.cantidad,
                precio: item.producto.precio || 0
            })),
            estado: 'Nuevo',
            albaran: null
        };
        
        await db.add('pedidos', pedido);
    }
    
    // Limpiar carrito
    carrito = [];
    updateCartCount();
    
    alert('Pedido realizado con éxito');
    showView('main');
    loadTiendas();
}

// Mis Pedidos
async function loadMisPedidos() {
    const pedidos = await db.getPedidosByUser(currentUser, currentObra);
    const container = document.getElementById('pedidos-list');
    const emptyState = document.getElementById('pedidos-empty');
    
    if (pedidos.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    // Ordenar por fecha (más recientes primero)
    // Firestore ya ordena con orderBy, pero por si acaso
    pedidos.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    for (const pedido of pedidos) {
        const tienda = await db.get('tiendas', pedido.tiendaId);
        const card = createPedidoCard(pedido, tienda);
        container.appendChild(card);
    }
}

function createPedidoCard(pedido, tienda) {
    const card = document.createElement('div');
    card.className = 'pedido-card';
    
    const estadoClass = `estado-${pedido.estado.toLowerCase().replace(' ', '-')}`;
    // Firestore devuelve fechas como Timestamp, convertir si es necesario
    let fecha;
    if (pedido.fecha && pedido.fecha.toDate) {
        fecha = pedido.fecha.toDate().toLocaleString('es-ES');
    } else if (pedido.fecha) {
        fecha = new Date(pedido.fecha).toLocaleString('es-ES');
    } else {
        fecha = 'Fecha no disponible';
    }
    
    card.innerHTML = `
        <div class="pedido-header">
            <div>
                <div class="pedido-id">Pedido #${pedido.id} - ${tienda.nombre}</div>
                <div class="pedido-info">${pedido.persona} | ${pedido.obra}</div>
            </div>
            <span class="pedido-estado ${estadoClass}">${pedido.estado}</span>
        </div>
        <div class="pedido-items">
            ${pedido.items.map(item => `
                <div class="pedido-item">
                    <span class="pedido-item-nombre">${item.nombre} (${item.descripcion})</span>
                    <span class="pedido-item-cantidad">x${item.cantidad}</span>
                </div>
            `).join('')}
        </div>
        ${pedido.albaran ? `
            <div class="pedido-albaran">
                <a href="${pedido.albaran}" target="_blank" download>
                    📄 Ver Albarán/Factura
                </a>
            </div>
        ` : ''}
        <div class="pedido-fecha">${fecha}</div>
    `;
    
    return card;
}

// Gestión de Tienda
async function showGestionTienda() {
    // Por ahora, mostrar la primera tienda como ejemplo
    // En producción, esto debería permitir seleccionar la tienda
    const tiendas = await db.getAll('tiendas');
    if (tiendas.length === 0) {
        alert('No hay tiendas disponibles');
        return;
    }
    
    // Por simplicidad, usar la primera tienda
    // En producción, debería haber un selector o login de tienda
    const tienda = tiendas[0];
    currentTienda = tienda;
    
    document.getElementById('gestion-tienda-nombre').textContent = `Gestión - ${tienda.nombre}`;
    showView('gestion-tienda');
    switchTab('en-curso');
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tab === 'en-curso') {
        document.getElementById('pedidos-en-curso').classList.add('active');
        loadPedidosEnCurso();
    } else {
        document.getElementById('pedidos-cerrados').classList.add('active');
        loadPedidosCerrados();
    }
}

async function loadPedidosEnCurso() {
    if (!currentTienda) return;
    
    const pedidos = await db.getPedidosByTienda(currentTienda.id);
    const pedidosEnCurso = pedidos.filter(p => p.estado !== 'Completado');
    const container = document.getElementById('pedidos-en-curso-list');
    const emptyState = document.getElementById('pedidos-en-curso-empty');
    
    if (pedidosEnCurso.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    pedidosEnCurso.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    for (const pedido of pedidosEnCurso) {
        const card = createPedidoGestionCard(pedido);
        container.appendChild(card);
    }
}

async function loadPedidosCerrados() {
    if (!currentTienda) return;
    
    const pedidos = await db.getPedidosByTienda(currentTienda.id);
    const pedidosCerrados = pedidos.filter(p => p.estado === 'Completado');
    const container = document.getElementById('pedidos-cerrados-list');
    const emptyState = document.getElementById('pedidos-cerrados-empty');
    
    if (pedidosCerrados.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    pedidosCerrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    for (const pedido of pedidosCerrados) {
        const card = createPedidoGestionCard(pedido, true);
        container.appendChild(card);
    }
}

function createPedidoGestionCard(pedido, isCerrado = false) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card';
    
    const fecha = new Date(pedido.fecha).toLocaleString('es-ES');
    const estados = ['Nuevo', 'Preparando', 'Preparado', 'En ruta', 'Entregado', 'Completado'];
    
    card.innerHTML = `
        <div class="pedido-gestion-header">
            <div class="pedido-gestion-info">
                <h4>Pedido #${pedido.id}</h4>
                <p>${pedido.persona} | ${pedido.obra}</p>
                <p style="font-size: 0.75rem; color: var(--text-secondary);">${fecha}</p>
            </div>
            ${!isCerrado ? `
                <select class="estado-select" onchange="updateEstadoPedido(${pedido.id}, this.value)">
                    ${estados.map(estado => `
                        <option value="${estado}" ${pedido.estado === estado ? 'selected' : ''}>${estado}</option>
                    `).join('')}
                </select>
            ` : `
                <span class="pedido-estado estado-completado">Completado</span>
            `}
        </div>
        <div class="pedido-items">
            ${pedido.items.map(item => `
                <div class="pedido-item">
                    <span class="pedido-item-nombre">${item.nombre} (${item.descripcion})</span>
                    <span class="pedido-item-cantidad">x${item.cantidad}</span>
                </div>
            `).join('')}
        </div>
        ${pedido.estado === 'Entregado' && !pedido.albaran && !isCerrado ? `
            <div class="file-upload">
                <label for="albaran-${pedido.id}" class="file-upload-label">
                    📎 Adjuntar Albarán/Factura
                </label>
                <input type="file" id="albaran-${pedido.id}" accept=".pdf,.jpg,.jpeg,.png" onchange="uploadAlbaran(${pedido.id}, this.files[0])">
            </div>
        ` : ''}
        ${pedido.albaran ? `
            <div class="pedido-albaran">
                <a href="${pedido.albaran}" target="_blank" download>
                    📄 Ver Albarán/Factura
                </a>
            </div>
        ` : ''}
    `;
    
    return card;
}

window.updateEstadoPedido = async function(pedidoId, nuevoEstado) {
    const pedido = await db.get('pedidos', pedidoId);
    pedido.estado = nuevoEstado;
    
    // Si se marca como Completado, mover a cerrados
    if (nuevoEstado === 'Completado' && pedido.albaran) {
        await db.update('pedidos', pedido);
        loadPedidosEnCurso();
        loadPedidosCerrados();
    } else {
        await db.update('pedidos', pedido);
        loadPedidosEnCurso();
    }
}

window.uploadAlbaran = async function(pedidoId, file) {
    if (!file) return;
    
    // Convertir archivo a base64 para almacenarlo
    const reader = new FileReader();
    reader.onload = async (e) => {
        const pedido = await db.get('pedidos', pedidoId);
        pedido.albaran = e.target.result;
        await db.update('pedidos', pedido);
        loadPedidosEnCurso();
    };
    reader.readAsDataURL(file);
}

// Botones de navegación atrás
document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
        if (currentCategoria) {
            // Volver a categorías
            currentCategoria = null;
            showView('categorias');
            loadCategorias(currentTienda.id);
        } else if (currentTienda) {
            // Volver a tiendas
            currentTienda = null;
            showView('main');
            loadTiendas();
        } else {
            // Volver a main
            showView('main');
            loadTiendas();
        }
    });
});

