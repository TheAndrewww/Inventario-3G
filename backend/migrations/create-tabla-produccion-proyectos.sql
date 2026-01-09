-- Migración: Crear tabla produccion_proyectos
-- Fecha: 2026-01-08

CREATE TABLE IF NOT EXISTS produccion_proyectos (
    id SERIAL PRIMARY KEY,
    
    -- Datos del proyecto
    nombre VARCHAR(200) NOT NULL,
    cliente VARCHAR(200),
    descripcion TEXT,
    
    -- Prioridad y fechas
    prioridad INTEGER NOT NULL DEFAULT 3 CHECK (prioridad >= 1 AND prioridad <= 5),
    fecha_entrada DATE,
    fecha_limite DATE,
    fecha_completado DATE,
    
    -- Etapa actual
    etapa_actual VARCHAR(20) NOT NULL DEFAULT 'diseno' 
        CHECK (etapa_actual IN ('pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado')),
    
    -- Tracking de etapas completadas
    diseno_completado_en TIMESTAMP,
    diseno_completado_por INTEGER REFERENCES usuarios(id),
    
    compras_completado_en TIMESTAMP,
    compras_completado_por INTEGER REFERENCES usuarios(id),
    
    produccion_completado_en TIMESTAMP,
    produccion_completado_por INTEGER REFERENCES usuarios(id),
    
    instalacion_completado_en TIMESTAMP,
    instalacion_completado_por INTEGER REFERENCES usuarios(id),
    
    -- Referencia externa
    spreadsheet_row_id VARCHAR(50) UNIQUE,
    
    -- Observaciones por etapa
    observaciones_diseno TEXT,
    observaciones_compras TEXT,
    observaciones_produccion TEXT,
    observaciones_instalacion TEXT,
    
    -- Tipo de proyecto (para color de cards)
    tipo_proyecto VARCHAR(20),
    
    -- Estado general
    activo BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agregar columna tipo_proyecto si no existe (para tablas existentes)
ALTER TABLE produccion_proyectos ADD COLUMN IF NOT EXISTS tipo_proyecto VARCHAR(20);

-- Índices
CREATE INDEX IF NOT EXISTS idx_produccion_etapa ON produccion_proyectos(etapa_actual);
CREATE INDEX IF NOT EXISTS idx_produccion_prioridad ON produccion_proyectos(prioridad);
CREATE INDEX IF NOT EXISTS idx_produccion_activo ON produccion_proyectos(activo);
CREATE INDEX IF NOT EXISTS idx_produccion_fecha_limite ON produccion_proyectos(fecha_limite);

-- Insertar algunos proyectos de ejemplo
INSERT INTO produccion_proyectos (nombre, cliente, prioridad, fecha_limite, etapa_actual) VALUES
('Velaria Residencial García', 'Familia García', 2, CURRENT_DATE + INTERVAL '15 days', 'diseno'),
('Toldo Comercial Plaza Norte', 'Centro Comercial Plaza Norte', 1, CURRENT_DATE + INTERVAL '5 days', 'compras'),
('Proyecto Nave Industrial ABC', 'Industrias ABC', 3, CURRENT_DATE + INTERVAL '30 days', 'diseno')
ON CONFLICT DO NOTHING;
