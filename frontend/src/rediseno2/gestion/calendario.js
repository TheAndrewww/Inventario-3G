// Rediseño 2 · Gestión · ayudas del calendario de instalaciones (las usa SemanaCalendario y, tal cual, el Calendario
// público del grupo publicas). Solo reacomodan lo que la página YA cargó (mes anterior, actual y siguiente): no piden nada.
//
//   const dias = armarDias({ actual: calendario, anterior: calendarioMesAnterior, siguiente: calendarioSiguienteMes, mesActual });
//   dias.get('2026-10-16') → { clave, fecha, nombre: 'VIERNES', numero: 16, mesTab: 'OCTUBRE', proyectos: [...], asueto: false }
//   diasDeRango(dias, lunesDe(hoy), 7) → los 7 días (los que no vinieron en ningún mes cargado salen con sinDatos: true)
//
// Por qué así: cada pestaña del CALENDARIO trae semanas completas (lunes a domingo) y la semana que cruza de mes viene en
// las dos pestañas. La semana es de la pestaña del mes de su jueves; si esa pestaña no está cargada se usa la otra.

export const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const dos = (n) => String(n).padStart(2, '0');
export const claveDia = (f) => `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
export const sinHora = (f) => new Date(f.getFullYear(), f.getMonth(), f.getDate());
export const sumarDias = (f, n) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + n);
/** Lunes de la semana de esa fecha. */
export const lunesDe = (f) => { const d = sinHora(f); const dia = d.getDay() || 7; return sumarDias(d, 1 - dia); };
export const mismoDia = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Año de cada pestaña según el mes que se está viendo (diciembre ↔ enero cruzan de año). */
function anioDeTab(indiceTab, indiceActual, anioBase) {
  if (indiceActual === 0 && indiceTab === 11) return anioBase - 1;
  if (indiceActual === 11 && indiceTab === 0) return anioBase + 1;
  return anioBase;
}

const esAsueto = (p) => String(p?.nombre || '').toUpperCase().includes('ASUETO');

/**
 * Junta las semanas de los tres meses cargados en un mapa clave → día, sin repetir la semana que cruza de mes.
 * anio: el año del mes que se ve (por omisión, el de hoy; el CALENDARIO es de un solo año).
 */
export function armarDias({ actual, anterior, siguiente, mesActual, anio = new Date().getFullYear() }) {
  const iActual = MESES.indexOf(mesActual);
  const tabs = [
    { datos: anterior, indice: (iActual + 11) % 12 },
    { datos: actual, indice: iActual },
    { datos: siguiente, indice: (iActual + 1) % 12 },
  ];
  const dias = new Map();
  const propios = new Set(); // claves que ya vinieron de la pestaña dueña de su semana
  tabs.forEach(({ datos, indice }) => {
    if (!datos?.semanas) return;
    const anioTab = anioDeTab(indice, iActual, anio);
    // Mes real de cada día: los números suben día a día; cuando bajan (31 → 1) empieza el mes siguiente. Si la pestaña
    // arranca con días altos (28, 29, 30) son la cola del mes anterior.
    let corrimiento = null;
    let previo = null;
    const fechaDe = (numero, iSemana) => {
      if (corrimiento === null) corrimiento = iSemana === 0 && numero > 20 ? -1 : 0;
      else if (numero < previo) corrimiento += 1;
      previo = numero;
      const total = anioTab * 12 + indice + corrimiento;
      return new Date(Math.floor(total / 12), ((total % 12) + 12) % 12, numero);
    };
    datos.semanas.forEach((semana, iSemana) => {
      const conFecha = (semana.dias || []).map((d) => {
        if (!d || d.numero === null || d.numero === undefined) return null;
        return { d, fecha: fechaDe(d.numero, iSemana) };
      });
      // Dueña de la semana: la pestaña del mes de su jueves
      const jueves = conFecha[3]?.fecha || conFecha.find(Boolean)?.fecha;
      const esPropia = jueves ? jueves.getMonth() === indice : true;
      conFecha.forEach((x) => {
        if (!x) return;
        const clave = claveDia(x.fecha);
        if (dias.has(clave) && (propios.has(clave) || !esPropia)) return;
        const proyectos = (x.d.proyectos || []);
        dias.set(clave, {
          clave,
          fecha: x.fecha,
          nombre: x.d.nombre,
          numero: x.d.numero,
          mesTab: MESES[indice],
          asueto: proyectos.some(esAsueto),
          proyectos: proyectos.filter((p) => !esAsueto(p)),
        });
        if (esPropia) propios.add(clave);
      });
    });
  });
  return dias;
}

/** n días seguidos desde inicio; los que no vinieron en ningún mes cargado salen con sinDatos (no se inventa nada). */
export function diasDeRango(dias, inicio, n = 7) {
  return Array.from({ length: n }, (_, i) => {
    const fecha = sumarDias(inicio, i);
    const clave = claveDia(fecha);
    return dias.get(clave) || { clave, fecha, numero: fecha.getDate(), proyectos: [], asueto: false, sinDatos: true, mesTab: MESES[fecha.getMonth()] };
  });
}

/** Días del mes (índice 0–11) en orden, de los que vinieron. */
export function diasDelMes(dias, indiceMes, anio) {
  return [...dias.values()]
    .filter((d) => d.fecha.getMonth() === indiceMes && (anio === undefined || d.fecha.getFullYear() === anio))
    .sort((a, b) => a.fecha - b.fecha);
}

/** «12 al 18 oct» · «28 sep al 4 oct» · «29 dic 2026 al 4 ene 2027». */
export function textoRango(inicio, fin, conAnio = false) {
  const mismoMes = inicio.getMonth() === fin.getMonth() && inicio.getFullYear() === fin.getFullYear();
  const cruzaAnio = inicio.getFullYear() !== fin.getFullYear();
  const a = `${inicio.getDate()}${mismoMes ? '' : ` ${MESES_CORTOS[inicio.getMonth()]}`}${cruzaAnio ? ` ${inicio.getFullYear()}` : ''}`;
  const b = `${fin.getDate()} ${MESES_CORTOS[fin.getMonth()]}${cruzaAnio || conAnio ? ` ${fin.getFullYear()}` : ''}`;
  return `${a} al ${b}`;
}
/** «lun 12» */
export const diaCorto = (f) => `${DIAS_CORTOS[f.getDay()]} ${f.getDate()}`;
/** «lun» (el día de la semana solo, para la cabecera del calendario) */
export const diaSemanaCorto = (f) => DIAS_CORTOS[f.getDay()];
/** «viernes 16 oct» */
export const diaLargo = (f) => `${DIAS_LARGOS[f.getDay()]} ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
/** «viernes 16 de octubre» */
export const diaCompleto = (f) => `${DIAS_LARGOS[f.getDay()]} ${f.getDate()} de ${MESES_LARGOS[f.getMonth()]}`;
/** «Octubre 2026» a partir del nombre de la pestaña («OCTUBRE»). */
export const nombreMes = (mes, anio) => {
  const i = MESES.indexOf(mes);
  const t = i === -1 ? String(mes || '') : MESES_LARGOS[i];
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}${anio ? ` ${anio}` : ''}`;
};

/** «Hoy» · «Mañana» · «Ayer» o nada, para el título de un día. */
export function relativoDia(fecha, hoy) {
  const d = Math.round((sinHora(fecha) - sinHora(hoy)) / 86400000);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d === -1) return 'Ayer';
  return null;
}

/** Hora del calendario («8:00», «16:30») a minutos, para ordenar las obras del día por hora. Sin hora, al final. */
export const minutosDe = (hora) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60 + 1;
};
