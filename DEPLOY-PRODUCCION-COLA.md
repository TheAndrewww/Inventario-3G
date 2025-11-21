# 🚀 Guía de Deploy a Producción - Sistema de Cola

**Fecha:** 2025-11-21
**Commit:** 72b069d

---

## ✅ Paso 1: Código Subido a GitHub

El código ya fue pusheado a GitHub:
```
Commit: 72b069d
Branch: main
Archivos: 15 files changed, 2930 insertions(+)
```

Railway debería estar desplegando automáticamente.

---

## 🔧 Paso 2: Configurar Variables de Entorno en Railway

### Variables Requeridas:

```bash
GEMINI_API_KEY=tu_clave_de_google_gemini
GEMINI_MODEL=gemini-2.5-flash-image
```

### Cómo Agregar Variables en Railway:

1. **Ir a Railway Dashboard:**
   - https://railway.app/dashboard

2. **Seleccionar el Proyecto:**
   - Click en "Inventario-3G" o tu proyecto backend

3. **Ir a Variables:**
   - Click en la pestaña "Variables"

4. **Agregar Variables:**
   ```
   Variable Name: GEMINI_API_KEY
   Value: [Tu API Key de Google AI Studio]
   ```

   ```
   Variable Name: GEMINI_MODEL
   Value: gemini-2.5-flash-image
   ```

5. **Guardar y Redeploy:**
   - Click en "Add" para cada variable
   - Railway redesplegará automáticamente

### Obtener GEMINI_API_KEY:

1. Ir a: https://aistudio.google.com/app/apikey
2. Click en "Create API Key"
3. Seleccionar proyecto o crear uno nuevo
4. Copiar la clave generada

---

## 🗄️ Paso 3: Ejecutar Migración en Producción

### Opción A: Ejecutar desde Railway CLI

```bash
# Conectarse a Railway
railway link

# Ejecutar migración
railway run node migrations/run-queue-migration.js
```

### Opción B: Ejecutar con DATABASE_URL directamente

```bash
# Obtener DATABASE_URL de Railway
railway variables

# Ejecutar localmente conectándose a producción
DATABASE_URL="postgresql://..." node migrations/run-queue-migration.js
```

### Opción C: Usar el Comando Run de Railway (Recomendado)

1. Ir a Railway Dashboard
2. Click en tu servicio backend
3. Ir a la pestaña "Settings"
4. En "Deploy" → "Custom Start Command", temporalmente cambiar a:
   ```
   node migrations/run-queue-migration.js && node server.js
   ```
5. Guardar y esperar redeploy
6. Una vez ejecutada la migración, revertir a:
   ```
   node server.js
   ```

**Nota:** La migración solo necesita ejecutarse UNA vez.

---

## ✅ Paso 4: Verificar Deploy

### 4.1 Verificar Logs de Railway:

```bash
railway logs
```

Buscar:
```
✅ Conexión a base de datos establecida correctamente
✅ Modelos sincronizados con la base de datos
🚀 [Cola] Worker de procesamiento de imágenes iniciado
   👀 [Cola] Esperando artículos en la cola...
```

### 4.2 Verificar Endpoints:

```bash
# Obtener URL de producción
URL_BACKEND="https://tu-proyecto.railway.app"

# 1. Verificar servidor
curl $URL_BACKEND/

# 2. Login
TOKEN=$(curl -s -X POST $URL_BACKEND/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@3g.com","password":"admin123"}' \
  | jq -r '.data.token')

# 3. Verificar endpoint de estado de cola
curl -s -X GET "$URL_BACKEND/api/articulos/processing-queue/status" \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# Debe devolver:
{
  "success": true,
  "data": {
    "stats": {
      "pendientes": 0,
      "procesando": 0,
      "completados": 0,
      "fallidos": 0,
      "total": 0
    },
    "articuloActual": null
  }
}
```

---

## 🌐 Paso 5: Verificar Frontend en Vercel

### 5.1 Deploy Automático de Vercel:

Vercel debería desplegar automáticamente desde GitHub.

### 5.2 Verificar URL de Producción:

```bash
# Frontend URL
https://inventario-3g.vercel.app

# Página de procesamiento masivo
https://inventario-3g.vercel.app/procesamiento-masivo
```

### 5.3 Probar Funcionalidad:

1. Login con admin@3g.com / admin123
2. Click en "Procesamiento IA" en el menú
3. Seleccionar artículos
4. Click en "Procesar"
5. Ver estado en tiempo real

---

## 🧪 Paso 6: Prueba End-to-End en Producción

### Prueba Completa:

```bash
# 1. Login
TOKEN=$(curl -s -X POST https://tu-backend.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@3g.com","password":"admin123"}' \
  | jq -r '.data.token')

# 2. Listar artículos con imagen
curl -s -X GET "https://tu-backend.railway.app/api/articulos?activo=true" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data.articulos[] | select(.imagen_url != null) | {id, nombre}'

# 3. Agregar artículo a la cola (ejemplo: ID 115)
curl -s -X POST "https://tu-backend.railway.app/api/articulos/batch-process-images" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"articuloIds":[115],"prioridad":0}' \
  | jq

# 4. Ver estado de la cola (repetir cada 5s)
watch -n 5 'curl -s -X GET "https://tu-backend.railway.app/api/articulos/processing-queue/status" \
  -H "Authorization: Bearer $TOKEN" | jq'

# 5. Ver historial cuando termine
curl -s -X GET "https://tu-backend.railway.app/api/articulos/processing-queue/history" \
  -H "Authorization: Bearer $TOKEN" \
  | jq
```

---

## 🔍 Troubleshooting

### Problema 1: Worker no se inicia
**Síntomas:** No se procesan artículos en la cola

**Solución:**
1. Verificar logs: `railway logs`
2. Buscar error: `[Cola] Worker de procesamiento`
3. Verificar que GEMINI_API_KEY esté configurada

### Problema 2: Error "table does not exist"
**Síntomas:** Error al acceder a endpoints de cola

**Solución:**
1. Ejecutar migración en producción (Paso 3)
2. Verificar en logs: `✅ Tabla image_processing_queue creada`

### Problema 3: Error de Gemini API
**Síntomas:** Artículos quedan en estado "failed"

**Solución:**
1. Verificar GEMINI_API_KEY en Railway variables
2. Verificar que la API Key sea válida en Google AI Studio
3. Verificar cuota/límites en Google Cloud Console

### Problema 4: CORS Error en Frontend
**Síntomas:** Frontend no puede conectar con backend

**Solución:**
1. Verificar FRONTEND_URL en Railway:
   ```
   FRONTEND_URL=https://inventario-3g.vercel.app
   ```
2. Verificar en backend/server.js que se agregue a allowedOrigins

---

## 📊 Monitoreo Post-Deploy

### Métricas a Monitorear:

1. **Logs de Worker:**
   ```bash
   railway logs --filter "Cola"
   ```

2. **Estado de la Cola:**
   - Visitar: https://tu-frontend.vercel.app/procesamiento-masivo
   - Ver panel de estadísticas

3. **Costos de Gemini:**
   - Google Cloud Console → APIs & Services → Gemini AI
   - Monitorear uso mensual

4. **Base de Datos:**
   ```sql
   SELECT COUNT(*) FROM image_processing_queue WHERE estado = 'pending';
   SELECT COUNT(*) FROM image_processing_queue WHERE estado = 'failed';
   ```

---

## ✅ Checklist de Deploy

- [x] Código pusheado a GitHub
- [ ] Variables de entorno configuradas en Railway
  - [ ] GEMINI_API_KEY
  - [ ] GEMINI_MODEL
- [ ] Migración ejecutada en producción
- [ ] Worker iniciado correctamente
- [ ] Frontend desplegado en Vercel
- [ ] Prueba end-to-end exitosa
- [ ] Logs verificados
- [ ] Endpoints funcionando

---

## 🎉 Deploy Completado

Una vez completados todos los pasos:

✅ **Backend:** https://tu-proyecto.railway.app
✅ **Frontend:** https://inventario-3g.vercel.app
✅ **Procesamiento IA:** https://inventario-3g.vercel.app/procesamiento-masivo

**Sistema 100% Funcional en Producción! 🚀**

---

## 📞 Soporte

Si hay problemas durante el deploy:

1. Verificar logs de Railway: `railway logs`
2. Verificar logs de Vercel: Vercel Dashboard → Deployments → View Logs
3. Verificar variables de entorno
4. Verificar que la migración se ejecutó

---

**Última actualización:** 2025-11-21
**Versión:** 1.0
**Estado:** Listo para producción
