// Rediseño 2 · Producción · lo que la vista nueva necesita saber de cada obra para pintarla.
// SOLO traduce a texto y tono lo que la tarjeta de hoy ya calcula (TimelineHeader, TimelineStepper, TimelineFooter):
// mismas cuentas de atraso y urgencia (utils/produccion.js), mismas fechas por etapa (calcularDiasPorEtapa), mismas
// reglas de qué etapa se puede marcar. No cambia ningún valor ni pide nada.
import { calcularDiasPorEtapa, esProyectoMTO, esUrgenteMTO, formatDateShort } from '../../utils/produccion';
import { usaTimelineSimplificado, calcularPorcentaje } from '../../components/produccion/constants';
import { plural } from '../fundacion/formato';
import { estadoDe } from '../fundacion/vocabulario';

export { usaTimelineSimplificado, calcularPorcentaje, formatDateShort };

// Nombres en pantalla de cada paso (Anexo A, 1: `instalacion` = «Lista para instalar»; el cierre es `completado`)
export const NOMBRE_PASO = {
  diseno: 'Diseño',
  compras: 'Compras',
  manufactura: 'Manufactura',
  herreria: 'Herrería',
  instalacion: 'Lista para instalar',
  completado: 'Cierre de la obra',
};

const ES_HECHO = {
  diseno: (p) => !!p.diseno_completado_en,
  compras: (p) => !!p.compras_completado_en,
  manufactura: (p) => !!(p.estadoSubEtapas?.manufactura?.completado || p.manufactura_completado),
  herreria: (p) => !!(p.estadoSubEtapas?.herreria?.completado || p.herreria_completado),
  instalacion: (p) => !!p.instalacion_completado_en,
  completado: (p) => p.etapa_actual === 'completado',
};
const HECHO_EN = {
  diseno: 'diseno_completado_en',
  compras: 'compras_completado_en',
  manufactura: 'manufactura_completado_en',
  herreria: 'herreria_completado_en',
  instalacion: 'instalacion_completado_en',
};

/** Atraso y urgencia de la obra: la MISMA cuenta que hace hoy el encabezado de la tarjeta (TimelineHeader). */
export function atrasoDe(p) {
  const er = p.estadoRetraso || { enRetraso: false };
  let enRetraso = er.enRetraso;
  let dias = er.diasRetraso || 0;
  if (enRetraso && p._fechaCalendario) {
    const porEtapa = calcularDiasPorEtapa(p);
    if (porEtapa) {
      const info = porEtapa[p.etapa_actual === 'produccion' ? 'produccion' : p.etapa_actual];
      if (info && info.dias >= 0) enRetraso = false;
      else if (info && info.dias < 0) dias = Math.abs(info.dias);
    }
  }
  if (p.etapa_actual === 'instalacion') enRetraso = false;
  const dr = p.diasRestantes;
  let urgenciaPorFecha = dr !== null && dr <= 3;
  if (p.etapa_actual === 'instalacion') urgenciaPorFecha = (dr ?? 999) <= 2;
  const esGarantia = p.tipo_proyecto?.toUpperCase() === 'GTIA';
  const esUrgente = esProyectoMTO(p) ? esUrgenteMTO(p) : (p.prioridad === 1 || esGarantia || urgenciaPorFecha || enRetraso);
  return { enRetraso: Boolean(enRetraso), dias, esUrgente: Boolean(esUrgente) };
}

/** Etapa en pantalla (vocabulario). Las MTO/GTIA que van directo se ven como «Lista para instalar», como hoy. */
export function etapaDe(p) {
  const clave = usaTimelineSimplificado(p) && p.etapa_actual !== 'completado' ? 'instalacion' : p.etapa_actual;
  return estadoDe('etapa', clave);
}

// Días que faltan para la fecha de una etapa (días hábiles, como hoy: «12D ATRASO», «HOY», «3D ENTREGA»)
export function textoDias(dias) {
  if (dias === null || dias === undefined) return { texto: '', tono: null };
  if (dias < 0) return { texto: `${plural(-dias, 'día', 'días')} tarde`, tono: 'mal' };
  if (dias === 0) return { texto: 'vence hoy', tono: 'aviso' };
  if (dias === 1) return { texto: 'falta 1 día', tono: 'aviso' };
  return { texto: `faltan ${dias} días`, tono: null };
}

/**
 * Pasos de la obra en orden (diseño, compras, manufactura, herrería, lista para instalar, cierre), con su estado:
 * 'hecha' · 'curso' (activa y a tiempo) · 'pronto' (activa, vence hoy o mañana) · 'tarde' (activa y atrasada) ·
 * 'pendiente' · 'noaplica'. Misma lógica que los nodos del paso a paso de hoy (TimelineStepper).
 */
export function pasosDe(p) {
  const simple = usaTimelineSimplificado(p);
  if (simple) {
    // Hoy: dos nodos («Completado» y «Cierre de proyecto»); el primero en rojo si es garantía o un MTO vencido
    const cerrada = p.etapa_actual === 'completado';
    const roja = !cerrada && (p.tipo_proyecto?.toUpperCase() === 'GTIA' || (esProyectoMTO(p) && p.diasRestantes !== null && p.diasRestantes < 0));
    return [
      { clave: 'diseno', nombre: NOMBRE_PASO.diseno, estado: 'noaplica' },
      { clave: 'compras', nombre: NOMBRE_PASO.compras, estado: 'noaplica' },
      { clave: 'manufactura', nombre: NOMBRE_PASO.manufactura, estado: 'noaplica' },
      { clave: 'herreria', nombre: NOMBRE_PASO.herreria, estado: 'noaplica' },
      { clave: 'instalacion', nombre: NOMBRE_PASO.instalacion, estado: roja ? 'tarde' : 'hecha', simple: true },
      { clave: 'completado', nombre: NOMBRE_PASO.completado, estado: cerrada ? 'hecha' : 'pendiente' },
    ];
  }
  const porEtapa = calcularDiasPorEtapa(p);
  const conProduccion = p.tiene_manufactura || p.tiene_herreria;
  const paso = (clave) => {
    const hecho = ES_HECHO[clave](p);
    const sub = clave === 'manufactura' || clave === 'herreria';
    if (sub && !hecho && !(conProduccion && p[`tiene_${clave}`] !== false)) {
      return { clave, nombre: NOMBRE_PASO[clave], estado: 'noaplica' };
    }
    const info = clave === 'completado' ? null : porEtapa?.[sub ? 'produccion' : clave] || null;
    const activo = !hecho && ((p.etapa_actual === 'produccion' && sub) || p.etapa_actual === clave);
    let estado = 'pendiente';
    if (hecho) estado = 'hecha';
    else if (activo) estado = info && info.dias < 0 ? 'tarde' : info && info.dias <= 1 ? 'pronto' : 'curso';
    return {
      clave, nombre: NOMBRE_PASO[clave], estado, hecho, activo,
      dias: info ? info.dias : null, fechaLimite: info ? info.fechaLimite : null,
      hechoEn: HECHO_EN[clave] ? p[HECHO_EN[clave]] || null : null,
    };
  };
  return ['diseno', 'compras', 'manufactura', 'herreria', 'instalacion', 'completado'].map(paso);
}

const unirNombres = (lista) => {
  const n = lista.map((x, i) => (i === 0 ? x : x.toLowerCase()));
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0] || '';
};

/** Lo que le pasa a la obra, en palabras (la columna «Avance»): «Manufactura · 3 días de atraso». */
export function problemaDe(p, pasos, atraso) {
  if (p.pausado) return { texto: p.pausado_motivo ? `Pausada: ${p.pausado_motivo}` : 'Pausada', tono: 'neutro' };
  if (p.etapa_actual === 'completado') return { texto: 'Obra cerrada', tono: null };
  if (usaTimelineSimplificado(p)) return { texto: 'Va directo a instalación', tono: null };
  if (p.etapa_actual === 'instalacion') return { texto: 'Producción terminada', tono: null };
  if (p.etapa_actual === 'pendiente') return { texto: 'Sin empezar', tono: null };
  const activos = pasos.filter((x) => x.activo);
  const nombres = unirNombres(activos.map((x) => x.nombre));
  if (atraso.enRetraso) return { texto: `${nombres || 'Etapa actual'} · ${plural(atraso.dias, 'día', 'días')} de atraso`, tono: 'mal' };
  if (!activos.length && p.etapa_actual === 'produccion' && p.estadoSubEtapas?.ambosCompletados) {
    return { texto: 'Producción terminada: falta marcarla lista para instalar', tono: 'ok' };
  }
  const primero = activos[0];
  if (primero && primero.dias !== null) {
    const d = textoDias(primero.dias);
    return { texto: `${nombres} · ${d.texto}`, tono: d.tono };
  }
  return { texto: nombres || '—', tono: null };
}

/** Fecha máxima de la obra: la del Índice y su plazo, con los MISMOS colores que el recuadro «Fecha máxima» de hoy. */
export function fechaMaximaDe(p) {
  if (!p.fecha_limite) return null;
  const fecha = p.fecha_limite_original || p.fecha_limite;
  const d = p.diasRestantes;
  const inst = p.etapa_actual === 'instalacion';
  if (d === null || d === undefined) return { fecha, texto: '', tono: null };
  let tono = null;
  if ((d < 0 && !inst) || (inst && d <= 2)) tono = 'mal';
  else if (d <= 3) tono = 'aviso';
  let texto;
  if (d < 0) texto = `${plural(-d, 'día', 'días')} tarde`;
  else if (d === 0) texto = 'Vence hoy';
  else if (d === 1) texto = 'Falta 1 día';
  else texto = `Faltan ${d} días`;
  if (inst && d >= 0 && d <= 2) texto = `Urgente · ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`;
  return { fecha, texto, tono };
}

/** Cita agendada en el calendario (la que hoy sale en el recuadro «Cita agendada»), o null. */
export const citaDe = (p) => (p._fechaCalendario ? (p._fechaInstalacion || p.fecha_limite || null) : null);

// Grupos del tablero: por lo que se decide (lo atrasado arriba, lo informativo abajo)
export const GRUPOS_TABLERO = [
  { id: 'atrasadas', titulo: 'Atrasadas' },
  { id: 'semana', titulo: 'Vencen esta semana', nota: 'fecha máxima en 6 días hábiles o menos' },
  { id: 'tiempo', titulo: 'En tiempo' },
  { id: 'listas', titulo: 'Listas para instalar' },
  { id: 'pausadas', titulo: 'Pausadas' },
  { id: 'cerradas', titulo: 'Cerradas' },
];

/** A qué grupo va la obra. Solo usa las mismas señales que hoy pintan de rojo o ámbar la tarjeta. */
export function grupoDe(p, atraso = atrasoDe(p)) {
  if (p.etapa_actual === 'completado') return 'cerradas';
  if (p.pausado) return 'pausadas';
  const d = p.diasRestantes;
  const vencida = d !== null && d !== undefined && d < 0 && p.etapa_actual !== 'instalacion';
  if (atraso.enRetraso || vencida) return 'atrasadas';
  if (p.etapa_actual === 'instalacion' || usaTimelineSimplificado(p)) return 'listas';
  if (d !== null && d !== undefined && d <= 6) return 'semana';
  return 'tiempo';
}

/** Reparte la lista (ya filtrada y en el orden de hoy) en grupos; el orden dentro de cada grupo no cambia. */
export function agrupar(lista, grupoDeFila, definicion) {
  const porGrupo = new Map(definicion.map((g) => [g.id, []]));
  for (const fila of lista) {
    const id = grupoDeFila(fila);
    if (!porGrupo.has(id)) porGrupo.set(id, []);
    porGrupo.get(id).push(fila);
  }
  return definicion.map((g) => ({ ...g, filas: porGrupo.get(g.id) || [] }));
}

/** Las etapas que el pie de la tarjeta de hoy deja marcar o desmarcar (TimelineFooter), en su orden. */
export function etapasMarcables(p, etapasPermitidas) {
  const lista = [
    { key: 'diseno', done: !!p.diseno_completado_en },
    { key: 'compras', done: !!p.compras_completado_en },
    { key: 'manufactura', done: Boolean(p.estadoSubEtapas?.manufactura?.completado || p.manufactura_completado) },
    { key: 'herreria', done: Boolean(p.estadoSubEtapas?.herreria?.completado || p.herreria_completado) },
    { key: 'instalacion', done: !!p.instalacion_completado_en },
  ];
  return lista.filter((e) => {
    if (etapasPermitidas && !etapasPermitidas.includes(e.key)) return false;
    if (e.key === 'manufactura') return p.tiene_manufactura || e.done;
    if (e.key === 'herreria') return p.tiene_herreria || e.done;
    return true;
  });
}

/** Hora corta «10:28» de un Date. */
export const horaDe = (f) => (f instanceof Date && !Number.isNaN(f.getTime()) ? `${f.getHours()}:${String(f.getMinutes()).padStart(2, '0')}` : '');
