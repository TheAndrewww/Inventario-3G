# 📋 Sistema de Cola de Procesamiento Masivo de Imágenes con Gemini

## 🎯 Descripción

Sistema de cola persistente para procesar imágenes de múltiples artículos en background usando Gemini AI. Permite agregar artículos masivamente y ver el progreso en tiempo real.

## ✨ Características

### 1. **Cola Persistente en Base de Datos**
- ✅ Los trabajos se guardan en PostgreSQL
- ✅ Sobrevive a reinicios del servidor
- ✅ Estados: `pending`, `processing`, `completed`, `failed`
- ✅ Sistema de reintentos automáticos (máx 3 intentos)
- ✅ Priorización de trabajos

### 2. **Worker en Background**
- ✅ Procesa artículos uno por uno
- ✅ Se ejecuta automáticamente al iniciar el servidor
- ✅ Verifica la cola cada 10 segundos
- ✅ Logs detallados del progreso

### 3. **API Completa**
- ✅ Agregar múltiples artículos a la cola
- ✅ Ver estado actual (pendientes, procesando, completados, fallidos)
- ✅ Ver artículo que se está procesando actualmente
- ✅ Historial completo con paginación
- ✅ Reintentar artículos fallidos
- ✅ Limpiar cola de trabajos antiguos

## 🚀 Instalación

### Paso 1: Ejecutar Migración

```bash
cd backend
node migrations/run-queue-migration.js
```

Esto creará la tabla `image_processing_queue` con todos los índices necesarios.

### Paso 2: Reiniciar el Servidor

El worker se inicia automáticamente cuando se levanta el servidor:

```bash
cd backend
npm run dev
```

Verás en los logs:
```
🚀 [Cola] Worker de procesamiento de imágenes iniciado
👀 [Cola] Esperando artículos en la cola...
```

## 📡 API Endpoints

### 1. **Agregar Artículos a la Cola (Masivo)**

```http
POST /api/articulos/batch-process-images
Authorization: Bearer {token}
Content-Type: application/json

{
  "articuloIds": [1, 2, 3, 4, 5],
  "prioridad": 0
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "5 artículo(s) agregado(s) a la cola de procesamiento",
  "data": {
    "agregados": 5,
    "omitidos": 0,
    "detalles": {
      "agregados": [
        { "articuloId": 1, "queueId": 1 },
        { "articuloId": 2, "queueId": 2 },
        ...
      ],
      "omitidos": []
    }
  }
}
```

**Notas:**
- Solo agrega artículos que tienen imagen
- No agrega artículos que ya están en la cola (pending o processing)
- Mayor prioridad = se procesa primero

### 2. **Ver Estado de la Cola**

```http
GET /api/articulos/processing-queue/status
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "pendientes": 5,
      "procesando": 1,
      "completados": 10,
      "fallidos": 0,
      "total": 16
    },
    "articuloActual": {
      "id": 5,
      "articulo_id": 12,
      "articulo_nombre": "Tornillo hexagonal 3/8\"",
      "estado": "processing",
      "started_at": "2025-01-20T20:30:00.000Z",
      "intentos": 1,
      "segundos_procesando": 15.5
    }
  }
}
```

### 3. **Ver Historial de la Cola**

```http
GET /api/articulos/processing-queue/history?limit=50&offset=0
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "historial": [
      {
        "id": 1,
        "articulo_id": 12,
        "articulo_nombre": "Tornillo hexagonal 3/8\"",
        "estado": "completed",
        "prioridad": 0,
        "intentos": 1,
        "max_intentos": 3,
        "error_message": null,
        "created_at": "2025-01-20T20:25:00.000Z",
        "started_at": "2025-01-20T20:30:00.000Z",
        "completed_at": "2025-01-20T20:30:15.000Z",
        "duracion_segundos": 15
      },
      ...
    ],
    "limit": 50,
    "offset": 0
  }
}
```

### 4. **Reintentar Artículo Fallido**

```http
POST /api/articulos/processing-queue/5/retry
Authorization: Bearer {token}
```

### 5. **Limpiar Cola (Eliminar Completados Antiguos)**

```http
DELETE /api/articulos/processing-queue/clean?dias=7
Authorization: Bearer {token}
```

Elimina trabajos completados o fallidos con más de 7 días de antigüedad.

## 🧪 Ejemplo de Uso Completo

### Caso: Procesar 20 artículos masivamente

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@3g.com","password":"admin123"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])")

# 2. Obtener IDs de artículos con imagen
ARTICULOS=$(curl -s -X GET "http://localhost:5001/api/articulos?activo=true" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; arts = json.load(sys.stdin)['data']['articulos']; print(','.join([str(a['id']) for a in arts if a.get('imagen_url')])[:20])")

# 3. Agregar a la cola
curl -s -X POST "http://localhost:5001/api/articulos/batch-process-images" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"articuloIds\":[1,2,3,4,5]}" \
  | python3 -m json.tool

# 4. Ver estado en tiempo real
watch -n 2 "curl -s -X GET 'http://localhost:5001/api/articulos/processing-queue/status' \
  -H 'Authorization: Bearer $TOKEN' \
  | python3 -m json.tool"
```

## 📊 Logs del Worker

Cuando el worker está procesando, verás logs como:

```
🔔 [Cola] Hay 5 artículo(s) pendiente(s), iniciando procesamiento...

🔄 [Cola] Procesando artículo 12 - "Tornillo hexagonal 3/8""
   📊 [Cola] Intento 1 de 3
✨ Iniciando procesamiento con Gemini (gemini-2.5-flash-image): existing-image.jpg
   📦 Artículo: Tornillo hexagonal 3/8"
   📝 Prompt generado: Genera una imagen de catálogo profesional...
✅ Respuesta recibida de Gemini
✅ Imagen encontrada en formato inlineData
✅ Imagen procesada exitosamente con Gemini
   🗑️ [Cola] Imagen anterior eliminada
   ☁️ [Cola] Nueva imagen subida a Cloudinary
   ✅ [Cola] Artículo 12 procesado exitosamente

   📊 [Cola] Estado actual:
      ⏳ Pendientes: 4
      ✅ Completados: 1
      ❌ Fallidos: 0
      📈 Total: 5
```

## 🔧 Configuración

### Reintentos Automáticos

Por defecto, cada artículo tiene 3 intentos. Configurar en la migración:

```sql
max_intentos INTEGER DEFAULT 3
```

### Intervalo de Verificación de Cola

El worker verifica cada 10 segundos. Modificar en `imageProcessingWorker.js`:

```javascript
setInterval(async () => {
    // ...
}, 10000); // 10 segundos
```

### Delay Entre Procesamiento

Hay un delay de 2 segundos entre artículos. Modificar en `imageProcessingWorker.js`:

```javascript
setTimeout(procesarCola, 2000); // 2 segundos
```

## 🎨 Estructura de la Base de Datos

### Tabla: `image_processing_queue`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | SERIAL | ID único |
| articulo_id | INTEGER | ID del artículo |
| estado | VARCHAR(20) | `pending`, `processing`, `completed`, `failed` |
| prioridad | INTEGER | Mayor = primero (default: 0) |
| intentos | INTEGER | Intentos realizados |
| max_intentos | INTEGER | Máx. intentos (default: 3) |
| imagen_url_original | TEXT | URL imagen antes de procesar |
| imagen_url_procesada | TEXT | URL imagen procesada |
| articulo_nombre | VARCHAR(255) | Nombre del artículo |
| articulo_descripcion | TEXT | Descripción |
| articulo_unidad | VARCHAR(50) | Unidad |
| error_message | TEXT | Mensaje de error si falla |
| error_stack | TEXT | Stack trace del error |
| created_at | TIMESTAMP | Cuándo se agregó |
| started_at | TIMESTAMP | Cuándo empezó a procesarse |
| completed_at | TIMESTAMP | Cuándo terminó |
| updated_at | TIMESTAMP | Última actualización |

### Índices

- `idx_queue_estado`: Búsqueda rápida por estado
- `idx_queue_articulo_id`: Búsqueda por artículo
- `idx_queue_prioridad`: Ordenamiento por prioridad
- `idx_queue_created_at`: Ordenamiento por fecha

## ⚠️ Consideraciones Importantes

### 1. **Costos de Gemini**

```
gemini-2.5-flash-image: ~$0.04 por imagen
20 artículos = $0.80 USD
100 artículos = $4.00 USD
```

### 2. **Tiempo de Procesamiento**

```
~15-20 segundos por artículo
20 artículos = ~7 minutos
100 artículos = ~35 minutos
```

### 3. **Un Solo Worker**

El sistema procesa **uno por uno** para:
- ✅ Evitar sobrecargar la API de Gemini
- ✅ Evitar rate limits
- ✅ Mejor control de errores
- ✅ Logs más claros

### 4. **Reintentos Automáticos**

Si un artículo falla:
- ✅ Se reintenta automáticamente (máx. 3 veces)
- ✅ Después de 3 fallos, se marca como `failed`
- ✅ Puedes reintentar manualmente con el endpoint `/retry`

### 5. **Persistencia**

- ✅ Si reinicias el servidor, la cola continúa
- ✅ Los trabajos pendientes se procesan al iniciar
- ✅ No se pierde progreso

## 🚦 Estados del Procesamiento

```
pending    → 🟡 En espera de procesamiento
processing → 🔵 Procesando actualmente
completed  → 🟢 Procesado exitosamente
failed     → 🔴 Falló después de 3 intentos
```

## 💡 Casos de Uso

### 1. **Importación Inicial**

Tienes 500 artículos con imágenes sin procesar:

```bash
# Agregar todos a la cola en lotes de 100
for i in {0..4}; do
  START=$((i * 100 + 1))
  END=$((START + 99))
  IDS=$(seq -s ',' $START $END)

  curl -X POST "http://localhost:5001/api/articulos/batch-process-images" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"articuloIds\":[$IDS]}"

  sleep 2
done
```

El worker procesará automáticamente todos durante ~2.5 horas.

### 2. **Reprocesamiento de Categoría**

Quieres mejorar todas las imágenes de tornillos:

```bash
# Obtener IDs de tornillos
TORNILLOS=$(curl -s "http://localhost:5001/api/articulos?categoria_id=1" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys, json; print([a['id'] for a in json.load(sys.stdin)['data']['articulos'] if a.get('imagen_url')])")

# Agregar a cola con prioridad alta
curl -X POST "http://localhost:5001/api/articulos/batch-process-images" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"articuloIds\":$TORNILLOS, \"prioridad\": 10}"
```

### 3. **Monitoreo Nocturno**

Agregar trabajos al final del día y revisar por la mañana:

```bash
# 18:00 - Agregar 100 artículos
curl -X POST "http://localhost:5001/api/articulos/batch-process-images" ...

# 09:00 - Ver resultados
curl -s "http://localhost:5001/api/articulos/processing-queue/status" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## 🎯 Próximos Pasos

Para usar el sistema:

1. ✅ Ejecutar migración
2. ✅ Reiniciar servidor
3. ✅ Crear interfaz frontend
4. ✅ Agregar artículos a la cola
5. ✅ Monitorear progreso

---

**Fecha de implementación:** 2025-01-20
**Versión:** 1.0
**Estado:** ✅ Backend Completo - Frontend Pendiente
