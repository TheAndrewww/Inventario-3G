-- Migración: Crear sistema de almacenes independientes
-- Fecha: 2026-03-10
-- Descripción: Crea la tabla almacenes, tabla pivot almacen_categorias,
--              y agrega almacen_id FK a ubicaciones.

-- 1. Crear tabla almacenes
CREATE TABLE IF NOT EXISTS almacenes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Poblar almacenes a partir de los valores DISTINCT existentes en ubicaciones.almacen
INSERT INTO almacenes (nombre, descripcion)
SELECT DISTINCT almacen, CONCAT('Almacén ', almacen, ' (migrado automáticamente)')
FROM ubicaciones
WHERE almacen IS NOT NULL AND almacen != ''
ON CONFLICT (nombre) DO NOTHING;

-- 3. Agregar columna almacen_id a ubicaciones
ALTER TABLE ubicaciones ADD COLUMN IF NOT EXISTS almacen_id INTEGER REFERENCES almacenes(id);

-- 4. Poblar almacen_id en ubicaciones basándose en el campo string almacen
UPDATE ubicaciones u
SET almacen_id = a.id
FROM almacenes a
WHERE u.almacen = a.nombre AND u.almacen_id IS NULL;

-- 5. Crear tabla pivot almacen_categorias (muchos a muchos)
CREATE TABLE IF NOT EXISTS almacen_categorias (
    id SERIAL PRIMARY KEY,
    almacen_id INTEGER NOT NULL REFERENCES almacenes(id) ON DELETE CASCADE,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(almacen_id, categoria_id)
);

-- 6. Asignar todas las categorías existentes a todos los almacenes existentes
-- (para que no se pierdan datos, luego el admin puede ajustar)
INSERT INTO almacen_categorias (almacen_id, categoria_id)
SELECT a.id, c.id
FROM almacenes a
CROSS JOIN categorias c
ON CONFLICT (almacen_id, categoria_id) DO NOTHING;

-- 7. Crear índices
CREATE INDEX IF NOT EXISTS idx_ubicaciones_almacen_id ON ubicaciones(almacen_id);
CREATE INDEX IF NOT EXISTS idx_almacen_categorias_almacen_id ON almacen_categorias(almacen_id);
CREATE INDEX IF NOT EXISTS idx_almacen_categorias_categoria_id ON almacen_categorias(categoria_id);
