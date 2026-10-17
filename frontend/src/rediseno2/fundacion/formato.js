// Rediseño 2 · formatos de cantidades, dinero, fechas y plurales (DISENO-v2 §4.9).
// SOLO dan formato para pintar: nunca cambian un valor que se manda al servidor.
//
//   cantidad(17, 'piezas')  → «17 pzas»      cantidad(1, 'piezas') → «1 pza»     cantidad(6.5, 'metros') → «6.5 m»
//   dinero(134360.64)       → «$134,360.64»  numero(1215) → «1,215»               plural(1, 'día', 'días') → «1 día»
//   duracion(864)           → «14 min 24 s»
//   fechaRelativa(v)        → «ahora», «hace 12 min», «hoy 10:20», «ayer 16:05», «el lunes», «hace 9 días», «15 oct»,
//                             «15 oct 2025»; a futuro «mañana», «en 3 días», «jue 22 oct»
//   fechaExacta(v)          → «jueves 15 de octubre de 2026, 10:20» (para el title)
//   fechaCita(v)            → «jue 15 oct · 9:00»
//   plazo(fecha)            → { texto: '3 días tarde' | 'Vence hoy' | 'Vence mañana' | 'En 4 días' | '20 oct', tono }

const nf = (min = 0, max = 2) => new Intl.NumberFormat('es-MX', { minimumFractionDigits: min, maximumFractionDigits: max });
const NF_ENTERO = nf(0, 2);
const NF_DINERO = nf(2, 2);

const aNumero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** «1,215» · «6.5» (decimales solo si los hay, máximo 2). Si no es número, lo devuelve tal cual. */
export function numero(v) {
  const n = aNumero(v);
  return n === null ? (v ?? '') : NF_ENTERO.format(n);
}

/** «$134,360.64». Si no es número, «—». */
export function dinero(v) {
  const n = aNumero(v);
  return n === null ? '—' : `${n < 0 ? '-' : ''}$${NF_DINERO.format(Math.abs(n))}`;
}

/** Plural correcto: plural(1, 'día', 'días') → «1 día»; con sinNumero=true solo la palabra. */
export function plural(n, uno, varios, sinNumero = false) {
  const palabra = Number(n) === 1 ? uno : varios;
  return sinNumero ? palabra : `${numero(n)} ${palabra}`;
}

// Unidades del catálogo (texto libre en la base: piezas, kg, metros, litros, cajas…): abreviatura de una y de varias.
const UNIDADES = {
  pieza: ['pza', 'pzas'], piezas: ['pza', 'pzas'], pza: ['pza', 'pzas'], pzas: ['pza', 'pzas'], pz: ['pza', 'pzas'],
  metro: ['m', 'm'], metros: ['m', 'm'], m: ['m', 'm'], ml: ['m', 'm'],
  kg: ['kg', 'kg'], kilo: ['kg', 'kg'], kilos: ['kg', 'kg'], kilogramo: ['kg', 'kg'], kilogramos: ['kg', 'kg'],
  litro: ['L', 'L'], litros: ['L', 'L'], l: ['L', 'L'], lt: ['L', 'L'], lts: ['L', 'L'],
  caja: ['caja', 'cajas'], cajas: ['caja', 'cajas'], rollo: ['rollo', 'rollos'], rollos: ['rollo', 'rollos'],
  par: ['par', 'pares'], pares: ['par', 'pares'], juego: ['juego', 'juegos'], juegos: ['juego', 'juegos'],
  galon: ['galón', 'galones'], galones: ['galón', 'galones'], 'galón': ['galón', 'galones'],
  bulto: ['bulto', 'bultos'], bultos: ['bulto', 'bultos'], paquete: ['paquete', 'paquetes'], paquetes: ['paquete', 'paquetes'],
  m2: ['m²', 'm²'], 'm²': ['m²', 'm²'],
};
/** «17 pzas», «1 pza», «6.5 m». Unidad desconocida: se pinta tal cual (en minúsculas no se toca). */
export function cantidad(v, unidad = 'piezas') {
  const n = aNumero(v);
  const u = String(unidad || '').trim();
  const par = UNIDADES[u.toLowerCase()];
  const texto = par ? (n === 1 ? par[0] : par[1]) : u;
  if (n === null) return texto ? `${v ?? ''} ${texto}`.trim() : String(v ?? '');
  return texto ? `${NF_ENTERO.format(n)} ${texto}` : NF_ENTERO.format(n);
}

/** Segundos → «14 min 24 s», «2 h 5 min», «45 s». */
export function duracion(segundos) {
  const s = Math.max(0, Math.round(aNumero(segundos) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  if (m) return r ? `${m} min ${r} s` : `${m} min`;
  return `${r} s`;
}

// ───────── Fechas ─────────
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;
/** Convierte a Date. «2026-10-15» (solo día) se toma como ese día a las 00:00 locales (sin correrse por la zona). */
export function aFecha(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' && SOLO_DIA.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const f = new Date(v);
  return Number.isNaN(f.getTime()) ? null : f;
}
const esSoloDia = (v) => typeof v === 'string' && SOLO_DIA.test(v);

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const hora = (f) => `${f.getHours()}:${String(f.getMinutes()).padStart(2, '0')}`;
const inicioDia = (f) => new Date(f.getFullYear(), f.getMonth(), f.getDate());
const DIA_MS = 86400000;
/** Días de calendario entre hoy y la fecha (negativo = ya pasó). */
export const diasDesdeHoy = (v, ahora = new Date()) => {
  const f = aFecha(v);
  if (!f) return null;
  return Math.round((inicioDia(f) - inicioDia(ahora)) / DIA_MS);
};
const diaCorto = (f, ahora) => `${f.getDate()} ${MESES[f.getMonth()]}${f.getFullYear() !== ahora.getFullYear() ? ` ${f.getFullYear()}` : ''}`;

/** Fecha relativa, una sola forma en todo el sistema (nunca segundos, nunca ISO). */
export function fechaRelativa(v, ahora = new Date()) {
  const f = aFecha(v);
  if (!f) return '—';
  const soloDia = esSoloDia(v);
  const dias = diasDesdeHoy(f, ahora);
  if (!soloDia) {
    const min = Math.round((ahora - f) / 60000);
    if (min >= 0 && min < 1) return 'ahora';
    if (min >= 1 && min < 60) return `hace ${min} min`;
  }
  if (dias === 0) return soloDia ? 'hoy' : `hoy ${hora(f)}`;
  if (dias === -1) return soloDia ? 'ayer' : `ayer ${hora(f)}`;
  if (dias === 1) return soloDia ? 'mañana' : `mañana ${hora(f)}`;
  if (dias < -1 && dias >= -6) return `el ${DIAS_LARGOS[f.getDay()]}`;
  if (dias < -6 && dias >= -14) return `hace ${-dias} días`;
  if (dias > 1 && dias <= 6) return `en ${dias} días`;
  if (dias > 6) return `${DIAS[f.getDay()]} ${diaCorto(f, ahora)}`;
  return diaCorto(f, ahora);
}

/** «jueves 15 de octubre de 2026, 10:20» (sin hora si es solo un día). */
export function fechaExacta(v) {
  const f = aFecha(v);
  if (!f) return '';
  const texto = f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/,/g, '');
  return esSoloDia(v) ? texto : `${texto}, ${hora(f)}`;
}

/** Cita: «jue 15 oct · 9:00» (o sin hora si es solo un día). */
export function fechaCita(v, ahora = new Date()) {
  const f = aFecha(v);
  if (!f) return '—';
  const dia = `${DIAS[f.getDay()]} ${diaCorto(f, ahora)}`;
  return esSoloDia(v) ? dia : `${dia} · ${hora(f)}`;
}

/** Fecha corta de un día: «15 oct» (o «15 oct 2025»). */
export function fechaCorta(v, ahora = new Date()) {
  const f = aFecha(v);
  return f ? diaCorto(f, ahora) : '—';
}

/** Hora «10:41». */
export const horaCorta = (v) => { const f = aFecha(v); return f ? hora(f) : ''; };

/** Plazo de una fecha límite: «3 días tarde» (mal) · «Vence hoy» / «Vence mañana» (aviso) · «En 4 días» / «20 oct». */
export function plazo(v, ahora = new Date()) {
  const dias = diasDesdeHoy(v, ahora);
  if (dias === null) return { texto: 'Sin fecha', tono: null, dias: null };
  if (dias < 0) return { texto: `${plural(-dias, 'día', 'días')} tarde`, tono: 'mal', dias };
  if (dias === 0) return { texto: 'Vence hoy', tono: 'aviso', dias };
  if (dias === 1) return { texto: 'Vence mañana', tono: 'aviso', dias };
  if (dias <= 14) return { texto: `En ${dias} días`, tono: null, dias };
  return { texto: fechaCorta(v, ahora), tono: null, dias };
}

/** Iniciales para el avatar: «Dirección de prueba» → «DP». */
export const iniciales = (nombre = '') => String(nombre || '').split(/\s+/).filter((p) => p && !p.startsWith('(')).slice(0, 2)
  .map((p) => p[0]).join('').toUpperCase() || 'U';

/** Une clases sin dejar huecos: clases('r2-boton', activo && 'r2-activo'). */
export const clases = (...lista) => lista.filter(Boolean).join(' ');

/** El motivo de un error de carga en palabras de la persona. Una sola forma en todo el sistema (antes cada grupo decía
 *  «Network Error» a su manera). Lo que el servidor explica en español va tal cual. ErrorCarga ya lo aplica solo. */
export function motivoLegible(m) {
  const t = String(m ?? '').trim();
  if (!t) return null;
  if (/^network error$/i.test(t) || /failed to fetch|err_connection/i.test(t)) return 'No hubo conexión con el servidor. Revisa la red y vuelve a intentar.';
  if (/timeout|exceeded/i.test(t)) return 'El servidor tardó demasiado en responder.';
  const cod = t.match(/status code (\d{3})/i);
  if (cod) return `El servidor respondió con un error (código ${cod[1]}).`;
  return t;
}
