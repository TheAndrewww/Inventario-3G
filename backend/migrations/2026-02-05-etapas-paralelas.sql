-- Migración: Etapas Paralelas + Pausar Proyectos
-- Fecha: 2026-02-05
-- Descripción: 
--   1. Agrega columna compras_en_proceso para etapas paralelas
--   2. Agrega columnas pausado, pausado_en, pausado_motivo para congelar proyectos

-- 1. Campo para etapas paralelas (Compras)
ALTER TABLE produccion_proyectos 
ADD COLUMN IF NOT EXISTS compras_en_proceso BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN produccion_proyectos.compras_en_proceso IS 'True si hay órdenes de compra pendientes para este proyecto';

-- 2. Campos para pausar/congelar proyectos
ALTER TABLE produccion_proyectos 
ADD COLUMN IF NOT EXISTS pausado BOOLEAN DEFAULT FALSE;

ALTER TABLE produccion_proyectos 
ADD COLUMN IF NOT EXISTS pausado_en TIMESTAMP;

ALTER TABLE produccion_proyectos 
ADD COLUMN IF NOT EXISTS pausado_motivo TEXT;

COMMENT ON COLUMN produccion_proyectos.pausado IS 'True si el proyecto está pausado/congelado';
COMMENT ON COLUMN produccion_proyectos.pausado_en IS 'Timestamp de cuando se pausó';
COMMENT ON COLUMN produccion_proyectos.pausado_motivo IS 'Motivo de la pausa';

-- Inicializar valores nulos
UPDATE produccion_proyectos 
SET pausado = false 
WHERE pausado IS NULL;

-- Verificación
SELECT 
    column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produccion_proyectos' 
        AND column_name = column_name
    ) THEN '✅ OK' ELSE '❌ FALTA' END as estado
FROM (VALUES 
    ('compras_en_proceso'), 
    ('pausado'), 
    ('pausado_en'), 
    ('pausado_motivo')
) AS cols(column_name);
