// Rediseño 2 · Piso · lo que las TV y la terminal necesitan saber de cada obra para pintarla.
// SOLO traduce a palabras y tono lo que las tarjetas de hoy ya calculan (TimelineHeader, TimelineStepper,
// ProyectoCardManufactura, ProyectoCardTerminal): mismas cuentas de días hábiles (utils/produccion.js), mismas fechas por
// etapa (calcularDiasPorEtapa), mismo estado de cierre en Preparados (getEstadoCierrePreparado). No cambia ningún valor
// ni pide nada.
//
// Para la revisión final: el grupo produccion tiene su propia traducción para el tablero (rediseno2/produccion/obras.js,
// pasosDe y fechaMaximaDe). Las dos siguen las mismas reglas; conviene juntarlas en una sola al final.
import { calcularDiasPorEtapa, esProyectoMTO, getHoyStr } from '../../utils/produccion';
import { usaTimelineSimplificado } from '../../components/produccion/constants';
import { plural, fechaCorta, aFecha } from '../fundacion/formato';
import { estadoDe, tipoTrabajo } from '../fundacion/vocabulario';

export { usaTimelineSimplificado };

// Date en UTC (como las devuelve calcularDiasPorEtapa) → 'YYYY-MM-DD'
export const fechaUTC = (d) => (d instanceof Date && !Number.isNaN(d.getTime())
  ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  : null);

// Días de calendario entre hoy (hora de México, como el resto de producción) y la fecha 'YYYY-MM-DD'
export function diasCalendario(fecha) {
  if (!fecha || typeof fecha !== 'string') return null;
  const a = getHoyStr().split('-').map(Number);
  const b = fecha.slice(0, 10).split('-').map(Number);
  if (b.length < 3 || b.some(Number.isNaN)) return null;
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

const corta = (fecha) => (fecha ? fechaCorta(String(fecha).slice(0, 10)) : '');
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
/** «jue 16 oct» de una fecha 'YYYY-MM-DD' */
export function diaConSemana(fecha) {
  const f = aFecha(String(fecha || '').slice(0, 10));
  return f ? `${DIAS_SEMANA[f.getDay()]} ${fechaCorta(String(fecha).slice(0, 10))}` : '';
}

/**
 * Plazo en palabras a partir de los días HÁBILES que ya calcula la página (mismo número que hoy: «3d atraso»,
 * «Vencido hace 3 días», «3 días restantes») y de la fecha.
 *   dias < 0 → «3 días tarde» (mal) · 0 → «Hoy» (aviso) · 1 → «Mañana» o «En 1 día» (aviso) · más → «En 4 días».
 * `avisoHasta`: hasta cuántos días va en ámbar (hoy, cada pantalla tiene su umbral: TV de área 2, fecha máxima 3).
 */
export function plazoHabil(dias, fecha, { avisoHasta = 1 } = {}) {
  const fechaTxt = corta(fecha);
  if (dias === null || dias === undefined || Number.isNaN(dias)) {
    return fecha ? { texto: fechaTxt, detalle: '', tono: null } : { texto: 'Sin fecha', detalle: '', tono: 'neutro' };
  }
  if (dias < 0) return { texto: `${plural(-dias, 'día', 'días')} tarde`, detalle: fechaTxt ? `vencía ${fechaTxt}` : '', tono: 'mal', dias };
  const cal = diasCalendario(fecha);
  const tono = dias <= avisoHasta ? 'aviso' : null;
  // La cuenta es de días HÁBILES y la de la cita es de calendario: con el día de la semana debajo («En 1 día · lun 19 oct»,
  // «Hoy · sáb 17 oct») se entiende por qué no coinciden, y la fecha se lee igual que la de la cita en el mismo renglón.
  const dia = diaConSemana(fecha) || fechaTxt;
  if (dias === 0) return { texto: 'Hoy', detalle: dia, tono: 'aviso', dias };
  if (dias === 1 && cal === 1) return { texto: 'Mañana', detalle: dia, tono, dias };
  return { texto: `En ${plural(dias, 'día', 'días')}`, detalle: dia, tono, dias };
}

/** Tipo de trabajo («Tipo B», «Mantenimiento», «Garantía») con su clase de color, o null. */
export const tipoDe = (p) => tipoTrabajo(p?.tipo_proyecto);

/** «Urgente» por prioridad (1 = la más urgente). Los MTO no cuentan la prioridad (hoy: solo su fecha), como hoy. */
export const urgentePorPrioridad = (p) => !esProyectoMTO(p) && Number(p?.prioridad) === 1;

/**
 * Detalle bajo el nombre: Urgente · cliente · tipo de trabajo. Sin repetir el cliente cuando es igual al nombre.
 * «Urgente» va primero: la línea se corta con «…» cuando el cliente es largo y la prioridad no debe perderse.
 */
export function detalleObra(p, { conTipo = true } = {}) {
  const partes = [];
  if (urgentePorPrioridad(p)) partes.push('Urgente');
  const cliente = String(p.cliente || '').trim();
  if (cliente && cliente.toLowerCase() !== String(p.nombre || '').trim().toLowerCase()) partes.push(cliente);
  const tipo = conTipo ? tipoDe(p) : null;
  if (tipo) partes.push(tipo.texto);
  return partes.join(' · ');
}

/** Cita agendada en el calendario (la del recuadro «Cita agendada» de hoy), o null. */
export const citaDe = (p) => (p?._fechaCalendario ? (p._fechaInstalacion || p.fecha_limite || null) : null);

/** Fecha máxima (la del Índice) y su plazo, con los umbrales del recuadro «Fecha máxima» de hoy. */
export function fechaMaximaDe(p, { sinColor = false } = {}) {
  if (!p?.fecha_limite) return null;
  const fecha = p.fecha_limite_original || p.fecha_limite;
  // Hoy el recuadro se pinta de ámbar con 3 días o menos (y de rojo con 2 o menos en instalación). En la TV, un solo
  // lenguaje de plazo (DISENO-v2 §3.4): rojo si ya pasó; ámbar hoy y mañana; lo demás sin color.
  const pz = plazoHabil(p.diasRestantes, fecha, { avisoHasta: 1 });
  return { ...pz, tono: sinColor && pz.tono !== null ? 'neutro' : pz.tono, fecha };
}

// ───────── Etapas (TV de producción) ─────────
const HECHO = {
  diseno: (p) => !!p.diseno_completado_en,
  compras: (p) => !!p.compras_completado_en,
  manufactura: (p) => !!(p.estadoSubEtapas?.manufactura?.completado || p.manufactura_completado),
  herreria: (p) => !!(p.estadoSubEtapas?.herreria?.completado || p.herreria_completado),
  instalacion: (p) => !!p.instalacion_completado_en,
};
const HECHO_EN = {
  diseno: (p) => p.diseno_completado_en,
  compras: (p) => p.compras_completado_en,
  manufactura: (p) => p.estadoSubEtapas?.manufactura?.completadoEn || p.manufactura_completado_en,
  herreria: (p) => p.estadoSubEtapas?.herreria?.completadoEn || p.herreria_completado_en,
  instalacion: (p) => p.instalacion_completado_en,
};
export const ETAPAS_TV = [
  { id: 'diseno', nombre: 'Diseño' },
  { id: 'compras', nombre: 'Compras' },
  { id: 'manufactura', nombre: 'Manufactura' },
  { id: 'herreria', nombre: 'Herrería' },
  { id: 'instalacion', nombre: 'Instalación' },
];

/**
 * Celda de cada etapa, con la misma lógica de los nodos del paso a paso de hoy (TimelineStepper):
 *   hecha → «Lista» y el día en que se terminó (sin color: ya no pide nada);
 *   activa → su plazo en palabras con color solo si está tarde (rojo) o vence hoy o mañana (ámbar); a tiempo, azul de estado;
 *   futura → «Pendiente» y su fecha límite (sin color: el atraso de la etapa activa es el que manda);
 *   no la lleva → «—».
 * Instalación con cita agendada: «Cita» con el día de la cita.
 */
export function celdaEtapa(p, etapa, porEtapa = calcularDiasPorEtapa(p)) {
  const sub = etapa === 'manufactura' || etapa === 'herreria';
  const hecho = HECHO[etapa](p);
  if (hecho) {
    const en = HECHO_EN[etapa](p);
    // El día en que se terminó, en la hora de la planta (cortar la marca de tiempo daba el día de Greenwich)
    return { texto: 'Lista', tono: 'neutro', detalle: en ? fechaCorta(en) : '' };
  }
  const conProduccion = p.tiene_manufactura || p.tiene_herreria;
  if (sub && !(conProduccion && p[`tiene_${etapa}`] !== false)) return { texto: '—', tono: null, vacia: true, detalle: '' };
  const info = porEtapa?.[sub ? 'produccion' : etapa] || null;
  const fechaEtapa = info ? fechaUTC(info.fechaLimite) : null;
  const activa = (p.etapa_actual === 'produccion' && sub) || p.etapa_actual === etapa;
  if (etapa === 'instalacion') {
    const cita = citaDe(p);
    if (cita) return { texto: diaConSemana(cita), tono: null, detalle: 'cita agendada', cita: true };
  }
  if (activa) {
    if (!info) return { texto: 'En curso', tono: 'info', detalle: '' };
    const pz = plazoHabil(info.dias, fechaEtapa, { avisoHasta: 1 });
    return { texto: pz.texto, tono: pz.tono || 'info', detalle: pz.detalle };
  }
  return { texto: 'Pendiente', tono: 'neutro', detalle: fechaEtapa ? `para el ${corta(fechaEtapa)}` : '' };
}

/** Las etapas en una frase, para la TV vertical o el celular: «Listas: diseño y compras · Manufactura: 3 días tarde». */
export function etapasEnFrase(p) {
  const porEtapa = calcularDiasPorEtapa(p);
  const celdas = ETAPAS_TV.map((e) => ({ ...e, ...celdaEtapa(p, e.id, porEtapa) }));
  const listas = celdas.filter((c) => c.texto === 'Lista').map((c) => c.nombre.toLowerCase());
  const activas = celdas.filter((c) => c.texto !== 'Lista' && !c.vacia && c.tono !== 'neutro');
  const pendientes = celdas.filter((c) => c.texto === 'Pendiente').map((c) => c.nombre.toLowerCase());
  const unir = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0] || '');
  return {
    listas: listas.length ? `${listas.length > 1 ? 'Listas' : 'Lista'}: ${unir(listas)}` : '',
    activas: activas.map((c) => ({ id: c.id, texto: `${c.nombre}: ${c.cita ? `cita ${c.texto}` : c.texto.charAt(0).toLowerCase() + c.texto.slice(1)}`, tono: c.tono })),
    pendientes: pendientes.length ? `Pendiente: ${unir(pendientes)}` : '',
  };
}

// ───────── TV de manufactura y herrería ─────────
/** En qué etapa va la obra, con las palabras del sistema; `listo` = ya está en producción (el área puede trabajarla). */
export function etapaObra(p) {
  const clave = usaTimelineSimplificado(p) && p.etapa_actual !== 'completado' ? 'instalacion' : p.etapa_actual;
  const e = estadoDe('etapa', clave);
  return { texto: e.texto, listo: p.etapa_actual === 'produccion' };
}

/** Fecha y días del ÁREA (producción), la misma cuenta que hace hoy ProyectoCardManufactura / ProyectoCardHerreria. */
export function entregaDeArea(p) {
  const porEtapa = calcularDiasPorEtapa(p);
  let fecha = p.fecha_limite;
  let dias = p.diasRestantes;
  if (porEtapa?.produccion) {
    fecha = fechaUTC(porEtapa.produccion.fechaLimite);
    dias = porEtapa.produccion.dias;
  }
  if (!fecha) return { fecha: null, dias, texto: 'Sin fecha', detalle: '', tono: 'neutro' };
  // Hoy: borde y fecha en rojo con 2 días o menos; ahora un solo color: ámbar hasta 2 días, rojo si ya pasó
  return { fecha, dias, ...plazoHabil(dias, fecha, { avisoHasta: 2 }) };
}

/** Atrasadas → Esta semana (hasta el domingo) → Después. Sin fecha va al final, como en el orden de hoy. */
export function grupoEntrega(entrega) {
  if (entrega.dias !== null && entrega.dias !== undefined && entrega.dias < 0) return 'atrasadas';
  const cal = diasCalendario(entrega.fecha);
  if (cal === null) return 'despues';
  const hoy = aFecha(getHoyStr());
  const finDeSemana = hoy ? 7 - hoy.getDay() : 0; // días que faltan para el domingo (domingo = 0 → 7)
  return cal <= (finDeSemana === 7 ? 0 : finDeSemana) ? 'semana' : 'despues';
}
export const GRUPOS_AREA = [
  { id: 'atrasadas', titulo: 'Atrasadas' },
  { id: 'semana', titulo: 'Esta semana' },
  { id: 'despues', titulo: 'Después' },
];

// ───────── Terminal ─────────
/**
 * Nombre corto del plano: quita del nombre del archivo el nombre de la obra (esté donde esté), el nombre del área si va al
 * principio (la terminal ya es de esa área) y «.pdf», y lo deja en oración.
 *   «FAM. ARIZMENDI VALLE - PATRONES DE CORTE.pdf» → «Patrones de corte»
 *   «HERRERIA LEDESMA ORTIZ - ESTRUCTURA.pdf» (en Herrería) → «Estructura»
 * Si no queda nada, el nombre tal cual. El nombre completo sigue al pasar el cursor (title) en el botón del plano.
 */
const sinAcentos = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function quitarTexto(texto, buscado) {
  if (!buscado) return texto;
  // Se compara sin acentos ni mayúsculas, carácter por carácter, para cortar en el lugar exacto del texto original
  const letras = [...texto];
  let plano = '';
  const origen = [];
  letras.forEach((ch, i) => { for (const c of sinAcentos(ch)) { plano += c; origen.push(i); } });
  const meta = sinAcentos(buscado);
  const k = meta ? plano.indexOf(meta) : -1;
  if (k < 0) return texto;
  const fin = origen[k + meta.length - 1] + 1;
  return `${letras.slice(0, origen[k]).join('')} ${letras.slice(fin).join('')}`;
}
const SEPARADORES = /^[\s\-–—_:·.]+|[\s\-–—_:·.]+$/g;
export function nombreCortoPlano(nombreArchivo, nombreObra, nombreArea) {
  const original = String(nombreArchivo || '').trim();
  let t = quitarTexto(original.replace(/\.pdf$/i, '').trim(), String(nombreObra || '').trim()).replace(/\s+/g, ' ').replace(SEPARADORES, '');
  const area = sinAcentos(String(nombreArea || '').trim());
  if (area) {
    const primera = t.split(/[\s\-–—_:·]+/)[0] || '';
    if (sinAcentos(primera) === area && t.length > primera.length) t = t.slice(primera.length).replace(SEPARADORES, '');
  }
  if (!t) return original.replace(/\.pdf$/i, '') || original;
  const esMayusculas = t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);
  if (esMayusculas) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Liga para ver el plano: la MISMA que arma hoy el visor de la terminal (PDFViewerModal). */
export const ligaPlano = (archivo) => (archivo?.link
  ? archivo.link.replace('/view', '/preview')
  : `https://drive.google.com/file/d/${archivo?.id}/preview`);

// ───────── Grupos de las TV (con páginas) ─────────
/**
 * Los grupos de la página visible, con el TOTAL de cada grupo (no solo lo que cabe en esta página) y si el grupo empezó en
 * la página anterior. La vista pone el título con <TituloGrupoTv>. Solo reparte la lista que ya llegó.
 *   definiciones: [{ id, titulo }] en orden · todas: la lista completa ya ordenada · visibles: los de esta página ·
 *   grupoDe(fila) → id del grupo.
 */
export function gruposDePagina(definiciones, todas, visibles, grupoDe) {
  return definiciones.map((g) => {
    const delGrupo = todas.filter((f) => grupoDe(f) === g.id);
    const filas = visibles.filter((f) => grupoDe(f) === g.id);
    return { id: g.id, texto: g.titulo, total: delGrupo.length, sigue: filas.length > 0 && delGrupo[0] !== filas[0], filas };
  });
}
