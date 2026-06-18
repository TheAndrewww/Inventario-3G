/**
 * Tarea de UNA SOLA VEZ: deja en cero las solicitudes de cambio pendientes.
 * Para cada solicitud pendiente:
 *   - intenta APROBARLA (crea movimiento + ajusta stock, igual que la aprobación normal);
 *     las SALIDAS que excedan el stock descuentan solo lo disponible y dejan el stock en 0.
 *   - si la aprobación falla por cualquier motivo, ELIMINA la solicitud.
 * Resultado: 0 solicitudes pendientes.
 *
 * Cada solicitud se procesa en su propia transacción.
 */

import { sequelize, SolicitudCambio, Articulo, Usuario, Movimiento, DetalleMovimiento, Ubicacion } from '../models/index.js';

const generarTicketID = () => {
  const ahora = new Date();
  const yymmdd = ahora.toISOString().slice(2, 10).replace(/-/g, '');
  const rnd = Math.floor(Math.random() * 9000) + 1000;
  return `SC-${yymmdd}-${rnd}`;
};

// Aplica el cambio real de una solicitud. Devuelve { capado } cuando una salida se topó en 0.
const aplicar = async (solicitud, aprobador_id, transaction) => {
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
      return {};
    }

    case 'entrada_stock':
    case 'salida_stock': {
      const articulo = await Articulo.findByPk(solicitud.articulo_id, { transaction });
      if (!articulo) throw new Error('Artículo no encontrado');
      let cantidad = parseFloat(solicitud.payload.cantidad);
      if (!cantidad || cantidad <= 0) throw new Error('Cantidad inválida en la solicitud');

      const tipoMov = solicitud.tipo === 'entrada_stock' ? 'ajuste_entrada' : 'ajuste_salida';
      let nuevoStock = parseFloat(articulo.stock_actual);
      let capado = false;

      if (tipoMov === 'ajuste_entrada') {
        nuevoStock += cantidad;
      } else if (nuevoStock < cantidad) {
        // Salida que excede el stock: descontar solo lo disponible y dejar en 0.
        cantidad = nuevoStock < 0 ? 0 : nuevoStock;
        nuevoStock = 0;
        capado = true;
      } else {
        nuevoStock -= cantidad;
      }

      const movimiento = await Movimiento.create({
        ticket_id: generarTicketID(),
        tipo: tipoMov,
        fecha_hora: new Date(),
        usuario_id: solicitud.solicitante_id,
        supervisor_id: aprobador_id,
        observaciones: solicitud.payload.observaciones || `Aprobado en lote desde solicitud #${solicitud.id}`,
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
      return { capado };
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
      return {};
    }

    case 'desactivar_articulo': {
      const articulo = await Articulo.findByPk(solicitud.articulo_id, { transaction });
      if (!articulo) throw new Error('Artículo no encontrado');
      await articulo.update({ activo: false }, { transaction });
      return {};
    }

    default:
      throw new Error(`Tipo no soportado: ${solicitud.tipo}`);
  }
};

/**
 * Procesa todas las pendientes: aprobar o, si no se puede, eliminar.
 * Devuelve un resumen.
 */
export const procesarPendientesUnaVez = async () => {
  const admin = await Usuario.findOne({ where: { rol: 'administrador', activo: true }, order: [['id', 'ASC']] });
  const aprobador_id = admin ? admin.id : null;

  const pendientes = await SolicitudCambio.findAll({ where: { estado: 'pendiente' }, order: [['created_at', 'ASC']] });
  console.log(`🧹 Procesando ${pendientes.length} solicitud(es) pendiente(s)...`);

  let aprobadas = 0, capadas = 0, eliminadas = 0;

  for (const p of pendientes) {
    const t = await sequelize.transaction();
    try {
      const solicitud = await SolicitudCambio.findByPk(p.id, { transaction: t });
      if (!solicitud || solicitud.estado !== 'pendiente') { await t.rollback(); continue; }

      const r = await aplicar(solicitud, aprobador_id, t);
      await solicitud.update({ estado: 'aprobada', aprobador_id, fecha_resolucion: new Date() }, { transaction: t });
      await t.commit();
      aprobadas++;
      if (r.capado) capadas++;
    } catch (e) {
      // No se pudo aprobar → eliminar la solicitud (en su propia transacción).
      await t.rollback();
      try {
        await SolicitudCambio.destroy({ where: { id: p.id } });
        eliminadas++;
        console.log(`  🗑️  #${p.id} ${p.tipo} eliminada (no se pudo aprobar: ${e.message})`);
      } catch (delErr) {
        console.error(`  ⚠️  #${p.id} no se pudo aprobar ni eliminar: ${delErr.message}`);
      }
    }
  }

  console.log(`✅ Pendientes procesadas — aprobadas: ${aprobadas} (salidas topadas en 0: ${capadas}), eliminadas: ${eliminadas}`);
  return { aprobadas, capadas, eliminadas, total: pendientes.length };
};
