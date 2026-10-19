// Rediseño 2 · Gestión · trabajos de TALLER en el Calendario (19-oct-2026, a pedido del usuario).
// El Calendario junta dos mundos:
//  - Campo: EQUIPO I a V (instalaciones, mantenimientos y garantías), tal como vienen pintados en la hoja del CALENDARIO.
//  - Taller: MANUFACTURA, HERRERÍA (SOLDADURA + PINTURA) y ALMACÉN. Además de lo pintado en la hoja, aquí se agregan:
//      · Manufactura y Pintura en la fecha de entrega del panel de producción (la cita agendada en el calendario o, sin
//        cita, la fecha máxima). Herrería es el bloque completo: su entrega es la de Pintura.
//      · Soldadura 2 días hábiles antes de la entrega de Pintura.
//      · Almacén = compras: órdenes enviadas o parciales en su fecha estimada de llegada.
// Sin React: lo prueba test/tallerCalendario.test.mjs con node (por eso las importaciones llevan .js). El hook que lee los
// datos está en useTallerCalendario.js.
import { restarDiasHabiles, matchNombre } from '../../utils/produccion.js';
import { claveDia, MESES } from './calendario.js';

/** Equipos de campo (los pinta la hoja en la hora de cada cita). */
export const esCampo = (equipo) => /^EQUIPO\b/.test(String(equipo || '').toUpperCase());
const TALLER = ['MANUFACTURA', 'HERRERIA', 'SOLDADURA', 'PINTURA', 'ALMACEN'];
/** Trabajos de taller: manufactura, herrería (soldadura y pintura) y almacén. */
export const esTaller = (equipo) => TALLER.includes(String(equipo || '').toUpperCase());

// Colores fijos del taller (la hoja pinta PINTURA de blanco, que no se ve como barra; SOLDADURA no existe en la hoja)
const COLOR_TALLER = {
  MANUFACTURA: 'rgb(255, 229, 153)',
  HERRERIA: 'rgb(234, 153, 153)',
  SOLDADURA: 'rgb(234, 153, 153)',
  PINTURA: 'rgb(148, 163, 184)',
  ALMACEN: 'rgb(140, 140, 140)',
};
export const colorTaller = (equipo) => COLOR_TALLER[String(equipo || '').toUpperCase()] || null;

const DIAS_SOLDADURA_ANTES = 2;

// Fecha 'YYYY-MM-DD' o Date en UTC (como las devuelve utils/produccion) → Date local a medianoche
const deUtc = (d) => (d ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : null);
const deTexto = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const aTexto = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

// Fecha de entrega del panel de producción: la «Cita agendada» del calendario (el día que se instala; p. ej. CONDOMINIOS
// MAYORCA = 20-oct) y, sin cita, la fecha máxima del Índice. Es la misma que muestra el panel (obras.js → citaDe).
function entregaProduccion(p) {
  return deTexto(p._fechaCalendario ? (p._fechaInstalacion || p.fecha_limite) : (p.fecha_limite_original || p.fecha_limite));
}

const activo = (p) => p.etapa_actual !== 'completado' && !p.pausado;

/** Lista de trabajos de taller [{ fecha, proyecto }] con proyecto en la misma forma que las citas de la hoja. */
export function armarTaller(proyectos, ordenes) {
  const lista = [];
  (proyectos || []).filter(activo).forEach((p) => {
    const entrega = entregaProduccion(p);
    if (!entrega) return;
    const base = { nombre: p.nombre, cliente: p.cliente || '', hora: '', tipoProyecto: 'NORMAL', virtual: true, origen: 'produccion' };
    if (p.tiene_manufactura && !(p.estadoSubEtapas?.manufactura?.completado || p.manufactura_completado)) {
      lista.push({ fecha: entrega, proyecto: { ...base, equipoHora: 'MANUFACTURA', etiqueta: 'Entrega de manufactura' } });
    }
    if (p.tiene_herreria && !(p.estadoSubEtapas?.herreria?.completado || p.herreria_completado)) {
      if (!p.herreria_armado_completado) {
        const soldadura = deUtc(restarDiasHabiles(aTexto(new Date(Date.UTC(entrega.getFullYear(), entrega.getMonth(), entrega.getDate()))), DIAS_SOLDADURA_ANTES));
        lista.push({ fecha: soldadura, proyecto: { ...base, equipoHora: 'SOLDADURA', etiqueta: 'Entrega de soldadura' } });
      }
      if (!p.herreria_pintado_completado) {
        lista.push({ fecha: entrega, proyecto: { ...base, equipoHora: 'PINTURA', etiqueta: 'Entrega de pintura' } });
      }
    }
  });
  (ordenes || []).forEach((o) => {
    const llega = o.fecha_llegada_estimada ? new Date(o.fecha_llegada_estimada) : null;
    if (!llega || Number.isNaN(llega.getTime())) return;
    // La fecha estimada se guarda a medianoche UTC: se toma su día tal cual
    const fecha = new Date(llega.getUTCFullYear(), llega.getUTCMonth(), llega.getUTCDate());
    lista.push({
      fecha,
      proyecto: {
        nombre: o.proveedor?.nombre || 'Proveedor sin nombre',
        cliente: o.ticket_id || '',
        folio: o.ticket_id || String(o.id),
        hora: '',
        tipoProyecto: 'NORMAL',
        equipoHora: 'ALMACEN',
        etiqueta: o.estado === 'parcial' ? 'Por recibir (parcial)' : 'Pedido por llegar',
        virtual: true,
        origen: 'compras',
      },
    });
  });
  return lista;
}

/**
 * Junta el taller con los días de la hoja. Lo que la hoja ya trae pintado ese día (mismo trabajo y mismo nombre) no se
 * repite. Los días que la hoja no trae se crean (con mesTab de su mes).
 */
export function juntarTaller(mapa, taller) {
  if (!taller?.length) return mapa;
  const junto = new Map(mapa);
  taller.forEach(({ fecha, proyecto }) => {
    const clave = claveDia(fecha);
    const dia = junto.get(clave) || { clave, fecha, nombre: '', numero: fecha.getDate(), mesTab: MESES[fecha.getMonth()], asueto: false, proyectos: [] };
    const area = proyecto.equipoHora === 'SOLDADURA' || proyecto.equipoHora === 'PINTURA' ? ['HERRERIA', proyecto.equipoHora] : [proyecto.equipoHora];
    const repetido = dia.proyectos.some((x) => area.includes(String(x.equipoHora || '').toUpperCase()) && matchNombre(x.nombre, proyecto.nombre));
    if (repetido) return;
    junto.set(clave, { ...dia, proyectos: [...dia.proyectos, proyecto] });
  });
  return junto;
}
