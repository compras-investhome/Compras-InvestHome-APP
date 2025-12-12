// Login - Módulo independiente
import { db } from '../database.js';

// Inicializar base de datos
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await db.init();
        await db.initDefaultData();
        setupLoginListeners();
    } catch (error) {
        console.error('Error al inicializar:', error);
    }
});

// Setup Login Listeners
function setupLoginListeners() {
    const selectTipoUsuario = document.getElementById('select-tipo-usuario');
    const btnLogin = document.getElementById('btn-login');

    selectTipoUsuario.addEventListener('change', async (e) => {
        const tipo = e.target.value;
        await updateLoginForm(tipo);
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

        // Limpiar selector de obras inicialmente
        selectObra.innerHTML = '<option value="">Seleccione un usuario primero</option>';
        
        // Remover listener anterior si existe
        const oldHandler = selectUsuario._cargarObrasHandler;
        if (oldHandler) {
            selectUsuario.removeEventListener('change', oldHandler);
        }
        
        // Crear nuevo handler para cargar obras según usuario
        const cargarObrasUsuario = async function() {
            const userId = selectUsuario.value;
            if (!userId) {
                selectObra.innerHTML = '<option value="">Seleccione un usuario primero</option>';
                return;
            }
            
            // Obtener el usuario seleccionado
            const usuario = await db.get('usuarios', userId);
            if (!usuario) {
                selectObra.innerHTML = '<option value="">Error al cargar usuario</option>';
                return;
            }
            
            // OPTIMIZACIÓN: Usar caché de getAllObras (ya tiene caché en database.js)
            const todasLasObras = await db.getAllObras();
            
            // Si el usuario tiene obras asignadas, filtrar solo esas
            let obrasDisponibles = [];
            if (usuario.obrasAsignadas && usuario.obrasAsignadas.length > 0) {
                // Filtrar solo las obras asignadas
                obrasDisponibles = todasLasObras.filter(obra => 
                    usuario.obrasAsignadas.includes(obra.id)
                );
            } else {
                // Si no tiene obras asignadas, mostrar todas
                obrasDisponibles = todasLasObras;
            }
            
            // Cargar obras en el selector
            selectObra.innerHTML = '<option value="">Seleccione una obra</option>';
            obrasDisponibles.forEach(obra => {
                const option = document.createElement('option');
                option.value = obra.id;
                option.textContent = obra.nombreComercial || obra.nombre;
                selectObra.appendChild(option);
            });
            
            // Si solo hay una obra, seleccionarla automáticamente
            if (obrasDisponibles.length === 1) {
                selectObra.value = obrasDisponibles[0].id;
            }
        };
        
        // Guardar referencia al handler para poder removerlo después
        selectUsuario._cargarObrasHandler = cargarObrasUsuario;
        selectUsuario.addEventListener('change', cargarObrasUsuario);
    } else if (tipoUsuario === 'Tienda') {
        // Solo Tienda + Contraseña (sin usuarios)
        // Cargar solo tiendas que tienen usuario asociado
        formGroupTienda.style.display = 'block';
        
        // OPTIMIZACIÓN: Cargar usuarios y tiendas en paralelo y usar caché
        const [usuariosTienda, todasLasTiendas] = await Promise.all([
            db.getUsuariosByTipo('Tienda'),
            db.getAll('tiendas') // Ya usa caché en database.js
        ]);
        const tiendasIds = new Set(usuariosTienda
            .filter(u => u.tiendaId)
            .map(u => u.tiendaId));
        
        // Obtener las tiendas que tienen usuario asociado
        const tiendasConUsuario = todasLasTiendas.filter(tienda => 
            tiendasIds.has(tienda.id)
        );
        
        selectTienda.innerHTML = '<option value="">Seleccione una tienda</option>';
        tiendasConUsuario.forEach(tienda => {
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
            // Buscar el usuario de tipo Tienda asociado a esta tienda
            const usuariosTienda = await db.getUsuariosByTipo('Tienda');
            const usuarioTienda = usuariosTienda.find(u => u.tiendaId === tiendaId);
            
            if (!usuarioTienda) {
                showError('No hay usuario asociado a esta tienda');
                return;
            }
            
            // Validar contraseña del usuario
            if (usuarioTienda.password !== password) {
                showError('Contraseña incorrecta');
                return;
            }
            
            // Usar el usuario encontrado
            usuario = usuarioTienda;
            tienda = await db.get('tiendas', tiendaId);
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

        // Guardar sesión en base de datos
        await db.saveSesionCompleta({
            userId: usuario.id,
            obraId: obraId || null,
            tiendaId: tiendaId || null
        });

        // Esperar un momento para asegurar que la sesión se guarde completamente
        await new Promise(resolve => setTimeout(resolve, 300));

        // Verificar que la sesión se guardó correctamente
        const sesionVerificada = await db.getSesionCompleta();
        if (!sesionVerificada || sesionVerificada.userId !== usuario.id) {
            showError('Error al guardar la sesión. Por favor, inténtalo de nuevo.');
            return;
        }

        // Redirigir según tipo de usuario
        redirectByUserType(tipoUsuario);
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

function redirectByUserType(tipoUsuario) {
    // Redirigir a cada perfil según el tipo de usuario
    // Las rutas son relativas desde index.html (raíz del proyecto)
    const profileRoutes = {
        'Administrador': 'admin/admin.html',
        'Contabilidad': 'contabilidad/contabilidad.html',
        'Técnico': 'tecnico/tecnico.html',
        'Encargado': 'encargado/encargado.html',
        'Tienda': 'tienda/tienda.html'
    };

    const route = profileRoutes[tipoUsuario];
    if (route) {
        window.location.href = route;
    } else {
        showError('Tipo de usuario no válido');
    }
}


