# Guía de Firebase Firestore para Compras InvestHome

## 📚 Conceptos Básicos

### Estructura de Datos

Firestore organiza los datos en **Colecciones** y **Documentos**:

```
Firestore
└── Colecciones (como carpetas)
    └── Documentos (como archivos)
        └── Campos (datos)
```

**Ejemplo:**
```
tiendas (colección)
├── abc123 (ID del documento)
│   ├── nombre: "Leroy Merlin"
│   └── icono: "🏪"
└── def456
    ├── nombre: "Wurth"
    └── icono: "🔧"
```

## 🎯 Para Tu Aplicación

### Estructura Actual

1. **Colección: `tiendas`**
   - Campos: `nombre` (string), `icono` (string, opcional)

2. **Colección: `categorias`**
   - Campos: `tiendaId` (string), `nombre` (string)
   - Relación: Cada categoría pertenece a una tienda

3. **Colección: `productos`**
   - Campos: `tiendaId` (string), `categoriaId` (string), `nombre` (string), `descripcion` (string), `precio` (number, opcional)
   - Relación: Cada producto pertenece a una tienda y una categoría

4. **Colección: `pedidos`**
   - Campos: `tiendaId`, `persona`, `obra`, `items` (array), `estado`, `fecha`, `albaran` (opcional)

## ➕ Cómo Añadir Datos Manualmente

### Desde Firebase Console:

1. Ve a https://console.firebase.google.com/
2. Selecciona tu proyecto: **compras-investhome**
3. Ve a **Firestore Database**
4. Haz clic en **"Crear colección"** (si no existe)
5. Nombre de la colección: `tiendas`
6. Haz clic en **"Añadir documento"**
7. ID del documento: Deja en blanco para ID automático, o pon uno personalizado
8. Añade campos:
   - Campo: `nombre`, Tipo: `string`, Valor: `"Leroy Merlin"`
   - Campo: `icono`, Tipo: `string`, Valor: `"🏪"`
9. Haz clic en **"Guardar"**

### Añadir una Categoría:

1. Ve a la colección `categorias`
2. **Añadir documento**
3. Campos:
   - `tiendaId`: El ID de la tienda (ej: `"abc123"`)
   - `nombre`: `"Ferretería"`

### Añadir un Producto:

1. Ve a la colección `productos`
2. **Añadir documento**
3. Campos:
   - `tiendaId`: ID de la tienda
   - `categoriaId`: ID de la categoría
   - `nombre`: `"Tornillo M6x20"`
   - `descripcion`: `"Tornillo de acero inoxidable"`
   - `precio`: `0.15` (tipo: number)

## 🔍 Cómo Encontrar IDs

Para relacionar datos, necesitas los IDs de los documentos:

1. Ve a la colección (ej: `tiendas`)
2. Cada documento tiene un ID único (aparece en la primera columna)
3. Copia ese ID y úsalo en otros documentos

**Ejemplo:**
- Tienda "Leroy Merlin" tiene ID: `abc123`
- Categoría "Ferretería" necesita: `tiendaId: "abc123"`

## 📝 Tipos de Datos en Firestore

- **string**: Texto
- **number**: Números
- **boolean**: true/false
- **timestamp**: Fechas
- **array**: Listas
- **map**: Objetos anidados

## 🔐 Reglas de Seguridad

En **Firestore Database → Reglas**, puedes controlar quién puede leer/escribir:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir todo (solo para desarrollo)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **Para producción**, deberías restringir el acceso con autenticación.

## 🛠️ Operaciones Comunes

### Añadir (Create)
```javascript
await addDoc(collection(db, 'tiendas'), {
    nombre: "Nueva Tienda",
    icono: "🏪"
});
```

### Leer (Read)
```javascript
const snapshot = await getDocs(collection(db, 'tiendas'));
snapshot.forEach((doc) => {
    console.log(doc.id, doc.data());
});
```

### Actualizar (Update)
```javascript
const docRef = doc(db, 'tiendas', 'ID_DEL_DOCUMENTO');
await updateDoc(docRef, {
    nombre: "Nombre Actualizado"
});
```

### Eliminar (Delete)
```javascript
const docRef = doc(db, 'tiendas', 'ID_DEL_DOCUMENTO');
await deleteDoc(docRef);
```

## 🔗 Relaciones entre Colecciones

Firestore **NO tiene relaciones automáticas**. Las relaciones se hacen manualmente con IDs:

```
tiendas → categorias (usando tiendaId)
categorias → productos (usando categoriaId)
```

## 💡 Consejos

1. **IDs automáticos**: Deja que Firestore genere los IDs automáticamente (más seguro)
2. **Nombres consistentes**: Usa los mismos nombres de campos en todos los documentos
3. **IDs como strings**: Los IDs siempre son strings, no números
4. **Backup**: Firestore guarda automáticamente, pero puedes exportar datos desde la consola

## 🚀 Próximos Pasos

1. Añade tus tiendas desde Firebase Console
2. Crea categorías para cada tienda
3. Añade productos a las categorías
4. ¡La aplicación los mostrará automáticamente!

