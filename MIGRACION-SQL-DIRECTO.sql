-- ============================================================
-- MIGRACIÓN DIRECTA A PRODUCCIÓN
-- Sistema de Herramientas de Renta
-- ============================================================
-- EJECUTAR EN: Railway → PostgreSQL → Data → Query
-- ============================================================

BEGIN;

-- PASO 1: Agregar campo es_herramienta a articulos
ALTER TABLE articulos
ADD COLUMN IF NOT EXISTS es_herramienta BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_articulos_es_herramienta
ON articulos(es_herramienta);

-- PASO 2: Crear tabla tipos_herramienta_renta
CREATE TABLE IF NOT EXISTS tipos_herramienta_renta (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    imagen_url TEXT,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    proveedor_id INTEGER REFERENCES proveedores(id) ON UPDATE CASCADE ON DELETE SET NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL DEFAULT 0,
    prefijo_codigo VARCHAR(10) NOT NULL,
    total_unidades INTEGER NOT NULL DEFAULT 0,
    unidades_disponibles INTEGER NOT NULL DEFAULT 0,
    unidades_asignadas INTEGER NOT NULL DEFAULT 0,
    articulo_origen_id INTEGER REFERENCES articulos(id) ON UPDATE CASCADE ON DELETE SET NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PASO 3: Crear tabla unidades_herramienta_renta
CREATE TABLE IF NOT EXISTS unidades_herramienta_renta (
    id SERIAL PRIMARY KEY,
    tipo_herramienta_id INTEGER NOT NULL REFERENCES tipos_herramienta_renta(id) ON UPDATE CASCADE ON DELETE CASCADE,
    codigo_unico VARCHAR(50) NOT NULL UNIQUE,
    codigo_ean13 VARCHAR(13) UNIQUE,
    numero_serie VARCHAR(100),
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'asignada', 'en_reparacion', 'perdida', 'baja')),
    usuario_asignado_id INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
    equipo_asignado_id INTEGER REFERENCES equipos(id) ON UPDATE CASCADE ON DELETE SET NULL,
    fecha_asignacion TIMESTAMP,
    fecha_adquisicion TIMESTAMP,
    observaciones TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para unidades_herramienta_renta
CREATE INDEX IF NOT EXISTS idx_unidades_tipo_herramienta
ON unidades_herramienta_renta(tipo_herramienta_id);

CREATE INDEX IF NOT EXISTS idx_unidades_estado
ON unidades_herramienta_renta(estado);

CREATE INDEX IF NOT EXISTS idx_unidades_usuario
ON unidades_herramienta_renta(usuario_asignado_id);

CREATE INDEX IF NOT EXISTS idx_unidades_equipo
ON unidades_herramienta_renta(equipo_asignado_id);

-- PASO 4: Crear tabla historial_asignaciones_herramienta
CREATE TABLE IF NOT EXISTS historial_asignaciones_herramienta (
    id SERIAL PRIMARY KEY,
    unidad_herramienta_id INTEGER NOT NULL REFERENCES unidades_herramienta_renta(id) ON UPDATE CASCADE ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
    equipo_id INTEGER REFERENCES equipos(id) ON UPDATE CASCADE ON DELETE SET NULL,
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('asignacion', 'devolucion', 'reparacion', 'baja')),
    fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_devolucion TIMESTAMP,
    observaciones TEXT,
    registrado_por_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para historial_asignaciones_herramienta
CREATE INDEX IF NOT EXISTS idx_historial_unidad
ON historial_asignaciones_herramienta(unidad_herramienta_id);

CREATE INDEX IF NOT EXISTS idx_historial_usuario
ON historial_asignaciones_herramienta(usuario_id);

CREATE INDEX IF NOT EXISTS idx_historial_equipo
ON historial_asignaciones_herramienta(equipo_id);

COMMIT;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- Ejecuta estas queries para verificar que todo se creó correctamente:

-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN (
    'tipos_herramienta_renta',
    'unidades_herramienta_renta',
    'historial_asignaciones_herramienta'
)
ORDER BY table_name;

-- Verificar columna es_herramienta
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'articulos' AND column_name = 'es_herramienta';

-- Si todo está bien, deberías ver:
-- ✅ 3 tablas (tipos_herramienta_renta, unidades_herramienta_renta, historial_asignaciones_herramienta)
-- ✅ 1 columna (es_herramienta en articulos)
