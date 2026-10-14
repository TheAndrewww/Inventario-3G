/**
 * Revisión de configuración de Planta (A15 · PLA-08).
 *
 * Al arrancar se revisan las llaves sin las que Planta no trabaja completo. Solo se manejan NOMBRES: nunca se lee
 * ni se devuelve un valor (ni en el registro, ni en /salud).
 *
 *   Pieza      Llave                   Qué protege
 *   sesion     JWT_SECRET              Entrar a Planta y todo lo que pide sesión (verificarToken)
 *   puente     WHATSAPP_PUENTE_TOKEN   El puente con la línea del contable (/api/avisos-whatsapp); sin ella ya responde 503
 *   terminal   TERMINAL_CODIGOS        Las 4 rutas de la terminal y validar-codigo (sin ella valen los códigos de fábrica)
 *   correo     OC_CORREO_SECRETO       Las ligas del correo de órdenes (aprobar-email y rechazar-email)
 *
 * Bandera FALLA_CERRADA (apagada por omisión = como hoy):
 *   - apagada: si falta una llave, todo sigue como siempre y se avisa al arrancar y en /salud («aviso»);
 *   - `1` (también true, sí, on): lo que protege la llave que falta responde 503 «configuración incompleta» y /salud
 *     queda en «mal». Cada llave cierra SOLO lo suyo (las TV de tablero, el calendario público y lo demás siguen).
 *     El proceso NUNCA se apaga (decisión D-A15: sin ciclos de reinicio y sin callar a los bots).
 *
 * Banderas de mejoras: /salud dice el nombre de cada una y si está encendida («encendida» = su cambio está activo),
 * nunca su valor. Las tareas nuevas se suman en BANDERAS.
 */

const SI = new Set(['1', 'true', 'si', 'sí', 'on']);
const valor = (nombre) => String(process.env[nombre] ?? '').trim();
const encendidaSiNo = (nombre) => SI.has(valor(nombre).toLowerCase());

export const fallaCerradaEncendida = () => encendidaSiNo('FALLA_CERRADA');

/** TERMINAL_CODIGOS cuenta como presente solo si trae al menos un código que sirva (si no, valen los de fábrica). */
const terminalConCodigos = async () => {
    const { configTerminal } = await import('../middleware/codigoTerminal.middleware.js');
    return configTerminal().codigos.size > 0;
};

export const PIEZAS = [
    {
        id: 'sesion',
        nombre: 'Entrada y sesiones de Planta',
        llaves: ['JWT_SECRET'],
        protege: 'la entrada y todo lo que pide sesión'
    },
    {
        id: 'puente',
        nombre: 'Puente con la línea del contable (avisos de WhatsApp)',
        llaves: ['WHATSAPP_PUENTE_TOKEN'],
        protege: 'la cola de avisos que recoge Julia',
        // Sin la llave el puente ya responde 503 y los avisos no se encolan: siempre «cerrado», con o sin la bandera.
        cerradaSinLlave: true
    },
    {
        id: 'terminal',
        nombre: 'Terminal de producción',
        llaves: ['TERMINAL_CODIGOS'],
        protege: 'las tabletas y pantallas de terminal (las TV de tablero no)'
    },
    {
        id: 'correo',
        nombre: 'Ligas del correo de órdenes de compra',
        llaves: ['OC_CORREO_SECRETO'],
        protege: 'aprobar o rechazar desde el correo'
    }
];

const presentes = async () => {
    const terminal = await terminalConCodigos();
    return (nombre) => (nombre === 'TERMINAL_CODIGOS' ? terminal : valor(nombre) !== '');
};

/** { completa, faltan: [nombres], fallaCerrada, piezas: [{ id, nombre, llaves, faltan, cerrada }] } */
export const revisarConfig = async () => {
    const esta = await presentes();
    const falla = fallaCerradaEncendida();
    const piezas = PIEZAS.map((p) => {
        const faltan = p.llaves.filter((n) => !esta(n));
        return { id: p.id, nombre: p.nombre, llaves: p.llaves, protege: p.protege, faltan, cerrada: faltan.length > 0 && (falla || !!p.cerradaSinLlave) };
    });
    const faltan = piezas.flatMap((p) => p.faltan);
    return { completa: faltan.length === 0, faltan, fallaCerrada: falla, piezas };
};

// Lo que cierra FALLA_CERRADA se decide por pieza en cada petición (barato: solo mira variables).
const piezaFalta = (id) => {
    const p = PIEZAS.find((x) => x.id === id);
    if (!p) return false;
    return p.llaves.some((n) => valor(n) === '');
};

/**
 * ¿Esta pieza responde 503? Solo con FALLA_CERRADA y su llave faltando. La terminal además cuenta como faltante si
 * TERMINAL_CODIGOS no trae ningún código que sirva (se revisa con su propio lector).
 */
export const piezaCerrada = async (id) => {
    if (!fallaCerradaEncendida()) return false;
    if (id === 'terminal') return !(await terminalConCodigos());
    return piezaFalta(id);
};

export const TEXTO_INCOMPLETA = 'Configuración incompleta: falta una llave del servidor. Avisa a Dirección.';

/**
 * Intermediario: 503 si FALLA_CERRADA está encendida y falta la llave de esta pieza. Con `html` responde una página
 * corta (para las ligas del correo, que se abren en el navegador).
 */
export const cerrarSiFalta = (id, { html = false } = {}) => async (req, res, next) => {
    try {
        if (!(await piezaCerrada(id))) return next();
    } catch (e) {
        return next(); // si la revisión falla, se queda como hoy
    }
    if (html) {
        return res.status(503).type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Configuración incompleta</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;color:#111827;">
<div style="max-width:520px;margin:40px auto;padding:24px;background:#fff;border-radius:16px;">
<h1 style="font-size:20px;margin:0 0 12px;">Configuración incompleta</h1>
<p style="font-size:15px;line-height:1.5;margin:0;">Esta liga del correo no se puede usar ahora: al servidor de Planta le falta una llave. La orden se puede aprobar o rechazar desde Planta, en Compras › Órdenes de compra. Avisa a Dirección.</p>
</div></body></html>`);
    }
    return res.status(503).json({ success: false, codigo: 'CONFIGURACION_INCOMPLETA', message: TEXTO_INCOMPLETA });
};

/** Para la terminal: solo sus rutas (montado en /api/produccion). */
export const cerrarTerminalSiFalta = async (req, res, next) => {
    if (!/^\/(terminal\/|validar-codigo\/?$)/.test(req.path)) return next();
    return cerrarSiFalta('terminal')(req, res, next);
};

/**
 * Banderas de mejoras de Planta: [{ nombre, encendida }]. «encendida» = su cambio está activo (p. ej. LOGIN_LIMITE solo
 * con 1: «medir» no cambia nada para nadie). Se lee con la misma función que usa cada tarea, para no desfasarse.
 */
export const banderasPlanta = async () => {
    const { modoLimiteLogin } = await import('../middleware/limiteLogin.middleware.js');
    const { configTerminal } = await import('../middleware/codigoTerminal.middleware.js');
    const { cierreRespetaEntregado } = await import('../services/pedidosCleanup.service.js');
    const { modoSinHoraEsLimite } = await import('../services/fechaInstalacion.service.js');
    const terminal = Object.fromEntries(configTerminal().banderas.map((b) => [b.nombre, b.encendida]));
    return [
        { nombre: 'FALLA_CERRADA', encendida: fallaCerradaEncendida() },
        { nombre: 'LOGIN_LIMITE', encendida: modoLimiteLogin() === 'exigir' },
        { nombre: 'TERMINAL_EXIGIR_CODIGO', encendida: !!terminal.TERMINAL_EXIGIR_CODIGO },
        { nombre: 'TERMINAL_ACEPTAR_CODIGOS_DE_FABRICA', encendida: !!terminal.TERMINAL_ACEPTAR_CODIGOS_DE_FABRICA },
        { nombre: 'TERMINAL_CODIGO_DEL_AREA', encendida: !!terminal.TERMINAL_CODIGO_DEL_AREA },
        { nombre: 'CIERRE_OBRA_RESPETA_ENTREGADO', encendida: cierreRespetaEntregado() },
        { nombre: 'OC_CORREO_PIDE_SESION', encendida: valor('OC_CORREO_PIDE_SESION') === '1' },
        { nombre: 'OC_OCULTA_IMPORTES', encendida: valor('OC_OCULTA_IMPORTES') === '1' },
        { nombre: 'SIN_HORA_ES_LIMITE', encendida: modoSinHoraEsLimite() === 'exigir' }
    ];
};

/** Una línea al arrancar, solo con nombres. */
export const avisarConfigAlArrancar = async () => {
    try {
        const c = await revisarConfig();
        if (c.completa) {
            console.log(`[config] completa (FALLA_CERRADA ${c.fallaCerrada ? 'encendida' : 'apagada'})`);
            return c;
        }
        const detalle = c.piezas.filter((p) => p.faltan.length)
            .map((p) => `${p.faltan.join(', ')} → ${p.cerrada ? 'responde 503' : 'queda como siempre'} (${p.protege})`).join('; ');
        console.warn(`[config] configuración incompleta · faltan: ${c.faltan.join(', ')} · FALLA_CERRADA ${c.fallaCerrada ? 'encendida' : 'apagada'} · ${detalle}`);
        return c;
    } catch (e) {
        console.error('[config] no se pudo revisar la configuración:', e.message);
        return null;
    }
};

// ---------- /salud (contrato del Inicio v2 §2.1 y plan §7.3) ----------

/** Fecha ISO con la zona de México (p. ej. 2026-10-15T10:00:00-06:00). */
export const isoMexico = (fecha = new Date()) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Mexico_City', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(fecha).map((x) => [x.type, x.value]));
    const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    const minutos = Math.round((local - Math.floor(fecha.getTime() / 1000) * 1000) / 60000);
    const abs = Math.abs(minutos);
    const zona = `${minutos < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${zona}`;
};

export const versionPlanta = () => (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || 'desconocida';

const PEOR = { ok: 0, aviso: 1, mal: 2 };

/**
 * Cuerpo de /salud. Sin `detalle`: solo sistema, versión, estado, mensaje y hora (lo que basta para un vigilante).
 * Con `detalle` (sesión de administración, o la llave del Inicio en /api/inicio3g/v1/salud): además config, banderas,
 * piezas y los conteos de la terminal (A4), nunca un valor ni un código.
 * `piezasExtra` suma piezas que piden la base (la base y la cola de avisos, en /api/inicio3g/v1/salud de PLA-13).
 */
export const cuerpoSalud = async ({ detalle = false, piezasExtra = [] } = {}) => {
    const config = await revisarConfig();
    const piezas = config.piezas.map((p) => {
        if (!p.faltan.length) return { id: p.id, nombre: p.nombre, estado: 'ok', mensaje: 'Configurada' };
        return {
            id: p.id,
            nombre: p.nombre,
            estado: p.cerrada ? 'mal' : 'aviso',
            mensaje: p.id === 'puente'
                ? `Falta ${p.faltan.join(', ')}: los avisos a WhatsApp no salen`
                : p.cerrada
                    ? `Falta ${p.faltan.join(', ')}: responde 503 (${p.protege})`
                    : `Falta ${p.faltan.join(', ')}: sigue como siempre`
        };
    });
    const { estadoCodigosTerminal } = await import('../middleware/codigoTerminal.middleware.js');
    const terminal = estadoCodigosTerminal();
    // Exigir el código sin códigos nuevos no exige: se avisa (§3.2).
    if (terminal.avisos.some((a) => a.startsWith('TERMINAL_EXIGIR_CODIGO=1 sin'))) {
        const t = piezas.find((p) => p.id === 'terminal');
        if (t && t.estado === 'ok') { t.estado = 'aviso'; t.mensaje = 'TERMINAL_EXIGIR_CODIGO=1 sin TERMINAL_CODIGOS: no se exige'; }
    }
    piezas.push(...piezasExtra);
    const estado = piezas.reduce((e, p) => (PEOR[p.estado] > PEOR[e] ? p.estado : e), 'ok');
    const primera = piezas.find((p) => p.estado === estado && estado !== 'ok');
    const base = {
        sistema: 'planta',
        version: versionPlanta(),
        estado,
        mensaje: primera ? `${primera.nombre}: ${primera.mensaje}` : 'Todo en orden',
        revisado: isoMexico()
    };
    if (!detalle) return base;
    return {
        ...base,
        config: { completa: config.completa, faltan: config.faltan },
        banderas: await banderasPlanta(),
        piezas,
        terminal
    };
};
