// Sistema de Base de Datos con Firebase Firestore

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy,
    setDoc,
    serverTimestamp,
    startAfter,
    limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class Database {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) {
            return this.db;
        }

        // Verificar que firebaseConfig esté disponible
        if (!window.firebaseConfig) {
            const errorMsg = 'Firebase no está configurado. Por favor, configura firebase-config.js con tus credenciales.';
            console.error(errorMsg);
            // No lanzar error, permitir que la app funcione sin Firebase (modo offline)
            throw new Error(errorMsg);
        }

        // Verificar que las credenciales no sean las de ejemplo
        if (window.firebaseConfig.apiKey === 'TU_API_KEY' || 
            window.firebaseConfig.projectId === 'TU_PROJECT_ID') {
            const errorMsg = 'Firebase no está configurado correctamente. Por favor, reemplaza los valores de ejemplo en firebase-config.js';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        // Inicializar Firebase
        const app = initializeApp(window.firebaseConfig);
        this.db = getFirestore(app);
        this.initialized = true;

        // Inicializar datos por defecto si no existen
        await this.initDefaultData();

        return this.db;
    }

    // Inicializar datos por defecto
    async initDefaultData() {
        try {
            const tiendasSnapshot = await getDocs(collection(this.db, 'tiendas'));
            if (tiendasSnapshot.empty) {
                await this.seedData();
            }
            
            // Verificar si existe usuario administrador
            const usuariosSnapshot = await getDocs(collection(this.db, 'usuarios'));
            const adminExists = usuariosSnapshot.docs.some(doc => doc.data().tipo === 'Administrador');
            if (!adminExists) {
                // Crear usuario administrador por defecto
                await addDoc(collection(this.db, 'usuarios'), {
                    username: 'admin',
                    tipo: 'Administrador',
                    password: '0000'
                });
            }
            
            // Verificar si existen obras
            const obrasSnapshot = await getDocs(collection(this.db, 'obras'));
            if (obrasSnapshot.empty) {
                await this.seedObras();
            }
        } catch (error) {
            console.error('Error al verificar datos iniciales:', error);
        }
    }

    async seedData() {
        // Crear tiendas
        const tiendas = [
            { nombre: 'Leroy Merlin', icono: '🏪' },
            { nombre: 'Wurth', icono: '🔧' },
            { nombre: 'Puya', icono: '🛠️' },
            { nombre: 'Carlos Alcaraz', icono: '🏗️' },
            { nombre: 'Pinturas Mata', icono: '🎨' },
            { nombre: 'ERFRI', icono: '❄️' }
        ];

        const tiendaIds = {};
        for (const tienda of tiendas) {
            const docRef = await addDoc(collection(this.db, 'tiendas'), tienda);
            tiendaIds[tienda.nombre] = docRef.id;
        }

        // Crear categorías para Leroy Merlin
        const categoriasLeroy = [
            { tiendaId: tiendaIds['Leroy Merlin'], nombre: 'Ferretería' },
            { tiendaId: tiendaIds['Leroy Merlin'], nombre: 'Fontanería-Electricidad' },
            { tiendaId: tiendaIds['Leroy Merlin'], nombre: 'Pinturas' },
            { tiendaId: tiendaIds['Leroy Merlin'], nombre: 'Herramientas' },
            { tiendaId: tiendaIds['Leroy Merlin'], nombre: 'Jardín' },
            { tiendaId: tiendaIds['Leroy Merlin'], nombre: 'Iluminación' }
        ];

        const categoriaIds = {};
        for (const categoria of categoriasLeroy) {
            const docRef = await addDoc(collection(this.db, 'categorias'), categoria);
            categoriaIds[`${categoria.tiendaId}-${categoria.nombre}`] = docRef.id;
        }

        // Crear algunos productos de ejemplo
        const productosEjemplo = [
            {
                tiendaId: tiendaIds['Leroy Merlin'],
                categoriaId: categoriaIds[`${tiendaIds['Leroy Merlin']}-Ferretería`],
                nombre: 'Tornillo M6x20',
                descripcion: 'Tornillo de acero inoxidable M6x20mm',
                precio: 0.15
            },
            {
                tiendaId: tiendaIds['Leroy Merlin'],
                categoriaId: categoriaIds[`${tiendaIds['Leroy Merlin']}-Ferretería`],
                nombre: 'Tuerca M6',
                descripcion: 'Tuerca hexagonal M6 acero inoxidable',
                precio: 0.10
            },
            {
                tiendaId: tiendaIds['Leroy Merlin'],
                categoriaId: categoriaIds[`${tiendaIds['Leroy Merlin']}-Fontanería-Electricidad`],
                nombre: 'Tubo PVC 20mm',
                descripcion: 'Tubo de PVC para fontanería diámetro 20mm',
                precio: 2.50
            },
            {
                tiendaId: tiendaIds['Leroy Merlin'],
                categoriaId: categoriaIds[`${tiendaIds['Leroy Merlin']}-Pinturas`],
                nombre: 'Pintura Blanca Mate',
                descripcion: 'Pintura plástica blanca mate 5L',
                precio: 25.99
            },
            {
                tiendaId: tiendaIds['Leroy Merlin'],
                categoriaId: categoriaIds[`${tiendaIds['Leroy Merlin']}-Herramientas`],
                nombre: 'Taladro Percutor',
                descripcion: 'Taladro percutor 750W con maletín',
                precio: 89.99
            },
            {
                tiendaId: tiendaIds['Leroy Merlin'],
                categoriaId: categoriaIds[`${tiendaIds['Leroy Merlin']}-Jardín`],
                nombre: 'Manguera 20m',
                descripcion: 'Manguera de jardín 20 metros',
                precio: 15.99
            },
            {
                tiendaId: tiendaIds['Leroy Merlin'],
                categoriaId: categoriaIds[`${tiendaIds['Leroy Merlin']}-Iluminación`],
                nombre: 'Bombilla LED 9W',
                descripcion: 'Bombilla LED E27 9W equivalente 60W',
                precio: 4.99
            }
        ];

        for (const producto of productosEjemplo) {
            await addDoc(collection(this.db, 'productos'), producto);
        }

        // Crear categorías para otras tiendas (ejemplo)
        const otrasTiendas = ['Wurth', 'Puya', 'Carlos Alcaraz', 'Pinturas Mata', 'ERFRI'];
        for (const nombreTienda of otrasTiendas) {
            const categoriasGenericas = [
                { tiendaId: tiendaIds[nombreTienda], nombre: 'Productos Generales' },
                { tiendaId: tiendaIds[nombreTienda], nombre: 'Materiales' }
            ];
            for (const cat of categoriasGenericas) {
                await addDoc(collection(this.db, 'categorias'), cat);
            }
        }
    }

    async seedObras() {
        const obras = [
            { nombreComercial: '01.7 Villas | Urb. Peña Blanquilla [Mijas]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '02. Caseta de Ventas El Higueron [Mijas]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '03. Quinta de Sierra Blanca [Marbella]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '04. Gualdalmina 19 [Marbella]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '05. C2 13 Camojan [Marbella]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '06. CC El Rodeo [Marbella]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '07. Los Flamingos 101 [Benahavís]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '08. A2 19 La Zagaleta [Benahavís]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '09. C1 12 La Zagaleta [Benahavís]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '10. C1 14 La Zagaleta [Benahavís]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '11. Caserias del Esperonal | Marbella Country Club [Benahavís]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '12. La Perla [Benahavís]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '13. La Verde Island | Doña Julia [Estepona]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '14. Arroyo Medio [Estepona]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' },
            { nombreComercial: '15. El Taraje Fase 1 [Estepona]', direccionGoogleMaps: '', encargado: '', telefonoEncargado: '' }
        ];

        for (const obra of obras) {
            await addDoc(collection(this.db, 'obras'), obra);
        }
    }

    // Operaciones CRUD genéricas
    async add(storeName, data) {
        const docData = {
            ...data,
            createdAt: serverTimestamp()
        };
        
        // Si es un pedido y tiene fecha como Date, usar serverTimestamp para fecha
        if (storeName === 'pedidos' && data.fecha instanceof Date) {
            docData.fecha = serverTimestamp();
        } else if (storeName === 'pedidos' && !data.fecha) {
            // Si no tiene fecha, usar serverTimestamp
            docData.fecha = serverTimestamp();
        }
        
        const docRef = await addDoc(collection(this.db, storeName), docData);
        return docRef.id;
    }

    async get(storeName, id) {
        const docRef = doc(this.db, storeName, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    }

    async getAll(storeName) {
        const querySnapshot = await getDocs(collection(this.db, storeName));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async update(storeName, data) {
        const { id, ...updateData } = data;
        const docRef = doc(this.db, storeName, id);
        await updateDoc(docRef, {
            ...updateData,
            updatedAt: serverTimestamp()
        });
        return id;
    }

    async delete(storeName, id) {
        const docRef = doc(this.db, storeName, id);
        await deleteDoc(docRef);
    }

    // Métodos específicos
    async getCategoriasByTienda(tiendaId) {
        const q = query(
            collection(this.db, 'categorias'),
            where('tiendaId', '==', tiendaId)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async getProductosByCategoria(categoriaId) {
        const q = query(
            collection(this.db, 'productos'),
            where('categoriaId', '==', categoriaId)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async getProductosByCategoriaPaginated(categoriaId, productosLimit = 5, offset = 0, soloSinSubCategoria = true) {
        // Obtener todos los productos de la categoría
        const q = query(
            collection(this.db, 'productos'),
            where('categoriaId', '==', categoriaId),
            orderBy('nombre')
        );
        const querySnapshot = await getDocs(q);
        
        // Si soloSinSubCategoria es true, filtrar productos sin subcategoría
        // Si es false, mostrar todos los productos de la categoría
        let productosFiltrados = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (soloSinSubCategoria) {
            productosFiltrados = productosFiltrados.filter(p => !p.subCategoriaId);
        }
        
        // Aplicar paginación
        const productos = productosFiltrados.slice(offset, offset + productosLimit);
        const hasMore = offset + productosLimit < productosFiltrados.length;
        
        return {
            productos,
            hasMore,
            total: productosFiltrados.length
        };
    }

    async getProductosBySubCategoriaPaginated(subCategoriaId, productosLimit = 5, offset = 0) {
        const q = query(
            collection(this.db, 'productos'),
            where('subCategoriaId', '==', subCategoriaId),
            orderBy('nombre')
        );
        const querySnapshot = await getDocs(q);
        
        const todosProductos = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Aplicar paginación
        const productos = todosProductos.slice(offset, offset + productosLimit);
        const hasMore = offset + productosLimit < todosProductos.length;
        
        return {
            productos,
            hasMore,
            total: todosProductos.length
        };
    }

    async getSubCategoriasByCategoria(categoriaId) {
        const q = query(
            collection(this.db, 'subcategorias'),
            where('categoriaId', '==', categoriaId)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async deleteAllProductosByTienda(tiendaId) {
        const q = query(
            collection(this.db, 'productos'),
            where('tiendaId', '==', tiendaId)
        );
        const querySnapshot = await getDocs(q);
        
        // Eliminar todos los productos
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        return querySnapshot.docs.length;
    }

    async searchProductos(queryText) {
        const allProductos = await this.getAll('productos');
        const lowerQuery = queryText.toLowerCase();
        return allProductos.filter(producto => 
            producto.nombre?.toLowerCase().includes(lowerQuery) ||
            producto.descripcion?.toLowerCase().includes(lowerQuery) ||
            producto.designacion?.toLowerCase().includes(lowerQuery) ||
            producto.ean?.toLowerCase().includes(lowerQuery) ||
            producto.referencia?.toLowerCase().includes(lowerQuery)
        );
    }

    async getPedidosByUser(userId, obraId) {
        // Firestore requiere índice compuesto para múltiples where + orderBy
        // Por ahora, filtramos en memoria
        const q = query(
            collection(this.db, 'pedidos'),
            where('userId', '==', userId)
        );
        const querySnapshot = await getDocs(q);
        const pedidos = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Filtrar por obra y ordenar
        return pedidos
            .filter(p => p.obraId === obraId)
            .sort((a, b) => {
                const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
                const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
                return fechaB - fechaA;
            });
    }

    async getAllPedidosByUser(userId) {
        // Obtener todos los pedidos del usuario sin filtrar por obra
        const q = query(
            collection(this.db, 'pedidos'),
            where('userId', '==', userId)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async getPedidosByObra(obraId) {
        // Obtener todos los pedidos de una obra específica
        const q = query(
            collection(this.db, 'pedidos'),
            where('obraId', '==', obraId)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async getSolicitudesAnulacionByTienda(tiendaId) {
        const q = query(
            collection(this.db, 'solicitudesAnulacion'),
            where('tiendaId', '==', tiendaId),
            where('estado', '==', 'Pendiente')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async getSolicitudesModificacionByTienda(tiendaId) {
        const q = query(
            collection(this.db, 'solicitudesModificacion'),
            where('tiendaId', '==', tiendaId),
            where('estado', '==', 'Pendiente')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async getPedidosByTienda(tiendaId) {
        try {
            // Intentar con orderBy primero
            const q = query(
                collection(this.db, 'pedidos'),
                where('tiendaId', '==', tiendaId),
                orderBy('fecha', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            // Si falla (por ejemplo, si no hay índice para fecha), intentar sin orderBy
            console.warn('Error al obtener pedidos con orderBy, intentando sin orderBy:', error);
            const q = query(
                collection(this.db, 'pedidos'),
                where('tiendaId', '==', tiendaId)
            );
            const querySnapshot = await getDocs(q);
            const pedidos = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Ordenar manualmente por fecha
            return pedidos.sort((a, b) => {
                const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
                const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
                return fechaB - fechaA;
            });
        }
    }

    async saveSesion(persona, obra) {
        const sesionRef = doc(this.db, 'sesion', 'current');
        await setDoc(sesionRef, {
            persona,
            obra,
            fecha: serverTimestamp()
        });
    }

    async getSesion() {
        try {
            const sesionRef = doc(this.db, 'sesion', 'current');
            const docSnap = await getDoc(sesionRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async clearSesion() {
        try {
            const sesionRef = doc(this.db, 'sesion', 'current');
            await deleteDoc(sesionRef);
        } catch (error) {
            // Ignorar si no existe
        }
    }

    // Métodos para Usuarios
    async getUsuarioByUsername(username) {
        const q = query(
            collection(this.db, 'usuarios'),
            where('username', '==', username)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }
        return null;
    }

    async getUsuariosByTipo(tipo) {
        const q = query(
            collection(this.db, 'usuarios'),
            where('tipo', '==', tipo)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async getAllUsuarios() {
        return await this.getAll('usuarios');
    }

    async crearUsuario(usuarioData) {
        // Verificar que no exista otro administrador si es admin
        if (usuarioData.tipo === 'Administrador') {
            const admins = await this.getUsuariosByTipo('Administrador');
            if (admins.length > 0) {
                throw new Error('Ya existe un usuario administrador');
            }
        }
        // Verificar que no exista otro usuario de contabilidad si es contabilidad
        if (usuarioData.tipo === 'Contabilidad') {
            const contabilidad = await this.getUsuariosByTipo('Contabilidad');
            if (contabilidad.length > 0) {
                throw new Error('Ya existe un usuario de contabilidad');
            }
        }
        // Verificar que el username no esté en uso
        const existing = await this.getUsuarioByUsername(usuarioData.username);
        if (existing) {
            throw new Error('El nombre de usuario ya está en uso');
        }
        return await this.add('usuarios', usuarioData);
    }

    async actualizarUsuario(usuarioData) {
        return await this.update('usuarios', usuarioData);
    }

    async eliminarUsuario(usuarioId) {
        await this.delete('usuarios', usuarioId);
    }

    // Métodos para Obras
    async getAllObras() {
        return await this.getAll('obras');
    }

    async getObra(obraId) {
        return await this.get('obras', obraId);
    }

    async crearObra(obraData) {
        return await this.add('obras', obraData);
    }

    async actualizarObra(obraData) {
        return await this.update('obras', obraData);
    }

    async eliminarObra(obraId) {
        await this.delete('obras', obraId);
    }

    // Métodos para Sesión mejorada
    async saveSesionCompleta(sesionData) {
        const sesionRef = doc(this.db, 'sesion', 'current');
        await setDoc(sesionRef, {
            ...sesionData,
            fecha: serverTimestamp()
        });
    }

    async getSesionCompleta() {
        try {
            const sesionRef = doc(this.db, 'sesion', 'current');
            const docSnap = await getDoc(sesionRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            return null;
        }
    }
}

// Instancia global de la base de datos
const db = new Database();

// Exportar para uso en otros módulos
export { db };
