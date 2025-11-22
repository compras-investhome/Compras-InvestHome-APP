<<<<<<< HEAD
# Compras InvestHome

Aplicación web para la gestión de compras del departamento de compras de InvestHome.

## Características

- ✅ Sistema de inicio de sesión con selección de persona y obra
- ✅ Gestión de múltiples tiendas de proveedores
- ✅ Categorías y productos por tienda
- ✅ Carrito de compras con productos de múltiples tiendas
- ✅ Sistema de pedidos con estados
- ✅ Visualización de pedidos del usuario
- ✅ Panel de gestión para tiendas
- ✅ Búsqueda de productos
- ✅ Diseño responsive (móvil y PC)
- ✅ Base de datos en la nube (Firebase Firestore) - Puedes añadir/editar datos desde cualquier lugar

## Tecnologías Utilizadas

- HTML5
- CSS3 (con variables CSS y diseño responsive)
- JavaScript (ES6+ con módulos)
- Firebase Firestore (base de datos en la nube)

## Configuración Inicial

### Paso 1: Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Añadir proyecto" o selecciona un proyecto existente
3. Sigue los pasos para crear el proyecto

### Paso 2: Configurar Firestore Database

1. En el panel de Firebase, ve a **Firestore Database**
2. Haz clic en **Crear base de datos**
3. Selecciona **Modo de prueba** (para desarrollo) o **Modo de producción** (para producción)
4. Elige una ubicación para tu base de datos (ej: `europe-west`)
5. Haz clic en **Habilitar**

### Paso 3: Configurar Reglas de Seguridad (IMPORTANTE)

Ve a **Firestore Database** → **Reglas** y configura las siguientes reglas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura y escritura a todos (para desarrollo)
    // ⚠️ En producción, deberías restringir esto con autenticación
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ IMPORTANTE**: Las reglas anteriores permiten acceso completo. Para producción, deberías implementar autenticación y restringir el acceso.

### Paso 4: Obtener credenciales de Firebase

1. En Firebase Console, ve a **Configuración del proyecto** (ícono de engranaje)
2. Desplázate hasta **Tus aplicaciones**
3. Haz clic en el ícono web (`</>`)
4. Registra la app con un nombre (ej: "Compras InvestHome")
5. **Copia el objeto `firebaseConfig`** que aparece

### Paso 5: Configurar la aplicación

1. Abre el archivo `firebase-config.js`
2. Reemplaza los valores con los de tu proyecto Firebase:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
```

### Paso 6: Ejecutar la aplicación

1. **Opción A - Servidor local (recomendado)**:
   ```bash
   # Con Python 3
   python -m http.server 8000
   
   # O con Node.js (http-server)
   npx http-server -p 8000
   ```
   Luego abre: `http://localhost:8000`

2. **Opción B - Abrir directamente**:
   - Abre `index.html` en un navegador moderno
   - ⚠️ Nota: Algunos navegadores pueden bloquear módulos ES6 en archivos locales

## Estructura del Proyecto

```
Compras InvestHome/
├── index.html              # Estructura HTML de la aplicación
├── styles.css              # Estilos CSS responsive
├── firebase-config.js      # Configuración de Firebase (¡NO se sube a GitHub!)
├── firebase-config.example.js  # Plantilla de configuración (sí se sube)
├── database.js             # Sistema de base de datos Firestore
├── app.js                  # Lógica principal de la aplicación
├── .gitignore              # Archivos a ignorar en Git
└── README.md               # Este archivo
```

## Instalación desde GitHub

Si clonas este repositorio:

1. **Clona el repositorio**:
   ```bash
   git clone https://github.com/TU_USUARIO/compras-investhome.git
   cd compras-investhome
   ```

2. **Copia el archivo de ejemplo de configuración**:
   ```bash
   # En Windows (PowerShell)
   Copy-Item firebase-config.example.js firebase-config.js
   
   # En Linux/Mac
   cp firebase-config.example.js firebase-config.js
   ```

3. **Configura Firebase** (ver sección "Configuración Inicial" más arriba)

4. **Ejecuta la aplicación** con un servidor local

## Uso de la Aplicación

### Para Usuarios (Técnicos/Encargados)

1. **Iniciar sesión** con persona y obra
2. **Buscar o navegar** por tiendas
3. **Seleccionar tienda** → Ver categorías
4. **Seleccionar categoría** → Ver productos
5. **Añadir productos** al carrito
6. **Finalizar pedido** desde el carrito
7. **Ver pedidos** en "Mis Pedidos"

### Para Tiendas (Gestión)

1. Acceder desde el **menú hamburguesa** → "Gestión de Tienda"
2. Ver pedidos en dos pestañas:
   - **Pedidos en Curso**: Pedidos activos
   - **Pedidos Cerrados**: Pedidos completados
3. **Cambiar estado** del pedido mediante el desplegable:
   - Nuevo → Preparando → Preparado → En ruta → Entregado → Completado
4. **Adjuntar albarán/factura** cuando el estado es "Entregado"
5. Al marcar como "Completado", el pedido se mueve a "Pedidos Cerrados"

## Gestión de Datos (Añadir/Editar Tiendas, Categorías, Productos)

### Opción 1: Desde Firebase Console (Recomendado)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database**
4. Puedes añadir/editar documentos directamente:
   - **Colección `tiendas`**: Añade nuevas tiendas
   - **Colección `categorias`**: Añade categorías (necesita `tiendaId`)
   - **Colección `productos`**: Añade productos (necesita `categoriaId` y `tiendaId`)

### Opción 2: Desde la aplicación (Futuro)

Puedes añadir un panel de administración en la aplicación para gestionar datos.

### Estructura de Datos

**Tiendas:**
```javascript
{
  nombre: "Nombre de la tienda",
  icono: "🏪" // Opcional
}
```

**Categorías:**
```javascript
{
  tiendaId: "id-de-la-tienda",
  nombre: "Nombre de la categoría"
}
```

**Productos:**
```javascript
{
  tiendaId: "id-de-la-tienda",
  categoriaId: "id-de-la-categoria",
  nombre: "Nombre del producto",
  descripcion: "Descripción del producto",
  precio: 10.99 // Opcional
}
```

## Estados de Pedidos

- **Nuevo**: Pedido recién creado
- **Preparando**: La tienda está preparando el pedido
- **Preparado**: El pedido está listo para enviar
- **En ruta**: El pedido está en camino
- **Entregado**: El pedido ha sido entregado (se puede adjuntar albarán)
- **Completado**: Pedido finalizado (se mueve a cerrados)

## Datos de Ejemplo

La aplicación incluye datos de ejemplo que se crean automáticamente la primera vez que se ejecuta:
- 6 tiendas (Leroy Merlin, Wurth, Puya, Carlos Alcaraz, Pinturas Mata, ERFRI)
- Categorías para cada tienda
- Productos de ejemplo en las categorías

## Almacenamiento

Los datos se almacenan en **Firebase Firestore**, lo que significa:
- ✅ Datos en la nube (accesibles desde cualquier lugar)
- ✅ Sincronización en tiempo real
- ✅ Puedes añadir/editar datos desde Firebase Console
- ✅ Escalable y seguro
- ⚠️ Requiere conexión a internet

## Compatibilidad

- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

## Solución de Problemas

### Error: "Firebase no está configurado"
- Verifica que `firebase-config.js` tenga tus credenciales correctas
- Asegúrate de que el archivo se carga antes que `database.js`

### Error: "Permission denied" en Firestore
- Verifica las reglas de seguridad en Firebase Console
- Asegúrate de que las reglas permitan lectura/escritura

### La aplicación no carga
- Asegúrate de usar un servidor local (no abrir directamente el HTML)
- Verifica la consola del navegador para errores
- Asegúrate de tener conexión a internet

## Seguridad (Producción)

Para producción, deberías:

1. **Implementar autenticación Firebase** para usuarios
2. **Restringir reglas de Firestore** según roles:
   ```javascript
   match /pedidos/{pedidoId} {
     allow read: if request.auth != null;
     allow write: if request.auth != null && 
                     request.resource.data.persona == request.auth.token.email;
   }
   ```
3. **Usar Firebase Hosting** para desplegar la aplicación
4. **Configurar dominios personalizados**

## Despliegue en GitHub

Este proyecto está configurado para subirse a GitHub de forma segura:

- ✅ `firebase-config.js` está en `.gitignore` (NO se subirá)
- ✅ `firebase-config.example.js` es la plantilla (SÍ se sube)
- ✅ Las credenciales reales nunca se exponen

### Pasos para subir a GitHub

1. **Inicializa Git** (si no lo has hecho):
   ```bash
   git init
   ```

2. **Añade todos los archivos**:
   ```bash
   git add .
   ```

3. **Haz tu primer commit**:
   ```bash
   git commit -m "Initial commit: Aplicación de compras InvestHome"
   ```

4. **Crea un repositorio en GitHub** y conéctalo:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git branch -M main
   git push -u origin main
   ```

⚠️ **IMPORTANTE**: Asegúrate de que `firebase-config.js` NO se suba. Verifica con:
```bash
git status
```
Si aparece `firebase-config.js`, NO hagas commit hasta añadirlo al `.gitignore`.

## Licencia

Uso interno de InvestHome.
=======
# compras-investhome
Aplicación web para la gestión de compras del departamento de compras de InvestHome
>>>>>>> f6a61815cfe76aeb865dd295ec54b7e11093d113
