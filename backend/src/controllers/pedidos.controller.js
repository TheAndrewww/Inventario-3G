import { Movimiento, DetalleMovimiento, Articulo, Usuario, Categoria, Ubicacion, Equipo, SolicitudCompra, OrdenCompra, Proveedor, ArticuloProveedor, TipoHerramientaRenta } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { crearNotificacion, notificarPorRol } from './notificaciones.controller.js';

/**
 * Función auxiliar para detectar el proveedor de un artículo
 * Prioridad:
 * 1. Proveedor preferido en relación many-to-many (ArticuloProveedor con es_preferido=true)
 * 2. Primer proveedor en relación many-to-many
 * 3. Proveedor directo del artículo (proveedor_id)
 * 4. Si es herramienta migrada, proveedor del tipo de herramienta
 */
async function detectarProveedorArticulo(articulo_id, transaction = null) {
  try {
    // Obtener artículo con todas sus relaciones de proveedores
    const articulo = await Articulo.findByPk(articulo_id, {
      include: [
        {
          model: Proveedor,
          as: 'proveedores',
          through: {
            attributes: ['es_preferido']
          },
          required: false
        },
        {
          model: Proveedor,
          as: 'proveedor',
          required: false
        },
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
      ],
      transaction
    });

    if (!articulo) {
      console.log(`⚠️ Artículo ${articulo_id} no encontrado para detectar proveedor`);
      return null;
    }

    // 1. Buscar proveedor preferido en relación many-to-many
    if (articulo.proveedores && articulo.proveedores.length > 0) {
      const proveedorPreferido = articulo.proveedores.find(p => p.ArticuloProveedor?.es_preferido === true);
      if (proveedorPreferido) {
        console.log(`✅ Proveedor preferido detectado para artículo ${articulo_id}: ${proveedorPreferido.nombre} (ID: ${proveedorPreferido.id})`);
        return proveedorPreferido.id;
      }

      // 2. Si no hay preferido, usar el primero de la lista
      const primerProveedor = articulo.proveedores[0];
      console.log(`✅ Primer proveedor detectado para artículo ${articulo_id}: ${primerProveedor.nombre} (ID: ${primerProveedor.id})`);
      return primerProveedor.id;
    }

    // 3. Usar proveedor directo del artículo
    if (articulo.proveedor_id) {
      console.log(`✅ Proveedor directo detectado para artículo ${articulo_id}: ${articulo.proveedor?.nombre || 'Desconocido'} (ID: ${articulo.proveedor_id})`);
      return articulo.proveedor_id;
    }

    // 4. Si es herramienta migrada, usar proveedor del tipo
    if (articulo.tipo_herramienta_migrado?.proveedor_id) {
      console.log(`✅ Proveedor de tipo herramienta detectado para artículo ${articulo_id}: ${articulo.tipo_herramienta_migrado.proveedor?.nombre || 'Desconocido'} (ID: ${articulo.tipo_herramienta_migrado.proveedor_id})`);
      return articulo.tipo_herramienta_migrado.proveedor_id;
    }

    console.log(`⚠️ No se detectó proveedor para artículo ${articulo_id}`);
    return null;
  } catch (error) {
    console.error(`❌ Error al detectar proveedor para artículo ${articulo_id}:`, error.message);
    return null;
  }
}

/**
 * Crear un nuevo pedido de materiales
 * - Diseñador/Admin: pueden crear pedidos de tipo 'proyecto' (van directo a pendiente)
 * - Almacenista: puede crear pedidos de tipo 'equipo' (requieren aprobación del supervisor)
 */
export const crearPedido = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { articulos, proyecto, equipo_id, ubicacion_destino_id, observaciones } = req.body;
    const usuario_id = req.usuario.id;
    const usuario_rol = req.usuario.rol;

    // Validaciones
    if (!articulos || !Array.isArray(articulos) || articulos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un artículo para el pedido'
      });
    }

    // Determinar tipo de pedido según el rol y los datos enviados
    let tipo_pedido, estado_inicial, equipo;

    if (usuario_rol === 'almacen') {
      // Almacenista DEBE especificar un equipo
      if (!equipo_id) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Los almacenistas deben especificar un equipo para el pedido'
        });
      }

      // Verificar que el equipo existe y está activo
      equipo = await Equipo.findByPk(equipo_id);
      if (!equipo || !equipo.activo) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'El equipo especificado no existe o está inactivo'
        });
      }

      tipo_pedido = 'equipo';
      estado_inicial = 'pendiente_aprobacion'; // Requiere aprobación del supervisor
    } else if (usuario_rol === 'diseñador' || usuario_rol === 'administrador') {
      // Diseñadores y admins crean pedidos de proyecto o para ubicación específica
      // Si no hay proyecto ni ubicación destino, retornar error
      if (!proyecto && !ubicacion_destino_id) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Debe especificar un proyecto o una ubicación destino para el pedido'
        });
      }

      tipo_pedido = 'proyecto';
      estado_inicial = 'pendiente'; // Van directo a pendiente (pueden ser dispersados)
    } else {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para crear pedidos'
      });
    }

    // Generar ticket_id único
    const fecha = new Date();
    const ddmmyy = fecha.toISOString().slice(2, 10).replace(/-/g, '').match(/.{2}/g).reverse().join('');
    const hhmm = fecha.toTimeString().slice(0, 5).replace(':', '');

    // Obtener el contador del día
    const inicioDelDia = new Date(fecha.setHours(0, 0, 0, 0));
    const finDelDia = new Date(fecha.setHours(23, 59, 59, 999));

    const contadorHoy = await Movimiento.count({
      where: {
        tipo: 'pedido',
        created_at: {
          [Op.between]: [inicioDelDia, finDelDia]
        }
      }
    });

    const nn = String(contadorHoy + 1).padStart(2, '0');
    const ticket_id = `PED-${ddmmyy}-${hhmm}-${nn}`;

    // Validar que los artículos existen y procesar stock
    const articuloIds = articulos.map(a => a.articulo_id);
    const articulosDB = await Articulo.findAll({
      where: { id: articuloIds, activo: true },
      transaction
    });

    if (articulosDB.length !== articuloIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Uno o más artículos no existen o están inactivos'
      });
    }

    // Array para almacenar las solicitudes de compra creadas
    const solicitudesCreadas = [];

    // Obtener contador base de solicitudes del día (una sola vez, antes del loop)
    const contadorBaseSolicitudes = await SolicitudCompra.count({
      where: {
        created_at: {
          [Op.between]: [inicioDelDia, finDelDia]
        }
      }
    });
    let contadorSolicitudesIncremental = 0; // Contador incremental para este pedido

    // Determinar el nombre del pedido para usar en los motivos
    const nombrePedido = equipo ? equipo.nombre : (proyecto || 'Pedido sin nombre');

    // Procesar cada artículo: descontar stock y crear solicitudes si es necesario
    for (const articuloPedido of articulos) {
      const articulo = articulosDB.find(a => a.id === articuloPedido.articulo_id);
      const cantidadSolicitada = articuloPedido.cantidad;
      const stockActualAntes = articulo.stock_actual;

      // SIEMPRE descontar la cantidad solicitada (permitir stock negativo)
      const nuevoStock = stockActualAntes - cantidadSolicitada;
      await articulo.update({
        stock_actual: nuevoStock
      }, { transaction });

      // Si el stock quedó negativo o muy bajo, generar solicitud de compra
      if (nuevoStock < 0) {
        // Stock negativo: necesitamos comprar para cubrir el déficit + reponer hasta el máximo
        const deficit = Math.abs(nuevoStock); // Cantidad en negativo

        // Calcular stock máximo con valores predeterminados si son NULL
        const stockMin = parseFloat(articulo.stock_minimo) || 10; // Default: 10
        const stockMaximo = parseFloat(articulo.stock_maximo) || (stockMin * 3); // Default: 3x mínimo

        // CONSOLIDACIÓN: Verificar si ya existe una solicitud pendiente de este artículo
        const solicitudExistente = await SolicitudCompra.findOne({
          where: {
            articulo_id: articulo.id,
            estado: 'pendiente'
          },
          transaction
        });

        let solicitud;

        if (solicitudExistente) {
          // ACTUALIZAR solicitud existente: solo agregar el déficit adicional (no duplicar stock máximo)
          const cantidadAnterior = parseFloat(solicitudExistente.cantidad_solicitada);
          const nuevaCantidad = cantidadAnterior + deficit; // Solo agregar el déficit nuevo

          await solicitudExistente.update({
            cantidad_solicitada: nuevaCantidad,
            motivo: `${solicitudExistente.motivo}\n\n[ACTUALIZACIÓN] Pedido ${nombrePedido} agregó ${deficit} ${articulo.unidad} adicionales de déficit. Nueva cantidad total: ${nuevaCantidad} ${articulo.unidad}.`,
            prioridad: 'alta' // Mantener prioridad alta
          }, { transaction });

          solicitud = solicitudExistente;

          solicitudesCreadas.push({
            solicitud_id: solicitud.id,
            solicitud_obj: solicitud,
            articulo: articulo.nombre,
            cantidad_solicitada: nuevaCantidad,
            motivo: 'Solicitud consolidada - déficit adicional agregado',
            deficit: deficit,
            consolidada: true
          });

        } else {
          // CREAR nueva solicitud: déficit + stock máximo (solo una vez)
          const cantidadTotal = deficit + stockMaximo;

          // Detectar proveedor del artículo
          const proveedor_id_detectado = await detectarProveedorArticulo(articulo.id, transaction);

          // Generar ticket_id para la solicitud (usando contador incremental)
          contadorSolicitudesIncremental++;
          const fechaSolicitud = new Date();
          const ddmmyySC = fechaSolicitud.toISOString().slice(2, 10).replace(/-/g, '').match(/.{2}/g).reverse().join('');
          const hhmmSC = fechaSolicitud.toTimeString().slice(0, 5).replace(':', '');
          const nnSC = String(contadorBaseSolicitudes + contadorSolicitudesIncremental).padStart(2, '0');
          const ticket_id_solicitud = `SC-${ddmmyySC}-${hhmmSC}-${nnSC}`;

          solicitud = await SolicitudCompra.create({
            ticket_id: ticket_id_solicitud,
            articulo_id: articulo.id,
            cantidad_solicitada: cantidadTotal,
            motivo: `Stock negativo después de pedido ${nombrePedido}. Déficit: ${deficit} ${articulo.unidad}. Se solicitan ${cantidadTotal} ${articulo.unidad} (${deficit} para cubrir déficit + ${stockMaximo} para reposición hasta stock máximo).`,
            pedido_origen_id: null, // Se asignará después de crear el pedido
            usuario_solicitante_id: usuario_id,
            proveedor_id: proveedor_id_detectado, // Proveedor detectado automáticamente
            prioridad: 'alta', // Prioridad alta por stock negativo
            estado: 'pendiente'
          }, { transaction });

          solicitudesCreadas.push({
            solicitud_id: solicitud.id,
            solicitud_obj: solicitud,
            articulo: articulo.nombre,
            cantidad_solicitada: cantidadTotal,
            motivo: 'Stock negativo - déficit a cubrir',
            deficit: deficit,
            consolidada: false
          });
        }

      } else if (articulo.stock_minimo && nuevoStock < parseFloat(articulo.stock_minimo)) {
        // Stock positivo pero bajo el mínimo: reponer hasta el máximo

        // Calcular stock máximo con valores predeterminados si son NULL
        const stockMin = parseFloat(articulo.stock_minimo) || 10; // Default: 10
        const stockMaximo = parseFloat(articulo.stock_maximo) || (stockMin * 3); // Default: 3x mínimo

        // CONSOLIDACIÓN: Verificar si ya existe una solicitud pendiente de este artículo
        const solicitudExistente = await SolicitudCompra.findOne({
          where: {
            articulo_id: articulo.id,
            estado: 'pendiente'
          },
          transaction
        });

        let solicitud;

        if (solicitudExistente) {
          // ACTUALIZAR solicitud existente: recalcular para llegar al stock máximo
          // Considerando el nuevo stock actual (más bajo que antes)
          const nuevaCantidad = stockMaximo - nuevoStock;

          await solicitudExistente.update({
            cantidad_solicitada: nuevaCantidad,
            motivo: `${solicitudExistente.motivo}\n\n[ACTUALIZACIÓN] Pedido ${nombrePedido} redujo el stock a ${nuevoStock} ${articulo.unidad}. Cantidad ajustada a ${nuevaCantidad} ${articulo.unidad} para alcanzar stock máximo.`,
            prioridad: 'media'
          }, { transaction });

          solicitud = solicitudExistente;

          solicitudesCreadas.push({
            solicitud_id: solicitud.id,
            solicitud_obj: solicitud,
            articulo: articulo.nombre,
            cantidad_solicitada: nuevaCantidad,
            motivo: 'Solicitud consolidada - cantidad ajustada',
            consolidada: true
          });

        } else {
          // CREAR nueva solicitud
          const cantidadAReponer = stockMaximo - nuevoStock;

          // Detectar proveedor del artículo
          const proveedor_id_detectado = await detectarProveedorArticulo(articulo.id, transaction);

          // Generar ticket_id para la solicitud (usando contador incremental)
          contadorSolicitudesIncremental++;
          const fechaSolicitud = new Date();
          const ddmmyySC = fechaSolicitud.toISOString().slice(2, 10).replace(/-/g, '').match(/.{2}/g).reverse().join('');
          const hhmmSC = fechaSolicitud.toTimeString().slice(0, 5).replace(':', '');
          const nnSC = String(contadorBaseSolicitudes + contadorSolicitudesIncremental).padStart(2, '0');
          const ticket_id_solicitud = `SC-${ddmmyySC}-${hhmmSC}-${nnSC}`;

          solicitud = await SolicitudCompra.create({
            ticket_id: ticket_id_solicitud,
            articulo_id: articulo.id,
            cantidad_solicitada: cantidadAReponer,
            motivo: `Stock bajo mínimo después de pedido ${nombrePedido}. Stock actual: ${nuevoStock} ${articulo.unidad}. Se solicita reposición hasta stock máximo (${stockMaximo} ${articulo.unidad}).`,
            pedido_origen_id: null, // Se asignará después de crear el pedido
            usuario_solicitante_id: usuario_id,
            proveedor_id: proveedor_id_detectado, // Proveedor detectado automáticamente
            prioridad: 'media',
            estado: 'pendiente'
          }, { transaction });

          solicitudesCreadas.push({
            solicitud_id: solicitud.id,
            solicitud_obj: solicitud,
            articulo: articulo.nombre,
            cantidad_solicitada: cantidadAReponer,
            motivo: 'Reposición por stock bajo mínimo',
            consolidada: false
          });
        }
      }
    }

    // Crear el pedido
    const pedido = await Movimiento.create({
      ticket_id,
      tipo: 'pedido',
      tipo_pedido,
      equipo_id: equipo_id || null,
      ubicacion_destino_id: ubicacion_destino_id || null,
      fecha_hora: new Date(),
      usuario_id,
      proyecto: proyecto || null,
      estado: estado_inicial,
      observaciones: observaciones || null,
      total_piezas: articulos.reduce((sum, art) => sum + art.cantidad, 0)
    }, { transaction });

    // Crear detalles del pedido
    const detalles = articulos.map(art => ({
      movimiento_id: pedido.id,
      articulo_id: art.articulo_id,
      cantidad: art.cantidad,
      observaciones: art.observaciones || null,
      dispersado: false
    }));

    await DetalleMovimiento.bulkCreate(detalles, { transaction });

    // Actualizar pedido_origen_id en las solicitudes de compra creadas
    for (const solicitudCreada of solicitudesCreadas) {
      if (solicitudCreada.solicitud_obj) {
        await solicitudCreada.solicitud_obj.update({
          pedido_origen_id: pedido.id
        }, { transaction });
      }
    }

    await transaction.commit();

    // Enviar notificaciones según el tipo de pedido y estado
    try {
      if (estado_inicial === 'pendiente') {
        // Pedido de diseñador/admin que va directo a pendiente - notificar a almacén
        await notificarPorRol({
          roles: ['almacen', 'administrador'],
          tipo: 'pedido_pendiente',
          titulo: 'Nuevo pedido pendiente',
          mensaje: `${req.usuario.nombre} creó un nuevo pedido ${ticket_id}. Total: ${articulos.reduce((sum, art) => sum + art.cantidad, 0)} artículos.`,
          url: '/pedidos-pendientes',
          datos_adicionales: {
            pedido_id: pedido.id,
            ticket_id: ticket_id,
            usuario: req.usuario.nombre,
            tipo_pedido: tipo_pedido,
            total_articulos: articulos.reduce((sum, art) => sum + art.cantidad, 0)
          }
        });
      } else if (estado_inicial === 'pendiente_aprobacion') {
        // Pedido de almacenista para equipo - notificar a supervisores
        await notificarPorRol({
          roles: ['supervisor', 'administrador'],
          tipo: 'pedido_pendiente_aprobacion',
          titulo: 'Pedido pendiente de aprobación',
          mensaje: `${req.usuario.nombre} creó un pedido para el equipo ${equipo.nombre}. Requiere tu aprobación.`,
          url: '/recibir-pedidos',
          datos_adicionales: {
            pedido_id: pedido.id,
            ticket_id: ticket_id,
            usuario: req.usuario.nombre,
            equipo: equipo.nombre,
            tipo_pedido: tipo_pedido,
            total_articulos: articulos.reduce((sum, art) => sum + art.cantidad, 0)
          }
        });
      }
    } catch (notifError) {
      console.error('Error al enviar notificación de pedido:', notifError);
    }

    // Enviar notificaciones para las solicitudes de compra creadas
    if (solicitudesCreadas.length > 0) {
      try {
        for (const solicitudCreada of solicitudesCreadas) {
          const prioridad = solicitudCreada.deficit ? 'ALTA' : 'MEDIA';
          const tipoNotif = solicitudCreada.deficit ? 'solicitud_urgente' : 'solicitud_compra_creada';

          await notificarPorRol({
            roles: ['compras', 'administrador'],
            tipo: tipoNotif,
            titulo: solicitudCreada.deficit ? 'Solicitud de compra URGENTE' : 'Nueva solicitud de compra',
            mensaje: `Se creó solicitud de compra para ${solicitudCreada.articulo}. Cantidad: ${solicitudCreada.cantidad_solicitada}. Prioridad: ${prioridad}`,
            url: '/ordenes-compra',
            datos_adicionales: {
              solicitud_id: solicitudCreada.solicitud_id,
              articulo: solicitudCreada.articulo,
              cantidad: solicitudCreada.cantidad_solicitada,
              prioridad: prioridad,
              motivo: solicitudCreada.motivo
            }
          });
        }
      } catch (notifError) {
        console.error('Error al enviar notificaciones de solicitudes de compra:', notifError);
      }
    }

    // Obtener el pedido completo con sus relaciones
    const pedidoCompleto = await Movimiento.findByPk(pedido.id, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Ubicacion,
          as: 'ubicacionDestino',
          attributes: ['id', 'codigo', 'almacen', 'descripcion']
        },
        {
          model: DetalleMovimiento,
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

    // Preparar mensaje y respuesta
    let mensaje = 'Pedido creado exitosamente';
    if (solicitudesCreadas.length > 0) {
      mensaje += `. Se generaron ${solicitudesCreadas.length} solicitud(es) de compra automática(s) por faltantes o reposición`;
    }

    // Limpiar solicitudes para enviar al frontend (remover solicitud_obj)
    const solicitudesLimpias = solicitudesCreadas.map(({ solicitud_obj, ...rest }) => rest);

    res.status(201).json({
      success: true,
      message: mensaje,
      data: {
        pedido: pedidoCompleto,
        solicitudes_compra: solicitudesLimpias
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al crear pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el pedido',
      error: error.message
    });
  }
};

/**
 * Listar todos los pedidos
 * Con filtros opcionales
 */
export const listarPedidos = async (req, res) => {
  try {
    const {
      estado,
      usuario_id,
      fecha_inicio,
      fecha_fin,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construir filtros
    const where = { tipo: 'pedido' };

    if (estado) where.estado = estado;
    if (usuario_id) where.usuario_id = parseInt(usuario_id);
    if (fecha_inicio || fecha_fin) {
      where.fecha_hora = {};
      if (fecha_inicio) where.fecha_hora[Op.gte] = new Date(fecha_inicio);
      if (fecha_fin) where.fecha_hora[Op.lte] = new Date(fecha_fin);
    }

    const { count, rows: pedidos } = await Movimiento.findAndCountAll({
      where,
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
              attributes: ['id', 'codigo_ean13', 'nombre', 'unidad']
            },
            {
              model: Usuario,
              as: 'dispersadoPor',
              attributes: ['id', 'nombre']
            }
          ]
        }
      ],
      order: [['fecha_hora', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Calcular progreso de dispersión para cada pedido
    const pedidosConProgreso = pedidos.map(pedido => {
      const pedidoJSON = pedido.toJSON();
      const totalArticulos = pedidoJSON.detalles.length;
      const articulosDispersados = pedidoJSON.detalles.filter(d => d.dispersado).length;
      const progreso = totalArticulos > 0 ? Math.round((articulosDispersados / totalArticulos) * 100) : 0;

      return {
        ...pedidoJSON,
        progreso_dispersion: progreso
      };
    });

    res.status(200).json({
      success: true,
      data: {
        pedidos: pedidosConProgreso,
        paginacion: {
          total: count,
          pagina_actual: parseInt(page),
          total_paginas: Math.ceil(count / parseInt(limit)),
          por_pagina: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error al listar pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la lista de pedidos',
      error: error.message
    });
  }
};

/**
 * Obtener un pedido por ID
 */
export const obtenerPedido = async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await Movimiento.findOne({
      where: { id, tipo: 'pedido' },
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email', 'rol', 'puesto']
        },
        {
          model: Usuario,
          as: 'supervisor',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: DetalleMovimiento,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              include: [
                { model: Categoria, as: 'categoria' },
                { model: Ubicacion, as: 'ubicacion' }
              ]
            },
            {
              model: Usuario,
              as: 'dispersadoPor',
              attributes: ['id', 'nombre', 'email']
            }
          ]
        }
      ]
    });

    if (!pedido) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Calcular progreso
    const pedidoJSON = pedido.toJSON();
    const totalArticulos = pedidoJSON.detalles.length;
    const articulosDispersados = pedidoJSON.detalles.filter(d => d.dispersado).length;
    const progreso = totalArticulos > 0 ? Math.round((articulosDispersados / totalArticulos) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        pedido: {
          ...pedidoJSON,
          progreso_dispersion: progreso
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el pedido',
      error: error.message
    });
  }
};

/**
 * Marcar artículo como dispersado (checklist)
 * Solo almacenistas pueden dispersar
 */
export const marcarArticuloDispersado = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pedido_id, detalle_id } = req.params;
    const { dispersado } = req.body;
    const usuario_id = req.usuario.id;

    // Verificar que el pedido existe y es de tipo pedido
    const pedido = await Movimiento.findOne({
      where: { id: pedido_id, tipo: 'pedido' }
    });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Verificar que el detalle existe y pertenece al pedido
    const detalle = await DetalleMovimiento.findOne({
      where: { id: detalle_id, movimiento_id: pedido_id }
    });

    if (!detalle) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Artículo no encontrado en el pedido'
      });
    }

    // Actualizar estado de dispersión
    if (dispersado) {
      detalle.dispersado = true;
      detalle.fecha_dispersado = new Date();
      detalle.dispersado_por_id = usuario_id;
    } else {
      detalle.dispersado = false;
      detalle.fecha_dispersado = null;
      detalle.dispersado_por_id = null;
    }

    await detalle.save({ transaction });

    // Verificar si todos los artículos han sido dispersados
    const todosLosDetalles = await DetalleMovimiento.findAll({
      where: { movimiento_id: pedido_id }
    });

    const todosDispersados = todosLosDetalles.every(d => d.dispersado);

    // Si todos están dispersados, actualizar estado del pedido
    if (todosDispersados && (pedido.estado === 'pendiente' || pedido.estado === 'aprobado')) {
      pedido.estado = 'completado';
      await pedido.save({ transaction });
    } else if (!todosDispersados && pedido.estado === 'completado') {
      // Restaurar al estado anterior (pendiente o aprobado)
      pedido.estado = pedido.tipo_pedido === 'equipo' ? 'aprobado' : 'pendiente';
      await pedido.save({ transaction });
    }

    await transaction.commit();

    // Obtener detalle actualizado con relaciones
    const detalleActualizado = await DetalleMovimiento.findByPk(detalle_id, {
      include: [
        {
          model: Articulo,
          as: 'articulo'
        },
        {
          model: Usuario,
          as: 'dispersadoPor',
          attributes: ['id', 'nombre']
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: dispersado ? 'Artículo marcado como dispersado' : 'Artículo desmarcado',
      data: {
        detalle: detalleActualizado,
        pedido_completado: todosDispersados
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al actualizar dispersión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado de dispersión',
      error: error.message
    });
  }
};

/**
 * Listar pedidos pendientes (para almacenista)
 */
export const listarPedidosPendientes = async (req, res) => {
  try {
    const pedidos = await Movimiento.findAll({
      where: {
        tipo: 'pedido',
        estado: {
          [Op.in]: ['pendiente', 'aprobado']
        }
      },
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Ubicacion,
          as: 'ubicacionDestino',
          attributes: ['id', 'codigo', 'almacen', 'descripcion']
        },
        {
          model: Equipo,
          as: 'equipo',
          attributes: ['id', 'nombre']
        },
        {
          model: DetalleMovimiento,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              attributes: ['id', 'codigo_ean13', 'nombre', 'unidad', 'stock_actual']
            }
          ]
        }
      ],
      order: [['fecha_hora', 'ASC']] // Más antiguos primero
    });

    // Calcular progreso para cada pedido
    const pedidosConProgreso = pedidos.map(pedido => {
      const pedidoJSON = pedido.toJSON();
      const totalArticulos = pedidoJSON.detalles.length;
      const articulosDispersados = pedidoJSON.detalles.filter(d => d.dispersado).length;
      const progreso = totalArticulos > 0 ? Math.round((articulosDispersados / totalArticulos) * 100) : 0;

      return {
        ...pedidoJSON,
        progreso_dispersion: progreso
      };
    });

    // Asegurar UTF-8 en la respuesta
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      success: true,
      data: {
        pedidos: pedidosConProgreso,
        total: pedidosConProgreso.length
      }
    });

  } catch (error) {
    console.error('Error al listar pedidos pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pedidos pendientes',
      error: error.message
    });
  }
};

/**
 * Anular un pedido completamente (con reversión de stock y solicitudes)
 * Esta función revierte TODOS los cambios asociados al pedido
 * Solo supervisor o admin pueden anular
 */
export const anularPedido = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const usuario = req.usuario;

    // Validar motivo
    if (!motivo || motivo.trim().length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un motivo para anular el pedido'
      });
    }

    // Obtener el pedido con todos sus detalles y solicitudes
    const pedido = await Movimiento.findOne({
      where: { id, tipo: 'pedido' },
      include: [
        {
          model: DetalleMovimiento,
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
          as: 'solicitudes_compra',
          include: [
            {
              model: OrdenCompra,
              as: 'ordenCompra'
            }
          ]
        },
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email']
        }
      ],
      transaction
    });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Verificar permisos: solo supervisor o admin
    if (!['supervisor', 'administrador'].includes(usuario.rol)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Solo supervisores y administradores pueden anular pedidos'
      });
    }

    // No se puede anular si ya está entregado
    if (pedido.estado === 'entregado') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se puede anular un pedido que ya fue entregado. Contacte al administrador.'
      });
    }

    // Ya está cancelado/anulado
    if (pedido.estado === 'cancelado') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Este pedido ya fue cancelado/anulado previamente'
      });
    }

    // Validar solicitudes de compra asociadas
    const solicitudesCompletadas = pedido.solicitudes_compra?.filter(s => s.estado === 'completada') || [];
    if (solicitudesCompletadas.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `No se puede anular porque ${solicitudesCompletadas.length} solicitud(es) de compra ya fueron completadas (material recibido). Contacte al administrador.`
      });
    }

    // Verificar órdenes de compra asociadas
    const solicitudesEnOrden = pedido.solicitudes_compra?.filter(s => s.estado === 'en_orden' && s.ordenCompra) || [];
    const ordenesAfectadas = [...new Set(solicitudesEnOrden.map(s => s.ordenCompra.ticket_id))];

    if (ordenesAfectadas.length > 0) {
      console.log(`⚠️ Advertencia: Este pedido tiene solicitudes en órdenes de compra: ${ordenesAfectadas.join(', ')}`);
      // Continuar, pero las solicitudes serán canceladas
    }

    // PASO 1: Revertir el stock de todos los artículos del pedido
    console.log(`\n🔄 [Anulación] Iniciando reversión del pedido ${pedido.ticket_id}`);
    const articulosRevertidos = [];

    for (const detalle of pedido.detalles) {
      const articulo = detalle.articulo;
      const cantidadARevertir = parseFloat(detalle.cantidad);
      const stockAntes = parseFloat(articulo.stock_actual);
      const stockDespues = stockAntes + cantidadARevertir;

      await articulo.update({
        stock_actual: stockDespues
      }, { transaction });

      articulosRevertidos.push({
        articulo_id: articulo.id,
        nombre: articulo.nombre,
        cantidad_revertida: cantidadARevertir,
        stock_antes: stockAntes,
        stock_despues: stockDespues
      });

      console.log(`   ✅ ${articulo.nombre}: ${stockAntes} + ${cantidadARevertir} = ${stockDespues}`);
    }

    // PASO 2: Cancelar todas las solicitudes de compra asociadas
    const solicitudesCanceladas = [];
    const solicitudesPendientes = pedido.solicitudes_compra?.filter(s => s.estado === 'pendiente') || [];
    const solicitudesEnOrdenActivas = pedido.solicitudes_compra?.filter(s => s.estado === 'en_orden') || [];

    for (const solicitud of [...solicitudesPendientes, ...solicitudesEnOrdenActivas]) {
      await solicitud.update({
        estado: 'cancelada',
        observaciones: `Cancelada automáticamente por anulación del pedido ${pedido.ticket_id} por ${usuario.nombre}. Motivo: ${motivo}`
      }, { transaction });

      solicitudesCanceladas.push({
        ticket_id: solicitud.ticket_id,
        articulo: solicitud.articulo?.nombre,
        cantidad: solicitud.cantidad_solicitada,
        estado_anterior: solicitud.estado === 'cancelada' ? (solicitudesEnOrdenActivas.includes(solicitud) ? 'en_orden' : 'pendiente') : solicitud.estado
      });

      console.log(`   🚫 Solicitud ${solicitud.ticket_id} cancelada (estaba en: ${solicitud.estado === 'cancelada' ? (solicitudesEnOrdenActivas.includes(solicitud) ? 'en_orden' : 'pendiente') : solicitud.estado})`);
    }

    // PASO 3: Marcar el pedido como anulado
    const observacionesActualizadas = `${pedido.observaciones || ''}\n\n[ANULADO por ${usuario.nombre} - ${new Date().toLocaleString('es-MX')}]\nMotivo: ${motivo}\n- Stock revertido: ${articulosRevertidos.length} artículo(s)\n- Solicitudes canceladas: ${solicitudesCanceladas.length}`;

    await pedido.update({
      estado: 'cancelado',
      observaciones: observacionesActualizadas,
      aprobado_por_id: usuario.id, // Registrar quién anuló
      fecha_aprobacion: new Date(),
      motivo_rechazo: motivo // Guardar el motivo de anulación
    }, { transaction });

    await transaction.commit();

    // Notificar al creador del pedido
    try {
      await crearNotificacion({
        usuario_id: pedido.usuario_id,
        tipo: 'pedido_anulado',
        titulo: 'Pedido anulado',
        mensaje: `Tu pedido ${pedido.ticket_id} fue anulado por ${usuario.nombre}. Motivo: ${motivo}. El stock ha sido revertido.`,
        url: '/pedidos',
        datos_adicionales: {
          pedido_id: pedido.id,
          ticket_id: pedido.ticket_id,
          anulado_por: usuario.nombre,
          motivo: motivo,
          articulos_revertidos: articulosRevertidos.length,
          solicitudes_canceladas: solicitudesCanceladas.length
        }
      });
    } catch (notifError) {
      console.error('Error al enviar notificación de anulación:', notifError);
    }

    console.log(`\n✅ [Anulación] Pedido ${pedido.ticket_id} anulado completamente\n`);

    res.status(200).json({
      success: true,
      message: `Pedido anulado exitosamente. Stock revertido: ${articulosRevertidos.length} artículo(s). Solicitudes canceladas: ${solicitudesCanceladas.length}.`,
      data: {
        pedido: {
          id: pedido.id,
          ticket_id: pedido.ticket_id,
          estado: 'cancelado',
          anulado_por: usuario.nombre,
          fecha_anulacion: new Date(),
          tipo_cancelacion: 'anulacion_completa' // Para diferenciar de cancelación simple
        },
        reversiones: {
          stock_revertido: articulosRevertidos,
          solicitudes_canceladas: solicitudesCanceladas,
          ordenes_afectadas: ordenesAfectadas
        }
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al anular pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al anular el pedido',
      error: error.message
    });
  }
};

/**
 * Cancelar un pedido (SIN revertir stock)
 * Solo diseñador que creó el pedido, supervisor o admin
 * DEPRECADO: Usar anularPedido para reversión completa
 */
export const cancelarPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const usuario = req.usuario;

    const pedido = await Movimiento.findOne({
      where: { id, tipo: 'pedido' }
    });

    if (!pedido) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Verificar permisos: solo el creador, supervisor o admin
    if (
      pedido.usuario_id !== usuario.id &&
      !['supervisor', 'administrador'].includes(usuario.rol)
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para cancelar este pedido'
      });
    }

    // No se puede cancelar un pedido completado
    if (pedido.estado === 'completado') {
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar un pedido completado'
      });
    }

    pedido.estado = 'cancelado';
    pedido.observaciones = pedido.observaciones
      ? `${pedido.observaciones}\n[CANCELADO] ${motivo || 'Sin motivo especificado'}`
      : `[CANCELADO] ${motivo || 'Sin motivo especificado'}`;

    await pedido.save();

    res.status(200).json({
      success: true,
      message: 'Pedido cancelado exitosamente',
      data: { pedido }
    });

  } catch (error) {
    console.error('Error al cancelar pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar el pedido',
      error: error.message
    });
  }
};

/**
 * Actualizar cantidad de un artículo en el pedido
 * Solo almacenistas pueden modificar cantidades de pedidos pendientes
 */
export const actualizarCantidadArticulo = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pedido_id, detalle_id } = req.params;
    const { cantidad } = req.body;

    // Validar cantidad
    if (!cantidad || cantidad <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }

    // Verificar que el pedido existe y está pendiente
    const pedido = await Movimiento.findOne({
      where: { id: pedido_id, tipo: 'pedido', estado: 'pendiente' }
    });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o ya está completado'
      });
    }

    // Buscar el detalle
    const detalle = await DetalleMovimiento.findOne({
      where: { id: detalle_id, movimiento_id: pedido_id },
      include: [{ model: Articulo, as: 'articulo' }]
    });

    if (!detalle) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Artículo no encontrado en el pedido'
      });
    }

    // No permitir modificar si ya fue dispersado
    if (detalle.dispersado) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se puede modificar la cantidad de un artículo ya dispersado'
      });
    }

    // Actualizar cantidad
    detalle.cantidad = cantidad;
    await detalle.save({ transaction });

    // Actualizar total de piezas del pedido
    const todosLosDetalles = await DetalleMovimiento.findAll({
      where: { movimiento_id: pedido_id }
    });
    const totalPiezas = todosLosDetalles.reduce((sum, d) => sum + parseFloat(d.cantidad), 0);
    pedido.total_piezas = totalPiezas;
    await pedido.save({ transaction });

    await transaction.commit();

    // Obtener detalle actualizado
    const detalleActualizado = await DetalleMovimiento.findByPk(detalle_id, {
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
    });

    res.status(200).json({
      success: true,
      message: 'Cantidad actualizada exitosamente',
      data: { detalle: detalleActualizado }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al actualizar cantidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cantidad',
      error: error.message
    });
  }
};

/**
 * Agregar un artículo a un pedido existente
 * Solo almacenistas pueden agregar artículos a pedidos pendientes
 */
export const agregarArticuloAPedido = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pedido_id } = req.params;
    const { articulo_id, cantidad, observaciones } = req.body;

    // Validaciones
    if (!articulo_id || !cantidad || cantidad <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar articulo_id y cantidad válida'
      });
    }

    // Verificar que el pedido existe y está pendiente
    const pedido = await Movimiento.findOne({
      where: { id: pedido_id, tipo: 'pedido', estado: 'pendiente' }
    });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o ya está completado'
      });
    }

    // Verificar que el artículo existe
    const articulo = await Articulo.findOne({
      where: { id: articulo_id, activo: true }
    });

    if (!articulo) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Artículo no encontrado o está inactivo'
      });
    }

    // Verificar si el artículo ya está en el pedido
    const detalleExistente = await DetalleMovimiento.findOne({
      where: { movimiento_id: pedido_id, articulo_id }
    });

    if (detalleExistente) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Este artículo ya está en el pedido. Use la opción de actualizar cantidad.'
      });
    }

    // Crear nuevo detalle
    const nuevoDetalle = await DetalleMovimiento.create({
      movimiento_id: pedido_id,
      articulo_id,
      cantidad,
      observaciones: observaciones || null,
      dispersado: false
    }, { transaction });

    // Actualizar total de piezas del pedido
    const todosLosDetalles = await DetalleMovimiento.findAll({
      where: { movimiento_id: pedido_id }
    });
    const totalPiezas = todosLosDetalles.reduce((sum, d) => sum + parseFloat(d.cantidad), 0);
    pedido.total_piezas = totalPiezas;
    await pedido.save({ transaction });

    await transaction.commit();

    // Obtener detalle creado con relaciones
    const detalleCompleto = await DetalleMovimiento.findByPk(nuevoDetalle.id, {
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
    });

    res.status(201).json({
      success: true,
      message: 'Artículo agregado al pedido exitosamente',
      data: { detalle: detalleCompleto }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al agregar artículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar artículo al pedido',
      error: error.message
    });
  }
};

/**
 * Eliminar un artículo de un pedido pendiente
 * Solo almacenistas pueden eliminar artículos que no han sido dispersados
 */
export const eliminarArticuloDePedido = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pedido_id, detalle_id } = req.params;

    // Verificar que el pedido existe y está pendiente
    const pedido = await Movimiento.findOne({
      where: { id: pedido_id, tipo: 'pedido', estado: 'pendiente' }
    });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o ya está completado'
      });
    }

    // Buscar el detalle
    const detalle = await DetalleMovimiento.findOne({
      where: { id: detalle_id, movimiento_id: pedido_id }
    });

    if (!detalle) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Artículo no encontrado en el pedido'
      });
    }

    // No permitir eliminar si ya fue dispersado
    if (detalle.dispersado) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar un artículo que ya fue dispersado'
      });
    }

    // Verificar que no sea el último artículo del pedido
    const totalDetalles = await DetalleMovimiento.count({
      where: { movimiento_id: pedido_id }
    });

    if (totalDetalles <= 1) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el último artículo del pedido. Cancele el pedido en su lugar.'
      });
    }

    // Eliminar el detalle
    await detalle.destroy({ transaction });

    // Actualizar total de piezas del pedido
    const todosLosDetalles = await DetalleMovimiento.findAll({
      where: { movimiento_id: pedido_id }
    });
    const totalPiezas = todosLosDetalles.reduce((sum, d) => sum + parseFloat(d.cantidad), 0);
    pedido.total_piezas = totalPiezas;
    await pedido.save({ transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Artículo eliminado del pedido exitosamente'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al eliminar artículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar artículo del pedido',
      error: error.message
    });
  }
};

/**
 * Aprobar un pedido de equipo (solo supervisores)
 * El supervisor debe ser el asignado al equipo
 */
export const aprobarPedido = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pedido_id } = req.params;
    const usuario_id = req.usuario.id;
    const usuario_rol = req.usuario.rol;

    // Obtener el pedido
    const pedido = await Movimiento.findByPk(pedido_id, {
      include: [
        {
          model: Equipo,
          as: 'equipo'
        }
      ],
      transaction
    });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Validar que es un pedido de equipo
    if (pedido.tipo_pedido !== 'equipo') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden aprobar pedidos de tipo equipo'
      });
    }

    // Validar que está en estado pendiente_aprobacion
    if (pedido.estado !== 'pendiente_aprobacion') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `El pedido está en estado ${pedido.estado}, solo se pueden aprobar pedidos pendientes de aprobación`
      });
    }

    // Validar que el usuario es el supervisor del equipo o es administrador
    if (usuario_rol !== 'administrador' && pedido.equipo.supervisor_id !== usuario_id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Solo el supervisor asignado al equipo puede aprobar este pedido'
      });
    }

    // Aprobar el pedido
    await pedido.update({
      estado: 'aprobado',
      aprobado_por_id: usuario_id,
      fecha_aprobacion: new Date()
    }, { transaction });

    await transaction.commit();

    // Obtener pedido completo
    const pedidoCompleto = await Movimiento.findByPk(pedido_id, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Usuario,
          as: 'aprobadoPor',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Equipo,
          as: 'equipo',
          include: [
            {
              model: Usuario,
              as: 'supervisor',
              attributes: ['id', 'nombre', 'email']
            }
          ]
        },
        {
          model: DetalleMovimiento,
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

    // Notificar al creador del pedido que fue aprobado
    try {
      await crearNotificacion({
        usuario_id: pedidoCompleto.usuario_id,
        tipo: 'pedido_aprobado',
        titulo: 'Pedido aprobado',
        mensaje: `Tu pedido ${pedidoCompleto.ticket_id} fue aprobado por ${req.usuario.nombre}`,
        url: `/pedidos`,
        datos_adicionales: {
          pedido_id: pedidoCompleto.id,
          ticket_id: pedidoCompleto.ticket_id,
          aprobador: req.usuario.nombre
        }
      });
    } catch (notifError) {
      console.error('Error al enviar notificación:', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Pedido aprobado exitosamente',
      data: { pedido: pedidoCompleto }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al aprobar pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aprobar pedido',
      error: error.message
    });
  }
};

/**
 * Rechazar un pedido de equipo (solo supervisores)
 * El supervisor debe ser el asignado al equipo
 */
export const rechazarPedido = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pedido_id } = req.params;
    const { motivo_rechazo } = req.body;
    const usuario_id = req.usuario.id;
    const usuario_rol = req.usuario.rol;

    if (!motivo_rechazo) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un motivo de rechazo'
      });
    }

    // Obtener el pedido
    const pedido = await Movimiento.findByPk(pedido_id, {
      include: [
        {
          model: Equipo,
          as: 'equipo'
        }
      ],
      transaction
    });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Validar que es un pedido de equipo
    if (pedido.tipo_pedido !== 'equipo') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden rechazar pedidos de tipo equipo'
      });
    }

    // Validar que está en estado pendiente_aprobacion
    if (pedido.estado !== 'pendiente_aprobacion') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `El pedido está en estado ${pedido.estado}, solo se pueden rechazar pedidos pendientes de aprobación`
      });
    }

    // Validar que el usuario es el supervisor del equipo o es administrador
    if (usuario_rol !== 'administrador' && pedido.equipo.supervisor_id !== usuario_id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Solo el supervisor asignado al equipo puede rechazar este pedido'
      });
    }

    // Devolver el pedido a estado pendiente y agregar el motivo a las observaciones
    const observacionesActualizadas = pedido.observaciones
      ? `${pedido.observaciones}\n\n[RECHAZADO por ${req.usuario.nombre} - ${new Date().toLocaleString('es-MX')}]\nMotivo: ${motivo_rechazo}`
      : `[RECHAZADO por ${req.usuario.nombre} - ${new Date().toLocaleString('es-MX')}]\nMotivo: ${motivo_rechazo}`;

    await pedido.update({
      estado: 'pendiente',
      aprobado_por_id: usuario_id,
      fecha_aprobacion: new Date(),
      motivo_rechazo,
      observaciones: observacionesActualizadas
    }, { transaction });

    await transaction.commit();

    // Obtener pedido completo
    const pedidoCompleto = await Movimiento.findByPk(pedido_id, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Usuario,
          as: 'aprobadoPor',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Equipo,
          as: 'equipo',
          include: [
            {
              model: Usuario,
              as: 'supervisor',
              attributes: ['id', 'nombre', 'email']
            }
          ]
        },
        {
          model: DetalleMovimiento,
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

    // Notificar al almacenista que creó el pedido que fue devuelto a pendiente
    try {
      await crearNotificacion({
        usuario_id: pedidoCompleto.usuario_id,
        tipo: 'pedido_rechazado',
        titulo: 'Pedido devuelto a pendiente',
        mensaje: `Tu pedido ${pedidoCompleto.ticket_id} fue rechazado por ${req.usuario.nombre} y devuelto a estado pendiente. Motivo: ${motivo_rechazo}. Por favor revisa y corrige el pedido.`,
        url: `/pedidos`,
        datos_adicionales: {
          pedido_id: pedidoCompleto.id,
          ticket_id: pedidoCompleto.ticket_id,
          rechazador: req.usuario.nombre,
          motivo: motivo_rechazo,
          estado_nuevo: 'pendiente',
          devuelto: true
        }
      });
    } catch (notifError) {
      console.error('Error al enviar notificación:', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Pedido rechazado y devuelto a estado pendiente exitosamente',
      data: { pedido: pedidoCompleto }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al rechazar pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al rechazar pedido',
      error: error.message
    });
  }
};

/**
 * Listar pedidos pendientes de aprobación para un supervisor
 */
export const listarPedidosPendientesAprobacion = async (req, res) => {
  try {
    const usuario_id = req.usuario.id;
    const usuario_rol = req.usuario.rol;

    let where = {
      tipo: 'pedido',
      tipo_pedido: 'equipo',
      estado: 'pendiente_aprobacion'
    };

    // Si no es administrador, filtrar por equipos del supervisor
    if (usuario_rol !== 'administrador') {
      const equiposSupervisor = await Equipo.findAll({
        where: { supervisor_id: usuario_id, activo: true },
        attributes: ['id']
      });

      const equipoIds = equiposSupervisor.map(e => e.id);

      if (equipoIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: { pedidos: [] }
        });
      }

      where.equipo_id = { [Op.in]: equipoIds };
    }

    const pedidos = await Movimiento.findAll({
      where,
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Equipo,
          as: 'equipo',
          include: [
            {
              model: Usuario,
              as: 'supervisor',
              attributes: ['id', 'nombre', 'email']
            }
          ]
        },
        {
          model: DetalleMovimiento,
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
      order: [['created_at', 'DESC']]
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      success: true,
      data: { pedidos }
    });

  } catch (error) {
    console.error('Error al obtener pedidos pendientes de aprobación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pedidos pendientes de aprobación',
      error: error.message
    });
  }
};

/**
 * Marcar pedido como listo para entrega (100% dispersado)
 * Asignar a un supervisor para que lo reciba
 */
export const marcarPedidoListo = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pedido_id } = req.params;
    const { supervisor_id } = req.body;

    // Validar que se proporcionó un supervisor
    if (!supervisor_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe asignar un supervisor para recibir el pedido'
      });
    }

    // Verificar que el supervisor existe y es supervisor o admin
    const supervisor = await Usuario.findByPk(supervisor_id);
    if (!supervisor || !['supervisor', 'administrador'].includes(supervisor.rol)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'El supervisor seleccionado no es válido'
      });
    }

    // Obtener el pedido
    const pedido = await Movimiento.findOne({
      where: { id: pedido_id, tipo: 'pedido' },
      include: [
        {
          model: DetalleMovimiento,
          as: 'detalles'
        }
      ],
      transaction
    });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Validar que el pedido está en estado pendiente o aprobado
    if (!['pendiente', 'aprobado'].includes(pedido.estado)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `El pedido está en estado ${pedido.estado}, no se puede marcar como listo`
      });
    }

    // Verificar que todos los artículos están dispersados (100%)
    const todosDispersados = pedido.detalles.every(d => d.dispersado);
    if (!todosDispersados) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No todos los artículos han sido dispersados. Complete el checklist primero.'
      });
    }

    // Marcar como listo para entrega y asignar supervisor
    await pedido.update({
      estado: 'listo_para_entrega',
      supervisor_id: supervisor_id
    }, { transaction });

    await transaction.commit();

    // Obtener pedido completo
    const pedidoCompleto = await Movimiento.findByPk(pedido_id, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Usuario,
          as: 'supervisor',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Ubicacion,
          as: 'ubicacionDestino'
        },
        {
          model: Equipo,
          as: 'equipo'
        },
        {
          model: DetalleMovimiento,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo'
            },
            {
              model: Usuario,
              as: 'dispersadoPor',
              attributes: ['id', 'nombre']
            }
          ]
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Pedido marcado como listo para entrega',
      data: { pedido: pedidoCompleto }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al marcar pedido como listo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar pedido como listo',
      error: error.message
    });
  }
};

/**
 * Listar pedidos listos para recibir (asignados al supervisor)
 */
export const listarPedidosListosParaRecibir = async (req, res) => {
  try {
    const usuario_id = req.usuario.id;
    const usuario_rol = req.usuario.rol;

    let where = {
      tipo: 'pedido',
      estado: 'listo_para_entrega'
    };

    // Si no es administrador, filtrar por pedidos asignados al supervisor
    if (usuario_rol !== 'administrador') {
      where.supervisor_id = usuario_id;
    }

    const pedidos = await Movimiento.findAll({
      where,
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email', 'rol']
        },
        {
          model: Usuario,
          as: 'supervisor',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Ubicacion,
          as: 'ubicacionDestino',
          attributes: ['id', 'codigo', 'almacen', 'descripcion']
        },
        {
          model: Equipo,
          as: 'equipo',
          attributes: ['id', 'nombre']
        },
        {
          model: DetalleMovimiento,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              attributes: ['id', 'codigo_ean13', 'nombre', 'unidad', 'stock_actual'],
              include: [
                { model: Categoria, as: 'categoria' },
                { model: Ubicacion, as: 'ubicacion' }
              ]
            },
            {
              model: Usuario,
              as: 'dispersadoPor',
              attributes: ['id', 'nombre']
            }
          ]
        }
      ],
      order: [['fecha_hora', 'ASC']] // Más antiguos primero
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      success: true,
      data: { pedidos }
    });

  } catch (error) {
    console.error('Error al obtener pedidos listos para recibir:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pedidos listos para recibir',
      error: error.message
    });
  }
};

/**
 * Recibir y aprobar un pedido (supervisor)
 */
export const recibirPedido = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pedido_id } = req.params;
    const usuario_id = req.usuario.id;
    const usuario_rol = req.usuario.rol;

    // Obtener el pedido
    const pedido = await Movimiento.findByPk(pedido_id, { transaction });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Validar que está en estado listo_para_entrega
    if (pedido.estado !== 'listo_para_entrega') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `El pedido está en estado ${pedido.estado}, solo se pueden recibir pedidos listos para entrega`
      });
    }

    // Validar que el supervisor es el asignado o es administrador
    if (usuario_rol !== 'administrador' && pedido.supervisor_id !== usuario_id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Solo el supervisor asignado puede recibir este pedido'
      });
    }

    // Marcar como entregado (el stock ya se descontó al crear el pedido)
    await pedido.update({
      estado: 'entregado',
      recibido_por_id: usuario_id,
      fecha_recepcion: new Date()
    }, { transaction });

    await transaction.commit();

    // Obtener pedido completo
    const pedidoCompleto = await Movimiento.findByPk(pedido_id, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Usuario,
          as: 'supervisor',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Usuario,
          as: 'recibidoPor',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Ubicacion,
          as: 'ubicacionDestino'
        },
        {
          model: Equipo,
          as: 'equipo'
        },
        {
          model: DetalleMovimiento,
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

    res.status(200).json({
      success: true,
      message: 'Pedido recibido y aprobado exitosamente',
      data: { pedido: pedidoCompleto }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al recibir pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al recibir pedido',
      error: error.message
    });
  }
};

/**
 * Rechazar un pedido listo para entrega (supervisor)
 * El pedido vuelve a estado pendiente
 */
export const rechazarPedidoListoParaEntrega = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pedido_id } = req.params;
    const { motivo_rechazo } = req.body;
    const usuario_id = req.usuario.id;
    const usuario_rol = req.usuario.rol;

    if (!motivo_rechazo) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un motivo de rechazo'
      });
    }

    // Obtener el pedido
    const pedido = await Movimiento.findByPk(pedido_id, { transaction });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Validar que está en estado listo_para_entrega
    if (pedido.estado !== 'listo_para_entrega') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `El pedido está en estado ${pedido.estado}, solo se pueden rechazar pedidos listos para entrega`
      });
    }

    // Validar que el supervisor es el asignado o es administrador
    if (usuario_rol !== 'administrador' && pedido.supervisor_id !== usuario_id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Solo el supervisor asignado puede rechazar este pedido'
      });
    }

    // Desmarcar todos los detalles como no dispersados
    await DetalleMovimiento.update(
      { 
        dispersado: false,
        dispersado_por_id: null,
        fecha_dispersado: null
      },
      {
        where: { movimiento_id: pedido_id },
        transaction
      }
    );

    // Volver a estado pendiente o aprobado según el tipo
    const nuevoEstado = pedido.tipo_pedido === 'equipo' ? 'aprobado' : 'pendiente';
    
    await pedido.update({
      estado: nuevoEstado,
      supervisor_id: null,
      motivo_rechazo,
      recibido_por_id: usuario_id, // Guardamos quién lo rechazó
      fecha_recepcion: new Date()
    }, { transaction });

    await transaction.commit();

    // Obtener pedido completo
    const pedidoCompleto = await Movimiento.findByPk(pedido_id, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Usuario,
          as: 'recibidoPor',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Ubicacion,
          as: 'ubicacionDestino'
        },
        {
          model: Equipo,
          as: 'equipo'
        },
        {
          model: DetalleMovimiento,
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

    res.status(200).json({
      success: true,
      message: 'Pedido rechazado. Vuelve a pendientes para corrección.',
      data: { pedido: pedidoCompleto }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al rechazar pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al rechazar pedido',
      error: error.message
    });
  }
};

/**
 * Obtener lista de supervisores disponibles
 */
export const listarSupervisores = async (req, res) => {
  try {
    const supervisores = await Usuario.findAll({
      where: {
        rol: {
          [Op.in]: ['supervisor', 'administrador']
        },
        activo: true
      },
      attributes: ['id', 'nombre', 'email', 'puesto', 'rol'],
      order: [['nombre', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: { supervisores }
    });

  } catch (error) {
    console.error('Error al listar supervisores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener lista de supervisores',
      error: error.message
    });
  }
};
