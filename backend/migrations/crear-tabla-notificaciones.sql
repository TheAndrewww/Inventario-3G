-- Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
    'solicitud_compra_creada',
    'orden_compra_creada',
    'orden_estado_cambiado',
    'solicitud_urgente',
    'pedido_aprobado',
    'pedido_rechazado',
    'stock_bajo'
  )),
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN DEFAULT FALSE NOT NULL,
  url VARCHAR(500),
  datos_adicionales JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_id ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_created_at ON notificaciones(created_at);

-- Comentario en la tabla
COMMENT ON TABLE notificaciones IS 'Notificaciones del sistema para usuarios';
COMMENT ON COLUMN notificaciones.datos_adicionales IS 'Datos adicionales en formato JSON (IDs, nombres, etc.)';
COMMENT ON COLUMN notificaciones.url IS 'URL para navegar cuando se hace clic en la notificación';
