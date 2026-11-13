/**
 * Texto corto para los avisos del grupo de Compras (13-nov-2026, pedido de Isa).
 *
 * Los avisos de 10 renglones con «• ARTÍCULO: 150 PIEZAS» se volvieron ruido y nadie los
 * leía. Estas piezas arman la versión que escribiría una persona: el artículo en
 * minúsculas, la cantidad sin «piezas» repetido y el nombre de pila de quien pidió.
 * Puras: sin base ni red.
 */

const UNIDADES_PIEZA = new Set(['pieza', 'piezas', 'pza', 'pzas', 'pz', 'pzs', 'pieza(s)', 'pz.', 'pza.', 'pzas.', 'unidad', 'unidades', 'u']);

const espacios = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Cantidad sin ceros de más: 150, 2.5. */
export const numeroCorto = (n) => {
    const v = parseFloat(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
};

/** «CERRAMIENTO RECTO GRANDE» → «cerramiento recto grande». */
export const articuloCorto = (nombre) => espacios(nombre || 'artículo').toLowerCase();

/** La unidad solo se dice si NO es pieza: «189», «2 rollos». */
export const unidadCorta = (unidad) => {
    const u = espacios(unidad).toLowerCase();
    return !u || UNIDADES_PIEZA.has(u) ? '' : u;
};

/** «FORMALASSER» → «Formalasser»; «EL TORNILLO» → «El Tornillo». */
export const nombrePropio = (s) => espacios(s).toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** «SUSANA GASCA» → «Susana». */
export const nombreDePila = (s) => nombrePropio(espacios(s).split(' ')[0] || '');

/** Lista natural: «a», «a y b», «a, b y c». */
export const enLista = (partes) => {
    const p = partes.filter(Boolean);
    if (p.length <= 1) return p[0] || '';
    return `${p.slice(0, -1).join(', ')} y ${p[p.length - 1]}`;
};

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
