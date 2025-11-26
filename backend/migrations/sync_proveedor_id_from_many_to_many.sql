-- =============================================
-- Migración: Sincronizar proveedor_id en articulos desde articulos_proveedores
-- Descripción: Actualiza el campo proveedor_id en articulos con el proveedor preferido
--              de la relación many-to-many, para mantener consistencia
-- =============================================

-- ANTES: Ver cuántos artículos NO tienen proveedor_id pero SÍ tienen en many-to-many
SELECT COUNT(*) as articulos_sin_sincronizar
FROM articulos a
INNER JOIN articulos_proveedores ap ON a.id = ap.articulo_id
WHERE a.proveedor_id IS NULL;

-- PASO 1: Actualizar artículos con proveedor PREFERIDO (es_preferido = true)
UPDATE articulos a
SET proveedor_id = ap.proveedor_id
FROM articulos_proveedores ap
WHERE a.id = ap.articulo_id
  AND ap.es_preferido = true
  AND a.proveedor_id IS NULL;

-- Resultado del paso 1
SELECT COUNT(*) as actualizados_con_preferido
FROM articulos a
INNER JOIN articulos_proveedores ap ON a.id = ap.articulo_id
WHERE ap.es_preferido = true
  AND a.proveedor_id = ap.proveedor_id;

-- PASO 2: Para artículos que AÚN no tienen proveedor_id, usar el primero disponible
UPDATE articulos a
SET proveedor_id = (
  SELECT ap2.proveedor_id
  FROM articulos_proveedores ap2
  WHERE ap2.articulo_id = a.id
  ORDER BY ap2.proveedor_id
  LIMIT 1
)
WHERE a.proveedor_id IS NULL
  AND EXISTS (
    SELECT 1 FROM articulos_proveedores ap3
    WHERE ap3.articulo_id = a.id
  );

-- DESPUÉS: Ver resultado final
SELECT COUNT(*) as articulos_sincronizados_total
FROM articulos a
WHERE a.proveedor_id IS NOT NULL;

-- Verificar artículos específicos que se sincronizaron
SELECT
  a.id,
  a.nombre,
  a.proveedor_id as proveedor_sincronizado,
  p.nombre as proveedor_nombre,
  ap.es_preferido
FROM articulos a
INNER JOIN articulos_proveedores ap ON a.id = ap.articulo_id
INNER JOIN proveedores p ON a.proveedor_id = p.id
WHERE a.nombre ILIKE '%lija%'
ORDER BY a.nombre;

-- =============================================
-- Verificación final: Artículos que siguen sin proveedor_id
-- =============================================
SELECT
  a.id,
  a.nombre,
  a.proveedor_id,
  COUNT(ap.proveedor_id) as proveedores_en_many_to_many
FROM articulos a
LEFT JOIN articulos_proveedores ap ON a.id = ap.articulo_id
WHERE a.activo = true
GROUP BY a.id, a.nombre, a.proveedor_id
HAVING a.proveedor_id IS NULL
  AND COUNT(ap.proveedor_id) = 0
ORDER BY a.nombre
LIMIT 20;
