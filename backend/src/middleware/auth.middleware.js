import jwt from 'jsonwebtoken';
import { Usuario } from '../models/index.js';

/**
 * Middleware para verificar el token JWT
 * Extrae el token del header Authorization y verifica su validez
 */
export const verificarToken = async (req, res, next) => {
    try {
        // Obtener token del header
        let token = req.headers.authorization;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No se proporcionó token de autenticación'
            });
        }

        // Remover 'Bearer ' si está presente
        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
        }

        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Buscar usuario en la base de datos
        const usuario = await Usuario.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }
        });

        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        if (!usuario.activo) {
            return res.status(401).json({
                success: false,
                message: 'Usuario inactivo'
            });
        }

        // Agregar usuario al request para usarlo en los controladores
        req.usuario = usuario;

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado'
            });
        }

        console.error('Error en verificarToken:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al verificar token'
        });
    }
};

/**
 * Middleware para verificar roles específicos
 * @param  {...string} rolesPermitidos - Roles que tienen acceso
 * @returns {Function} - Middleware function
 */
export const verificarRol = (...rolesPermitidos) => {
    return (req, res, next) => {
        try {
            // El usuario debe estar en req.usuario (agregado por verificarToken)
            if (!req.usuario) {
                return res.status(401).json({
                    success: false,
                    message: 'No autenticado'
                });
            }

            const { rol } = req.usuario;

            // Verificar si el rol del usuario está en los roles permitidos
            if (!rolesPermitidos.includes(rol)) {
                return res.status(403).json({
                    success: false,
                    message: `Acceso denegado. Se requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}`
                });
            }

            next();

        } catch (error) {
            console.error('Error en verificarRol:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar permisos'
            });
        }
    };
};

/**
 * Middleware para verificar que el usuario sea administrador
 */
export const esAdministrador = (req, res, next) => {
    return verificarRol('administrador')(req, res, next);
};

/**
 * Middleware para verificar que el usuario sea encargado o administrador
 */
export const esEncargadoOAdmin = (req, res, next) => {
    return verificarRol('encargado', 'administrador')(req, res, next);
};

/**
 * Middleware para verificar que el usuario tenga acceso a gestión de inventario
 * (Almacen, Encargado, Administrador)
 */
export const accesoInventario = (req, res, next) => {
    return verificarRol('almacen', 'encargado', 'administrador')(req, res, next);
};

/**
 * Middleware para verificar que el usuario tenga acceso a compras
 * (Compras, Encargado, Administrador)
 */
export const accesoCompras = (req, res, next) => {
    return verificarRol('compras', 'encargado', 'administrador')(req, res, next);
};

/**
 * Middleware para verificar que el usuario sea diseñador
 * (Diseñador, Encargado, Administrador)
 */
export const accesoDiseño = (req, res, next) => {
    return verificarRol('diseñador', 'encargado', 'administrador')(req, res, next);
};

/**
 * Middleware para verificar que el usuario tenga permisos de gestión
 * (Encargado, Administrador)
 */
export const accesoGestion = (req, res, next) => {
    return verificarRol('encargado', 'administrador')(req, res, next);
};

/**
 * Middleware para verificar que el usuario pueda crear pedidos
 * (Diseñador, Administrador)
 */
export const puedeCrearPedidos = (req, res, next) => {
    return verificarRol('diseñador', 'administrador')(req, res, next);
};

/**
 * Middleware para verificar que el usuario sea de almacén
 * (Almacen, Encargado, Administrador)
 */
export const esAlmacen = (req, res, next) => {
    return verificarRol('almacen', 'encargado', 'administrador')(req, res, next);
};

/**
 * Middleware para verificar que el usuario esté autenticado (cualquier rol)
 */
export const estaAutenticado = verificarToken;

/**
 * Middleware opcional: verificar token pero no fallar si no existe
 * Útil para endpoints que funcionan con o sin autenticación
 */
export const verificarTokenOpcional = async (req, res, next) => {
    try {
        let token = req.headers.authorization;

        if (!token) {
            // No hay token, pero no es un error - continuar sin usuario
            req.usuario = null;
            return next();
        }

        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const usuario = await Usuario.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }
        });

        req.usuario = usuario || null;

        next();

    } catch (error) {
        // Si hay error, continuar sin usuario
        req.usuario = null;
        next();
    }
};

export default {
    verificarToken,
    verificarRol,
    esAdministrador,
    esEncargadoOAdmin,
    accesoInventario,
    accesoCompras,
    accesoDiseño,
    accesoGestion,
    puedeCrearPedidos,
    esAlmacen,
    estaAutenticado,
    verificarTokenOpcional
};
