-- Migración: Permitir múltiples conteos cíclicos por día
-- Agrega campo 'secuencia' y cambia el índice unique

-- 1. Agregar columna secuencia con default 1
ALTER TABLE conteos_ciclicos ADD COLUMN IF NOT EXISTS secuencia INTEGER NOT NULL DEFAULT 1;

-- 2. Eliminar el índice unique anterior sobre 'fecha'
DROP INDEX IF EXISTS conteos_ciclicos_fecha;

-- 3. Crear nuevo índice unique sobre (fecha, secuencia)
CREATE UNIQUE INDEX IF NOT EXISTS unique_fecha_secuencia ON conteos_ciclicos (fecha, secuencia);
