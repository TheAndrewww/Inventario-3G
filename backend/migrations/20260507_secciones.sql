-- Tabla secciones (CRUD por almacén) y FK seccion_id en articulos
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.

CREATE TABLE IF NOT EXISTS secciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    almacen_id INTEGER NOT NULL REFERENCES almacenes(id) ON UPDATE CASCADE ON DELETE CASCADE,
    activo BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'secciones_nombre_almacen_unique'
    ) THEN
        ALTER TABLE secciones ADD CONSTRAINT secciones_nombre_almacen_unique UNIQUE (nombre, almacen_id);
    END IF;
END $$;

ALTER TABLE articulos
    ADD COLUMN IF NOT EXISTS seccion_id INTEGER
    REFERENCES secciones(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Pre-popular Stock y Extras como secciones por defecto en cada almacén.
-- Idempotente: solo crea las que faltan.
INSERT INTO secciones (nombre, almacen_id, activo, "createdAt", "updatedAt")
SELECT 'Stock', a.id, true, NOW(), NOW()
FROM almacenes a
WHERE NOT EXISTS (
    SELECT 1 FROM secciones s WHERE s.almacen_id = a.id AND s.nombre = 'Stock'
);

INSERT INTO secciones (nombre, almacen_id, activo, "createdAt", "updatedAt")
SELECT 'Extras', a.id, true, NOW(), NOW()
FROM almacenes a
WHERE NOT EXISTS (
    SELECT 1 FROM secciones s WHERE s.almacen_id = a.id AND s.nombre = 'Extras'
);

-- Asignar SKUs sin seccion_id a la sección "Stock" de su almacén.
-- Sólo afecta a artículos con seccion_id NULL — preserva asignaciones existentes.
UPDATE articulos a
SET seccion_id = s.id
FROM ubicaciones u, secciones s
WHERE a.ubicacion_id = u.id
    AND s.almacen_id = u.almacen_id
    AND s.nombre = 'Stock'
    AND a.seccion_id IS NULL;
