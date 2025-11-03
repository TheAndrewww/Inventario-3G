import jwt from 'jsonwebtoken';
import { Usuario } from '../models/index.js';

/**
 * Genera un token JWT para el usuario
 * @param {Object} usuario - Objeto del usuario
 * @returns {string} - Token JWT
 */
const generarToken = (usuario) => {
    return jwt.sign(
        {
            id: usuario.id,
            email: usuario.email,
            rol: usuario.rol
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRE || '7d'
        }
    );
};

/**
 * POST /api/auth/register
 * Registrar un nuevo usuario (solo administradores pueden crear usuarios)
 */
export const register = async (req, res) => {
    try {
        const { nombre, email, password, rol, telefono, puesto } = req.body;

        // Validar campos requeridos
        if (!nombre || !email || !password || !rol) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos: nombre, email, password, rol'
            });
        }

        // Verificar si el email ya existe
        const usuarioExistente = await Usuario.findOne({ where: { email } });

        if (usuarioExistente) {
            return res.status(400).json({
                success: false,
                message: 'El email ya está registrado'
            });
        }

        // Validar rol
        const rolesPermitidos = ['administrador', 'supervisor', 'empleado'];
        if (!rolesPermitidos.includes(rol)) {
            return res.status(400).json({
                success: false,
                message: `Rol inválido. Roles permitidos: ${rolesPermitidos.join(', ')}`
            });
        }

        // Crear usuario (el password se encripta automáticamente por el hook beforeCreate)
        const nuevoUsuario = await Usuario.create({
            nombre,
            email,
            password,
            rol,
            telefono,
            puesto,
            activo: true
        });

        // Generar token
        const token = generarToken(nuevoUsuario);

        // Remover password de la respuesta
        const usuarioRespuesta = nuevoUsuario.toJSON();
        delete usuarioRespuesta.password;

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            data: {
                usuario: usuarioRespuesta,
                token
            }
        });

    } catch (error) {
        console.error('Error en register:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar usuario',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/auth/login
 * Iniciar sesión
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validar campos requeridos
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y password son requeridos'
            });
        }

        // Buscar usuario por email
        const usuario = await Usuario.findOne({ where: { email } });

        console.log('🔍 Login - Usuario encontrado:', !!usuario);

        if (!usuario) {
            console.log('❌ Login - Usuario no existe:', email);
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        console.log('🔍 Login - Usuario activo:', usuario.activo);

        // Verificar si el usuario está activo
        if (!usuario.activo) {
            console.log('❌ Login - Usuario inactivo:', email);
            return res.status(401).json({
                success: false,
                message: 'Usuario inactivo. Contacte al administrador.'
            });
        }

        // Verificar password (usa el método del modelo)
        console.log('🔍 Login - Verificando password...');
        const passwordValido = await usuario.compararPassword(password);
        console.log('🔍 Login - Password válido:', passwordValido);

        if (!passwordValido) {
            console.log('❌ Login - Password incorrecto para:', email);
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        console.log('✅ Login exitoso para:', email);

        // Actualizar última conexión
        await usuario.update({ ultima_conexion: new Date() });

        // Generar token
        const token = generarToken(usuario);

        // Remover password de la respuesta
        const usuarioRespuesta = usuario.toJSON();
        delete usuarioRespuesta.password;

        res.status(200).json({
            success: true,
            message: 'Inicio de sesión exitoso',
            data: {
                usuario: usuarioRespuesta,
                token
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error al iniciar sesión',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/auth/verify
 * Verificar token y obtener datos del usuario actual
 */
export const verify = async (req, res) => {
    try {
        // El usuario ya está en req.usuario (agregado por el middleware verificarToken)
        const usuario = req.usuario;

        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                usuario
            }
        });

    } catch (error) {
        console.error('Error en verify:', error);
        res.status(500).json({
            success: false,
            message: 'Error al verificar token',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/auth/me
 * Obtener información del usuario autenticado
 */
export const getMe = async (req, res) => {
    try {
        const usuario = req.usuario;

        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'No autenticado'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                usuario
            }
        });

    } catch (error) {
        console.error('Error en getMe:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuario',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * PUT /api/auth/cambiar-password
 * Cambiar contraseña del usuario autenticado
 */
export const cambiarPassword = async (req, res) => {
    try {
        const { passwordActual, passwordNuevo } = req.body;
        const usuario = req.usuario;

        if (!passwordActual || !passwordNuevo) {
            return res.status(400).json({
                success: false,
                message: 'Password actual y nuevo son requeridos'
            });
        }

        // Buscar usuario completo (con password)
        const usuarioCompleto = await Usuario.findByPk(usuario.id);

        // Verificar password actual
        const passwordValido = await usuarioCompleto.compararPassword(passwordActual);

        if (!passwordValido) {
            return res.status(401).json({
                success: false,
                message: 'Password actual incorrecto'
            });
        }

        // Validar longitud del nuevo password
        if (passwordNuevo.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'El nuevo password debe tener al menos 6 caracteres'
            });
        }

        // Actualizar password (se encripta automáticamente por el hook)
        await usuarioCompleto.update({ password: passwordNuevo });

        res.status(200).json({
            success: true,
            message: 'Password actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error en cambiarPassword:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar password',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    register,
    login,
    verify,
    getMe,
    cambiarPassword
};
