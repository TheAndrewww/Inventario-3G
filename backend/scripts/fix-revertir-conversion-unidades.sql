-- =============================================================================
-- SCRIPT: Revertir conversión de UnidadHerramientaRenta → SKUs
-- =============================================================================
-- Este script elimina los SKUs individuales creados por la migración
-- 20260508_convertir_unidades_a_skus.sql (commit eccdb35).
--
-- Los SKUs creados por esa migración tienen:
--   descripcion LIKE 'Convertido de unidad de renta%'
--
-- Los artículos originales es_herramienta=true NO se tocan.
-- =============================================================================

BEGIN;

-- 1. Ver cuántos SKUs hay que eliminar (para verificar antes de borrar)
SELECT COUNT(*) AS skus_a_eliminar
FROM articulos
WHERE descripcion LIKE 'Convertido de unidad de renta%';

-- 2. Ver un muestra de los que se van a eliminar
SELECT id, codigo_ean13, nombre, activo
FROM articulos
WHERE descripcion LIKE 'Convertido de unidad de renta%'
ORDER BY nombre
LIMIT 20;

COMMIT;

-- =============================================================================
-- EJECUTAR LA LIMPIEZA (descomentar cuando estés listo)
-- =============================================================================
-- BEGIN;
--
-- DELETE FROM articulos
-- WHERE descripcion LIKE 'Convertido de unidad de renta%';
--
-- -- Verificar que los es_herramienta=true siguen intactos
-- SELECT COUNT(*) AS herramientas_originales_restantes
-- FROM articulos
-- WHERE es_herramienta = true;
--
-- COMMIT;
