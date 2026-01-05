-- Migración: Renombrar sistema de Equipos → Camionetas
-- Autor: Claude Code
-- Fecha: 2026-01-05
-- Descripción: Convierte el sistema de equipos en un sistema de camionetas con stock mínimo configurable

BEGIN;

-- ========================================
-- PASO 1: Renombrar tabla equipos → camionetas
-- ========================================

-- Renombrar la tabla
ALTER TABLE equipos RENAME TO camionetas;

-- Renombrar columna supervisor_id → encargado_id
ALTER TABLE camionetas
RENAME COLUMN supervisor_id TO encargado_id;

-- Agregar nuevos campos a camionetas
ALTER TABLE camionetas
ADD COLUMN matricula VARCHAR(50) UNIQUE,
ADD COLUMN tipo_camioneta VARCHAR(50) DEFAULT 'general' CHECK (tipo_camioneta IN ('instalacion', 'mantenimiento', 'supervision', 'general')),
ADD COLUMN almacen_base_id INTEGER REFERENCES ubicaciones(id);

-- Actualizar timestamps existentes si no existen
ALTER TABLE camionetas
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Actualizar comentarios
COMMENT ON TABLE camionetas IS 'Camionetas/vehículos de la empresa con stock asignado';
COMMENT ON COLUMN camionetas.encargado_id IS 'Encargado responsable de la camioneta';
COMMENT ON COLUMN camionetas.matricula IS 'Matrícula o placa del vehículo';
COMMENT ON COLUMN camionetas.tipo_camioneta IS 'Tipo de trabajo que realiza: instalacion, mantenimiento, supervision, general';
COMMENT ON COLUMN camionetas.almacen_base_id IS 'Almacén base donde se estaciona la camioneta';

-- ========================================
-- PASO 2: Crear tabla stock_minimo_camioneta
-- ========================================

CREATE TABLE IF NOT EXISTS stock_minimo_camioneta (
    id SERIAL PRIMARY KEY,
    camioneta_id INTEGER NOT NULL REFERENCES camionetas(id) ON DELETE CASCADE,
    tipo_herramienta_id INTEGER NOT NULL REFERENCES tipos_herramienta_renta(id) ON DELETE CASCADE,
    cantidad_minima INTEGER NOT NULL DEFAULT 1 CHECK (cantidad_minima > 0),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (camioneta_id, tipo_herramienta_id)
);

COMMENT ON TABLE stock_minimo_camioneta IS 'Stock mínimo de herramientas que debe tener cada camioneta';
COMMENT ON COLUMN stock_minimo_camioneta.cantidad_minima IS 'Cantidad mínima de unidades de este tipo que deben estar en la camioneta';

-- Índices para mejor rendimiento
CREATE INDEX idx_stock_minimo_camioneta_camioneta ON stock_minimo_camioneta(camioneta_id);
CREATE INDEX idx_stock_minimo_camioneta_tipo ON stock_minimo_camioneta(tipo_herramienta_id);

-- ========================================
-- PASO 3: Actualizar tabla UnidadHerramientaRenta
-- ========================================

-- Agregar campo para ubicación actual de la unidad
ALTER TABLE unidades_herramienta_renta
ADD COLUMN IF NOT EXISTS ubicacion_actual VARCHAR(50) DEFAULT 'almacen' CHECK (ubicacion_actual IN ('almacen', 'camioneta', 'empleado', 'asignada')),
ADD COLUMN IF NOT EXISTS camioneta_id INTEGER REFERENCES camionetas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS empleado_propietario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;

COMMENT ON COLUMN unidades_herramienta_renta.ubicacion_actual IS 'Ubicación actual de la unidad: almacen, camioneta, empleado, asignada';
COMMENT ON COLUMN unidades_herramienta_renta.camioneta_id IS 'ID de la camioneta donde está ubicada (si aplica)';
COMMENT ON COLUMN unidades_herramienta_renta.empleado_propietario_id IS 'ID del empleado propietario de la herramienta personal (si aplica)';

-- Índices
CREATE INDEX IF NOT EXISTS idx_unidades_ubicacion_actual ON unidades_herramienta_renta(ubicacion_actual);
CREATE INDEX IF NOT EXISTS idx_unidades_camioneta ON unidades_herramienta_renta(camioneta_id);
CREATE INDEX IF NOT EXISTS idx_unidades_empleado_propietario ON unidades_herramienta_renta(empleado_propietario_id);

-- ========================================
-- PASO 4: Actualizar referencias en otras tablas
-- ========================================

-- Actualizar historial_asignaciones_herramienta para mantener compatibilidad
-- La columna equipo_id se mantiene pero ahora referencia a camionetas
ALTER TABLE historial_asignaciones_herramienta
DROP CONSTRAINT IF EXISTS historial_asignaciones_her_equipo_id_0a93fee1_fk_equipos_id,
ADD CONSTRAINT historial_asignaciones_her_camioneta_id_fk
    FOREIGN KEY (equipo_id) REFERENCES camionetas(id) ON DELETE SET NULL;

COMMENT ON COLUMN historial_asignaciones_herramienta.equipo_id IS 'Referencia a camioneta (antes equipo)';

-- Actualizar movimientos para mantener compatibilidad
-- La columna equipo_id se mantiene pero ahora referencia a camionetas
ALTER TABLE movimientos
DROP CONSTRAINT IF EXISTS movimientos_equipo_id_fkey,
ADD CONSTRAINT movimientos_camioneta_id_fk
    FOREIGN KEY (equipo_id) REFERENCES camionetas(id) ON DELETE SET NULL;

COMMENT ON COLUMN movimientos.equipo_id IS 'Referencia a camioneta (antes equipo) - se mantiene por compatibilidad';

-- ========================================
-- PASO 5: Actualizar secuencias
-- ========================================

-- Actualizar la secuencia si existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'equipos_id_seq') THEN
        ALTER SEQUENCE equipos_id_seq RENAME TO camionetas_id_seq;
    END IF;
END $$;

-- ========================================
-- PASO 6: Grants y permisos (opcional, ajustar según tu configuración)
-- ========================================

-- Los grants se heredan del rename, pero puedes agregar explícitamente si es necesario
-- GRANT SELECT, INSERT, UPDATE, DELETE ON camionetas TO tu_usuario;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON stock_minimo_camioneta TO tu_usuario;

COMMIT;

-- ========================================
-- Verificación post-migración
-- ========================================

-- Ejecutar estas queries para verificar que todo está correcto:
-- SELECT * FROM camionetas LIMIT 5;
-- SELECT * FROM stock_minimo_camioneta LIMIT 5;
-- SELECT COUNT(*) as total_camionetas FROM camionetas;
-- SELECT ubicacion_actual, COUNT(*) FROM unidades_herramienta_renta GROUP BY ubicacion_actual;
