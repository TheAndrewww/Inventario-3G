/**
 * FECHA DE INSTALACIÓN REAL DE CADA PROYECTO — la del calendario, no solo la del Índice.
 *
 * La hoja de Producción (col D → `fecha_limite`) trae la fecha que se pactó al vender; el
 * calendario de instalaciones es donde se mueve el día a día. El dashboard ya cruzaba las dos
 * (frontend/src/utils/produccion.js · aplicarFechasCalendario), pero el backend —de donde el
 * bot saca los recordatorios del grupo de PRODUCCIÓN— solo veía la col D. Caso 21-sep-2026:
 * COLEGIO ATENAS se adelantó en el calendario al lunes 21 con la col D en 02-oct y el grupo
 * nunca se enteró.
 *
 * Aquí vive la MISMA regla que el dashboard, para que los dos digan lo mismo:
 *  · Cita del calendario ANTERIOR o igual a la col D → manda el calendario.
 *  · Cita POSTERIOR → se respeta la col D (salvo MTO, que se rigen solo por el calendario).
 *  · Col D vacía → manda la cita, aunque sea del mes siguiente.
 *  · Varios días seguidos = una sola instalación: cuenta el primer día del último bloque.
 *  · Los RETIROS no son entrega. Dos nombres con distinto número (II, 2) no se cruzan.
 */
import { Op } from 'sequelize';
import { leerCalendarioMes } from './googleSheets.service.js';
import { ProduccionProyecto, AvisoWhatsApp, Configuracion } from '../models/index.js';
import { isWhatsAppEnabled } from './whatsapp.service.js';

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** Fecha de HOY en México (el servidor corre en UTC: a las 18:00 de aquí allá ya es mañana). */
export const hoyMexico = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

export const sumarDias = (isoFecha, n) => {
    const [y, m, d] = isoFecha.split('-').map(Number);
    const f = new Date(Date.UTC(y, m - 1, d + n));
    return f.toISOString().slice(0, 10);
};

// ---------- Cruce de nombres (copia de frontend/src/utils/produccion.js) ----------
const normalizarNombre = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const levenshtein = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = b[i - 1] === a[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[b.length][a.length];
};

const PALABRAS_DE_CITA = new Set(['mto', 'gtia', 'retiro', 'reinst', 'reinstalacion', 'instalacion', 'extensivo', 'falla']);
const NUMERALES = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
const numeralesDe = (n) => n.split(' ').filter(t => NUMERALES.has(t)).sort().join(' ');
const nombreBase = (n) => n.split(' ').filter(t => t && !PALABRAS_DE_CITA.has(t)).join(' ');
const esCitaRetiro = (n) => n.split(' ').includes('retiro');

const matchNombre = (nombreA, nombreB) => {
    const a = normalizarNombre(nombreA);
    const b = normalizarNombre(nombreB);
    if (!a || !b) return false;
    if (a === b) return true;
    if (numeralesDe(a) !== numeralesDe(b)) return false;
    if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return true;
    const maxLen = Math.max(a.length, b.length);
    return maxLen > 0 && 1 - levenshtein(a, b) / maxLen >= 0.8;
};

const inicioUltimoBloque = (fechasAsc) => {
    if (!fechasAsc.length) return null;
    const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    let inicio = fechasAsc[0];
    for (let i = 1; i < fechasAsc.length; i++) {
        if ((toUTC(fechasAsc[i]) - toUTC(fechasAsc[i - 1])) / 86400000 > 1) inicio = fechasAsc[i];
    }
    return inicio;
};

const citasPorNombre = (citas) => {
    const mapa = {};
    for (const cp of citas || []) {
        const key = normalizarNombre(cp.nombre);
        if (!key || key.includes('cimentacion') || !cp.fecha) continue;
        const lista = (mapa[key] = mapa[key] || []);
        if (!lista.some(c => c.fecha === cp.fecha)) lista.push({ fecha: cp.fecha, retiro: esCitaRetiro(key) });
    }
    return mapa;
};

const buscarFechaInstalacion = (nombreProyecto, mapa) => {
    const nombreProd = normalizarNombre(nombreProyecto);
    if (!nombreProd) return null;
    const nombresCalendario = Object.keys(mapa);
    const baseProd = nombreBase(nombreProd);
    let nombres = nombresCalendario.filter(n => nombreBase(n) === baseProd);
    if (nombres.length === 0) {
        nombres = nombresCalendario.filter(n => matchNombre(nombreProd, n));
        if (nombres.length > 1) {
            const similitud = (n) => {
                const a = nombreBase(n), b = baseProd;
                return 1 - levenshtein(a, b) / (Math.max(a.length, b.length) || 1);
            };
            const mejor = nombres.reduce((m, n) => (similitud(n) > similitud(m) ? n : m));
            nombres = nombres.filter(n => nombreBase(n) === nombreBase(mejor));
        }
    }
    if (nombres.length === 0) return null;
    const fechas = new Set();
    for (const n of nombres) for (const c of mapa[n]) if (!c.retiro) fechas.add(c.fecha);
    const fecha = inicioUltimoBloque([...fechas].sort());
    return fecha ? { fecha, nombres } : null;
};

// ---------- API ----------

/**
 * Citas del calendario del mes en curso y del siguiente (la última semana de un mes vive en
 * la pestaña del siguiente). Cada cita ya trae su fecha real resuelta por leerCalendarioMes.
 */
export const leerCitasCercanas = async (hoy = hoyMexico()) => {
    const mesIdx = Number(hoy.slice(5, 7)) - 1;
    const citas = [];
    for (const mes of [MESES[mesIdx], MESES[(mesIdx + 1) % 12]]) {
        const r = await leerCalendarioMes(mes);
        citas.push(...(r?.data?.proyectos || []));
    }
    return citas;
};

/**
 * Fecha de instalación que manda para cada proyecto, con la regla del dashboard.
 * @returns {Map<number, {fecha: string|null, fuente: 'calendario'|'indice'}>}
 */
export const resolverFechasInstalacion = (proyectos, citas) => {
    const mapa = citasPorNombre(citas);

    // 1) Cruce normal, el mismo del dashboard.
    const citaDe = new Map();
    const reclamados = new Set();
    for (const p of proyectos) {
        const r = buscarFechaInstalacion(p.nombre, mapa);
        if (r) { citaDe.set(p.id, r.fecha); r.nombres.forEach(n => reclamados.add(n)); }
    }

    // 2) Respaldo por número. El cruce normal nunca liga "X / SECCIÓN 3" con "X" (el número
    //    separa AURELIO AMEZOLA de AURELIO AMEZOLA II), pero el calendario escribe corto:
    //    COLEGIO ATENAS / MADRE LILA / SECCIÓN 3 aparece solo como "COLEGIO ATENAS". Se liga
    //    únicamente si la cita no trae número, ningún otro proyecto la reclamó y UN SOLO
    //    proyecto abierto cuadra con ella; con dos candidatos no se adivina.
    const libres = Object.keys(mapa).filter(n => !reclamados.has(n) && !numeralesDe(n));
    const candidatos = new Map();
    for (const p of proyectos) {
        if (citaDe.has(p.id)) continue;
        const prod = normalizarNombre(p.nombre);
        if (!numeralesDe(prod)) continue;
        const prodSinNumero = prod.split(' ').filter(t => !NUMERALES.has(t)).join(' ');
        for (const n of libres) {
            if (!matchNombre(prodSinNumero, n)) continue;
            if (!candidatos.has(n)) candidatos.set(n, []);
            candidatos.get(n).push(p.id);
        }
    }
    for (const [n, ids] of candidatos) {
        if (ids.length !== 1 || citaDe.has(ids[0])) continue;
        const fecha = inicioUltimoBloque(mapa[n].filter(c => !c.retiro).map(c => c.fecha).sort());
        if (fecha) citaDe.set(ids[0], fecha);
    }

    const res = new Map();
    for (const p of proyectos) {
        const indice = p.fecha_limite || null;
        const cita = citaDe.get(p.id) || null;
        const soloCalendario = String(p.tipo_proyecto || '').toUpperCase() === 'MTO';
        if (cita && (soloCalendario || !indice || cita <= indice)) {
            res.set(p.id, { fecha: cita, fuente: 'calendario' });
        } else {
            res.set(p.id, { fecha: indice, fuente: 'indice' });
        }
    }
    return res;
};

/**
 * Qué le falta de producción a un proyecto. Un área solo cuenta si el proyecto la tiene
 * (hay planos suyos en Drive).
 */
export const resumenProduccion = (p) => {
    const pendientes = [];
    if (p.tiene_manufactura && !p.manufactura_completado) pendientes.push('manufactura');
    if (p.tiene_herreria && !p.herreria_completado) {
        if (p.herreria_armado_completado && !p.herreria_pintado_completado) pendientes.push('herreria_pintado');
        else if (!p.herreria_armado_completado && p.herreria_pintado_completado) pendientes.push('herreria_armado');
        else pendientes.push('herreria');
    }
    const listas = [];
    if (p.tiene_manufactura && p.manufactura_completado) listas.push('manufactura');
    if (p.tiene_herreria && p.herreria_completado) listas.push('herreria');

    // Sin planos en Drive no hay áreas que contar, y solo mirando `pendientes` saldría como
    // "listo" estando en Diseño. Lo que de verdad dice que producción cerró es la etapa.
    const sinPlanos = !p.tiene_manufactura && !p.tiene_herreria;
    const etapaPasoProduccion = ['instalacion', 'completado'].includes(p.etapa_actual);
    return {
        pendientes,
        listas,
        sin_planos: sinPlanos,
        produccion_cerrada: etapaPasoProduccion || (pendientes.length === 0 && !sinPlanos)
    };
};

/** Proyectos que todavía pueden instalarse: ni completados, ni cancelados, ni dados de baja. */
export const proyectosAbiertos = () => ProduccionProyecto.findAll({
    where: {
        etapa_actual: { [Op.ne]: 'completado' },
        activo: { [Op.ne]: false },
        [Op.or]: [{ tipo_proyecto: null }, { tipo_proyecto: { [Op.notILike]: 'CANCELADO%' } }]
    },
    order: [['nombre', 'ASC']]
});

// ---------- Aviso: un proyecto se ADELANTÓ a hoy o mañana ----------
const AREAS = { manufactura: 'Manufactura', herreria: 'Herrería', herreria_armado: 'Soldadura', herreria_pintado: 'Pintura' };
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_TXT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaEnPalabras = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const f = new Date(Date.UTC(y, m - 1, d));
    return `${DIAS[f.getUTCDay()]} ${d} de ${MESES_TXT[m - 1]}`;
};

/**
 * ¿Este cambio de fecha hay que avisarlo, y de qué tipo es?
 *  · 'adelanto': se vino encima, a hoy o mañana.
 *  · 'cambio': se movió (o se quedó sin fecha) una instalación de la semana que viene, que es
 *    de lo que el grupo ya está pendiente. PATRICIA RODRIGUEZ ANDA pasó del 23 al 29 y el
 *    grupo se quedó con la fecha vieja; EMMANUEL GARCIA pasó del viernes 25 al jueves 24
 *    horas después de avisarlo y tampoco se dijo.
 *
 * Un movimiento entre fechas lejanas no se avisa: el calendario se acomoda todo el tiempo y
 * eso no le cambia el trabajo a nadie todavía.
 *
 * @returns {'adelanto'|'cambio'|null}
 */
const DIAS_VENTANA = 7;
export const clasificarCambio = ({ anterior, nueva, hoy }) => {
    if (!anterior || nueva === anterior) return null;
    const manana = sumarDias(hoy, 1);
    if (nueva && nueva < anterior && nueva >= hoy && nueva <= manana) return 'adelanto';
    // Desde ayer (una instalación de ayer que se mueve sigue importando) hasta la semana.
    const cerca = (f) => !!f && f >= sumarDias(hoy, -1) && f <= sumarDias(hoy, DIAS_VENTANA);
    if (cerca(anterior)) return 'cambio';
    if (cerca(nueva) && nueva < anterior) return 'cambio';
    return null;
};

/**
 * El día en que producción tiene que entregar: el anterior a la instalación; si cae en
 * domingo, el sábado (que es cuando de verdad se puede entregar).
 */
const diaDeEntrega = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const f = new Date(Date.UTC(y, m - 1, d - 1));
    if (f.getUTCDay() === 0) f.setUTCDate(f.getUTCDate() - 1);
    return f.toISOString().slice(0, 10);
};

/**
 * Última fecha de instalación vista por proyecto, guardada en `configuracion` para que un
 * reinicio del servidor (cada deploy) no deje ciega la comparación: con la foto solo en
 * memoria, un adelanto hecho en esos minutos no se avisaba nunca.
 */
const CLAVE_FOTO = 'produccion_fechas_instalacion';
let ultimaFecha = null;

const cargarFoto = async () => {
    if (ultimaFecha) return ultimaFecha;
    ultimaFecha = new Map();
    try {
        const fila = await Configuracion.findOne({ where: { clave: CLAVE_FOTO } });
        const obj = fila?.valor ? JSON.parse(fila.valor) : {};
        for (const [id, fecha] of Object.entries(obj)) ultimaFecha.set(Number(id), fecha);
    } catch (e) {
        console.error('⚠️ No se pudo leer la foto de fechas de instalación:', e.message);
    }
    return ultimaFecha;
};

const guardarFoto = async (mapa) => {
    const valor = JSON.stringify(Object.fromEntries(mapa));
    const [fila, creada] = await Configuracion.findOrCreate({
        where: { clave: CLAVE_FOTO },
        defaults: { valor, descripcion: 'Última fecha de instalación vista por proyecto (aviso de adelantos a PRODUCCIÓN)' }
    });
    if (!creada && fila.valor !== valor) await fila.update({ valor });
};

/**
 * Compara la fecha de instalación de cada proyecto contra la pasada anterior y avisa al grupo
 * de PRODUCCIÓN los dos cambios que le mueven el trabajo:
 *  · Se ADELANTÓ a hoy o a mañana. Los recordatorios de siempre (7:00, 14:00, 16:00) ya
 *    pasaron o miran otro día: sin esto, un adelanto a media tarde nadie lo sabía hasta que
 *    el camión se iba sin la pieza.
 *  · SE RECORRIÓ una fecha que ya se había avisado (PATRICIA RODRIGUEZ ANDA pasó del 23 al 29
 *    y el grupo se quedó con la fecha vieja), o se quedó sin fecha en el calendario.
 *
 * Los proyectos sin planos (MTO) no se avisan, igual que en los recordatorios del bot.
 * Una sola pasada a la vez: la sincronización de cada 5 min y la que pide el bot antes de
 * avisar pueden coincidir, y las dos verían el mismo cambio.
 */
let pasadaEnCurso = null;
export const revisarAdelantos = () => {
    pasadaEnCurso ||= revisarCambiosUnaVez().finally(() => { pasadaEnCurso = null; });
    return pasadaEnCurso;
};

const revisarCambiosUnaVez = async () => {
    const proyectos = await proyectosAbiertos();
    const citas = await leerCitasCercanas();
    const fechas = resolverFechasInstalacion(proyectos, citas);
    const hoy = hoyMexico();
    const manana = sumarDias(hoy, 1);
    const foto = await cargarFoto();
    // Sin foto guardada (la primera vez que corre) no se sabe qué cambió: solo se toma.
    const primeraPasada = foto.size === 0;
    const vistos = new Map();

    let avisados = 0;
    for (const p of proyectos) {
        const nueva = fechas.get(p.id)?.fecha || null;
        const anterior = foto.get(p.id);
        vistos.set(p.id, nueva);
        if (primeraPasada || !anterior || nueva === anterior) continue;

        const r = resumenProduccion(p);
        if (r.sin_planos || r.produccion_cerrada) continue;
        if (!isWhatsAppEnabled()) continue;

        const cambio = clasificarCambio({ anterior, nueva, hoy });
        if (!cambio) continue;
        const seAdelanta = cambio === 'adelanto';

        // Dos pasadas (la de cada 5 min y la que pide el bot antes de avisar) pueden ver el
        // mismo cambio: se avisa una vez por proyecto y fecha.
        const tipo = seAdelanta ? 'adelanto_instalacion' : 'cambio_instalacion';
        const marca = `Nueva fecha: ${nueva || 'sin fecha'}`;
        const yaAvisado = await AvisoWhatsApp.findOne({
            where: { tipo, referencia_id: p.id, mensaje: { [Op.like]: `%${marca}%` } }
        });
        if (yaAvisado) continue;

        const falta = r.pendientes.length
            ? `falta ${r.pendientes.map(a => AREAS[a] || a).join(' y ')}`
            : `va en ${p.etapa_actual}`;

        let mensaje;
        if (seAdelanta) {
            const cuando = nueva === hoy ? '*HOY*' : '*MAÑANA*';
            mensaje =
                `📅 *Se adelantó una instalación*\n\n` +
                `*${p.nombre}* ahora se instala ${cuando} (${fechaEnPalabras(nueva)}); ` +
                `antes estaba para el ${fechaEnPalabras(anterior)}.\n\n` +
                `Producción: ${falta}.\n\n_${marca}_`;
        } else if (nueva) {
            mensaje =
                `📅 *Cambió una instalación*\n\n` +
                `*${p.nombre}* ya no se instala el ${fechaEnPalabras(anterior)}: ahora es el ` +
                `${fechaEnPalabras(nueva)} (hay que entregarlo el ${fechaEnPalabras(diaDeEntrega(nueva))}).\n\n` +
                `Producción: ${falta}.\n\n_${marca}_`;
        } else {
            mensaje =
                `📅 *Cambió una instalación*\n\n` +
                `*${p.nombre}* ya no se instala el ${fechaEnPalabras(anterior)} y no tiene otra fecha ` +
                `en el calendario.\n\n` +
                `Producción: ${falta}.\n\n_${marca}_`;
        }

        await AvisoWhatsApp.create({ destino: 'produccion', tipo, referencia_id: p.id, mensaje });
        console.log(`📅 Cambio de instalación avisado (${tipo}): "${p.nombre}" ${anterior} → ${nueva || 'sin fecha'}`);
        avisados++;
    }
    // La foto se queda solo con los proyectos abiertos: los cerrados salen solos.
    ultimaFecha = vistos;
    try { await guardarFoto(vistos); } catch (e) { console.error('⚠️ No se pudo guardar la foto de fechas de instalación:', e.message); }
    return { avisados, primeraPasada };
};
