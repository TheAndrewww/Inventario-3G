import { Usuario } from '../models/index.js';
import bcrypt from 'bcryptjs';

/**
 * Obtener todos los usuarios
 */
export const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: { usuarios }
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    });
  }
};

/**
 * Obtener usuario por ID
 */
export const obtenerUsuarioPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await Usuario.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: { usuario }
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario'
    });
  }
};

/**
 * Obtener solo encargados
 */
export const obtenerEncargados = async (req, res) => {
  try {
    const encargados = await Usuario.findAll({
      where: {
        rol: 'encargado',
        activo: true
      },
      attributes: { exclude: ['password'] },
      order: [['nombre', 'ASC']]
    });

    res.json({
      success: true,
      data: { encargados }
    });
  } catch (error) {
    console.error('Error al obtener encargados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener encargados'
    });
  }
};

/**
 * Crear nuevo usuario
 */
export const crearUsuario = async (req, res) => {
  try {
    const { nombre, email, password, rol, puesto, telefono } = req.body;

    // Validaciones
    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, email, password y rol son obligatorios'
      });
    }

    // Validar que el rol sea válido
    const rolesValidos = ['administrador', 'diseñador', 'almacen', 'encargado', 'compras'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        success: false,
        message: 'Rol no válido'
      });
    }

    // Verificar que el email no exista
    const usuarioExistente = await Usuario.findOne({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Crear usuario (la contraseña se encripta automáticamente en el hook)
    const usuario = await Usuario.create({
      nombre,
      email,
      password,
      rol,
      puesto: puesto || null,
      telefono: telefono || null,
      activo: true
    });

    // Remover password de la respuesta
    const usuarioSinPassword = usuario.toJSON();
    delete usuarioSinPassword.password;

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: { usuario: usuarioSinPassword }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario'
    });
  }
};

/**
 * Actualizar usuario
 */
export const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, password, rol, puesto, telefono, activo } = req.body;

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Validar rol si se está actualizando
    if (rol) {
      const rolesValidos = ['administrador', 'diseñador', 'almacen', 'encargado', 'compras'];
      if (!rolesValidos.includes(rol)) {
        return res.status(400).json({
          success: false,
          message: 'Rol no válido'
        });
      }
    }

    // Verificar que el email no esté siendo usado por otro usuario
    if (email && email !== usuario.email) {
      const emailExistente = await Usuario.findOne({ where: { email } });
      if (emailExistente) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado'
        });
      }
    }

    // Actualizar campos
    const datosActualizar = {};
    if (nombre) datosActualizar.nombre = nombre;
    if (email) datosActualizar.email = email;
    if (rol) datosActualizar.rol = rol;
    if (puesto !== undefined) datosActualizar.puesto = puesto;
    if (telefono !== undefined) datosActualizar.telefono = telefono;
    if (activo !== undefined) datosActualizar.activo = activo;

    // Si se proporciona password, encriptarlo
    if (password && password.trim() !== '') {
      datosActualizar.password = password;
    }

    await usuario.update(datosActualizar);

    // Remover password de la respuesta
    const usuarioActualizado = await Usuario.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: { usuario: usuarioActualizado }
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario'
    });
  }
};

/**
 * Eliminar usuario (soft delete)
 */
export const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioActual = req.usuario.id;

    // No permitir que el usuario se elimine a sí mismo
    if (parseInt(id) === usuarioActual) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta'
      });
    }

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Soft delete: marcar como inactivo
    await usuario.update({ activo: false });

    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  }
};
