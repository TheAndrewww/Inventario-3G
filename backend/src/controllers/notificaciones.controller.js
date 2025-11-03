import { Notificacion, Usuario } from '../models/index.js';
import { Op } from 'sequelize';

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
    const notificacion = await Notificacion.create({
      usuario_id,
      tipo,
      titulo,
      mensaje,
      url,
      datos_adicionales
    });

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
      await notificarUsuarios({
        usuarios_ids,
        tipo,
        titulo,
        mensaje,
        url,
        datos_adicionales
      });
    }

    return true;
  } catch (error) {
    console.error('Error al notificar por rol:', error);
    throw error;
  }
};
