-- Migración: Crear tabla campana_control
-- Fecha: 2026-01-23
-- Descripción: Tabla para almacenar el control de campana por área y semana

CREATE TABLE IF NOT EXISTS campana_control (
    id SERIAL PRIMARY KEY,
    quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
    area VARCHAR(50) NOT NULL,
    week INTEGER NOT NULL CHECK (week >= 1 AND week <= 52),
    status VARCHAR(10) CHECK (status IN ('good', 'bad')),
    note TEXT,
    year INTEGER NOT NULL DEFAULT 2026,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_year_quarter_area_week UNIQUE (year, quarter, area, week)
);

-- Índice para búsquedas por año y trimestre
CREATE INDEX IF NOT EXISTS idx_campana_control_year_quarter ON campana_control(year, quarter);

-- Comentarios
COMMENT ON TABLE campana_control IS 'Control de campana por área y semana';
COMMENT ON COLUMN campana_control.quarter IS 'Trimestre (1-4)';
COMMENT ON COLUMN campana_control.area IS 'Área: diseno, manufactura, herreria, equipo1-4';
COMMENT ON COLUMN campana_control.week IS 'Semana del año (1-52)';
COMMENT ON COLUMN campana_control.status IS 'Estado: good (✓) o bad (✗)';
COMMENT ON COLUMN campana_control.note IS 'Nota explicativa';
COMMENT ON COLUMN campana_control.year IS 'Año de la campaña';
