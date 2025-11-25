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
const contabilidadTabBadgeMap = {
    pendientes: 'tab-count-pendientes',
    cuentas: 'tab-count-cuentas',
    especiales: 'tab-count-especiales',
    facturas: 'tab-count-facturas',
    historico: 'tab-count-historico'
};

// Funciones personalizadas para popups
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
        
        // Focus en el input
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

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Configurar event listeners PRIMERO (siempre deben estar activos)
    setupEventListeners();
    setupLoginListeners();
    
    // Mostrar login por defecto
    showView('login');
    
    try {
        await db.init();
        await db.initDefaultData();
        
        // Verificar si hay sesión activa
        const sesion = await db.getSesionCompleta();
        if (sesion && sesion.userId) {
            try {
                // Si el userId empieza con "tienda_", es una sesión de tienda
                if (sesion.userId.startsWith('tienda_')) {
                    const tiendaId = sesion.userId.replace('tienda_', '');
                    const tienda = await db.get('tiendas', tiendaId);
                    if (tienda) {
                        currentUser = {
                            id: sesion.userId,
                            username: tienda.nombre,
                            tipo: 'Tienda'
                        };
                        currentUserType = 'Tienda';
                        currentTienda = tienda;
                        updateSidebar();
                        redirectByUserType();
                        return;
                    }
                } else {
                    // Es un usuario normal
                    const usuario = await db.get('usuarios', sesion.userId);
                    if (usuario) {
                        currentUser = usuario;
                        currentUserType = usuario.tipo;
                        currentObra = sesion.obraId ? await db.get('obras', sesion.obraId) : null;
                        currentTienda = sesion.tiendaId ? await db.get('tiendas', sesion.tiendaId) : null;
                        updateSidebar();
                        redirectByUserType();
                        return;
                    }
                }
            } catch (error) {
                console.error('Error al cargar sesión:', error);
                // Limpiar sesión inválida
                await db.clearSesion();
            }
        }
        
        // Si llegamos aquí, no hay sesión válida, mostrar login
        showView('login');
    } catch (error) {
        console.error('Error al inicializar Firebase:', error);
        showView('login');
    }
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
            } else if (action === 'tiendas') {
                showView('admin-tiendas');
                loadTiendasAdmin();
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

    // Botones de tiendas
    document.getElementById('btn-nueva-tienda')?.addEventListener('click', () => {
        openModalTienda();
    });

    document.getElementById('btn-nueva-categoria')?.addEventListener('click', () => {
        openModalCategoria();
    });

    document.getElementById('btn-nuevo-producto')?.addEventListener('click', () => {
        openModalProducto();
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
    
    // Listeners para modales de tiendas
    document.getElementById('btn-cancelar-tienda')?.addEventListener('click', closeAllModals);
    document.getElementById('btn-guardar-tienda')?.addEventListener('click', guardarTienda);
    document.getElementById('btn-cancelar-categoria')?.addEventListener('click', closeAllModals);
    document.getElementById('btn-guardar-categoria')?.addEventListener('click', guardarCategoria);
    document.getElementById('btn-cancelar-producto')?.addEventListener('click', closeAllModals);
    document.getElementById('btn-guardar-producto')?.addEventListener('click', guardarProducto);
    
    // Listeners para importación Excel
    document.getElementById('btn-importar-excel')?.addEventListener('click', () => {
        excelImportMode = 'productos';
        openModalExcel();
    });
    
    document.getElementById('btn-importar-excel-categorias')?.addEventListener('click', () => {
        excelImportMode = 'categorias';
        openModalExcel();
    });
    
    document.getElementById('btn-cancelar-excel')?.addEventListener('click', closeAllModals);
    document.getElementById('btn-procesar-excel')?.addEventListener('click', procesarExcel);
    
    const excelFileInput = document.getElementById('excel-file-input');
    if (excelFileInput) {
        excelFileInput.addEventListener('change', (e) => {
            document.getElementById('btn-procesar-excel').disabled = !e.target.files.length;
        });
    }
    
    // Setup dropzone y listeners de tienda
    setupTiendaModalListeners();

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
    
    document.getElementById('btn-menu-tienda')?.addEventListener('click', () => {
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
            if (
                tab === 'pedidos-contabilidad' ||
                tab === 'pedidos-pagados-contabilidad' ||
                tab === 'cuentas-contabilidad' ||
                tab === 'pedidos-especiales-contabilidad' ||
                tab === 'facturas-pendientes-contabilidad'
            ) {
                switchTabContabilidad(tab);
            } else {
                switchTab(tab);
            }
        });
    });

    
    // Menú de contabilidad
    document.getElementById('btn-menu-contabilidad')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('active');
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
        // Solo Tienda + Contraseña (sin usuarios)
        formGroupTienda.style.display = 'block';
        
        // Cargar todas las tiendas
        const tiendas = await db.getAll('tiendas');
        selectTienda.innerHTML = '<option value="">Seleccione una tienda</option>';
        tiendas.forEach(tienda => {
            const option = document.createElement('option');
            option.value = tienda.id;
            option.textContent = tienda.nombre;
            selectTienda.appendChild(option);
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

    if (!password || password.length !== 4 || !/^\d{4}$/.test(password)) {
        showError('Por favor, ingrese una contraseña de 4 dígitos');
        return;
    }

    // Validaciones específicas por tipo
    if (tipoUsuario === 'Tienda') {
        if (!tiendaId) {
            showError('Por favor, seleccione una tienda');
            return;
        }
    } else {
        if (!userId) {
            showError('Por favor, seleccione un usuario');
            return;
        }
        
        if ((tipoUsuario === 'Técnico' || tipoUsuario === 'Encargado') && !obraId) {
            showError('Por favor, seleccione una obra');
            return;
        }
    }

    try {
        let usuario = null;
        let tienda = null;
        
        if (tipoUsuario === 'Tienda') {
            // Validar contraseña de la tienda directamente
            tienda = await db.get('tiendas', tiendaId);
            if (!tienda) {
                showError('Tienda no encontrada');
                return;
            }
            
            if (!tienda.password || tienda.password !== password) {
                showError('Contraseña incorrecta');
                return;
            }
            
            // Crear objeto de usuario temporal para compatibilidad
            usuario = {
                id: `tienda_${tiendaId}`,
                username: tienda.nombre,
                tipo: 'Tienda'
            };
        } else {
            // Validar usuario y contraseña
            usuario = await db.get('usuarios', userId);
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
        }

        // Guardar sesión
        currentUser = usuario;
        currentUserType = tipoUsuario;
        
        if (obraId) {
            currentObra = await db.get('obras', obraId);
        }
        
        if (tiendaId) {
            currentTienda = tienda || await db.get('tiendas', tiendaId);
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
        showView('contabilidad');
        loadPedidosContabilidad();
        switchTabContabilidad('pedidos-contabilidad');
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
    
    // Asegurar que el botón de búsqueda esté visible en la vista principal para técnicos/encargados
    const searchBtn = document.getElementById('btn-search');
    if (searchBtn) {
        if (viewName === 'main' && (currentUserType === 'Técnico' || currentUserType === 'Encargado')) {
            searchBtn.style.display = 'flex';
        } else if (viewName === 'main') {
            searchBtn.style.display = 'flex';
        }
    }
}

// Cargar Tiendas
async function loadTiendas() {
    let tiendas = await db.getAll('tiendas');
    
    // Debug: verificar logos de todas las tiendas
    console.log('Tiendas cargadas:', tiendas.length);
    tiendas.forEach(t => {
        console.log(`Tienda: ${t.nombre}, Logo: ${t.logo ? 'Sí (' + (t.logo.length || 0) + ' chars)' : 'No'}`);
    });
    
    // Si no es administrador, filtrar solo tiendas activas
    if (currentUserType !== 'Administrador' && currentUserType !== 'Contabilidad') {
        tiendas = tiendas.filter(t => t.activa !== false);
    }
    
    const container = document.getElementById('tiendas-list');
    
    if (searchResults.length > 0) {
        // Mostrar resultados de búsqueda como productos
        container.innerHTML = '';
        container.className = 'productos-list';
        
        for (const producto of searchResults) {
            const card = await createProductoCard(producto);
            container.appendChild(card);
            
            // Agregar event listener al botón "Añadir"
            const btnAdd = card.querySelector('.btn-add-cart[data-producto-id]');
            if (btnAdd) {
                btnAdd.addEventListener('click', async () => {
                    const productoId = btnAdd.getAttribute('data-producto-id');
                    const cantidadInput = card.querySelector(`.cantidad-input[data-producto-id="${productoId}"]`);
                    const cantidad = cantidadInput ? parseInt(cantidadInput.value) || 1 : 1;
                    await addToCart(productoId, cantidad);
                });
            }
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
    
    // Debug: verificar si el logo existe
    console.log('Tienda:', tienda.nombre, 'Logo:', tienda.logo ? 'Sí tiene logo' : 'No tiene logo', 'Logo completo:', tienda.logo);
    
    // Mostrar logo si existe, si no mostrar icono
    let imagenHtml = '';
    // Verificar si el logo existe y no es null, undefined o string vacío
    const tieneLogo = tienda.logo && 
                      typeof tienda.logo === 'string' && 
                      tienda.logo.trim() !== '' && 
                      tienda.logo !== 'null' && 
                      tienda.logo !== 'undefined' &&
                      (tienda.logo.startsWith('data:image/') || tienda.logo.startsWith('http'));
    
    if (tieneLogo) {
        imagenHtml = `
            <img src="${tienda.logo}" alt="${tienda.nombre}" class="tienda-card-logo" onerror="console.error('Error al cargar logo de ${tienda.nombre}'); this.style.display='none'; const icon = this.parentElement.querySelector('.tienda-card-icon'); if(icon) icon.style.display='flex';">
            <div class="tienda-card-icon" style="display: none;">${tienda.icono || '🏪'}</div>
        `;
    } else {
        imagenHtml = `<div class="tienda-card-icon">${tienda.icono || '🏪'}</div>`;
    }
    
    // Obtener servicios
    const servicios = [];
    if (tienda.servicios?.cuenta) servicios.push('Cuenta');
    if (tienda.servicios?.transporte) servicios.push('Transporte gratuito');
    if (tienda.servicios?.preparacion) servicios.push('Preparación de pedidos');
    if (tienda.servicios?.baseDatos) servicios.push('Base de datos');
    
    card.innerHTML = `
        ${imagenHtml}
        <h3>${tienda.nombre}</h3>
        ${tienda.sector ? `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">${tienda.sector}</div>` : ''}
        ${servicios.length > 0 ? `<div style="font-size: 0.75rem; color: var(--primary-color); margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.25rem; justify-content: center;">
            ${servicios.map(s => `<span style="background: var(--primary-color-light); padding: 0.25rem 0.5rem; border-radius: 12px;">${s}</span>`).join('')}
        </div>` : ''}
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
    
    for (const producto of productos) {
        const card = await createProductoCard(producto);
        container.appendChild(card);
        
        // Agregar event listener al botón "Añadir"
        const btnAdd = card.querySelector('.btn-add-cart[data-producto-id]');
        if (btnAdd) {
            btnAdd.addEventListener('click', async () => {
                const productoId = btnAdd.getAttribute('data-producto-id');
                const cantidadInput = card.querySelector(`.cantidad-input[data-producto-id="${productoId}"]`);
                const cantidad = cantidadInput ? parseInt(cantidadInput.value) || 1 : 1;
                await addToCart(productoId, cantidad);
            });
        }
    }
}

async function createProductoCard(producto) {
    const card = document.createElement('div');
    card.className = 'producto-card';
    
    const cantidadEnCarrito = getCantidadEnCarrito(producto.id);
    const foto = producto.foto ? `<img src="${producto.foto}" alt="${producto.nombre}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-right: 1rem;" onerror="this.style.display='none'">` : '';
    
    // Obtener nombre de la tienda si es resultado de búsqueda
    let vendidoPor = '';
    if (searchResults.length > 0 && producto.tiendaId) {
        try {
            const tienda = await db.get('tiendas', producto.tiendaId);
            if (tienda) {
                vendidoPor = `<p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem;">Vendido por: <strong>${tienda.nombre}</strong></p>`;
            }
        } catch (error) {
            console.error('Error al obtener tienda:', error);
        }
    }
    
    card.innerHTML = `
        ${foto}
        <div class="producto-info" style="flex: 1;">
            <h3>${producto.nombre}</h3>
            ${vendidoPor}
            ${producto.descripcion ? `<p>${producto.descripcion}</p>` : ''}
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
                <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
                    <input type="number" class="cantidad-input" data-producto-id="${producto.id}" min="1" value="1" style="width: 60px; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: 4px; text-align: center;">
                    <button class="btn-add-cart" data-producto-id="${producto.id}">Añadir</button>
                </div>
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
window.addToCart = async function(productoId, cantidad = 1) {
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
    
    const existingItem = carrito.find(item => item.productoId === productoId);
    
    if (existingItem) {
        existingItem.cantidad += cantidadNum;
    } else {
        carrito.push({
            productoId: productoId,
            producto: producto,
            cantidad: cantidadNum
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
                <span class="carrito-item-tienda">Vendido por: ${data.tienda.nombre}</span>
            </div>
            ${data.items.map(item => {
                const foto = item.producto.foto ? `<img src="${item.producto.foto}" alt="${item.producto.nombre}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; margin-right: 1rem;" onerror="this.style.display='none'">` : '';
                return `
                <div class="carrito-item-producto" style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                    ${foto}
                    <div style="flex: 1;">
                        <h4>${item.producto.nombre}</h4>
                        ${item.producto.descripcion ? `<p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem;">${item.producto.descripcion}</p>` : ''}
                        ${item.producto.precio ? `<p style="color: var(--primary-color); font-weight: 600; margin-top: 0.25rem;">${item.producto.precio.toFixed(2)} €</p>` : ''}
                    </div>
                    <div class="carrito-item-controls">
                        <div class="quantity-control">
                            <button class="quantity-btn decrement-carrito" data-producto-id="${item.productoId}">-</button>
                            <span class="quantity-value">${item.cantidad}</span>
                            <button class="quantity-btn increment-carrito" data-producto-id="${item.productoId}">+</button>
                        </div>
                        <button class="btn-remove-item remove-carrito" data-producto-id="${item.productoId}" title="Eliminar">✕</button>
                    </div>
                </div>
            `;
            }).join('')}
        `;
        container.appendChild(grupo);
        
        // Agregar event listeners a los botones
        grupo.querySelectorAll('.increment-carrito').forEach(btn => {
            btn.addEventListener('click', () => {
                const productoId = btn.getAttribute('data-producto-id');
                incrementCarritoItem(productoId);
            });
        });
        
        grupo.querySelectorAll('.decrement-carrito').forEach(btn => {
            btn.addEventListener('click', () => {
                const productoId = btn.getAttribute('data-producto-id');
                decrementCarritoItem(productoId);
            });
        });
        
        grupo.querySelectorAll('.remove-carrito').forEach(btn => {
            btn.addEventListener('click', () => {
                const productoId = btn.getAttribute('data-producto-id');
                removeCarritoItem(productoId);
            });
        });
    }
    
    btnFinalizar.addEventListener('click', finalizarPedido);
}

function incrementCarritoItem(productoId) {
    incrementProducto(productoId);
    loadCarrito();
}

function decrementCarritoItem(productoId) {
    decrementProducto(productoId);
    loadCarrito();
}

function removeCarritoItem(productoId) {
    carrito = carrito.filter(item => item.productoId !== productoId);
    updateCartCount();
    loadCarrito();
}

// Finalizar Pedido
async function finalizarPedido() {
    if (carrito.length === 0) return;
    
    if (!currentObra) {
        await showAlert('No se ha seleccionado una obra', 'Error');
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
    const pedidosCreados = [];
    for (const [tiendaId, items] of Object.entries(itemsPorTienda)) {
        const tienda = await db.get('tiendas', tiendaId);
        console.log('Creando pedido para tienda ID:', tiendaId, 'Tienda:', tienda);
        
        // Determinar estadoPago según tipo de cuenta
        let estadoPago = null;
        if (!tienda.tieneCuenta) {
            // Sin cuenta: Pendiente de pago por defecto (siempre)
            estadoPago = 'Pendiente de pago';
        } else {
            // Con cuenta (con o sin límite): Sin Asignar por defecto
            estadoPago = 'Sin Asignar';
        }
        
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
                designacion: item.producto.designacion || null,
                referencia: item.producto.referencia || null,
                ean: item.producto.ean || null,
                foto: item.producto.foto || null,
                descripcion: item.producto.descripcion,
                cantidad: item.cantidad,
                precio: item.producto.precio || 0
            })),
            estado: 'Nuevo',
            estadoPago: estadoPago,
            albaran: null,
            transferenciaPDF: null,
            pedidoSistemaPDF: null // PDF/captura del pedido del sistema de la tienda
        };
        
        await db.add('pedidos', pedido);
        pedidosCreados.push(tienda ? tienda.nombre : 'Tienda');
    }
    
    // Limpiar carrito
    carrito = [];
    updateCartCount();
    
    // Mostrar mensaje de éxito
    const mensaje = pedidosCreados.length === 1 
        ? `Pedido realizado con éxito para ${pedidosCreados[0]}`
        : `Se han creado ${pedidosCreados.length} pedidos:\n${pedidosCreados.join(', ')}`;
    await showAlert(mensaje, 'Éxito');
    
    // Volver a la vista principal
    showView('main');
    loadTiendas();
    loadTiendas();
}

// Mis Pedidos
async function loadMisPedidos() {
    if (!currentUser) {
        const container = document.getElementById('pedidos-list');
        const emptyState = document.getElementById('pedidos-empty');
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    // Obtener TODOS los pedidos de TODAS las obras (excepto completados)
    // Esto permite que cualquier técnico/encargado vea y gestione todos los pedidos de todas las obras
    const todosPedidos = await db.getAll('pedidos');
    const pedidosNoCompletados = todosPedidos.filter(p => p.estado !== 'Completado');
    
    const container = document.getElementById('pedidos-list');
    const emptyState = document.getElementById('pedidos-empty');
    
    if (pedidosNoCompletados.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    // Ordenar pedidos por fecha (más recientes primero)
    pedidosNoCompletados.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    // Obtener catálogo de obras (todas las obras, incluso sin pedidos)
    const obras = await getObrasCatalog(pedidosNoCompletados);
    
    let totalCount = 0;
    for (const obra of obras) {
        const obraId = obra.id || 'sin-obra';
        const pedidosObra = pedidosNoCompletados.filter(p => (p.obraId || 'sin-obra') === obraId);
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
    
    // Actualizar badge del header
    const badge = document.getElementById('pedidos-total-badge');
    if (badge) {
        badge.textContent = totalCount;
    }
}

async function createPedidoCard(pedido, tienda) {
    const card = document.createElement('div');
    card.className = 'pedido-card';
    
    const estadoClass = `estado-${pedido.estado.toLowerCase().replace(' ', '-')}`;
    // Firestore devuelve fechas como Timestamp, convertir si es necesario
    let fecha;
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
        fechaObj = new Date(); // Usar fecha actual como fallback
    }
    
    // Formatear como día/mes/año
    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const año = fechaObj.getFullYear();
    fecha = `${dia}/${mes}/${año}`;
    
    // Calcular precio total del pedido
    const precioTotalPedido = pedido.items.reduce((total, item) => {
        const precioItem = item.precio || 0;
        const cantidad = item.cantidad || 0;
        return total + (precioItem * cantidad);
    }, 0);
    
    // Obtener estado de pago
    const estadoPago = pedido.estadoPago || 'Sin Asignar';
    
    // Generar HTML para estado de pago
    let estadoPagoHtml = '';
    if (estadoPago === 'Pagado' || pedido.transferenciaPDF) {
        estadoPagoHtml = `
            <div style="margin-top: 0.75rem; padding: 0.75rem; background: #d1fae5; border-radius: 8px; border: 2px solid #10b981;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span style="display: inline-block; padding: 0.375rem 0.75rem; background-color: #10b981; color: white; border-radius: 20px; font-size: 0.875rem; font-weight: 600;">✓ Pagado</span>
                </div>
                ${pedido.transferenciaPDF ? `
                    <a href="${pedido.transferenciaPDF}" target="_blank" download style="color: var(--primary-color); text-decoration: none; font-size: 0.875rem;">
                        📄 Ver PDF de Transferencia
                    </a>
                ` : ''}
            </div>
        `;
    } else if (estadoPago === 'Pago A cuenta') {
        estadoPagoHtml = `
            <div style="margin-top: 0.75rem; padding: 0.75rem; background: #dbeafe; border-radius: 8px; border: 2px solid #3b82f6;">
                <span style="display: inline-block; padding: 0.375rem 0.75rem; background-color: #3b82f6; color: white; border-radius: 20px; font-size: 0.875rem; font-weight: 600;">Pago A cuenta</span>
            </div>
        `;
    } else if (estadoPago === 'Pendiente de pago') {
        estadoPagoHtml = `
            <div style="margin-top: 0.75rem; padding: 0.75rem; background: #fee2e2; border-radius: 8px; border: 2px solid #ef4444;">
                <span style="display: inline-block; padding: 0.375rem 0.75rem; background-color: #ef4444; color: white; border-radius: 20px; font-size: 0.875rem; font-weight: 600;">Pendiente de pago</span>
            </div>
        `;
    }
    
    // Obtener información de la cuenta de la tienda
    let cuentaInfoHtml = '';
    if (tienda && tienda.tieneCuenta) {
        const gastado = await calcularGastadoCuenta(tienda.id);
        if (tienda.limiteCuenta) {
            const disponible = Math.max(0, tienda.limiteCuenta - gastado);
            const porcentaje = (gastado / tienda.limiteCuenta) * 100;
            cuentaInfoHtml = `
                <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--bg-color); border-radius: 8px; border: 1px solid var(--border-color);">
                    <p style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">💳 Información de la Cuenta:</p>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                        <span style="font-size: 0.875rem;">Límite:</span>
                        <strong style="font-size: 0.875rem;">${tienda.limiteCuenta}€</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                        <span style="font-size: 0.875rem;">Gastado:</span>
                        <strong style="font-size: 0.875rem; color: ${porcentaje >= 100 ? '#ef4444' : porcentaje >= 80 ? '#f59e0b' : 'var(--text-primary)'};">
                            ${gastado.toFixed(2)}€
                        </strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 0.875rem;">Disponible:</span>
                        <strong style="font-size: 0.875rem; color: ${disponible < 0 ? '#ef4444' : 'var(--text-primary)'};">
                            ${disponible.toFixed(2)}€
                        </strong>
                    </div>
                    <div style="margin-top: 0.5rem; height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: ${Math.min(100, porcentaje)}%; background: ${porcentaje >= 100 ? '#ef4444' : porcentaje >= 80 ? '#f59e0b' : '#10b981'}; transition: width 0.3s;"></div>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; text-align: center;">
                        ${porcentaje.toFixed(1)}% utilizado
                    </p>
                </div>
            `;
        } else {
            cuentaInfoHtml = `
                <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--bg-color); border-radius: 8px; border: 1px solid var(--border-color);">
                    <p style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">💳 Información de la Cuenta:</p>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.875rem;">Gastado:</span>
                        <strong style="font-size: 0.875rem;">${gastado.toFixed(2)}€</strong>
                    </div>
                    <div style="padding: 0.5rem; background: #d1fae5; border-radius: 6px; text-align: center;">
                        <p style="font-size: 0.75rem; color: #065f46; font-weight: 600; margin: 0;">
                            ✓ Cuenta sin límite de gasto
                        </p>
                    </div>
                </div>
            `;
        }
    }
    
    card.innerHTML = `
        <div class="pedido-header">
            <div>
                <div class="pedido-id">Pedido #${pedido.id} - ${tienda.nombre}</div>
                <div class="pedido-info">${pedido.persona} | ${pedido.obraNombreComercial || pedido.obra}</div>
            </div>
            <span class="pedido-estado ${estadoClass}">${pedido.estado}</span>
        </div>
        ${estadoPagoHtml}
        ${cuentaInfoHtml}
        <div class="pedido-items">
            ${pedido.items.map((item, index) => {
                const foto = item.foto ? `<img src="${item.foto}" alt="${item.nombre}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; margin-right: 0.75rem;" onerror="this.style.display='none'">` : '';
                const designacion = item.designacion ? `<strong>${item.designacion}</strong>` : '';
                const precioUnitario = item.precio || 0;
                const cantidad = item.cantidad || 0;
                const precioTotalLinea = precioUnitario * cantidad;
                
                return `
                <div class="pedido-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-color); border-radius: 8px; margin-bottom: 0.5rem;">
                    ${foto}
                    <div style="flex: 1;">
                        ${designacion ? `<div style="font-weight: 600; margin-bottom: 0.25rem;">${designacion}</div>` : ''}
                        <div style="font-size: 0.875rem; color: var(--text-primary);">${item.nombre}</div>
                        ${item.descripcion ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${item.descripcion}</div>` : ''}
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; align-items: center;">
                            <span style="font-size: 0.875rem; color: var(--text-secondary);">Cantidad: <strong>x${cantidad}</strong></span>
                            <span style="font-size: 0.875rem; color: var(--text-secondary);">Precio unitario: <strong>${precioUnitario.toFixed(2)} €</strong></span>
                            ${cantidad > 1 ? `<span style="font-size: 0.875rem; color: var(--primary-color); font-weight: 600;">Total línea: ${precioTotalLinea.toFixed(2)} €</span>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-solicitar-anulacion-item" onclick="solicitarModificacionCantidad('${pedido.id}', ${index}, ${cantidad})" title="Solicitar modificación de cantidad">
                            ✏️
                        </button>
                        <button class="btn-solicitar-anulacion-item" onclick="solicitarAnulacionItem('${pedido.id}', ${index})" title="Solicitar anulación de este artículo">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
            }).join('')}
        </div>
        <div style="padding: 1rem; background: var(--primary-color-light); border-radius: 8px; margin-top: 1rem; text-align: right;">
            <strong style="font-size: 1.125rem; color: var(--primary-color);">Total del pedido: ${precioTotalPedido.toFixed(2)} €</strong>
        </div>
        <div class="pedido-actions" style="display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <button class="btn btn-secondary" onclick="solicitarAnulacionPedido('${pedido.id}')" style="flex: 1;">
                Solicitar Anulación del Pedido
            </button>
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

window.toggleObraPedidos = function(obraId) {
    const content = document.getElementById(`content-${obraId}`);
    const toggle = document.getElementById(`toggle-${obraId}`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▲';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▼';
    }
};

// Solicitudes de Modificación de Cantidad
window.solicitarModificacionCantidad = async function(pedidoId, itemIndex, cantidadActual) {
    const nuevaCantidadStr = await showPrompt(`Cantidad actual: ${cantidadActual}\n\nIngrese la nueva cantidad que desea solicitar:`, cantidadActual.toString(), 'Modificar Cantidad');
    
    if (nuevaCantidadStr === null) return; // Usuario canceló
    
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
        if (currentUserType === 'Técnico' || currentUserType === 'Encargado') {
            loadMisPedidos();
        }
    } catch (error) {
        console.error('Error al solicitar modificación:', error);
        await showAlert('Error al solicitar modificación: ' + error.message, 'Error');
    }
};

// Solicitudes de Anulación
window.solicitarAnulacionItem = async function(pedidoId, itemIndex) {
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
        if (currentUserType === 'Técnico' || currentUserType === 'Encargado') {
            loadMisPedidos();
        }
    } catch (error) {
        console.error('Error al solicitar anulación:', error);
        await showAlert('Error al solicitar anulación: ' + error.message, 'Error');
    }
};

window.solicitarAnulacionPedido = async function(pedidoId) {
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
        if (currentUserType === 'Técnico' || currentUserType === 'Encargado') {
            loadMisPedidos();
        }
    } catch (error) {
        console.error('Error al solicitar anulación:', error);
        await showAlert('Error al solicitar anulación: ' + error.message, 'Error');
    }
};

// Calcular gastado de cuenta con límite
async function calcularGastadoCuenta(tiendaId) {
    const pedidos = await db.getPedidosByTienda(tiendaId);
    let gastado = 0;
    
    for (const pedido of pedidos) {
        // Contar pedidos con estadoPago = 'Pago A cuenta' que tengan documento del sistema y no estén completados
        // NO contar los que tienen transferenciaPDF porque ya están pagados (se descuentan del gastado)
        if (pedido.estadoPago === 'Pago A cuenta' && pedido.estado !== 'Completado' && pedido.pedidoSistemaPDF && !pedido.transferenciaPDF) {
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

// Gestión de Tienda
async function showGestionTienda() {
    if (!currentTienda) {
        await showAlert('No hay tienda asociada', 'Error');
        return;
    }
    
    // Ocultar buscador si existe en la vista de tienda
    const searchBtn = document.getElementById('btn-search');
    const searchContainer = document.getElementById('search-container');
    if (searchBtn) searchBtn.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'none';
    
    console.log('Mostrando gestión de tienda. currentTienda:', currentTienda);
    console.log('ID de la tienda:', currentTienda.id);
    
    document.getElementById('gestion-tienda-nombre').textContent = `Gestión - ${currentTienda.nombre}`;
    
    // Mostrar etiqueta de cuenta
    const cuentaBadge = document.getElementById('gestion-tienda-cuenta-badge');
    if (cuentaBadge) {
        if (!currentTienda.tieneCuenta) {
            cuentaBadge.textContent = 'Sin Cuenta';
            cuentaBadge.style.backgroundColor = '#ef4444';
            cuentaBadge.style.color = 'white';
        } else if (!currentTienda.limiteCuenta) {
            cuentaBadge.textContent = 'Cuenta sin límite de gasto';
            cuentaBadge.style.backgroundColor = '#10b981';
            cuentaBadge.style.color = 'white';
        } else {
            // Calcular gastado
            const gastado = await calcularGastadoCuenta(currentTienda.id);
            cuentaBadge.textContent = `Cuenta ${currentTienda.limiteCuenta}€ / Gastado ${gastado.toFixed(2)}€`;
            cuentaBadge.style.backgroundColor = '#f59e0b';
            cuentaBadge.style.color = 'white';
        }
    }
    
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
    } else if (tab === 'cerrados') {
        document.getElementById('pedidos-cerrados').classList.add('active');
        loadPedidosCerrados();
    } else if (tab === 'solicitudes') {
        document.getElementById('solicitudes').classList.add('active');
        loadSolicitudesAnulacion();
    }
}

async function loadPedidosEnCurso() {
    if (!currentTienda) return;
    
    // Usar el ID correcto de la tienda
    const tiendaId = currentTienda.id;
    console.log('Buscando pedidos para tienda ID:', tiendaId);
    
    const pedidos = await db.getPedidosByTienda(tiendaId);
    console.log('Pedidos encontrados:', pedidos.length, pedidos);
    
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
    
    // Agregar zona de drop para crear nuevo pedido
    const dropZone = document.createElement('div');
    dropZone.className = 'new-pedido-dropzone';
    dropZone.id = 'new-pedido-dropzone';
    dropZone.innerHTML = `
        <div style="text-align: center; padding: 2rem; border: 2px dashed var(--border-color); border-radius: 12px; background: var(--bg-color); color: var(--text-secondary);">
            <p style="font-size: 1.25rem; margin-bottom: 0.5rem;">➕ Crear Nuevo Pedido</p>
            <p style="font-size: 0.875rem;">Arrastra un artículo aquí para crear un nuevo pedido</p>
        </div>
    `;
    dropZone.ondrop = async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!draggedItem || !draggedPedidoId || draggedItemIndex === null) {
            return;
        }
        
        try {
            // Obtener el pedido origen
            const pedidoOrigen = await db.get('pedidos', draggedPedidoId);
            if (!pedidoOrigen || !pedidoOrigen.items || draggedItemIndex >= pedidoOrigen.items.length) {
                await showAlert('Error: No se pudo encontrar el artículo a mover', 'Error');
                return;
            }
            
            const itemAMover = pedidoOrigen.items[draggedItemIndex];
            
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
                items: [itemAMover],
                estado: 'Nuevo',
                albaran: null
            };
            
            await db.add('pedidos', nuevoPedido);
            
            // Remover item del pedido origen
            pedidoOrigen.items.splice(draggedItemIndex, 1);
            
            // Si el pedido origen queda sin items, eliminarlo
            if (pedidoOrigen.items.length === 0) {
                await db.delete('pedidos', draggedPedidoId);
            } else {
                await db.update('pedidos', pedidoOrigen);
            }
            
            // Recargar pedidos
            loadPedidosEnCurso();
            
        } catch (error) {
            console.error('Error al crear nuevo pedido:', error);
            await showAlert('Error al crear nuevo pedido: ' + error.message, 'Error');
        } finally {
            draggedItem.style.opacity = '1';
            dropZone.style.backgroundColor = '';
            draggedItem = null;
            draggedPedidoId = null;
            draggedItemIndex = null;
        }
        
        return false;
    };
    dropZone.ondragover = function(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        dropZone.style.backgroundColor = 'var(--primary-color-light)';
        return false;
    };
    dropZone.ondragleave = function(event) {
        dropZone.style.backgroundColor = '';
    };
    container.appendChild(dropZone);
    
    pedidosEnCurso.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    for (const pedido of pedidosEnCurso) {
        const card = await createPedidoGestionCard(pedido);
        container.appendChild(card);
    }
}

async function loadPedidosCerrados() {
    if (!currentTienda) return;
    
    // Usar el ID correcto de la tienda
    const tiendaId = currentTienda.id;
    console.log('Buscando pedidos cerrados para tienda ID:', tiendaId);
    
    const pedidos = await db.getPedidosByTienda(tiendaId);
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
        const card = await createPedidoGestionCard(pedido, true);
        container.appendChild(card);
    }
}

async function loadSolicitudesAnulacion() {
    if (!currentTienda) return;
    
    const tiendaId = currentTienda.id;
    const solicitudesAnulacion = await db.getSolicitudesAnulacionByTienda(tiendaId);
    const solicitudesModificacion = await db.getSolicitudesModificacionByTienda(tiendaId);
    
    // Combinar ambas solicitudes
    const todasSolicitudes = [
        ...solicitudesAnulacion.map(s => ({ ...s, tipoSolicitud: 'anulacion' })),
        ...solicitudesModificacion.map(s => ({ ...s, tipoSolicitud: 'modificacion' }))
    ];
    
    const container = document.getElementById('solicitudes-list');
    const emptyState = document.getElementById('solicitudes-empty');
    
    if (todasSolicitudes.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    // Ordenar por fecha (más recientes primero)
    todasSolicitudes.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    for (const solicitud of todasSolicitudes) {
        const pedido = await db.get('pedidos', solicitud.pedidoId);
        if (!pedido) continue;
        
        const usuario = await db.get('usuarios', solicitud.userId);
        const card = solicitud.tipoSolicitud === 'modificacion' 
            ? createSolicitudModificacionCard(solicitud, pedido, usuario)
            : createSolicitudCard(solicitud, pedido, usuario);
        container.appendChild(card);
    }
}

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

function createSolicitudCard(solicitud, pedido, usuario) {
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
        fechaObj = new Date(); // Usar fecha actual como fallback
    }
    
    // Formatear como día/mes/año
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
                <h4>Solicitud de Anulación</h4>
                <p><strong>Usuario:</strong> ${usuarioNombre}${telefonoUsuario !== 'No disponible' ? ` | Tel: ${telefonoUsuario}` : ''}</p>
                <p><strong>Obra:</strong> ${obraNombre}</p>
                <p><strong>Pedido:</strong> #${pedido.id}</p>
                <p style="font-size: 0.75rem; color: var(--text-secondary);">${fecha}</p>
            </div>
            <span class="pedido-estado estado-pendiente">Pendiente</span>
        </div>
        <div class="pedido-items">
            ${solicitud.tipo === 'item' ? `
                <div class="pedido-item" style="padding: 0.75rem; background: var(--bg-color); border-radius: 8px;">
                    <p><strong>Solicitud:</strong> Anular artículo</p>
                    <div style="margin-top: 0.5rem;">
                        <strong>${solicitud.item.nombre}</strong>
                        ${solicitud.item.descripcion ? `<p style="font-size: 0.875rem; color: var(--text-secondary);">${solicitud.item.descripcion}</p>` : ''}
                        <p style="font-size: 0.875rem; color: var(--text-secondary);">Cantidad: x${solicitud.item.cantidad}</p>
                    </div>
                </div>
            ` : `
                <div class="pedido-item" style="padding: 0.75rem; background: var(--bg-color); border-radius: 8px;">
                    <p><strong>Solicitud:</strong> Anular pedido completo</p>
                </div>
            `}
        </div>
        <div class="pedido-actions" style="display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <button class="btn btn-danger" onclick="rechazarSolicitudAnulacion('${solicitud.id}')" style="flex: 1;">
                Rechazar
            </button>
            <button class="btn btn-primary" onclick="aceptarSolicitudAnulacion('${solicitud.id}')" style="flex: 1;">
                Aceptar
            </button>
        </div>
    `;
    
    return card;
}

window.aceptarSolicitudAnulacion = async function(solicitudId) {
    const confirmar = await showConfirm('¿Está seguro de aceptar esta solicitud de anulación?', 'Confirmar');
    if (!confirmar) return;
    
    try {
        const solicitud = await db.get('solicitudesAnulacion', solicitudId);
        if (!solicitud) {
            await showAlert('Error: No se pudo encontrar la solicitud', 'Error');
            return;
        }
        
        const pedido = await db.get('pedidos', solicitud.pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        if (solicitud.tipo === 'item') {
            // Eliminar el artículo del pedido
            pedido.items.splice(solicitud.itemIndex, 1);
            
            // Si el pedido queda sin items, eliminarlo
            if (pedido.items.length === 0) {
                await db.delete('pedidos', pedido.id);
            } else {
                await db.update('pedidos', pedido);
            }
        } else {
            // Eliminar el pedido completo
            await db.delete('pedidos', pedido.id);
        }
        
        // Marcar solicitud como aceptada
        solicitud.estado = 'Aceptada';
        await db.update('solicitudesAnulacion', solicitud);
        
        await showAlert('Solicitud aceptada', 'Éxito');
        loadSolicitudesAnulacion();
        loadPedidosEnCurso();
    } catch (error) {
        console.error('Error al aceptar solicitud:', error);
        await showAlert('Error al aceptar solicitud: ' + error.message, 'Error');
    }
};

window.rechazarSolicitudAnulacion = async function(solicitudId) {
    const confirmar = await showConfirm('¿Está seguro de rechazar esta solicitud de anulación?', 'Confirmar');
    if (!confirmar) return;
    
    try {
        const solicitud = await db.get('solicitudesAnulacion', solicitudId);
        if (!solicitud) {
            await showAlert('Error: No se pudo encontrar la solicitud', 'Error');
            return;
        }
        
        // Marcar solicitud como rechazada
        solicitud.estado = 'Rechazada';
        await db.update('solicitudesAnulacion', solicitud);
        
        await showAlert('Solicitud rechazada', 'Éxito');
        loadSolicitudesAnulacion();
    } catch (error) {
        console.error('Error al rechazar solicitud:', error);
        await showAlert('Error al rechazar solicitud: ' + error.message, 'Error');
    }
};

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
        loadSolicitudesAnulacion();
        loadPedidosEnCurso();
    } catch (error) {
        console.error('Error al aceptar solicitud:', error);
        await showAlert('Error al aceptar solicitud: ' + error.message, 'Error');
    }
};

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
        loadSolicitudesAnulacion();
    } catch (error) {
        console.error('Error al rechazar solicitud:', error);
        await showAlert('Error al rechazar solicitud: ' + error.message, 'Error');
    }
};

async function createPedidoGestionCard(pedido, isCerrado = false) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card';
    
    // Obtener información de la tienda para determinar tipo de cuenta
    const tienda = await db.get('tiendas', pedido.tiendaId);
    
    let fecha;
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
        fechaObj = new Date(); // Usar fecha actual como fallback
    }
    
    // Formatear como día/mes/año
    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const año = fechaObj.getFullYear();
    fecha = `${dia}/${mes}/${año}`;
    
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
    
    // Generar HTML para estado de pago
    let estadoPagoHtml = '';
    const estadoPago = pedido.estadoPago || 'Sin Asignar';
    
    if (!tienda || !tienda.tieneCuenta) {
        // Sin cuenta: siempre "Pendiente de pago" con etiqueta roja (sin desplegable)
        // Si está pagado, mostrar etiqueta verde "Pagado" con PDF de transferencia
        if (estadoPago === 'Pagado') {
            estadoPagoHtml = `
                <div style="margin-top: 0.5rem;">
                    <span style="display: inline-block; padding: 0.5rem 1rem; background-color: #10b981; color: white; border-radius: 20px; font-size: 0.875rem; font-weight: 600; margin-right: 0.5rem;">Pagado</span>
                    ${pedido.transferenciaPDF ? `
                        <a href="${pedido.transferenciaPDF}" target="_blank" download style="color: var(--primary-color); text-decoration: none; font-size: 0.875rem;">
                            📄 Ver PDF de Transferencia
                        </a>
                    ` : ''}
                </div>
            `;
        } else {
            estadoPagoHtml = `
                <div style="margin-top: 0.5rem;">
                    <span style="display: inline-block; padding: 0.5rem 1rem; background-color: #ef4444; color: white; border-radius: 20px; font-size: 0.875rem; font-weight: 600;">Pendiente de pago</span>
                </div>
            `;
        }
    } else {
        // Con cuenta (con o sin límite): desplegable con Sin Asignar, Pendiente de pago, Pago A cuenta
        // Si está pagado (tiene transferenciaPDF), mostrar etiqueta verde y PDF (sin desplegable)
        if (estadoPago === 'Pagado' || pedido.transferenciaPDF) {
            estadoPagoHtml = `
                <div style="margin-top: 0.5rem;">
                    <span style="display: inline-block; padding: 0.5rem 1rem; background-color: #10b981; color: white; border-radius: 20px; font-size: 0.875rem; font-weight: 600; margin-right: 0.5rem;">Pagado</span>
                    ${pedido.transferenciaPDF ? `
                        <a href="${pedido.transferenciaPDF}" target="_blank" download style="color: var(--primary-color); text-decoration: none; font-size: 0.875rem;">
                            📄 Ver PDF de Transferencia
                        </a>
                    ` : ''}
                </div>
            `;
        } else {
            estadoPagoHtml = `
                <div style="margin-top: 0.5rem;">
                    <label style="font-size: 0.875rem; font-weight: 600; display: block; margin-bottom: 0.25rem;">Estado de Pago:</label>
                    <select class="estado-pago-select" onchange="updateEstadoPago('${pedido.id}', this.value)" style="width: 100%; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color);">
                        <option value="Sin Asignar" ${estadoPago === 'Sin Asignar' ? 'selected' : ''}>Sin Asignar</option>
                        <option value="Pendiente de pago" ${estadoPago === 'Pendiente de pago' ? 'selected' : ''}>Pendiente de pago</option>
                        <option value="Pago A cuenta" ${estadoPago === 'Pago A cuenta' ? 'selected' : ''}>Pago A cuenta</option>
                    </select>
                </div>
            `;
        }
    }
    
    card.innerHTML = `
        <div class="pedido-gestion-header">
            <div class="pedido-gestion-info">
                <h4>Pedido #${pedido.id}</h4>
                <p><strong>Usuario:</strong> ${pedido.persona}</p>
                <p><strong>Obra:</strong> ${obraNombreHtml}</p>
                ${obraDireccion ? `<p style="font-size: 0.75rem; color: var(--text-secondary);"><a href="${obraDireccion}" target="_blank" style="color: var(--primary-color);">📍 Ver en Google Maps</a></p>` : ''}
                ${obraEncargado ? `<p style="font-size: 0.875rem;"><strong>Encargado:</strong> ${obraEncargado}${obraTelefono ? ` | Tel: ${obraTelefono}` : ''}</p>` : ''}
                <p style="font-size: 0.75rem; color: var(--text-secondary);">${fecha}</p>
                ${estadoPagoHtml}
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
        <div class="pedido-items" data-pedido-id="${pedido.id}" ${!isCerrado ? 'ondrop="handleDrop(event, \'' + pedido.id + '\')" ondragover="handleDragOver(event)"' : ''}>
            ${pedido.items.map((item, index) => {
                const foto = item.foto ? `<img src="${item.foto}" alt="${item.nombre}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; margin-right: 0.75rem;" onerror="this.style.display='none'">` : '';
                const designacion = item.designacion ? `<strong>${item.designacion}</strong>` : '';
                const referencia = item.referencia ? `<span style="color: var(--text-secondary); font-size: 0.875rem;">Ref: ${item.referencia}</span>` : '';
                const ean = item.ean ? `<span style="color: var(--text-secondary); font-size: 0.875rem;">EAN: ${item.ean}</span>` : '';
                const precioUnitario = item.precio || 0;
                const cantidad = item.cantidad || 0;
                const precioTotalLinea = precioUnitario * cantidad;
                
                return `
                <div class="pedido-item ${!isCerrado ? 'draggable-item' : ''}" 
                     draggable="${!isCerrado ? 'true' : 'false'}" 
                     data-pedido-id="${pedido.id}" 
                     data-item-index="${index}"
                     ondragstart="handleDragStart(event, '${pedido.id}', ${index})"
                     style="${!isCerrado ? 'cursor: move;' : ''} display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-color); border-radius: 8px; margin-bottom: 0.5rem;">
                    ${foto}
                    <div style="flex: 1;">
                        ${designacion ? `<div style="font-weight: 600; margin-bottom: 0.25rem;">${designacion}</div>` : ''}
                        <div style="font-size: 0.875rem; color: var(--text-primary);">${item.nombre}</div>
                        ${item.descripcion ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${item.descripcion}</div>` : ''}
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem; flex-wrap: wrap;">
                            ${referencia}
                            ${ean}
                        </div>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; align-items: center;">
                            <span style="font-size: 0.875rem; color: var(--text-secondary);">Cantidad: <strong>x${cantidad}</strong></span>
                            <span style="font-size: 0.875rem; color: var(--text-secondary);">Precio unitario: <strong>${precioUnitario.toFixed(2)} €</strong></span>
                            ${cantidad > 1 ? `<span style="font-size: 0.875rem; color: var(--primary-color); font-weight: 600;">Total línea: ${precioTotalLinea.toFixed(2)} €</span>` : ''}
                        </div>
                    </div>
                    ${!isCerrado ? `
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <button class="btn-icon-small" onclick="duplicarLineaPedido('${pedido.id}', ${index})" title="Duplicar línea">
                                📋
                            </button>
                            <button class="btn-icon-small" onclick="editarCantidadItem('${pedido.id}', ${index}, ${cantidad})" title="Editar cantidad">
                                ✏️
                            </button>
                            <button class="btn-icon-small" onclick="eliminarItemPedido('${pedido.id}', ${index})" title="Eliminar artículo">
                                🗑️
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
            }).join('')}
        </div>
        ${(() => {
            const precioTotalPedido = pedido.items.reduce((total, item) => {
                const precioItem = item.precio || 0;
                const cantidad = item.cantidad || 0;
                return total + (precioItem * cantidad);
            }, 0);
            return `
            <div style="padding: 1rem; background: var(--primary-color-light); border-radius: 8px; margin-top: 1rem; text-align: right;">
                <strong style="font-size: 1.125rem; color: var(--primary-color);">Total del pedido: ${precioTotalPedido.toFixed(2)} €</strong>
            </div>
            `;
        })()}
        ${!isCerrado ? `
            ${!tienda || !tienda.tieneCuenta ? `
                ${!pedido.pedidoSistemaPDF ? `
                    <div class="file-upload" style="margin-top: 1rem; padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                        <label for="pedido-sistema-${pedido.id}" class="file-upload-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            📎 Adjuntar Captura/PDF del Pedido del Sistema (con el pago real)
                        </label>
                        <input type="file" id="pedido-sistema-${pedido.id}" accept=".pdf,.jpg,.jpeg,.png" onchange="uploadPedidoSistema('${pedido.id}', this.files[0])" style="width: 100%;">
                    </div>
                ` : `
                    <div style="margin-top: 1rem; padding: 1rem; background: var(--success-color-light); border-radius: 8px;">
                        <p style="font-size: 0.875rem; margin-bottom: 0.5rem; font-weight: 600;">Documento del pedido del sistema adjuntado:</p>
                        <a href="${pedido.pedidoSistemaPDF}" target="_blank" download style="color: var(--primary-color); text-decoration: none; font-size: 0.875rem;">
                            📄 Ver/Descargar Documento
                        </a>
                    </div>
                `}
                ${pedido.estadoPago === 'Pagado' ? `
                    <div class="file-upload" style="margin-top: 1rem; padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                        <label for="albaran-${pedido.id}" class="file-upload-label" style="display: block; margin-bottom: 0.5rem;">
                            📎 Adjuntar Albarán/Factura
                        </label>
                        <input type="file" id="albaran-${pedido.id}" accept=".pdf,.jpg,.jpeg,.png" onchange="uploadAlbaran('${pedido.id}', this.files[0])" style="width: 100%;">
                    </div>
                ` : ''}
            ` : `
                ${pedido.estadoPago === 'Pendiente de pago' ? `
                    ${!pedido.pedidoSistemaPDF ? `
                        <div class="file-upload" style="margin-top: 1rem; padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                            <label for="pedido-sistema-${pedido.id}" class="file-upload-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                                📎 Adjuntar Captura/PDF del Pedido del Sistema (con el pago real)
                            </label>
                            <input type="file" id="pedido-sistema-${pedido.id}" accept=".pdf,.jpg,.jpeg,.png" onchange="uploadPedidoSistema('${pedido.id}', this.files[0])" style="width: 100%;">
                        </div>
                    ` : `
                        <div style="margin-top: 1rem; padding: 1rem; background: var(--success-color-light); border-radius: 8px;">
                            <p style="font-size: 0.875rem; margin-bottom: 0.5rem; font-weight: 600;">Documento del pedido del sistema adjuntado:</p>
                            <a href="${pedido.pedidoSistemaPDF}" target="_blank" download style="color: var(--primary-color); text-decoration: none; font-size: 0.875rem;">
                                📄 Ver/Descargar Documento
                            </a>
                        </div>
                    `}
                ` : ''}
                ${pedido.estadoPago === 'Pago A cuenta' ? `
                    ${!pedido.pedidoSistemaPDF ? `
                        <div class="file-upload" style="margin-top: 1rem; padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                            <label for="pedido-sistema-${pedido.id}" class="file-upload-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                                📎 Adjuntar Captura/PDF del Pedido del Sistema (con la cantidad real a pagar)
                            </label>
                            <input type="file" id="pedido-sistema-${pedido.id}" accept=".pdf,.jpg,.jpeg,.png" onchange="uploadPedidoSistema('${pedido.id}', this.files[0])" style="width: 100%;">
                        </div>
                    ` : `
                        <div style="margin-top: 1rem; padding: 1rem; background: var(--success-color-light); border-radius: 8px;">
                            <p style="font-size: 0.875rem; margin-bottom: 0.5rem; font-weight: 600;">Documento del pedido del sistema adjuntado:</p>
                            <a href="${pedido.pedidoSistemaPDF}" target="_blank" download style="color: var(--primary-color); text-decoration: none; font-size: 0.875rem;">
                                📄 Ver/Descargar Documento
                            </a>
                        </div>
                    `}
                ` : ''}
                <div class="file-upload" style="margin-top: 1rem; padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                    <label for="albaran-${pedido.id}" class="file-upload-label" style="display: block; margin-bottom: 0.5rem;">
                        📎 Adjuntar Albarán/Factura
                    </label>
                    <input type="file" id="albaran-${pedido.id}" accept=".pdf,.jpg,.jpeg,.png" onchange="uploadAlbaran('${pedido.id}', this.files[0])" style="width: 100%;">
                </div>
            `}
        ` : ''}
        ${pedido.albaran ? `
            <div class="pedido-albaran" style="margin-top: 1rem;">
                <a href="${pedido.albaran}" target="_blank" download style="color: var(--primary-color); text-decoration: none; font-size: 0.875rem;">
                    📄 Ver Albarán/Factura
                </a>
            </div>
        ` : ''}
    `;
    
    return card;
}

// Variables globales para drag and drop
let draggedItem = null;
let draggedPedidoId = null;
let draggedItemIndex = null;

// Funciones de drag and drop
window.handleDragStart = function(event, pedidoId, itemIndex) {
    draggedItem = event.target;
    draggedPedidoId = pedidoId;
    draggedItemIndex = itemIndex;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.target.outerHTML);
    event.target.style.opacity = '0.5';
};

window.handleDragOver = function(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.style.backgroundColor = 'var(--primary-color-light)';
    return false;
};

window.handleDragLeave = function(event) {
    event.currentTarget.style.backgroundColor = '';
};

window.handleDrop = async function(event, targetPedidoId) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!draggedItem || !draggedPedidoId || draggedItemIndex === null) {
        return;
    }
    
    // Si se arrastra al mismo pedido, no hacer nada
    if (draggedPedidoId === targetPedidoId) {
        draggedItem.style.opacity = '1';
        event.currentTarget.style.backgroundColor = '';
        draggedItem = null;
        draggedPedidoId = null;
        draggedItemIndex = null;
        return;
    }
    
    try {
        // Obtener el pedido origen
        const pedidoOrigen = await db.get('pedidos', draggedPedidoId);
        if (!pedidoOrigen || !pedidoOrigen.items || draggedItemIndex >= pedidoOrigen.items.length) {
            await showAlert('Error: No se pudo encontrar el artículo a mover', 'Error');
            return;
        }
        
        const itemAMover = pedidoOrigen.items[draggedItemIndex];
        
        // Obtener el pedido destino
        const pedidoDestino = await db.get('pedidos', targetPedidoId);
        if (!pedidoDestino) {
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
                items: [itemAMover],
                estado: 'Nuevo',
                albaran: null
            };
            
            await db.add('pedidos', nuevoPedido);
        } else {
            // Agregar item al pedido destino
            if (!pedidoDestino.items) {
                pedidoDestino.items = [];
            }
            pedidoDestino.items.push(itemAMover);
            await db.update('pedidos', pedidoDestino);
        }
        
        // Remover item del pedido origen
        pedidoOrigen.items.splice(draggedItemIndex, 1);
        
        // Si el pedido origen queda sin items, eliminarlo
        if (pedidoOrigen.items.length === 0) {
            await db.delete('pedidos', draggedPedidoId);
        } else {
            await db.update('pedidos', pedidoOrigen);
        }
        
        // Recargar pedidos
        loadPedidosEnCurso();
        
    } catch (error) {
        console.error('Error al mover artículo:', error);
        await showAlert('Error al mover el artículo: ' + error.message, 'Error');
    } finally {
        draggedItem.style.opacity = '1';
        event.currentTarget.style.backgroundColor = '';
        draggedItem = null;
        draggedPedidoId = null;
        draggedItemIndex = null;
    }
    
    return false;
};

window.duplicarLineaPedido = async function(pedidoId, itemIndex) {
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
        
        // Recargar pedidos
        loadPedidosEnCurso();
        await showAlert('Línea duplicada. Puede ajustar la cantidad y arrastrarla a otro pedido si es necesario.', 'Éxito');
    } catch (error) {
        console.error('Error al duplicar línea:', error);
        await showAlert('Error al duplicar la línea: ' + error.message, 'Error');
    }
};

window.eliminarItemPedido = async function(pedidoId, itemIndex) {
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
        
        // Recargar pedidos
        loadPedidosEnCurso();
        await showAlert('Artículo eliminado del pedido', 'Éxito');
    } catch (error) {
        console.error('Error al eliminar artículo:', error);
        await showAlert('Error al eliminar el artículo: ' + error.message, 'Error');
    }
};

window.editarCantidadItem = async function(pedidoId, itemIndex, cantidadActual) {
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
        const cantidadFaltante = cantidadActual - nuevaCantidad;
        
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
                
                loadPedidosEnCurso();
                await showAlert('Artículo eliminado del pedido', 'Éxito');
            }
            return;
        }
        
        // Actualizar cantidad
        item.cantidad = nuevaCantidad;
        
        // Si se redujo la cantidad, preguntar si crear nuevo pedido con la cantidad faltante
        if (cantidadFaltante > 0) {
            const crearNuevoPedido = await showConfirm(
                `Se reducirá la cantidad de ${cantidadActual} a ${nuevaCantidad}.\n\n` +
                `¿Desea crear un nuevo pedido con la cantidad faltante (${cantidadFaltante} unidades) que llegará más tarde?`,
                'Crear Nuevo Pedido'
            );
            
            if (crearNuevoPedido) {
                // Crear nuevo pedido con la cantidad faltante
                const itemFaltante = {
                    ...item,
                    cantidad: cantidadFaltante
                };
                
                const nuevoPedido = {
                    tiendaId: pedido.tiendaId,
                    userId: pedido.userId,
                    persona: pedido.persona,
                    obraId: pedido.obraId,
                    obraNombreComercial: pedido.obraNombreComercial,
                    obraDireccionGoogleMaps: pedido.obraDireccionGoogleMaps || '',
                    obraEncargado: pedido.obraEncargado || '',
                    obraTelefono: pedido.obraTelefono || '',
                    items: [itemFaltante],
                    estado: 'Nuevo',
                    albaran: null
                };
                
                await db.add('pedidos', nuevoPedido);
            }
        }
        
        // Actualizar pedido original
        if (pedido.items.length === 0) {
            await db.delete('pedidos', pedidoId);
        } else {
            await db.update('pedidos', pedido);
        }
        
        // Recargar pedidos
        loadPedidosEnCurso();
        await showAlert('Cantidad actualizada correctamente', 'Éxito');
    } catch (error) {
        console.error('Error al editar cantidad:', error);
        await showAlert('Error al editar la cantidad: ' + error.message, 'Error');
    }
};

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

window.updateEstadoPago = async function(pedidoId, nuevoEstadoPago) {
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) return;
        
        pedido.estadoPago = nuevoEstadoPago;
        await db.update('pedidos', pedido);
        
        // Si la tienda tiene límite, actualizar badge siempre (tanto si cambia a "Pago A cuenta" como si cambia a otro estado)
        if (currentTienda && currentTienda.limiteCuenta) {
            const gastado = await calcularGastadoCuenta(currentTienda.id);
            const cuentaBadge = document.getElementById('gestion-tienda-cuenta-badge');
            if (cuentaBadge) {
                cuentaBadge.textContent = `Cuenta ${currentTienda.limiteCuenta}€ / Gastado ${gastado.toFixed(2)}€`;
            }
        }
        
        loadPedidosEnCurso();
    } catch (error) {
        console.error('Error al actualizar estado de pago:', error);
        await showAlert('Error al actualizar estado de pago: ' + error.message, 'Error');
    }
}

// ========== VISTA DE CONTABILIDAD ==========

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

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function reloadActiveContabilidadTab() {
    const active = document.querySelector('#view-contabilidad .tab-btn.active');
    if (!active) return;
    const tab = active.dataset.tab;
    if (tab === 'pedidos-contabilidad') {
        loadPedidosContabilidad();
    } else if (tab === 'pedidos-pagados-contabilidad') {
        loadPedidosPagadosContabilidad();
    } else if (tab === 'cuentas-contabilidad') {
        loadCuentasContabilidad();
    } else if (tab === 'pedidos-especiales-contabilidad') {
        loadPedidosEspecialesContabilidad();
    } else if (tab === 'facturas-pendientes-contabilidad') {
        loadFacturasPendientesContabilidad();
    }
}

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
        
        // Determinar el estado original basado en la tienda
        const tienda = await db.get('tiendas', pedido.tiendaId);
        const tieneCuenta = tienda && tienda.tieneCuenta;
        
        // Eliminar el documento de pago y restaurar el estado
        pedido.transferenciaPDF = null;
        // Si el estado actual es "Pagado", restaurar según el tipo de tienda
        if (pedido.estadoPago === 'Pagado') {
            pedido.estadoPago = tieneCuenta ? 'Pago A cuenta' : 'Pendiente de pago';
        }
        
        await db.update('pedidos', pedido);
        await showAlert('Documento eliminado correctamente', 'Éxito');
        
        // Recargar todas las pestañas relevantes
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

function updateContabilidadTabBadge(tabKey, count) {
    const badgeId = contabilidadTabBadgeMap[tabKey];
    if (!badgeId) return;
    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.textContent = count;
    }
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

function isPedidoEspecial(pedido) {
    return Boolean(
        pedido?.esPedidoEspecial ||
        pedido?.pedidoEspecial ||
        pedido?.tipo === 'Especial' ||
        pedido?.tipoPedido === 'Especial'
    );
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
    
    if (tab === 'pedidos-contabilidad') {
        document.getElementById('pedidos-contabilidad').classList.add('active');
        loadPedidosContabilidad();
    } else if (tab === 'pedidos-pagados-contabilidad') {
        document.getElementById('pedidos-pagados-contabilidad').classList.add('active');
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

async function loadPedidosContabilidad() {
    const todosPedidos = await db.getAll('pedidos');
    
    const pedidosPendientes = todosPedidos.filter(pedido => {
        if (pedido.estado === 'Completado') return false;
        if (pedido.estadoPago !== 'Pendiente de pago') return false;
        if (!pedido.pedidoSistemaPDF) return false; // Debe tener pedido real adjunto
        if (pedido.transferenciaPDF) return false; // No debe estar pagado aún
        return true;
    });
    
    pedidosPendientes.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    const obras = await getObrasCatalog(pedidosPendientes);
    const container = document.getElementById('pedidos-contabilidad-list');
    const emptyState = document.getElementById('pedidos-contabilidad-empty');
        container.innerHTML = '';
    
    if (obras.length === 0) {
        emptyState.style.display = 'block';
        updateContabilidadTabBadge('pendientes', 0);
        return;
    }
    
    emptyState.style.display = 'none';
    
    let totalCount = 0;
    for (const obra of obras) {
        const obraId = obra.id || 'sin-obra';
        const pedidosObra = pedidosPendientes.filter(p => (p.obraId || 'sin-obra') === obraId);
        totalCount += pedidosObra.length;
        
        const { section, content } = createCascadeSection({
            prefix: 'pendientes-obra',
            uniqueId: obraId,
            title: obra.nombreComercial || obra.nombre || 'Obra sin nombre',
            count: pedidosObra.length,
            emptyMessage: 'Sin pedidos pendientes para esta obra',
            defaultOpen: pedidosObra.length > 0
        });
        
        for (const pedido of pedidosObra) {
        const card = await createPedidoContabilidadCard(pedido);
            content.appendChild(card);
    }
        
        container.appendChild(section);
    }
    
    updateContabilidadTabBadge('pendientes', totalCount);
}

async function loadPedidosPagadosContabilidad() {
    const todosPedidos = await db.getAll('pedidos');
    const pedidosPagados = todosPedidos.filter(p => 
        p.transferenciaPDF && p.albaran // Debe tener documento de pago Y factura
    );
    const container = document.getElementById('pedidos-pagados-contabilidad-list');
    const emptyState = document.getElementById('pedidos-pagados-contabilidad-empty');
        container.innerHTML = '';
    
    const obras = await getObrasCatalog(pedidosPagados);
    if (obras.length === 0) {
        emptyState.style.display = 'block';
        updateContabilidadTabBadge('historico', 0);
        return;
    }
    
    emptyState.style.display = 'none';
    let totalCount = 0;
    
    for (const obra of obras) {
        const obraId = obra.id || 'sin-obra';
        const pedidosObra = pedidosPagados
            .filter(p => (p.obraId || 'sin-obra') === obraId)
            .sort((a, b) => {
            const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
            const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
            return fechaB - fechaA;
        });
        totalCount += pedidosObra.length;
        
        const { section, content } = createCascadeSection({
            prefix: 'historico-obra',
            uniqueId: obraId,
            title: obra.nombreComercial || obra.nombre || 'Obra sin nombre',
            count: pedidosObra.length,
            emptyMessage: 'Sin registros históricos para esta obra',
            defaultOpen: false
        });
        
        for (const pedido of pedidosObra) {
            const card = await createPedidoContabilidadCard(pedido, true);
            content.appendChild(card);
        }
        
        container.appendChild(section);
    }
    
    updateContabilidadTabBadge('historico', totalCount);
}

async function loadCuentasContabilidad() {
    const tiendas = await db.getAll('tiendas');
    // Incluir tiendas con cuenta (con o sin límite)
    const tiendasConCuenta = tiendas.filter(t => t.tieneCuenta);
    
    const container = document.getElementById('cuentas-contabilidad-list');
    const emptyState = document.getElementById('cuentas-contabilidad-empty');
    
        container.innerHTML = '';
    
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
    
    pedidosCuentaGlobal.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    const obras = await getObrasCatalog(pedidosCuentaGlobal);
    let totalPedidos = 0;
    
    for (const tienda of tiendasConCuenta) {
        const pedidosTienda = pedidosCuentaGlobal.filter(p => p.tiendaId === tienda.id);
        totalPedidos += pedidosTienda.length;
        const gastado = await calcularGastadoCuenta(tienda.id);
        
        const { section, content } = createCascadeSection({
            prefix: 'cuentas-tienda',
            uniqueId: tienda.id,
            title: tienda.nombre,
            count: pedidosTienda.length,
            emptyMessage: 'No hay pedidos asociados a esta tienda.',
            defaultOpen: false
        });
        
        const infoBlock = createCuentaInfoBlock(tienda, gastado);
        content.appendChild(infoBlock);
        
        const obrasWrapper = document.createElement('div');
        obrasWrapper.className = 'cascade-inner';
        
        for (const obra of obras) {
            const obraId = obra.id || 'sin-obra';
            const pedidosObra = pedidosTienda.filter(p => (p.obraId || 'sin-obra') === obraId);
            
            const obraSection = createCascadeSection({
                prefix: `cuentas-obra-${sanitizeCascadeId(tienda.id)}`,
                uniqueId: `${tienda.id}-${obraId}`,
                title: obra.nombreComercial || obra.nombre || 'Obra sin nombre',
                count: pedidosObra.length,
                emptyMessage: 'Sin pedidos para esta obra',
                defaultOpen: false
            });
            obraSection.section.classList.add('nested-cascade');
            
            for (const pedido of pedidosObra) {
                const card = await createPedidoContabilidadCard(pedido, false);
                obraSection.content.appendChild(card);
            }
            
            obrasWrapper.appendChild(obraSection.section);
        }
        
        content.appendChild(obrasWrapper);
        container.appendChild(section);
    }
    
    updateContabilidadTabBadge('cuentas', totalPedidos);
}

async function loadPedidosEspecialesContabilidad() {
    const todosPedidos = await db.getAll('pedidos');
    const pedidosEspeciales = todosPedidos.filter(isPedidoEspecial);
    
    pedidosEspeciales.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    const obras = await getObrasCatalog(pedidosEspeciales);
    const container = document.getElementById('pedidos-especiales-contabilidad-list');
    const emptyState = document.getElementById('pedidos-especiales-contabilidad-empty');
    
    container.innerHTML = '';
    
    if (obras.length === 0) {
        emptyState.style.display = 'block';
        updateContabilidadTabBadge('especiales', 0);
        return;
    }
    
    emptyState.style.display = 'none';
    let totalCount = 0;
    
    for (const obra of obras) {
        const obraId = obra.id || 'sin-obra';
        const pedidosObra = pedidosEspeciales.filter(p => (p.obraId || 'sin-obra') === obraId);
        totalCount += pedidosObra.length;
        
        const { section, content } = createCascadeSection({
            prefix: 'especiales-obra',
            uniqueId: obraId,
            title: obra.nombreComercial || obra.nombre || 'Obra sin nombre',
            count: pedidosObra.length,
            emptyMessage: 'Sin pedidos especiales para esta obra',
            defaultOpen: false
        });
        
        for (const pedido of pedidosObra) {
            const card = await createPedidoContabilidadCard(pedido);
            content.appendChild(card);
        }
        
        container.appendChild(section);
    }
    
    updateContabilidadTabBadge('especiales', totalCount);
}

async function loadFacturasPendientesContabilidad() {
    const todosPedidos = await db.getAll('pedidos');
    const facturasPendientes = todosPedidos.filter(pedido => {
        const pagado = pedido.estadoPago === 'Pagado' || Boolean(pedido.transferenciaPDF);
        const sinFactura = !pedido.albaran;
        return pagado && sinFactura;
    });
    
    facturasPendientes.sort((a, b) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fechaB - fechaA;
    });
    
    const obras = await getObrasCatalog(facturasPendientes);
    const container = document.getElementById('facturas-pendientes-contabilidad-list');
    const emptyState = document.getElementById('facturas-pendientes-contabilidad-empty');
    
    container.innerHTML = '';
    
    if (obras.length === 0) {
        emptyState.style.display = 'block';
        updateContabilidadTabBadge('facturas', 0);
        return;
    }
    
    emptyState.style.display = 'none';
    let totalCount = 0;
    
    for (const obra of obras) {
        const obraId = obra.id || 'sin-obra';
        const pedidosObra = facturasPendientes.filter(p => (p.obraId || 'sin-obra') === obraId);
        totalCount += pedidosObra.length;
        
        const { section, content } = createCascadeSection({
            prefix: 'facturas-obra',
            uniqueId: obraId,
            title: obra.nombreComercial || obra.nombre || 'Obra sin nombre',
            count: pedidosObra.length,
            emptyMessage: 'Sin facturas pendientes para esta obra',
            defaultOpen: false
        });
        
        for (const pedido of pedidosObra) {
            const card = await createPedidoContabilidadCard(pedido, true);
            content.appendChild(card);
        }
        
        container.appendChild(section);
    }
    
    updateContabilidadTabBadge('facturas', totalCount);
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
    
    const pedidoRealLink = pedido.pedidoSistemaPDF ? escapeHtml(pedido.pedidoSistemaPDF) : null;
    const pedidoRealContent = pedidoRealLink
        ? `<a href="${pedidoRealLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver documento</a>`
        : '<span class="doc-placeholder">Sin documento adjunto</span>';
    
    const facturaLink = pedido.albaran ? escapeHtml(pedido.albaran) : null;
    const facturaContent = facturaLink
        ? `<a href="${facturaLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver factura</a>`
        : '<span class="doc-placeholder">Sin factura adjunta</span>';
    
    const tienePago = Boolean(pedido.transferenciaPDF);
    const puedeGestionarPago = currentUserType === 'Contabilidad';
    const pagoInputId = `pago-upload-${pedido.id}`;
    
    const documentoPagoContent = `
        ${tienePago ? `<a href="${escapeHtml(pedido.transferenciaPDF)}" target="_blank" rel="noopener" class="doc-link">📄 Ver pago</a>` : '<span class="doc-placeholder">Sin documento adjunto</span>'}
        ${puedeGestionarPago ? (
            tienePago
                ? `<button class="emoji-btn danger" type="button" aria-label="Eliminar documento de pago" onclick="removePedidoPaymentDocument('${pedido.id}')">✖️</button>`
                : `<button class="emoji-btn" type="button" aria-label="Adjuntar documento de pago" onclick="document.getElementById('${pagoInputId}').click()">➕</button>`
        ) : ''}
    `;
    
    const itemsSectionId = `pedido-items-${pedido.id}`;
    const notasSectionId = `pedido-notas-${pedido.id}`;
    const notasListId = `pedido-notas-list-${pedido.id}`;
    const notasCountId = `pedido-notas-count-${pedido.id}`;
    const notaInputId = `pedido-nota-input-${pedido.id}`;
    
    card.innerHTML = `
        <div class="contab-pedido-header">
            <div>
                <p class="pedido-code">Pedido #${escapeHtml(pedido.id)}</p>
                <div class="contab-estado-envio">
                    <span>Estado de envío:</span>
                    <span class="estado-envio-pill estado-${estadoEnvioClass}">${escapeHtml(estadoEnvio)}</span>
                </div>
            </div>
        </div>
        <div class="contab-info-grid">
            <div class="contab-info-card">
                <div class="contab-card-title">Datos del pedido</div>
                <div class="contab-info-row"><span>Tienda</span><strong>${tiendaNombre}</strong></div>
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
                    <span>Pedido real</span>
                    <div class="doc-actions">${pedidoRealContent}</div>
                </div>
                <div class="contab-info-row">
                    <span>Documento de pago</span>
                    <div class="doc-actions">${documentoPagoContent}</div>
            </div>
                <div class="contab-info-row">
                    <span>Factura</span>
                    <div class="doc-actions">${facturaContent}</div>
                </div>
                ${puedeGestionarPago ? `<input type="file" id="${pagoInputId}" style="display: none;" accept=".pdf,.jpg,.jpeg,.png" onchange="handlePedidoPagoUpload('${pedido.id}', '${pagoInputId}')">` : ''}
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
    
    // Generar HTML para items con botones de anulación y cambio de cantidad
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
    
    // Documentos (solo visualización/descarga, sin botones de edición)
    const pedidoRealLink = pedido.pedidoSistemaPDF ? escapeHtml(pedido.pedidoSistemaPDF) : null;
    const pedidoRealContent = pedidoRealLink
        ? `<a href="${pedidoRealLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver documento</a>`
        : '<span class="doc-placeholder">Sin documento adjunto</span>';
    
    const facturaLink = pedido.albaran ? escapeHtml(pedido.albaran) : null;
    const facturaContent = facturaLink
        ? `<a href="${facturaLink}" target="_blank" rel="noopener" class="doc-link">📄 Ver factura</a>`
        : '<span class="doc-placeholder">Sin factura adjunta</span>';
    
    const tienePago = Boolean(pedido.transferenciaPDF);
    const documentoPagoContent = tienePago
        ? `<a href="${escapeHtml(pedido.transferenciaPDF)}" target="_blank" rel="noopener" class="doc-link">📄 Ver pago</a>`
        : '<span class="doc-placeholder">Sin documento adjunto</span>';
    
    const itemsSectionId = `pedido-items-tec-${pedido.id}`;
    const notasSectionId = `pedido-notas-tec-${pedido.id}`;
    const notasListId = `pedido-notas-list-tec-${pedido.id}`;
    const notasCountId = `pedido-notas-count-tec-${pedido.id}`;
    const notaInputId = `pedido-nota-input-tec-${pedido.id}`;
    
    card.innerHTML = `
        <div class="contab-pedido-header">
            <div>
                <p class="pedido-code">Pedido #${escapeHtml(pedido.id)}</p>
                <div class="contab-estado-envio">
                    <span>Estado de envío:</span>
                    <span class="estado-envio-pill estado-${estadoEnvioClass}">${escapeHtml(estadoEnvio)}</span>
                </div>
            </div>
        </div>
        <div class="contab-info-grid">
            <div class="contab-info-card">
                <div class="contab-card-title">Datos del pedido</div>
                <div class="contab-info-row"><span>Tienda</span><strong>${tiendaNombre}</strong></div>
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
                    <span>Pedido real</span>
                    <div class="doc-actions">${pedidoRealContent}</div>
                </div>
                <div class="contab-info-row">
                    <span>Documento de pago</span>
                    <div class="doc-actions">${documentoPagoContent}</div>
                </div>
                <div class="contab-info-row">
                    <span>Factura</span>
                    <div class="doc-actions">${facturaContent}</div>
                </div>
            </div>
        </div>
        <div>
            <button class="contab-toggle" type="button" data-open-label="Ocultar artículos" data-close-label="Ver artículos del pedido" onclick="togglePedidoSection('${itemsSectionId}', this)">
                <span class="toggle-text">Ver artículos del pedido</span>
                <span class="chevron">▼</span>
            </button>
            <div id="${itemsSectionId}" class="contab-collapse" style="display: none;">
                <div class="pedido-items-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <p class="contab-total">Total pedido: ${formatCurrency(totalPedido)}</p>
                    <button class="btn btn-secondary" type="button" onclick="solicitarAnulacionPedido('${pedido.id}')" style="font-size: 0.875rem; padding: 0.5rem 1rem;">
                        Solicitar Anulación del Pedido
                    </button>
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


const PAGO_ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

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
        
        // Convertir archivo a base64
        const transferenciaPDF = await fileToBase64(file);
        
        pedido.transferenciaPDF = transferenciaPDF;
        pedido.estadoPago = 'Pagado'; // Cambiar el estado a "Pagado"
        await db.update('pedidos', pedido);
        
        // Actualizar el badge de la tienda si tiene límite
        const tienda = await db.get('tiendas', tiendaId);
        if (tienda && tienda.limiteCuenta) {
            const gastado = await calcularGastadoCuenta(tiendaId);
            // Si estamos en la vista de la tienda, actualizar el badge
            if (currentTienda && currentTienda.id === tiendaId) {
                const cuentaBadge = document.getElementById('gestion-tienda-cuenta-badge');
                if (cuentaBadge) {
                    cuentaBadge.textContent = `Cuenta ${tienda.limiteCuenta}€ / Gastado ${gastado.toFixed(2)}€`;
                }
            }
        }
        
        await showAlert('PDF del pago adjuntado correctamente. El pedido se ha marcado como pagado y se ha descontado del gastado de la cuenta.', 'Éxito');
        
        // Recargar las pestañas relevantes
        reloadActiveContabilidadTab();
        // El pedido ahora debe aparecer en "Facturas Pendientes"
        loadFacturasPendientesContabilidad();
    } catch (error) {
        console.error('Error al subir pago de cuenta:', error);
        await showAlert('Error al subir el PDF: ' + error.message, 'Error');
    }
}

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
        
        // Convertir archivo a base64
        const transferenciaPDF = await fileToBase64(file);
        
        // Guardar el estado anterior antes de cambiarlo
        const estadoAnterior = pedido.estadoPago;
        
        pedido.transferenciaPDF = transferenciaPDF;
        pedido.estadoPago = 'Pagado';
        await db.update('pedidos', pedido);
        
        // Si el pedido era "Pago A cuenta", actualizar el badge de la tienda
        const tienda = await db.get('tiendas', pedido.tiendaId);
        if (tienda && tienda.limiteCuenta && estadoAnterior === 'Pago A cuenta') {
            const gastado = await calcularGastadoCuenta(tienda.id);
            // Si estamos en la vista de la tienda, actualizar el badge
            if (currentTienda && currentTienda.id === tienda.id) {
                const cuentaBadge = document.getElementById('gestion-tienda-cuenta-badge');
                if (cuentaBadge) {
                    cuentaBadge.textContent = `Cuenta ${tienda.limiteCuenta}€ / Gastado ${gastado.toFixed(2)}€`;
                }
            }
        }
        
        await showAlert('PDF de transferencia adjuntado y pedido marcado como pagado', 'Éxito');
        
        // Recargar las pestañas relevantes
        reloadActiveContabilidadTab();
        // El pedido ahora debe aparecer en "Facturas Pendientes"
        loadFacturasPendientesContabilidad();
    } catch (error) {
        console.error('Error al subir transferencia:', error);
        await showAlert('Error al subir el PDF: ' + error.message, 'Error');
    }
};

window.uploadPedidoSistema = async function(pedidoId, file) {
    if (!file) return;
    
    try {
        const pedido = await db.get('pedidos', pedidoId);
        if (!pedido) {
            await showAlert('Error: No se pudo encontrar el pedido', 'Error');
            return;
        }
        
        // Convertir archivo a base64
        const pedidoSistemaPDF = await fileToBase64(file);
        
        pedido.pedidoSistemaPDF = pedidoSistemaPDF;
        await db.update('pedidos', pedido);
        
        // Si la tienda tiene límite y el pedido está marcado como "Pago A cuenta", actualizar badge
        if (currentTienda && currentTienda.limiteCuenta && pedido.estadoPago === 'Pago A cuenta') {
            const gastado = await calcularGastadoCuenta(currentTienda.id);
            const cuentaBadge = document.getElementById('gestion-tienda-cuenta-badge');
            if (cuentaBadge) {
                cuentaBadge.textContent = `Cuenta ${currentTienda.limiteCuenta}€ / Gastado ${gastado.toFixed(2)}€`;
            }
        }
        
        await showAlert('Documento del pedido del sistema adjuntado correctamente', 'Éxito');
        loadPedidosEnCurso();
    } catch (error) {
        console.error('Error al subir documento del sistema:', error);
        await showAlert('Error al subir el documento: ' + error.message, 'Error');
    }
}

window.uploadAlbaran = async function(pedidoId, file) {
    if (!file) return;
    
    if (!PAGO_ALLOWED_MIME.includes(file.type)) {
        await showAlert('Formato no soportado. Adjunte un PDF o imagen (JPG/PNG).', 'Error');
        return;
    }
    
    // Convertir archivo a base64 para almacenarlo
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const pedido = await db.get('pedidos', pedidoId);
            if (!pedido) {
                await showAlert('Error: No se pudo encontrar el pedido', 'Error');
                return;
            }
            
            pedido.albaran = e.target.result;
            await db.update('pedidos', pedido);
            
            await showAlert('Factura adjuntada correctamente. El pedido se ha movido al histórico.', 'Éxito');
            
            // Recargar la vista de la tienda
            loadPedidosEnCurso();
            
            // Si estamos en la vista de contabilidad, recargar las pestañas relevantes
            if (currentUserType === 'Contabilidad') {
                reloadActiveContabilidadTab();
                // El pedido ahora debe aparecer en "Histórico"
                loadPedidosPagadosContabilidad();
            }
        } catch (error) {
            console.error('Error al subir factura:', error);
            await showAlert('Error al subir la factura: ' + error.message, 'Error');
        }
    };
    reader.readAsDataURL(file);
}

// Botones de navegación atrás
document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = document.querySelector('.view.active');
        if (view.id === 'view-gestion-tienda') {
            // Las tiendas no pueden volver atrás, solo cerrar sesión
            return;
        } else if (view.id === 'view-carrito') {
            // Volver a la vista anterior (main o productos)
            if (currentCategoria) {
                showView('productos');
            } else {
                showView('main');
            }
        } else if (view.id === 'view-admin-usuarios' || view.id === 'view-admin-obras' || view.id === 'view-admin-tiendas') {
            showView('admin');
        } else if (view.id === 'view-admin-categorias') {
            // Volver a tiendas admin
            currentTiendaAdmin = null;
            showView('admin-tiendas');
            loadTiendasAdmin();
        } else if (view.id === 'view-admin-productos') {
            // Volver a categorías admin
            currentCategoriaAdmin = null;
            if (currentTiendaAdmin) {
                showView('admin-categorias');
                loadCategoriasAdmin(currentTiendaAdmin.id);
            } else {
                showView('admin-tiendas');
                loadTiendasAdmin();
            }
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
    const confirmar = await showConfirm('¿Está seguro de eliminar este usuario?', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        await db.eliminarUsuario(usuarioId);
        const tipo = document.querySelector('#view-admin-usuarios .tab-btn.active').dataset.tab;
        switchTabUsuarios(tipo);
    } catch (error) {
        await showAlert('Error al eliminar usuario: ' + error.message, 'Error');
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
        await showAlert('Error al guardar usuario: ' + error.message, 'Error');
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
    const confirmar = await showConfirm('¿Está seguro de eliminar esta obra?', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        await db.eliminarObra(obraId);
        loadObras();
    } catch (error) {
        await showAlert('Error al eliminar obra: ' + error.message, 'Error');
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

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    editingUsuarioId = null;
    editingObraId = null;
    editingTiendaId = null;
    editingCategoriaId = null;
    editingProductoId = null;
    currentTiendaAdmin = null;
    currentCategoriaAdmin = null;
}

// ========== GESTIÓN DE TIENDAS ==========

let editingTiendaId = null;
let editingCategoriaId = null;
let editingProductoId = null;
let currentTiendaAdmin = null;
let currentCategoriaAdmin = null;
let excelImportMode = 'productos'; // 'productos' o 'categorias'

// Cargar tiendas para administración
async function loadTiendasAdmin() {
    const tiendas = await db.getAll('tiendas');
    const container = document.getElementById('tiendas-admin-list');
    const emptyState = document.getElementById('tiendas-admin-empty');

    if (tiendas.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    tiendas.forEach(tienda => {
        const card = createTiendaAdminCard(tienda);
        container.appendChild(card);
    });
}

function createTiendaAdminCard(tienda) {
    const card = document.createElement('div');
    card.className = `tienda-admin-card ${tienda.activa !== false ? 'activa' : 'inactiva'}`;
    
    const servicios = [];
    if (tienda.servicios?.cuenta) servicios.push('Cuenta');
    if (tienda.servicios?.transporte) servicios.push('Transporte gratuito');
    if (tienda.servicios?.preparacion) servicios.push('Preparación de pedidos');
    if (tienda.servicios?.baseDatos) servicios.push('Base de datos');
    
    const logoHtml = tienda.logo 
        ? `<img src="${tienda.logo}" alt="${tienda.nombre}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 8px; margin-bottom: 0.5rem;" onerror="this.style.display='none';">`
        : '';
    
    card.innerHTML = `
        <div class="tienda-admin-header">
            <div>
                ${logoHtml}
                <h4>
                    ${tienda.nombre || 'Sin nombre'}
                    <span class="tienda-admin-badge ${tienda.activa !== false ? 'activa' : 'inactiva'}">
                        ${tienda.activa !== false ? 'Activa' : 'Inactiva'}
                    </span>
                </h4>
                ${tienda.sector ? `<div class="tienda-admin-info"><strong>Sector:</strong> ${tienda.sector}</div>` : ''}
                ${tienda.ubicacion ? `<div class="tienda-admin-info"><strong>Ubicación:</strong> ${tienda.ubicacion}</div>` : ''}
                ${tienda.web ? `<div class="tienda-admin-info"><strong>Web:</strong> <a href="${tienda.web}" target="_blank">${tienda.web}</a></div>` : ''}
                ${tienda.limiteCuenta ? `<div class="tienda-admin-info"><strong>Límite cuenta:</strong> ${tienda.limiteCuenta}€</div>` : ''}
                ${servicios.length > 0 ? `<div class="tienda-admin-info"><strong>Servicios:</strong> ${servicios.join(', ')}</div>` : ''}
                ${tienda.contactos ? `<div class="tienda-admin-info" style="margin-top: 0.5rem;"><strong>Personas de Contacto:</strong><br><span style="white-space: pre-line; font-size: 0.875rem;">${tienda.contactos}</span></div>` : ''}
            </div>
        </div>
        <div class="tienda-admin-actions">
            <button class="btn-icon" onclick="editarTienda('${tienda.id}')" title="Editar">✏️</button>
            <button class="btn-icon" onclick="gestionarCategoriasTienda('${tienda.id}')" title="Gestionar Categorías">📁</button>
            <button class="btn-icon danger" onclick="eliminarTienda('${tienda.id}')" title="Eliminar">🗑️</button>
        </div>
    `;
    return card;
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
        // No tiene cuenta
        document.getElementById('modal-tienda-no-cuenta').checked = true;
    } else if (tienda.tieneCuenta && !tienda.limiteCuenta) {
        // Sin límite de cuenta
        document.getElementById('modal-tienda-sin-limite').checked = true;
    } else if (tienda.tieneCuenta && tienda.limiteCuenta) {
        // Tiene cuenta con límite
        document.getElementById('modal-tienda-tiene-cuenta').checked = true;
    } else {
        // Por defecto: no tiene cuenta
        document.getElementById('modal-tienda-no-cuenta').checked = true;
    }
    document.getElementById('modal-tienda-limite').value = tienda.limiteCuenta || '';
    document.getElementById('modal-tienda-contactos').value = tienda.contactos || '';
    document.getElementById('modal-tienda-servicio-cuenta').checked = tienda.servicios?.cuenta || false;
    document.getElementById('modal-tienda-servicio-transporte').checked = tienda.servicios?.transporte || false;
    document.getElementById('modal-tienda-servicio-preparacion').checked = tienda.servicios?.preparacion || false;
    document.getElementById('modal-tienda-servicio-base-datos').checked = tienda.servicios?.baseDatos || false;
    document.getElementById('modal-tienda-notas').value = tienda.notas || '';
    document.getElementById('modal-tienda-password').value = tienda.password || '';
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
    const confirmar = await showConfirm('¿Está seguro de eliminar esta tienda? Esto también eliminará todas sus categorías y productos.', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        // Eliminar categorías y productos relacionados
        const categorias = await db.getCategoriasByTienda(tiendaId);
        for (const categoria of categorias) {
            const productos = await db.getProductosByCategoria(categoria.id);
            for (const producto of productos) {
                await db.delete('productos', producto.id);
            }
            await db.delete('categorias', categoria.id);
        }
        
        await db.delete('tiendas', tiendaId);
        loadTiendasAdmin();
    } catch (error) {
        await showAlert('Error al eliminar tienda: ' + error.message, 'Error');
    }
};

window.gestionarCategoriasTienda = async function(tiendaId) {
    const tienda = await db.get('tiendas', tiendaId);
    if (!tienda) return;
    
    currentTiendaAdmin = tienda;
    document.getElementById('categorias-tienda-header').textContent = `Categorías - ${tienda.nombre}`;
    showView('admin-categorias');
    loadCategoriasAdmin(tiendaId);
};

function openModalTienda() {
    editingTiendaId = null;
    document.getElementById('modal-tienda-titulo').textContent = 'Nueva Tienda';
    document.getElementById('modal-tienda-nombre').value = '';
    document.getElementById('modal-tienda-sector').value = '';
    document.getElementById('modal-tienda-ubicacion').value = '';
    document.getElementById('modal-tienda-sin-web').checked = false;
    document.getElementById('modal-tienda-web').value = '';
    // Configurar radio buttons de cuenta por defecto
    document.getElementById('modal-tienda-no-cuenta').checked = true;
    document.getElementById('modal-tienda-sin-limite').checked = false;
    document.getElementById('modal-tienda-tiene-cuenta').checked = false;
    document.getElementById('modal-tienda-limite').value = '';
    document.getElementById('modal-tienda-contactos').value = '';
    document.getElementById('modal-tienda-servicio-cuenta').checked = false;
    document.getElementById('modal-tienda-servicio-transporte').checked = false;
    document.getElementById('modal-tienda-servicio-preparacion').checked = false;
    document.getElementById('modal-tienda-servicio-base-datos').checked = false;
    document.getElementById('modal-tienda-notas').value = '';
    document.getElementById('modal-tienda-password').value = '';
    document.getElementById('modal-tienda-activa').checked = true;
    
    // Limpiar logo
    document.getElementById('modal-tienda-logo-preview').style.display = 'none';
    document.getElementById('modal-tienda-logo-file').value = '';

    updateTiendaModalVisibility();
    document.getElementById('modal-tienda').classList.add('active');
}

function setupTiendaModalListeners() {
    // Listeners para checkboxes de tienda
    const sinWeb = document.getElementById('modal-tienda-sin-web');
    
    if (sinWeb) {
        sinWeb.addEventListener('change', () => {
            updateTiendaModalVisibility();
        });
    }
    
    // Listeners para radio buttons de cuenta
    const noCuenta = document.getElementById('modal-tienda-no-cuenta');
    const sinLimite = document.getElementById('modal-tienda-sin-limite');
    const conLimite = document.getElementById('modal-tienda-tiene-cuenta');
    
    if (noCuenta) {
        noCuenta.addEventListener('change', () => {
            updateTiendaModalVisibility();
        });
    }
    
    if (sinLimite) {
        sinLimite.addEventListener('change', () => {
            updateTiendaModalVisibility();
        });
    }
    
    if (conLimite) {
        conLimite.addEventListener('change', () => {
            updateTiendaModalVisibility();
        });
    }
    
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
            if (files.length > 0) {
                handleImageFile(files[0], logoPreview, logoPreviewImg);
            }
        });
        
        logoFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0], logoPreview, logoPreviewImg);
            }
        });
    }
    
    // Setup dropzone de foto de producto
    const dropzone = document.getElementById('modal-producto-dropzone');
    const fileInput = document.getElementById('modal-producto-foto-file');
    const preview = document.getElementById('modal-producto-preview');
    const previewImg = document.getElementById('modal-producto-preview-img');
    
    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleImageFile(files[0], preview, previewImg);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0], preview, previewImg);
            }
        });
    }
    
    // Listener para URL de foto
    const fotoUrlInput = document.getElementById('modal-producto-foto-url');
    if (fotoUrlInput) {
        fotoUrlInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (url) {
                previewImg.src = url;
                preview.style.display = 'block';
            } else if (!fileInput.files.length) {
                preview.style.display = 'none';
            }
        });
    }
}

function updateTiendaModalVisibility() {
    const sinWeb = document.getElementById('modal-tienda-sin-web').checked;
    const noCuenta = document.getElementById('modal-tienda-no-cuenta').checked;
    const sinLimite = document.getElementById('modal-tienda-sin-limite').checked;
    const conLimite = document.getElementById('modal-tienda-tiene-cuenta').checked;
    
    document.getElementById('modal-tienda-web-group').style.display = sinWeb ? 'none' : 'block';
    document.getElementById('modal-tienda-limite-group').style.display = conLimite ? 'block' : 'none';
}

async function handleImageFile(file, preview, previewImg) {
    if (!file.type.startsWith('image/')) {
        await showAlert('Por favor, selecciona un archivo de imagen', 'Error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
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
    
    // Determinar si tiene cuenta y el límite
    const tieneCuenta = sinLimite || conLimite;
    const limite = conLimite ? parseFloat(document.getElementById('modal-tienda-limite').value) : null;
    const contactos = document.getElementById('modal-tienda-contactos').value.trim();
    const servicios = {
        cuenta: document.getElementById('modal-tienda-servicio-cuenta').checked,
        transporte: document.getElementById('modal-tienda-servicio-transporte').checked,
        preparacion: document.getElementById('modal-tienda-servicio-preparacion').checked,
        baseDatos: document.getElementById('modal-tienda-servicio-base-datos').checked
    };
    const notas = document.getElementById('modal-tienda-notas').value.trim();
    const password = document.getElementById('modal-tienda-password').value.trim();
    const activa = document.getElementById('modal-tienda-activa').checked;
    const logoFileInput = document.getElementById('modal-tienda-logo-file');

    if (!nombre) {
        await showAlert('Por favor, ingrese un nombre para la tienda', 'Error');
        return;
    }

    if (!password || password.length !== 4 || !/^\d{4}$/.test(password)) {
        await showAlert('Por favor, ingrese una contraseña de 4 dígitos para la tienda', 'Error');
        return;
    }

    try {
        let logo = null;
        
        // Si hay un archivo nuevo, convertirlo a base64
        if (logoFileInput.files.length > 0) {
            console.log('Guardando nuevo logo para tienda:', nombre);
            logo = await fileToBase64(logoFileInput.files[0]);
            console.log('Logo convertido a base64, longitud:', logo ? logo.length : 0);
        } else if (editingTiendaId) {
            // Si estamos editando y no hay archivo nuevo, mantener el logo existente
            const tiendaExistente = await db.get('tiendas', editingTiendaId);
            logo = tiendaExistente?.logo || null;
            console.log('Manteniendo logo existente para tienda:', nombre, 'Logo existe:', !!logo);
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
            logo: logo,
            password: password
        };

        console.log('Guardando tienda con logo:', !!tiendaData.logo, 'Logo length:', tiendaData.logo ? tiendaData.logo.length : 0);

        if (editingTiendaId) {
            tiendaData.id = editingTiendaId;
            await db.update('tiendas', tiendaData);
            console.log('Tienda actualizada. ID:', editingTiendaId);
        } else {
            const nuevoId = await db.add('tiendas', tiendaData);
            console.log('Tienda creada. ID:', nuevoId);
        }

        closeAllModals();
        loadTiendasAdmin();
    } catch (error) {
        await showAlert('Error al guardar tienda: ' + error.message, 'Error');
    }
}

// ========== GESTIÓN DE CATEGORÍAS ==========

async function loadCategoriasAdmin(tiendaId) {
    const categorias = await db.getCategoriasByTienda(tiendaId);
    const container = document.getElementById('categorias-admin-list');
    const emptyState = document.getElementById('categorias-admin-empty');

    if (categorias.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    categorias.forEach(categoria => {
        const card = createCategoriaAdminCard(categoria);
        container.appendChild(card);
    });
}

function createCategoriaAdminCard(categoria) {
    const card = document.createElement('div');
    card.className = 'categoria-admin-card';
    card.innerHTML = `
        <div>
            <h4>${categoria.nombre}</h4>
        </div>
        <div class="usuario-actions">
            <button class="btn-icon" onclick="editarCategoria('${categoria.id}')" title="Editar">✏️</button>
            <button class="btn-icon" onclick="gestionarProductosCategoria('${categoria.id}')" title="Gestionar Productos">📦</button>
            <button class="btn-icon danger" onclick="eliminarCategoria('${categoria.id}')" title="Eliminar">🗑️</button>
        </div>
    `;
    return card;
}

window.editarCategoria = async function(categoriaId) {
    const categoria = await db.get('categorias', categoriaId);
    if (!categoria) return;

    editingCategoriaId = categoriaId;
    document.getElementById('modal-categoria-titulo').textContent = 'Editar Categoría';
    document.getElementById('modal-categoria-nombre').value = categoria.nombre || '';

    document.getElementById('modal-categoria').classList.add('active');
};

window.eliminarCategoria = async function(categoriaId) {
    const confirmar = await showConfirm('¿Está seguro de eliminar esta categoría? Esto también eliminará todos sus productos.', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        const productos = await db.getProductosByCategoria(categoriaId);
        for (const producto of productos) {
            await db.delete('productos', producto.id);
        }
        await db.delete('categorias', categoriaId);
        if (currentTiendaAdmin) {
            loadCategoriasAdmin(currentTiendaAdmin.id);
        }
    } catch (error) {
        await showAlert('Error al eliminar categoría: ' + error.message, 'Error');
    }
};

window.gestionarProductosCategoria = async function(categoriaId) {
    const categoria = await db.get('categorias', categoriaId);
    if (!categoria) return;
    
    currentCategoriaAdmin = categoria;
    document.getElementById('productos-categoria-header').textContent = `Productos - ${categoria.nombre}`;
    showView('admin-productos');
    loadProductosAdmin(categoriaId);
};

function openModalCategoria() {
    editingCategoriaId = null;
    document.getElementById('modal-categoria-titulo').textContent = 'Nueva Categoría';
    document.getElementById('modal-categoria-nombre').value = '';

    document.getElementById('modal-categoria').classList.add('active');
}

async function guardarCategoria() {
    const nombre = document.getElementById('modal-categoria-nombre').value.trim();

    if (!nombre) {
        await showAlert('Por favor, ingrese un nombre para la categoría', 'Error');
        return;
    }

    if (!currentTiendaAdmin) {
        await showAlert('Error: No hay tienda seleccionada', 'Error');
        return;
    }

    try {
        const categoriaData = {
            tiendaId: currentTiendaAdmin.id,
            nombre: nombre
        };

        if (editingCategoriaId) {
            categoriaData.id = editingCategoriaId;
            await db.update('categorias', categoriaData);
        } else {
            await db.add('categorias', categoriaData);
        }

        closeAllModals();
        loadCategoriasAdmin(currentTiendaAdmin.id);
    } catch (error) {
        await showAlert('Error al guardar categoría: ' + error.message, 'Error');
    }
}

// ========== GESTIÓN DE PRODUCTOS ==========

async function loadProductosAdmin(categoriaId) {
    const productos = await db.getProductosByCategoria(categoriaId);
    const container = document.getElementById('productos-admin-list');
    const emptyState = document.getElementById('productos-admin-empty');

    if (productos.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    productos.forEach(producto => {
        const card = createProductoAdminCard(producto);
        container.appendChild(card);
    });
}

function createProductoAdminCard(producto) {
    const card = document.createElement('div');
    card.className = 'producto-admin-card';
    
    const foto = producto.foto || '';
    
    card.innerHTML = `
        ${foto ? `<img src="${foto}" alt="${producto.nombre}" class="producto-admin-image" onerror="this.style.display='none'">` : '<div class="producto-admin-image" style="background-color: var(--bg-color); display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">Sin imagen</div>'}
        <h4>${producto.nombre}</h4>
        ${producto.precio ? `<div class="producto-admin-precio">${producto.precio.toFixed(2)}€</div>` : ''}
        ${producto.descripcion ? `<p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">${producto.descripcion}</p>` : ''}
        <div class="producto-admin-actions">
            <button class="btn-icon" onclick="editarProducto('${producto.id}')" title="Editar">✏️</button>
            <button class="btn-icon danger" onclick="eliminarProducto('${producto.id}')" title="Eliminar">🗑️</button>
        </div>
    `;
    return card;
}

window.editarProducto = async function(productoId) {
    const producto = await db.get('productos', productoId);
    if (!producto) return;

    editingProductoId = productoId;
    document.getElementById('modal-producto-titulo').textContent = 'Editar Producto';
    document.getElementById('modal-producto-foto-url').value = producto.foto || '';
    document.getElementById('modal-producto-designacion').value = producto.designacion || '';
    document.getElementById('modal-producto-ean').value = producto.ean || '';
    document.getElementById('modal-producto-nombre').value = producto.nombre || '';
    document.getElementById('modal-producto-precio').value = producto.precio || '';
    document.getElementById('modal-producto-descripcion').value = producto.descripcion || '';
    
    const preview = document.getElementById('modal-producto-preview');
    const previewImg = document.getElementById('modal-producto-preview-img');
    if (producto.foto) {
        previewImg.src = producto.foto;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }

    document.getElementById('modal-producto').classList.add('active');
};

window.eliminarProducto = async function(productoId) {
    const confirmar = await showConfirm('¿Está seguro de eliminar este producto?', 'Confirmar Eliminación');
    if (!confirmar) return;
    
    try {
        await db.delete('productos', productoId);
        if (currentCategoriaAdmin) {
            loadProductosAdmin(currentCategoriaAdmin.id);
        }
    } catch (error) {
        await showAlert('Error al eliminar producto: ' + error.message, 'Error');
    }
};

function openModalProducto() {
    editingProductoId = null;
    document.getElementById('modal-producto-titulo').textContent = 'Nuevo Producto';
    document.getElementById('modal-producto-foto-url').value = '';
    document.getElementById('modal-producto-designacion').value = '';
    document.getElementById('modal-producto-ean').value = '';
    document.getElementById('modal-producto-nombre').value = '';
    document.getElementById('modal-producto-precio').value = '';
    document.getElementById('modal-producto-descripcion').value = '';
    document.getElementById('modal-producto-preview').style.display = 'none';
    document.getElementById('modal-producto-foto-file').value = '';

    document.getElementById('modal-producto').classList.add('active');
}

async function guardarProducto() {
    const fotoUrl = document.getElementById('modal-producto-foto-url').value.trim();
    const designacion = document.getElementById('modal-producto-designacion').value.trim();
    const ean = document.getElementById('modal-producto-ean').value.trim();
    const nombre = document.getElementById('modal-producto-nombre').value.trim();
    const precio = parseFloat(document.getElementById('modal-producto-precio').value) || null;
    const descripcion = document.getElementById('modal-producto-descripcion').value.trim();
    const fileInput = document.getElementById('modal-producto-foto-file');
    
    if (!designacion) {
        await showAlert('Por favor, ingrese una designación para el artículo', 'Error');
        return;
    }
    
    if (!nombre) {
        await showAlert('Por favor, ingrese un nombre para el artículo', 'Error');
        return;
    }

    if (!currentCategoriaAdmin) {
        await showAlert('Error: No hay categoría seleccionada', 'Error');
        return;
    }

    try {
        let foto = fotoUrl;
        
        // Si hay archivo seleccionado, convertirlo a base64
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            foto = await fileToBase64(file);
        }

        const productoData = {
            categoriaId: currentCategoriaAdmin.id,
            tiendaId: currentCategoriaAdmin.tiendaId,
            designacion: designacion,
            ean: ean || null,
            nombre: nombre,
            precio: precio,
            descripcion: descripcion || null,
            foto: foto || null
        };

        if (editingProductoId) {
            productoData.id = editingProductoId;
            await db.update('productos', productoData);
        } else {
            await db.add('productos', productoData);
        }

        closeAllModals();
        loadProductosAdmin(currentCategoriaAdmin.id);
    } catch (error) {
        await showAlert('Error al guardar producto: ' + error.message, 'Error');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ========== IMPORTACIÓN DE EXCEL ==========

function openModalExcel() {
    const modal = document.getElementById('modal-importar-excel');
    const titulo = document.getElementById('modal-excel-titulo');
    const instructions = document.getElementById('excel-instructions');
    const fileInput = document.getElementById('excel-file-input');
    const statusDiv = document.getElementById('excel-import-status');
    const btnProcesar = document.getElementById('btn-procesar-excel');
    
    fileInput.value = '';
    statusDiv.style.display = 'none';
    btnProcesar.disabled = true;
    
    if (excelImportMode === 'categorias') {
        titulo.textContent = 'Importar Categorías y Productos desde Excel';
        instructions.innerHTML = `
            <strong>Formato del Excel:</strong><br>
            <strong>Columna A:</strong> Categoría (obligatorio) - Se repetirá para cada producto de esa categoría<br>
            <strong>Columna B:</strong> Designación del artículo (obligatorio)<br>
            <strong>Columna C:</strong> Referencia (opcional)<br>
            <strong>Columna D:</strong> Código EAN (opcional)<br>
            <strong>Columna E:</strong> Descripción (opcional)<br>
            <strong>Columna F:</strong> Precio en euros (opcional, usar punto o coma como decimal)<br>
            <strong>Columna G:</strong> URL de la foto (opcional)<br>
            <br>
            <strong>Ejemplo:</strong><br>
            | Categoría | Designación | Referencia | EAN | Descripción | Precio | Foto |<br>
            | Ferretería | TORN-M6-20 | REF-001 | 1234567890123 | Tornillo acero | 0.15 | https://... |<br>
            <br>
            <strong>Nota:</strong> La primera fila puede ser encabezados y será ignorada. Las categorías se crearán automáticamente si no existen. Solo son obligatorias las columnas A (Categoría) y B (Designación).
        `;
    } else {
        titulo.textContent = 'Importar Productos desde Excel';
        instructions.innerHTML = `
            <strong>Formato del Excel:</strong><br>
            <strong>Columna A:</strong> Designación del artículo (obligatorio)<br>
            <strong>Columna B:</strong> EAN (opcional)<br>
            <strong>Columna C:</strong> Nombre del artículo (obligatorio)<br>
            <strong>Columna D:</strong> Descripción (opcional)<br>
            <strong>Columna E:</strong> Precio en euros (opcional, usar punto o coma como decimal)<br>
            <strong>Columna F:</strong> URL de la foto (opcional)<br>
            <br>
            <strong>Nota:</strong> La primera fila puede ser encabezados y será ignorada. Los productos se crearán en la categoría actualmente seleccionada.
        `;
    }
    
    modal.classList.add('active');
}

async function procesarExcel() {
    const fileInput = document.getElementById('excel-file-input');
    const statusDiv = document.getElementById('excel-import-status');
    const messageP = document.getElementById('excel-import-message');
    const btnProcesar = document.getElementById('btn-procesar-excel');
    
    if (!fileInput.files.length) {
        await showAlert('Por favor, selecciona un archivo Excel', 'Error');
        return;
    }
    
    if (excelImportMode === 'productos' && !currentCategoriaAdmin) {
        await showAlert('Error: No hay categoría seleccionada', 'Error');
        return;
    }
    
    if (excelImportMode === 'categorias' && !currentTiendaAdmin) {
        await showAlert('Error: No hay tienda seleccionada', 'Error');
        return;
    }
    
    if (!window.XLSX) {
        await showAlert('Error: La librería de Excel no está cargada. Por favor, recarga la página.', 'Error');
        return;
    }
    
    btnProcesar.disabled = true;
    btnProcesar.textContent = 'Procesando...';
    statusDiv.style.display = 'block';
    messageP.textContent = 'Leyendo archivo Excel...';
    messageP.style.color = 'var(--text-secondary)';
    
    try {
        const file = fileInput.files[0];
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Obtener la primera hoja
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: null
        });
        
        if (jsonData.length === 0) {
            throw new Error('El archivo Excel está vacío');
        }
        
        // Procesar filas (ignorar la primera si parece ser encabezados)
        let startRow = 0;
        if (jsonData.length > 0) {
            const firstRow = jsonData[0];
            const firstCell = firstRow[0] ? String(firstRow[0]).toLowerCase() : '';
            // Detectar encabezados
            if (firstCell.includes('categoría') || firstCell.includes('categoria') ||
                firstCell.includes('designación') || firstCell.includes('designacion') ||
                firstCell.includes('nombre') || firstCell.includes('artículo') ||
                firstCell.includes('articulo')) {
                startRow = 1;
            }
        }
        
        let productosCreados = 0;
        let productosActualizados = 0;
        let categoriasCreadas = 0;
        let productosConError = 0;
        const errores = [];
        const categoriasMap = {}; // Cache de categorías por nombre
        
        // Obtener todos los productos de la tienda para verificar duplicados
        const tiendaId = excelImportMode === 'categorias' ? currentTiendaAdmin.id : currentCategoriaAdmin.tiendaId;
        const todosProductos = await db.getAll('productos');
        const productosTienda = todosProductos.filter(p => p.tiendaId === tiendaId);
        
        messageP.textContent = `Procesando ${jsonData.length - startRow} filas...`;
        
        for (let i = startRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            let categoriaId = null;
            let nombre = null;
            let descripcion = null;
            let precio = null;
            let foto = null;
            
            let designacion = null;
            let ean = null;
            
            let referencia = null;
            
            if (excelImportMode === 'categorias') {
                // Modo categorías: A = Categoría, B = Designación, C = Referencia, D = EAN, E = Descripción, F = Precio, G = Foto
                const categoriaNombre = row[0] ? String(row[0]).trim() : null;
                designacion = row[1] ? String(row[1]).trim() : null;
                referencia = row[2] ? String(row[2]).trim() : null;
                ean = row[3] ? String(row[3]).trim() : null;
                
                if (!categoriaNombre || !designacion) {
                    productosConError++;
                    errores.push(`Fila ${i + 1}: Falta la categoría o designación del artículo (obligatorias)`);
                    continue;
                }
                
                // Usar designación como nombre si no hay nombre específico
                nombre = designacion;
                
                // Buscar o crear categoría
                if (!categoriasMap[categoriaNombre]) {
                    // Buscar si ya existe
                    const categorias = await db.getCategoriasByTienda(currentTiendaAdmin.id);
                    const categoriaExistente = categorias.find(c => c.nombre === categoriaNombre);
                    
                    if (categoriaExistente) {
                        categoriasMap[categoriaNombre] = categoriaExistente.id;
                    } else {
                        // Crear nueva categoría
                        const nuevaCategoria = {
                            tiendaId: currentTiendaAdmin.id,
                            nombre: categoriaNombre
                        };
                        const categoriaIdNueva = await db.add('categorias', nuevaCategoria);
                        categoriasMap[categoriaNombre] = categoriaIdNueva;
                        categoriasCreadas++;
                    }
                }
                categoriaId = categoriasMap[categoriaNombre];
                
                // Columna E: Descripción (opcional)
                descripcion = row[4] ? String(row[4]).trim() : null;
                
                // Columna F: Precio (opcional)
                if (row[5] !== null && row[5] !== undefined && row[5] !== '') {
                    const precioStr = String(row[5]).replace(',', '.');
                    precio = parseFloat(precioStr);
                    if (isNaN(precio)) {
                        precio = null;
                    }
                }
                
                // Columna G: URL de la foto (opcional)
                foto = row[6] ? String(row[6]).trim() : null;
                
            } else {
                // Modo productos: A = Designación, B = EAN, C = Nombre, D = Descripción, E = Precio, F = Foto
                designacion = row[0] ? String(row[0]).trim() : null;
                ean = row[1] ? String(row[1]).trim() : null;
                nombre = row[2] ? String(row[2]).trim() : null;
                
                if (!designacion || !nombre) {
                    productosConError++;
                    errores.push(`Fila ${i + 1}: Falta la designación o nombre del artículo`);
                    continue;
                }
                
                categoriaId = currentCategoriaAdmin.id;
                
                // Columna D: Descripción (opcional)
                descripcion = row[3] ? String(row[3]).trim() : null;
                
                // Columna E: Precio (opcional)
                if (row[4] !== null && row[4] !== undefined && row[4] !== '') {
                    const precioStr = String(row[4]).replace(',', '.');
                    precio = parseFloat(precioStr);
                    if (isNaN(precio)) {
                        precio = null;
                    }
                }
                
                // Columna F: URL de la foto (opcional)
                foto = row[5] ? String(row[5]).trim() : null;
            }
            
            try {
                const productoData = {
                    categoriaId: categoriaId,
                    tiendaId: excelImportMode === 'categorias' ? currentTiendaAdmin.id : currentCategoriaAdmin.tiendaId,
                    designacion: designacion || null,
                    referencia: referencia || null,
                    ean: ean || null,
                    nombre: nombre,
                    descripcion: descripcion || null,
                    precio: precio,
                    foto: foto || null
                };
                
                // Buscar producto existente por EAN o referencia
                let productoExistente = null;
                if (ean && ean.trim() !== '') {
                    productoExistente = productosTienda.find(p => 
                        p.ean && p.ean.trim() !== '' && p.ean.trim() === ean.trim()
                    );
                }
                
                // Si no se encontró por EAN, buscar por referencia
                if (!productoExistente && referencia && referencia.trim() !== '') {
                    productoExistente = productosTienda.find(p => 
                        p.referencia && p.referencia.trim() !== '' && p.referencia.trim() === referencia.trim()
                    );
                }
                
                if (productoExistente) {
                    // Actualizar producto existente
                    productoData.id = productoExistente.id;
                    await db.update('productos', productoData);
                    productosActualizados++;
                    // Actualizar en la lista local para evitar duplicados en la misma importación
                    const index = productosTienda.findIndex(p => p.id === productoExistente.id);
                    if (index !== -1) {
                        productosTienda[index] = { ...productoData, id: productoExistente.id };
                    }
                } else {
                    // Crear nuevo producto
                    const nuevoId = await db.add('productos', productoData);
                    productosCreados++;
                    // Agregar a la lista para evitar duplicados en la misma importación
                    productosTienda.push({ ...productoData, id: nuevoId });
                }
            } catch (error) {
                productosConError++;
                errores.push(`Fila ${i + 1}: ${error.message}`);
            }
        }
        
        // Mostrar resultado
        let mensaje = `✅ Importación completada:\n`;
        if (excelImportMode === 'categorias') {
            mensaje += `- Categorías creadas: ${categoriasCreadas}\n`;
        }
        mensaje += `- Productos creados: ${productosCreados}\n`;
        mensaje += `- Productos actualizados: ${productosActualizados}\n`;
        if (productosConError > 0) {
            mensaje += `- Errores: ${productosConError}\n`;
            if (errores.length > 0) {
                mensaje += `\nErrores:\n${errores.slice(0, 5).join('\n')}`;
                if (errores.length > 5) {
                    mensaje += `\n... y ${errores.length - 5} más`;
                }
            }
            messageP.style.color = 'var(--warning-color)';
        } else {
            messageP.style.color = 'var(--success-color)';
        }
        
        messageP.textContent = mensaje;
        
        // Recargar datos
        setTimeout(() => {
            if (excelImportMode === 'categorias') {
                loadCategoriasAdmin(currentTiendaAdmin.id);
            } else {
                loadProductosAdmin(currentCategoriaAdmin.id);
            }
            closeAllModals();
        }, 2000);
        
    } catch (error) {
        messageP.style.color = 'var(--danger-color)';
        messageP.textContent = `❌ Error al procesar el archivo: ${error.message}`;
        btnProcesar.disabled = false;
        btnProcesar.textContent = 'Importar';
    }
}


