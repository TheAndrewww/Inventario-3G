-- Migración: Crear tabla para cola de procesamiento de imágenes
-- Fecha: 2025-01-20
-- Descripción: Sistema de cola para procesamiento masivo de imágenes con Gemini

-- Tabla principal de la cola
CREATE TABLE IF NOT EXISTS image_processing_queue (
    id SERIAL PRIMARY KEY,
    articulo_id INTEGER NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
    estado VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Estados posibles: 'pending', 'processing', 'completed', 'failed'

    -- Información del procesamiento
    prioridad INTEGER DEFAULT 0,
    -- Prioridad: mayor número = mayor prioridad

    intentos INTEGER DEFAULT 0,
    max_intentos INTEGER DEFAULT 3,

    -- URLs de imágenes
    imagen_url_original TEXT,
    imagen_url_procesada TEXT,

    -- Metadata del artículo en el momento de encolar
    articulo_nombre VARCHAR(255),
    articulo_descripcion TEXT,
    articulo_unidad VARCHAR(50),

    -- Información de errores
    error_message TEXT,
    error_stack TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Índices para búsquedas rápidas
    CONSTRAINT chk_estado CHECK (estado IN ('pending', 'processing', 'completed', 'failed'))
);

-- Índices para optimizar consultas
CREATE INDEX idx_queue_estado ON image_processing_queue(estado);
CREATE INDEX idx_queue_articulo_id ON image_processing_queue(articulo_id);
CREATE INDEX idx_queue_prioridad ON image_processing_queue(prioridad DESC, created_at ASC);
CREATE INDEX idx_queue_created_at ON image_processing_queue(created_at DESC);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER trg_queue_updated_at
    BEFORE UPDATE ON image_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_queue_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE image_processing_queue IS 'Cola de procesamiento de imágenes con Gemini AI';
COMMENT ON COLUMN image_processing_queue.estado IS 'Estado actual: pending, processing, completed, failed';
COMMENT ON COLUMN image_processing_queue.prioridad IS 'Mayor número = mayor prioridad en la cola';
COMMENT ON COLUMN image_processing_queue.intentos IS 'Número de intentos de procesamiento realizados';
COMMENT ON COLUMN image_processing_queue.max_intentos IS 'Máximo de intentos permitidos antes de marcar como failed';
