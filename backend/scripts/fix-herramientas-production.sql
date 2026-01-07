-- Script para unificar artículos y tipos de herramienta en producción
-- Ejecutar en la base de datos de Railway

-- ============================================
-- 1. Crear artículos faltantes para tipos huérfanos
-- ============================================

DO $$
DECLARE
    tipo_record RECORD;
    next_id INTEGER;
    codigo_ean13 VARCHAR(13);
    base VARCHAR(12);
    digits INTEGER[];
    suma INTEGER;
    check_digit INTEGER;
    nuevo_articulo_id INTEGER;
BEGIN
    -- Buscar tipos sin artículo origen
    FOR tipo_record IN
        SELECT id, nombre, descripcion, categoria_id, ubicacion_id, precio_unitario
        FROM tipos_herramienta_renta
        WHERE articulo_origen_id IS NULL AND activo = true
    LOOP
        RAISE NOTICE 'Procesando tipo: % (ID: %)', tipo_record.nombre, tipo_record.id;

        -- Obtener siguiente ID de artículo
        SELECT nextval('articulos_id_seq'::regclass) INTO next_id;

        -- Generar EAN-13
        base := LPAD(next_id::TEXT, 12, '0');

        -- Convertir a array de dígitos
        digits := ARRAY(SELECT (SUBSTRING(base FROM n FOR 1))::INTEGER FROM generate_series(1, 12) AS n);

        -- Calcular checksum
        suma := 0;
        FOR i IN 1..12 LOOP
            IF MOD(i-1, 2) = 0 THEN
                suma := suma + digits[i];
            ELSE
                suma := suma + (digits[i] * 3);
            END IF;
        END LOOP;

        check_digit := MOD(10 - MOD(suma, 10), 10);
        codigo_ean13 := base || check_digit::TEXT;

        RAISE NOTICE '  Creando artículo con EAN-13: %', codigo_ean13;

        -- Crear artículo
        INSERT INTO articulos (
            codigo_ean13,
            nombre,
            descripcion,
            categoria_id,
            ubicacion_id,
            stock_actual,
            stock_minimo,
            unidad,
            costo_unitario,
            activo,
            es_herramienta,
            created_at,
            updated_at
        ) VALUES (
            codigo_ean13,
            tipo_record.nombre,
            COALESCE(tipo_record.descripcion, 'Artículo generado automáticamente para ' || tipo_record.nombre),
            COALESCE(tipo_record.categoria_id, 12), -- Sin Categoría
            COALESCE(tipo_record.ubicacion_id, 1),
            0,
            0,
            'piezas',
            COALESCE(tipo_record.precio_unitario, 0),
            true,
            true,
            NOW(),
            NOW()
        ) RETURNING id INTO nuevo_articulo_id;

        RAISE NOTICE '  Artículo creado con ID: %', nuevo_articulo_id;

        -- Vincular tipo con artículo
        UPDATE tipos_herramienta_renta
        SET articulo_origen_id = nuevo_articulo_id,
            updated_at = NOW()
        WHERE id = tipo_record.id;

        RAISE NOTICE '  Tipo vinculado al artículo';
    END LOOP;
END $$;

-- ============================================
-- 2. Sincronizar nombres (si hay diferencias)
-- ============================================

UPDATE tipos_herramienta_renta t
SET nombre = a.nombre,
    descripcion = a.descripcion,
    updated_at = NOW()
FROM articulos a
WHERE t.articulo_origen_id = a.id
  AND (t.nombre != a.nombre OR t.descripcion != a.descripcion)
  AND t.activo = true
  AND a.activo = true;

-- ============================================
-- 3. Desactivar tipos con artículos inactivos
-- ============================================

UPDATE tipos_herramienta_renta t
SET activo = false,
    updated_at = NOW()
FROM articulos a
WHERE t.articulo_origen_id = a.id
  AND t.activo = true
  AND a.activo = false;

-- ============================================
-- 4. Verificación final
-- ============================================

SELECT
    COUNT(*) as total_tipos_activos,
    COUNT(articulo_origen_id) as tipos_con_articulo,
    COUNT(*) - COUNT(articulo_origen_id) as tipos_sin_articulo
FROM tipos_herramienta_renta
WHERE activo = true;

-- Mostrar resultados
SELECT
    'CORRECCIÓN COMPLETADA' as resultado,
    COUNT(*) as tipos_procesados
FROM tipos_herramienta_renta
WHERE activo = true;
