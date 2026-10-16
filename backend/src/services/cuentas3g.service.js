/**
 * Entrar a Planta con Cuentas 3G (E1 · PLA-23 y PLA-24). Es el ÚNICO archivo de Planta que usa el paquete
 * cuentas3g-cliente (CTA-08, copiado sin cambios en ../cuentas3g-cliente/): si el paquete cambia, se ajusta aquí.
 *
 * Bandera CUENTAS3G_MODO (PLAN-FINAL §8.3), leída con leerConfig() del paquete:
 *   - «apagado» (o sin poner, o un valor que no se conoce): idéntico a hoy. Las rutas nuevas no existen (responden como hoy),
 *     no se consulta nada a Cuentas 3G y no se crea ninguna tabla.
 *   - «ambos»: el botón «Entrar con tu cuenta 3G» y el acceso de siempre.
 *   - «solo» (PLA-24): el acceso de siempre se esconde y los JWT que no vienen de Cuentas 3G dejan de valer, salvo la
 *     llave de emergencia de administración (CUENTAS3G_EMERGENCIA).
 * Configuración incompleta (falta CUENTAS3G_EMISOR, _CLIENTE_ID, _CLIENTE_SECRETO o _REGRESO, o no son válidas): se queda
 * en «apagado» y lo anota (§8.3). Nunca se abre de más ni se cae.
 *
 * Manda la tabla `usuarios` de Planta (fase 1, D-C7): la persona entra como el usuario de Planta que tiene su correo (o
 * su «correo en Planta» de Cuentas 3G), con el rol que ya tiene, y solo si ese usuario está activo. Cuentas 3G no
 * escribe en la base de Planta: lo único que Planta guarda es su propio registro de entradas y la última lista buena.
 */
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Usuario } from '../models/index.js';
import c3g from '../cuentas3g-cliente/cuentas3g-cliente.cjs';

// Las dos tablas propias se definen SOLO si Cuentas 3G se enciende (import diferido): con «apagado», ni un sync() general
// de Sequelize las conocería.
const modelos = () => import('../models/Cuentas3g.js');

const valor = (nombre) => String(process.env[nombre] ?? '').trim();
const config = () => c3g.leerConfig(process.env);

/** Lo que pide la variable (ambos, solo o apagado; un valor que no se conoce cuenta como apagado). */
export const modoPedidoCuentas3g = () => {
    const { pedido } = config();
    return pedido === 'ambos' || pedido === 'solo' ? pedido : 'apagado';
};

/** Nombres de lo que falta o no es válido para encender Cuentas 3G. Nunca valores. */
export const faltanCuentas3g = () => {
    const c = config();
    return [...c.faltan, ...c.malas];
};

/** El modo que de verdad aplica: con la configuración incompleta, «apagado». */
export const modoCuentas3g = () => config().modo;

/** La llave de emergencia (PLA-24) está puesta (misma regla que el paquete); solo cuenta en «solo». */
export const emergenciaCuentas3g = () => /^(1|si|sí|true)$/i.test(valor('CUENTAS3G_EMERGENCIA'));

/** Para el registro: nunca el correo completo. */
export const correoOculto = (correo) => {
    const c = String(correo || '').toLowerCase();
    if (!c) return '(vacío)';
    const [u, d] = c.split('@');
    return d ? `${u.slice(0, 2)}***@${d}` : `${c.slice(0, 2)}***`;
};

// ── El paquete y dónde guarda la última lista buena ─────────────────────────────────────────────

// Railway no conserva el disco entre publicaciones: la lista (con su firma, como la guarda el paquete) va a la base, en
// cuentas3g_estado. Llega cada minuto: solo se escribe si cambió quién está y con qué versión, o cada 10 min.
let ultimaGuardada = { personas: null, en: 0 };
const personasDe = (texto) => {
    try {
        const { jws } = JSON.parse(texto);
        return JSON.stringify(JSON.parse(Buffer.from(String(jws).split('.')[1], 'base64url').toString('utf8')).personas);
    } catch {
        return null;
    }
};
const almacen = {
    async leer() {
        const { Cuentas3gEstado } = await modelos();
        const fila = await Cuentas3gEstado.findByPk('lista');
        return fila && fila.valor && typeof fila.valor.texto === 'string' ? fila.valor.texto : null;
    },
    async guardar(texto) {
        const personas = personasDe(texto);
        if (personas && personas === ultimaGuardada.personas && Date.now() - ultimaGuardada.en < 10 * 60 * 1000) return;
        const { Cuentas3gEstado } = await modelos();
        await Cuentas3gEstado.upsert({ clave: 'lista', valor: { texto } });
        ultimaGuardada = { personas, en: Date.now() };
    }
};

// Fase 1 (D-C7): manda la tabla usuarios; Cuentas 3G puede mandar nivel nulo. Un nivel que Planta no conoce = no entra.
const NIVELES_PLANTA = ['administrador', 'encargado', 'diseñador', 'compras', 'almacen'];

let cliente = null;
const obtenerCliente = () => {
    if (!cliente) {
        cliente = c3g.crearCliente({
            ...config().cliente,
            almacen,
            niveles: NIVELES_PLANTA,
            sinNivel: true,
            registro: { warn: (o, m) => console.warn(`[cuentas3g] ${m}${o && o.error ? ` (${o.error})` : ''}`) }
        });
    }
    return cliente;
};
const arranque = Date.now();
const CADA_MINUTO = 60 * 1000;
let relojLista = null;

/** Al arrancar el servidor (server.js). Con «apagado» no hace nada más que decirlo. Nunca tumba el arranque. */
export async function iniciarCuentas3g() {
    const c = config();
    if (c.aviso) console.warn(`[cuentas3g] ${c.aviso} (la entrada de siempre)`);
    if (c.modo === 'apagado') {
        console.log('[cuentas3g] modo apagado (CUENTAS3G_MODO): la entrada de siempre, sin cambios');
        return;
    }
    try {
        const { Cuentas3gEntrada, Cuentas3gEstado } = await modelos();
        await Cuentas3gEntrada.sync();
        await Cuentas3gEstado.sync();
        // Carga la lista guardada (revisa su firma) y la pide ya, sin detener el arranque. El reloj es de Planta y pide con
        // `forzar`: el reloj propio del paquete (1.1.0) se salta un tic cuando la lista anterior tiene apenas menos de 60 s,
        // y entonces una baja sin aviso tardaba hasta 2 min en caer (medido: 76 s). Así cae en 60 s o menos (PLAN §8.4).
        const cli = obtenerCliente();
        cli.arrancar({ sinReloj: true }).catch((e) => console.warn('[cuentas3g] la lista de versiones no arrancó:', e.message));
        if (!relojLista) {
            relojLista = setInterval(() => { cli.listaDeVersiones({ forzar: true }).catch(() => {}); }, CADA_MINUTO);
            if (relojLista.unref) relojLista.unref();
        }
        console.log(`[cuentas3g] modo ${c.modo} · paquete cuentas3g-cliente ${c3g.VERSION} · emisor ${new URL(c.cliente.emisor).host} · cliente ${c.cliente.clienteId}${c.modo === 'solo' ? ` · llave de emergencia ${emergenciaCuentas3g() ? 'PUESTA' : 'quitada'}` : ''}`);
    } catch (error) {
        console.error('[cuentas3g] no se pudo preparar la entrada con Cuentas 3G:', error.message);
    }
}

/** Intermediario de las rutas nuevas: con «apagado» responden exactamente como hoy (no existen). */
export const soloConCuentas3g = (req, res, next) => (modoCuentas3g() === 'apagado' ? next('router') : next());

// ── Entrada (POST /api/auth/cuentas3g) ──────────────────────────────────────────────────────────

/** Rechazos propios de Planta (datos incompletos, sin usuario, inactivo). */
export class RechazoCuentas3g extends Error {
    constructor(tipo) {
        super(tipo);
        this.tipo = tipo;
    }
}

const RE_VERIFICADOR = /^[A-Za-z0-9\-._~]{43,128}$/;

/** Empate por «correo en Planta» (si Cuentas 3G lo trae) o por el correo de su cuenta de Google (verificado en Cuentas 3G). */
export async function buscarUsuarioDeFicha(p) {
    const candidatos = [];
    if (p.correoEnSistema) candidatos.push(['correo_en_planta', p.correoEnSistema]);
    if (p.correo) candidatos.push(['correo', p.correo]);
    for (const [empate, correo] of candidatos) {
        const c = String(correo).trim();
        if (!c || c.length > 100) continue;
        let usuario = await Usuario.findOne({ where: { email: c } });
        if (!usuario) {
            // Planta guarda el correo como se tecleó: se acepta sin importar mayúsculas solo si es uno y nada más.
            const varios = await Usuario.findAll({ where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), c.toLowerCase()), limit: 2 });
            if (varios.length === 1) usuario = varios[0];
        }
        if (usuario) return { usuario, empate };
    }
    return null;
}

/**
 * Canje, validación y empate. La SPA ya comparó el state; aquí van el código, el verificador PKCE y el nonce. Devuelve
 * { usuario, empate, ficha: { sub, ver, … } } o lanza ErrorCuentas3G (del paquete, con .codigo) / RechazoCuentas3g.
 */
export async function entrarConFicha({ codigo, verificador, nonce }) {
    if (typeof codigo !== 'string' || !codigo || codigo.length > 512) throw new RechazoCuentas3g('datos');
    if (typeof verificador !== 'string' || !RE_VERIFICADOR.test(verificador)) throw new RechazoCuentas3g('datos');
    if (typeof nonce !== 'string' || !nonce || nonce.length > 256) throw new RechazoCuentas3g('datos');
    const ficha = await obtenerCliente().regreso({ codigo, temporal: { nonce, verificador } });
    const encontrado = await buscarUsuarioDeFicha(ficha);
    if (!encontrado) throw new RechazoCuentas3g('sin_usuario');
    if (!encontrado.usuario.activo) throw new RechazoCuentas3g('inactivo');
    return { ...encontrado, ficha };
}

// Los códigos del paquete (ErrorCuentas3G.codigo) en los cuatro casos que ve la persona.
const POR_CODIGO = {
    sin_respuesta: 'no_responde', jwks: 'no_responde',
    canje: 'codigo', codigo: 'datos',
    sin_nivel: 'nivel', nivel_desconocido: 'nivel'
};

/** Código HTTP, código y texto para cada error (mismos textos en la pantalla clásica y en Diseño 3G). */
export function respuestaDeError(error, modo = modoCuentas3g()) {
    const plan = modo === 'solo'
        ? 'Si es urgente y Cuentas 3G no responde, Dirección tiene la llave de emergencia.'
        : 'Mientras tanto puedes usar el acceso de siempre.';
    const tabla = {
        datos: [400, 'CUENTAS3G_DATOS', 'Faltan datos de la entrada con tu cuenta 3G. Vuelve a intentarlo desde Entrar.'],
        codigo: [401, 'CUENTAS3G_CODIGO', 'La entrada con tu cuenta 3G venció o ya se usó. Vuelve a intentarlo.'],
        ficha: [401, 'CUENTAS3G_FICHA', 'No se pudo comprobar tu cuenta 3G. Vuelve a intentarlo.'],
        no_responde: [503, 'CUENTAS3G_NO_RESPONDE', `Cuentas 3G no responde. Intenta en unos minutos. ${plan}`],
        sin_usuario: [401, 'CUENTAS3G_SIN_USUARIO', 'Tu cuenta 3G no tiene usuario en Planta. Pide a Dirección que te dé de alta en Planta › Usuarios con tu correo.'],
        inactivo: [401, 'CUENTAS3G_INACTIVO', 'Tu usuario de Planta está inactivo. Pide a Dirección que lo reactive.'],
        nivel: [401, 'CUENTAS3G_NIVEL', 'Tu cuenta 3G no tiene acceso a Planta. Pide acceso a Dirección.']
    };
    if (error instanceof RechazoCuentas3g) return tabla[error.tipo];
    // Cualquier otro error del paquete (firma, emisor, audiencia, vencida, nonce, ficha repetida…) = la ficha no sirve.
    if (error instanceof c3g.ErrorCuentas3G) return tabla[POR_CODIGO[error.codigo] || 'ficha'];
    return [500, 'CUENTAS3G_ERROR', 'No se pudo entrar con tu cuenta 3G. Vuelve a intentarlo.'];
}

/** Registro propio de Planta (para el reporte de PLA-24 y las emergencias). Nunca detiene la entrada. */
export async function anotarEntrada({ usuarioId, via, sub = null, empate = null }) {
    try {
        const { Cuentas3gEntrada } = await modelos();
        await Cuentas3gEntrada.create({ usuario_id: usuarioId, via, c3g_sub: sub, empate });
    } catch (error) {
        console.error('[cuentas3g] no se pudo anotar la entrada:', error.message);
    }
}

// ── Sesiones (verificarToken) y aviso de baja ───────────────────────────────────────────────────

const TEXTO_SESION_TERMINADA = 'Tu acceso con tu cuenta 3G cambió o terminó. Vuelve a entrar.';
const TEXTO_CUENTA_REQUERIDA = 'Planta ya se entra con tu cuenta 3G. Vuelve a entrar con «Entrar con tu cuenta 3G».';

// ── Modo «solo» y llave de emergencia (PLA-24) ─────────────────────────────────────────────────

/**
 * ¿Puede entrar con la contraseña de siempre? En «apagado» y «ambos», sí (como hoy). En «solo», solo con la llave de
 * emergencia y solo administración (Dirección); el rol se revisa DESPUÉS de comprobar la contraseña.
 */
export const contrasenaPermitida = () => modoCuentas3g() !== 'solo' || emergenciaCuentas3g();
export const esEntradaDeEmergencia = () => modoCuentas3g() === 'solo' && emergenciaCuentas3g();

/** Lo que la pantalla de entrada necesita saber (público, sin datos): el modo que aplica y si hay emergencia. */
export const estadoPublico = () => {
    const modo = modoCuentas3g();
    return { modo, emergencia: modo === 'solo' && emergenciaCuentas3g() };
};

/**
 * ¿Hay que rechazar esta sesión? null = sigue. Con «apagado», nunca (idéntico a hoy).
 * PLA-23: un JWT con c3g_sub se revisa contra la lista de versiones y los avisos de baja.
 * PLA-24: en «solo», un JWT SIN c3g_sub (el de la contraseña, que duraría hasta 7 días) ya no vale, salvo el de la
 * llave de emergencia (c3g_emergencia) mientras CUENTAS3G_EMERGENCIA siga puesta y el usuario siga siendo administrador.
 */
export function rechazoDeSesion(decoded, usuario = null) {
    const modo = modoCuentas3g();
    if (modo === 'apagado') return null;
    if (decoded && decoded.c3g_sub) {
        const vigente = obtenerCliente().sesionVigente({ sub: decoded.c3g_sub, ver: Number(decoded.c3g_ver) || 0, en: (Number(decoded.iat) || 0) * 1000 });
        return vigente ? null : { codigo: 'CUENTAS3G_SESION_TERMINADA', message: TEXTO_SESION_TERMINADA };
    }
    if (modo === 'solo') {
        if (decoded && decoded.c3g_emergencia === true && emergenciaCuentas3g() && usuario && usuario.rol === 'administrador') return null;
        return { codigo: 'CUENTAS3G_REQUERIDA', message: TEXTO_CUENTA_REQUERIDA };
    }
    return null;
}

/** Aviso de baja (POST /api/auth/cuentas3g/aviso). Devuelve el sub o lanza ErrorCuentas3G. */
export const recibirAviso = async (logoutToken) => (await obtenerCliente().avisoDeBaja(logoutToken)).sub;

/** ¿El error del aviso es porque Cuentas 3G no respondió (no pudo traer sus llaves)? */
export const avisoSinRespuesta = (error) => error instanceof c3g.ErrorCuentas3G && (error.codigo === 'sin_respuesta' || error.codigo === 'jwks');

// ── /salud ──────────────────────────────────────────────────────────────────────────────────────

const HORA = 3600 * 1000;

/** Edad de la lista y si hay que avisar a Dirección: con lista, si pasó de 24 h; sin lista, si no llega en 24 h. */
const estadoLista = () => {
    const e = obtenerCliente().estado();
    const en = e.lista ? Date.parse(e.lista.en) : null;
    const edadMs = en ? Date.now() - en : null;
    return { e, en, edadMs, vieja: en ? e.listaVieja : Date.now() - arranque > 24 * HORA };
};

/** Pieza de /salud (solo si CUENTAS3G_MODO pide encenderlo). Sin valores, correos ni personas. */
export function piezaCuentas3g() {
    const pedido = modoPedidoCuentas3g();
    if (pedido === 'apagado') return null;
    const base = { id: 'cuentas3g', nombre: 'Entrada con Cuentas 3G' };
    const faltan = faltanCuentas3g();
    if (faltan.length) return { ...base, estado: 'aviso', mensaje: `Falta o no es válida ${faltan.join(', ')}: se queda en «apagado» (la entrada de siempre)` };
    const { e, edadMs, vieja } = estadoLista();
    const avisos = [];
    if (vieja && e.lista) avisos.push(`la lista de versiones no se actualiza desde hace ${Math.floor(edadMs / HORA)} h (las sesiones siguen; revisar Cuentas 3G)`);
    if (vieja && !e.lista) avisos.push('no ha llegado ninguna lista de versiones en 24 h (las sesiones siguen; revisar Cuentas 3G)');
    if (pedido === 'solo' && emergenciaCuentas3g()) avisos.push('la llave de emergencia está puesta: Dirección puede entrar con su contraseña');
    if (avisos.length) return { ...base, estado: 'aviso', mensaje: `Modo ${pedido}: ${avisos.join('; ')}` };
    return { ...base, estado: 'ok', mensaje: `Modo ${pedido} · cuentas3g-cliente ${c3g.VERSION}${e.lista ? ` · lista de versiones de hace ${Math.max(0, Math.round(edadMs / 60000))} min` : ' · lista de versiones por llegar'}` };
}

/**
 * Reporte «Quién no ha entrado con su cuenta 3G» (PLA-24), para Planta › Usuarios (administración). Es la llave para pasar
 * Planta a «solo»: cada usuario activo debe haber entrado al menos una vez con su cuenta (DISEÑO §3.2). Incluye las
 * entradas de emergencia de los últimos 30 días.
 */
export async function reporteCuentas3g() {
    const { Cuentas3gEntrada } = await modelos();
    const usuarios = await Usuario.findAll({ attributes: ['id', 'nombre', 'email', 'rol', 'puesto', 'activo'], order: [['nombre', 'ASC']] });
    const entradas = await Cuentas3gEntrada.findAll({
        attributes: ['usuario_id', [sequelize.fn('MIN', sequelize.col('created_at')), 'primera'], [sequelize.fn('MAX', sequelize.col('created_at')), 'ultima'], [sequelize.fn('COUNT', sequelize.col('id')), 'veces']],
        where: { via: 'cuentas3g' },
        group: ['usuario_id'],
        raw: true
    });
    const porUsuario = new Map(entradas.map((e) => [Number(e.usuario_id), e]));
    const hace30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const emergencias = await Cuentas3gEntrada.findAll({
        where: { via: 'emergencia', created_at: { [Op.gte]: hace30 } },
        order: [['created_at', 'DESC']],
        limit: 20,
        raw: true
    });
    const nombre = new Map(usuarios.map((u) => [u.id, u]));
    const activos = usuarios.filter((u) => u.activo);
    const fila = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, puesto: u.puesto || null });
    const entraron = activos.filter((u) => porUsuario.has(u.id)).map((u) => {
        const e = porUsuario.get(u.id);
        return { ...fila(u), primera: new Date(e.primera).toISOString(), ultima: new Date(e.ultima).toISOString(), veces: Number(e.veces) };
    });
    const faltan = activos.filter((u) => !porUsuario.has(u.id)).map(fila);
    return {
        ...estadoPublico(),
        lista: estadoDeLaLista(),
        activos: activos.length,
        conCuenta: entraron.length,
        faltan,
        entraron,
        emergencias: emergencias.map((e) => ({ usuario: nombre.get(e.usuario_id)?.nombre || `Usuario ${e.usuario_id}`, cuando: new Date(e.created_at).toISOString() })),
        // Para la liga «Abrir Cuentas 3G» (pública; nunca el secreto).
        emisor: valor('CUENTAS3G_EMISOR')
    };
}

/** Lo que va en el reporte (PLA-24): solo cuándo y si está vieja, nada personal. */
export function estadoDeLaLista() {
    if (modoCuentas3g() === 'apagado') return null;
    const { e, en, edadMs, vieja } = estadoLista();
    return {
        actualizada: en ? new Date(en).toISOString() : null,
        haceMinutos: en ? Math.round(edadMs / 60000) : null,
        vieja,
        ultimoError: e.ultimoError
    };
}
