// Configuración de Firebase - ARCHIVO DE EJEMPLO
// Copia este archivo como "firebase-config.js" y reemplaza los valores con tus credenciales reales

// Para obtener estas credenciales:
// 1. Ve a https://console.firebase.google.com/
// 2. Crea un nuevo proyecto o selecciona uno existente
// 3. Ve a Configuración del proyecto (ícono de engranaje)
// 4. En "Tus aplicaciones", haz clic en el ícono web (</>)
// 5. Copia los valores de firebaseConfig

const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

// Esta variable será usada por database.js
window.firebaseConfig = firebaseConfig;

