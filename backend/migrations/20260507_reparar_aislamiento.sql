-- Reparación del aislamiento por almacén
-- Para cada categoría usada por SKUs en un almacén distinto al asignado,
-- crea una copia de la categoría en ese almacén y reasigna los SKUs.
-- Las ubicaciones ya tienen almacen_id directo, no requieren reparación.
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.

DO $$
DECLARE
    rec RECORD;
    nueva_categoria_id INTEGER;
    cuenta_creadas INTEGER := 0;
    cuenta_reasignados INTEGER := 0;
BEGIN
    FOR rec IN
        SELECT DISTINCT
            a.categoria_id AS orig_id,
            u.almacen_id,
            c.nombre,
            c.descripcion,
            c.color,
            c.icono
        FROM articulos a
        INNER JOIN ubicaciones u ON u.id = a.ubicacion_id
        INNER JOIN categorias c ON c.id = a.categoria_id
        WHERE a.activo = true
            AND a.categoria_id IS NOT NULL
            AND u.almacen_id IS NOT NULL
            AND (c.almacen_id IS NULL OR c.almacen_id != u.almacen_id)
    LOOP
        -- Buscar si ya existe una categoría con ese nombre en ese almacén
        SELECT id INTO nueva_categoria_id
        FROM categorias
        WHERE nombre = rec.nombre AND almacen_id = rec.almacen_id
        LIMIT 1;

        IF nueva_categoria_id IS NULL THEN
            -- Crear copia para ese almacén
            INSERT INTO categorias (nombre, descripcion, color, icono, almacen_id, activo, created_at, updated_at)
            VALUES (rec.nombre, rec.descripcion, rec.color, rec.icono, rec.almacen_id, true, NOW(), NOW())
            RETURNING id INTO nueva_categoria_id;
            cuenta_creadas := cuenta_creadas + 1;
        END IF;

        -- Reasignar todos los artículos de ese almacén que usaban la categoría original
        WITH actualizados AS (
            UPDATE articulos
            SET categoria_id = nueva_categoria_id
            WHERE categoria_id = rec.orig_id
                AND ubicacion_id IN (
                    SELECT id FROM ubicaciones WHERE almacen_id = rec.almacen_id
                )
            RETURNING id
        )
        SELECT COUNT(*) INTO cuenta_reasignados FROM actualizados;

        RAISE NOTICE 'Categoría "%" duplicada para almacén % (categoría_id=%, % SKUs reasignados)',
            rec.nombre, rec.almacen_id, nueva_categoria_id, cuenta_reasignados;
    END LOOP;

    RAISE NOTICE '✅ Reparación de aislamiento completada (% categorías creadas)', cuenta_creadas;
END $$;
