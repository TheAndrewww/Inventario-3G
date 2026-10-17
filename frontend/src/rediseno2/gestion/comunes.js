// Rediseño 2 · Gestión · ayudas de vista que comparten las pantallas del grupo (calendario, equipos, renta, mi equipo,
// proveedores, usuarios, reportes, campaña, perfil y entrar). Solo dan formato para pintar: no cambian ningún valor que se
// mande al servidor y no piden nada.
import { motivoLegible } from '../fundacion/formato';

/** Nombre del rol en pantalla (el valor que guarda el servidor no cambia). */
export const ROLES = {
  administrador: 'Administrador',
  'diseñador': 'Diseñador',
  almacen: 'Almacén',
  almacenista: 'Almacén',
  compras: 'Compras',
  encargado: 'Encargado',
  ventas: 'Ventas',
  operador: 'Operador',
};
export const nombreRol = (rol) => ROLES[rol] || (rol ? String(rol).charAt(0).toUpperCase() + String(rol).slice(1) : '—');

const quitarAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Compara dos textos sin mayúsculas, acentos ni espacios de más (para no repetir «nombre / cliente» cuando son iguales). */
export const mismoTexto = (a, b) => quitarAcentos(a).toLowerCase().replace(/\s+/g, ' ').trim() === quitarAcentos(b).toLowerCase().replace(/\s+/g, ' ').trim();

// Palabras que el calendario y la campaña escriben sin acento en la hoja
const ACENTOS = { HERRERIA: 'Herrería', ALMACEN: 'Almacén', DISENO: 'Diseño', OPERACION: 'Operación', LOGISTICA: 'Logística', ELECTRICA: 'Eléctrica' };

// Siglas que se quedan en mayúsculas (y cualquier palabra corta sin vocales: VRJ, PVC…)
const SIGLAS = new Set(['EPP', 'DLAB', 'VRJ', 'MTO', 'PQS', 'CFE', 'IMSS', 'SAT', 'RFC', 'PVC', 'SDS', 'LED', 'CDMX', 'GTO']);

/** «ACCESO» → «Acceso»; «EQUIPO IV» → «Equipo IV»; «VENTAS DLAB» → «Ventas DLAB»; respeta números romanos y siglas. */
export function oracion(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return '';
  if (t !== t.toUpperCase()) return t; // ya viene en oración: tal cual
  const llano = quitarAcentos(t);
  if (ACENTOS[llano]) return ACENTOS[llano];
  return t.split(/\s+/).map((p, i) => {
    const sin = quitarAcentos(p).replace(/[^A-Z0-9]/g, '');
    if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/.test(p)) return p;
    if (SIGLAS.has(sin) || (sin.length >= 2 && sin.length <= 4 && !/[AEIOU]/.test(sin) && /[A-Z]/.test(sin))) return p;
    const baja = p.toLowerCase();
    return i === 0 ? baja.charAt(0).toUpperCase() + baja.slice(1) : baja;
  }).join(' ');
}

/** Nombre del equipo del calendario: «EQUIPO I» → «Equipo I», «HERRERIA» → «Herrería». */
export const nombreEquipo = (equipo) => oracion(equipo);

/** Color de la hoja ({red, green, blue}) a CSS. Es identidad del equipo (punto de 10 px), no decoración. */
export const colorRgb = (c) => (c && Number.isFinite(c.red) ? `rgb(${c.red}, ${c.green}, ${c.blue})` : null);

/** Preferencia de la vista en el navegador (prefijo r2-, siempre con try/catch). */
export function leerPreferencia(clave, porOmision) {
  try {
    const v = window.localStorage.getItem(clave);
    return v === null ? porOmision : JSON.parse(v);
  } catch { return porOmision; }
}
export function guardarPreferencia(clave, valor) {
  try {
    if (valor === null || valor === undefined) window.localStorage.removeItem(clave);
    else window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch { /* sin almacenamiento */ }
}

/** Busca sin mayúsculas ni acentos en varios textos. */
export const coincide = (busqueda, ...textos) => {
  const q = quitarAcentos(busqueda).toLowerCase().trim();
  if (!q) return true;
  return textos.some((t) => quitarAcentos(t).toLowerCase().includes(q));
};

/** Herramientas de renta: condición física y estatus de disponibilidad en palabras (texto, tono). */
export const CONDICION_HERRAMIENTA = { bueno: ['Buena', 'ok'], regular: ['Regular', 'aviso'], malo: ['Mala', 'mal'], perdido: ['Perdida', 'mal'], baja: ['De baja', 'neutro'] };
export const ESTATUS_HERRAMIENTA = { disponible: ['Disponible', 'ok'], asignado: ['Asignada', 'info'], en_reparacion: ['En reparación', 'aviso'], en_transito: ['En tránsito', 'info'] };

/** El motivo de un error de carga en palabras de la persona: la misma forma de toda la fundación (revisión final). */
export const motivoError = (m) => motivoLegible(m) || m;
