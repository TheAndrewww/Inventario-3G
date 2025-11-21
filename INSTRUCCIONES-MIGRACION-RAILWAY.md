# 🔧 Instrucciones para Ejecutar Migración en Railway

## Problema Detectado

La tabla `image_processing_queue` NO existe en la base de datos de producción de Railway.

**Error en logs:**
```
error: relation "image_processing_queue" does not exist
```

## Solución: Ejecutar Migración Manualmente

### Opción 1: Modificar Start Command Temporalmente (RECOMENDADO)

1. **Ir a Railway Dashboard:**
   - https://railway.app/dashboard
   - Seleccionar proyecto "Inventario-3G"
   - Seleccionar servicio backend

2. **Ir a Settings → Deploy:**
   - Buscar "Custom Start Command"
   - Cambiar temporalmente de:
     ```
     node server.js
     ```
   - A:
     ```
     node migrations/run-queue-migration.js && node server.js
     ```

3. **Guardar y Redeploy:**
   - Click en "Save"
   - Railway redesplegará automáticamente
   - La migración se ejecutará ANTES de iniciar el servidor

4. **Verificar en Logs:**
   - Ir a "Deployments" → Click en el deployment más reciente
   - Ver logs y buscar:
     ```
     🚀 Iniciando migración de cola de procesamiento de imágenes...
     ✅ Tabla image_processing_queue creada exitosamente
     ✅ Índices creados
     ✅ Triggers configurados
     🚀 Servidor corriendo en http://localhost:5001
     🚀 [Cola] Worker de procesamiento de imágenes iniciado
     ```

5. **Revertir Start Command:**
   - Una vez que veas `✅ Tabla image_processing_queue creada exitosamente`
   - Volver a Settings → Deploy
   - Cambiar de vuelta a:
     ```
     node server.js
     ```
   - Guardar

### Opción 2: Usar Railway CLI con Shell (Alternativa)

```bash
# Conectar a Railway shell
railway shell

# Ejecutar migración
node migrations/run-queue-migration.js

# Salir
exit
```

### Opción 3: Ejecutar SQL Directamente (Manual)

Si las opciones anteriores no funcionan, puedes ejecutar el SQL directamente:

1. Conectarse a la base de datos:
   ```bash
   railway connect PostgreSQL
   ```

2. Copiar y pegar el contenido de:
   ```
   backend/migrations/20250120_create_image_processing_queue.sql
   ```

3. Ejecutar el SQL completo

## Verificación Post-Migración

Una vez ejecutada la migración, verificar que el servidor esté funcionando:

```bash
# Test endpoint
curl https://inventario-3g-production.up.railway.app/

# Debe responder con:
{
  "message": "API Inventario 3G",
  "version": "1.0.0",
  "status": "running",
  ...
}
```

## Estado Actual

- ✅ Código pusheado a GitHub
- ✅ Railway redesplegando automáticamente
- ✅ Variables GEMINI_API_KEY y GEMINI_MODEL configuradas
- ⏳ **PENDIENTE:** Ejecutar migración en producción

## Siguiente Paso

**EJECUTAR LA MIGRACIÓN AHORA USANDO LA OPCIÓN 1**

Una vez completada la migración, el sistema estará 100% funcional en producción.
