-- Crear almacén entidad "Herramientas" (idempotente)
-- y mover los SKUs es_herramienta=true a una ubicación dentro de él.

-- 1. Crear almacén "Herramientas" si no existe
INSERT INTO almacenes (nombre, descripcion, activo, created_at, updated_at)
SELECT 'Herramientas', 'Almacén de herramientas (antes modo virtual)', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM almacenes WHERE nombre = 'Herramientas');

-- 2. Crear ubicación "GENERAL" dentro del almacén Herramientas si no existe
INSERT INTO ubicaciones (codigo, almacen_id, almacen, descripcion, activo, created_at, updated_at)
SELECT
    'GENERAL',
    a.id,
    'Herramientas',
    'Ubicación por defecto del almacén Herramientas',
    true,
    NOW(),
    NOW()
FROM almacenes a
WHERE a.nombre = 'Herramientas'
    AND NOT EXISTS (
        SELECT 1 FROM ubicaciones u
        WHERE u.almacen_id = a.id AND u.codigo = 'GENERAL'
    );

-- 3. Mover SKUs es_herramienta=true a esa ubicación si no están ya ahí
UPDATE articulos
SET ubicacion_id = (
    SELECT u.id FROM ubicaciones u
    JOIN almacenes a ON a.id = u.almacen_id
    WHERE a.nombre = 'Herramientas' AND u.codigo = 'GENERAL'
    LIMIT 1
)
WHERE es_herramienta = true
    AND ubicacion_id NOT IN (
        SELECT u.id FROM ubicaciones u
        JOIN almacenes a ON a.id = u.almacen_id
        WHERE a.nombre = 'Herramientas'
    );
