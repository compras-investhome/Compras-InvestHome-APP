// Aplicación Principal
// Importar la instancia de db desde database.js
import { db } from './database.js';

let currentUser = null;
let currentUserType = null;
let currentObra = null;
let currentTienda = null;
let currentCategoria = null;
let carrito = [];
let searchResults = [];
let editingUsuarioId = null;
let editingObraId = null;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await db.init();
        await db.initDefaultData();
        
        // Verificar si hay sesión activa
        const sesion = await db.getSesionCompleta();
        if (sesion && sesion.userId) {
            const usuario = await db.get('usuarios', sesion.userId);
            if (usuario) {
                currentUser = usuario;
                currentUserType = usuario.tipo;
                currentObra = sesion.obraId ? await db.get('obras', sesion.obraId) : null;
                currentTienda = sesion.tiendaId ? await db.get('tiendas', sesion.tiendaId) : null;
                redirectByUserType();
            } else {
                showView('login');
            }
        } else {
            showView('login');
        }
    } catch (error) {
        console.error('Error al inicializar Firebase:', error);
        showView('login');
    }

    setupEventListeners();
    setupLoginListeners();
});

// Event Listeners
function setupEventListeners() {
    // Login (manejado en setupLoginListeners)
    
    // Navegación admin
    document.getElementById('btn-admin')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
        showView('admin');
    });

    // Admin menu cards
    document.querySelectorAll('.admin-menu-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            if (action === 'usuarios') {
                showView('admin-usuarios');
                loadUsuarios('Técnico');
            } else if (action === 'obras') {
                showView('admin-obras');
                loadObras();
            }
        });
    });

    // Tabs de usuarios
    document.querySelectorAll('#view-admin-usuarios .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            switchTabUsuarios(tab);
        });
    });

    // Botones de administración
    document.getElementById('btn-nuevo-usuario')?.addEventListener('click', () => {
        openModalUsuario();
    });

    document.getElementById('btn-nueva-obra')?.addEventListener('click', () => {
        openModalObra();
    });

    // Modales
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', closeAllModals);
    });

    document.getElementById('btn-cancelar-usuario')?.addEventListener('click', closeAllModals);
    document.getElementById('btn-cancelar-obra')?.addEventListener('click', closeAllModals);
    document.getElementById('btn-guardar-usuario')?.addEventListener('click', guardarUsuario);
    document.getElementById('btn-guardar-obra')?.addEventListener('click', guardarObra);

    // Listener para tipo de usuario en modal
    const modalTipoUsuario = document.getElementById('modal-usuario-tipo');
    if (modalTipoUsuario) {
        modalTipoUsuario.addEventListener('change', async (e) => {
            if (e.target.value === 'Tienda') {
                document.getElementById('modal-usuario-tienda-group').style.display = 'block';
                const tiendas = await db.getAll('tiendas');
                const selectTienda = document.getElementById('modal-usuario-tienda');
                selectTienda.innerHTML = '<option value="">Seleccione una tienda</option>';
                tiendas.forEach(tienda => {
                    const option = document.createElement('option');
                    option.value = tienda.id;
                    option.textContent = tienda.nombre;
                    selectTienda.appendChild(option);
                });
            } else {
                document.getElementById('modal-usuario-tienda-group').style.display = 'none';
            }
        });
    }

    // Navegación
    document.getElementById('btn-menu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('active');
    });

    document.getElementById('btn-menu-pedidos').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('active');
    });

    document.getElementById('btn-menu-admin')?.addEventListener('click', () => {
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
        // Cerrar sidebar si está abierto
        document.getElementById('sidebar').classList.remove('active');
        
        await db.clearSesion();
        currentUser = null;
        currentUserType = null;
        currentObra = null;
        currentTienda = null;
        carrito = [];
        // Limpiar formulario de login
        document.getElementById('select-tipo-usuario').value = '';
        document.getElementById('select-usuario').value = '';
        document.getElementById('select-obra').value = '';
        document.getElementById('select-tienda').value = '';
        document.getElementById('input-password').value = '';
        updateLoginForm('');
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

// Setup Login Listeners
function setupLoginListeners() {
    const selectTipoUsuario = document.getElementById('select-tipo-usuario');
    const btnLogin = document.getElementById('btn-login');

    selectTipoUsuario.addEventListener('change', async (e) => {
        const tipo = e.target.value;
        updateLoginForm(tipo);
    });

    btnLogin.addEventListener('click', handleLogin);
}

// Actualizar formulario de login según tipo de usuario
async function updateLoginForm(tipoUsuario) {
    const formGroupUsuario = document.getElementById('form-group-usuario');
    const formGroupObra = document.getElementById('form-group-obra');
    const formGroupTienda = document.getElementById('form-group-tienda');
    const formGroupPassword = document.getElementById('form-group-password');
    const selectUsuario = document.getElementById('select-usuario');
    const selectObra = document.getElementById('select-obra');
    const selectTienda = document.getElementById('select-tienda');
    const errorDiv = document.getElementById('login-error');

    // Ocultar todos los campos
    formGroupUsuario.style.display = 'none';
    formGroupObra.style.display = 'none';
    formGroupTienda.style.display = 'none';
    formGroupPassword.style.display = 'none';
    errorDiv.style.display = 'none';

    if (!tipoUsuario) return;

    // Mostrar campo de contraseña para todos
    formGroupPassword.style.display = 'block';

    if (tipoUsuario === 'Administrador' || tipoUsuario === 'Contabilidad') {
        // Usuario + Contraseña
        const usuarios = await db.getUsuariosByTipo(tipoUsuario);
        selectUsuario.innerHTML = '<option value="">Seleccione un usuario</option>';
        usuarios.forEach(usuario => {
            const option = document.createElement('option');
            option.value = usuario.id;
            option.textContent = usuario.username;
            selectUsuario.appendChild(option);
        });
        // Si solo hay un usuario, seleccionarlo automáticamente
        if (usuarios.length === 1) {
            selectUsuario.value = usuarios[0].id;
        }
        formGroupUsuario.style.display = 'block';
    } else if (tipoUsuario === 'Técnico' || tipoUsuario === 'Encargado') {
        // Usuario + Obra + Contraseña
        formGroupUsuario.style.display = 'block';
        formGroupObra.style.display = 'block';
        
        // Cargar usuarios de ese tipo
        const usuarios = await db.getUsuariosByTipo(tipoUsuario);
        selectUsuario.innerHTML = '<option value="">Seleccione un usuario</option>';
        usuarios.forEach(usuario => {
            const option = document.createElement('option');
            option.value = usuario.id;
            option.textContent = usuario.username;
            selectUsuario.appendChild(option);
        });

        // Cargar obras
        const obras = await db.getAllObras();
        selectObra.innerHTML = '<option value="">Seleccione una obra</option>';
        obras.forEach(obra => {
            const option = document.createElement('option');
            option.value = obra.id;
            option.textContent = obra.nombreComercial;
            selectObra.appendChild(option);
        });
    } else if (tipoUsuario === 'Tienda') {
        // Tienda + Contraseña
        formGroupTienda.style.display = 'block';
        
        // Cargar usuarios de tipo Tienda
        const usuarios = await db.getUsuariosByTipo('Tienda');
        selectUsuario.innerHTML = '<option value="">Seleccione un usuario</option>';
        usuarios.forEach(usuario => {
            const option = document.createElement('option');
            option.value = usuario.id;
            option.textContent = usuario.username;
            option.dataset.tiendaId = usuario.tiendaId;
            selectUsuario.appendChild(option);
        });
        formGroupUsuario.style.display = 'block';

        // Actualizar select de tienda cuando se selecciona usuario
        selectUsuario.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (selectedOption.dataset.tiendaId) {
                selectTienda.value = selectedOption.dataset.tiendaId;
            }
        });
    }
}

// Manejo de Login
async function handleLogin() {
    const tipoUsuario = document.getElementById('select-tipo-usuario').value;
    const userId = document.getElementById('select-usuario').value;
    const obraId = document.getElementById('select-obra').value;
    const tiendaId = document.getElementById('select-tienda').value;
    const password = document.getElementById('input-password').value;
    const errorDiv = document.getElementById('login-error');

    errorDiv.style.display = 'none';

    // Validaciones
    if (!tipoUsuario) {
        showError('Por favor, seleccione un tipo de usuario');
        return;
    }

    if (!userId) {
        showError('Por favor, seleccione un usuario');
        return;
    }

    if (!password || password.length !== 4 || !/^\d{4}$/.test(password)) {
        showError('Por favor, ingrese una contraseña de 4 dígitos');
        return;
    }

    if ((tipoUsuario === 'Técnico' || tipoUsuario === 'Encargado') && !obraId) {
        showError('Por favor, seleccione una obra');
        return;
    }

    if (tipoUsuario === 'Tienda' && !tiendaId) {
        showError('Por favor, seleccione una tienda');
        return;
    }

    try {
        // Verificar usuario y contraseña
        const usuario = await db.get('usuarios', userId);
        if (!usuario) {
            showError('Usuario no encontrado');
            return;
        }

        if (usuario.password !== password) {
            showError('Contraseña incorrecta');
            return;
        }

        if (usuario.tipo !== tipoUsuario) {
            showError('Tipo de usuario no coincide');
            return;
        }

        // Si es Tienda, verificar que la tienda coincida
        if (tipoUsuario === 'Tienda' && usuario.tiendaId !== tiendaId) {
            showError('La tienda no coincide con el usuario');
            return;
        }

        // Guardar sesión
        currentUser = usuario;
        currentUserType = usuario.tipo;
        
        if (obraId) {
            currentObra = await db.get('obras', obraId);
        }
        
        if (tiendaId) {
            currentTienda = await db.get('tiendas', tiendaId);
        }

        await db.saveSesionCompleta({
            userId: usuario.id,
            obraId: obraId || null,
            tiendaId: tiendaId || null
        });

        // Actualizar sidebar
        updateSidebar();

        // Redirigir según tipo de usuario
        redirectByUserType();
    } catch (error) {
        console.error('Error en login:', error);
        showError('Error al iniciar sesión. Por favor, inténtalo de nuevo.');
    }
}

function showError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function redirectByUserType() {
    if (currentUserType === 'Administrador') {
        showView('admin');
    } else if (currentUserType === 'Contabilidad') {
        // TODO: Implementar vista de contabilidad
        showView('main');
        loadTiendas();
    } else if (currentUserType === 'Técnico' || currentUserType === 'Encargado') {
        showView('main');
        loadTiendas();
        updateCartCount();
    } else if (currentUserType === 'Tienda') {
        showGestionTienda();
    }
}

function updateSidebar() {
    document.getElementById('sidebar-usuario').textContent = currentUser.username;
    document.getElementById('sidebar-tipo').textContent = currentUserType;
    
    const obraInfo = document.getElementById('sidebar-obra-info');
    const tiendaInfo = document.getElementById('sidebar-tienda-info');
    
    if (currentObra) {
        obraInfo.style.display = 'block';
        document.getElementById('sidebar-obra').textContent = currentObra.nombreComercial;
    } else {
        obraInfo.style.display = 'none';
    }
    
    if (currentTienda) {
        tiendaInfo.style.display = 'block';
        document.getElementById('sidebar-tienda').textContent = currentTienda.nombre;
    } else {
        tiendaInfo.style.display = 'none';
    }

    // Mostrar/ocultar botones según tipo de usuario
    const btnAdmin = document.getElementById('btn-admin');
    const btnGestionTienda = document.getElementById('btn-gestion-tienda');
    
    if (btnAdmin) btnAdmin.style.display = currentUserType === 'Administrador' ? 'block' : 'none';
    if (btnGestionTienda) btnGestionTienda.style.display = currentUserType === 'Tienda' ? 'block' : 'none';
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
    
    if (!currentObra) {
        alert('No se ha seleccionado una obra');
        return;
    }
    
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
            tiendaId: tiendaId,
            userId: currentUser.id,
            persona: currentUser.username,
            obraId: currentObra.id,
            obraNombreComercial: currentObra.nombreComercial,
            obraDireccionGoogleMaps: currentObra.direccionGoogleMaps || '',
            obraEncargado: currentObra.encargado || '',
            obraTelefono: currentObra.telefonoEncargado || '',
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
    if (!currentUser || !currentObra) {
        const container = document.getElementById('pedidos-list');
        const emptyState = document.getElementById('pedidos-empty');
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    const pedidos = await db.getPedidosByUser(currentUser.id, currentObra.id);
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
    if (!currentTienda) {
        alert('No hay tienda asociada');
        return;
    }
    
    document.getElementById('gestion-tienda-nombre').textContent = `Gestión - ${currentTienda.nombre}`;
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
    
    pedidosEnCurso.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
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
    
    pedidosCerrados.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    for (const pedido of pedidosCerrados) {
        const card = createPedidoGestionCard(pedido, true);
        container.appendChild(card);
    }
}

function createPedidoGestionCard(pedido, isCerrado = false) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card';
    
    let fecha;
    if (pedido.fecha && pedido.fecha.toDate) {
        fecha = pedido.fecha.toDate().toLocaleString('es-ES');
    } else if (pedido.fecha) {
        fecha = new Date(pedido.fecha).toLocaleString('es-ES');
    } else {
        fecha = 'Fecha no disponible';
    }
    
    const estados = ['Nuevo', 'Preparando', 'Preparado', 'En ruta', 'Entregado', 'Completado'];
    
    // Información de la obra
    const obraNombre = pedido.obraNombreComercial || pedido.obra || 'Obra no especificada';
    const obraDireccion = pedido.obraDireccionGoogleMaps || '';
    const obraEncargado = pedido.obraEncargado || '';
    const obraTelefono = pedido.obraTelefono || '';
    
    // Crear enlace clickable para el nombre de la obra si hay dirección
    const obraNombreHtml = obraDireccion 
        ? `<a href="${obraDireccion}" target="_blank" style="color: var(--primary-color); text-decoration: none; font-weight: 600;">${obraNombre}</a>`
        : obraNombre;
    
    card.innerHTML = `
        <div class="pedido-gestion-header">
            <div class="pedido-gestion-info">
                <h4>Pedido #${pedido.id}</h4>
                <p><strong>Usuario:</strong> ${pedido.persona}</p>
                <p><strong>Obra:</strong> ${obraNombreHtml}</p>
                ${obraDireccion ? `<p style="font-size: 0.75rem; color: var(--text-secondary);"><a href="${obraDireccion}" target="_blank" style="color: var(--primary-color);">📍 Ver en Google Maps</a></p>` : ''}
                ${obraEncargado ? `<p style="font-size: 0.875rem;"><strong>Encargado:</strong> ${obraEncargado}${obraTelefono ? ` | Tel: ${obraTelefono}` : ''}</p>` : ''}
                <p style="font-size: 0.75rem; color: var(--text-secondary);">${fecha}</p>
            </div>
            ${!isCerrado ? `
                <select class="estado-select" onchange="updateEstadoPedido('${pedido.id}', this.value)">
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
                <input type="file" id="albaran-${pedido.id}" accept=".pdf,.jpg,.jpeg,.png" onchange="uploadAlbaran('${pedido.id}', this.files[0])">
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
    if (!pedido) return;
    
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
        if (!pedido) return;
        
        pedido.albaran = e.target.result;
        await db.update('pedidos', pedido);
        loadPedidosEnCurso();
    };
    reader.readAsDataURL(file);
}

// Botones de navegación atrás
document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = document.querySelector('.view.active');
        if (view.id === 'view-admin-usuarios' || view.id === 'view-admin-obras') {
            showView('admin');
        } else if (currentCategoria) {
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

// ========== FUNCIONES DE ADMINISTRACIÓN ==========

// Gestión de Usuarios
async function loadUsuarios(tipo) {
    const usuarios = await db.getUsuariosByTipo(tipo);
    const container = document.getElementById('usuarios-list');
    const emptyState = document.getElementById('usuarios-empty');

    if (usuarios.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    usuarios.forEach(usuario => {
        const card = createUsuarioCard(usuario);
        container.appendChild(card);
    });
}

function createUsuarioCard(usuario) {
    const card = document.createElement('div');
    card.className = 'usuario-card';
    card.innerHTML = `
        <div class="usuario-info">
            <h4>${usuario.username}</h4>
            <p>Tipo: ${usuario.tipo}${usuario.tiendaId ? ' | Tienda asociada' : ''}</p>
        </div>
        <div class="usuario-actions">
            <button class="btn-icon" onclick="editarUsuario('${usuario.id}')" title="Editar">✏️</button>
            <button class="btn-icon danger" onclick="eliminarUsuario('${usuario.id}')" title="Eliminar">🗑️</button>
        </div>
    `;
    return card;
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
    loadUsuarios(tipoMap[tab]);
}

window.editarUsuario = async function(usuarioId) {
    const usuario = await db.get('usuarios', usuarioId);
    if (!usuario) return;

    editingUsuarioId = usuarioId;
    document.getElementById('modal-usuario-titulo').textContent = 'Editar Usuario';
    document.getElementById('modal-usuario-nombre').value = usuario.username;
    document.getElementById('modal-usuario-tipo').value = usuario.tipo;
    document.getElementById('modal-usuario-password').value = '';
    
    if (usuario.tipo === 'Tienda') {
        document.getElementById('modal-usuario-tienda-group').style.display = 'block';
        const tiendas = await db.getAll('tiendas');
        const selectTienda = document.getElementById('modal-usuario-tienda');
        selectTienda.innerHTML = '<option value="">Seleccione una tienda</option>';
        tiendas.forEach(tienda => {
            const option = document.createElement('option');
            option.value = tienda.id;
            option.textContent = tienda.nombre;
            if (usuario.tiendaId === tienda.id) option.selected = true;
            selectTienda.appendChild(option);
        });
    } else {
        document.getElementById('modal-usuario-tienda-group').style.display = 'none';
    }

    document.getElementById('modal-usuario').classList.add('active');
};

window.eliminarUsuario = async function(usuarioId) {
    if (!confirm('¿Está seguro de eliminar este usuario?')) return;
    
    try {
        await db.eliminarUsuario(usuarioId);
        const tipo = document.querySelector('#view-admin-usuarios .tab-btn.active').dataset.tab;
        switchTabUsuarios(tipo);
    } catch (error) {
        alert('Error al eliminar usuario: ' + error.message);
    }
};

function openModalUsuario() {
    editingUsuarioId = null;
    document.getElementById('modal-usuario-titulo').textContent = 'Nuevo Usuario';
    document.getElementById('modal-usuario-nombre').value = '';
    document.getElementById('modal-usuario-tipo').value = 'Técnico';
    document.getElementById('modal-usuario-password').value = '';
    document.getElementById('modal-usuario-tienda-group').style.display = 'none';

    document.getElementById('modal-usuario').classList.add('active');
}

async function guardarUsuario() {
    const nombre = document.getElementById('modal-usuario-nombre').value.trim();
    const tipo = document.getElementById('modal-usuario-tipo').value;
    const password = document.getElementById('modal-usuario-password').value;
    const tiendaId = document.getElementById('modal-usuario-tienda').value;

    if (!nombre) {
        alert('Por favor, ingrese un nombre de usuario');
        return;
    }

    if (!password || password.length !== 4 || !/^\d{4}$/.test(password)) {
        alert('Por favor, ingrese una contraseña de 4 dígitos');
        return;
    }

    if (tipo === 'Tienda' && !tiendaId) {
        alert('Por favor, seleccione una tienda');
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
        }

        if (editingUsuarioId) {
            usuarioData.id = editingUsuarioId;
            await db.actualizarUsuario(usuarioData);
        } else {
            await db.crearUsuario(usuarioData);
        }

        closeAllModals();
        const tipoTab = document.querySelector('#view-admin-usuarios .tab-btn.active').dataset.tab;
        switchTabUsuarios(tipoTab);
    } catch (error) {
        alert('Error al guardar usuario: ' + error.message);
    }
}

// Gestión de Obras
async function loadObras() {
    const obras = await db.getAllObras();
    const container = document.getElementById('obras-list');
    const emptyState = document.getElementById('obras-empty');

    if (obras.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    obras.forEach(obra => {
        const card = createObraCard(obra);
        container.appendChild(card);
    });
}

function createObraCard(obra) {
    const card = document.createElement('div');
    card.className = 'obra-card';
    
    const direccionLink = obra.direccionGoogleMaps 
        ? `<a href="${obra.direccionGoogleMaps}" target="_blank">${obra.direccionGoogleMaps}</a>`
        : 'No especificada';
    
    card.innerHTML = `
        <div class="obra-header">
            <div>
                <h4>${obra.nombreComercial}</h4>
                <div class="obra-info">Encargado: ${obra.encargado || 'No especificado'}</div>
                <div class="obra-info">Teléfono: ${obra.telefonoEncargado || 'No especificado'}</div>
                <div class="obra-direccion">Dirección: ${direccionLink}</div>
            </div>
        </div>
        <div class="obra-actions">
            <button class="btn-icon" onclick="editarObra('${obra.id}')" title="Editar">✏️</button>
            <button class="btn-icon danger" onclick="eliminarObra('${obra.id}')" title="Eliminar">🗑️</button>
        </div>
    `;
    return card;
}

window.editarObra = async function(obraId) {
    const obra = await db.get('obras', obraId);
    if (!obra) return;

    editingObraId = obraId;
    document.getElementById('modal-obra-titulo').textContent = 'Editar Obra';
    document.getElementById('modal-obra-nombre').value = obra.nombreComercial || '';
    document.getElementById('modal-obra-direccion').value = obra.direccionGoogleMaps || '';
    document.getElementById('modal-obra-encargado').value = obra.encargado || '';
    document.getElementById('modal-obra-telefono').value = obra.telefonoEncargado || '';

    document.getElementById('modal-obra').classList.add('active');
};

window.eliminarObra = async function(obraId) {
    if (!confirm('¿Está seguro de eliminar esta obra?')) return;
    
    try {
        await db.eliminarObra(obraId);
        loadObras();
    } catch (error) {
        alert('Error al eliminar obra: ' + error.message);
    }
};

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
        alert('Por favor, ingrese un nombre comercial');
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
        alert('Error al guardar obra: ' + error.message);
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    editingUsuarioId = null;
    editingObraId = null;
}

