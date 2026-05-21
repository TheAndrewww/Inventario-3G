/**
 * Controlador Reportes — análisis del inventario consumible y sugerencias de ajuste.
 */

import { Articulo, Categoria, Ubicacion, DetalleMovimiento, Movimiento } from '../models/index.js';
import { Op, fn, col, literal } from 'sequelize';
import { sequelize } from '../config/database.js';

// Tipos de movimiento que representan SALIDAS (consumo) del inventario.
const TIPOS_SALIDA = ['pedido', 'retiro', 'ajuste_salida'];

const LEAD_TIME_DIAS = 14;        // Stock mínimo cubre 14 días de consumo (safety)
const COBERTURA_DIAS = 60;        // Stock máximo cubre 60 días de consumo
const UMBRAL_DIFERENCIA = 1.5;    // Diferencia ≥ 50% se considera relevante

/**
 * GET /api/reportes/inventario-consumibles?dias=90
 * Devuelve KPIs, distribución, top consumidos y sugerencias de ajuste de stocks.
 */
export const reporteInventarioConsumibles = async (req, res) => {
    try {
        const dias = Math.max(7, Math.min(365, parseInt(req.query.dias, 10) || 90));
        const desde = new Date();
        desde.setDate(desde.getDate() - dias);

        // 1) Traer todos los consumibles activos
        const articulos = await Articulo.findAll({
            where: { activo: true, es_herramienta: false },
            attributes: ['id', 'nombre', 'unidad', 'stock_actual', 'stock_minimo', 'stock_maximo', 'costo_unitario'],
            include: [
                { model: Categoria, as: 'categoria', attributes: ['id', 'nombre'], required: false }
            ]
        });

        // 2) Calcular consumo por artículo en el periodo (suma de cantidades de salidas)
        const consumosRaw = await DetalleMovimiento.findAll({
            attributes: [
                'articulo_id',
                [fn('SUM', col('DetalleMovimiento.cantidad')), 'consumo_total']
            ],
            include: [{
                model: Movimiento,
                as: 'movimiento',
                attributes: [],
                where: {
                    tipo: { [Op.in]: TIPOS_SALIDA },
                    fecha_hora: { [Op.gte]: desde },
                    estado: { [Op.notIn]: ['cancelado', 'rechazado'] }
                },
                required: true
            }],
            group: ['articulo_id'],
            raw: true
        });
        const consumoMap = new Map();
        consumosRaw.forEach(r => consumoMap.set(parseInt(r.articulo_id), parseFloat(r.consumo_total) || 0));

        // 3) Construir el reporte por artículo
        const distribucion = { critico: 0, bajoMinimo: 0, ok: 0, sobreMaximo: 0, sinMovimiento: 0 };
        let valoracionTotal = 0;
        let valoracionBajoMinimo = 0;
        const sugerencias = [];
        const detalleArticulos = [];

        for (const art of articulos) {
            const stockActual = parseFloat(art.stock_actual) || 0;
            const stockMin = parseFloat(art.stock_minimo) || 0;
            const stockMax = art.stock_maximo !== null ? parseFloat(art.stock_maximo) : null;
            const costo = parseFloat(art.costo_unitario) || 0;
            const consumoTotal = consumoMap.get(art.id) || 0;
            const consumoDiario = consumoTotal / dias;
            const consumoMensual = consumoDiario * 30;

            valoracionTotal += stockActual * costo;

            // Estado de stock
            let estado;
            if (consumoDiario === 0 && stockActual === 0) {
                estado = 'sinMovimiento';
            } else if (stockActual < stockMin * 0.5) {
                estado = 'critico';
            } else if (stockActual < stockMin) {
                estado = 'bajoMinimo';
            } else if (stockMax !== null && stockActual > stockMax) {
                estado = 'sobreMaximo';
            } else {
                estado = 'ok';
            }
            distribucion[estado]++;

            if (estado === 'critico' || estado === 'bajoMinimo') {
                valoracionBajoMinimo += stockActual * costo;
            }

            // Sugerencias de ajuste
            const sugMin = Math.ceil(consumoDiario * LEAD_TIME_DIAS);
            const sugMax = Math.ceil(consumoDiario * COBERTURA_DIAS);

            let accion = 'ok';
            let razon = '';
            if (consumoDiario === 0) {
                if (stockMin > 0) {
                    accion = 'sin_movimiento';
                    razon = `Sin consumo en ${dias} días. Considera reducir mínimo o desactivar.`;
                }
            } else if (sugMin > stockMin * UMBRAL_DIFERENCIA && sugMin > 0) {
                accion = 'aumentar_min';
                razon = `Consumo de ~${consumoMensual.toFixed(1)}/mes excede el mínimo actual. Subir a ${sugMin}.`;
            } else if (stockMin > 0 && sugMin > 0 && stockMin > sugMin * UMBRAL_DIFERENCIA) {
                accion = 'reducir_min';
                razon = `Mínimo actual sobredimensionado para el consumo (~${consumoMensual.toFixed(1)}/mes). Bajar a ${sugMin}.`;
            } else if (stockMax !== null && sugMax > 0 && stockMax > sugMax * UMBRAL_DIFERENCIA) {
                accion = 'reducir_max';
                razon = `Máximo cubre más de ${COBERTURA_DIAS} días de consumo. Bajar a ${sugMax}.`;
            } else if (stockMax === null || stockMax === 0) {
                if (sugMax > 0) {
                    accion = 'definir_max';
                    razon = `No tiene máximo definido. Sugerido: ${sugMax}.`;
                }
            }

            const itemDetalle = {
                id: art.id,
                nombre: art.nombre,
                unidad: art.unidad,
                categoria: art.categoria?.nombre || null,
                stock_actual: stockActual,
                stock_minimo: stockMin,
                stock_maximo: stockMax,
                consumo_total: consumoTotal,
                consumo_mensual: parseFloat(consumoMensual.toFixed(2)),
                consumo_diario: parseFloat(consumoDiario.toFixed(3)),
                valor_inventario: parseFloat((stockActual * costo).toFixed(2)),
                estado,
                sugerencia: {
                    accion,
                    razon,
                    stock_min_sugerido: sugMin,
                    stock_max_sugerido: sugMax
                }
            };
            detalleArticulos.push(itemDetalle);
            if (accion !== 'ok') sugerencias.push(itemDetalle);
        }

        // 4) Top 10 consumidos
        const topConsumidos = [...detalleArticulos]
            .filter(a => a.consumo_total > 0)
            .sort((a, b) => b.consumo_total - a.consumo_total)
            .slice(0, 10);

        // 5) KPIs
        const kpis = {
            total_consumibles: articulos.length,
            valoracion_total: parseFloat(valoracionTotal.toFixed(2)),
            valoracion_bajo_minimo: parseFloat(valoracionBajoMinimo.toFixed(2)),
            articulos_criticos: distribucion.critico,
            articulos_bajo_minimo: distribucion.bajoMinimo,
            articulos_ok: distribucion.ok,
            articulos_sobre_maximo: distribucion.sobreMaximo,
            articulos_sin_movimiento: distribucion.sinMovimiento,
            sugerencias_pendientes: sugerencias.length,
            dias_analizados: dias
        };

        // Resumen por categoría (para gráfica adicional)
        const porCategoria = {};
        detalleArticulos.forEach(a => {
            const cat = a.categoria || 'Sin categoría';
            if (!porCategoria[cat]) porCategoria[cat] = { categoria: cat, articulos: 0, valor: 0, bajo_minimo: 0 };
            porCategoria[cat].articulos++;
            porCategoria[cat].valor += a.valor_inventario;
            if (a.estado === 'critico' || a.estado === 'bajoMinimo') porCategoria[cat].bajo_minimo++;
        });
        const resumenCategorias = Object.values(porCategoria)
            .map(c => ({ ...c, valor: parseFloat(c.valor.toFixed(2)) }))
            .sort((a, b) => b.valor - a.valor);

        res.json({
            success: true,
            data: {
                kpis,
                distribucion,
                top_consumidos: topConsumidos,
                resumen_categorias: resumenCategorias,
                sugerencias: sugerencias.sort((a, b) => {
                    // Orden: críticos primero, luego bajos, etc.
                    const order = { critico: 0, bajoMinimo: 1, sobreMaximo: 2, sinMovimiento: 3, ok: 4 };
                    return (order[a.estado] ?? 99) - (order[b.estado] ?? 99);
                }),
                articulos: detalleArticulos,
                parametros: {
                    dias_analizados: dias,
                    lead_time_dias: LEAD_TIME_DIAS,
                    cobertura_dias: COBERTURA_DIAS
                }
            }
        });
    } catch (error) {
        console.error('Error en reporteInventarioConsumibles:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar el reporte',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/reportes/aplicar-sugerencias
 * Aplica ajustes de stock_minimo / stock_maximo a artículos.
 * Body: { ajustes: [{ id, stock_minimo?, stock_maximo? }] }
 */
export const aplicarSugerencias = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { ajustes } = req.body || {};
        if (!Array.isArray(ajustes) || ajustes.length === 0) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'No hay ajustes para aplicar' });
        }

        let actualizados = 0;
        for (const aj of ajustes) {
            if (!aj.id) continue;
            const updates = {};
            if (typeof aj.stock_minimo === 'number' && aj.stock_minimo >= 0) updates.stock_minimo = aj.stock_minimo;
            if (typeof aj.stock_maximo === 'number' && aj.stock_maximo >= 0) updates.stock_maximo = aj.stock_maximo;
            if (Object.keys(updates).length === 0) continue;
            const [count] = await Articulo.update(updates, { where: { id: aj.id }, transaction: t });
            actualizados += count;
        }

        await t.commit();
        res.json({ success: true, message: `${actualizados} artículo(s) actualizados`, data: { actualizados } });
    } catch (error) {
        await t.rollback();
        console.error('Error en aplicarSugerencias:', error);
        res.status(500).json({ success: false, message: 'Error al aplicar ajustes' });
    }
};
