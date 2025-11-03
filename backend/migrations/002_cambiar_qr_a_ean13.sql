-- Migración: Cambiar código QR a código EAN-13
-- Fecha: 2025-10-29

-- 1. Renombrar columna codigo_qr a codigo_ean13
ALTER TABLE articulos
RENAME COLUMN codigo_qr TO codigo_ean13;

-- 2. Actualizar datos existentes: convertir ID a código EAN-13 (rellenar con ceros a la izquierda)
-- Esto genera códigos EAN-13 temporales basados en el ID del artículo
UPDATE articulos
SET codigo_ean13 = LPAD(id::text, 13, '0');

-- 3. Modificar tipo de dato a VARCHAR(13)
ALTER TABLE articulos
ALTER COLUMN codigo_ean13 TYPE VARCHAR(13);

-- 4. Actualizar comentario
COMMENT ON COLUMN articulos.codigo_ean13 IS 'Código de barras EAN-13 del artículo (13 dígitos)';
