# 📋 Guía de Migración a Producción - Sistema de Herramientas de Renta

## ⚠️ ADVERTENCIA IMPORTANTE

Esta migración modificará la estructura de la base de datos de producción. Es **CRÍTICO** hacer un backup completo antes de proceder.

---

## 📊 Resumen de Cambios

### Nuevas Tablas
1. **tipos_herramienta_renta** - Tipos de herramientas (ej: Pistola de Pintura, Compresor)
2. **unidades_herramienta_renta** - Unidades individuales de cada herramienta
3. **historial_asignaciones_herramienta** - Historial de asignaciones/devoluciones

### Columnas Modificadas
- **articulos.es_herramienta** - Nueva columna booleana para diferenciar consumibles de herramientas

---

## 🚀 Proceso de Migración (Paso a Paso)

### PASO 0: Preparación (CRÍTICO)

#### 1. Hacer Backup Completo

**En el servidor de producción:**

```bash
# Opción 1: Backup con pg_dump (recomendado)
pg_dump -U postgres -d inventario_3g > backup_$(date +%Y%m%d_%H%M%S).sql

# Opción 2: Backup desde Railway CLI (si usas Railway)
railway run pg_dump -U postgres railway > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Verificar que el backup se creó correctamente:**
```bash
ls -lh backup_*.sql
# Debe mostrar un archivo con tamaño > 0
```

**Guardar el backup en un lugar seguro** (Google Drive, S3, etc.)

#### 2. Clonar el repositorio en el servidor

```bash
cd /ruta/produccion
git pull origin main
```

#### 3. Instalar dependencias (si es necesario)

```bash
cd backend
npm install
```

---

### PASO 1: Verificar Estado Actual

```bash
node scripts/verificar-estado-db.js
```

**Este script mostrará:**
- ✅ Tablas existentes
- ❌ Tablas faltantes
- Estado del campo `es_herramienta` en `articulos`
- Conteo de registros actuales

**Ejemplo de salida esperada ANTES de migrar:**
```
📋 Verificando tablas...
  ✅ usuarios
  ✅ articulos
  ✅ categorias
  ✅ ubicaciones
  ✅ proveedores
  ✅ movimientos
  ✅ pedidos
  ✅ equipos
  ✅ ordenes_compra
  ❌ tipos_herramienta_renta
  ❌ unidades_herramienta_renta
  ❌ historial_asignaciones_herramienta

📋 Verificando columnas críticas...
  ❌ Campo es_herramienta en articulos NO existe

📈 RESUMEN
⚠️  Tablas faltantes:
   - tipos_herramienta_renta
   - unidades_herramienta_renta
   - historial_asignaciones_herramienta
⚠️  Falta agregar campo es_herramienta a articulos
```

---

### PASO 2: Ejecutar Migración

```bash
node scripts/migrar-produccion.js
```

**El script te pedirá confirmaciones de seguridad:**

1. ¿Has hecho un BACKUP? → Escribe `si`
2. ¿Confirmas ejecutar la migración? → Escribe `CONFIRMAR`

**El script ejecutará 4 pasos:**

```
📋 PASO 1/4: Agregando campo es_herramienta a articulos...
✅ Campo es_herramienta agregado correctamente

📋 PASO 2/4: Creando tabla tipos_herramienta_renta...
✅ Tabla tipos_herramienta_renta creada correctamente

📋 PASO 3/4: Creando tabla unidades_herramienta_renta...
✅ Tabla unidades_herramienta_renta creada correctamente

📋 PASO 4/4: Creando tabla historial_asignaciones_herramienta...
✅ Tabla historial_asignaciones_herramienta creada correctamente

🔍 Verificando migración...
📊 RESULTADO DE LA MIGRACIÓN:
  ✅ Tablas de herramientas de renta: 3/3
  ✅ Campo es_herramienta en articulos

✨ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!
```

---

### PASO 3: Verificar Migración Exitosa

```bash
node scripts/verificar-estado-db.js
```

**Salida esperada DESPUÉS de migrar:**
```
📋 Verificando tablas...
  ✅ usuarios
  ✅ articulos
  ✅ categorias
  ✅ ubicaciones
  ✅ tipos_herramienta_renta
  ✅ unidades_herramienta_renta
  ✅ historial_asignaciones_herramienta

📋 Verificando columnas críticas...
  ✅ Campo es_herramienta en articulos existe
     Tipo: boolean

📈 RESUMEN
✅ Todas las tablas necesarias están presentes
```

---

### PASO 4: Reiniciar Aplicación

```bash
# Opción 1: PM2
pm2 restart backend

# Opción 2: Railway (se reinicia automáticamente con el push)
git push railway main

# Opción 3: Systemd
sudo systemctl restart inventario-backend
```

---

### PASO 5: Verificar en la Aplicación

1. **Acceder a la aplicación web**
2. **Ir a Inventario**
3. **Verificar que todo funciona:**
   - ✅ Se muestran los artículos consumibles
   - ✅ Puedes crear nuevos artículos
   - ✅ El sistema no muestra errores en consola

4. **Probar nueva funcionalidad (opcional):**
   - Ir a "Herramientas de Renta"
   - Crear un tipo de herramienta de prueba
   - Verificar que se crean las unidades

---

## 🔄 Plan de Rollback (Si algo sale mal)

### Opción 1: Restaurar Backup Completo

```bash
# Detener la aplicación
pm2 stop backend

# Restaurar backup
psql -U postgres -d inventario_3g < backup_YYYYMMDD_HHMMSS.sql

# Reiniciar aplicación
pm2 start backend
```

### Opción 2: Revertir Cambios Manualmente

```sql
-- Eliminar tablas creadas
DROP TABLE IF EXISTS historial_asignaciones_herramienta CASCADE;
DROP TABLE IF EXISTS unidades_herramienta_renta CASCADE;
DROP TABLE IF EXISTS tipos_herramienta_renta CASCADE;

-- Eliminar columna agregada
ALTER TABLE articulos DROP COLUMN IF EXISTS es_herramienta;
```

---

## 📊 Estructura de las Nuevas Tablas

### tipos_herramienta_renta
```
- id (PK, SERIAL)
- nombre (VARCHAR 200)
- descripcion (TEXT)
- imagen_url (TEXT)
- categoria_id (FK → categorias)
- ubicacion_id (FK → ubicaciones)
- proveedor_id (FK → proveedores)
- precio_unitario (DECIMAL)
- prefijo_codigo (VARCHAR 10) - ej: "PP", "CP"
- total_unidades (INTEGER)
- unidades_disponibles (INTEGER)
- unidades_asignadas (INTEGER)
- articulo_origen_id (FK → articulos)
- activo (BOOLEAN)
- created_at, updated_at
```

### unidades_herramienta_renta
```
- id (PK, SERIAL)
- tipo_herramienta_id (FK → tipos_herramienta_renta)
- codigo_unico (VARCHAR 50, UNIQUE) - ej: "PP-001"
- codigo_ean13 (VARCHAR 13, UNIQUE)
- numero_serie (VARCHAR 100)
- estado (ENUM: disponible, asignada, en_reparacion, perdida, baja)
- usuario_asignado_id (FK → usuarios)
- equipo_asignado_id (FK → equipos)
- fecha_asignacion (TIMESTAMP)
- fecha_adquisicion (TIMESTAMP)
- observaciones (TEXT)
- activo (BOOLEAN)
- created_at, updated_at
```

### historial_asignaciones_herramienta
```
- id (PK, SERIAL)
- unidad_herramienta_id (FK → unidades_herramienta_renta)
- usuario_id (FK → usuarios)
- equipo_id (FK → equipos)
- tipo_movimiento (ENUM: asignacion, devolucion, reparacion, baja)
- fecha_asignacion (TIMESTAMP)
- fecha_devolucion (TIMESTAMP)
- observaciones (TEXT)
- registrado_por_usuario_id (FK → usuarios)
- created_at, updated_at
```

---

## ✅ Checklist Pre-Migración

- [ ] Backup completo realizado
- [ ] Backup verificado (archivo > 0 bytes)
- [ ] Backup guardado en lugar seguro
- [ ] Script `verificar-estado-db.js` ejecutado
- [ ] Estado actual documentado
- [ ] Ventana de mantenimiento programada (opcional)
- [ ] Usuarios notificados (opcional)

## ✅ Checklist Post-Migración

- [ ] Migración completada sin errores
- [ ] Script de verificación ejecutado
- [ ] Todas las tablas creadas
- [ ] Campo `es_herramienta` existe
- [ ] Aplicación reiniciada
- [ ] Aplicación web accesible
- [ ] No hay errores en logs
- [ ] Funcionalidad básica probada
- [ ] Backup de post-migración realizado (opcional)

---

## 🆘 Soporte

Si encuentras problemas durante la migración:

1. **NO PÁNICO** - El backup está ahí
2. Revisa los logs de error
3. Intenta el rollback si es necesario
4. Documenta el error para análisis

---

## 📝 Notas Adicionales

### Tiempo Estimado
- Backup: 2-5 minutos
- Migración: 1-2 minutos
- Verificación: 1 minuto
- **Total: 5-10 minutos**

### Impacto en Producción
- La migración es **no destructiva**
- No se eliminan ni modifican datos existentes
- Solo se agregan nuevas tablas y una columna
- Los artículos existentes mantienen `es_herramienta = false`

### Compatibilidad
- La migración es compatible con PostgreSQL 12+
- No requiere detener la aplicación (pero se recomienda)
- Los datos existentes no se ven afectados

---

## 🎯 Próximos Pasos Después de Migrar

1. **Configurar Herramientas de Renta:**
   - Acceder al módulo de Herramientas de Renta
   - Crear tipos de herramientas
   - Generar unidades individuales

2. **Migrar Artículos Existentes (Opcional):**
   - Si tienes herramientas marcadas como artículos consumibles
   - Puedes migrarlas usando el script de migración de datos

3. **Capacitar Usuarios:**
   - Mostrar cómo usar el nuevo sistema
   - Explicar la diferencia entre consumibles y herramientas

---

**Última actualización:** $(date)
**Versión:** 1.0.0
