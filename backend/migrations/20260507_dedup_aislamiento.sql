-- Deduplicación de categorías y ubicaciones por almacén
-- Asegura que NO existan dos categorías con (nombre, almacen_id) iguales,
-- ni dos ubicaciones con (codigo, almacen_id) iguales.
-- Para cada grupo de duplicados, mantiene el de menor ID y reasigna las FKs
-- (artículos, tipos_herramienta_renta, equipos, camionetas, movimientos,
-- almacen_categorias) del resto al canónico, antes de eliminar las copias.
-- Idempotente: si no hay duplicados, no hace nada.

DO $$
DECLARE
    rec RECORD;
    canonico_id INTEGER;
BEGIN
    -- =================================================================
    -- CATEGORÍAS DUPLICADAS POR (nombre, almacen_id)
    -- =================================================================
    FOR rec IN
        SELECT nombre, almacen_id, MIN(id) AS canonico, ARRAY_AGG(id ORDER BY id) AS todos_ids
        FROM categorias
        WHERE almacen_id IS NOT NULL
        GROUP BY nombre, almacen_id
        HAVING COUNT(*) > 1
    LOOP
        canonico_id := rec.canonico;

        -- Reasignar artículos
        UPDATE articulos
        SET categoria_id = canonico_id
        WHERE categoria_id = ANY(rec.todos_ids)
            AND categoria_id != canonico_id;

        -- Reasignar tipos de herramienta de renta
        BEGIN
            UPDATE tipos_herramienta_renta
            SET categoria_id = canonico_id
            WHERE categoria_id = ANY(rec.todos_ids)
                AND categoria_id != canonico_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Limpiar tabla pivote
        BEGIN
            DELETE FROM almacen_categorias
            WHERE categoria_id = ANY(rec.todos_ids)
                AND categoria_id != canonico_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Eliminar duplicados
        DELETE FROM categorias
        WHERE id = ANY(rec.todos_ids)
            AND id != canonico_id;

        RAISE NOTICE 'Categoría "%" en almacén %: % duplicados consolidados en id=%',
            rec.nombre, rec.almacen_id, ARRAY_LENGTH(rec.todos_ids, 1) - 1, canonico_id;
    END LOOP;

    -- =================================================================
    -- UBICACIONES DUPLICADAS POR (codigo, almacen_id)
    -- =================================================================
    FOR rec IN
        SELECT codigo, almacen_id, MIN(id) AS canonico, ARRAY_AGG(id ORDER BY id) AS todos_ids
        FROM ubicaciones
        WHERE almacen_id IS NOT NULL
        GROUP BY codigo, almacen_id
        HAVING COUNT(*) > 1
    LOOP
        canonico_id := rec.canonico;

        -- Reasignar artículos
        UPDATE articulos
        SET ubicacion_id = canonico_id
        WHERE ubicacion_id = ANY(rec.todos_ids)
            AND ubicacion_id != canonico_id;

        -- Reasignar tipos de herramienta de renta
        BEGIN
            UPDATE tipos_herramienta_renta
            SET ubicacion_id = canonico_id
            WHERE ubicacion_id = ANY(rec.todos_ids)
                AND ubicacion_id != canonico_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Reasignar equipos
        BEGIN
            UPDATE equipos
            SET almacen_base_id = canonico_id
            WHERE almacen_base_id = ANY(rec.todos_ids)
                AND almacen_base_id != canonico_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Reasignar camionetas
        BEGIN
            UPDATE camionetas
            SET almacen_base_id = canonico_id
            WHERE almacen_base_id = ANY(rec.todos_ids)
                AND almacen_base_id != canonico_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Reasignar movimientos
        BEGIN
            UPDATE movimientos
            SET ubicacion_destino_id = canonico_id
            WHERE ubicacion_destino_id = ANY(rec.todos_ids)
                AND ubicacion_destino_id != canonico_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Eliminar duplicados
        DELETE FROM ubicaciones
        WHERE id = ANY(rec.todos_ids)
            AND id != canonico_id;

        RAISE NOTICE 'Ubicación "%" en almacén %: % duplicados consolidados en id=%',
            rec.codigo, rec.almacen_id, ARRAY_LENGTH(rec.todos_ids, 1) - 1, canonico_id;
    END LOOP;
END $$;

-- Asegurar que el constraint UNIQUE compuesto esté presente (por si la migración inicial falló)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categorias_nombre_almacen_unique') THEN
        ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nombre_key;
        ALTER TABLE categorias ADD CONSTRAINT categorias_nombre_almacen_unique UNIQUE (nombre, almacen_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ubicaciones_codigo_almacen_unique') THEN
        ALTER TABLE ubicaciones DROP CONSTRAINT IF EXISTS ubicaciones_codigo_key;
        ALTER TABLE ubicaciones ADD CONSTRAINT ubicaciones_codigo_almacen_unique UNIQUE (codigo, almacen_id);
    END IF;
END $$;
