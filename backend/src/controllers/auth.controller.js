import jwt from 'jsonwebtoken';
import { Usuario } from '../models/index.js';
import { piezaCerrada, TEXTO_INCOMPLETA } from '../utils/revisarConfig.js';
import {
    modoCuentas3g,
    entrarConFicha,
    respuestaDeError,
    anotarEntrada,
    recibirAviso,
    avisoSinRespuesta,
    correoOculto,
    contrasenaPermitida,
    esEntradaDeEmergencia,
    estadoPublico,
    reporteCuentas3g as armarReporteCuentas3g
} from '../services/cuentas3g.service.js';

/**
 * Genera un token JWT para el usuario
 * @param {Object} usuario - Objeto del usuario
 * @param {Object} [extra] - Datos de más (E1 · PLA-23: c3g_sub y c3g_ver cuando entra con su cuenta 3G)
 * @returns {string} - Token JWT
 */
const generarToken = (usuario, extra = {}) => {
    return jwt.sign(
        {
            id: usuario.id,
            email: usuario.email,
            rol: usuario.rol,
            ...extra
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
        const rolesPermitidos = ['administrador', 'encargado', 'almacen', 'diseñador', 'compras', 'ventas', 'operador'];
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
        // E1 · PLA-24: con CUENTAS3G_MODO=solo la contraseña de siempre ya no entra, salvo con la llave de emergencia
        // (CUENTAS3G_EMERGENCIA) y solo para administración. En «apagado» y «ambos», como hoy.
        if (!contrasenaPermitida()) {
            return res.status(403).json({
                success: false,
                codigo: 'CUENTAS3G_SOLO',
                message: 'Planta ya se entra con tu cuenta 3G: usa «Entrar con tu cuenta 3G».'
            });
        }

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

        // E1 · PLA-24: en «solo» esto solo pasa con la llave de emergencia, y es solo para administración (Dirección).
        // Cada entrada de emergencia queda en el registro del servidor y en cuentas3g_entradas.
        const emergencia = esEntradaDeEmergencia();
        if (emergencia && usuario.rol !== 'administrador') {
            console.warn(`[cuentas3g] entrada de emergencia RECHAZADA (no es administración) · usuario id=${usuario.id} (${correoOculto(usuario.email)}) · ip=${req.ip}`);
            return res.status(403).json({
                success: false,
                codigo: 'CUENTAS3G_EMERGENCIA_SOLO_DIRECCION',
                message: 'La llave de emergencia es solo para Dirección. Entra con tu cuenta 3G cuando vuelva a responder.'
            });
        }

        console.log('✅ Login exitoso para:', email);

        // Actualizar última conexión
        await usuario.update({ ultima_conexion: new Date() });

        // Generar token
        const token = emergencia ? generarToken(usuario, { c3g_emergencia: true }) : generarToken(usuario);
        if (emergencia) {
            console.warn(`[cuentas3g] ENTRADA DE EMERGENCIA · usuario id=${usuario.id} (${correoOculto(usuario.email)}) · ip=${req.ip} · quitar CUENTAS3G_EMERGENCIA cuando Cuentas 3G vuelva`);
            await anotarEntrada({ usuarioId: usuario.id, via: 'emergencia' });
        }

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
 * POST /api/auth/cuentas3g (E1 · PLA-23)
 * Entrar con Cuentas 3G. La pantalla regresa de Cuentas 3G a /entrar/regreso y manda aquí { code, code_verifier, nonce }.
 * El servidor canjea el código con su secreto, valida la ficha, empata al usuario por su correo o por su «correo en
 * Planta» y, si está activo, responde EXACTAMENTE como /api/auth/login: { usuario, token }. El JWT es el de siempre
 * (7 días) más c3g_sub y c3g_ver, que verificarToken revisa contra la lista de versiones.
 * Con CUENTAS3G_MODO apagado la ruta no existe: responde exactamente como hoy. La cubre el límite de A10 (limiteCuentas3g).
 */
export const entrarConCuentas3g = async (req, res) => {
    const modo = modoCuentas3g();
    // A15 · PLA-08: sin JWT_SECRET y con FALLA_CERRADA=1 no se firma nada (igual que /api/auth/login).
    if (await piezaCerrada('sesion')) {
        return res.status(503).json({ success: false, codigo: 'CONFIGURACION_INCOMPLETA', message: TEXTO_INCOMPLETA });
    }
    try {
        const { code, code_verifier: verificador, nonce } = req.body || {};
        const { usuario, empate, ficha } = await entrarConFicha({ codigo: code, verificador, nonce });

        await usuario.update({ ultima_conexion: new Date() });
        const token = generarToken(usuario, { c3g_sub: ficha.sub, c3g_ver: Number(ficha.ver) || 0 });
        await anotarEntrada({ usuarioId: usuario.id, via: 'cuentas3g', sub: ficha.sub, empate });
        console.log(`[cuentas3g] entrada · usuario id=${usuario.id} (${correoOculto(usuario.email)}) · empate por ${empate === 'correo_en_planta' ? '«correo en Planta»' : 'correo'} · sub=${ficha.sub} · ver=${Number(ficha.ver) || 0}`);

        const usuarioRespuesta = usuario.toJSON();
        delete usuarioRespuesta.password;

        return res.status(200).json({
            success: true,
            message: 'Inicio de sesión exitoso',
            data: {
                usuario: usuarioRespuesta,
                token
            }
        });
    } catch (error) {
        const [estado, codigo, message] = respuestaDeError(error, modo);
        if (estado === 500) console.error('[cuentas3g] error al entrar:', error.message);
        else console.warn(`[cuentas3g] entrada rechazada · ${codigo} · ip=${req.ip}${error?.codigo ? ` · ${error.codigo}: ${String(error.message).slice(0, 80)}` : ''}`);
        return res.status(estado).json({ success: false, codigo, message });
    }
};

/**
 * POST /api/auth/cuentas3g/aviso (E1 · PLA-23)
 * Aviso de baja de Cuentas 3G (OpenID Back-Channel Logout 1.0): `logout_token` en el cuerpo (formulario). Se valida
 * con las llaves de Cuentas 3G; las sesiones de Planta de esa persona creadas antes del aviso dejan de valer al momento
 * y se vuelve a pedir la lista de versiones. Responde 204; si el aviso no sirve, 400 { error }.
 */
export const avisoCuentas3g = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const token = req.body?.logout_token;
        if (typeof token !== 'string' || !token) {
            return res.status(400).json({ error: 'Falta logout_token' });
        }
        const sub = await recibirAviso(token);
        console.log(`[cuentas3g] aviso de baja · sub=${sub} · sus sesiones de Planta se cierran`);
        return res.status(204).end();
    } catch (error) {
        console.warn(`[cuentas3g] aviso de baja rechazado (${error?.codigo || 'error'}${error?.message ? `: ${String(error.message).slice(0, 60)}` : ''})`);
        return res.status(avisoSinRespuesta(error) ? 503 : 400).json({ error: 'Aviso inválido' });
    }
};

/**
 * GET /api/auth/cuentas3g/estado (E1 · PLA-24)
 * Lo que la pantalla de entrada necesita saber: { modo, emergencia }. Público y sin datos. Con apagado no existe.
 */
export const estadoCuentas3g = (req, res) => res.status(200).json({ success: true, data: estadoPublico() });

/**
 * GET /api/auth/cuentas3g/reporte (E1 · PLA-24, administración)
 * «Quién no ha entrado con su cuenta 3G» para Planta › Usuarios, más las entradas de emergencia de 30 días.
 */
export const reporteCuentas3g = async (req, res) => {
    try {
        return res.status(200).json({ success: true, data: await armarReporteCuentas3g() });
    } catch (error) {
        console.error('[cuentas3g] error al armar el reporte:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudo armar el reporte de Cuentas 3G' });
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
    cambiarPassword,
    entrarConCuentas3g,
    avisoCuentas3g,
    estadoCuentas3g,
    reporteCuentas3g
};
