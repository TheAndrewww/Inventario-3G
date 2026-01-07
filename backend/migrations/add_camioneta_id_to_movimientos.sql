-- Migración: Agregar campo camioneta_id a la tabla movimientos
-- Fecha: 2026-01-05
-- Descripción: Permite asociar pedidos con camionetas específicas

-- Agregar columna camioneta_id a la tabla movimientos
ALTER TABLE movimientos
ADD COLUMN IF NOT EXISTS camioneta_id INTEGER,
ADD CONSTRAINT fk_movimientos_camioneta
    FOREIGN KEY (camioneta_id)
    REFERENCES camionetas(id)
    ON DELETE SET NULL;

-- Agregar índice para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_movimientos_camioneta_id ON movimientos(camioneta_id);

-- Agregar comentario a la columna
COMMENT ON COLUMN movimientos.camioneta_id IS 'ID de la camioneta asociada al pedido (opcional)';
