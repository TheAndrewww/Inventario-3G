-- Tabla secciones (CRUD por almacén) y FK seccion_id en articulos
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.

-- Sequelize tiene underscored: true globalmente, así que las columnas
-- timestamps se nombran created_at y updated_at (snake_case).
CREATE TABLE IF NOT EXISTS secciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    almacen_id INTEGER NOT NULL REFERENCES almacenes(id) ON UPDATE CASCADE ON DELETE CASCADE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Si la tabla ya existía con columnas camelCase (de migración previa rota),
-- renombrarlas a snake_case para alinear con Sequelize underscored: true.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'secciones' AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE secciones RENAME COLUMN "createdAt" TO created_at;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'secciones' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE secciones RENAME COLUMN "updatedAt" TO updated_at;
    END IF;
END $$;

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

-- Índice para acelerar joins/filtros por seccion_id
CREATE INDEX IF NOT EXISTS idx_articulos_seccion_id ON articulos(seccion_id);
CREATE INDEX IF NOT EXISTS idx_secciones_almacen_id ON secciones(almacen_id);

-- NO se pre-poblan secciones por defecto. Cada almacén empieza sin secciones
-- y el administrador las crea desde la UI. Las secciones son INDEPENDIENTES
-- por almacén — no se comparten ni duplican entre almacenes.
