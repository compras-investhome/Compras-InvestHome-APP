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
    serverTimestamp
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
            throw new Error('Firebase no está configurado. Por favor, configura firebase-config.js con tus credenciales.');
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

    // Operaciones CRUD genéricas
    async add(storeName, data) {
        const docRef = await addDoc(collection(this.db, storeName), {
            ...data,
            createdAt: serverTimestamp()
        });
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

    async searchProductos(queryText) {
        const allProductos = await this.getAll('productos');
        const lowerQuery = queryText.toLowerCase();
        return allProductos.filter(producto => 
            producto.nombre?.toLowerCase().includes(lowerQuery) ||
            producto.descripcion?.toLowerCase().includes(lowerQuery)
        );
    }

    async getPedidosByUser(persona, obra) {
        // Firestore requiere índice compuesto para múltiples where + orderBy
        // Por ahora, filtramos en memoria
        const q = query(
            collection(this.db, 'pedidos'),
            where('persona', '==', persona)
        );
        const querySnapshot = await getDocs(q);
        const pedidos = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Filtrar por obra y ordenar
        return pedidos
            .filter(p => p.obra === obra)
            .sort((a, b) => {
                const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
                const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
                return fechaB - fechaA;
            });
    }

    async getPedidosByTienda(tiendaId) {
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
}

// Instancia global de la base de datos
const db = new Database();

// Exportar para uso en otros módulos
export { db };
