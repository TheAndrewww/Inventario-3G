# Unificación de Artículos y Tipos de Herramienta

## Problema Detectado

Algunos tipos de herramienta en la base de datos no tenían un artículo origen vinculado (`articulo_origen_id = NULL`), lo que causaba:

- ❌ Herramientas sin imagen en el modal de configuración de camionetas
- ❌ Datos incompletos al buscar herramientas
- ❌ Posibles errores al intentar mostrar información relacionada

## Solución Aplicada (Local)

Se ejecutó el script `fix-herramientas-huerfanas.js` que:

1. ✅ Detectó 1 tipo huérfano: **Pistola de Pintura HVLP** (ID: 4)
2. ✅ Creó automáticamente el artículo origen faltante (ID: 148)
3. ✅ Generó código EAN-13 válido: `0000000001472`
4. ✅ Vinculó el tipo con su artículo origen
5. ✅ Verificó que todos los 37 tipos activos tienen artículo origen

## Ejecutar en Producción (Railway)

### Opción 1: Script SQL (Recomendado)

```bash
# Conectar a la base de datos de Railway
railway run psql $DATABASE_URL -f backend/scripts/fix-herramientas-production.sql
```

O ejecutar directamente desde Railway shell:

```bash
railway shell
psql $DATABASE_URL -f backend/scripts/fix-herramientas-production.sql
```

### Opción 2: Script Node.js

```bash
# Desde Railway
railway run node backend/scripts/fix-herramientas-huerfanas.js
```

## Verificación

Después de ejecutar, verificar que todos los tipos tienen artículo origen:

```sql
SELECT
    COUNT(*) as total_tipos_activos,
    COUNT(articulo_origen_id) as tipos_con_articulo,
    COUNT(*) - COUNT(articulo_origen_id) as tipos_sin_articulo
FROM tipos_herramienta_renta
WHERE activo = true;
```

Resultado esperado:
```
total_tipos_activos | tipos_con_articulo | tipos_sin_articulo
--------------------+--------------------+--------------------
                 37 |                 37 |                  0
```

## Mantenimiento Futuro

Para evitar este problema en el futuro:

1. **Al crear un nuevo tipo de herramienta**, asegurarse de que tenga `articulo_origen_id`
2. **Al actualizar un artículo**, considerar si su tipo de herramienta también debe actualizarse
3. **Al desactivar un artículo**, verificar si el tipo de herramienta asociado debe desactivarse

## Scripts Incluidos

| Script | Descripción |
|--------|-------------|
| `fix-herramientas-huerfanas.js` | Script Node.js con Sequelize (local/development) |
| `fix-herramientas-production.sql` | Script SQL puro (production/Railway) |

## Estado Actual

✅ **Base de datos local:** Unificada correctamente
⚠️ **Base de datos producción:** Pendiente de ejecutar script

---

Generado: 2026-01-07
