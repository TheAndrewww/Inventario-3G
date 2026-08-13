/**
 * Recepción de mercancía a partir de la factura del proveedor.
 *
 * Paso 1: almacén fotografía la factura, la IA la lee y la cruza contra la
 *         orden de compra. Almacén solo confirma/corrige lo dudoso.
 * Paso 2: al confirmar se guarda la equivalencia con el proveedor, de modo que
 *         la próxima factura de ese proveedor ya no pregunte nada.
 */

import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import {
    OrdenCompra,
    DetalleOrdenCompra,
    Articulo,
    ArticuloProveedor,
    SolicitudCambio,
    Proveedor,
    Movimiento,
    DetalleMovimiento
} from '../models/index.js';
import { leerFacturaProveedor, isLecturaFacturaEnabled } from '../services/facturaOCR.service.js';
import { generarTicketID } from '../utils/ticket-generator.js';

// Debajo de esta confianza el renglón se le muestra a almacén para que confirme
const UMBRAL_CONFIANZA = 0.85;

const normalizar = (texto) => (texto || '')
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');

/**
 * POST /api/ordenes-compra/:id/analizar-factura
 * Sube la(s) foto(s) de la factura y devuelve la propuesta de recepción.
 * NO escribe nada: solo propone.
 */
export const analizarFactura = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isLecturaFacturaEnabled()) {
            return res.status(503).json({
                success: false,
                message: 'La lectura de facturas no está configurada. Falta GEMINI_API_KEY en el servidor.'
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'Sube al menos una foto de la factura' });
        }

        const orden = await OrdenCompra.findByPk(id, {
            include: [{
                model: DetalleOrdenCompra,
                as: 'detalles',
                include: [{
                    model: Articulo,
                    as: 'articulo',
                    attributes: ['id', 'nombre', 'sku', 'unidad', 'codigo_ean13', 'proveedor_id']
                }]
            }]
        });

        if (!orden) {
            return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
        }

        if (!['enviada', 'parcial'].includes(orden.estado)) {
            return res.status(400).json({
                success: false,
                message: `No se puede recibir una orden en estado '${orden.estado}'`
            });
        }

        // Lo que todavía falta por recibir de cada renglón
        const articulosOrden = orden.detalles.map(det => ({
            detalle_id: det.id,
            articulo_id: det.articulo?.id,
            nombre: det.articulo?.nombre || 'Artículo',
            sku: det.articulo?.sku || null,
            codigo_ean13: det.articulo?.codigo_ean13 || null,
            unidad: det.articulo?.unidad || 'piezas',
            cantidad_solicitada: parseFloat(det.cantidad_solicitada) || 0,
            cantidad_pendiente: (parseFloat(det.cantidad_solicitada) || 0) - (parseFloat(det.cantidad_recibida) || 0)
        }));

        // Equivalencias que ya confirmamos antes con este proveedor
        let aprendidos = [];
        if (orden.proveedor_id) {
            const relaciones = await ArticuloProveedor.findAll({
                where: {
                    proveedor_id: orden.proveedor_id,
                    articulo_id: { [Op.in]: articulosOrden.map(a => a.articulo_id).filter(Boolean) },
                    sku_proveedor: { [Op.ne]: null }
                },
                attributes: ['articulo_id', 'sku_proveedor']
            });

            aprendidos = relaciones.map(rel => {
                const art = articulosOrden.find(a => a.articulo_id === rel.articulo_id);
                return art ? { sku_proveedor: rel.sku_proveedor, detalle_id: art.detalle_id } : null;
            }).filter(Boolean);
        }

        const imagenes = req.files.map(f => ({ buffer: f.buffer, mimetype: f.mimetype }));
        const lectura = await leerFacturaProveedor(imagenes, articulosOrden, aprendidos);

        // Refuerzo determinista: lo que la IA dejó suelto, se intenta cruzar por
        // equivalencia aprendida o por código de barras antes de darlo por perdido.
        const renglones = lectura.renglones.map(r => {
            let detalleId = r.detalle_id || null;
            let origen = detalleId ? 'ia' : null;

            if (!detalleId && r.codigo_proveedor) {
                const previo = aprendidos.find(a => normalizar(a.sku_proveedor) === normalizar(r.codigo_proveedor));
                if (previo) { detalleId = previo.detalle_id; origen = 'aprendido'; }
            }

            if (!detalleId) {
                const previo = aprendidos.find(a => normalizar(a.sku_proveedor) === normalizar(r.descripcion));
                if (previo) { detalleId = previo.detalle_id; origen = 'aprendido'; }
            }

            if (!detalleId && r.codigo_barras) {
                const porCodigo = articulosOrden.find(a => a.codigo_ean13 && a.codigo_ean13 === r.codigo_barras);
                if (porCodigo) { detalleId = porCodigo.detalle_id; origen = 'codigo_barras'; }
            }

            const destino = detalleId ? articulosOrden.find(a => a.detalle_id === detalleId) : null;
            const confianza = origen === 'aprendido' || origen === 'codigo_barras' ? 1 : r.confianza;

            let estado;
            if (!destino) estado = 'sin_identificar';
            else if (confianza >= UMBRAL_CONFIANZA) estado = 'identificado';
            else estado = 'revisar';

            return {
                ...r,
                detalle_id: destino ? destino.detalle_id : null,
                articulo_id: destino ? destino.articulo_id : null,
                articulo_nombre: destino ? destino.nombre : null,
                articulo_unidad: destino ? destino.unidad : null,
                articulo_codigo_ean13: destino ? destino.codigo_ean13 : null,
                cantidad_pendiente: destino ? destino.cantidad_pendiente : null,
                confianza,
                origen: origen || null,
                estado
            };
        });

        const resumen = {
            total: renglones.length,
            identificados: renglones.filter(r => r.estado === 'identificado').length,
            revisar: renglones.filter(r => r.estado === 'revisar').length,
            sin_identificar: renglones.filter(r => r.estado === 'sin_identificar').length
        };

        res.json({
            success: true,
            data: {
                orden: {
                    id: orden.id,
                    ticket_id: orden.ticket_id,
                    proveedor_id: orden.proveedor_id
                },
                factura: {
                    proveedor: lectura.proveedor,
                    folio: lectura.folio,
                    fecha: lectura.fecha,
                    total: lectura.total
                },
                articulos_orden: articulosOrden,
                renglones,
                resumen
            }
        });

    } catch (error) {
        console.error('Error en analizarFactura:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error al leer la factura',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * POST /api/ordenes-compra/:id/aprender-cruce
 * Guarda las equivalencias confirmadas por almacén para que la próxima
 * factura de este proveedor se cruce sola.
 *
 * Body: { renglones: [{ articulo_id, descripcion_proveedor, codigo_proveedor, codigo_barras }] }
 */
export const aprenderCruceFactura = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const { renglones } = req.body;
        const usuario_id = req.usuario.id;

        if (!Array.isArray(renglones) || renglones.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'No hay renglones que aprender' });
        }

        const orden = await OrdenCompra.findByPk(id, { transaction });
        if (!orden) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
        }

        const resultado = {
            equivalencias: 0,
            proveedores_asignados: 0,
            codigos_asignados: 0,
            codigos_en_revision: 0
        };

        for (const renglon of renglones) {
            const articuloId = parseInt(renglon.articulo_id);
            if (!articuloId) continue;

            const articulo = await Articulo.findByPk(articuloId, { transaction });
            if (!articulo) continue;

            const etiquetaProveedor = (renglon.codigo_proveedor || renglon.descripcion_proveedor || '').trim();

            // 1) Equivalencia proveedor ↔ artículo (así deja de preguntar)
            if (orden.proveedor_id && etiquetaProveedor) {
                const [relacion, creada] = await ArticuloProveedor.findOrCreate({
                    where: { articulo_id: articuloId, proveedor_id: orden.proveedor_id },
                    defaults: {
                        articulo_id: articuloId,
                        proveedor_id: orden.proveedor_id,
                        sku_proveedor: etiquetaProveedor,
                        costo_unitario: parseFloat(renglon.precio_unitario) || articulo.costo_unitario || 0
                    },
                    transaction
                });

                if (!creada && relacion.sku_proveedor !== etiquetaProveedor) {
                    await relacion.update({ sku_proveedor: etiquetaProveedor }, { transaction });
                }
                resultado.equivalencias += 1;
            }

            // 2) Si el artículo no tenía proveedor, se le pone el de esta orden
            if (orden.proveedor_id && !articulo.proveedor_id) {
                await articulo.update({ proveedor_id: orden.proveedor_id }, { transaction });
                resultado.proveedores_asignados += 1;
            }

            // 3) Código de barras del proveedor
            const codigoNuevo = (renglon.codigo_barras || '').trim();
            if (codigoNuevo && codigoNuevo !== articulo.codigo_ean13) {
                const yaUsado = await Articulo.findOne({
                    where: { codigo_ean13: codigoNuevo, id: { [Op.ne]: articuloId } },
                    transaction
                });

                if (yaUsado) {
                    // Otro artículo ya trae ese código: no se toca nada
                    console.log(`⚠️ Código ${codigoNuevo} ya pertenece al artículo ${yaUsado.id}, se ignora`);
                } else if (!articulo.codigo_ean13) {
                    // Sin código propio: se llena solo
                    await articulo.update({ codigo_ean13: codigoNuevo, codigo_tipo: 'CODE128' }, { transaction });
                    resultado.codigos_asignados += 1;
                } else {
                    // Ya tiene código: NO se reemplaza, lo decide el administrador
                    const pendiente = await SolicitudCambio.findOne({
                        where: {
                            tipo: 'cambio_codigo',
                            articulo_id: articuloId,
                            estado: 'pendiente'
                        },
                        transaction
                    });

                    if (!pendiente) {
                        await SolicitudCambio.create({
                            tipo: 'cambio_codigo',
                            articulo_id: articuloId,
                            solicitante_id: usuario_id,
                            estado: 'pendiente',
                            payload: {
                                codigo_ean13: codigoNuevo,
                                codigo_anterior: articulo.codigo_ean13,
                                proveedor_id: orden.proveedor_id,
                                orden_ticket: orden.ticket_id
                            },
                            snapshot: { codigo_ean13: articulo.codigo_ean13 },
                            observaciones: `La factura ${orden.ticket_id} trae el código ${codigoNuevo} para "${articulo.nombre}". Al aprobar se reemplaza y hay que reimprimir su etiqueta.`
                        }, { transaction });
                        resultado.codigos_en_revision += 1;
                    }
                }
            }
        }

        await transaction.commit();

        res.json({
            success: true,
            message: 'Equivalencias guardadas',
            data: resultado
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error en aprenderCruceFactura:', error);
        res.status(500).json({
            success: false,
            message: 'Error al guardar las equivalencias',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/ordenes-compra/:id/conteo
 * Cierra la ventana de reclamo: almacén ya contó pieza por pieza y reporta la
 * cantidad real de cada artículo. La diferencia contra lo que se dio de alta al
 * recibir la factura se ajusta en el stock y se le reporta a compras.
 *
 * Body: { articulos: [{ detalle_id, cantidad_real }], observaciones? }
 */
export const cerrarConteo = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const { articulos, observaciones } = req.body;
        const usuario_id = req.usuario.id;

        const orden = await OrdenCompra.findByPk(id, {
            include: [
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'], required: false },
                {
                    model: DetalleOrdenCompra,
                    as: 'detalles',
                    include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'nombre', 'unidad', 'stock_actual', 'costo_unitario'] }]
                }
            ],
            transaction
        });

        if (!orden) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
        }

        if (orden.conteo_cerrado) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'El conteo de esta orden ya se cerró' });
        }

        const ajustes = [];
        const faltantes = [];
        const sobrantes = [];

        for (const item of articulos || []) {
            const detalle = orden.detalles.find(d => d.id === parseInt(item.detalle_id));
            if (!detalle || !detalle.articulo) continue;

            const cantidadReal = parseFloat(item.cantidad_real);
            if (isNaN(cantidadReal) || cantidadReal < 0) continue;

            const yaRegistrada = parseFloat(detalle.cantidad_recibida) || 0;
            const diferencia = parseFloat((cantidadReal - yaRegistrada).toFixed(2));
            if (diferencia === 0) continue;

            const articulo = await Articulo.findByPk(detalle.articulo.id, { transaction });
            const nuevoStock = parseFloat(articulo.stock_actual) + diferencia;

            await articulo.update({ stock_actual: nuevoStock }, { transaction });
            await detalle.update({ cantidad_recibida: cantidadReal }, { transaction });

            ajustes.push({
                articulo_id: articulo.id,
                nombre: articulo.nombre,
                unidad: articulo.unidad,
                registrado: yaRegistrada,
                contado: cantidadReal,
                diferencia
            });

            const fila = { nombre: articulo.nombre, unidad: articulo.unidad, diferencia: Math.abs(diferencia) };
            if (diferencia < 0) faltantes.push(fila);
            else sobrantes.push(fila);
        }

        // El ajuste queda ligado a la orden para que el historial diga de qué
        // recepción vinieron las piezas que faltaron.
        let movimientoTicket = null;
        if (ajustes.length > 0) {
            const movimiento = await Movimiento.create({
                ticket_id: generarTicketID(),
                tipo: ajustes.some(a => a.diferencia < 0) ? 'ajuste_salida' : 'ajuste_entrada',
                fecha_hora: new Date(),
                usuario_id,
                estado: 'completado',
                orden_compra_id: orden.id,
                observaciones: observaciones || `Conteo de la orden ${orden.ticket_id}`
            }, { transaction });

            for (const aj of ajustes) {
                await DetalleMovimiento.create({
                    movimiento_id: movimiento.id,
                    articulo_id: aj.articulo_id,
                    cantidad: Math.abs(aj.diferencia),
                    observaciones: `Facturado ${aj.registrado} · contado ${aj.contado} (${aj.diferencia > 0 ? '+' : ''}${aj.diferencia})`
                }, { transaction });
            }

            movimientoTicket = movimiento.ticket_id;
        }

        // Reevaluar el estado con las cantidades reales
        const detallesActualizados = await DetalleOrdenCompra.findAll({
            where: { orden_compra_id: orden.id },
            transaction
        });
        const todosCompletos = detallesActualizados.every(
            d => (parseFloat(d.cantidad_recibida) || 0) >= parseFloat(d.cantidad_solicitada)
        );

        await orden.update({
            conteo_cerrado: true,
            estado: todosCompletos ? 'recibida' : orden.estado
        }, { transaction });

        await transaction.commit();

        // Avisos a compras (fuera de la transacción: que un aviso no tire el conteo)
        try {
            const { notificarPorRol } = await import('./notificaciones.controller.js');
            const resumenTexto = faltantes.length === 0 && sobrantes.length === 0
                ? `El conteo de la orden ${orden.ticket_id} cuadró con lo facturado`
                : `Conteo de la orden ${orden.ticket_id}: ${faltantes.length} faltante(s), ${sobrantes.length} sobrante(s)`;

            await notificarPorRol({
                roles: ['compras', 'administrador'],
                tipo: 'orden_recibida_parcial',
                titulo: faltantes.length > 0 ? 'Faltantes en recepción' : 'Conteo terminado',
                mensaje: resumenTexto,
                url: '/ordenes-compra',
                datos_adicionales: {
                    orden_id: orden.id,
                    ticket_id: orden.ticket_id,
                    faltantes,
                    sobrantes,
                    movimiento_ticket: movimientoTicket
                }
            });
        } catch (notifError) {
            console.error('Error al notificar el conteo:', notifError.message);
        }

        try {
            const { avisarComprasFaltantes } = await import('../services/whatsapp.service.js');
            await avisarComprasFaltantes({
                proveedor: orden.proveedor?.nombre,
                ticketOrden: orden.ticket_id,
                faltantes,
                sobrantes
            });
        } catch (waError) {
            console.error('Error al avisar faltantes por WhatsApp:', waError.message);
        }

        res.json({
            success: true,
            message: ajustes.length === 0
                ? 'Conteo cerrado: todo cuadró con lo facturado'
                : `Conteo cerrado: ${ajustes.length} ajuste(s) aplicados`,
            data: { ajustes, faltantes, sobrantes, movimiento_ticket: movimientoTicket }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error en cerrarConteo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cerrar el conteo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/ordenes-compra/conteos-abiertos
 * Órdenes que están dentro de la ventana de reclamo, con los días que faltan.
 */
export const listarConteosAbiertos = async (req, res) => {
    try {
        const ordenes = await OrdenCompra.findAll({
            where: {
                conteo_cerrado: false,
                conteo_hasta: { [Op.ne]: null }
            },
            include: [
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'], required: false },
                {
                    model: DetalleOrdenCompra,
                    as: 'detalles',
                    include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'nombre', 'unidad'] }]
                }
            ],
            order: [['conteo_hasta', 'ASC']]
        });

        const ahora = new Date();

        const resultado = ordenes.map(orden => {
            const limite = new Date(orden.conteo_hasta);
            const diasRestantes = Math.ceil((limite - ahora) / (1000 * 60 * 60 * 24));

            return {
                id: orden.id,
                ticket_id: orden.ticket_id,
                estado: orden.estado,
                proveedor: orden.proveedor?.nombre || null,
                conteo_hasta: orden.conteo_hasta,
                dias_restantes: diasRestantes,
                vencido: diasRestantes <= 0,
                articulos: orden.detalles
                    .filter(d => (parseFloat(d.cantidad_recibida) || 0) > 0)
                    .map(d => ({
                        detalle_id: d.id,
                        articulo_id: d.articulo?.id,
                        nombre: d.articulo?.nombre || 'Artículo',
                        unidad: d.articulo?.unidad || '',
                        cantidad_solicitada: parseFloat(d.cantidad_solicitada) || 0,
                        cantidad_recibida: parseFloat(d.cantidad_recibida) || 0
                    }))
            };
        }).filter(o => o.articulos.length > 0);

        res.json({ success: true, data: { conteos: resultado } });

    } catch (error) {
        console.error('Error en listarConteosAbiertos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener los conteos abiertos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default { analizarFactura, aprenderCruceFactura, cerrarConteo, listarConteosAbiertos };
