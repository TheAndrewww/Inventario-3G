# 🔧 Solución: Error 403 PERMISSION_DENIED en Firebase

## ❌ Error Actual

```
FirebaseError: Installations: Create Installation request failed with error
"403 PERMISSION_DENIED: The caller does not have permission"
```

Este error ocurre porque **Firebase Cloud Messaging API** no está habilitada o tiene restricciones.

---

## ✅ Solución Paso a Paso

### 📋 Opción 1: Habilitar APIs en Google Cloud Console (Recomendado)

Se abrieron automáticamente 2 pestañas en tu navegador. En cada una:

#### Pestaña 1: Firebase Installations API
1. Busca el botón **"ENABLE"** (Habilitar)
2. Haz clic en él
3. Espera 30 segundos a que se active

#### Pestaña 2: FCM Registration API
1. Busca el botón **"ENABLE"** (Habilitar)
2. Haz clic en él
3. Espera 30 segundos a que se active

---

### 📋 Opción 2: Verificar Restricciones de API Key

1. Ve a: https://console.cloud.google.com/apis/credentials?project=inventario-3g-6bdda

2. Busca tu **API Key** (debe ser: `AIzaSyBqhWhFxOUf6npJJPoWInSw8AUH8YyozFI`)

3. Haz clic en el nombre de la API Key

4. En la sección **"API restrictions"**:
   - Si dice **"Restrict key"** → Cambia a **"Don't restrict key"**
   - O asegúrate de que incluya:
     - Firebase Installations API
     - FCM Registration API
     - Firebase Cloud Messaging API

5. **Guarda los cambios**

---

### 📋 Opción 3: Regenerar Configuración de Firebase

Si las opciones anteriores no funcionan, regenera la configuración:

#### 1. Ir a Firebase Console
https://console.firebase.google.com/project/inventario-3g-6bdda/settings/general

#### 2. En "Your apps" → selecciona tu app web

#### 3. Busca la sección "SDK setup and configuration"

#### 4. Copia la configuración actualizada:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "inventario-3g-6bdda",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

#### 5. Actualiza el archivo `.env` del frontend:

```env
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=inventario-3g-6bdda.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=inventario-3g-6bdda
VITE_FIREBASE_STORAGE_BUCKET=inventario-3g-6bdda.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
VITE_FIREBASE_APP_ID=tu-app-id
VITE_FIREBASE_VAPID_KEY=BKZrN6_G7YzkaxZdgR7RXTZ9Z-CEaTn_3Gaiqx5VaFWh_Py28PkNEvPSlgvQz0H8WXOhoqY6qWb_dKTk7It074s
```

---

## 🧪 Verificar que Funciona

### Después de habilitar las APIs (espera 2-3 minutos):

1. **Recarga la página de diagnóstico:**
   ```
   http://localhost:5174/test-notifications.html
   ```

2. **Haz clic nuevamente en "Probar Firebase" (Paso 4)**

3. **Deberías ver:**
   ```
   ✅ Firebase funcionando correctamente
   Token FCM obtenido: [un token largo]
   ```

---

## 🎯 Comandos Rápidos de Verificación

### Verificar si las APIs están habilitadas:

```bash
# 1. Verifica Firebase Installations API
open "https://console.cloud.google.com/apis/api/firebaseinstallations.googleapis.com/metrics?project=inventario-3g-6bdda"

# 2. Verifica FCM Registration API
open "https://console.cloud.google.com/apis/api/fcmregistrations.googleapis.com/metrics?project=inventario-3g-6bdda"
```

Si ves **gráficos de uso** o dice **"API enabled"**, significa que están activas.

---

## ❓ Preguntas Frecuentes

### ¿Por qué tengo este error?

Firebase requiere que ciertas APIs estén habilitadas en Google Cloud Platform. Por defecto, algunas vienen deshabilitadas.

### ¿Esto afectará mi backend?

No, el backend está funcionando perfectamente. Este error solo afecta el frontend (navegador).

### ¿Cuánto tarda en activarse?

Generalmente 30 segundos a 2 minutos después de habilitar la API.

### ¿Debo pagar algo?

No, Firebase Cloud Messaging es **totalmente gratis** para uso ilimitado.

---

## 📞 Siguiente Paso

Una vez que hayas habilitado las APIs, **dime qué resultado ves** al hacer clic en "Probar Firebase" nuevamente, y continuamos desde ahí.
