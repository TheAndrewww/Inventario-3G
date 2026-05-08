import { sequelize } from '../config/database.js';

/**
 * POST /api/admin/deshacer-conversion-unidades
 * Elimina los SKUs creados por la migración 20260508_convertir_unidades_a_skus.
 * Identifica por descripción que comienza con "Convertido de unidad de renta".
 * Solo afecta a esos SKUs; los originales (es_herramienta=true con stock=N) NO se tocan.
 */
export const deshacerConversionUnidades = async (req, res) => {
    try {
        const [result] = await sequelize.query(
            `DELETE FROM articulos
             WHERE descripcion LIKE 'Convertido de unidad de renta%'
             RETURNING id, codigo_ean13, nombre`
        );
        res.status(200).json({
            success: true,
            message: `Se eliminaron ${result.length} SKUs creados por la conversión`,
            data: { eliminados: result }
        });
    } catch (error) {
        console.error('Error en deshacerConversionUnidades:', error);
        res.status(500).json({
            success: false,
            message: 'Error al deshacer la conversión',
            error: error.message
        });
    }
};

/**
 * GET /api/admin/skus-movidos-a-herramientas
 * Lista los SKUs que están actualmente en el almacén Herramientas con
 * es_herramienta=true (potencialmente movidos por la migración inicial).
 * Útil para identificar los que deberían regresarse a su almacén original.
 */
export const listarSkusEnHerramientas = async (req, res) => {
    try {
        const [rows] = await sequelize.query(
            `SELECT a.id, a.codigo_ean13, a.nombre, a.stock_actual, a.es_herramienta,
                    a.categoria_id, c.nombre AS categoria_nombre
             FROM articulos a
             LEFT JOIN categorias c ON c.id = a.categoria_id
             JOIN ubicaciones u ON u.id = a.ubicacion_id
             JOIN almacenes al ON al.id = u.almacen_id
             WHERE al.nombre = 'Herramientas'
                AND a.activo = true
             ORDER BY a.nombre`
        );
        res.status(200).json({
            success: true,
            total: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error en listarSkusEnHerramientas:', error);
        res.status(500).json({
            success: false,
            message: 'Error',
            error: error.message
        });
    }
};

export default { deshacerConversionUnidades, listarSkusEnHerramientas };
