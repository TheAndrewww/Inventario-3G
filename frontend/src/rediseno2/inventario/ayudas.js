// Rediseño 2 · grupo inventario · ayudas puras para pintar (no piden nada ni cambian ningún valor que se mande).
import { cantidad, numero } from '../fundacion/formato';

/** Número de un texto del servidor («48.00» → 48). Si no es número, 0. */
export const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Existencia de un artículo con su unidad: «48 pzas», «6.5 m». */
export const existencia = (art) => cantidad(num(art?.stock_actual), art?.unidad || 'piezas');

/** Mínimo con su unidad, o «—» si no tiene. */
export const minimoDe = (art) => (num(art?.stock_minimo) > 0 ? cantidad(num(art.stock_minimo), art.unidad || 'piezas') : '—');

/**
 * Estado de la existencia (una sola marca por renglón, texto y color):
 * sin existencia → «Agotado» (mal); en o debajo del mínimo → «Bajo mínimo» (aviso); lo normal no lleva marca.
 * Es la misma regla que pintaba de rojo el número hoy (existencia ≤ mínimo).
 */
export function estadoExistencia(art) {
  if (!art || art.es_herramienta) return null;
  const s = num(art.stock_actual);
  const m = num(art.stock_minimo);
  if (s <= 0) return { texto: 'Agotado', tono: 'mal' };
  if (s <= m) return { texto: 'Bajo mínimo', tono: 'aviso' };
  return null;
}

/** La ubicación de hoy se llama «REVISAR»: el almacén tiene que revisarla. */
export const ubicacionPorRevisar = (art) => (
  art?.ubicacion?.codigo?.toUpperCase() === 'REVISAR' || art?.ubicacion?.nombre?.toUpperCase() === 'REVISAR'
);

/** Código de la ubicación o «Sin ubicación». */
export const ubicacionDe = (art) => art?.ubicacion?.codigo || art?.ubicacion?.nombre || 'Sin ubicación';

/** Unidades de una herramienta (las que ya trae el artículo). */
export const unidadesHerramienta = (art) => ({
  total: num(art?.tipo_herramienta_migrado?.total_unidades),
  libres: num(art?.tipo_herramienta_migrado?.unidades_disponibles),
});

/** «8 unidades», «1 unidad». */
export const unidades = (n) => `${numero(n)} ${Number(n) === 1 ? 'unidad' : 'unidades'}`;

/** Quita acentos y pasa a minúsculas (para comparar al buscar u ordenar). */
export const sinAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Estado de una unidad de herramienta de renta, con las palabras del vocabulario (§3.4). */
export const ESTADO_UNIDAD = {
  disponible: ['Disponible', 'ok'],
  buen_estado: ['Buena', 'ok'],
  estado_regular: ['Regular', 'aviso'],
  mal_estado: ['Mala', 'mal'],
  en_reparacion: ['En reparación', 'aviso'],
  perdida: ['Perdida', 'mal'],
  baja: ['De baja', 'neutro'],
  asignada: ['Asignada', 'info'],
};
export const estadoUnidad = (estado) => {
  const par = ESTADO_UNIDAD[estado];
  return par ? { texto: par[0], tono: par[1] } : { texto: estado || '—', tono: 'neutro' };
};

/** Signo y valor de una diferencia: «+2», «−3», «0». */
export const conSigno = (n) => {
  const v = num(n);
  if (v > 0) return `+${numero(v)}`;
  if (v < 0) return `−${numero(Math.abs(v))}`;
  return '0';
};

// El motivo de un error de carga en palabras: ahora vive en la fundación (una sola forma en todo el sistema).
export { motivoLegible } from '../fundacion/formato';
