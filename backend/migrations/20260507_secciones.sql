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
