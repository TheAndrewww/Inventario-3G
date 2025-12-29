import {
  OrdenCompra,
  DetalleOrdenCompra,
  SolicitudCompra,
  Articulo,
  Usuario,
  Proveedor,
  Categoria,
  Ubicacion,
  Movimiento,
  DetalleMovimiento,
  TipoHerramientaRenta
} from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { notificarPorRol } from './notificaciones.controller.js';
import admin from '../config/firebase-admin.js'; // Importar Firebase Admin

/**
 * Crear una nueva orden de compra
 * - Diseñadores, Almacenistas, Compras y Administradores pueden crear órdenes de compra
 * - Las órdenes de compra NO validan stock, ya que son para traer inventario desde proveedores
 * - Se crea en estado 'borrador' hasta que se envíe al proveedor
 */
export const crearOrdenCompra = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { articulos, proveedor_id, observaciones, fecha_llegada_estimada } = req.body;
    const usuario_id = req.usuario.id;
    const usuario_rol = req.usuario.rol;

    // Validar que el usuario tiene permisos (diseñador, almacen, compras, admin)
    if (!['diseñador', 'almacen', 'compras', 'administrador'].includes(usuario_rol)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para crear órdenes de compra'
      });
    }

    // Validaciones
    if (!articulos || !Array.isArray(articulos) || articulos.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un artículo para la orden'
      });
    }

    // Generar ticket_id único
    const fecha = new Date();
    const ddmmyy = fecha.toISOString().slice(2, 10).replace(/-/g, '').match(/.{2}/g).reverse().join('');
    const hhmm = fecha.toTimeString().slice(0, 5).replace(':', '');

    // Obtener contador del día
    const inicioDelDia = new Date(fecha.setHours(0, 0, 0, 0));
    const finDelDia = new Date(fecha.setHours(23, 59, 59, 999));

    const contadorHoy = await OrdenCompra.count({
      where: {
        created_at: {
          [Op.between]: [inicioDelDia, finDelDia]
        }
      }
    });

    const nn = String(contadorHoy + 1).padStart(2, '0');
    const ticket_id = `OC-${ddmmyy}-${hhmm}-${nn}`;

    // Validar que los artículos existen
    const articuloIds = articulos.map(a => a.articulo_id);
    const articulosDB = await Articulo.findAll({
      where: { id: articuloIds, activo: true }
    });

    if (articulosDB.length !== articuloIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Uno o más artículos no existen o están inactivos'
      });
    }

    // Crear mapa de artículos por ID
    const articulosMap = {};
    articulosDB.forEach(art => {
      articulosMap[art.id] = art;
    });

    // NOTA: Las órdenes de compra NO validan stock porque son para traer inventario
    // desde proveedores externos. A diferencia de los pedidos, aquí NO se verifica
    // disponibilidad de stock actual.

    // Crear la orden de compra
    const ordenCompra = await OrdenCompra.create({
      ticket_id,
      proveedor_id: proveedor_id || null,
      usuario_creador_id: usuario_id,
      estado: 'borrador',
      total_estimado: 0,
      observaciones: observaciones || null,
      fecha_llegada_estimada: fecha_llegada_estimada || null
    }, { transaction });

    // Calcular total estimado
    let totalEstimado = 0;

    // Crear detalles de la orden
    const detalles = [];
    for (const item of articulos) {
      const articulo = articulosMap[item.articulo_id];
      const cantidad = parseFloat(item.cantidad);
      const costo = item.costo_unitario ? parseFloat(item.costo_unitario) : parseFloat(articulo.costo_unitario);
      const subtotal = cantidad * costo;

      totalEstimado += subtotal;

      detalles.push({
        orden_compra_id: ordenCompra.id,
        articulo_id: item.articulo_id,
        cantidad_solicitada: cantidad,
        cantidad_recibida: 0,
        costo_unitario: costo,
        subtotal: subtotal,
        observaciones: item.observaciones || null
      });
    }

    await DetalleOrdenCompra.bulkCreate(detalles, { transaction });

    // Actualizar total estimado de la orden
    ordenCompra.total_estimado = totalEstimado;
    await ordenCompra.save({ transaction });

    await transaction.commit();

    // Obtener la orden completa con sus relaciones
    const ordenCompleta = await OrdenCompra.findByPk(ordenCompra.id, {
      include: [
        {
          model: Usuario,
          as: 'creador',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Proveedor,
          as: 'proveedor',
          attributes: ['id', 'nombre', 'contacto', 'telefono', 'email']
        },
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              include: [
                { model: Categoria, as: 'categoria' },
                { model: Ubicacion, as: 'ubicacion' }
              ]
            }
          ]
        }
      ]
    });

    // Notificar a usuarios con roles de compras y administradores
    try {
      await notificarPorRol({
        roles: ['compras', 'administrador'],
        tipo: 'orden_compra_creada',
        titulo: 'Nueva orden de compra',
        mensaje: `${req.usuario.nombre} creó la orden ${ticket_id} por $${totalEstimado.toFixed(2)}`,
        url: `/ordenes-compra`,
        datos_adicionales: {
          orden_id: ordenCompra.id,
          ticket_id: ticket_id,
          creador: req.usuario.nombre,
          total: totalEstimado
        }
      });
    } catch (notifError) {
      console.error('Error al enviar notificación:', notifError);
      // No fallar la creación de la orden si falla la notificación
    }

    // --- INTEGRACIÓN IMPRESIÓN AUTOMÁTICA ---
    try {
      const db = admin.firestore();

      // Preparar datos de la orden para el agente de impresión
      const datosOrden = {
        ticket_id: ticket_id,
        fecha: new Date().toISOString(),
        proveedor: ordenCompleta.proveedor?.nombre || 'Sin proveedor',
        creador: ordenCompleta.creador?.nombre || 'Sistema',
        total_estimado: totalEstimado,
        observaciones: observaciones || '',
        articulos: ordenCompleta.detalles.map(d => ({
          nombre: d.articulo?.nombre || 'Artículo',
          cantidad: d.cantidad_solicitada,
          unidad: d.articulo?.unidad || 'pz',
          costo_unitario: d.costo_unitario,
          subtotal: d.subtotal
        }))
      };

      await db.collection('cola_impresion').add({
        tipo: 'orden_compra',
        datos: datosOrden,
        orden_id: ordenCompra.id,
        ticket_id: ticket_id,
        estado: 'pendiente',
        created_at: new Date(),
        printer: 'TicketPrinter'
      });
      console.log(`🖨️ Solicitud de impresión enviada a Firebase para orden ${ticket_id}`);
    } catch (printError) {
      console.error('❌ Error al enviar a cola de impresión:', printError);
      // No bloqueamos la respuesta si falla la impresión
    }
    // ----------------------------------------

    res.status(201).json({
      success: true,
      message: 'Orden de compra creada exitosamente',
      data: {
        orden: ordenCompleta
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al crear orden de compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la orden de compra',
      error: error.message
    });
  }
};

/**
 * Listar todas las órdenes de compra
 */
export const listarOrdenesCompra = async (req, res) => {
  try {
    const {
      estado,
      proveedor_id,
      fecha_inicio,
      fecha_fin,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construir filtros
    const where = {};

    if (estado) where.estado = estado;
    if (proveedor_id) where.proveedor_id = parseInt(proveedor_id);
    if (fecha_inicio || fecha_fin) {
      where.created_at = {};
      if (fecha_inicio) where.created_at[Op.gte] = new Date(fecha_inicio);
      if (fecha_fin) where.created_at[Op.lte] = new Date(fecha_fin);
    }

    const { count, rows: ordenes } = await OrdenCompra.findAndCountAll({
      where,
      include: [
        {
          model: Usuario,
          as: 'creador',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Proveedor,
          as: 'proveedor',
          attributes: ['id', 'nombre']
        },
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              attributes: ['id', 'codigo_ean13', 'nombre', 'unidad']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json({
      success: true,
      data: {
        ordenes,
        paginacion: {
          total: count,
          pagina_actual: parseInt(page),
          total_paginas: Math.ceil(count / parseInt(limit)),
          por_pagina: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error al listar órdenes de compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la lista de órdenes de compra',
      error: error.message
    });
  }
};

/**
 * Obtener una orden de compra por ID
 */
export const obtenerOrdenCompra = async (req, res) => {
  try {
    const { id } = req.params;

    const orden = await OrdenCompra.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: 'creador',
          attributes: ['id', 'nombre', 'email', 'rol', 'puesto']
        },
        {
          model: Proveedor,
          as: 'proveedor'
        },
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              include: [
                { model: Categoria, as: 'categoria' },
                { model: Ubicacion, as: 'ubicacion' }
              ]
            }
          ]
        },
        {
          model: SolicitudCompra,
          as: 'solicitudes_origen',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              attributes: ['id', 'nombre', 'unidad']
            }
          ]
        }
      ]
    });

    if (!orden) {
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: { orden }
    });

  } catch (error) {
    console.error('Error al obtener orden de compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la orden de compra',
      error: error.message
    });
  }
};

/**
 * Listar todas las solicitudes de compra
 */
export const listarSolicitudesCompra = async (req, res) => {
  try {
    const {
      estado,
      prioridad,
      articulo_id,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construir filtros
    const where = {};

    if (estado) where.estado = estado;
    if (prioridad) where.prioridad = prioridad;
    if (articulo_id) where.articulo_id = parseInt(articulo_id);

    const { count, rows: solicitudes } = await SolicitudCompra.findAndCountAll({
      where,
      include: [
        {
          model: Articulo,
          as: 'articulo',
          include: [
            { model: Categoria, as: 'categoria' },
            { model: Proveedor, as: 'proveedor' },
            {
              model: TipoHerramientaRenta,
              as: 'tipo_herramienta_migrado',
              required: false,
              include: [
                {
                  model: Proveedor,
                  as: 'proveedor',
                  required: false
                }
              ]
            }
          ]
        },
        {
          model: Usuario,
          as: 'solicitante',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Movimiento,
          as: 'pedidoOrigen',
          attributes: ['id', 'ticket_id', 'tipo']
        },
        {
          model: OrdenCompra,
          as: 'ordenCompra',
          attributes: ['id', 'ticket_id', 'estado']
        }
      ],
      order: [
        ['prioridad', 'DESC'],
        ['created_at', 'DESC']
      ],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json({
      success: true,
      data: {
        solicitudes,
        paginacion: {
          total: count,
          pagina_actual: parseInt(page),
          total_paginas: Math.ceil(count / parseInt(limit)),
          por_pagina: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error al listar solicitudes de compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la lista de solicitudes de compra',
      error: error.message
    });
  }
};

/**
 * Enviar orden de compra al proveedor (cambiar estado a "enviada")
 */
export const enviarOrdenCompra = async (req, res) => {
  try {
    const { id } = req.params;

    const orden = await OrdenCompra.findByPk(id);

    if (!orden) {
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }

    if (orden.estado !== 'borrador') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden enviar órdenes en estado borrador'
      });
    }

    orden.estado = 'enviada';
    orden.fecha_envio = new Date();
    await orden.save();

    res.status(200).json({
      success: true,
      message: 'Orden de compra enviada al proveedor',
      data: { orden }
    });

  } catch (error) {
    console.error('Error al enviar orden de compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar la orden de compra',
      error: error.message
    });
  }
};

/**
 * Actualizar estado de una orden de compra
 */
export const actualizarEstadoOrden = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['borrador', 'enviada', 'parcial', 'recibida', 'cancelada'];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    const orden = await OrdenCompra.findByPk(id);

    if (!orden) {
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }

    const estadoAnterior = orden.estado;
    orden.estado = estado;

    if (estado === 'recibida') {
      orden.fecha_recepcion = new Date();
    }

    await orden.save();

    // Notificar al creador de la orden sobre el cambio de estado
    try {
      await notificarPorRol({
        roles: ['compras', 'administrador', 'almacen'],
        tipo: 'orden_estado_cambiado',
        titulo: 'Orden de compra actualizada',
        mensaje: `La orden ${orden.ticket_id} cambió de ${estadoAnterior} a ${estado}`,
        url: `/ordenes-compra`,
        datos_adicionales: {
          orden_id: orden.id,
          ticket_id: orden.ticket_id,
          estado_anterior: estadoAnterior,
          estado_nuevo: estado
        }
      });
    } catch (notifError) {
      console.error('Error al enviar notificación:', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Estado de orden actualizado',
      data: { orden }
    });

  } catch (error) {
    console.error('Error al actualizar estado de orden:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el estado',
      error: error.message
    });
  }
};

/**
 * Actualizar una orden de compra existente
 * - Solo se pueden actualizar órdenes en estado 'borrador'
 * - Permite actualizar proveedor, observaciones, fecha estimada y artículos
 * - Recalcula el total estimado
 */
export const actualizarOrdenCompra = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { articulos, proveedor_id, observaciones, fecha_llegada_estimada } = req.body;
    const usuario_rol = req.usuario.rol;

    // Validar permisos
    if (!['compras', 'almacen', 'administrador'].includes(usuario_rol)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para actualizar órdenes de compra'
      });
    }

    // Buscar la orden
    const orden = await OrdenCompra.findByPk(id, {
      include: [
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [{ model: Articulo, as: 'articulo' }]
        }
      ]
    });

    if (!orden) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }

    // Verificar que la orden está en estado 'borrador'
    if (orden.estado !== 'borrador') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden editar órdenes en estado borrador'
      });
    }

    // Validaciones de artículos si se proporcionan
    if (articulos && Array.isArray(articulos) && articulos.length > 0) {
      // Validar que los artículos existen
      const articuloIds = articulos.map(a => a.articulo_id);
      const articulosDB = await Articulo.findAll({
        where: { id: articuloIds, activo: true }
      });

      if (articulosDB.length !== articuloIds.length) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Uno o más artículos no existen o están inactivos'
        });
      }

      // Crear mapa de artículos por ID
      const articulosMap = {};
      articulosDB.forEach(art => {
        articulosMap[art.id] = art;
      });

      // Eliminar detalles existentes
      await DetalleOrdenCompra.destroy({
        where: { orden_compra_id: id },
        transaction
      });

      // Crear nuevos detalles
      let total_estimado = 0;

      for (const item of articulos) {
        const articulo = articulosMap[item.articulo_id];
        const cantidad = parseFloat(item.cantidad);
        const costo_unitario = parseFloat(item.costo_unitario || articulo.costo_unitario || 0);
        const subtotal = cantidad * costo_unitario;

        await DetalleOrdenCompra.create({
          orden_compra_id: orden.id,
          articulo_id: item.articulo_id,
          cantidad_solicitada: cantidad,
          costo_unitario: costo_unitario,
          subtotal: subtotal,
          cantidad_recibida: 0
        }, { transaction });

        total_estimado += subtotal;
      }

      // Actualizar total estimado
      orden.total_estimado = total_estimado;
    }

    // Actualizar campos de la orden
    if (proveedor_id !== undefined) {
      orden.proveedor_id = proveedor_id;
    }

    if (observaciones !== undefined) {
      orden.observaciones = observaciones;
    }

    if (fecha_llegada_estimada !== undefined) {
      orden.fecha_llegada_estimada = fecha_llegada_estimada;
    }

    await orden.save({ transaction });

    // Commit de la transacción
    await transaction.commit();

    // Obtener la orden actualizada con todas las relaciones
    const ordenActualizada = await OrdenCompra.findByPk(id, {
      include: [
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              include: [
                { model: Categoria, as: 'categoria' },
                { model: Ubicacion, as: 'ubicacion' }
              ]
            }
          ]
        },
        { model: Proveedor, as: 'proveedor' },
        { model: Usuario, as: 'usuarioCreador', attributes: ['id', 'nombre', 'email'] }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Orden de compra actualizada exitosamente',
      data: { orden: ordenActualizada }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al actualizar orden de compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la orden de compra',
      error: error.message
    });
  }
};

/**
 * Crear orden de compra desde solicitudes pendientes
 * - Toma solicitudes seleccionadas y crea una orden
 * - Actualiza el estado de las solicitudes a 'en_orden'
 * - Vincula las solicitudes con la orden creada
 */
export const crearOrdenDesdeSolicitudes = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { solicitudes_ids, proveedor_id, observaciones, cantidades_custom, fecha_llegada_estimada } = req.body;
    const usuario_id = req.usuario.id;

    // Validaciones
    if (!solicitudes_ids || !Array.isArray(solicitudes_ids) || solicitudes_ids.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos una solicitud para crear la orden'
      });
    }

    // Obtener las solicitudes con sus artículos
    const solicitudes = await SolicitudCompra.findAll({
      where: {
        id: solicitudes_ids,
        estado: 'pendiente' // Solo solicitudes pendientes
      },
      include: [
        {
          model: Articulo,
          as: 'articulo',
          include: [
            { model: Categoria, as: 'categoria' },
            { model: Proveedor, as: 'proveedor' }
          ]
        }
      ],
      transaction
    });

    if (solicitudes.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se encontraron solicitudes pendientes con los IDs proporcionados'
      });
    }

    if (solicitudes.length !== solicitudes_ids.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Algunas solicitudes no están disponibles o ya fueron procesadas'
      });
    }

    // Generar ticket_id único para la orden
    const fecha = new Date();
    const ddmmyy = fecha.toISOString().slice(2, 10).replace(/-/g, '').match(/.{2}/g).reverse().join('');
    const hhmm = fecha.toTimeString().slice(0, 5).replace(':', '');

    const inicioDelDia = new Date(fecha.setHours(0, 0, 0, 0));
    const finDelDia = new Date(fecha.setHours(23, 59, 59, 999));

    const contadorHoy = await OrdenCompra.count({
      where: {
        created_at: {
          [Op.between]: [inicioDelDia, finDelDia]
        }
      },
      transaction
    });

    const nn = String(contadorHoy + 1).padStart(2, '0');
    const ticket_id = `OC-${ddmmyy}-${hhmm}-${nn}`;

    // Calcular total estimado y preparar detalles
    let totalEstimado = 0;
    const detalles = [];
    const articulosMap = new Map();

    for (const solicitud of solicitudes) {
      const articulo = solicitud.articulo;
      const cantidadOriginal = parseFloat(solicitud.cantidad_solicitada);
      const costo = parseFloat(articulo.costo_unitario) || 0;

      // Si ya existe el artículo en la orden
      if (articulosMap.has(articulo.id)) {
        const itemExistente = articulosMap.get(articulo.id);

        // Si hay cantidad personalizada, NO sumar (ya se usó la cantidad custom)
        if (!cantidades_custom || !cantidades_custom[articulo.id]) {
          // Solo sumar si NO hay cantidad personalizada
          itemExistente.cantidad += cantidadOriginal;
          itemExistente.subtotal = itemExistente.cantidad * costo;
        }

        // Agregar ticket_id a observaciones
        itemExistente.observaciones += `, ${solicitud.ticket_id}`;
      } else {
        // Primera vez que vemos este artículo
        const cantidad = cantidades_custom && cantidades_custom[articulo.id]
          ? parseFloat(cantidades_custom[articulo.id])
          : cantidadOriginal;

        const subtotal = cantidad * costo;

        articulosMap.set(articulo.id, {
          articulo_id: articulo.id,
          cantidad,
          costo_unitario: costo,
          subtotal,
          observaciones: `Desde solicitud(es): ${solicitud.ticket_id}`
        });
      }
    }

    // Calcular total estimado
    for (const [_, detalle] of articulosMap) {
      totalEstimado += detalle.subtotal;
    }

    // Crear la orden de compra
    const ordenCompra = await OrdenCompra.create({
      ticket_id,
      proveedor_id: proveedor_id || null,
      usuario_creador_id: usuario_id,
      estado: 'borrador',
      total_estimado: totalEstimado,
      observaciones: observaciones || `Orden creada desde ${solicitudes.length} solicitud(es) pendiente(s)`,
      fecha_llegada_estimada: fecha_llegada_estimada || null
    }, { transaction });

    // Crear detalles de la orden
    for (const [articulo_id, detalle] of articulosMap) {
      detalles.push({
        orden_compra_id: ordenCompra.id,
        articulo_id: detalle.articulo_id,
        cantidad_solicitada: detalle.cantidad,
        cantidad_recibida: 0,
        costo_unitario: detalle.costo_unitario,
        subtotal: detalle.subtotal,
        observaciones: detalle.observaciones
      });
    }

    await DetalleOrdenCompra.bulkCreate(detalles, { transaction });

    // Actualizar estado de las solicitudes a 'en_orden' y vincular con la orden
    await SolicitudCompra.update(
      {
        estado: 'en_orden',
        orden_compra_id: ordenCompra.id
      },
      {
        where: { id: solicitudes_ids },
        transaction
      }
    );

    await transaction.commit();

    // Obtener la orden completa con sus relaciones
    const ordenCompleta = await OrdenCompra.findByPk(ordenCompra.id, {
      include: [
        {
          model: Usuario,
          as: 'creador',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Proveedor,
          as: 'proveedor',
          attributes: ['id', 'nombre', 'contacto', 'telefono', 'email']
        },
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              include: [
                { model: Categoria, as: 'categoria' },
                { model: Ubicacion, as: 'ubicacion' }
              ]
            }
          ]
        },
        {
          model: SolicitudCompra,
          as: 'solicitudes_origen',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              attributes: ['id', 'nombre', 'unidad']
            }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: `Orden de compra creada exitosamente desde ${solicitudes.length} solicitud(es)`,
      data: {
        orden: ordenCompleta,
        solicitudes_procesadas: solicitudes.length
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al crear orden desde solicitudes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la orden de compra desde solicitudes',
      error: error.message
    });
  }
};

// Obtener estadísticas generales de órdenes de compra
export const obtenerEstadisticas = async (req, res) => {
  try {
    // Contar solicitudes pendientes
    const solicitudesPendientes = await SolicitudCompra.count({
      where: { estado: 'pendiente' }
    });

    // Contar órdenes en borrador
    const ordenesBorrador = await OrdenCompra.count({
      where: { estado: 'borrador' }
    });

    // Contar órdenes enviadas (esperando entrega)
    const ordenesEnviadas = await OrdenCompra.count({
      where: { estado: 'enviada' }
    });

    // Calcular total estimado de órdenes del mes actual
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const finMes = new Date();
    finMes.setMonth(finMes.getMonth() + 1);
    finMes.setDate(0);
    finMes.setHours(23, 59, 59, 999);

    const ordenesMes = await OrdenCompra.findAll({
      where: {
        created_at: {
          [Op.between]: [inicioMes, finMes]
        }
      },
      attributes: ['total_estimado']
    });

    const totalEstimadoMes = ordenesMes.reduce((sum, orden) => {
      return sum + parseFloat(orden.total_estimado || 0);
    }, 0);

    // Obtener distribución de solicitudes por prioridad
    const solicitudesPorPrioridad = await SolicitudCompra.findAll({
      where: { estado: 'pendiente' },
      attributes: [
        'prioridad',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total']
      ],
      group: ['prioridad']
    });

    const distribucionPrioridad = {
      urgente: 0,
      alta: 0,
      media: 0,
      baja: 0
    };

    solicitudesPorPrioridad.forEach(item => {
      const prioridad = item.prioridad || 'media';
      distribucionPrioridad[prioridad] = parseInt(item.dataValues.total);
    });

    // Obtener órdenes recientes (últimas 5)
    const ordenesRecientes = await OrdenCompra.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Usuario,
          as: 'creador',
          attributes: ['nombre', 'rol']
        },
        {
          model: Proveedor,
          as: 'proveedor',
          attributes: ['nombre']
        }
      ],
      attributes: ['id', 'ticket_id', 'estado', 'total_estimado', 'created_at']
    });

    res.status(200).json({
      success: true,
      data: {
        resumen: {
          solicitudesPendientes,
          ordenesBorrador,
          ordenesEnviadas,
          totalEstimadoMes
        },
        distribucionPrioridad,
        ordenesRecientes
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las estadísticas',
      error: error.message
    });
  }
};

/**
 * Obtener historial de trazabilidad de una orden de compra
 * Muestra: solicitudes → pedidos origen → usuarios involucrados
 */
export const obtenerHistorialTrazabilidad = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener la orden de compra con todas sus relaciones
    const orden = await OrdenCompra.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: 'creador',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Proveedor,
          as: 'proveedor',
          attributes: ['id', 'nombre', 'contacto', 'telefono', 'email']
        },
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              attributes: ['id', 'nombre', 'codigo_ean13', 'unidad', 'stock_actual', 'stock_minimo']
            }
          ]
        },
        {
          model: SolicitudCompra,
          as: 'solicitudes_origen',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              attributes: ['id', 'nombre', 'unidad']
            },
            {
              model: Usuario,
              as: 'solicitante',
              attributes: ['id', 'nombre', 'rol']
            },
            {
              model: Movimiento,
              as: 'pedidoOrigen',
              include: [
                {
                  model: Usuario,
                  as: 'usuario',
                  attributes: ['id', 'nombre', 'rol']
                },
                {
                  model: Usuario,
                  as: 'aprobadoPor',
                  attributes: ['id', 'nombre', 'rol']
                }
              ]
            }
          ]
        }
      ]
    });

    if (!orden) {
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }

    // Construir timeline de eventos
    const timeline = [];

    // 1. Eventos de pedidos origen (si existen)
    const pedidosUnicos = new Map();
    orden.solicitudes_origen?.forEach(solicitud => {
      if (solicitud.pedidoOrigen && !pedidosUnicos.has(solicitud.pedidoOrigen.id)) {
        pedidosUnicos.set(solicitud.pedidoOrigen.id, solicitud.pedidoOrigen);

        timeline.push({
          tipo: 'pedido_creado',
          fecha: solicitud.pedidoOrigen.created_at,
          titulo: `Pedido ${solicitud.pedidoOrigen.ticket_id} creado`,
          descripcion: `${solicitud.pedidoOrigen.usuario.nombre} creó un pedido que generó necesidad de compra`,
          usuario: solicitud.pedidoOrigen.usuario,
          datos: {
            pedido_id: solicitud.pedidoOrigen.id,
            ticket_id: solicitud.pedidoOrigen.ticket_id,
            proyecto: solicitud.pedidoOrigen.proyecto,
            estado: solicitud.pedidoOrigen.estado
          }
        });

        // Si el pedido fue aprobado
        if (solicitud.pedidoOrigen.aprobadoPor) {
          timeline.push({
            tipo: 'pedido_aprobado',
            fecha: solicitud.pedidoOrigen.fecha_aprobacion,
            titulo: `Pedido ${solicitud.pedidoOrigen.ticket_id} aprobado`,
            descripcion: `${solicitud.pedidoOrigen.aprobadoPor.nombre} aprobó el pedido`,
            usuario: solicitud.pedidoOrigen.aprobadoPor,
            datos: {
              pedido_id: solicitud.pedidoOrigen.id,
              ticket_id: solicitud.pedidoOrigen.ticket_id
            }
          });
        }
      }
    });

    // 2. Eventos de solicitudes de compra
    orden.solicitudes_origen?.forEach(solicitud => {
      timeline.push({
        tipo: 'solicitud_creada',
        fecha: solicitud.created_at,
        titulo: `Solicitud ${solicitud.ticket_id} creada`,
        descripcion: `Se solicitó compra de ${solicitud.cantidad_solicitada} ${solicitud.articulo.unidad} de ${solicitud.articulo.nombre}`,
        usuario: solicitud.solicitante,
        datos: {
          solicitud_id: solicitud.id,
          ticket_id: solicitud.ticket_id,
          articulo: solicitud.articulo.nombre,
          cantidad: solicitud.cantidad_solicitada,
          prioridad: solicitud.prioridad,
          motivo: solicitud.motivo
        }
      });
    });

    // 3. Evento de creación de orden de compra
    timeline.push({
      tipo: 'orden_creada',
      fecha: orden.created_at,
      titulo: `Orden de compra ${orden.ticket_id} creada`,
      descripcion: `${orden.creador.nombre} creó la orden de compra para ${orden.proveedor.nombre}`,
      usuario: orden.creador,
      datos: {
        orden_id: orden.id,
        ticket_id: orden.ticket_id,
        proveedor: orden.proveedor.nombre,
        total_estimado: orden.total_estimado,
        articulos_count: orden.detalles.length
      }
    });

    // 4. Evento de envío (si existe)
    if (orden.fecha_envio) {
      timeline.push({
        tipo: 'orden_enviada',
        fecha: orden.fecha_envio,
        titulo: `Orden enviada al proveedor`,
        descripcion: `La orden fue enviada a ${orden.proveedor.nombre}`,
        usuario: null,
        datos: {
          orden_id: orden.id,
          ticket_id: orden.ticket_id
        }
      });
    }

    // 5. Evento de recepción (si existe)
    if (orden.fecha_recepcion) {
      timeline.push({
        tipo: 'orden_recibida',
        fecha: orden.fecha_recepcion,
        titulo: `Orden recibida`,
        descripcion: `Se recibieron los artículos de la orden`,
        usuario: null,
        datos: {
          orden_id: orden.id,
          ticket_id: orden.ticket_id
        }
      });
    }

    // Ordenar timeline por fecha (más antiguo primero)
    timeline.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Construir árbol de dependencias
    const arbolDependencias = {
      orden: {
        id: orden.id,
        ticket_id: orden.ticket_id,
        estado: orden.estado,
        total_estimado: orden.total_estimado,
        proveedor: orden.proveedor.nombre
      },
      solicitudes: orden.solicitudes_origen?.map(sol => ({
        id: sol.id,
        ticket_id: sol.ticket_id,
        articulo: sol.articulo.nombre,
        cantidad: sol.cantidad_solicitada,
        prioridad: sol.prioridad,
        pedido_origen: sol.pedidoOrigen ? {
          id: sol.pedidoOrigen.id,
          ticket_id: sol.pedidoOrigen.ticket_id,
          proyecto: sol.pedidoOrigen.proyecto,
          usuario: sol.pedidoOrigen.usuario.nombre
        } : null
      })) || []
    };

    res.status(200).json({
      success: true,
      data: {
        orden: {
          id: orden.id,
          ticket_id: orden.ticket_id,
          estado: orden.estado,
          total_estimado: orden.total_estimado,
          observaciones: orden.observaciones,
          fecha_envio: orden.fecha_envio,
          fecha_recepcion: orden.fecha_recepcion,
          created_at: orden.created_at,
          creador: orden.creador,
          proveedor: orden.proveedor,
          detalles: orden.detalles
        },
        timeline,
        arbolDependencias,
        estadisticas: {
          total_solicitudes: orden.solicitudes_origen?.length || 0,
          total_pedidos_origen: pedidosUnicos.size,
          total_articulos: orden.detalles.length,
          usuarios_involucrados: [...new Set([
            orden.creador.id,
            ...orden.solicitudes_origen?.map(s => s.solicitante.id) || [],
            ...Array.from(pedidosUnicos.values()).map(p => p.usuario.id)
          ])].length
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener historial de trazabilidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el historial de trazabilidad',
      error: error.message
    });
  }
};

/**
 * Anular una orden de compra completamente
 * - Revierte el stock si la orden fue recibida (parcial o totalmente)
 * - Cambia el estado de las solicitudes vinculadas de 'en_orden' a 'pendiente'
 * - Marca la orden como 'cancelada'
 * - Notifica a los usuarios involucrados
 * - Solo accesible para: compras, almacén, administrador
 */
export const anularOrdenCompra = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const usuario_anulador = req.usuario;

    // Validar que el motivo sea proporcionado
    if (!motivo || motivo.trim().length < 10) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un motivo de anulación de al menos 10 caracteres'
      });
    }

    // Validar permisos (solo compras, almacén, administrador)
    if (!['compras', 'almacen', 'administrador'].includes(usuario_anulador.rol)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para anular órdenes de compra'
      });
    }

    // Obtener la orden con todas sus relaciones
    const orden = await OrdenCompra.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: 'creador',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Proveedor,
          as: 'proveedor',
          attributes: ['id', 'nombre']
        },
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo'
            }
          ]
        },
        {
          model: SolicitudCompra,
          as: 'solicitudes_origen'
        }
      ],
      transaction
    });

    if (!orden) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }

    // Validar que la orden pueda ser anulada
    if (orden.estado === 'cancelada') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Esta orden ya está cancelada'
      });
    }

    // Inicializar reporte de reversiones
    const reversiones = {
      stock_revertido: [],
      solicitudes_reactivadas: [],
      movimientos_creados: []
    };

    // 1. REVERTIR STOCK si la orden fue recibida (parcial o totalmente)
    if (orden.estado === 'recibida' || orden.estado === 'parcial') {
      const articulosConStock = orden.detalles.filter(detalle =>
        parseFloat(detalle.cantidad_recibida) > 0
      );

      if (articulosConStock.length > 0) {
        // Crear movimiento de ajuste de salida para revertir el stock
        const fecha = new Date();
        const ddmmyy = fecha.toISOString().slice(2, 10).replace(/-/g, '').match(/.{2}/g).reverse().join('');
        const hhmm = fecha.toTimeString().slice(0, 5).replace(':', '');

        const inicioDelDia = new Date(fecha.setHours(0, 0, 0, 0));
        const finDelDia = new Date(fecha.setHours(23, 59, 59, 999));

        const contadorHoy = await Movimiento.count({
          where: {
            created_at: {
              [Op.between]: [inicioDelDia, finDelDia]
            }
          },
          transaction
        });

        const nn = String(contadorHoy + 1).padStart(2, '0');
        const ticket_id_movimiento = `MOV-${ddmmyy}-${hhmm}-${nn}`;

        // Crear movimiento de ajuste
        const movimiento = await Movimiento.create({
          ticket_id: ticket_id_movimiento,
          tipo: 'ajuste_salida',
          usuario_id: usuario_anulador.id,
          estado: 'completado',
          observaciones: `Reversión de orden de compra ${orden.ticket_id} anulada. Motivo: ${motivo}`
        }, { transaction });

        // Revertir stock de cada artículo
        for (const detalle of articulosConStock) {
          const articulo = detalle.articulo;
          const cantidadRecibida = parseFloat(detalle.cantidad_recibida);
          const stockAntes = parseFloat(articulo.stock_actual);
          const stockDespues = stockAntes - cantidadRecibida;

          // Actualizar stock del artículo
          await articulo.update({
            stock_actual: stockDespues
          }, { transaction });

          reversiones.stock_revertido.push({
            articulo_id: articulo.id,
            nombre: articulo.nombre,
            cantidad_revertida: cantidadRecibida,
            stock_antes: stockAntes,
            stock_despues: stockDespues
          });
        }

        reversiones.movimientos_creados.push({
          ticket_id: ticket_id_movimiento,
          tipo: 'ajuste_salida',
          articulos_afectados: articulosConStock.length
        });
      }
    }

    // 2. REACTIVAR SOLICITUDES DE COMPRA vinculadas
    if (orden.solicitudes_origen && orden.solicitudes_origen.length > 0) {
      const solicitudesIds = orden.solicitudes_origen.map(s => s.id);

      // Cambiar estado de solicitudes de 'en_orden' a 'pendiente'
      await SolicitudCompra.update(
        {
          estado: 'pendiente',
          orden_compra_id: null
        },
        {
          where: {
            id: solicitudesIds,
            estado: 'en_orden'
          },
          transaction
        }
      );

      reversiones.solicitudes_reactivadas = orden.solicitudes_origen.map(sol => ({
        ticket_id: sol.ticket_id,
        articulo: sol.articulo?.nombre || 'N/A',
        cantidad: sol.cantidad_solicitada,
        estado_anterior: 'en_orden'
      }));
    }

    // 3. MARCAR ORDEN COMO CANCELADA
    await orden.update({
      estado: 'cancelada',
      observaciones: orden.observaciones
        ? `${orden.observaciones}\n\n[ANULADA] ${new Date().toLocaleString('es-MX')}: ${motivo}`
        : `[ANULADA] ${new Date().toLocaleString('es-MX')}: ${motivo}`
    }, { transaction });

    await transaction.commit();

    // 4. NOTIFICAR a usuarios relevantes
    try {
      // Notificar al creador de la orden
      await notificarPorRol({
        roles: ['compras', 'administrador'],
        tipo: 'orden_anulada',
        titulo: 'Orden de compra anulada',
        mensaje: `${usuario_anulador.nombre} anuló la orden ${orden.ticket_id}. Motivo: ${motivo}`,
        url: `/ordenes-compra`,
        datos_adicionales: {
          orden_id: orden.id,
          ticket_id: orden.ticket_id,
          anulado_por: usuario_anulador.nombre,
          motivo,
          stock_revertido: reversiones.stock_revertido.length,
          solicitudes_reactivadas: reversiones.solicitudes_reactivadas.length
        }
      });
    } catch (notifError) {
      console.error('Error al enviar notificación:', notifError);
      // No fallar la anulación si falla la notificación
    }

    res.status(200).json({
      success: true,
      message: `Orden de compra ${orden.ticket_id} anulada exitosamente`,
      data: {
        orden: {
          id: orden.id,
          ticket_id: orden.ticket_id,
          estado: 'cancelada'
        },
        reversiones
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al anular orden de compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al anular la orden de compra',
      error: error.message
    });
  }
};

/**
 * Cancelar una solicitud de compra
 * - Cambia el estado de la solicitud a 'cancelada'
 * - Solo se pueden cancelar solicitudes en estado 'pendiente'
 * - Accesible para: compras, almacén, diseñador (propio), administrador
 */
export const cancelarSolicitudCompra = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const usuario_cancelador = req.usuario;

    // Validar que el motivo sea proporcionado
    if (!motivo || motivo.trim().length < 10) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un motivo de cancelación de al menos 10 caracteres'
      });
    }

    // Obtener la solicitud
    const solicitud = await SolicitudCompra.findByPk(id, {
      include: [
        {
          model: Articulo,
          as: 'articulo',
          attributes: ['id', 'nombre', 'unidad']
        },
        {
          model: Usuario,
          as: 'solicitante',
          attributes: ['id', 'nombre', 'rol']
        }
      ],
      transaction
    });

    if (!solicitud) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Solicitud de compra no encontrada'
      });
    }

    // Validar que la solicitud pueda ser cancelada
    if (solicitud.estado !== 'pendiente') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `No se puede cancelar una solicitud en estado '${solicitud.estado}'. Solo se pueden cancelar solicitudes pendientes.`
      });
    }

    // Validar permisos
    const esPropio = solicitud.usuario_solicitante_id === usuario_cancelador.id;
    const tienePermisoRol = ['compras', 'almacen', 'administrador'].includes(usuario_cancelador.rol);

    if (!esPropio && !tienePermisoRol) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para cancelar esta solicitud'
      });
    }

    // Cancelar la solicitud
    await solicitud.update({
      estado: 'cancelada',
      motivo: solicitud.motivo
        ? `${solicitud.motivo}\n\n[CANCELADA] ${new Date().toLocaleString('es-MX')}: ${motivo}`
        : `[CANCELADA] ${new Date().toLocaleString('es-MX')}: ${motivo}`
    }, { transaction });

    await transaction.commit();

    // Notificar a usuarios relevantes
    try {
      await notificarPorRol({
        roles: ['compras', 'administrador'],
        tipo: 'solicitud_cancelada',
        titulo: 'Solicitud de compra cancelada',
        mensaje: `${usuario_cancelador.nombre} canceló la solicitud ${solicitud.ticket_id} de ${solicitud.articulo.nombre}. Motivo: ${motivo}`,
        url: `/ordenes-compra`,
        datos_adicionales: {
          solicitud_id: solicitud.id,
          ticket_id: solicitud.ticket_id,
          cancelado_por: usuario_cancelador.nombre,
          articulo: solicitud.articulo.nombre,
          cantidad: solicitud.cantidad_solicitada,
          motivo
        }
      });
    } catch (notifError) {
      console.error('Error al enviar notificación:', notifError);
    }

    res.status(200).json({
      success: true,
      message: `Solicitud de compra ${solicitud.ticket_id} cancelada exitosamente`,
      data: {
        solicitud: {
          id: solicitud.id,
          ticket_id: solicitud.ticket_id,
          estado: 'cancelada',
          articulo: solicitud.articulo.nombre,
          cantidad: solicitud.cantidad_solicitada
        }
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al cancelar solicitud de compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar la solicitud de compra',
      error: error.message
    });
  }
};

/**
 * Crear solicitud de compra manual
 * - Permite a usuarios crear solicitudes de compra manualmente para cualquier artículo
 */
export const crearSolicitudCompraManual = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { articulo_id, cantidad_solicitada, prioridad, motivo } = req.body;
    const usuario_id = req.usuario.id;
    const usuario_rol = req.usuario.rol;

    // Validar permisos (compras, almacen, administrador, diseñador)
    if (!['compras', 'almacen', 'administrador', 'diseñador'].includes(usuario_rol)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para crear solicitudes de compra'
      });
    }

    // Validaciones
    if (!articulo_id || !cantidad_solicitada) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar el artículo y la cantidad solicitada'
      });
    }

    if (parseFloat(cantidad_solicitada) <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'La cantidad solicitada debe ser mayor a 0'
      });
    }

    // Verificar que el artículo existe
    const articulo = await Articulo.findByPk(articulo_id, { transaction });
    if (!articulo) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Artículo no encontrado'
      });
    }

    // Generar ticket_id para la solicitud
    const fechaSolicitud = new Date();
    const ddmmyySC = fechaSolicitud.toISOString().slice(2, 10).replace(/-/g, '').match(/.{2}/g).reverse().join('');
    const hhmmSC = fechaSolicitud.toTimeString().slice(0, 5).replace(':', '');

    const inicioDelDia = new Date(fechaSolicitud.setHours(0, 0, 0, 0));
    const finDelDia = new Date(fechaSolicitud.setHours(23, 59, 59, 999));

    const contadorHoy = await SolicitudCompra.count({
      where: {
        created_at: {
          [Op.between]: [inicioDelDia, finDelDia]
        }
      },
      transaction
    });

    const nnSC = String(contadorHoy + 1).padStart(2, '0');
    const ticket_id_solicitud = `SC-${ddmmyySC}-${hhmmSC}-${nnSC}`;

    // Crear la solicitud
    const solicitud = await SolicitudCompra.create({
      ticket_id: ticket_id_solicitud,
      articulo_id: articulo_id,
      cantidad_solicitada: parseFloat(cantidad_solicitada),
      motivo: motivo || `Solicitud manual de ${cantidad_solicitada} ${articulo.unidad}`,
      prioridad: prioridad || 'media',
      estado: 'pendiente',
      usuario_solicitante_id: usuario_id,
      pedido_origen_id: null,
      orden_compra_id: null
    }, { transaction });

    // Recargar solicitud con relaciones ANTES del commit
    const solicitudCompleta = await SolicitudCompra.findByPk(solicitud.id, {
      include: [
        {
          model: Articulo,
          as: 'articulo',
          include: [
            { model: Categoria, as: 'categoria', required: false },
            { model: Ubicacion, as: 'ubicacion', required: false },
            { model: Proveedor, as: 'proveedor', required: false },
            {
              model: TipoHerramientaRenta,
              as: 'tipo_herramienta_migrado',
              required: false,
              include: [
                {
                  model: Proveedor,
                  as: 'proveedor',
                  required: false
                }
              ]
            }
          ]
        },
        {
          model: Usuario,
          as: 'solicitante',
          attributes: ['id', 'nombre', 'email', 'rol']
        }
      ],
      transaction
    });

    // Commit de la transacción
    await transaction.commit();

    // Notificar al rol de compras (no crítico, si falla no afecta la creación)
    try {
      await notificarPorRol(
        'compras',
        'nueva_solicitud_compra',
        `Nueva solicitud de compra: ${solicitud.ticket_id}`,
        `Se ha creado una solicitud manual para ${cantidad_solicitada} ${articulo.unidad} de ${articulo.nombre}`,
        `/ordenes-compra?vista=solicitudes`
      );
    } catch (notifError) {
      console.error('Error al enviar notificación (no crítico):', notifError);
    }

    res.status(201).json({
      success: true,
      message: 'Solicitud de compra creada exitosamente',
      data: {
        solicitud: solicitudCompleta
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al crear solicitud de compra manual:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la solicitud de compra',
      error: error.message
    });
  }
};

/**
 * Recibir mercancía de una orden de compra
 * - Crea un movimiento tipo 'entrada_orden_compra'
 * - Actualiza cantidad_recibida en DetalleOrdenCompra
 * - Actualiza stock de artículos
 * - Actualiza estado de la orden (parcial/recibida)
 * - Permite recepciones parciales múltiples
 */
export const recibirMercancia = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { articulos, observaciones_generales, fecha_recepcion } = req.body;
    const usuario_id = req.usuario.id;

    // Validaciones
    if (!articulos || !Array.isArray(articulos) || articulos.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un artículo para recibir'
      });
    }

    // Obtener la orden con sus detalles
    const orden = await OrdenCompra.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: 'creador',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Proveedor,
          as: 'proveedor',
          attributes: ['id', 'nombre']
        },
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              include: [
                { model: Categoria, as: 'categoria' },
                { model: Ubicacion, as: 'ubicacion' }
              ]
            }
          ]
        }
      ],
      transaction
    });

    if (!orden) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }

    // Validar que la orden esté en un estado válido para recibir
    if (!['enviada', 'parcial'].includes(orden.estado)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `No se puede recibir mercancía de una orden en estado '${orden.estado}'. Solo se pueden recibir órdenes en estado 'enviada' o 'parcial'`
      });
    }

    // Validar que todos los detalles existen y que las cantidades son válidas
    const detallesMap = {};
    orden.detalles.forEach(det => {
      detallesMap[det.id] = det;
    });

    const articulosRecibidos = [];
    const errores = [];

    for (const item of articulos) {
      const detalle = detallesMap[item.detalle_id];

      if (!detalle) {
        errores.push(`Detalle ${item.detalle_id} no encontrado en la orden`);
        continue;
      }

      const cantidadRecibida = parseFloat(item.cantidad_recibida);
      const cantidadYaRecibida = parseFloat(detalle.cantidad_recibida) || 0;
      const cantidadSolicitada = parseFloat(detalle.cantidad_solicitada);
      const cantidadPendiente = cantidadSolicitada - cantidadYaRecibida;

      if (cantidadRecibida <= 0) {
        errores.push(`${detalle.articulo.nombre}: La cantidad debe ser mayor a 0`);
        continue;
      }

      if (cantidadRecibida > cantidadPendiente) {
        errores.push(`${detalle.articulo.nombre}: Se intenta recibir ${cantidadRecibida} pero solo quedan ${cantidadPendiente} pendientes`);
        continue;
      }

      articulosRecibidos.push({
        detalle,
        cantidad_recibida: cantidadRecibida,
        observaciones: item.observaciones || null
      });
    }

    if (errores.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errores
      });
    }

    if (articulosRecibidos.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No hay artículos válidos para recibir'
      });
    }

    // Generar ticket_id para el movimiento
    const fecha = fecha_recepcion ? new Date(fecha_recepcion) : new Date();
    const ddmmyy = fecha.toISOString().slice(2, 10).replace(/-/g, '').match(/.{2}/g).reverse().join('');
    const hhmm = fecha.toTimeString().slice(0, 5).replace(':', '');

    const inicioDelDia = new Date(fecha.setHours(0, 0, 0, 0));
    const finDelDia = new Date(fecha.setHours(23, 59, 59, 999));

    const contadorHoy = await Movimiento.count({
      where: {
        created_at: {
          [Op.between]: [inicioDelDia, finDelDia]
        }
      },
      transaction
    });

    const nn = String(contadorHoy + 1).padStart(2, '0');
    const ticket_id = `MOV-${ddmmyy}-${hhmm}-${nn}`;

    // Crear movimiento de entrada
    const movimiento = await Movimiento.create({
      ticket_id,
      tipo: 'entrada_orden_compra',
      usuario_id: usuario_id,
      orden_compra_id: orden.id,
      estado: 'completado',
      observaciones: observaciones_generales || `Recepción de mercancía de orden ${orden.ticket_id}`,
      fecha_hora: fecha_recepcion || new Date()
    }, { transaction });

    // Procesar cada artículo recibido
    let totalPiezas = 0;
    const detallesMovimiento = [];
    const actualizacionesStock = [];

    for (const item of articulosRecibidos) {
      const detalle = item.detalle;
      const articulo = detalle.articulo;
      const cantidad = item.cantidad_recibida;

      // Actualizar cantidad_recibida en DetalleOrdenCompra
      const nuevaCantidadRecibida = parseFloat(detalle.cantidad_recibida) + cantidad;
      await detalle.update({
        cantidad_recibida: nuevaCantidadRecibida
      }, { transaction });

      // Actualizar stock del artículo
      const stockAntes = parseFloat(articulo.stock_actual);
      const stockDespues = stockAntes + cantidad;

      await articulo.update({
        stock_actual: stockDespues
      }, { transaction });

      // Crear detalle del movimiento
      detallesMovimiento.push({
        movimiento_id: movimiento.id,
        articulo_id: articulo.id,
        cantidad: cantidad,
        stock_antes: stockAntes,
        stock_despues: stockDespues,
        observaciones: item.observaciones
      });

      actualizacionesStock.push({
        articulo_id: articulo.id,
        nombre: articulo.nombre,
        cantidad_recibida: cantidad,
        stock_antes: stockAntes,
        stock_despues: stockDespues,
        cantidad_total_recibida: nuevaCantidadRecibida,
        cantidad_solicitada: parseFloat(detalle.cantidad_solicitada),
        completo: nuevaCantidadRecibida >= parseFloat(detalle.cantidad_solicitada)
      });

      totalPiezas += cantidad;
    }

    // Crear detalles del movimiento
    await DetalleMovimiento.bulkCreate(detallesMovimiento, { transaction });

    // Actualizar total_piezas en el movimiento
    await movimiento.update({ total_piezas: totalPiezas }, { transaction });

    // Determinar nuevo estado de la orden
    const todosLosDetalles = await DetalleOrdenCompra.findAll({
      where: { orden_compra_id: orden.id },
      transaction
    });

    let todosCompletos = true;
    let algunoRecibido = false;

    for (const det of todosLosDetalles) {
      const recibida = parseFloat(det.cantidad_recibida) || 0;
      const solicitada = parseFloat(det.cantidad_solicitada);

      if (recibida > 0) algunoRecibido = true;
      if (recibida < solicitada) todosCompletos = false;
    }

    let nuevoEstado = orden.estado;
    let fechaRecepcionFinal = orden.fecha_recepcion;

    if (todosCompletos) {
      nuevoEstado = 'recibida';
      fechaRecepcionFinal = fecha_recepcion || new Date();
    } else if (algunoRecibido) {
      nuevoEstado = 'parcial';
    }

    // Actualizar estado de la orden
    await orden.update({
      estado: nuevoEstado,
      fecha_recepcion: fechaRecepcionFinal
    }, { transaction });

    await transaction.commit();

    // Recargar orden con relaciones actualizadas
    const ordenActualizada = await OrdenCompra.findByPk(orden.id, {
      include: [
        {
          model: Usuario,
          as: 'creador'
        },
        {
          model: Proveedor,
          as: 'proveedor'
        },
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo'
            }
          ]
        }
      ]
    });

    // Calcular progreso
    const articulosCompletos = actualizacionesStock.filter(a => a.completo).length;
    const articulosPendientes = actualizacionesStock.filter(a => !a.completo).length;
    const porcentajeTotal = Math.round(
      (actualizacionesStock.reduce((sum, a) => sum + a.cantidad_total_recibida, 0) /
        actualizacionesStock.reduce((sum, a) => sum + a.cantidad_solicitada, 0)) * 100
    );

    // Notificar a usuarios relevantes
    try {
      const mensaje = nuevoEstado === 'recibida'
        ? `Se completó la recepción de la orden ${orden.ticket_id}`
        : `Se recibió mercancía parcial de la orden ${orden.ticket_id} (${porcentajeTotal}% completo)`;

      await notificarPorRol({
        roles: ['compras', 'almacen', 'administrador'],
        tipo: nuevoEstado === 'recibida' ? 'orden_recibida_completa' : 'orden_recibida_parcial',
        titulo: nuevoEstado === 'recibida' ? 'Orden completada' : 'Recepción parcial',
        mensaje,
        url: `/ordenes-compra`,
        datos_adicionales: {
          orden_id: orden.id,
          ticket_id: orden.ticket_id,
          movimiento_id: movimiento.id,
          movimiento_ticket_id: movimiento.ticket_id,
          estado_nuevo: nuevoEstado,
          articulos_recibidos: articulosRecibidos.length,
          progreso: porcentajeTotal
        }
      });
    } catch (notifError) {
      console.error('Error al enviar notificación:', notifError);
    }

    res.status(200).json({
      success: true,
      message: nuevoEstado === 'recibida'
        ? 'Orden recibida completamente'
        : `Recepción parcial registrada (${porcentajeTotal}% completo)`,
      data: {
        orden: ordenActualizada,
        movimiento: {
          id: movimiento.id,
          ticket_id: movimiento.ticket_id,
          fecha_hora: movimiento.fecha_hora
        },
        articulos_recibidos: actualizacionesStock,
        estado_nuevo: nuevoEstado,
        progreso: {
          articulos_completos: articulosCompletos,
          articulos_pendientes: articulosPendientes,
          porcentaje_total: porcentajeTotal
        }
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al recibir mercancía:', error);
    res.status(500).json({
      success: false,
      message: 'Error al recibir la mercancía',
      error: error.message
    });
  }
};

/**
 * Obtener historial de recepciones de una orden de compra
 */
export const obtenerHistorialRecepciones = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la orden existe
    const orden = await OrdenCompra.findByPk(id);

    if (!orden) {
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }

    // Obtener todos los movimientos de tipo entrada_orden_compra para esta orden
    const recepciones = await Movimiento.findAll({
      where: {
        orden_compra_id: id,
        tipo: 'entrada_orden_compra'
      },
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: DetalleMovimiento,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              attributes: ['id', 'nombre', 'unidad']
            }
          ]
        }
      ],
      order: [['fecha_hora', 'ASC']]
    });

    // Construir resumen
    const resumen = {
      total_recepciones: recepciones.length,
      primera_recepcion: recepciones.length > 0 ? recepciones[0].fecha_hora : null,
      ultima_recepcion: recepciones.length > 0 ? recepciones[recepciones.length - 1].fecha_hora : null
    };

    res.status(200).json({
      success: true,
      data: {
        recepciones,
        resumen
      }
    });

  } catch (error) {
    console.error('Error al obtener historial de recepciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el historial de recepciones',
      error: error.message
    });
  }
};

/**
 * Obtener progreso de recepción de una orden de compra
 */
export const obtenerProgresoRecepcion = async (req, res) => {
  try {
    const { id } = req.params;

    const orden = await OrdenCompra.findByPk(id, {
      include: [
        {
          model: DetalleOrdenCompra,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              attributes: ['id', 'nombre', 'unidad']
            }
          ]
        }
      ]
    });

    if (!orden) {
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }

    // Calcular progreso por artículo
    const articulos = orden.detalles.map(detalle => {
      const cantidadSolicitada = parseFloat(detalle.cantidad_solicitada);
      const cantidadRecibida = parseFloat(detalle.cantidad_recibida) || 0;
      const pendiente = cantidadSolicitada - cantidadRecibida;
      const porcentaje = Math.round((cantidadRecibida / cantidadSolicitada) * 100);
      const completo = cantidadRecibida >= cantidadSolicitada;

      return {
        detalle_id: detalle.id,
        articulo_id: detalle.articulo.id,
        articulo: detalle.articulo.nombre,
        unidad: detalle.articulo.unidad,
        cantidad_solicitada: cantidadSolicitada,
        cantidad_recibida: cantidadRecibida,
        pendiente,
        porcentaje,
        completo
      };
    });

    // Calcular resumen general
    const totalArticulos = articulos.length;
    const articulosCompletos = articulos.filter(a => a.completo).length;
    const articulosPendientes = totalArticulos - articulosCompletos;
    const porcentajeTotal = Math.round(
      (articulos.reduce((sum, a) => sum + a.cantidad_recibida, 0) /
        articulos.reduce((sum, a) => sum + a.cantidad_solicitada, 0)) * 100
    );

    res.status(200).json({
      success: true,
      data: {
        orden_id: orden.id,
        ticket_id: orden.ticket_id,
        estado: orden.estado,
        articulos,
        resumen: {
          total_articulos: totalArticulos,
          articulos_completos: articulosCompletos,
          articulos_pendientes: articulosPendientes,
          porcentaje_total: porcentajeTotal
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener progreso de recepción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el progreso de recepción',
      error: error.message
    });
  }
};

/**
 * Completar orden manualmente
 * - Para casos donde no llegará toda la mercancía
 * - Cambia estado a 'recibida' aunque no esté 100% completado
 */
export const completarOrdenManualmente = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo || motivo.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un motivo de al menos 10 caracteres'
      });
    }

    const orden = await OrdenCompra.findByPk(id);

    if (!orden) {
      return res.status(404).json({
        success: false,
        message: 'Orden de compra no encontrada'
      });
    }

    if (orden.estado === 'recibida') {
      return res.status(400).json({
        success: false,
        message: 'Esta orden ya está completada'
      });
    }

    if (!['enviada', 'parcial'].includes(orden.estado)) {
      return res.status(400).json({
        success: false,
        message: `No se puede completar una orden en estado '${orden.estado}'`
      });
    }

    // Actualizar orden
    await orden.update({
      estado: 'recibida',
      fecha_recepcion: new Date(),
      observaciones: orden.observaciones
        ? `${orden.observaciones}\n\n[COMPLETADA MANUALMENTE] ${new Date().toLocaleString('es-MX')}: ${motivo}`
        : `[COMPLETADA MANUALMENTE] ${new Date().toLocaleString('es-MX')}: ${motivo}`
    });

    // Notificar
    try {
      await notificarPorRol({
        roles: ['compras', 'administrador'],
        tipo: 'orden_completada_manual',
        titulo: 'Orden completada manualmente',
        mensaje: `La orden ${orden.ticket_id} fue completada manualmente por ${req.usuario.nombre}. Motivo: ${motivo}`,
        url: `/ordenes-compra`,
        datos_adicionales: {
          orden_id: orden.id,
          ticket_id: orden.ticket_id,
          completado_por: req.usuario.nombre,
          motivo
        }
      });
    } catch (notifError) {
      console.error('Error al enviar notificación:', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Orden completada exitosamente',
      data: { orden }
    });

  } catch (error) {
    console.error('Error al completar orden:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar la orden',
      error: error.message
    });
  }
};

/**
 * Generar solicitudes de compra para artículos con stock bajo
 * - Busca artículos activos con stock_actual < stock_minimo
 * - Verifica que no tengan solicitudes pendientes
 * - Crea solicitudes automáticamente
 */
export const generarSolicitudesStockBajo = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    console.log('🔍 Buscando artículos con stock bajo...');

    // Buscar artículos con stock por debajo del mínimo
    const articulosBajos = await Articulo.findAll({
      where: {
        activo: true,
        stock_actual: {
          [Op.lt]: sequelize.col('stock_minimo')
        }
      },
      attributes: ['id', 'nombre', 'codigo_ean13', 'unidad', 'stock_actual', 'stock_minimo', 'stock_maximo'],
      transaction
    });

    console.log(`📦 Encontrados ${articulosBajos.length} artículos con stock bajo`);

    if (articulosBajos.length === 0) {
      await transaction.rollback();
      return res.status(200).json({
        success: true,
        message: 'No hay artículos con stock bajo',
        data: { solicitudes_creadas: [] }
      });
    }

    // Obtener solicitudes pendientes existentes
    const solicitudesPendientes = await SolicitudCompra.findAll({
      where: { estado: 'pendiente' },
      attributes: ['articulo_id'],
      transaction
    });

    const articulosConSolicitud = new Set(solicitudesPendientes.map(s => s.articulo_id));

    // Filtrar artículos que NO tienen solicitud pendiente
    const articulosSinSolicitud = articulosBajos.filter(a => !articulosConSolicitud.has(a.id));

    console.log(`✅ ${articulosSinSolicitud.length} artículos sin solicitud pendiente`);

    if (articulosSinSolicitud.length === 0) {
      await transaction.rollback();
      return res.status(200).json({
        success: true,
        message: 'Todos los artículos con stock bajo ya tienen solicitudes pendientes',
        data: { solicitudes_creadas: [] }
      });
    }

    // Generar ticket_id base
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ddmmyy = `${dd}${mm}${yy}`;
    const hhmm = `${hh}${min}`;

    // Obtener contador de solicitudes del día
    const contadorBase = await SolicitudCompra.count({
      where: {
        created_at: {
          [Op.gte]: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        }
      },
      transaction
    });

    const solicitudesCreadas = [];
    let contador = 0;

    // Crear solicitudes para cada artículo
    for (const articulo of articulosSinSolicitud) {
      contador++;
      const nn = String(contadorBase + contador).padStart(2, '0');
      const ticket_id = `SC-${ddmmyy}-${hhmm}-${nn}`;

      // Calcular cantidad a solicitar (hasta el stock máximo o mínimo + 50%)
      const stockMaximo = articulo.stock_maximo || (articulo.stock_minimo * 3);
      const cantidadAReponer = Math.max(stockMaximo - parseFloat(articulo.stock_actual), parseFloat(articulo.stock_minimo));

      // Determinar prioridad según qué tan bajo esté el stock
      const stockActual = parseFloat(articulo.stock_actual);
      const stockMinimo = parseFloat(articulo.stock_minimo);
      let prioridad = 'media';

      if (stockActual <= 0) {
        prioridad = 'urgente';
      } else if (stockActual < (stockMinimo * 0.5)) {
        prioridad = 'alta';
      }

      const solicitud = await SolicitudCompra.create({
        ticket_id,
        articulo_id: articulo.id,
        cantidad_solicitada: Math.ceil(cantidadAReponer),
        prioridad,
        motivo: `Stock bajo detectado automáticamente. Stock actual: ${stockActual} ${articulo.unidad}, mínimo: ${stockMinimo} ${articulo.unidad}`,
        estado: 'pendiente',
        usuario_solicitante_id: req.usuario.id,
        fecha_solicitud: now
      }, { transaction });

      console.log(`  ✅ Solicitud ${ticket_id} creada para ${articulo.nombre} (${cantidadAReponer} ${articulo.unidad})`);

      solicitudesCreadas.push({
        ticket_id: solicitud.ticket_id,
        articulo: articulo.nombre,
        cantidad: solicitud.cantidad_solicitada,
        prioridad: solicitud.prioridad
      });
    }

    await transaction.commit();

    console.log(`✨ ${solicitudesCreadas.length} solicitudes de compra generadas automáticamente`);

    res.status(201).json({
      success: true,
      message: `Se generaron ${solicitudesCreadas.length} solicitudes de compra automáticamente`,
      data: { solicitudes_creadas: solicitudesCreadas }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al generar solicitudes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar solicitudes de compra',
      error: error.message
    });
  }
};
