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
            albaran: null
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
    
    // Agrupar pedidos por obra
    const pedidosPorObra = {};
    for (const pedido of pedidosNoCompletados) {
        const obraId = pedido.obraId;
        if (!pedidosPorObra[obraId]) {
            const obra = await db.get('obras', obraId);
            pedidosPorObra[obraId] = {
                obra: obra,
                pedidos: []
            };
        }
        pedidosPorObra[obraId].pedidos.push(pedido);
    }
    
    // Ordenar obras por nombre
    const obrasOrdenadas = Object.values(pedidosPorObra).sort((a, b) => {
        const nombreA = a.obra?.nombreComercial || '';
        const nombreB = b.obra?.nombreComercial || '';
        return nombreA.localeCompare(nombreB);
    });
    
    // Crear desplegables por obra
    for (const grupo of obrasOrdenadas) {
        const obra = grupo.obra;
        const pedidos = grupo.pedidos;
        
        // Ordenar pedidos por fecha (más recientes primero)
        pedidos.sort((a, b) => {
            const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
            const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
            return fechaB - fechaA;
        });
        
        const obraSection = document.createElement('div');
        obraSection.className = 'obra-pedidos-section';
        obraSection.innerHTML = `
            <div class="obra-pedidos-header" onclick="toggleObraPedidos('${obra.id}')">
                <h3>${obra.nombreComercial || 'Obra sin nombre'}</h3>
                <span class="obra-pedidos-count">${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}</span>
                <span class="obra-pedidos-toggle" id="toggle-${obra.id}">▼</span>
            </div>
            <div class="obra-pedidos-content" id="content-${obra.id}" style="display: none;">
                <!-- Los pedidos se cargarán aquí -->
            </div>
        `;
        container.appendChild(obraSection);
        
        const contentDiv = obraSection.querySelector(`#content-${obra.id}`);
        for (const pedido of pedidos) {
            const tienda = await db.get('tiendas', pedido.tiendaId);
            const card = createPedidoCard(pedido, tienda);
            contentDiv.appendChild(card);
        }
    }
}

function createPedidoCard(pedido, tienda) {
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
    
    card.innerHTML = `
        <div class="pedido-header">
            <div>
                <div class="pedido-id">Pedido #${pedido.id} - ${tienda.nombre}</div>
                <div class="pedido-info">${pedido.persona} | ${pedido.obraNombreComercial || pedido.obra}</div>
            </div>
            <span class="pedido-estado ${estadoClass}">${pedido.estado}</span>
        </div>
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
        loadMisPedidos();
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
        loadMisPedidos();
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
        loadMisPedidos();
    } catch (error) {
        console.error('Error al solicitar anulación:', error);
        await showAlert('Error al solicitar anulación: ' + error.message, 'Error');
    }
};

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
        const card = createPedidoGestionCard(pedido);
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
        const card = createPedidoGestionCard(pedido, true);
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

function createPedidoGestionCard(pedido, isCerrado = false) {
    const card = document.createElement('div');
    card.className = 'pedido-gestion-card';
    
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
        let categoriasCreadas = 0;
        let productosConError = 0;
        const errores = [];
        const categoriasMap = {}; // Cache de categorías por nombre
        
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
                
                await db.add('productos', productoData);
                productosCreados++;
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


