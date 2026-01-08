# 🧪 Guía para Probar Notificaciones FCM en Mac

## ✅ Estado del Sistema

- **Backend:** http://localhost:5001 ✓
- **Frontend:** http://localhost:5174 ✓

---

## 📱 Opción 1: Probar en Chrome (Recomendado - Más Fácil)

### Paso 1: Abrir la Aplicación

1. Abre **Google Chrome** en tu Mac
2. Ve a: **http://localhost:5174**
3. Inicia sesión con:
   - Email: `admin@3g.com`
   - Password: `admin123`

### Paso 2: Activar Notificaciones Push

1. En la barra superior, haz clic en el **ícono de campana (🔔)**
2. Haz clic en **"Activar notificaciones"**
3. Chrome te pedirá permiso → Haz clic en **"Permitir"**

![Ejemplo de permiso](https://i.imgur.com/example.png)

### Paso 3: Crear una Orden de Compra (Disparará Notificación)

1. Ve a **Órdenes de Compra** en el menú lateral
2. Haz clic en **"Nueva Orden"**
3. Selecciona:
   - Proveedor: Cualquiera
   - Artículos: Agrega al menos 1 artículo
   - Cantidad: 10
4. Haz clic en **"Crear Orden"**

### Paso 4: Verificar la Notificación

Deberías ver:
1. **Badge rojo** en la campana con el número de notificaciones
2. **Notificación del sistema** en la esquina superior derecha de macOS
3. Al hacer clic en la notificación, te llevará a la página correspondiente

---

## 🍎 Opción 2: Probar en Safari (Requiere Instalación PWA)

⚠️ **Importante:** Safari en macOS solo soporta notificaciones push en PWAs instaladas.

### Paso 1: Instalar como PWA

1. Abre **Safari**
2. Ve a: **http://localhost:5174**
3. En la barra de menú: **Archivo → Añadir a Dock**
4. Dale un nombre: "Inventario 3G"
5. Haz clic en **"Añadir"**

### Paso 2: Abrir la PWA Instalada

1. Busca el ícono **"Inventario 3G"** en tu Dock
2. Haz clic para abrir
3. Inicia sesión normalmente

### Paso 3: Activar Notificaciones

1. Haz clic en el ícono de campana
2. Activa las notificaciones
3. Safari pedirá permiso → **"Permitir"**

### Paso 4: Probar

1. Crea una orden de compra (mismo proceso que en Chrome)
2. Deberías recibir la notificación push

---

## 🧪 Prueba Rápida con Terminal (Para Verificar Backend)

Puedes enviar una notificación de prueba directamente desde la terminal:

```bash
# 1. Obtener token de autenticación
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@3g.com","password":"admin123"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])")

# 2. Registrar token FCM de prueba (simula tu navegador)
curl -X POST http://localhost:5001/api/notificaciones/register-device \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"fcm_token":"test-mac-token-12345","device_type":"web","browser":"Chrome macOS"}'

# 3. Crear orden de compra (esto enviará la notificación FCM)
curl -X POST http://localhost:5001/api/ordenes-compra \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "articulos":[{"articulo_id":105,"cantidad":10,"costo_unitario":2.5}],
    "proveedor_id":1,
    "observaciones":"Prueba FCM desde Mac"
  }'

# 4. Ver logs del backend para confirmar
# Deberías ver: "✅ Notificación FCM enviada..."
```

**Nota:** Este token de prueba será rechazado por Firebase (porque es falso), pero confirma que el backend está intentando enviar la notificación.

---

## 🔍 Cómo Verificar que Funciona

### En el Navegador

1. **Badge de notificaciones:** El número en rojo sobre la campana debe incrementarse
2. **Notificación del sistema:** Debe aparecer en la esquina de macOS
3. **Sonido:** Deberías escuchar el sonido de notificación de macOS
4. **Dropdown:** Al abrir el menú de la campana, debes ver la nueva notificación

### En el Backend (Terminal)

Busca estos mensajes en la consola del backend:

```
✅ Notificación FCM enviada a 1 de 1 dispositivos
```

Si ves:
```
ℹ️ Usuario X no tiene tokens FCM registrados
```
Significa que no activaste las notificaciones en el navegador.

---

## ❌ Solución de Problemas

### "No recibo notificaciones"

**Verifica:**

1. **Permisos del navegador:**
   - Chrome: `chrome://settings/content/notifications`
   - Safari: Preferencias del Sistema → Notificaciones → Safari

2. **No Molestar desactivado:**
   - Asegúrate de que macOS no esté en modo "No Molestar"

3. **Token FCM registrado:**
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@3g.com","password":"admin123"}' \
     | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])")

   curl -s -X GET http://localhost:5001/api/usuarios \
     -H "Authorization: Bearer $TOKEN" \
     | python3 -c "import sys, json; print('Tu usuario ID:', json.load(sys.stdin)['data']['usuarios'][0]['id'])"

   # Luego verifica tokens FCM
   psql inventario3g -c "SELECT * FROM fcm_tokens WHERE usuario_id = 1;"
   ```

4. **Backend corriendo:**
   ```bash
   curl http://localhost:5001/api/auth/login
   # Debe responder, no dar error de conexión
   ```

### "El Service Worker no se registra"

1. Abre las **DevTools** (Cmd + Option + I)
2. Ve a la pestaña **"Application"**
3. En el menú izquierdo: **Service Workers**
4. Deberías ver: `firebase-messaging-sw.js` como **"Activated and running"**

Si no aparece:
- Refresca la página con Cmd + Shift + R (hard refresh)
- Verifica que el archivo exista: `frontend/public/firebase-messaging-sw.js`

---

## 📊 Eventos que Disparan Notificaciones

Estos eventos generan notificaciones automáticamente:

1. **Nueva orden de compra creada** → Notifica a: `compras` y `administrador`
2. **Nuevo pedido creado** → Notifica a: `supervisor` y `administrador`
3. **Pedido aprobado** → Notifica al: `usuario que lo creó`
4. **Pedido rechazado** → Notifica al: `usuario que lo creó`
5. **Solicitud de compra urgente** → Notifica a: `compras` y `administrador`

---

## 🎯 Prueba Completa Paso a Paso

### Test 1: Notificación de Orden de Compra

1. Abre Chrome → http://localhost:5174
2. Login como admin
3. Activa notificaciones (campana)
4. Ve a "Órdenes de Compra"
5. Crea nueva orden
6. **Resultado esperado:**
   - Notificación push de macOS
   - Badge rojo en campana
   - Nueva notificación en el dropdown

### Test 2: Notificación de Pedido

1. Abre segunda ventana de Chrome (Cmd + N)
2. Login como `diseñador@3g.com` / `diseñador123`
3. Activa notificaciones
4. Crea un pedido en "Pedidos"
5. **En la ventana del admin:**
   - Deberías recibir notificación
   - Badge incrementa
6. **Aprueba el pedido como admin**
7. **En la ventana del diseñador:**
   - Diseñador recibe notificación de aprobación

---

## 🚀 ¡Listo para Producción!

Si las notificaciones funcionan en tu Mac local, también funcionarán en:

- ✅ **Android:** Chrome, Firefox, Edge
- ✅ **iOS:** Safari (PWA instalada)
- ✅ **Windows:** Chrome, Firefox, Edge
- ✅ **Linux:** Chrome, Firefox

Para desplegar en producción:
1. Configurar HTTPS (requerido para FCM)
2. Actualizar variables de entorno en servidor
3. Verificar que el dominio esté autorizado en Firebase Console

---

## 📚 Recursos Adicionales

- **Documentación completa:** Ver `NOTIFICACIONES-FCM.md`
- **Debugging:** Revisar logs del backend en la terminal
- **Firebase Console:** https://console.firebase.google.com/project/inventario-3g-6bdda

---

¡Todo listo! Ahora tienes notificaciones push funcionando en tu sistema de inventario. 🎉
