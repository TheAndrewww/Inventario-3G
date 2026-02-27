-- Migración: Crear tabla rollos_membrana
-- Almacena rollos individuales de membrana/malla con metraje lineal

-- Crear el tipo ENUM para estado
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_rollos_membrana_estado') THEN
        CREATE TYPE "enum_rollos_membrana_estado" AS ENUM ('disponible', 'en_uso', 'agotado');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS rollos_membrana (
    id SERIAL PRIMARY KEY,
    articulo_id INTEGER NOT NULL REFERENCES articulos(id),
    identificador VARCHAR(100) NOT NULL UNIQUE,
    metraje_total DECIMAL(10, 2) NOT NULL CHECK (metraje_total >= 0),
    metraje_restante DECIMAL(10, 2) NOT NULL CHECK (metraje_restante >= 0),
    color VARCHAR(100),
    estado "enum_rollos_membrana_estado" NOT NULL DEFAULT 'disponible',
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    observaciones TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollos_membrana_articulo_id ON rollos_membrana(articulo_id);
CREATE INDEX IF NOT EXISTS idx_rollos_membrana_identificador ON rollos_membrana(identificador);
CREATE INDEX IF NOT EXISTS idx_rollos_membrana_estado ON rollos_membrana(estado);
CREATE INDEX IF NOT EXISTS idx_rollos_membrana_activo ON rollos_membrana(activo);
