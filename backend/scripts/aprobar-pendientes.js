/**
 * Script de UNA SOLA VEZ: aprueba TODAS las solicitudes de cambio pendientes.
 *
 * - Aplica cada solicitud con la misma lógica que la aprobación normal
 *   (crea movimiento + detalle, actualiza stock, marca la solicitud como aprobada).
 * - Para SALIDAS que excedan el stock disponible: descuenta solo lo disponible y
 *   deja el stock en 0 (no falla, no queda negativo).
 * - Cada solicitud se procesa en su propia transacción: si una falla, no afecta a las demás.
 *
 * USO LOCAL:        node scripts/aprobar-pendientes.js
 * USO PRODUCCIÓN:   railway run node scripts/aprobar-pendientes.js
 *                   (railway inyecta las variables de producción; corre contra la BD real)
 */

import { sequelize, SolicitudCambio, Articulo, Usuario, Movimiento, DetalleMovimiento, Ubicacion } from '../src/models/index.js';

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
      return { capado, nuevoStock };
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

const run = async () => {
  await sequelize.authenticate();
  console.log(`✅ Conectado a "${sequelize.getDatabaseName?.() || 'BD'}"`);

  const admin = await Usuario.findOne({ where: { rol: 'administrador', activo: true }, order: [['id', 'ASC']] });
  const aprobador_id = admin ? admin.id : null;
  console.log(`👤 Aprobador: ${admin ? admin.nombre + ' (id ' + admin.id + ')' : 'ninguno (aprobador_id null)'}`);

  const pendientes = await SolicitudCambio.findAll({ where: { estado: 'pendiente' }, order: [['created_at', 'ASC']] });
  console.log(`📋 Solicitudes pendientes: ${pendientes.length}\n`);

  if (pendientes.length === 0) {
    console.log('ℹ️  No hay nada que aprobar.');
    await sequelize.close();
    return;
  }

  let aprobadas = 0, capadas = 0, fallidas = 0;
  const errores = [];

  for (const p of pendientes) {
    const t = await sequelize.transaction();
    try {
      const solicitud = await SolicitudCambio.findByPk(p.id, { transaction: t });
      if (!solicitud || solicitud.estado !== 'pendiente') { await t.rollback(); continue; }

      const r = await aplicar(solicitud, aprobador_id, t);
      await solicitud.update({ estado: 'aprobada', aprobador_id, fecha_resolucion: new Date() }, { transaction: t });
      await t.commit();

      aprobadas++;
      if (r.capado) {
        capadas++;
        console.log(`  ✔ #${p.id} ${p.tipo} → aprobada (SALIDA topada en 0)`);
      } else {
        console.log(`  ✔ #${p.id} ${p.tipo} → aprobada`);
      }
    } catch (e) {
      await t.rollback();
      fallidas++;
      errores.push({ id: p.id, tipo: p.tipo, error: e.message });
      console.log(`  ✗ #${p.id} ${p.tipo} → FALLÓ: ${e.message}`);
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`✅ Aprobadas: ${aprobadas}`);
  console.log(`⚖️  Salidas topadas en 0: ${capadas}`);
  console.log(`❌ Fallidas: ${fallidas}`);
  if (errores.length) console.log('Detalle de fallidas:', JSON.stringify(errores, null, 2));

  await sequelize.close();
};

run().catch(async (e) => {
  console.error('💥 Error fatal:', e.message);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
