/**
 * El checklist de calidad (config/checklistCalidad.json, copia EXACTA del real del 16-oct más su `version`) y el
 * evaluador SEGURO de `aplica_si`.
 *
 * Por qué un evaluador propio y no eval/Function: las condiciones viven en un JSON que se edita a mano y que también lee
 * la app de la tableta; ejecutarlas como código abriría la puerta a cualquier cosa. Aquí solo se entiende:
 *   siempre · un atributo de `atributos_proyecto` · `||` · `&&` · `atributo == 'texto'` · paréntesis.
 * Una expresión que no se entiende (atributo que no existe, símbolo raro, paréntesis sin cerrar) hace que el punto
 * APLIQUE y se avisa una vez en el registro: preferimos que Calidad revise de más a que un punto se esconda.
 * Los casos compartidos con la app están en tests/casos-aplica-si.json (y en Calidad-3G/docs/casos-aplica-si.json).
 *
 * Reglas del contrato (§3.2): una hoja aplica si su `aplica_si` se cumple; un punto, si se cumplen la hoja y el punto.
 * Sin atributos capturados ninguna hoja aplica todavía (la obra sale «Falta decir qué lleva»).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/checklistCalidad.json'), 'utf8'));
export const VERSION_CONFIG = CONFIG.version;
export const ESTADOS_PUNTO = ['pendiente', 'ok', 'defecto', 'na'];
export const HOJAS_IDS = CONFIG.hojas.map((h) => h.id);

// Atributo → tipo: 'bool' o la lista de valores permitidos («pintura | galvanizado | ninguno»).
export const TIPOS_ATRIBUTO = Object.fromEntries(Object.entries(CONFIG.atributos_proyecto).map(([nombre, desc]) => {
    const texto = String(desc).trim();
    if (/^bool\b/i.test(texto)) return [nombre, 'bool'];
    return [nombre, texto.split('|').map((x) => x.trim()).filter(Boolean)];
}));

// Índice de puntos: id → { hoja, punto }
const PUNTOS = new Map();
for (const hoja of CONFIG.hojas) for (const punto of hoja.puntos) PUNTOS.set(punto.id, { hoja, punto });
export const puntoDe = (id) => PUNTOS.get(String(id || '').trim().toUpperCase()) || null;

// ---------- Evaluador ----------

class ExpresionDesconocida extends Error {}

/** Fichas: identificadores, texto entre comillas simples, ||, &&, ==, ( y ). Cualquier otra cosa es desconocida. */
const fichas = (texto) => {
    const lista = [];
    let i = 0;
    const s = String(texto ?? '');
    while (i < s.length) {
        const c = s[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '(' || c === ')') { lista.push({ t: c }); i++; continue; }
        if (s.startsWith('||', i) || s.startsWith('&&', i) || s.startsWith('==', i)) { lista.push({ t: s.slice(i, i + 2) }); i += 2; continue; }
        if (c === "'") {
            const fin = s.indexOf("'", i + 1);
            if (fin < 0) throw new ExpresionDesconocida('comilla sin cerrar');
            lista.push({ t: 'texto', v: s.slice(i + 1, fin) });
            i = fin + 1;
            continue;
        }
        const m = /^[a-z_][a-z0-9_]*/i.exec(s.slice(i));
        if (m) { lista.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
        throw new ExpresionDesconocida(`símbolo «${c}»`);
    }
    return lista;
};

/** Descenso recursivo: o := y ('||' y)* ; y := comparacion ('&&' comparacion)* ; comparacion := primario ('==' texto)? */
const analizar = (texto) => {
    const f = fichas(texto);
    let pos = 0;
    const ver = () => f[pos];
    const tomar = (t) => {
        if (f[pos]?.t !== t) throw new ExpresionDesconocida(`se esperaba «${t}»`);
        return f[pos++];
    };
    const primario = () => {
        const x = ver();
        if (!x) throw new ExpresionDesconocida('expresión incompleta');
        if (x.t === '(') { pos++; const e = o(); tomar(')'); return e; }
        if (x.t === 'id') {
            pos++;
            if (x.v === 'siempre') return { tipo: 'siempre' };
            if (!Object.hasOwn(TIPOS_ATRIBUTO, x.v)) throw new ExpresionDesconocida(`«${x.v}» no es un atributo de la obra`);
            return { tipo: 'atributo', nombre: x.v };
        }
        throw new ExpresionDesconocida(`no se esperaba «${x.t}»`);
    };
    const comparacion = () => {
        const izq = primario();
        if (ver()?.t !== '==') return izq;
        pos++;
        if (izq.tipo !== 'atributo') throw new ExpresionDesconocida('solo se compara un atributo con un texto');
        const der = tomar('texto');
        return { tipo: 'igual', nombre: izq.nombre, valor: der.v };
    };
    const y = () => {
        let e = comparacion();
        while (ver()?.t === '&&') { pos++; e = { tipo: 'y', a: e, b: comparacion() }; }
        return e;
    };
    function o() {
        let e = y();
        while (ver()?.t === '||') { pos++; e = { tipo: 'o', a: e, b: y() }; }
        return e;
    }
    if (!f.length) throw new ExpresionDesconocida('vacía');
    const arbol = o();
    if (pos !== f.length) throw new ExpresionDesconocida('sobra texto al final');
    return arbol;
};

const valorDe = (arbol, atributos) => {
    switch (arbol.tipo) {
        case 'siempre': return true;
        case 'atributo': {
            const v = atributos && Object.hasOwn(atributos, arbol.nombre) ? atributos[arbol.nombre] : undefined;
            // Un atributo de texto solo (sin ==) cuenta si tiene algo que no sea «ninguno»
            return typeof v === 'string' ? v.trim() !== '' && v.trim().toLowerCase() !== 'ninguno' : v === true;
        }
        case 'igual': return String((atributos && Object.hasOwn(atributos, arbol.nombre) ? atributos[arbol.nombre] : '') ?? '') === arbol.valor;
        case 'y': return valorDe(arbol.a, atributos) && valorDe(arbol.b, atributos);
        case 'o': return valorDe(arbol.a, atributos) || valorDe(arbol.b, atributos);
        default: return true;
    }
};

const cache = new Map();
const yaAvisadas = new Set();

/**
 * ¿Aplica esta expresión con estos atributos? → { aplica, conocida }. Nunca lanza ni ejecuta código.
 * Expresión desconocida: { aplica: true, conocida: false } y un aviso en el registro (una vez por expresión).
 */
export const evaluarAplicaSi = (expresion, atributos = {}, { avisar = (t) => console.warn(t) } = {}) => {
    const clave = String(expresion ?? '');
    let entrada = cache.get(clave);
    if (!entrada) {
        try {
            entrada = { arbol: analizar(clave) };
        } catch (e) {
            entrada = { error: e instanceof ExpresionDesconocida ? e.message : 'no se pudo leer' };
        }
        if (cache.size < 500) cache.set(clave, entrada);
    }
    if (entrada.error) {
        if (!yaAvisadas.has(clave)) {
            yaAvisadas.add(clave);
            avisar(`[calidad] aplica_si desconocida «${clave.slice(0, 120)}» (${entrada.error}): el punto aplica`);
        }
        return { aplica: true, conocida: false };
    }
    return { aplica: valorDe(entrada.arbol, atributos || {}), conocida: true };
};

// ---------- Atributos y puntos que aplican ----------

/** ¿Ya se dijo qué lleva la obra? (null, {} o sin ningún atributo conocido = no). */
export const tieneAtributos = (atributos) => !!atributos && typeof atributos === 'object'
    && Object.keys(TIPOS_ATRIBUTO).some((k) => Object.hasOwn(atributos, k) && atributos[k] !== undefined && atributos[k] !== null);

/**
 * Atributos nuevos sobre los anteriores: solo los de `atributos_proyecto`, cada uno de su tipo. → { atributos } o
 * { error }. Un atributo con valor null se quita (vuelve a «sin decir»).
 */
export const mezclarAtributos = (entrada, anteriores = null) => {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { error: 'Faltan los atributos de la obra' };
    const res = { ...(anteriores || {}) };
    for (const [k, v] of Object.entries(entrada)) {
        // hasOwn: «constructor» o «toString» no son atributos aunque el objeto los herede
        const tipo = Object.hasOwn(TIPOS_ATRIBUTO, k) ? TIPOS_ATRIBUTO[k] : null;
        if (!tipo) return { error: `«${String(k).slice(0, 40)}» no es un atributo de la obra` };
        if (v === null) { delete res[k]; continue; }
        if (tipo === 'bool') {
            if (typeof v !== 'boolean') return { error: `«${k}» debe ser sí o no` };
            res[k] = v;
        } else {
            const texto = String(v).trim().toLowerCase();
            if (!tipo.includes(texto)) return { error: `«${k}» debe ser ${tipo.join(', ')}` };
            res[k] = texto;
        }
    }
    return { atributos: res };
};

/**
 * Las hojas que aplican y, de cada una, sus puntos que aplican. Sin atributos: ninguna.
 * → [{ hoja (la del config), puntos: [punto del config] }]
 */
export const hojasQueAplican = (atributos, opciones) => {
    if (!tieneAtributos(atributos)) return [];
    return CONFIG.hojas
        .filter((h) => evaluarAplicaSi(h.aplica_si, atributos, opciones).aplica)
        .map((h) => ({ hoja: h, puntos: h.puntos.filter((p) => evaluarAplicaSi(p.aplica_si, atributos, opciones).aplica) }));
};

/** Ids de los puntos que aplican (Set). */
export const puntosQueAplican = (atributos, opciones) => new Set(hojasQueAplican(atributos, opciones).flatMap((h) => h.puntos.map((p) => p.id)));

// Puntos de pintura de Herrería (los que con CALIDAD_DEFECTO_REABRE reabren «pintura» además de herrería)
export const PUNTOS_PINTURA = new Set(['H7', 'H8', 'H9', 'H10', 'H11']);

export default {
    CONFIG, VERSION_CONFIG, ESTADOS_PUNTO, TIPOS_ATRIBUTO, puntoDe, evaluarAplicaSi, tieneAtributos, mezclarAtributos,
    hojasQueAplican, puntosQueAplican, PUNTOS_PINTURA
};
