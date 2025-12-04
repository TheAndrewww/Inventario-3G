import { Notificacion, Usuario, FCMToken } from '../models/index.js';
import { Op } from 'sequelize';
import { messaging } from '../config/firebase-admin.js';

/**
 * Obtener notificaciones del usuario autenticado
 */
export const obtenerNotificaciones = async (req, res) => {
  try {
    const usuario_id = req.usuario.id;
    const { limit = 50, solo_no_leidas = false } = req.query;

    const where = { usuario_id };

    if (solo_no_leidas === 'true') {
      where.leida = false;
    }

    const notificaciones = await Notificacion.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      data: { notificaciones }
    });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las notificaciones',
      error: error.message
    });
  }
};

/**
 * Contar notificaciones no leídas
 */
export const contarNoLeidas = async (req, res) => {
  try {
    const usuario_id = req.usuario.id;

    const count = await Notificacion.count({
      where: {
        usuario_id,
        leida: false
      }
    });

    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error al contar notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al contar notificaciones no leídas',
      error: error.message
    });
  }
};

/**
 * Marcar una notificación como leída
 */
export const marcarComoLeida = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.usuario.id;

    const notificacion = await Notificacion.findOne({
      where: { id, usuario_id }
    });

    if (!notificacion) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    notificacion.leida = true;
    await notificacion.save();

    res.status(200).json({
      success: true,
      message: 'Notificación marcada como leída',
      data: { notificacion }
    });
  } catch (error) {
    console.error('Error al marcar notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar la notificación como leída',
      error: error.message
    });
  }
};

/**
 * Marcar todas las notificaciones como leídas
 */
export const marcarTodasComoLeidas = async (req, res) => {
  try {
    const usuario_id = req.usuario.id;

    await Notificacion.update(
      { leida: true },
      {
        where: {
          usuario_id,
          leida: false
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Todas las notificaciones marcadas como leídas'
    });
  } catch (error) {
    console.error('Error al marcar todas las notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar todas las notificaciones como leídas',
      error: error.message
    });
  }
};

/**
 * Eliminar una notificación
 */
export const eliminarNotificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.usuario.id;

    const notificacion = await Notificacion.findOne({
      where: { id, usuario_id }
    });

    if (!notificacion) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    await notificacion.destroy();

    res.status(200).json({
      success: true,
      message: 'Notificación eliminada'
    });
  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la notificación',
      error: error.message
    });
  }
};

/**
 * Función auxiliar para crear notificaciones
 * Se puede llamar desde otros controladores
 * Ahora también envía notificación push FCM
 */
export const crearNotificacion = async ({
  usuario_id,
  tipo,
  titulo,
  mensaje,
  url = null,
  datos_adicionales = null
}) => {
  try {
    // Crear notificación en base de datos
    const notificacion = await Notificacion.create({
      usuario_id,
      tipo,
      titulo,
      mensaje,
      url,
      datos_adicionales
    });

    // Enviar notificación push FCM (no bloquea si falla)
    try {
      await enviarPushFCM(usuario_id, {
        titulo,
        mensaje,
        url,
        tipo,
        datos: datos_adicionales || {}
      });
    } catch (fcmError) {
      console.error('Error al enviar push FCM (no crítico):', fcmError.message);
      // No lanzar error, la notificación en BD ya se creó
    }

    return notificacion;
  } catch (error) {
    console.error('Error al crear notificación:', error);
    throw error;
  }
};

/**
 * Función auxiliar para notificar a múltiples usuarios
 */
export const notificarUsuarios = async ({
  usuarios_ids,
  tipo,
  titulo,
  mensaje,
  url = null,
  datos_adicionales = null
}) => {
  try {
    const notificaciones = usuarios_ids.map(usuario_id => ({
      usuario_id,
      tipo,
      titulo,
      mensaje,
      url,
      datos_adicionales
    }));

    await Notificacion.bulkCreate(notificaciones);

    return true;
  } catch (error) {
    console.error('Error al notificar usuarios:', error);
    throw error;
  }
};

/**
 * Función auxiliar para notificar a usuarios por rol
 * Ahora también envía notificaciones push FCM
 */
export const notificarPorRol = async ({
  roles,
  tipo,
  titulo,
  mensaje,
  url = null,
  datos_adicionales = null
}) => {
  try {
    // Obtener usuarios con los roles especificados
    const usuarios = await Usuario.findAll({
      where: {
        rol: { [Op.in]: roles },
        activo: true
      },
      attributes: ['id']
    });

    const usuarios_ids = usuarios.map(u => u.id);

    if (usuarios_ids.length > 0) {
      // Crear notificaciones en base de datos
      await notificarUsuarios({
        usuarios_ids,
        tipo,
        titulo,
        mensaje,
        url,
        datos_adicionales
      });

      // Enviar notificaciones push FCM (no bloquea si falla)
      try {
        await enviarPushPorRol(roles, {
          titulo,
          mensaje,
          url,
          tipo,
          datos: datos_adicionales || {}
        });
      } catch (fcmError) {
        console.error('Error al enviar push FCM por rol (no crítico):', fcmError.message);
        // No lanzar error, las notificaciones en BD ya se crearon
      }
    }

    return true;
  } catch (error) {
    console.error('Error al notificar por rol:', error);
    throw error;
  }
};

/**
 * ========================================
 * FUNCIONES FCM (Firebase Cloud Messaging)
 * ========================================
 */

/**
 * Registrar token FCM de un dispositivo
 */
export const registerFCMToken = async (req, res) => {
  try {
    const { fcm_token, device_type, browser } = req.body;
    const usuario_id = req.usuario.id;

    if (!fcm_token) {
      return res.status(400).json({
        success: false,
        message: 'Token FCM requerido'
      });
    }

    // Buscar si el token ya existe
    const tokenExistente = await FCMToken.findOne({
      where: { fcm_token }
    });

    if (tokenExistente) {
      // Actualizar el token existente
      tokenExistente.usuario_id = usuario_id;
      tokenExistente.device_type = device_type || 'web';
      tokenExistente.browser = browser;
      tokenExistente.last_used_at = new Date();
      await tokenExistente.save();

      return res.status(200).json({
        success: true,
        message: 'Token FCM actualizado',
        data: { token: tokenExistente }
      });
    }

    // Crear nuevo token
    const nuevoToken = await FCMToken.create({
      usuario_id,
      fcm_token,
      device_type: device_type || 'web',
      browser,
      last_used_at: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Token FCM registrado',
      data: { token: nuevoToken }
    });
  } catch (error) {
    console.error('Error al registrar token FCM:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar token',
      error: error.message
    });
  }
};

/**
 * Eliminar token FCM
 */
export const unregisterFCMToken = async (req, res) => {
  try {
    const { fcm_token } = req.body;
    const usuario_id = req.usuario.id;

    await FCMToken.destroy({
      where: { fcm_token, usuario_id }
    });

    res.status(200).json({
      success: true,
      message: 'Token FCM eliminado'
    });
  } catch (error) {
    console.error('Error al eliminar token FCM:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar token',
      error: error.message
    });
  }
};

/**
 * Enviar notificación push FCM a un usuario específico
 */
export const enviarPushFCM = async (usuario_id, { titulo, mensaje, url, tipo, datos = {} }) => {
  // Si messaging no está disponible, salir silenciosamente
  if (!messaging) {
    console.log('⚠️ Firebase Admin no configurado. No se envió notificación push.');
    return null;
  }

  try {
    // Obtener todos los tokens del usuario
    const tokens = await FCMToken.findAll({
      where: { usuario_id },
      attributes: ['fcm_token', 'id']
    });

    if (tokens.length === 0) {
      console.log(`ℹ️ Usuario ${usuario_id} no tiene tokens FCM registrados`);
      return null;
    }

    const fcmTokens = tokens.map(t => t.fcm_token);

    // Preparar mensaje FCM - Solo data, sin notification para evitar duplicación
    // El frontend y Service Worker construirán la notificación desde data
    const message = {
      data: {
        title: titulo,
        body: mensaje,
        url: url || '/',
        tipo: tipo || 'general',
        urgente: tipo === 'solicitud_urgente' ? 'true' : 'false',
        ...Object.fromEntries(
          Object.entries(datos || {}).map(([k, v]) => [k, String(v)])
        )
      },
      // Configuración específica para navegadores web
      webpush: {
        headers: {
          Urgency: tipo === 'solicitud_urgente' ? 'high' : 'normal'
        },
        // Datos FCM que activarán el Service Worker
        fcmOptions: {
          link: url || '/'
        }
      },
      tokens: fcmTokens
    };

    // Enviar notificación
    const response = await messaging.sendEachForMulticast(message);

    console.log(`✅ Notificación FCM enviada a ${response.successCount} de ${fcmTokens.length} dispositivos`);

    // Eliminar tokens inválidos
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(fcmTokens[idx]);
          console.log(`❌ Token FCM inválido: ${resp.error?.message}`);
        }
      });

      if (failedTokens.length > 0) {
        await FCMToken.destroy({
          where: { fcm_token: failedTokens }
        });
        console.log(`🗑️ Eliminados ${failedTokens.length} tokens FCM inválidos`);
      }
    }

    return response;
  } catch (error) {
    console.error('❌ Error al enviar notificación FCM:', error);
    return null;
  }
};

/**
 * Enviar notificación push FCM a usuarios por rol
 */
export const enviarPushPorRol = async (roles, { titulo, mensaje, url, tipo, datos = {} }) => {
  // Si messaging no está disponible, salir silenciosamente
  if (!messaging) {
    console.log('⚠️ Firebase Admin no configurado. No se envió notificación push.');
    return null;
  }

  try {
    // Obtener usuarios con esos roles
    const usuarios = await Usuario.findAll({
      where: {
        rol: { [Op.in]: roles },
        activo: true
      },
      attributes: ['id']
    });

    // Obtener tokens de esos usuarios
    const usuariosIds = usuarios.map(u => u.id);

    if (usuariosIds.length === 0) {
      console.log(`ℹ️ No hay usuarios con los roles: ${roles.join(', ')}`);
      return null;
    }

    const tokens = await FCMToken.findAll({
      where: { usuario_id: usuariosIds },
      attributes: ['fcm_token']
    });

    if (tokens.length === 0) {
      console.log(`ℹ️ No hay tokens FCM para los roles: ${roles.join(', ')}`);
      return null;
    }

    const fcmTokens = tokens.map(t => t.fcm_token);

    // Preparar mensaje FCM - Solo data, sin notification para evitar duplicación
    // El frontend y Service Worker construirán la notificación desde data
    const message = {
      data: {
        title: titulo,
        body: mensaje,
        url: url || '/',
        tipo: tipo || 'general',
        urgente: tipo === 'solicitud_urgente' ? 'true' : 'false',
        ...Object.fromEntries(
          Object.entries(datos || {}).map(([k, v]) => [k, String(v)])
        )
      },
      // Configuración específica para navegadores web
      webpush: {
        headers: {
          Urgency: tipo === 'solicitud_urgente' ? 'high' : 'normal'
        },
        // Datos FCM que activarán el Service Worker
        fcmOptions: {
          link: url || '/'
        }
      },
      tokens: fcmTokens
    };

    // Enviar notificación
    const response = await messaging.sendEachForMulticast(message);

    console.log(`✅ Notificación FCM enviada a ${response.successCount} de ${fcmTokens.length} dispositivos (roles: ${roles.join(', ')})`);

    // Eliminar tokens inválidos
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(fcmTokens[idx]);
        }
      });

      if (failedTokens.length > 0) {
        await FCMToken.destroy({
          where: { fcm_token: failedTokens }
        });
        console.log(`🗑️ Eliminados ${failedTokens.length} tokens FCM inválidos`);
      }
    }

    return response;
  } catch (error) {
    console.error('❌ Error al enviar notificación FCM por rol:', error);
    return null;
  }
};
