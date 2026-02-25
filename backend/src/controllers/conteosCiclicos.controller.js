import { ConteoCiclico, ConteoArticulo, Articulo, Categoria, Ubicacion } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';

const ARTICULOS_POR_DIA = 20;

// ============ HELPERS ============

// Obtener fecha de hoy en formato YYYY-MM-DD
const getFechaHoy = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

// Obtener o crear el conteo del día, con auto-asignación de artículos
const obtenerOCrearConteoDelDia = async () => {
    const fechaHoy = getFechaHoy();

    // Buscar si ya existe el conteo de hoy
    let conteo = await ConteoCiclico.findOne({
        where: { fecha: fechaHoy }
    });

    if (conteo) {
        return conteo;
    }

    // No existe → crear nuevo día con asignación automática

    // 1. Buscar artículos pendientes de días anteriores (no contados)
    const conteosAnteriores = await ConteoCiclico.findAll({
        where: { estado: 'pendiente', fecha: { [Op.lt]: fechaHoy } },
        order: [['fecha', 'ASC']]
    });

    let articulosPendientesIds = [];

    for (const conteoAnterior of conteosAnteriores) {
        // Obtener IDs asignados a ese día (artículos que tienen registro con ese conteo)
        const contados = await ConteoArticulo.findAll({
            where: { conteo_ciclico_id: conteoAnterior.id },
            attributes: ['articulo_id']
        });
        const idsContados = contados.map(c => c.articulo_id);

        // Los asignados son los artículos del conteo anterior
        // Los que NO fueron contados son los pendientes
        // Usamos un enfoque más simple: si hay registros, esos fueron contados
        // Los que estaban asignados pero no contados se determinan del total asignado

        // Marcar el día anterior como completado (ya pasó el día)
        await conteoAnterior.update({
            estado: 'completado',
            completado_at: new Date()
        });
    }

    // 2. Obtener todos los IDs de artículos que YA han sido contados alguna vez
    const todosConteos = await ConteoArticulo.findAll({
        attributes: ['articulo_id', [sequelize.fn('MAX', sequelize.col('contado_at')), 'ultimo_conteo']],
        group: ['articulo_id']
    });

    const contadoMap = {};
    todosConteos.forEach(c => {
        contadoMap[c.articulo_id] = c.get('ultimo_conteo');
    });

    // 3. Obtener todos los artículos activos
    const todosArticulos = await Articulo.findAll({
        where: { activo: true },
        attributes: ['id'],
        order: [['id', 'ASC']]
    });

    // 4. Separar en: nunca contados vs ya contados
    const nuncaContados = [];
    const yaContados = [];

    todosArticulos.forEach(art => {
        if (!contadoMap[art.id]) {
            nuncaContados.push(art.id);
        } else {
            yaContados.push({ id: art.id, ultimoConteo: contadoMap[art.id] });
        }
    });

    // Ordenar los ya contados por fecha de último conteo (más antiguos primero)
    yaContados.sort((a, b) => new Date(a.ultimoConteo) - new Date(b.ultimoConteo));

    // 5. Seleccionar artículos para hoy: primero los nunca contados, luego los más antiguos
    const seleccionados = [];

    // Primero los nunca contados
    for (const id of nuncaContados) {
        if (seleccionados.length >= ARTICULOS_POR_DIA) break;
        seleccionados.push(id);
    }

    // Luego los más antiguos
    for (const item of yaContados) {
        if (seleccionados.length >= ARTICULOS_POR_DIA) break;
        seleccionados.push(item.id);
    }

    // 6. Crear conteo del día
    const now = new Date();
    const nombre = `Conteo ${now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    conteo = await ConteoCiclico.create({
        fecha: fechaHoy,
        nombre,
        estado: 'pendiente',
        total_asignados: seleccionados.length,
        articulos_contados: 0
    });

    return conteo;
};

// ============ ENDPOINTS ============

// Obtener conteo del día (auto-crea si no existe)
export const getConteoHoy = async (req, res) => {
    try {
        const conteo = await obtenerOCrearConteoDelDia();

        // Contar cuántos ya se contaron hoy
        const contados = await ConteoArticulo.count({
            where: { conteo_ciclico_id: conteo.id }
        });

        // Actualizar si cambió
        if (contados !== conteo.articulos_contados) {
            await conteo.update({ articulos_contados: contados });
            conteo.articulos_contados = contados;
        }

        res.json({
            success: true,
            data: conteo
        });
    } catch (error) {
        console.error('Error obteniendo conteo del día:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener conteo del día',
            error: error.message
        });
    }
};

// Obtener artículos asignados para hoy (pendientes de contar)
export const getArticulosPendientes = async (req, res) => {
    try {
        const { id } = req.params;
        const { search } = req.query;

        const conteo = await ConteoCiclico.findByPk(id);
        if (!conteo) {
            return res.status(404).json({
                success: false,
                message: 'Conteo no encontrado'
            });
        }

        // Obtener IDs de artículos ya contados en ESTA sesión
        const articulosContados = await ConteoArticulo.findAll({
            where: { conteo_ciclico_id: id },
            attributes: ['articulo_id']
        });
        const idsContados = articulosContados.map(ca => ca.articulo_id);

        // Obtener todos los artículos ya contados ALGUNA VEZ (para saber cuáles asignar)
        const todosConteos = await ConteoArticulo.findAll({
            attributes: ['articulo_id', [sequelize.fn('MAX', sequelize.col('contado_at')), 'ultimo_conteo']],
            group: ['articulo_id']
        });
        const contadoMap = {};
        todosConteos.forEach(c => {
            contadoMap[c.articulo_id] = c.get('ultimo_conteo');
        });

        // Obtener todos los artículos activos
        const whereArticulo = { activo: true };

        if (search && search.trim()) {
            whereArticulo[Op.or] = [
                { nombre: { [Op.iLike]: `%${search}%` } },
                { codigo_ean13: { [Op.iLike]: `%${search}%` } },
                { sku: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const todosArticulos = await Articulo.findAll({
            where: whereArticulo,
            attributes: ['id'],
            order: [['id', 'ASC']]
        });

        // Separar y priorizar
        const nuncaContados = [];
        const yaContadosList = [];

        todosArticulos.forEach(art => {
            if (idsContados.includes(art.id)) return; // ya contado HOY, skip
            if (!contadoMap[art.id]) {
                nuncaContados.push(art.id);
            } else {
                yaContadosList.push({ id: art.id, ultimoConteo: contadoMap[art.id] });
            }
        });

        yaContadosList.sort((a, b) => new Date(a.ultimoConteo) - new Date(b.ultimoConteo));

        // Seleccionar los que faltan por contar hoy
        const faltantes = conteo.total_asignados - idsContados.length;
        const seleccionados = [];

        for (const id of nuncaContados) {
            if (seleccionados.length >= faltantes) break;
            seleccionados.push(id);
        }
        for (const item of yaContadosList) {
            if (seleccionados.length >= faltantes) break;
            seleccionados.push(item.id);
        }

        // Obtener datos completos de los seleccionados
        let articulos = [];
        if (seleccionados.length > 0) {
            const whereIds = { id: { [Op.in]: seleccionados }, activo: true };

            if (search && search.trim()) {
                whereIds[Op.or] = [
                    { nombre: { [Op.iLike]: `%${search}%` } },
                    { codigo_ean13: { [Op.iLike]: `%${search}%` } },
                    { sku: { [Op.iLike]: `%${search}%` } }
                ];
            }

            articulos = await Articulo.findAll({
                where: whereIds,
                include: [
                    { model: Categoria, as: 'categoria', attributes: ['id', 'nombre'] },
                    { model: Ubicacion, as: 'ubicacion', attributes: ['id', 'codigo', 'almacen'] }
                ],
                attributes: ['id', 'codigo_ean13', 'nombre', 'stock_actual', 'unidad', 'imagen_url', 'ubicacion_id', 'categoria_id'],
                order: [['nombre', 'ASC']]
            });
        }

        res.json({
            success: true,
            data: articulos,
            pendientes: articulos.length,
            total_asignados: conteo.total_asignados,
            contados: idsContados.length
        });
    } catch (error) {
        console.error('Error obteniendo artículos pendientes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener artículos pendientes',
            error: error.message
        });
    }
};

// Registrar conteo de un artículo
export const registrarConteo = async (req, res) => {
    try {
        const { id } = req.params;
        const { articulo_id, cantidad_fisica, observaciones } = req.body;

        if (!articulo_id || cantidad_fisica === undefined || cantidad_fisica === null) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere articulo_id y cantidad_fisica'
            });
        }

        const conteo = await ConteoCiclico.findByPk(id);
        if (!conteo) {
            return res.status(404).json({
                success: false,
                message: 'Conteo no encontrado'
            });
        }

        // Verificar que no haya sido contado ya en esta sesión
        const yaContado = await ConteoArticulo.findOne({
            where: { conteo_ciclico_id: id, articulo_id }
        });

        if (yaContado) {
            return res.status(400).json({
                success: false,
                message: 'Este artículo ya fue contado hoy'
            });
        }

        // Obtener artículo
        const articulo = await Articulo.findByPk(articulo_id);
        if (!articulo || !articulo.activo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        const cantidadSistema = parseFloat(articulo.stock_actual);
        const cantidadFisica = parseFloat(cantidad_fisica);
        const diferencia = cantidadFisica - cantidadSistema;

        // Crear registro
        const conteoArticulo = await ConteoArticulo.create({
            conteo_ciclico_id: parseInt(id),
            articulo_id: parseInt(articulo_id),
            cantidad_sistema: cantidadSistema,
            cantidad_fisica: cantidadFisica,
            diferencia,
            observaciones: observaciones || null,
            contado_at: new Date()
        });

        // Actualizar contador
        const nuevosContados = conteo.articulos_contados + 1;
        const updateData = { articulos_contados: nuevosContados };

        if (nuevosContados >= conteo.total_asignados) {
            updateData.estado = 'completado';
            updateData.completado_at = new Date();
        }

        await conteo.update(updateData);

        res.json({
            success: true,
            message: nuevosContados >= conteo.total_asignados
                ? '🎉 ¡Checklist del día completado!'
                : 'Artículo contado',
            data: {
                conteoArticulo,
                sesion: {
                    articulos_contados: nuevosContados,
                    total_asignados: conteo.total_asignados,
                    estado: updateData.estado || 'pendiente',
                    completado: nuevosContados >= conteo.total_asignados
                }
            }
        });
    } catch (error) {
        console.error('Error registrando conteo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar conteo',
            error: error.message
        });
    }
};

// Obtener reportes (historial de conteos)
export const getReportes = async (req, res) => {
    try {
        const { desde, hasta, page = 1, limit = 30 } = req.query;

        const where = {};
        if (desde) where.fecha = { ...where.fecha, [Op.gte]: desde };
        if (hasta) where.fecha = { ...where.fecha, [Op.lte]: hasta };

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { rows: conteos, count: total } = await ConteoCiclico.findAndCountAll({
            where,
            order: [['fecha', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        // Para cada conteo, obtener estadísticas rápidas
        const conteosConStats = await Promise.all(conteos.map(async (conteo) => {
            const articulos = await ConteoArticulo.findAll({
                where: { conteo_ciclico_id: conteo.id },
                attributes: ['diferencia']
            });

            const conDiferencia = articulos.filter(a => parseFloat(a.diferencia) !== 0).length;
            const faltantes = articulos.filter(a => parseFloat(a.diferencia) < 0).length;
            const sobrantes = articulos.filter(a => parseFloat(a.diferencia) > 0).length;

            return {
                ...conteo.toJSON(),
                stats: {
                    con_diferencia: conDiferencia,
                    faltantes,
                    sobrantes,
                    exactos: articulos.length - conDiferencia
                }
            };
        }));

        // Estadísticas globales del rango
        const todosConteosPeriodo = await ConteoArticulo.findAll({
            include: [{
                model: ConteoCiclico,
                as: 'conteo',
                where,
                attributes: []
            }],
            attributes: ['diferencia']
        });

        const totalContados = todosConteosPeriodo.length;
        const totalConDiferencia = todosConteosPeriodo.filter(a => parseFloat(a.diferencia) !== 0).length;

        res.json({
            success: true,
            data: conteosConStats,
            pagination: {
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit))
            },
            estadisticas_globales: {
                total_dias: total,
                total_articulos_contados: totalContados,
                total_con_diferencia: totalConDiferencia,
                porcentaje_exactitud: totalContados > 0
                    ? Math.round(((totalContados - totalConDiferencia) / totalContados) * 100)
                    : 100
            }
        });
    } catch (error) {
        console.error('Error obteniendo reportes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener reportes',
            error: error.message
        });
    }
};

// Obtener resumen de un día específico
export const getResumen = async (req, res) => {
    try {
        const { id } = req.params;

        const conteo = await ConteoCiclico.findByPk(id);
        if (!conteo) {
            return res.status(404).json({
                success: false,
                message: 'Conteo no encontrado'
            });
        }

        const articulos = await ConteoArticulo.findAll({
            where: { conteo_ciclico_id: id },
            include: [
                {
                    model: Articulo,
                    as: 'articulo',
                    attributes: ['id', 'codigo_ean13', 'nombre', 'unidad', 'imagen_url'],
                    include: [
                        { model: Categoria, as: 'categoria', attributes: ['id', 'nombre'] },
                        { model: Ubicacion, as: 'ubicacion', attributes: ['id', 'codigo', 'almacen'] }
                    ]
                }
            ],
            order: [['contado_at', 'ASC']]
        });

        const conDiferencia = articulos.filter(a => parseFloat(a.diferencia) !== 0);
        const sobrante = articulos.filter(a => parseFloat(a.diferencia) > 0);
        const faltante = articulos.filter(a => parseFloat(a.diferencia) < 0);
        const exacto = articulos.filter(a => parseFloat(a.diferencia) === 0);

        res.json({
            success: true,
            data: {
                conteo,
                articulos,
                estadisticas: {
                    total_contados: articulos.length,
                    con_diferencia: conDiferencia.length,
                    sobrante: sobrante.length,
                    faltante: faltante.length,
                    exacto: exacto.length
                }
            }
        });
    } catch (error) {
        console.error('Error obteniendo resumen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener resumen',
            error: error.message
        });
    }
};

export default {
    getConteoHoy,
    getArticulosPendientes,
    registrarConteo,
    getReportes,
    getResumen
};
