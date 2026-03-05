import { ConteoCiclico, ConteoArticulo, Articulo, Categoria, Ubicacion, Movimiento, DetalleMovimiento } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';

const ARTICULOS_POR_DIA = 20;

// ============ HELPERS ============

// Obtener fecha de hoy en formato YYYY-MM-DD
const getFechaHoy = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

// Seleccionar artículos para un nuevo conteo, excluyendo los ya contados hoy
const seleccionarArticulosParaConteo = async (idsExcluir = []) => {
    // Obtener todos los artículos ya contados ALGUNA VEZ
    const todosConteos = await ConteoArticulo.findAll({
        attributes: ['articulo_id', [sequelize.fn('MAX', sequelize.col('contado_at')), 'ultimo_conteo']],
        group: ['articulo_id']
    });

    const contadoMap = {};
    todosConteos.forEach(c => {
        contadoMap[c.articulo_id] = c.get('ultimo_conteo');
    });

    // Obtener todos los artículos activos
    const todosArticulos = await Articulo.findAll({
        where: { activo: true },
        attributes: ['id'],
        order: [['id', 'ASC']]
    });

    // Separar en: nunca contados vs ya contados (excluyendo los de hoy)
    const nuncaContados = [];
    const yaContados = [];

    todosArticulos.forEach(art => {
        if (idsExcluir.includes(art.id)) return; // ya contado HOY, skip
        if (!contadoMap[art.id]) {
            nuncaContados.push(art.id);
        } else {
            yaContados.push({ id: art.id, ultimoConteo: contadoMap[art.id] });
        }
    });

    // Ordenar los ya contados por fecha de último conteo (más antiguos primero)
    yaContados.sort((a, b) => new Date(a.ultimoConteo) - new Date(b.ultimoConteo));

    // Seleccionar artículos: primero los nunca contados, luego los más antiguos
    const seleccionados = [];

    for (const id of nuncaContados) {
        if (seleccionados.length >= ARTICULOS_POR_DIA) break;
        seleccionados.push(id);
    }

    for (const item of yaContados) {
        if (seleccionados.length >= ARTICULOS_POR_DIA) break;
        seleccionados.push(item.id);
    }

    return seleccionados;
};

// Obtener IDs de todos los artículos contados hoy (en todos los conteos del día)
const getIdsContadosHoy = async (fechaHoy) => {
    const conteosHoy = await ConteoCiclico.findAll({
        where: { fecha: fechaHoy },
        attributes: ['id']
    });

    if (conteosHoy.length === 0) return [];

    const conteoIds = conteosHoy.map(c => c.id);
    const contados = await ConteoArticulo.findAll({
        where: { conteo_ciclico_id: { [Op.in]: conteoIds } },
        attributes: ['articulo_id']
    });

    return [...new Set(contados.map(c => c.articulo_id))];
};

// Obtener o crear el conteo del día, con auto-asignación de artículos
const obtenerOCrearConteoDelDia = async () => {
    const fechaHoy = getFechaHoy();

    // Buscar el conteo más reciente de hoy (mayor secuencia)
    let conteo = await ConteoCiclico.findOne({
        where: { fecha: fechaHoy },
        order: [['secuencia', 'DESC']]
    });

    if (conteo) {
        return conteo;
    }

    // No existe → crear nuevo día con asignación automática

    // Marcar días anteriores pendientes como completados
    const conteosAnteriores = await ConteoCiclico.findAll({
        where: { estado: 'pendiente', fecha: { [Op.lt]: fechaHoy } },
        order: [['fecha', 'ASC']]
    });

    for (const conteoAnterior of conteosAnteriores) {
        await conteoAnterior.update({
            estado: 'completado',
            completado_at: new Date()
        });
    }

    // Seleccionar artículos para hoy
    const seleccionados = await seleccionarArticulosParaConteo([]);

    // Crear conteo del día
    const now = new Date();
    const nombre = `Conteo ${now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    conteo = await ConteoCiclico.create({
        fecha: fechaHoy,
        secuencia: 1,
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

        // ---- ACTUALIZAR STOCK SI HAY DIFERENCIA ----
        if (diferencia !== 0) {
            const transaction = await sequelize.transaction();
            try {
                // Determinar tipo de ajuste
                const tipoAjuste = diferencia > 0 ? 'ajuste_entrada' : 'ajuste_salida';
                const cantidadAbsoluta = Math.abs(diferencia);

                // Generar ticket_id para el movimiento
                const fecha = new Date();
                const ddmmyy = fecha.toISOString().slice(2, 10).replace(/-/g, '').match(/.{2}/g).reverse().join('');
                const hhmm = fecha.toTimeString().slice(0, 5).replace(':', '');
                const ticket_id = `CC-${ddmmyy}-${hhmm}-${articulo_id}`;

                // Crear movimiento de ajuste
                const movimiento = await Movimiento.create({
                    ticket_id,
                    tipo: tipoAjuste,
                    usuario_id: req.usuario?.id || null,
                    observaciones: `Ajuste por conteo cíclico. Sistema: ${cantidadSistema} ${articulo.unidad}, Físico: ${cantidadFisica} ${articulo.unidad}. Diferencia: ${diferencia > 0 ? '+' : ''}${diferencia} ${articulo.unidad}${observaciones ? '. Obs: ' + observaciones : ''}`,
                    estado: 'completado'
                }, { transaction });

                // Crear detalle del movimiento
                await DetalleMovimiento.create({
                    movimiento_id: movimiento.id,
                    articulo_id: parseInt(articulo_id),
                    cantidad: cantidadAbsoluta,
                    stock_anterior: cantidadSistema,
                    stock_nuevo: cantidadFisica
                }, { transaction });

                // Actualizar stock del artículo
                await articulo.update({
                    stock_actual: cantidadFisica
                }, { transaction });

                await transaction.commit();
                console.log(`📦 Conteo cíclico - Stock actualizado: ${articulo.nombre} (${cantidadSistema} → ${cantidadFisica}, dif: ${diferencia > 0 ? '+' : ''}${diferencia})`);
            } catch (stockError) {
                await transaction.rollback();
                console.error('Error al actualizar stock por conteo cíclico:', stockError);
                // No fallar el conteo si el stock no se pudo actualizar
                // pero registrar el error
            }
        }
        // ---- FIN ACTUALIZAR STOCK ----

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

// Adelantar conteo: generar un nuevo conteo extra cuando el actual está completado
export const adelantarConteo = async (req, res) => {
    try {
        const fechaHoy = getFechaHoy();

        // Buscar el conteo más reciente de hoy
        const conteoActual = await ConteoCiclico.findOne({
            where: { fecha: fechaHoy },
            order: [['secuencia', 'DESC']]
        });

        if (!conteoActual) {
            return res.status(400).json({
                success: false,
                message: 'No hay conteo del día para adelantar'
            });
        }

        if (conteoActual.estado !== 'completado') {
            return res.status(400).json({
                success: false,
                message: 'El conteo actual aún no está completado. Termina el conteo actual antes de adelantar.'
            });
        }

        // Obtener todos los artículos contados hoy para excluirlos
        const idsContadosHoy = await getIdsContadosHoy(fechaHoy);

        // Seleccionar nuevos artículos excluyendo los ya contados hoy
        const seleccionados = await seleccionarArticulosParaConteo(idsContadosHoy);

        if (seleccionados.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay más artículos disponibles para contar hoy. ¡Ya se contaron todos!'
            });
        }

        // Crear nuevo conteo con secuencia incrementada
        const nuevaSecuencia = conteoActual.secuencia + 1;
        const now = new Date();
        const nombre = `Conteo ${now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} (#${nuevaSecuencia})`;

        const nuevoConteo = await ConteoCiclico.create({
            fecha: fechaHoy,
            secuencia: nuevaSecuencia,
            nombre,
            estado: 'pendiente',
            total_asignados: seleccionados.length,
            articulos_contados: 0
        });

        res.json({
            success: true,
            message: `✅ Conteo adelantado (#${nuevaSecuencia}). Se asignaron ${seleccionados.length} artículos nuevos.`,
            data: nuevoConteo
        });
    } catch (error) {
        console.error('Error adelantando conteo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al adelantar conteo',
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
            order: [['fecha', 'DESC'], ['secuencia', 'DESC']],
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

// Aplicar retroactivamente los conteos anteriores que no actualizaron stock
export const aplicarConteosAnteriores = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        // Obtener TODOS los conteo_articulos con diferencia != 0
        const conteosConDiferencia = await ConteoArticulo.findAll({
            where: {
                diferencia: { [Op.ne]: 0 }
            },
            include: [{
                model: Articulo,
                as: 'articulo',
                attributes: ['id', 'nombre', 'stock_actual', 'unidad']
            }],
            order: [['contado_at', 'ASC']] // Orden cronológico para aplicar en secuencia
        });

        if (conteosConDiferencia.length === 0) {
            await transaction.rollback();
            return res.json({
                success: true,
                message: 'No hay conteos con diferencias pendientes de aplicar',
                data: { ajustados: 0 }
            });
        }

        // Agrupar por artículo — solo nos importa el ÚLTIMO conteo de cada artículo
        // ya que ese tiene la cantidad física más reciente
        const ultimoConteoPorArticulo = {};
        conteosConDiferencia.forEach(ca => {
            ultimoConteoPorArticulo[ca.articulo_id] = ca;
        });

        const ajustes = [];
        let ajustados = 0;

        for (const articuloId of Object.keys(ultimoConteoPorArticulo)) {
            const conteoArt = ultimoConteoPorArticulo[articuloId];
            const articulo = conteoArt.articulo;

            if (!articulo) continue;

            const stockActualDB = parseFloat(articulo.stock_actual);
            const cantidadFisica = parseFloat(conteoArt.cantidad_fisica);

            // Solo ajustar si el stock actual del DB todavía no coincide con el conteo físico
            if (stockActualDB === cantidadFisica) {
                ajustes.push({
                    articulo: articulo.nombre,
                    estado: 'ya_coincide',
                    stock_db: stockActualDB,
                    conteo_fisico: cantidadFisica
                });
                continue;
            }

            const diferencia = cantidadFisica - stockActualDB;
            const tipoAjuste = diferencia > 0 ? 'ajuste_entrada' : 'ajuste_salida';

            // Generar ticket_id
            const fecha = new Date();
            const ddmmyy = fecha.toISOString().slice(2, 10).replace(/-/g, '').match(/.{2}/g).reverse().join('');
            const hhmm = fecha.toTimeString().slice(0, 5).replace(':', '');
            const ticket_id = `CC-FIX-${ddmmyy}-${hhmm}-${articuloId}`;

            // Crear movimiento
            const movimiento = await Movimiento.create({
                ticket_id,
                tipo: tipoAjuste,
                usuario_id: req.usuario?.id || null,
                observaciones: `Ajuste retroactivo por conteo cíclico (fix). Stock DB: ${stockActualDB} ${articulo.unidad}, Conteo físico: ${cantidadFisica} ${articulo.unidad}. Conteo original: ${new Date(conteoArt.contado_at).toLocaleDateString('es-MX')}`,
                estado: 'completado'
            }, { transaction });

            await DetalleMovimiento.create({
                movimiento_id: movimiento.id,
                articulo_id: parseInt(articuloId),
                cantidad: Math.abs(diferencia),
                stock_anterior: stockActualDB,
                stock_nuevo: cantidadFisica
            }, { transaction });

            await Articulo.update(
                { stock_actual: cantidadFisica },
                { where: { id: articuloId }, transaction }
            );

            ajustes.push({
                articulo: articulo.nombre,
                estado: 'ajustado',
                stock_anterior: stockActualDB,
                stock_nuevo: cantidadFisica,
                diferencia,
                ticket_id
            });
            ajustados++;
        }

        await transaction.commit();

        console.log(`📦 Conteos retroactivos aplicados: ${ajustados} artículos ajustados`);

        res.json({
            success: true,
            message: `Se ajustaron ${ajustados} artículos de ${Object.keys(ultimoConteoPorArticulo).length} con diferencias`,
            data: {
                ajustados,
                total_con_diferencia: Object.keys(ultimoConteoPorArticulo).length,
                detalle: ajustes
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error al aplicar conteos anteriores:', error);
        res.status(500).json({
            success: false,
            message: 'Error al aplicar conteos anteriores',
            error: error.message
        });
    }
};

// Obtener IDs de artículos ya contados en el ciclo actual
export const getArticulosEnConteoActivo = async (req, res) => {
    try {
        // Total de artículos activos
        const totalArticulos = await Articulo.count({ where: { activo: true } });

        if (totalArticulos === 0) {
            return res.json({ success: true, data: { articulo_ids: [], ciclo_progreso: 0 } });
        }

        // Contar cuántas veces ha sido contado cada artículo
        const conteosPorArticulo = await ConteoArticulo.findAll({
            attributes: [
                'articulo_id',
                [sequelize.fn('COUNT', sequelize.col('id')), 'veces_contado']
            ],
            group: ['articulo_id']
        });

        // Si no hay conteos, nadie ha sido contado → todo blanco
        if (conteosPorArticulo.length === 0) {
            return res.json({ success: true, data: { articulo_ids: [], ciclo_progreso: 0 } });
        }

        // Crear mapa de conteos: articulo_id → veces_contado
        const conteoMap = {};
        conteosPorArticulo.forEach(c => {
            conteoMap[c.articulo_id] = parseInt(c.get('veces_contado'));
        });

        // El mínimo de conteos considerando TODOS los artículos activos
        // (los que nunca han sido contados tienen 0)
        const todosArticuloIds = await Articulo.findAll({
            where: { activo: true },
            attributes: ['id']
        });

        let minConteo = Infinity;
        todosArticuloIds.forEach(art => {
            const conteo = conteoMap[art.id] || 0;
            if (conteo < minConteo) minConteo = conteo;
        });

        // Artículos con más conteos que el mínimo = ya fueron contados en este ciclo → azul
        const articulosEnCiclo = [];
        todosArticuloIds.forEach(art => {
            const conteo = conteoMap[art.id] || 0;
            if (conteo > minConteo) {
                articulosEnCiclo.push(art.id);
            }
        });

        // Progreso del ciclo: cuántos ya se contaron vs total
        const progreso = Math.round((articulosEnCiclo.length / totalArticulos) * 100);

        res.json({
            success: true,
            data: {
                articulo_ids: articulosEnCiclo,
                ciclo_progreso: progreso,
                contados_ciclo: articulosEnCiclo.length,
                total: totalArticulos
            }
        });
    } catch (error) {
        console.error('Error obteniendo artículos en conteo activo:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export default {
    getConteoHoy,
    getArticulosPendientes,
    registrarConteo,
    adelantarConteo,
    getReportes,
    getResumen,
    aplicarConteosAnteriores,
    getArticulosEnConteoActivo
};
