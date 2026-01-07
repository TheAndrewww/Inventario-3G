import cron from 'node-cron';
import { OrdenCompra, Usuario, Proveedor } from '../models/index.js';
import { Op } from 'sequelize';
import { crearNotificacion } from '../controllers/notificaciones.controller.js';
import { iniciarJobAnuncios } from '../jobs/generarAnunciosDiarios.js';

/**
 * Verificar órdenes de compra vencidas y enviar notificaciones
 * Se ejecuta todos los días a las 9:00 AM y a las 2:00 PM
 */
export const verificarOrdenesVencidas = () => {
  // Ejecutar todos los días a las 9:00 AM y 2:00 PM
  cron.schedule('0 9,14 * * *', async () => {
    try {
      console.log('🔍 Verificando órdenes de compra vencidas...');

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // Buscar órdenes que:
      // 1. Estén en estado 'enviada' (esperando entrega)
      // 2. Tengan fecha_llegada_estimada menor o igual a hoy
      // 3. No hayan sido recibidas (fecha_recepcion es null)
      const ordenesVencidas = await OrdenCompra.findAll({
        where: {
          estado: 'enviada',
          fecha_llegada_estimada: {
            [Op.lte]: hoy
          },
          fecha_recepcion: null
        },
        include: [
          {
            model: Proveedor,
            as: 'proveedor',
            attributes: ['id', 'nombre', 'telefono', 'email']
          },
          {
            model: Usuario,
            as: 'creador',
            attributes: ['id', 'nombre', 'email']
          }
        ]
      });

      console.log(`📦 Se encontraron ${ordenesVencidas.length} órdenes vencidas`);

      // Crear notificaciones para usuarios de compras y administradores
      const usuariosCompras = await Usuario.findAll({
        where: {
          rol: {
            [Op.in]: ['compras', 'administrador']
          },
          activo: true
        }
      });

      for (const orden of ordenesVencidas) {
        const diasRetraso = Math.floor(
          (hoy - new Date(orden.fecha_llegada_estimada)) / (1000 * 60 * 60 * 24)
        );

        const mensaje = diasRetraso === 0
          ? `La orden de compra ${orden.ticket_id} del proveedor ${orden.proveedor?.nombre || 'Sin proveedor'} debió llegar hoy.`
          : `La orden de compra ${orden.ticket_id} del proveedor ${orden.proveedor?.nombre || 'Sin proveedor'} tiene un retraso de ${diasRetraso} día(s).`;

        // Crear notificación para cada usuario de compras/admin
        for (const usuario of usuariosCompras) {
          await crearNotificacion({
            usuario_id: usuario.id,
            tipo: 'orden_vencida',
            titulo: '⚠️ Orden de Compra Vencida',
            mensaje,
            datos: {
              orden_id: orden.id,
              ticket_id: orden.ticket_id,
              proveedor: orden.proveedor?.nombre,
              dias_retraso: diasRetraso,
              fecha_llegada_estimada: orden.fecha_llegada_estimada
            }
          });
        }

        console.log(`📧 Notificaciones enviadas para orden ${orden.ticket_id}`);
      }

      if (ordenesVencidas.length > 0) {
        console.log('✅ Verificación de órdenes vencidas completada');
      } else {
        console.log('✅ No hay órdenes vencidas');
      }

    } catch (error) {
      console.error('❌ Error al verificar órdenes vencidas:', error);
    }
  });

  console.log('⏰ Cron job iniciado: Verificación de órdenes vencidas (9:00 AM y 2:00 PM)');
};

/**
 * Iniciar todos los cron jobs
 */
export const iniciarCronJobs = () => {
  verificarOrdenesVencidas();
  iniciarJobAnuncios();
  console.log('✅ Todos los cron jobs han sido iniciados');
};
