-- =============================================
-- Migración: Agregar campo proveedor_id a solicitudes_compra
-- Descripción: Permite guardar el proveedor sugerido en cada solicitud de compra
-- =============================================

-- 1. Agregar columna proveedor_id a la tabla solicitudes_compra
ALTER TABLE solicitudes_compra
ADD COLUMN IF NOT EXISTS proveedor_id INTEGER;

-- 2. Agregar constraint de foreign key con proveedor
ALTER TABLE solicitudes_compra
ADD CONSTRAINT fk_solicitud_compra_proveedor
FOREIGN KEY (proveedor_id)
REFERENCES proveedores(id)
ON DELETE SET NULL;

-- 3. Agregar comentario a la columna
COMMENT ON COLUMN solicitudes_compra.proveedor_id IS 'Proveedor sugerido para esta solicitud (puede ser NULL si no se detectó)';

-- 4. Crear índice para mejorar consultas por proveedor
CREATE INDEX IF NOT EXISTS idx_solicitudes_compra_proveedor_id
ON solicitudes_compra(proveedor_id);

-- =============================================
-- Datos de ejemplo / actualización opcional
-- =============================================

-- Actualizar solicitudes existentes que tengan artículos con proveedor directo
UPDATE solicitudes_compra sc
SET proveedor_id = a.proveedor_id
FROM articulos a
WHERE sc.articulo_id = a.id
  AND a.proveedor_id IS NOT NULL
  AND sc.proveedor_id IS NULL;

-- Actualizar solicitudes existentes usando el proveedor preferido de la relación many-to-many
UPDATE solicitudes_compra sc
SET proveedor_id = ap.proveedor_id
FROM articulo_proveedor ap
WHERE sc.articulo_id = ap.articulo_id
  AND ap.es_preferido = true
  AND sc.proveedor_id IS NULL;

-- Si no hay proveedor preferido, usar el primero disponible
UPDATE solicitudes_compra sc
SET proveedor_id = (
  SELECT ap.proveedor_id
  FROM articulo_proveedor ap
  WHERE ap.articulo_id = sc.articulo_id
  LIMIT 1
)
WHERE sc.proveedor_id IS NULL
  AND EXISTS (
    SELECT 1 FROM articulo_proveedor ap2
    WHERE ap2.articulo_id = sc.articulo_id
  );

-- =============================================
-- Verificación
-- =============================================

-- Consulta para verificar solicitudes con proveedor asignado
SELECT
  sc.id,
  sc.ticket_id,
  a.nombre as articulo,
  p.nombre as proveedor,
  sc.estado
FROM solicitudes_compra sc
JOIN articulos a ON sc.articulo_id = a.id
LEFT JOIN proveedores p ON sc.proveedor_id = p.id
ORDER BY sc.created_at DESC
LIMIT 10;
