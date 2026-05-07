-- Migración: Aislamiento de categorías y ubicaciones por almacén
-- Cada categoría pertenece a UN almacén. Permite mismo nombre/código en distintos almacenes.
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.

BEGIN;

-- =====================================================================
-- CATEGORÍAS
-- =====================================================================

-- 1. Agregar columna almacen_id (NULL primero para datos existentes)
ALTER TABLE categorias
    ADD COLUMN IF NOT EXISTS almacen_id INTEGER
    REFERENCES almacenes(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. Migrar datos: cada categoría queda asignada al primer almacén
--    con el que está vinculada en almacen_categorias (MIN(almacen_id)).
UPDATE categorias c
SET almacen_id = sub.almacen_id
FROM (
    SELECT categoria_id, MIN(almacen_id) AS almacen_id
    FROM almacen_categorias
    GROUP BY categoria_id
) sub
WHERE c.id = sub.categoria_id
    AND c.almacen_id IS NULL;

-- 3. Categorías sin vínculo previo → primer almacén disponible
UPDATE categorias
SET almacen_id = (SELECT MIN(id) FROM almacenes)
WHERE almacen_id IS NULL
    AND EXISTS (SELECT 1 FROM almacenes);

-- 4. Hacer NOT NULL solo si todas las categorías tienen almacén asignado
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM categorias WHERE almacen_id IS NULL) THEN
        ALTER TABLE categorias ALTER COLUMN almacen_id SET NOT NULL;
    END IF;
END $$;

-- 5. Cambiar UNIQUE global de nombre a UNIQUE compuesto (nombre, almacen_id)
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nombre_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categorias_nombre_almacen_unique'
    ) THEN
        ALTER TABLE categorias
            ADD CONSTRAINT categorias_nombre_almacen_unique UNIQUE (nombre, almacen_id);
    END IF;
END $$;

-- =====================================================================
-- UBICACIONES
-- =====================================================================

-- 1. Cambiar UNIQUE global de codigo a UNIQUE compuesto (codigo, almacen_id)
ALTER TABLE ubicaciones DROP CONSTRAINT IF EXISTS ubicaciones_codigo_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ubicaciones_codigo_almacen_unique'
    ) THEN
        ALTER TABLE ubicaciones
            ADD CONSTRAINT ubicaciones_codigo_almacen_unique UNIQUE (codigo, almacen_id);
    END IF;
END $$;

COMMIT;
