// Rediseño 2 · Gestión · Calendario de instalaciones (/calendario), vista ENCENDIDA.
// Quién: encargados (es su inicio, desde el celular en obra): qué instalo hoy y mañana, a qué hora y con quién. Diseño,
// ventas, almacén y Dirección: qué sale esta semana y qué falló.
// Antes: la primera pantalla era la distribución de equipos y un reloj; hoy quedaba a 1.7 pantallas (4 en celular) y cada
// obra era una columna de 40 px partida letra por letra. Ahora: la semana de hoy a todo lo ancho (escritorio) o la agenda
// de hoy en adelante (celular), equipo con su NOMBRE, la falla con su motivo y la distribución en un cajón.
// Todo sale de CalendarioPage: los tres meses que ya carga, el cambio de mes (cambiarMes / setMesActual), el sondeo de 2 min,
// la escala guardada y la pantalla completa. Esta vista no pide nada.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Users, RefreshCw, Maximize2, ZoomIn, ZoomOut, CalendarDays, Rows3, X } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, Boton, BotonIcono, Segmentado, FiltroMenu, Tabla, Cajon, CajonCabecera, CajonCuerpo, SeccionCajon,
  Cargando, ErrorCarga, Vacio, TipoTrabajo, useAnchoR2, horaCorta, fechaExacta, plural, clases,
} from '../fundacion';
import ProyectoVentasModal from '../../components/calendario/ProyectoVentasModal';
import SemanaCalendario from './SemanaCalendario';
import VistaCalendarioTv from './VistaCalendarioTv';
import {
  MESES, armarDias, diasDeRango, diasDelMes, lunesDe, sumarDias, textoRango, nombreMes, diaLargo, relativoDia, minutosDe, mismoDia,
} from './calendario';
import { colorRgb, nombreEquipo, mismoTexto, leerPreferencia, guardarPreferencia, motivoError } from './comunes';
import './gestion.css';

const CLAVE_EQUIPOS = 'r2-calendario-equipos';
const CLAVE_VISTA = 'r2-calendario-vista';

export default function VistaCalendario(p) {
  const {
    mesActual, setMesActual, cambiarMes, calendario, calendarioSiguienteMes, calendarioMesAnterior, distribucionEquipos, loading,
    ultimaActualizacion, horaActual, escala, escalaNormal, aumentarEscala, reducirEscala, aumentarEscalaNormal, reducirEscalaNormal,
    mostrarControles, proyectoSeleccionado, setProyectoSeleccionado, modoPantallaCompleta, togglePantallaCompleta, cargarCalendario,
    errorCarga,
  } = p;
  // Celular y tableta vertical (≤ 860 px): agenda; desde 861 px, la semana en 7 columnas
  const ancho = useAnchoR2();
  const celular = ancho === 'celular' || ancho === 'celular-ancho';
  // «Hoy» sigue al reloj de la página (la pantalla completa se queda prendida todo el día)
  const ahora = horaActual || new Date();
  const claveHoy = `${ahora.getFullYear()}-${ahora.getMonth()}-${ahora.getDate()}`;
  const hoy = useMemo(() => { const [y, m, d] = claveHoy.split('-').map(Number); return new Date(y, m, d); }, [claveHoy]);
  const [semanas, setSemanas] = useState(0); // semanas desde la de hoy (0 = la de hoy)
  const [vista, setVista] = useState(() => (leerPreferencia(CLAVE_VISTA, 'semana') === 'mes' ? 'mes' : 'semana'));
  const [equipo, setEquipo] = useState(() => {
    const v = leerPreferencia(CLAVE_EQUIPOS, []);
    return Array.isArray(v) && v[0] ? String(v[0]) : '';
  });
  const [verEquipos, setVerEquipos] = useState(false);
  const [verAnteriores, setVerAnteriores] = useState(false);

  // Los tres meses cargados, en un solo mapa de días (la semana que cruza de mes no se repite)
  const mapa = useMemo(() => armarDias({ actual: calendario, anterior: calendarioMesAnterior, siguiente: calendarioSiguienteMes, mesActual }),
    [calendario, calendarioMesAnterior, calendarioSiguienteMes, mesActual]);

  // Colores de cada equipo (identidad, de la hoja) y lista para el filtro
  const equiposHoja = useMemo(() => distribucionEquipos?.equipos || [], [distribucionEquipos]);
  const colorPorEquipo = useMemo(() => {
    const m = new Map();
    equiposHoja.forEach((e) => { const c = colorRgb(e.color); if (c) { m.set(String(e.tipoEquipo || '').toUpperCase(), c); m.set(String(e.nombre || '').toUpperCase(), c); } });
    return m;
  }, [equiposHoja]);
  const colorDeEquipo = (nombre) => colorPorEquipo.get(String(nombre || '').toUpperCase()) || null;
  const opcionesEquipo = useMemo(() => {
    const nombres = new Set(equiposHoja.map((e) => String(e.tipoEquipo || e.nombre || '').toUpperCase()).filter(Boolean));
    mapa.forEach((d) => d.proyectos.forEach((x) => { if (x.equipoHora && x.equipoHora !== 'FALLA') nombres.add(String(x.equipoHora).toUpperCase()); }));
    return [...nombres];
  }, [equiposHoja, mapa]);
  const filtro = equipo ? (x) => String(x.equipoHora || '').toUpperCase() === equipo : null;
  const elegirEquipo = (v) => { setEquipo(v); guardarPreferencia(CLAVE_EQUIPOS, v ? [v] : []); };

  // Rango visible: escritorio = la semana (lunes a domingo); celular = de hoy a 6 días después (agenda de obra)
  const inicio = celular ? sumarDias(hoy, semanas * 7) : sumarDias(lunesDe(hoy), semanas * 7);
  const fin = sumarDias(inicio, 6);
  const dias = diasDeRango(mapa, inicio, 7);
  const enHoy = semanas === 0;

  // Mover la semana usa el MISMO cambio de mes de la página cuando la semana es de otro mes (así se cargan sus datos)
  const mesDeRango = (desde) => sumarDias(desde, 3).getMonth();
  const seguirMes = (indice) => {
    const actual = MESES.indexOf(mesActual);
    if (indice === actual) return;
    if (indice === (actual + 1) % 12) cambiarMes(1);
    else if (indice === (actual + 11) % 12) cambiarMes(-1);
    else setMesActual(MESES[indice]);
  };
  const irSemana = (delta) => {
    const n = semanas + delta;
    setSemanas(n);
    setVerAnteriores(false);
    seguirMes(mesDeRango(celular ? sumarDias(hoy, n * 7) : sumarDias(lunesDe(hoy), n * 7)));
  };
  const irHoy = () => { setSemanas(0); setVerAnteriores(false); seguirMes(mesDeRango(celular ? hoy : lunesDe(hoy))); };
  const cambiarVista = (v) => {
    setVista(v);
    guardarPreferencia(CLAVE_VISTA, v);
    if (v === 'semana') {
      // Regresa a la semana del mes que se estaba viendo (o a la de hoy si es este mes)
      const iMes = MESES.indexOf(mesActual);
      if (iMes === hoy.getMonth()) { setSemanas(0); return; }
      const primero = new Date(hoy.getFullYear(), iMes, 1);
      const base = celular ? hoy : lunesDe(hoy);
      const destino = celular ? primero : lunesDe(primero);
      setSemanas(Math.round((destino - base) / (7 * 86400000)));
    }
  };

  const abrir = (proyecto, dia) => setProyectoSeleccionado({ proyecto, dia: dia.numero, mes: dia.mesTab || mesActual });

  const totalSemana = dias.reduce((n, d) => n + d.proyectos.filter((x) => (filtro ? filtro(x) : true)).length, 0);
  const fallas = dias.reduce((n, d) => n + d.proyectos.filter((x) => x.equipoHora === 'FALLA').length, 0);
  const datoEncabezado = loading && calendario ? 'Actualizando…' : ultimaActualizacion ? `datos de las ${horaCorta(ultimaActualizacion)}` : undefined;

  const masAcciones = [
    celular && { texto: vista === 'mes' ? 'Ver por semana' : 'Ver el mes completo', icono: vista === 'mes' ? CalendarDays : Rows3, alHacer: () => cambiarVista(vista === 'mes' ? 'semana' : 'mes') },
    { texto: 'Actualizar', icono: RefreshCw, alHacer: () => cargarCalendario(true) },
    { texto: 'Pantalla completa', icono: Maximize2, alHacer: togglePantallaCompleta },
    '-',
    { texto: `Letra más grande (${escalaNormal}%)`, icono: ZoomIn, alHacer: aumentarEscalaNormal, deshabilitado: escalaNormal >= 150, motivo: 'Ya está en el máximo' },
    { texto: 'Letra más chica', icono: ZoomOut, alHacer: reducirEscalaNormal, deshabilitado: escalaNormal <= 50, motivo: 'Ya está en el mínimo' },
  ];

  const modal = (
    <ProyectoVentasModal
      isOpen={!!proyectoSeleccionado}
      onClose={() => setProyectoSeleccionado(null)}
      proyecto={proyectoSeleccionado?.proyecto}
      mes={proyectoSeleccionado?.mes}
      dia={proyectoSeleccionado?.dia}
    />
  );

  // ───── Pantalla completa: la variante «de lejos» ─────
  if (modoPantallaCompleta) {
    return (
      <>
        <VistaCalendarioTv mapa={mapa} hoy={hoy} horaActual={horaActual} mesActual={mesActual} calendario={calendario}
          equipos={equiposHoja} colorDeEquipo={colorDeEquipo} escala={escala} aumentarEscala={aumentarEscala} reducirEscala={reducirEscala}
          mostrarControles={mostrarControles} togglePantallaCompleta={togglePantallaCompleta} alAbrir={abrir} />
        {modal}
      </>
    );
  }

  // ───── Barra de la semana (o del mes) ─────
  const etiquetaRango = vista === 'mes'
    ? nombreMes(mesActual)
    : celular ? textoRango(inicio, fin) : `Semana del ${textoRango(inicio, fin)}`;
  const navegar = (delta) => (vista === 'mes' ? cambiarMes(delta) : irSemana(delta));
  const deHoy = vista === 'mes' ? MESES.indexOf(mesActual) === hoy.getMonth() : enHoy;
  const barra = (
    <div className="r2g-cal-barra">
      <div className="r2g-cal-nav" role="group" aria-label={vista === 'mes' ? 'Cambiar de mes' : 'Cambiar de semana'}>
        <BotonIcono icono={ChevronLeft} etiqueta={vista === 'mes' ? 'Mes anterior' : 'Semana anterior'} alHacer={() => navegar(-1)} nivel="contorno" />
        <h2 className="r2g-cal-rango" aria-live="polite">{etiquetaRango}</h2>
        <BotonIcono icono={ChevronRight} etiqueta={vista === 'mes' ? 'Mes siguiente' : 'Semana siguiente'} alHacer={() => navegar(1)} nivel="contorno" />
        {!deHoy && <Boton nivel="tonal" tamano="chico" alHacer={() => (vista === 'mes' ? seguirMes(hoy.getMonth()) : irHoy())}>Hoy</Boton>}
      </div>
      {!celular && (
        <div className="r2g-cal-derecha">
          <FiltroMenu etiqueta="Equipo" valor={equipo} alCambiar={elegirEquipo}
            opciones={[{ valor: '', texto: 'Todos' }, ...opcionesEquipo.map((e) => ({ valor: e, texto: nombreEquipo(e) }))]} />
          <Segmentado etiqueta="Ver por" valor={vista} alCambiar={cambiarVista}
            opciones={[{ valor: 'semana', texto: 'Semana' }, { valor: 'mes', texto: 'Mes' }]} />
        </div>
      )}
    </div>
  );

  const chips = celular && opcionesEquipo.length > 0 && (
    <div className="r2g-chips" role="radiogroup" aria-label="Ver las obras de un equipo">
      {[{ valor: '', texto: 'Todos' }, ...opcionesEquipo.map((e) => ({ valor: e, texto: nombreEquipo(e) }))].map((o) => (
        <button key={o.valor || 'todos'} type="button" role="radio" aria-checked={equipo === o.valor}
          className={clases('r2-filtro r2-chip', equipo === o.valor && 'r2-filtro--puesto')} onClick={() => elegirEquipo(o.valor)}>
          {o.valor && <span className="r2g-punto" style={colorDeEquipo(o.valor) ? { background: colorDeEquipo(o.valor) } : undefined} aria-hidden="true" />}
          {o.texto}
        </button>
      ))}
    </div>
  );

  // ───── Cuerpo ─────
  let cuerpo;
  if (!calendario && loading) {
    cuerpo = celular ? <Cargando forma="lista" filas={6} etiqueta="Cargando el calendario…" /> : <EsqueletoSemana />;
  } else if (!calendario && errorCarga) {
    cuerpo = <ErrorCarga mensaje="No se pudo cargar el calendario." motivo={motivoError(errorCarga)} alReintentar={() => cargarCalendario(false)} />;
  } else if (!calendario) {
    cuerpo = <Vacio icono={CalendarDays} titulo="El calendario de este mes no tiene semanas" texto="Cuando se capturen las obras del mes en la hoja del CALENDARIO aparecerán aquí." />;
  } else if (vista === 'mes') {
    cuerpo = <AgendaMes mapa={mapa} mesActual={mesActual} hoy={hoy} filtro={filtro} abrir={abrir} colorDeEquipo={colorDeEquipo} equipo={equipo} quitarFiltro={() => elegirEquipo('')} />;
  } else if (celular) {
    // Agenda: de hoy en adelante arriba; los días ya pasados de la semana no aplican (el rango empieza hoy)
    const conObras = dias.filter((d) => d.proyectos.some((x) => (filtro ? filtro(x) : true)));
    cuerpo = (
      <>
        <SemanaCalendario variante="celular" dias={dias} hoy={hoy} alAbrir={abrir} colorDeEquipo={colorDeEquipo} filtro={filtro}
          textoVacio={equipo ? `Sin obras de ${nombreEquipo(equipo)}` : 'Sin obras'} etiqueta={`Obras del ${textoRango(inicio, fin)}`} />
        {equipo && conObras.length === 0 && (
          <Vacio sinResultados titulo={`${nombreEquipo(equipo)} no tiene obras del ${textoRango(inicio, fin)}`} alQuitar={() => elegirEquipo('')} compacto />
        )}
        {enHoy && (
          <div className="r2g-anteriores">
            {verAnteriores ? (
              <>
                <SemanaCalendario variante="celular" dias={diasDeRango(mapa, sumarDias(hoy, -7), 7)} hoy={hoy} alAbrir={abrir}
                  colorDeEquipo={colorDeEquipo} filtro={filtro} etiqueta="Obras de los 7 días anteriores" />
                <Boton nivel="fantasma" anchoCompleto alHacer={() => setVerAnteriores(false)}>Ocultar los días anteriores</Boton>
              </>
            ) : (
              <Boton nivel="fantasma" anchoCompleto alHacer={() => setVerAnteriores(true)}>Ver los 7 días anteriores</Boton>
            )}
          </div>
        )}
      </>
    );
  } else {
    cuerpo = (
      <div className="r2g-semana-marco" style={escalaNormal !== 100 ? { zoom: escalaNormal / 100 } : undefined}>
        <SemanaCalendario variante="oficina" dias={dias} hoy={hoy} alAbrir={abrir} colorDeEquipo={colorDeEquipo} filtro={filtro}
          textoVacio={equipo ? 'Sin obras de ese equipo' : 'Sin obras'} etiqueta={`Obras de la semana del ${textoRango(inicio, fin)}`} />
      </div>
    );
  }

  const resumen = calendario && vista === 'semana' ? (
    <p className="r2g-cal-resumen">
      {plural(totalSemana, 'obra', 'obras')}{equipo ? ` de ${nombreEquipo(equipo)}` : ''}{celular ? ' en estos 7 días' : ' esta semana'}
      {fallas > 0 && !equipo && <> · <span className="r2-tono--mal"><b>{plural(fallas, 'falla', 'fallas')}</b></span></>}
    </p>
  ) : null;

  return (
    <Pagina titulo="Calendario" densidad="comoda" className="r2g-pagina r2g-pagina-calendario">
      <EncabezadoPagina titulo="Calendario de instalaciones" dato={datoEncabezado}
        secundarias={[{ texto: `Equipos (${equiposHoja.length})`, icono: Users, alHacer: () => setVerEquipos(true), deshabilitado: !equiposHoja.length, motivo: 'La hoja del mes todavía no trae la distribución' }]}
        masAcciones={masAcciones} />
      {ultimaActualizacion && <span className="r2-solo-lectores">Datos de {fechaExacta(ultimaActualizacion)}</span>}
      {barra}
      {chips}
      {resumen}
      {cuerpo}

      <CajonEquipos abierto={verEquipos} alCerrar={() => setVerEquipos(false)} equipos={equiposHoja} mes={nombreMes(distribucionEquipos?.mes || mesActual)}
        colorDeEquipo={colorDeEquipo} equipoElegido={equipo} alElegir={(e) => { elegirEquipo(e); setVerEquipos(false); }} />
      {modal}
    </Pagina>
  );
}

// Esqueleto con la forma real: 7 columnas con bloques de obra
function EsqueletoSemana() {
  return (
    <div className="r2g-semana r2g-semana--esqueleto" role="status" aria-busy="true">
      <span className="r2-solo-lectores">Cargando el calendario…</span>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="r2g-dia">
          <div className="r2g-dia-cab"><span className="r2-hueso" style={{ width: '50%' }} /></div>
          {Array.from({ length: (i % 3) + 1 }, (_, j) => (
            <div key={j} className="r2g-esqueleto-obra">
              <span className="r2-hueso" style={{ width: '40%' }} />
              <span className="r2-hueso" style={{ width: '90%' }} />
              <span className="r2-hueso r2-hueso--tenue" style={{ width: '60%' }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Mes: agenda por día (solo los días con obras), una tabla con un grupo por día
function AgendaMes({ mapa, mesActual, hoy, filtro, abrir, colorDeEquipo, equipo, quitarFiltro }) {
  const iMes = MESES.indexOf(mesActual);
  const diasMes = diasDelMes(mapa, iMes);
  const grupos = diasMes.map((d) => {
    const filas = d.proyectos.filter((x) => (filtro ? filtro(x) : true))
      .map((x, i) => ({ ...x, _clave: `${d.clave}-${i}`, _dia: d }))
      .sort((a, b) => minutosDe(a.hora) - minutosDe(b.hora));
    const rel = relativoDia(d.fecha, hoy);
    const titulo = `${rel ? `${rel} · ` : ''}${diaLargo(d.fecha).replace(/^./, (c) => c.toUpperCase())}${d.asueto ? ' · asueto' : ''}`;
    return { id: d.clave, titulo, filas };
  });
  const total = grupos.reduce((n, g) => n + g.filas.length, 0);
  const columnas = [
    { id: 'hora', titulo: 'Hora', ancho: '80px', celda: (x) => <span className="r2g-num-fuerte">{x.hora || '—'}</span> },
    {
      id: 'obra', titulo: 'Obra',
      celda: (x) => (
        <span className="r2g-celda-doble">
          <span className="r2g-fuerte">{x.nombre}</span>
          {x.cliente && !mismoTexto(x.cliente, x.nombre) && <span className="r2g-sec">{x.cliente}</span>}
        </span>
      ),
    },
    {
      id: 'equipo', titulo: 'Equipo', ancho: '170px',
      celda: (x) => (x.equipoHora === 'FALLA' ? <span className="r2-tono--mal r2g-fuerte">Falla</span> : (
        <span className="r2g-equipo">
          <span className="r2g-punto" style={(colorDeEquipo(x.equipoHora) || colorRgb(x.colorHora)) ? { background: colorDeEquipo(x.equipoHora) || colorRgb(x.colorHora) } : undefined} aria-hidden="true" />
          {nombreEquipo(x.equipoHora)}
        </span>
      )),
    },
    { id: 'tipo', titulo: 'Tipo', ancho: '150px', ocultarEn: 'tableta', celda: (x) => (['MANTENIMIENTO', 'GARANTIA'].includes(String(x.tipoProyecto).toUpperCase()) ? <TipoTrabajo tipo={x.tipoProyecto} /> : <span className="r2g-sec">Instalación</span>) },
    { id: 'nota', titulo: 'Nota', ocultarEn: 'celular-ancho', celda: (x) => (x.nota ? <span className={clases('r2g-sec', x.equipoHora === 'FALLA' && 'r2-tono--mal')}>{x.nota}</span> : '') },
  ];
  return (
    <Tabla etiqueta={`Obras de ${nombreMes(mesActual).toLowerCase()}`} clave="_clave" columnas={columnas} grupos={grupos} densidad="compacta"
      alAbrir={(x) => abrir(x, x._dia)} etiquetaAbrir={(x) => `${x.nombre}: ver la carpeta de ventas`}
      filaCelular={(x) => ({
        principal: x.nombre,
        secundario: [x.hora, x.equipoHora === 'FALLA' ? `Falla${x.nota ? `: ${x.nota}` : ''}` : nombreEquipo(x.equipoHora), x.cliente && !mismoTexto(x.cliente, x.nombre) ? x.cliente : null].filter(Boolean).join(' · '),
        derecha: mismoDia(x._dia.fecha, hoy) ? 'Hoy' : null,
      })}
      vacio={total === 0 && equipo
        ? { sinResultados: true, titulo: `${nombreEquipo(equipo)} no tiene obras en ${nombreMes(mesActual).toLowerCase()}`, alQuitar: quitarFiltro }
        : { titulo: `No hay obras en ${nombreMes(mesActual).toLowerCase()}`, texto: 'Cuando se capturen en la hoja del CALENDARIO aparecerán aquí.' }} />
  );
}

// Distribución de equipos del mes (antes ocupaba la primera pantalla)
function CajonEquipos({ abierto, alCerrar, equipos, mes, colorDeEquipo, equipoElegido, alElegir }) {
  return (
    <Cajon abierto={abierto} alCerrar={alCerrar} etiqueta="Distribución de equipos">
      <CajonCabecera titulo="Distribución de equipos" dato={`${mes} · ${plural(equipos.length, 'equipo', 'equipos')}`} alCerrar={alCerrar} />
      <CajonCuerpo>
        {equipos.length === 0 ? (
          <Vacio icono={Users} titulo="Sin distribución este mes" texto="La hoja del CALENDARIO todavía no trae la tabla de equipos." compacto />
        ) : (
          <SeccionCajon>
            <ul className="r2g-equipos">
              {equipos.map((e, i) => {
                const clave = String(e.tipoEquipo || e.nombre || '').toUpperCase();
                const [responsable, ...resto] = e.integrantes || [];
                return (
                  <li key={`${clave}-${i}`} className="r2g-equipos-fila">
                    <div className="r2g-equipos-nombre">
                      <span className="r2g-equipo r2g-equipo--grande">
                        <span className="r2g-punto" style={colorDeEquipo(clave) ? { background: colorDeEquipo(clave) } : undefined} aria-hidden="true" />
                        {nombreEquipo(e.nombre)}
                      </span>
                      {responsable && <span className="r2g-sec">Responsable: <b className="r2g-fuerte">{oracionNombre(responsable)}</b></span>}
                      {resto.length > 0 && <span className="r2g-sec">{resto.map(oracionNombre).join(', ')}</span>}
                    </div>
                    <Boton nivel={equipoElegido === clave ? 'tonal' : 'fantasma'} tamano="chico" icono={equipoElegido === clave ? X : undefined}
                      alHacer={() => alElegir(equipoElegido === clave ? '' : clave)}>
                      {equipoElegido === clave ? 'Ver todos' : 'Ver sus obras'}
                    </Boton>
                  </li>
                );
              })}
            </ul>
          </SeccionCajon>
        )}
      </CajonCuerpo>
    </Cajon>
  );
}

// Nombres de personas de la hoja («TADEO RIVAS» → «Tadeo Rivas»)
const oracionNombre = (t) => String(t || '').toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
