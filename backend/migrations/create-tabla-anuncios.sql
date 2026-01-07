-- =====================================================
-- MIGRACIÓN: Sistema de Anuncios Automáticos con IA
-- Fecha: 2026-01-07
-- Descripción: Tabla para almacenar anuncios generados
--              automáticamente desde el calendario
-- =====================================================

-- Crear tabla de anuncios
CREATE TABLE IF NOT EXISTS anuncios (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  frase TEXT NOT NULL,
  imagen_url TEXT NOT NULL,
  imagen_cloudinary_id VARCHAR(255),
  proyecto_nombre TEXT,
  equipo VARCHAR(50),
  tipo_anuncio VARCHAR(50) DEFAULT 'proyecto',
  activo BOOLEAN DEFAULT true,
  vistas INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_anuncios_fecha ON anuncios(fecha);
CREATE INDEX IF NOT EXISTS idx_anuncios_activo ON anuncios(activo);
CREATE INDEX IF NOT EXISTS idx_anuncios_tipo ON anuncios(tipo_anuncio);
CREATE INDEX IF NOT EXISTS idx_anuncios_fecha_activo ON anuncios(fecha, activo);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_anuncios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_anuncios_updated_at
  BEFORE UPDATE ON anuncios
  FOR EACH ROW
  EXECUTE FUNCTION update_anuncios_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE anuncios IS 'Almacena anuncios generados automáticamente con IA desde el calendario de proyectos';
COMMENT ON COLUMN anuncios.fecha IS 'Fecha del día para el cual se generó el anuncio';
COMMENT ON COLUMN anuncios.frase IS 'Texto/slogan del anuncio';
COMMENT ON COLUMN anuncios.imagen_url IS 'URL de la imagen generada (almacenada en Cloudinary)';
COMMENT ON COLUMN anuncios.imagen_cloudinary_id IS 'ID público de la imagen en Cloudinary';
COMMENT ON COLUMN anuncios.proyecto_nombre IS 'Nombre del proyecto relacionado (del calendario)';
COMMENT ON COLUMN anuncios.equipo IS 'Equipo asignado al proyecto (ej: EQUIPO I, EQUIPO IV)';
COMMENT ON COLUMN anuncios.tipo_anuncio IS 'Tipo: proyecto, promocional, generico';
COMMENT ON COLUMN anuncios.activo IS 'Si el anuncio está activo para mostrar en pantallas';
COMMENT ON COLUMN anuncios.vistas IS 'Contador de veces que se ha mostrado el anuncio';

-- Insertar anuncio genérico por defecto
INSERT INTO anuncios (
  fecha,
  frase,
  imagen_url,
  tipo_anuncio,
  activo
) VALUES (
  CURRENT_DATE,
  '3G VELARIAS - INNOVACIÓN EN TENSOESTRUCTURAS',
  'https://res.cloudinary.com/dd93jrilg/image/upload/v1763171532/logo_web_blanco_j8xeyh.png',
  'generico',
  true
) ON CONFLICT DO NOTHING;

-- Crear vista para anuncios activos del día
CREATE OR REPLACE VIEW anuncios_activos_hoy AS
SELECT
  id,
  fecha,
  frase,
  imagen_url,
  proyecto_nombre,
  equipo,
  tipo_anuncio,
  vistas,
  created_at
FROM anuncios
WHERE activo = true
  AND fecha >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY fecha DESC, created_at DESC;

COMMENT ON VIEW anuncios_activos_hoy IS 'Vista de anuncios activos de los últimos 7 días';

-- Función para incrementar contador de vistas
CREATE OR REPLACE FUNCTION incrementar_vistas_anuncio(anuncio_id INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE anuncios
  SET vistas = vistas + 1
  WHERE id = anuncio_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION incrementar_vistas_anuncio IS 'Incrementa el contador de vistas de un anuncio';

-- Función para obtener anuncios del día actual
CREATE OR REPLACE FUNCTION obtener_anuncios_dia_actual()
RETURNS TABLE (
  id INTEGER,
  frase TEXT,
  imagen_url TEXT,
  proyecto_nombre TEXT,
  equipo VARCHAR(50),
  tipo_anuncio VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.frase,
    a.imagen_url,
    a.proyecto_nombre,
    a.equipo,
    a.tipo_anuncio
  FROM anuncios a
  WHERE a.activo = true
    AND a.fecha = CURRENT_DATE
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_anuncios_dia_actual IS 'Obtiene todos los anuncios activos del día actual';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
