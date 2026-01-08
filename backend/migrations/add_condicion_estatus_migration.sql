-- =====================================================
-- MIGRACIÓN: Separar estado en condicion y estatus
-- Fecha: 2026-01-08
-- Descripción: Mejora del modelo de herramientas de renta
--              separando condición física del estatus de asignación
-- =====================================================

-- Paso 1: Agregar nuevos campos
ALTER TABLE unidades_herramienta_renta
ADD COLUMN IF NOT EXISTS condicion VARCHAR(20) DEFAULT 'bueno';

ALTER TABLE unidades_herramienta_renta
ADD COLUMN IF NOT EXISTS estatus VARCHAR(20) DEFAULT 'disponible';

-- Agregar constraints CHECK
DO $$
BEGIN
    -- Constraint para condicion
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_condicion_valida'
    ) THEN
        ALTER TABLE unidades_herramienta_renta
        ADD CONSTRAINT check_condicion_valida
        CHECK (condicion IN ('bueno', 'regular', 'malo', 'perdido', 'baja'));
    END IF;
    
    -- Constraint para estatus
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_estatus_valido'
    ) THEN
        ALTER TABLE unidades_herramienta_renta
        ADD CONSTRAINT check_estatus_valido
        CHECK (estatus IN ('disponible', 'asignado', 'en_reparacion', 'en_transito'));
    END IF;
END $$;

-- Paso 2: Migrar datos existentes del campo 'estado' a los nuevos campos
UPDATE unidades_herramienta_renta
SET 
    condicion = CASE
        WHEN estado = 'buen_estado' THEN 'bueno'
        WHEN estado = 'estado_regular' THEN 'regular'
        WHEN estado = 'mal_estado' THEN 'malo'
        WHEN estado = 'perdida' THEN 'perdido'
        WHEN estado = 'baja' THEN 'baja'
        ELSE 'bueno'
    END,
    estatus = CASE
        WHEN estado = 'asignada' THEN 'asignado'
        WHEN estado = 'disponible' THEN 'disponible'
        WHEN estado = 'en_reparacion' THEN 'en_reparacion'
        WHEN estado = 'en_transito' THEN 'en_transito'
        WHEN estado = 'pendiente_devolucion' THEN 'asignado'
        WHEN estado IN ('buen_estado', 'estado_regular', 'mal_estado') THEN 'disponible'
        WHEN estado IN ('perdida', 'baja') THEN 'disponible'
        ELSE 'disponible'
    END
WHERE condicion = 'bueno' AND estatus = 'disponible';

-- Paso 3: Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_unidades_condicion ON unidades_herramienta_renta(condicion);
CREATE INDEX IF NOT EXISTS idx_unidades_estatus ON unidades_herramienta_renta(estatus);
CREATE INDEX IF NOT EXISTS idx_unidades_condicion_estatus ON unidades_herramienta_renta(condicion, estatus);

-- Paso 4: Agregar comentarios para documentación
COMMENT ON COLUMN unidades_herramienta_renta.condicion IS 'Condición física de la herramienta: bueno, regular, malo, perdido, baja';
COMMENT ON COLUMN unidades_herramienta_renta.estatus IS 'Estatus de disponibilidad: disponible, asignado, en_reparacion, en_transito';

-- Nota: El campo 'estado' se mantiene temporalmente para compatibilidad hacia atrás
-- Se puede eliminar en una versión futura con:
-- ALTER TABLE unidades_herramienta_renta DROP COLUMN estado;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
