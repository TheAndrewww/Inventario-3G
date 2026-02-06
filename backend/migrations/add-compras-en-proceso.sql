-- Agregar columna compras_en_proceso a produccion_proyectos
-- Esta columna indica si hay órdenes de compra pendientes para el proyecto

ALTER TABLE produccion_proyectos 
ADD COLUMN IF NOT EXISTS compras_en_proceso BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN produccion_proyectos.compras_en_proceso IS 'True si hay órdenes de compra pendientes para este proyecto';
