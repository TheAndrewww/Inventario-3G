import { sequelize, SolicitudCambio, Articulo, Usuario, Movimiento, DetalleMovimiento, Ubicacion, Notificacion } from '../models/index.js';
import { esAjusteDirectoActivo } from './configuracion.controller.js';

const TIPOS_VALIDOS = ['cambio_ubicacion', 'entrada_stock', 'salida_stock', 'crear_articulo', 'desactivar_articulo'];

const generarTicketID = () => {
  const ahora = new Date();
  const yymmdd = ahora.toISOString().slice(2, 10).replace(/-/g, '');
  const rnd = Math.floor(Math.random() * 9000) + 1000;
  return `SC-${yymmdd}-${rnd}`;
};

const incluirRelaciones = [
  { model: Articulo, as: 'articulo', attributes: ['id', 'nombre', 'codigo_ean13', 'unidad', 'stock_actual', 'ubicacion_id', 'activo'] },
  { model: Usuario, as: 'solicitante', attributes: ['id', 'nombre', 'email', 'rol'] },
  { model: Usuario, as: 'aprobador', attributes: ['id', 'nombre', 'email', 'rol'] }
];

/**
 * Aplica el cambio real de una solicitud (modifica stock/ubicación/artículo).
 * NO cambia el estado de la solicitud — eso lo hace el llamador.
 * Debe ejecutarse SIEMPRE dentro de una transacción.
 */
const aplicarCambioSolicitud = async (solicitud, aprobador_id, transaction) => {
  switch (solicitud.tipo) {
    case 'cambio_ubicacion': {
      const articulo = await Articulo.findByPk(solicitud.articulo_id, { transaction });
      if (!articulo) throw new Error('Artículo no encontrado');
      const nuevaUbicacion = solicitud.payload.ubicacion_id || null;
      if (nuevaUbicacion) {
        const ubicacion = await Ubicacion.findByPk(nuevaUbicacion, { transaction });
        if (!ubicacion) throw new Error('Ubicación destino no existe');
      }
      await articulo.update({ ubicacion_id: nuevaUbicacion }, { transaction });
      return { articulo_id: articulo.id, ubicacion_id: nuevaUbicacion };
    }

    case 'entrada_stock':
    case 'salida_stock': {
      const articulo = await Articulo.findByPk(solicitud.articulo_id, { transaction });
      if (!articulo) throw new Error('Artículo no encontrado');
      const cantidad = parseFloat(solicitud.payload.cantidad);
      if (!cantidad || cantidad <= 0) throw new Error('Cantidad inválida en la solicitud');

      const tipoMov = solicitud.tipo === 'entrada_stock' ? 'ajuste_entrada' : 'ajuste_salida';
      let nuevoStock = parseFloat(articulo.stock_actual);
      if (tipoMov === 'ajuste_entrada') nuevoStock += cantidad;
      else {
        if (nuevoStock < cantidad) throw new Error(`Stock insuficiente. Disponible: ${articulo.stock_actual}`);
        nuevoStock -= cantidad;
      }

      const movimiento = await Movimiento.create({
        ticket_id: generarTicketID(),
        tipo: tipoMov,
        fecha_hora: new Date(),
        usuario_id: solicitud.solicitante_id,
        supervisor_id: aprobador_id,
        observaciones: solicitud.payload.observaciones || `Aplicado desde solicitud #${solicitud.id}`,
        estado: 'completado'
      }, { transaction });

      await DetalleMovimiento.create({
        movimiento_id: movimiento.id,
        articulo_id: articulo.id,
        cantidad,
        costo_unitario: articulo.costo_unitario,
        observaciones: solicitud.payload.observaciones || null
      }, { transaction });

      await articulo.update({ stock_actual: nuevoStock }, { transaction });
      return { movimiento_id: movimiento.id, nuevoStock };
    }

    case 'crear_articulo': {
      const { nombre, descripcion, categoria_id, ubicacion_id, unidad, stock_actual, stock_minimo, costo_unitario, codigo_ean13, es_herramienta } = solicitud.payload;
      if (!nombre) throw new Error('El nombre es obligatorio');
      const nuevo = await Articulo.create({
        nombre,
        descripcion: descripcion || null,
        categoria_id: categoria_id || null,
        ubicacion_id: ubicacion_id || null,
        unidad: unidad || 'piezas',
        stock_actual: stock_actual || 0,
        stock_minimo: stock_minimo || 0,
        costo_unitario: costo_unitario || 0,
        codigo_ean13: codigo_ean13 || null,
        es_herramienta: es_herramienta || false,
        activo: true,
        pendiente_revision: false
      }, { transaction });
      await solicitud.update({ articulo_id: nuevo.id }, { transaction });
      return { articulo_id: nuevo.id };
    }

    case 'desactivar_articulo': {
      const articulo = await Articulo.findByPk(solicitud.articulo_id, { transaction });
      if (!articulo) throw new Error('Artículo no encontrado');
      await articulo.update({ activo: false }, { transaction });
      return { articulo_id: articulo.id, activo: false };
    }

    default:
      throw new Error(`Tipo no soportado: ${solicitud.tipo}`);
  }
};

/**
 * Crear solicitud de cambio.
 * Si el interruptor "ajuste directo de almacén" está activo y el solicitante
 * es del rol almacen pidiendo entrada/salida de stock, se aplica de inmediato
 * (queda registrada como aprobada, sin pasar por el administrador).
 */
export const crearSolicitud = async (req, res) => {
  try {
    const { tipo, articulo_id, payload, observaciones } = req.body;
    const solicitante_id = req.usuario.id;

    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ success: false, message: `Tipo inválido. Permitidos: ${TIPOS_VALIDOS.join(', ')}` });
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, message: 'payload es requerido' });
    }

    let snapshot = null;
    if (articulo_id) {
      const articulo = await Articulo.findByPk(articulo_id);
      if (!articulo) {
        return res.status(404).json({ success: false, message: 'Artículo no encontrado' });
      }
      snapshot = {
        nombre: articulo.nombre,
        ubicacion_id: articulo.ubicacion_id,
        stock_actual: articulo.stock_actual,
        activo: articulo.activo
      };

      if (tipo === 'salida_stock') {
        const cantidad = parseFloat(payload.cantidad);
        if (!cantidad || cantidad <= 0) {
          return res.status(400).json({ success: false, message: 'Cantidad inválida' });
        }
        if (parseFloat(articulo.stock_actual) < cantidad) {
          return res.status(400).json({ success: false, message: `Stock insuficiente. Disponible: ${articulo.stock_actual}` });
        }
      }
    }

    // ¿Se aplica directo? Solo almacen, solo entrada/salida, solo con el interruptor activo.
    const esAjusteStock = tipo === 'entrada_stock' || tipo === 'salida_stock';
    const aplicarDirecto = esAjusteStock
      && req.usuario.rol === 'almacen'
      && !!articulo_id
      && await esAjusteDirectoActivo();

    if (aplicarDirecto) {
      const transaction = await sequelize.transaction();
      try {
        const solicitud = await SolicitudCambio.create({
          tipo,
          articulo_id,
          solicitante_id,
          estado: 'aprobada',
          payload,
          snapshot,
          observaciones: observaciones || null,
          aprobador_id: solicitante_id, // auto-aplicada por el propio solicitante
          fecha_resolucion: new Date()
        }, { transaction });

        const resultado = await aplicarCambioSolicitud(solicitud, solicitante_id, transaction);
        await transaction.commit();

        const completa = await SolicitudCambio.findByPk(solicitud.id, { include: incluirRelaciones });
        return res.status(201).json({
          success: true,
          aplicada: true,
          message: tipo === 'entrada_stock' ? 'Entrada aplicada al inventario' : 'Salida aplicada al inventario',
          data: { solicitud: completa, resultado }
        });
      } catch (errAplicar) {
        await transaction.rollback();
        console.error('Error al aplicar ajuste directo:', errAplicar);
        return res.status(400).json({ success: false, message: errAplicar.message || 'No se pudo aplicar el ajuste' });
      }
    }

    // Flujo normal: queda pendiente de aprobación del administrador.
    const solicitud = await SolicitudCambio.create({
      tipo,
      articulo_id: articulo_id || null,
      solicitante_id,
      estado: 'pendiente',
      payload,
      snapshot,
      observaciones: observaciones || null
    });

    // Notificar a todos los administradores activos
    try {
      const admins = await Usuario.findAll({ where: { rol: 'administrador', activo: true }, attributes: ['id'] });
      const titulo = 'Nueva solicitud de cambio';
      const mensaje = `${req.usuario.nombre} solicitó: ${descripcionTipo(tipo)}`;
      for (const admin of admins) {
        await Notificacion.create({
          usuario_id: admin.id,
          tipo: 'solicitud_creada',
          titulo,
          mensaje,
          url: '/solicitudes-cambio',
          datos_adicionales: { solicitud_id: solicitud.id, tipo }
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.error('Error notificando admins (no crítico):', notifErr.message);
    }

    const completa = await SolicitudCambio.findByPk(solicitud.id, { include: incluirRelaciones });
    res.status(201).json({ success: true, aplicada: false, message: 'Solicitud enviada para aprobación', data: { solicitud: completa } });
  } catch (error) {
    console.error('Error al crear solicitud:', error);
    res.status(500).json({ success: false, message: 'Error al crear solicitud' });
  }
};

/**
 * Listar solicitudes (admin ve todas, almacen solo las suyas)
 */
export const listarSolicitudes = async (req, res) => {
  try {
    const { estado } = req.query;
    const where = {};
    if (estado) where.estado = estado;

    if (req.usuario.rol !== 'administrador') {
      where.solicitante_id = req.usuario.id;
    }

    const solicitudes = await SolicitudCambio.findAll({
      where,
      include: incluirRelaciones,
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, data: { solicitudes } });
  } catch (error) {
    console.error('Error al listar solicitudes:', error);
    res.status(500).json({ success: false, message: 'Error al listar solicitudes' });
  }
};

/**
 * Contador de pendientes (para badge)
 */
export const contarPendientes = async (req, res) => {
  try {
    const where = { estado: 'pendiente' };
    if (req.usuario.rol !== 'administrador') {
      where.solicitante_id = req.usuario.id;
    }
    const total = await SolicitudCambio.count({ where });

    // Para almacen: contar también las rechazadas no vistas (las que necesitan corrección)
    let rechazadas = 0;
    if (req.usuario.rol !== 'administrador') {
      rechazadas = await SolicitudCambio.count({ where: { solicitante_id: req.usuario.id, estado: 'rechazada' } });
    }

    res.json({ success: true, data: { pendientes: total, rechazadas } });
  } catch (error) {
    console.error('Error al contar:', error);
    res.status(500).json({ success: false, message: 'Error' });
  }
};

/**
 * Aprobar solicitud (solo admin) — aplica el cambio real
 */
export const aprobarSolicitud = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const aprobador_id = req.usuario.id;

    const solicitud = await SolicitudCambio.findByPk(id, { transaction });
    if (!solicitud) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }
    if (solicitud.estado !== 'pendiente') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `Esta solicitud ya está ${solicitud.estado}` });
    }

    const resultado = await aplicarCambioSolicitud(solicitud, aprobador_id, transaction);

    await solicitud.update({
      estado: 'aprobada',
      aprobador_id,
      fecha_resolucion: new Date()
    }, { transaction });

    await transaction.commit();

    // Notificar al solicitante
    try {
      await Notificacion.create({
        usuario_id: solicitud.solicitante_id,
        tipo: 'solicitud_creada',
        titulo: 'Solicitud aprobada',
        mensaje: `Tu solicitud "${descripcionTipo(solicitud.tipo)}" fue aprobada y aplicada.`,
        url: '/solicitudes-cambio',
        datos_adicionales: { solicitud_id: solicitud.id }
      });
    } catch (e) { /* no crítico */ }

    const completa = await SolicitudCambio.findByPk(solicitud.id, { include: incluirRelaciones });
    res.json({ success: true, message: 'Solicitud aprobada y cambio aplicado', data: { solicitud: completa, resultado } });
  } catch (error) {
    await transaction.rollback();
    console.error('Error al aprobar:', error);
    res.status(400).json({ success: false, message: error.message || 'Error al aprobar' });
  }
};

/**
 * Rechazar solicitud (solo admin) — notifica al solicitante con motivo
 */
export const rechazarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const aprobador_id = req.usuario.id;

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ success: false, message: 'Motivo de rechazo es obligatorio' });
    }

    const solicitud = await SolicitudCambio.findByPk(id);
    if (!solicitud) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ success: false, message: `Esta solicitud ya está ${solicitud.estado}` });
    }

    await solicitud.update({
      estado: 'rechazada',
      aprobador_id,
      fecha_resolucion: new Date(),
      motivo_rechazo: motivo.trim()
    });

    // Notificar al solicitante
    try {
      await Notificacion.create({
        usuario_id: solicitud.solicitante_id,
        tipo: 'solicitud_cancelada',
        titulo: 'Solicitud rechazada — requiere corrección',
        mensaje: `Tu solicitud "${descripcionTipo(solicitud.tipo)}" fue rechazada. Motivo: ${motivo.trim()}`,
        url: '/solicitudes-cambio',
        datos_adicionales: { solicitud_id: solicitud.id, motivo: motivo.trim() }
      });
    } catch (e) { /* no crítico */ }

    const completa = await SolicitudCambio.findByPk(solicitud.id, { include: incluirRelaciones });
    res.json({ success: true, message: 'Solicitud rechazada y solicitante notificado', data: { solicitud: completa } });
  } catch (error) {
    console.error('Error al rechazar:', error);
    res.status(500).json({ success: false, message: 'Error al rechazar solicitud' });
  }
};

const descripcionTipo = (tipo) => ({
  cambio_ubicacion: 'cambio de ubicación',
  entrada_stock: 'entrada de stock',
  salida_stock: 'salida de stock',
  crear_articulo: 'creación de artículo',
  desactivar_articulo: 'desactivación de artículo'
}[tipo] || tipo);
