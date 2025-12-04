// Configuración de Firebase
// IMPORTANTE: Este archivo contiene las credenciales reales de Firebase
// NO subir este archivo al repositorio (está en .gitignore)

// Para obtener estas credenciales:
// 1. Ve a https://console.firebase.google.com/
// 2. Crea un nuevo proyecto o selecciona uno existente
// 3. Ve a Configuración del proyecto (ícono de engranaje)
// 4. En "Tus aplicaciones", haz clic en el ícono web (</>)
// 5. Copia los valores de firebaseConfig y pégalos aquí

// Si no tienes este archivo, copia firebase-config.example.js como firebase-config.js
// y reemplaza los valores de ejemplo con tus credenciales reales.

const firebaseConfig = {
    apiKey: "AIzaSyCiJJs1yGliDeXjNQjFEb4ZbaQEk6WqLjg",
    authDomain: "compras-investhome.firebaseapp.com",
    projectId: "compras-investhome",
    storageBucket: "compras-investhome.firebasestorage.app",
    messagingSenderId: "904947165686",
    appId: "1:904947165686:web:aa503961c7768e05227fd7"
};

// Esta variable será usada por database.js
// Se expone globalmente para que database.js pueda acceder a ella
window.firebaseConfig = firebaseConfig;
