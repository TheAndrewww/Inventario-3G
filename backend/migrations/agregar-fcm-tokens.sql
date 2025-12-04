-- Tabla para guardar tokens FCM de dispositivos
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL UNIQUE,
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  browser VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_usuario_id ON fcm_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON fcm_tokens(fcm_token);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_device_type ON fcm_tokens(device_type);

-- Comentarios en la tabla
COMMENT ON TABLE fcm_tokens IS 'Tokens FCM para notificaciones push en dispositivos móviles y web';
COMMENT ON COLUMN fcm_tokens.fcm_token IS 'Token único de Firebase Cloud Messaging';
COMMENT ON COLUMN fcm_tokens.device_type IS 'Tipo de dispositivo: ios, android o web';
COMMENT ON COLUMN fcm_tokens.browser IS 'Navegador utilizado: chrome, firefox, safari, edge';
COMMENT ON COLUMN fcm_tokens.last_used_at IS 'Última vez que se usó este token';
