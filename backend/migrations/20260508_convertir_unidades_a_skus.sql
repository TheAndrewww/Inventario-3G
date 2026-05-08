-- Conversión one-shot: cada UnidadHerramientaRenta se vuelve un SKU normal
-- Ubicado en GENERAL del almacén Herramientas, stock_actual=1.
-- Idempotente: si un SKU con el mismo codigo_ean13 (= codigo_unico) ya existe, se salta.

INSERT INTO articulos (
    codigo_ean13,
    codigo_tipo,
    nombre,
    descripcion,
    categoria_id,
    ubicacion_id,
    stock_actual,
    stock_minimo,
    unidad,
    costo_unitario,
    es_herramienta,
    activo,
    created_at,
    updated_at
)
SELECT
    uh.codigo_unico,
    'CODE128',
    th.nombre || ' — ' || uh.codigo_unico,
    CONCAT(
        'Convertido de unidad de renta. Estado original: ', uh.estado::text,
        CASE WHEN uh.numero_serie IS NOT NULL THEN '. Serie: ' || uh.numero_serie ELSE '' END,
        CASE WHEN uh.observaciones IS NOT NULL THEN '. Notas: ' || uh.observaciones ELSE '' END
    ),
    th.categoria_id,
    -- Ubicación GENERAL del almacén Herramientas
    (
        SELECT u.id FROM ubicaciones u
        JOIN almacenes a ON a.id = u.almacen_id
        WHERE a.nombre = 'Herramientas' AND u.codigo = 'GENERAL'
        LIMIT 1
    ),
    CASE
        WHEN uh.estado IN ('baja', 'perdida') THEN 0
        ELSE 1
    END,
    0,
    'piezas',
    0,
    false,  -- ya no usamos es_herramienta
    CASE
        WHEN uh.estado IN ('baja', 'perdida') THEN false
        WHEN uh.activo IS FALSE THEN false
        ELSE true
    END,
    NOW(),
    NOW()
FROM unidades_herramienta_renta uh
JOIN tipos_herramienta_renta th ON th.id = uh.tipo_herramienta_id
WHERE NOT EXISTS (
    SELECT 1 FROM articulos a WHERE a.codigo_ean13 = uh.codigo_unico
);
