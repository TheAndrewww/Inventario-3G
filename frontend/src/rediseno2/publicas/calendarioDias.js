// Rediseño 2 · públicas · los días que muestra el Calendario público (solo da forma a lo que la página ya cargó).
//
// tresSemanas(): las MISMAS tres semanas que la pantalla de hoy (CalendarioPublicoPage, modo pantalla completa): junta las
// semanas del mes anterior, el actual y el siguiente, marca el mes real de cada día (la semana que cruza de mes) y toma la
// semana de hoy y las 2 siguientes. Es una copia del cálculo de la página, sin cambiar nada.
// paginasDeDias(): acomoda esos días de hoy en adelante, de 7 en 7 (una página de TV cada uno). Los días de esta semana
// que ya pasaron van al final, marcados como «ya pasó»: no se pierde ningún día de los que se ven hoy.
// equiposDe(): la distribución de equipos con su nombre, su color, el encargado (el primero de la lista, como hoy) y los demás.

const NOMBRES_DIA = {
  LUNES: 'lunes', MARTES: 'martes', MIERCOLES: 'miércoles', 'MIÉRCOLES': 'miércoles', JUEVES: 'jueves', VIERNES: 'viernes',
  SABADO: 'sábado', 'SÁBADO': 'sábado', DOMINGO: 'domingo',
};
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const EQUIPOS = {
  'EQUIPO I': 'Equipo I', 'EQUIPO II': 'Equipo II', 'EQUIPO III': 'Equipo III', 'EQUIPO IV': 'Equipo IV', 'EQUIPO V': 'Equipo V',
  MANUFACTURA: 'Manufactura', HERRERIA: 'Herrería', 'HERRERÍA': 'Herrería', PINTURA: 'Pintura', ALMACEN: 'Almacén', 'ALMACÉN': 'Almacén',
};
/** «EQUIPO III» → «Equipo III»; lo que no se conoce sale tal cual (no se inventa nada). */
export const nombreEquipo = (v) => {
  const t = String(v ?? '').trim();
  return EQUIPOS[t.toUpperCase()] || t;
};

const sinAcentos = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const rgb = (c) => (c && Number.isFinite(c.red) ? `rgb(${c.red}, ${c.green}, ${c.blue})` : null);
const primeraMayuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

// Marca el mes de cada día de las semanas de una pestaña (la primera semana puede traer días del mes anterior y la última,
// días del siguiente).
//   mesReal: el MISMO cálculo de la página (sirve para escoger la semana de hoy y marcar «Hoy», como hoy). Ojo, error de
//            hoy: en la segunda semana los días 2 a 7 quedan como del mes siguiente (ver REPORTE, errores que ya existen).
//   mesFecha: el mes que se ESCRIBE junto al número («5 oct»): sigue el cambio de mes dentro de la semana (31 → 1), para
//             que la vista no muestre un mes equivocado que la pantalla de hoy no escribía.
const etiquetarSemanas = (meses, semanas, indiceMes) => (semanas || []).map((s, i) => {
  const anterior = (indiceMes + 11) % 12;
  const siguiente = (indiceMes + 1) % 12;
  // Primer día después del cambio de mes (el número baja: 30 → 1); -1 si la semana no cruza de mes
  let corte = -1;
  let previo = null;
  s.dias.forEach((d, k) => {
    if (!d.numero) return;
    if (previo !== null && d.numero < previo && corte < 0) corte = k;
    previo = d.numero;
  });
  return {
    ...s,
    mes: meses[indiceMes],
    dias: s.dias.map((d, k) => {
      let mesReal = indiceMes;
      if (d.numero && i === 0 && d.numero > 20) mesReal = anterior;
      if (d.numero && i > 0 && d.numero < 8) mesReal = siguiente;
      let mesFecha = indiceMes;
      if (corte >= 0) mesFecha = i === 0 ? (k < corte ? anterior : indiceMes) : (k < corte ? indiceMes : siguiente);
      else if (i === 0 && d.numero > 20) mesFecha = anterior;
      return { ...d, mesReal, mesFecha };
    }),
  };
});

/** Copia del cálculo de la página: semana de hoy y las 2 siguientes. */
export function tresSemanas({ meses, mesActual, calendario, calendarioSiguienteMes, calendarioMesAnterior, hoy }) {
  const diaHoy = hoy.getDate();
  const mesHoy = hoy.getMonth();
  const indiceMesActual = meses.indexOf(mesActual);
  const etiquetar = (semanas, indiceMes) => etiquetarSemanas(meses, semanas, indiceMes);
  const todasLasSemanas = [
    ...etiquetar(calendarioMesAnterior?.semanas, (indiceMesActual + 11) % 12),
    ...etiquetar(calendario?.semanas, indiceMesActual),
    ...etiquetar(calendarioSiguienteMes?.semanas, (indiceMesActual + 1) % 12),
  ];
  let indice = todasLasSemanas.findIndex((semana) => semana.dias.some((dia) => dia.numero === diaHoy && dia.mesReal === mesHoy));
  if (indice === -1) indice = todasLasSemanas.findIndex((s) => s.mes === mesActual);
  if (indice === -1) indice = 0;
  return {
    semanas: [todasLasSemanas[indice] || null, todasLasSemanas[indice + 1] || null, todasLasSemanas[indice + 2] || null],
    diaHoy,
    mesHoy,
  };
}

/** Al pasar a otro mes con las flechas: las semanas de la pestaña de ESE mes (lo que se pidió ver), sin «hoy». */
export function semanasDelMes({ meses, indiceMes, calendario }) {
  return { semanas: etiquetarSemanas(meses, calendario?.semanas, indiceMes), diaHoy: -1, mesHoy: -1 };
}

/** Qué mes trae la pestaña cargada (mientras llega el mes nuevo sigue la anterior); si no lo dice, el que se pidió. */
export function indiceMesCargado({ meses, mesActual, calendario }) {
  const i = meses.indexOf(String(calendario?.mes || '').toUpperCase());
  return i >= 0 ? i : meses.indexOf(mesActual);
}

function obraDe(p, equipos) {
  const clave = sinAcentos(p.equipoHora);
  const falla = clave === 'FALLA';
  const delEquipo = !falla && clave ? equipos.find((e) => sinAcentos(e.tipoEquipo || e.nombre) === clave) : null;
  const tipo = sinAcentos(p.tipoProyecto);
  const cliente = sinAcentos(p.cliente);
  // En la hoja, el «cliente» de un mantenimiento o una garantía a veces es solo «MTO» o «GTIA»: lo dice la etiqueta de tipo.
  const repiteTipo = (tipo === 'MANTENIMIENTO' && (cliente === 'MTO' || cliente === 'MANTENIMIENTO'))
    || (tipo === 'GARANTIA' && (cliente === 'GTIA' || cliente === 'GARANTIA'));
  return {
    nombre: p.nombre,
    // Hoy se pinta «nombre / cliente» aunque sean iguales; aquí el cliente solo sale si dice algo distinto.
    cliente: p.cliente && cliente !== sinAcentos(p.nombre) && !repiteTipo ? p.cliente : null,
    hora: p.hora || null,
    falla,
    equipo: !falla && p.equipoHora ? nombreEquipo(p.equipoHora) : null,
    color: !falla && p.equipoHora ? (rgb(p.colorHora) || rgb(delEquipo?.color)) : null,
    tipo: tipo === 'MANTENIMIENTO' || tipo === 'GARANTIA' ? p.tipoProyecto : null,
  };
}

/** «8:30» → 510 minutos; sin hora, al final del día (misma regla que SemanaCalendario de gestion). */
const minutosDe = (hora) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60 + 1;
};
/** Las obras de un día por hora (las que tienen la misma hora, en el orden de la hoja). Solo acomoda: no quita ninguna. */
const porHora = (obras) => obras
  .map((o, i) => ({ o, i }))
  .sort((a, b) => minutosDe(a.o.hora) - minutosDe(b.o.hora) || a.i - b.i)
  .map((x) => x.o);

/** Lista plana de los días de las tres semanas, con lo que la vista necesita. */
export function diasDeSemanas({ semanas, diaHoy, mesHoy }, equipos = []) {
  const lista = [];
  semanas.forEach((semana, s) => {
    (semana?.dias || []).forEach((dia, d) => {
      const proyectos = dia.proyectos || [];
      const esAsueto = proyectos.some((p) => String(p.nombre || '').toUpperCase().includes('ASUETO'));
      // Por hora: en la hoja vienen por equipo y la TV las leía «8:00, 16:30, 8:00»
      const obras = porHora(proyectos.filter((p) => !String(p.nombre || '').toUpperCase().includes('ASUETO')).map((p) => obraDe(p, equipos)));
      if (dia.numero === null && obras.length === 0) return; // casilla sin fecha y sin obras: hoy sale gris con «-»
      lista.push({
        clave: `${s}-${d}-${dia.numero}`,
        nombreDia: primeraMayuscula(NOMBRES_DIA[sinAcentos(dia.nombre)] || String(dia.nombre || '').toLowerCase()),
        numero: dia.numero,
        mesReal: dia.mesReal,
        mesFecha: dia.mesFecha,
        fecha: dia.numero ? `${dia.numero} ${MES_CORTO[dia.mesFecha]}` : 'Sin fecha',
        // Igual que hoy: «Hoy» solo se marca dentro de la semana actual
        esHoy: s === 0 && dia.numero === diaHoy && dia.mesReal === mesHoy,
        esAsueto,
        obras,
      });
    });
  });
  return lista;
}

function rango(dias) {
  const con = dias.filter((d) => d.numero);
  if (!con.length) return 'Sin fecha';
  const a = con[0];
  const b = con[con.length - 1];
  if (a === b) return `${a.nombreDia} ${a.fecha}`;
  if (a.mesFecha === b.mesFecha) return `Del ${a.numero} al ${b.numero} ${MES_CORTO[b.mesFecha]}`;
  return `Del ${a.fecha} al ${b.fecha}`;
}

/** Páginas de 7 días: de hoy en adelante y, al final, los días de esta semana que ya pasaron. */
export function paginasDeDias(dias, porPagina = 7) {
  const iHoy = dias.findIndex((d) => d.esHoy);
  const orden = iHoy > 0
    ? [...dias.slice(iHoy), ...dias.slice(0, iHoy).map((d) => ({ ...d, pasado: true }))]
    : dias;
  const paginas = [];
  for (let i = 0; i < orden.length; i += porPagina) {
    const parte = orden.slice(i, i + porPagina);
    const futuros = parte.filter((d) => !d.pasado);
    let titulo;
    if (parte.some((d) => d.esHoy)) titulo = futuros.length > 1 ? `Hoy y los próximos ${futuros.length - 1} días` : 'Hoy';
    else if (futuros.length) titulo = futuros.length < parte.length ? `${rango(futuros)} · y lo que ya pasó` : rango(futuros);
    else titulo = 'Lo que ya pasó esta semana';
    paginas.push({ id: `dias-${i}`, tipo: 'dias', titulo, dias: parte });
  }
  return paginas;
}

/** Distribución de equipos: nombre, color, encargado (el primero, como hoy) y los demás integrantes. */
export const equiposDe = (distribucion) => (distribucion?.equipos || []).map((e, i) => ({
  clave: `${e.nombre}-${i}`,
  nombre: nombreEquipo(e.nombre),
  color: rgb(e.color),
  encargado: e.integrantes?.length ? e.integrantes[0] : null,
  otros: e.integrantes?.length > 1 ? e.integrantes.slice(1) : [],
}));
