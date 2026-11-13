/**
 * Las obras en Preparado para Sofía (12-nov-2026, pedido de Isa: «abre la Manufactura de …» por WhatsApp).
 *
 * Isa dicta el nombre de la obra y el dictado llega con errores («II» como «2», una letra cambiada, sin acentos). Sofía
 * pregunta aquí cuál es la obra y si se puede reabrir ANTES de proponer la orden; la orden lleva el id de Planta y el
 * nombre tal como sale de esta lista (el nombre dictado nunca va directo a la orden).
 *
 *   GET /api/sistemas/v1/produccion/preparados?q=<texto opcional>   alcance «produccion.leer» o «produccion.reabrir»
 *     Obras activas, sin cancelar, en Preparado (etapa interna 'instalacion').
 *     · Sin `q` (o con un `q` sin palabras para buscar): todas, las más recientes primero (la que entró a Preparado
 *       al último), 30 como máximo.
 *     · Con `q` (120 caracteres como máximo; repetido o más largo: 400): solo las que coinciden con el dictado
 *       (coincidenciaDictado), de mejor a peor, 10 como máximo.
 *     · `total`: cuántas coinciden (sin `q`: cuántas hay en Preparado), aunque la lista traiga menos.
 *     · `falla`, `puedeReabrir` y `motivoNo` salen de las MISMAS reglas de reabrirManufacturaPorFalla
 *       (services/reaperturaManufactura.service.js: impedimentoDeObra, SIN_FALLA y la falla del calendario), solo para las
 *       obras que se devuelven y con una sola lectura del calendario (tope de 15 s). Si el calendario no se puede leer:
 *       `falla` null, `puedeReabrir` false y `motivoNo` «no se pudo leer el calendario».
 *     → { ok: true, obras: [{ id, nombre, tipo_proyecto, falla: { fecha, nota } | null, puedeReabrir, motivoNo, coincidencia }], total }
 *       `coincidencia`: 'exacta' (cada palabra dictada está tal cual), 'aproximada' (alguna entró como inicio de palabra o
 *       con una letra de diferencia: Sofía se lo dice a Isa antes de proponer) o null (sin q).
 *   El nombre y la nota de la falla pasan por sinDatos (sin teléfonos, correos, direcciones ni importes), como las demás
 *   lecturas de producción. Solo lee: no escribe nada ni manda avisos.
 */
import { Op } from 'sequelize';
import { ProduccionProyecto } from '../../models/index.js';
import { normalizarNombre } from '../../services/fechaInstalacion.service.js';
import { impedimentoDeObra, SIN_FALLA, leerFallasDelCalendario } from '../../services/reaperturaManufactura.service.js';
import { sinDatos } from './produccion.js';

export const MAX_SIN_Q = 30;
export const MAX_CON_Q = 10;
export const MAX_Q = 120;
export const TOPE_CALENDARIO_MS = 15000;
export const SIN_CALENDARIO = 'no se pudo leer el calendario';
const MAX_LEIDAS = 1000; // Preparado nunca tiene tantas; es solo un tope
const SIN_CANCELADOS = { [Op.or]: [{ tipo_proyecto: null }, { tipo_proyecto: { [Op.notILike]: 'CANCELADO%' } }] };
// Lo que piden la lista, las reglas de reapertura y el cruce de nombres del calendario (nada de archivos ni texto libre).
const CAMPOS = ['id', 'nombre', 'tipo_proyecto', 'es_extensivo', 'es_premium', 'etapa_actual', 'activo', 'fecha_limite', 'instalacion_completado_en'];

// ---------- Coincidencia tolerante a dictado (puras) ----------

const ROMANOS = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'obra', 'proyecto', 'manufactura']);
const RE_NUMERO = /^\d+$/;
const PUNTOS = { exacta: 3, prefijo: 2, error: 1 };

/**
 * Las palabras de un texto como se comparan: minúsculas, sin acentos ni signos, los romanos I..X como dígitos
 * («ii» = «2»; «02» = «2») y sin palabras vacías (de, del, la, el, los, las, obra, proyecto, manufactura).
 */
export const palabrasDictado = (texto) => normalizarNombre(String(texto ?? ''))
    .split(' ')
    .filter(Boolean)
    .map((p) => ROMANOS[p] || (RE_NUMERO.test(p) ? String(Number(p)) : p))
    .filter((p) => !VACIAS.has(p));

/** ¿a y b difieren en UNA letra (una cambiada, una de más o una de menos)? */
export const unaLetraDeDiferencia = (a, b) => {
    if (a === b || Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
};

/** Cómo empata una palabra buscada con las del nombre: { tipo: 'exacta'|'prefijo'|'error', con (la del nombre) } o null. */
const empate = (palabra, delNombre) => {
    if (delNombre.includes(palabra)) return { tipo: 'exacta', con: palabra };
    if (RE_NUMERO.test(palabra)) return null; // los números (también los romanos) van exactos: «2» no es «3» ni «23»
    const prefijo = delNombre.find((n) => n.startsWith(palabra));
    if (prefijo) return { tipo: 'prefijo', con: prefijo };
    const parecida = palabra.length >= 4 ? delNombre.find((n) => !RE_NUMERO.test(n) && unaLetraDeDiferencia(palabra, n)) : null;
    return parecida ? { tipo: 'error', con: parecida } : null;
};

/** Las palabras de `q` que cuentan para buscar: números y palabras de 3 letras o más. */
export const palabrasDeBusqueda = (q) => palabrasDictado(q).filter((p) => RE_NUMERO.test(p) || p.length >= 3);

/**
 * ¿El nombre de la obra coincide con lo dictado? Cada palabra de `q` (de 3 letras o más, o un número) tiene que estar en
 * el nombre: igual, como inicio de una palabra del nombre, o con UNA letra de diferencia si tiene 4 letras o más
 * («lupa» ≈ «luna»). Los números van exactos.
 * @returns {{ puntaje, exactas, prefijos, errores, sobrantes } | null}  null si no coincide (o si `q` no trae palabras).
 *   puntaje: 3 por exacta, 2 por prefijo y 1 por error; sobrantes: palabras del nombre que nadie dictó.
 */
export const coincidenciaDictado = (q, nombre) => {
    const buscadas = Array.isArray(q) ? q : palabrasDeBusqueda(q);
    if (!buscadas.length) return null;
    const delNombre = palabrasDictado(nombre);
    const r = { puntaje: 0, exactas: 0, prefijos: 0, errores: 0, sobrantes: 0 };
    const usadas = new Set();
    for (const palabra of buscadas) {
        const e = empate(palabra, delNombre);
        if (!e) return null;
        usadas.add(e.con);
        r.puntaje += PUNTOS[e.tipo];
        if (e.tipo === 'exacta') r.exactas++;
        else if (e.tipo === 'prefijo') r.prefijos++;
        else r.errores++;
    }
    r.sobrantes = delNombre.filter((n) => !usadas.has(n)).length;
    return r;
};

/**
 * Las obras que coinciden con `q`, de mejor a peor: más puntaje, luego más exactas, luego menos palabras de sobra; si
 * empatan, se queda el orden en que llegaron (las más recientes primero). Lista vacía si nada coincide.
 */
export const ordenarPorCoincidencia = (q, obras, nombreDe = (o) => o.nombre) => {
    const buscadas = palabrasDeBusqueda(q);
    if (!buscadas.length) return [];
    return obras
        .map((obra, i) => ({ obra, i, c: coincidenciaDictado(buscadas, nombreDe(obra)) }))
        .filter((x) => x.c)
        .sort((a, b) => b.c.puntaje - a.c.puntaje || b.c.exactas - a.c.exactas || a.c.sobrantes - b.c.sobrantes || a.i - b.i)
        .map((x) => x.obra);
};

// ---------- La lectura ----------

const conTope = (promesa, ms) => {
    let t;
    return Promise.race([promesa, new Promise((_, mal) => { t = setTimeout(() => mal(new Error('tiempo')), ms); })]).finally(() => clearTimeout(t));
};

/** `q`: { valor } (vacío = sin q) o { error }. */
export const leerQ = (query = {}) => {
    const v = query.q;
    if (v === undefined || v === null) return { valor: '' };
    if (typeof v !== 'string') return { error: '«q» va una sola vez' };
    const valor = v.replace(/\s+/g, ' ').trim();
    if (valor.length > MAX_Q) return { error: `«q» es muy largo (${MAX_Q} caracteres como máximo)` };
    return { valor };
};

const nombreDe = (p) => sinDatos(p.nombre, 200) || '';

/** 'exacta' | 'aproximada' | null (sin palabras que buscar). */
export const tipoDeCoincidencia = (q, nombre) => {
    const c = coincidenciaDictado(q, nombre);
    if (!c) return null;
    return c.prefijos || c.errores ? 'aproximada' : 'exacta';
};

/**
 * Una obra de la lista con lo que dirían las reglas de reapertura. `fallas` = Map id → falla del calendario, o null;
 * `q` = lo dictado (para decir si la coincidencia fue exacta).
 */
export const armarPreparada = (p, fallas, q = '') => {
    const impedimento = impedimentoDeObra(p);
    const cal = fallas ? fallas.get(p.id) : undefined;
    let motivoNo = null;
    if (impedimento) motivoNo = impedimento.mensaje;
    else if (!cal) motivoNo = SIN_CALENDARIO;
    else if (!cal.falla) motivoNo = SIN_FALLA;
    return {
        id: p.id,
        nombre: nombreDe(p),
        tipo_proyecto: p.tipo_proyecto ? String(p.tipo_proyecto).trim() || null : null,
        falla: cal?.falla ? { fecha: cal.fecha || null, nota: sinDatos(cal.nota, 300) } : null,
        puedeReabrir: !motivoNo,
        motivoNo,
        coincidencia: tipoDeCoincidencia(q, nombreDe(p))
    };
};

/**
 * GET /produccion/preparados → { codigo, cuerpo }
 * @param {object} [opciones] leerFallas (obras) => Map id → falla (leerFallasDelCalendario), topeCalendarioMs
 */
export const leerPreparados = async (req, { leerFallas = leerFallasDelCalendario, topeCalendarioMs = TOPE_CALENDARIO_MS } = {}) => {
    const q = leerQ(req.query);
    if (q.error) return { codigo: 400, cuerpo: { error: `No se pudo leer: ${q.error}.` } };
    const filas = await ProduccionProyecto.findAll({
        where: { etapa_actual: 'instalacion', activo: true, ...SIN_CANCELADOS },
        attributes: CAMPOS,
        order: [['instalacion_completado_en', 'DESC NULLS LAST'], ['id', 'DESC']],
        limit: MAX_LEIDAS
    });

    let elegidas;
    let total;
    if (palabrasDeBusqueda(q.valor).length) {
        const coinciden = ordenarPorCoincidencia(q.valor, filas, nombreDe);
        total = coinciden.length;
        elegidas = coinciden.slice(0, MAX_CON_Q);
    } else {
        total = filas.length;
        elegidas = filas.slice(0, MAX_SIN_Q);
    }

    // Una sola lectura del calendario para las que se devuelven; si no llega, ninguna se puede reabrir desde aquí.
    let fallas = null;
    if (elegidas.length) {
        try {
            fallas = await conTope(Promise.resolve().then(() => leerFallas(elegidas)), topeCalendarioMs);
        } catch (e) {
            console.error('[puerta] /produccion/preparados: no se pudo leer el calendario:', e?.message === 'tiempo' ? `no respondió en ${topeCalendarioMs / 1000} s` : e?.message);
            fallas = null;
        }
    }
    return { codigo: 200, cuerpo: { ok: true, obras: elegidas.map((p) => armarPreparada(p, fallas, q.valor)), total } };
};
