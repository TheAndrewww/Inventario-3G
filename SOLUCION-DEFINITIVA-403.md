# 🔥 Solución Definitiva: Error 403 Firebase

## ❌ Error Persistente
```
FirebaseError: Installations: Create Installation request failed with error
"403 PERMISSION_DENIED: The caller does not have permission"
```

Ya probaste:
- ✅ Habilitar Firebase Installations API
- ✅ Habilitar FCM Registration API
- ✅ Quitar restricciones de API key
- ✅ Configuración completa con measurementId

**Pero el error persiste.** Vamos a solucionarlo definitivamente.

---

## 🎯 Solución: Crear Nueva API Key Sin Restricciones

El problema más común es que la API key tiene restricciones invisibles o se creó antes de habilitar las APIs.

### Paso 1: Ve a la Página de Credenciales

Se abrió automáticamente en tu navegador:
- https://console.cloud.google.com/apis/credentials?project=inventario-3g-6bdda

### Paso 2: Crear Nueva API Key

1. Haz clic en **"+ CREATE CREDENTIALS"** (arriba)
2. Selecciona **"API key"**
3. Verás un mensaje: "API key created"
4. **NO CIERRES EL DIÁLOGO** - Copia la nueva API key
5. Haz clic en **"EDIT API KEY"**

### Paso 3: Configurar la Nueva API Key

En la página de edición:

1. **Name:** Ponle un nombre: `Inventario 3G - Web Push`

2. **Application restrictions:** Selecciona **"HTTP referrers (web sites)"**
   - Haz clic en **"ADD AN ITEM"**
   - Agrega: `http://localhost:5174/*`
   - Haz clic en **"ADD AN ITEM"** otra vez
   - Agrega: `http://localhost:5173/*`
   - Haz clic en **"ADD AN ITEM"** otra vez
   - Agrega: `https://*` (para producción)

3. **API restrictions:** Selecciona **"Restrict key"**
   - Marca estas APIs:
     - ✅ Firebase Installations API
     - ✅ FCM Registration API
     - ✅ Firebase Cloud Messaging API
     - ✅ Identity Toolkit API

4. Haz clic en **"SAVE"**

### Paso 4: Actualiza el .env

Copia la nueva API key y actualiza:

```bash
# Edita el archivo .env
nano /Users/andrewww/Documents/Inventario-3G/frontend/.env
```

Cambia:
```env
VITE_FIREBASE_API_KEY=LA_NUEVA_API_KEY_AQUI
```

### Paso 5: Actualiza el Service Worker

```bash
# Edita el service worker
nano /Users/andrewww/Documents/Inventario-3G/frontend/public/firebase-messaging-sw.js
```

Cambia la línea 7:
```javascript
apiKey: "LA_NUEVA_API_KEY_AQUI",
```

### Paso 6: Reinicia Frontend

```bash
# Detener frontend
lsof -ti:5174 | xargs kill -9

# Iniciar frontend
cd /Users/andrewww/Documents/Inventario-3G/frontend
npm run dev
```

### Paso 7: Prueba Nuevamente

1. Abre: http://localhost:5174/test-notifications.html
2. Hard refresh: `Cmd + Shift + R`
3. Ve al Paso 4: **"Probar Firebase"**
4. Haz clic en el botón

---

## 🔍 Verificación Rápida: ¿APIs Realmente Habilitadas?

Abre esta página (se abrió automáticamente):
- https://console.cloud.google.com/apis/api/firebaseinstallations.googleapis.com/metrics

**Deberías ver:**
- ✅ Un gráfico de métricas (aunque esté vacío)
- ✅ Texto que diga "API enabled"

**Si ves:**
- ❌ Botón "ENABLE" → Las APIs NO están habilitadas, habilítalas de nuevo

---

## 🆘 Si NADA Funciona: Alternativa con Token de Servidor

Si después de crear la nueva API key sigue fallando, hay una alternativa:

### Usar Firebase Admin SDK en Backend para Todo

1. El backend ya tiene Firebase Admin funcionando ✅
2. Modificamos el frontend para NO usar Firebase SDK directamente
3. El frontend pide el token FCM al backend
4. El backend genera el token usando Firebase Admin
5. El frontend solo registra el Service Worker

**¿Quieres que implemente esta alternativa?** Es 100% confiable porque el backend ya funciona perfectamente.

---

## 📊 Checklist de Diagnóstico

Antes de crear la nueva API key, verifica:

- [ ] Firebase Installations API está habilitada (métrica visible)
- [ ] FCM Registration API está habilitada
- [ ] Firebase Cloud Messaging API está habilitada
- [ ] Identity Toolkit API está habilitada
- [ ] El proyecto NO tiene restricciones de cuota
- [ ] La facturación está configurada (opcional pero recomendado)

---

**Siguiente paso:** Crear la nueva API key siguiendo el Paso 1-7 arriba.

Si después de esto sigue fallando, te propongo implementar la alternativa del backend.
