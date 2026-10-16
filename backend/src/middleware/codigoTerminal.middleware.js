import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

/**
 * Código de la terminal de producción (A4 · PLA-04, fase A).
 *
 * Las tabletas y pantallas de terminal (`/terminal/:area`, también con `?diseno=3g`) no usan sesión: entran con el
 * código de su área. Hasta ahora el código solo se revisaba al teclearlo (`validar-codigo`); las 4 rutas de la
 * terminal no lo pedían, así que cualquiera con la liga del área podía cerrar etapas.
 *
 * Ahora la pantalla guarda el código validado y lo manda en la cabecera `X-Codigo-Area` en las 4 llamadas, y este
 * intermediario lo revisa:
 *   - Fase A (hoy, TERMINAL_EXIGIR_CODIGO sin poner o 0): NO bloquea nada. Solo cuenta cuántas peticiones llegan
 *     sin código, con un código de fábrica, con uno que no es de ninguna área y con el de otra área.
 *   - Fase C (TERMINAL_EXIGIR_CODIGO=1, ver PLA-10): las 4 rutas responden 403 sin un código válido. Si se enciende
 *     sin TERMINAL_CODIGOS, no exige y lo avisa (no se puede dejar a toda la planta fuera).
 *
 * Banderas (se leen en cada petición; cambian al reiniciar con la variable nueva):
 *   - TERMINAL_CODIGOS: los códigos nuevos, área → código. JSON {"diseno":"…","compras":"…"} o «diseno=…,compras=…».
 *     Si falta, valen los de fábrica (los de siempre) y se avisa.
 *   - TERMINAL_EXIGIR_CODIGO (0 por omisión).
 *   - TERMINAL_ACEPTAR_CODIGOS_DE_FABRICA (1 por omisión). En 0, un área que no tiene código nuevo sigue aceptando
 *     el de fábrica (y se avisa), para no dejarla fuera.
 *   - TERMINAL_CODIGO_DEL_AREA (0 por omisión, decisión 4): en 1, solo el código del área de la etapa la puede
 *     cerrar. Apagada solo se cuenta cuántas veces la cierra otra área.
 *
 * Límite: 10 códigos equivocados cada 15 minutos por IP, SOLO en validar-codigo. La revisión de la cabecera en cada
 * consulta (cada 15 s) no cuenta: una tableta con un código viejo no puede bloquear a toda la planta, que sale a
 * internet por una sola IP. Necesita el `trust proxy` de server.js (A10 · PLA-02).
 *
 * Los conteos viven en memoria (un solo proceso en Railway) y empiezan de cero al reiniciar: `desde` dice desde cuándo.
 */

export const AREAS_TERMINAL = ['diseno', 'compras', 'manufactura', 'herreria', 'instalacion'];

// Códigos de fábrica: los de siempre (antes vivían en produccion.controller.js).
export const CODIGOS_DE_FABRICA = {
    'DIS-2026': 'diseno',
    'COM-2026': 'compras',
    'MAN-2026': 'manufactura',
    'HER-2026': 'herreria',
    'INS-2026': 'instalacion'
};

const normalizar = (codigo) => String(codigo ?? '').trim().toUpperCase();

const encendida = (nombre, porOmision) => {
    const valor = String(process.env[nombre] ?? '').trim();
    if (valor === '') return porOmision;
    return valor === '1';
};

/** TERMINAL_CODIGOS → { codigos: Map(código → área), errores: [] } (codigos vacío si falta o no sirve). */
export const leerCodigosPropios = (texto = process.env.TERMINAL_CODIGOS) => {
    const codigos = new Map();
    const errores = [];
    const crudo = String(texto ?? '').trim();
    if (!crudo) return { codigos, errores };
    let pares = [];
    try {
        if (crudo.startsWith('{')) pares = Object.entries(JSON.parse(crudo));
        else pares = crudo.split(/[,;\n]/).map((p) => p.split(/[=:]/)).filter((p) => p.length >= 2 && p[0].trim());
    } catch {
        errores.push('TERMINAL_CODIGOS no se pudo leer (usa {"diseno":"…"} o diseno=…,compras=…)');
        return { codigos: new Map(), errores };
    }
    for (const [areaCruda, codigoCrudo] of pares) {
        const area = String(areaCruda).trim().toLowerCase();
        const codigo = normalizar(codigoCrudo);
        if (!AREAS_TERMINAL.includes(area)) { errores.push(`área desconocida en TERMINAL_CODIGOS: ${area}`); continue; }
        if (codigo.length < 4) { errores.push(`el código de ${area} es muy corto`); continue; }
        if (CODIGOS_DE_FABRICA[codigo]) { errores.push(`el código de ${area} es uno de fábrica`); continue; }
        if (codigos.has(codigo) && codigos.get(codigo) !== area) { errores.push(`el mismo código está en dos áreas (${codigos.get(codigo)} y ${area})`); continue; }
        codigos.set(codigo, area);
    }
    return { codigos, errores };
};

/** Cómo está configurada la terminal en este momento. */
export const configTerminal = () => {
    const { codigos, errores } = leerCodigosPropios();
    const conPropios = codigos.size > 0;
    const areasConPropio = new Set(codigos.values());
    const areasSinPropio = AREAS_TERMINAL.filter((a) => !areasConPropio.has(a));
    const pideExigir = encendida('TERMINAL_EXIGIR_CODIGO', false);
    const pideAceptarFabrica = encendida('TERMINAL_ACEPTAR_CODIGOS_DE_FABRICA', true);
    const avisos = [...errores];
    if (!conPropios) avisos.push('códigos de terminal de fábrica: falta TERMINAL_CODIGOS');
    else if (areasSinPropio.length) avisos.push(`sin código nuevo (siguen con el de fábrica): ${areasSinPropio.join(', ')}`);
    if (pideExigir && !conPropios) avisos.push('TERMINAL_EXIGIR_CODIGO=1 sin TERMINAL_CODIGOS: no se exige');
    return {
        codigos,
        // Sin códigos nuevos no se exige: se dejaría fuera a toda la planta.
        exigir: pideExigir && conPropios,
        // El de fábrica vale si así se pide o si esa área todavía no tiene código nuevo.
        fabricaVale: (area) => !conPropios || pideAceptarFabrica || !areasConPropio.has(area),
        delArea: encendida('TERMINAL_CODIGO_DEL_AREA', false),
        banderas: [
            { nombre: 'TERMINAL_EXIGIR_CODIGO', encendida: pideExigir },
            { nombre: 'TERMINAL_ACEPTAR_CODIGOS_DE_FABRICA', encendida: pideAceptarFabrica },
            { nombre: 'TERMINAL_CODIGO_DEL_AREA', encendida: encendida('TERMINAL_CODIGO_DEL_AREA', false) },
            { nombre: 'TERMINAL_CODIGOS', encendida: conPropios }
        ],
        areasSinPropio,
        avisos
    };
};

/**
 * ¿Qué código trae? → { tipo: 'sin_codigo' | 'propio' | 'de_fabrica' | 'incorrecto', area, valido }
 * Un código de fábrica que ya no se acepta sale como 'de_fabrica' con valido=false.
 */
export const clasificarCodigo = (codigoCrudo, cfg = configTerminal()) => {
    const codigo = normalizar(codigoCrudo);
    if (!codigo) return { tipo: 'sin_codigo', area: null, valido: false };
    if (cfg.codigos.has(codigo)) return { tipo: 'propio', area: cfg.codigos.get(codigo), valido: true };
    const deFabrica = CODIGOS_DE_FABRICA[codigo];
    if (deFabrica) return { tipo: 'de_fabrica', area: deFabrica, valido: cfg.fabricaVale(deFabrica) };
    return { tipo: 'incorrecto', area: null, valido: false };
};

// ---------- Conteos (para /salud y para decidir la fase C) ----------
const DIAS_GUARDADOS = 14;
const arrancoEn = new Date().toISOString();
const porDia = new Map(); // 'YYYY-MM-DD' → { sin_codigo, de_fabrica, incorrecto, propio, otra_area, otra_area_cierre, validar_* }
const yaAnotado = new Set();
const hoyMexico = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

export const contarTerminal = (clave, detalle = '') => {
    const dia = hoyMexico();
    if (!porDia.has(dia)) {
        porDia.set(dia, {});
        for (const d of [...porDia.keys()].sort().slice(0, -DIAS_GUARDADOS)) porDia.delete(d);
    }
    const cuenta = porDia.get(dia);
    cuenta[clave] = (cuenta[clave] || 0) + 1;
    // Una línea por día y por tipo (la terminal consulta cada 15 s: no se llena el registro).
    const marca = `${dia}|${clave}|${detalle}`;
    if (clave !== 'propio' && !yaAnotado.has(marca)) {
        if (yaAnotado.size > 500) yaAnotado.clear();
        yaAnotado.add(marca);
        console.log(`[terminal] ${dia} primera petición «${clave}» del día${detalle ? ` (${detalle})` : ''}`);
    }
};

// ---------- ¿Ya se puede exigir? (A4 fases B y C · PLA-10) ----------
// «A la antigua»: pantallas sin código o con el de fábrica (en la terminal o al teclearlo en validar-codigo).
export const A_LA_ANTIGUA = ['sin_codigo', 'de_fabrica', 'de_fabrica_rechazado', 'validar_de_fabrica'];
export const DIAS_PARA_EXIGIR = 2;
const DIA_MS = 86400000;
const diaMexico = (fecha) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(fecha);
// Inicio (00:00 de México) de un día 'YYYY-MM-DD': México no tiene horario de verano desde 2022 (UTC-6).
const inicioDiaMexico = (dia) => new Date(`${dia}T00:00:00-06:00`);

/**
 * Cuenta los días hábiles seguidos (lunes a sábado, sin festivos; de ayer hacia atrás) en que ninguna pantalla llegó
 * «a la antigua» y sí hubo terminales con el código nuevo. Un día que el servidor no vio completo (se reinició ese día:
 * los conteos viven en memoria) o sin uso de la terminal corta la cuenta: no se sabe. Función pura (para probarla).
 * @returns {{ conCodigosNuevos, exigiendo, diasHabilesEnCero, necesarios, hoyALaAntigua, listo, texto }}
 */
export const resumenFaseC = ({ conteos, desde, ahora = new Date(), conCodigosNuevos, exigiendo = false, esFestivo = () => false }) => {
    const suma = (c) => A_LA_ANTIGUA.reduce((s, k) => s + (c?.[k] || 0), 0);
    const hoy = diaMexico(ahora);
    const hoyALaAntigua = suma(conteos[hoy]);
    let dias = 0;
    let motivo = null;
    for (let i = 1; i <= 21 && dias < DIAS_PARA_EXIGIR + 5; i++) {
        const dia = diaMexico(new Date(inicioDiaMexico(hoy).getTime() - i * DIA_MS + 12 * 3600000));
        const [y, m, d] = dia.split('-').map(Number);
        const semana = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        if (semana === 0 || esFestivo(y, m, d)) continue; // domingo o festivo: ni cuenta ni corta
        if (new Date(desde) > inicioDiaMexico(dia)) { motivo = 'reinicio'; break; }
        const c = conteos[dia] || {};
        if (suma(c) > 0) { motivo = 'a_la_antigua'; break; }
        if (!(c.propio > 0)) { motivo = 'sin_uso'; break; }
        dias++;
    }
    const listo = !!conCodigosNuevos && !exigiendo && dias >= DIAS_PARA_EXIGIR && hoyALaAntigua === 0;
    let texto;
    if (!conCodigosNuevos) texto = 'Todavía no hay códigos nuevos (TERMINAL_CODIGOS, DUE-13): no se puede exigir.';
    else if (exigiendo) texto = 'La fase C ya está encendida: la terminal exige el código.';
    else if (listo) texto = `${dias} días hábiles seguidos sin pantallas «a la antigua»: ya se puede exigir (TERMINAL_EXIGIR_CODIGO=1 y TERMINAL_ACEPTAR_CODIGOS_DE_FABRICA=0).`;
    else {
        texto = `Van ${Math.min(dias, DIAS_PARA_EXIGIR)} de ${DIAS_PARA_EXIGIR} días hábiles seguidos en cero.`;
        if (hoyALaAntigua > 0) texto += ` Hoy ya llegaron ${hoyALaAntigua} peticiones sin código o con el de fábrica.`;
        if (motivo === 'reinicio' && dias < DIAS_PARA_EXIGIR) texto += ' Los conteos empiezan de cero al reiniciar el servidor: hay que esperar días completos.';
        if (motivo === 'sin_uso' && dias < DIAS_PARA_EXIGIR) texto += ' Un día hábil sin uso de la terminal no cuenta.';
    }
    return { conCodigosNuevos: !!conCodigosNuevos, exigiendo: !!exigiendo, diasHabilesEnCero: dias, necesarios: DIAS_PARA_EXIGIR, hoyALaAntigua, listo, texto };
};

/** Lo que /salud (PLA-08 / PLA-13) y la ruta de administración cuentan de la terminal. Nunca los códigos. */
export const estadoCodigosTerminal = () => {
    const cfg = configTerminal();
    const dias = [...porDia.keys()].sort().reverse();
    return {
        fase: cfg.exigir ? 'C (exige código)' : 'A (solo cuenta)',
        codigos: cfg.codigos.size ? 'propios' : 'de_fabrica',
        areasSinCodigoPropio: cfg.areasSinPropio,
        banderas: cfg.banderas,
        avisos: cfg.avisos,
        desde: arrancoEn,
        hoy: porDia.get(hoyMexico()) || {},
        porDia: Object.fromEntries(dias.map((d) => [d, porDia.get(d)])),
        // PLA-10: el conteo que sostiene (o no) el paso a la fase C.
        paraFaseC: resumenFaseC({
            conteos: Object.fromEntries(porDia),
            desde: arrancoEn,
            conCodigosNuevos: cfg.codigos.size > 0,
            exigiendo: cfg.exigir,
            esFestivo: festivoParaConteo
        })
    };
};

// Festivos para el conteo de días hábiles: los mismos de calendarioLaboral.js (PLA-07). Se cargan aparte para no
// atar este intermediario al arranque de aquel módulo.
let esFestivoCal = null;
import('../utils/calendarioLaboral.js').then((m) => { esFestivoCal = m.esFestivo; }).catch(() => { /* sin festivos */ });
const festivoParaConteo = (y, m, d) => { try { return esFestivoCal ? esFestivoCal(y, m, d) : false; } catch { return false; } };

// ---------- Intermediario de las 4 rutas de la terminal ----------
const rutaDe = (req) => {
    if (req.params?.area) return `GET /terminal/${req.params.area}`;
    const final = String(req.path || '').split('/').pop();
    return `${req.method} /terminal/:id/${final}`;
};

export const codigoDeTerminal = (req, res, next) => {
    const cfg = configTerminal();
    const c = clasificarCodigo(req.get('X-Codigo-Area'), cfg);
    const ruta = rutaDe(req);
    contarTerminal(c.tipo === 'de_fabrica' && !c.valido ? 'de_fabrica_rechazado' : c.tipo, ruta);
    req.terminal = { area: c.area, tipo: c.tipo, valido: c.valido };

    // Leer la lista de otra área no es cerrar nada: solo se cuenta.
    if (c.valido && req.params?.area && c.area !== req.params.area) contarTerminal('otra_area', ruta);

    if (cfg.exigir && !c.valido) {
        return res.status(403).json({
            success: false,
            codigo: 'CODIGO_TERMINAL',
            message: c.tipo === 'sin_codigo'
                ? 'Esta pantalla necesita el código de su área.'
                : 'El código guardado en esta pantalla ya no vale. Escribe el código de tu área.'
        });
    }
    return next();
};

/** Área que cierra cada etapa del proyecto (la de producción la cierran Manufactura o Herrería). */
const AREAS_DE_ETAPA = {
    diseno: ['diseno'],
    compras: ['compras'],
    produccion: ['manufactura', 'herreria'],
    instalacion: ['instalacion'],
    manufactura: ['manufactura'],
    herreria: ['herreria'],
    herreria_armado: ['herreria'],
    herreria_pintado: ['herreria']
};

/**
 * Decisión 4: ¿este código puede cerrar esta etapa? Solo aplica a las rutas de la terminal (req.terminal).
 * Devuelve null si puede; si no, la respuesta 403 para mandar. Con TERMINAL_CODIGO_DEL_AREA apagada solo cuenta.
 */
export const revisarAreaDeEtapa = (req, etapa) => {
    const t = req.terminal;
    const areas = AREAS_DE_ETAPA[etapa];
    if (!t?.valido || !areas || areas.includes(t.area)) return null;
    contarTerminal('otra_area_cierre', `${t.area} cierra ${etapa}`);
    if (!configTerminal().delArea) return null;
    return { success: false, codigo: 'OTRA_AREA', message: 'Esta etapa la cierra su propia área: usa la terminal de esa área.' };
};

// ---------- Límite de intentos en validar-codigo ----------
const VENTANA_MS = 15 * 60 * 1000;
const LIMITE = 10;
const textoEspera = (minutos) => `Demasiados intentos. Espera ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`;

export const limiteValidarCodigo = rateLimit({
    windowMs: VENTANA_MS,
    limit: LIMITE,
    standardHeaders: false,
    legacyHeaders: false,
    // Solo cuentan los códigos equivocados (403); un acierto no suma.
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== 403,
    keyGenerator: (req) => ipKeyGenerator(req.ip || 'sin-ip'),
    handler: (req, res) => {
        const reinicio = req.rateLimit?.resetTime instanceof Date ? req.rateLimit.resetTime.getTime() : Date.now() + VENTANA_MS;
        const segundos = Math.max(1, Math.ceil((reinicio - Date.now()) / 1000));
        const minutos = Math.max(1, Math.ceil(segundos / 60));
        contarTerminal('validar_bloqueado', `ip=${req.ip}`);
        console.warn(`[terminal] demasiados códigos equivocados · ip=${req.ip} · espera ${minutos} min`);
        res.set('Retry-After', String(segundos));
        return res.status(429).json({ success: false, codigo: 'DEMASIADOS_INTENTOS', message: textoEspera(minutos), minutos, reintentarEn: segundos });
    }
});

const arranque = configTerminal();
console.log(`[terminal] fase ${arranque.exigir ? 'C (exige código)' : 'A (solo cuenta)'} · códigos ${arranque.codigos.size ? 'propios' : 'de fábrica'}${arranque.avisos.length ? ' · aviso: ' + arranque.avisos.join('; ') : ''}`);
