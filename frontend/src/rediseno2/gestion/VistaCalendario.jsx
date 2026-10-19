// Rediseño 2 · Gestión · Calendario de instalaciones (/calendario), vista ENCENDIDA.
// Quién: encargados (es su inicio, desde el celular en obra): qué instalo hoy y mañana, a qué hora y con quién. Diseño,
// ventas, almacén y Dirección: qué sale esta semana y qué falló.
// Antes: la primera pantalla era la distribución de equipos y un reloj; hoy quedaba a 1.7 pantallas (4 en celular) y cada
// obra era una columna de 40 px partida letra por letra. Ahora: la semana de hoy a todo lo ancho (escritorio) o la agenda
// de hoy en adelante (celular), equipo con su NOMBRE, la falla con su motivo y la distribución en un cajón.
// Todo sale de CalendarioPage: los tres meses que ya carga, el cambio de mes (cambiarMes / setMesActual), el sondeo de 2 min,
// la escala guardada y la pantalla completa. Esta vista no pide nada.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { rolPuedeVer } from '../../components/layout/Sidebar';
import { ChevronLeft, ChevronRight, Users, RefreshCw, Maximize2, ZoomIn, ZoomOut, CalendarDays, Rows3 } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, Boton, BotonIcono, Segmentado, FiltroMenu, Tabla,
  Cargando, ErrorCarga, Vacio, TipoTrabajo, useAnchoR2, horaCorta, fechaExacta, plural, clases,
} from '../fundacion';
import ProyectoVentasModal from '../../components/calendario/ProyectoVentasModal';
import SemanaCalendario from './SemanaCalendario';
import VistaCalendarioTv from './VistaCalendarioTv';
import {
  MESES, armarDias, diasDeRango, diasDelMes, lunesDe, sumarDias, textoRango, nombreMes, diaLargo, relativoDia, minutosDe, mismoDia,
} from './calendario';
import { colorRgb, nombreEquipo, mismoTexto, leerPreferencia, guardarPreferencia, motivoError } from './comunes';
import { juntarTaller, esCampo, esTaller, colorTaller } from './tallerCalendario';
import { useTallerCalendario } from './useTallerCalendario';
import './gestion.css';

const CLAVE_EQUIPOS = 'r2-calendario-equipos';
const CLAVE_VISTA = 'r2-calendario-vista';
const CLAVE_GRUPO = 'r2-calendario-grupo';

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
  // Campo (equipos I–V: instalaciones, mantenimientos y garantías) o Taller (manufactura, herrería y almacén)
  const [grupo, setGrupo] = useState(() => (['campo', 'taller'].includes(leerPreferencia(CLAVE_GRUPO, 'todo')) ? leerPreferencia(CLAVE_GRUPO, 'todo') : 'todo'));
  const elegirGrupo = (v) => { setGrupo(v); guardarPreferencia(CLAVE_GRUPO, v); };
  const [verAnteriores, setVerAnteriores] = useState(false);

  // Los tres meses cargados, en un solo mapa de días (la semana que cruza de mes no se repite), más el taller:
  // entregas de manufactura, soldadura y pintura del panel de producción y los pedidos por llegar (tallerCalendario.js)
  const mapaHoja = useMemo(() => armarDias({ actual: calendario, anterior: calendarioMesAnterior, siguiente: calendarioSiguienteMes, mesActual }),
    [calendario, calendarioMesAnterior, calendarioSiguienteMes, mesActual]);
  const taller = useTallerCalendario();
  // Un pedido de almacén abre su orden de compra; quien no ve Órdenes de Compra no tiene a dónde ir
  const { user } = useAuth();
  const irA = useNavigate();
  const verOrdenes = rolPuedeVer(user?.rol, '/ordenes-compra');
  const mapa = useMemo(() => juntarTaller(mapaHoja, verOrdenes ? taller
    : taller.map((t) => (t.proyecto.origen === 'compras' ? { ...t, proyecto: { ...t.proyecto, sinAbrir: true } } : t))),
  [mapaHoja, taller, verOrdenes]);

  // Colores de cada equipo (identidad, de la hoja) y lista para el filtro
  const equiposHoja = useMemo(() => distribucionEquipos?.equipos || [], [distribucionEquipos]);
  const colorPorEquipo = useMemo(() => {
    const m = new Map();
    equiposHoja.forEach((e) => { const c = colorRgb(e.color); if (c) { m.set(String(e.tipoEquipo || '').toUpperCase(), c); m.set(String(e.nombre || '').toUpperCase(), c); } });
    return m;
  }, [equiposHoja]);
  const colorDeEquipo = (nombre) => {
    const n = String(nombre || '').toUpperCase();
    // PINTURA viene en blanco en la hoja y SOLDADURA no existe: color fijo para que se vea la barra
    if (n === 'PINTURA' || n === 'SOLDADURA') return colorTaller(n);
    return colorPorEquipo.get(n) || colorTaller(n) || null;
  };
  const opcionesEquipo = useMemo(() => {
    const nombres = new Set(equiposHoja.map((e) => String(e.tipoEquipo || e.nombre || '').toUpperCase()).filter(Boolean));
    mapa.forEach((d) => d.proyectos.forEach((x) => { if (x.equipoHora && x.equipoHora !== 'FALLA') nombres.add(String(x.equipoHora).toUpperCase()); }));
    return [...nombres];
  }, [equiposHoja, mapa]);
  // En celular no hay selector de trabajo: se ve todo
  const grupoVisto = celular ? 'todo' : grupo;
  const deGrupo = (x) => {
    if (grupoVisto === 'todo') return true;
    const e = String(x.equipoHora || '').toUpperCase();
    // La falla sin equipo es de campo (la visita que no se hizo)
    return grupoVisto === 'campo' ? (esCampo(e) || e === 'FALLA' || (!e && !x.virtual)) : esTaller(e);
  };
  const filtro = equipo || grupoVisto !== 'todo' ? (x) => (!equipo || String(x.equipoHora || '').toUpperCase() === equipo) && deGrupo(x) : null;
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

  // Del mes a la semana de ese día (al tocar el número del día o «N más»)
  const verSemanaDe = (fecha) => {
    setVista('semana');
    guardarPreferencia(CLAVE_VISTA, 'semana');
    setVerAnteriores(false);
    setSemanas(Math.round((lunesDe(fecha) - lunesDe(hoy)) / (7 * 86400000)));
  };

  // Obra de la hoja o entrega de taller (manufactura, soldadura, pintura): ventas y producción del proyecto.
  // Pedido de almacén: su orden de compra.
  const abrir = (proyecto, dia) => {
    if (!proyecto || proyecto.sinAbrir) return;
    if (proyecto.origen === 'compras') { irA(`/ordenes-compra?orden=${encodeURIComponent(proyecto.folio)}`); return; }
    setProyectoSeleccionado({ proyecto, dia: dia.numero, mes: dia.mesTab || mesActual });
  };

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
          <Segmentado etiqueta="Trabajo" valor={grupo} alCambiar={elegirGrupo}
            opciones={[{ valor: 'todo', texto: 'Todo' }, { valor: 'campo', texto: 'Instalaciones' }, { valor: 'taller', texto: 'Taller' }]} />
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
  } else if (vista === 'mes' && !celular) {
    cuerpo = (
      <div className="r2g-semana-marco" style={escalaNormal !== 100 ? { zoom: escalaNormal / 100 } : undefined}>
        <MesCalendario mapa={mapa} mesActual={mesActual} hoy={hoy} filtro={filtro} abrir={abrir} colorDeEquipo={colorDeEquipo} alVerSemana={verSemanaDe} />
      </div>
    );
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
      <EncabezadoPagina titulo="Calendario" dato={datoEncabezado} masAcciones={masAcciones} />
      {ultimaActualizacion && <span className="r2-solo-lectores">Datos de {fechaExacta(ultimaActualizacion)}</span>}
      <DistribucionEquipos equipos={equiposHoja} mes={nombreMes(distribucionEquipos?.mes || mesActual)} colorDeEquipo={colorDeEquipo}
        equipoElegido={equipo} alElegir={(e) => elegirEquipo(equipo === e ? '' : e)} />
      {barra}
      {chips}
      {resumen}
      {cuerpo}

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

// Mes en escritorio: cuadrícula de calendario (lunes a domingo), cada obra como un evento con el color de su equipo
const MES_CABEN = 4;
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function MesCalendario({ mapa, mesActual, hoy, filtro, abrir, colorDeEquipo, alVerSemana }) {
  const iMes = MESES.indexOf(mesActual);
  // Año del mes que se ve: el de hoy, salvo diciembre ↔ enero
  const anio = hoy.getFullYear() + (hoy.getMonth() === 11 && iMes === 0 ? 1 : hoy.getMonth() === 0 && iMes === 11 ? -1 : 0);
  const primero = new Date(anio, iMes, 1);
  const inicio = lunesDe(primero);
  const ultimo = new Date(anio, iMes + 1, 0);
  const semanas = Math.ceil((Math.round((ultimo - inicio) / 86400000) + 1) / 7);
  const dias = diasDeRango(mapa, inicio, semanas * 7);
  return (
    <div className="r2g-mes" role="grid" aria-label={`Calendario de ${nombreMes(mesActual).toLowerCase()}`}>
      <div className="r2g-mes-cab" role="row">
        {DIAS_SEMANA.map((n) => <div key={n} role="columnheader" className="r2g-mes-cab-dia">{n}</div>)}
      </div>
      <div className="r2g-mes-cuerpo" style={{ gridTemplateRows: `repeat(${semanas}, minmax(132px, 1fr))` }}>
        {dias.map((d) => {
          const fuera = d.fecha.getMonth() !== iMes;
          const esHoy = mismoDia(d.fecha, hoy);
          const obras = d.proyectos.filter((x) => (filtro ? filtro(x) : true)).sort((a, b) => minutosDe(a.hora) - minutosDe(b.hora));
          const vistas = obras.length > MES_CABEN ? obras.slice(0, MES_CABEN - 1) : obras;
          const sobran = obras.length - vistas.length;
          return (
            <div key={d.clave} role="gridcell" className={clases('r2g-mes-dia', fuera && 'r2g-mes-dia--fuera', esHoy && 'r2g-mes-dia--hoy', d.asueto && 'r2g-mes-dia--asueto', [0, 6].includes(d.fecha.getDay()) && 'r2g-mes-dia--finde')}
              aria-label={`${diaLargo(d.fecha)}${esHoy ? ', hoy' : ''}: ${plural(obras.length, 'obra', 'obras')}`}>
              <div className="r2g-mes-dia-cab">
                <button type="button" className="r2g-mes-num" onClick={() => alVerSemana(d.fecha)} title="Ver esta semana">{d.fecha.getDate()}</button>
                {d.asueto && <span className="r2g-asueto">Asueto</span>}
              </div>
              <ul className="r2g-mes-obras">
                {vistas.map((x, i) => {
                  const falla = x.equipoHora === 'FALLA';
                  const color = !falla && (colorDeEquipo(x.equipoHora) || colorRgb(x.colorHora));
                  const ComoEvento = x.sinAbrir ? 'div' : 'button';
                  return (
                    <li key={`${d.clave}-${i}`}>
                      <ComoEvento type={x.sinAbrir ? undefined : 'button'} className={clases('r2g-evento', falla && 'r2g-evento--falla', x.sinAbrir && 'r2g-evento--taller')} style={color ? { '--r2g-color': color } : undefined}
                        onClick={x.sinAbrir ? undefined : () => abrir(x, d)} title={[x.hora, x.nombre, x.etiqueta, falla ? `Falla${x.nota ? `: ${x.nota}` : ''}` : nombreEquipo(x.equipoHora)].filter(Boolean).join(' · ')}>
                        {x.hora && <span className="r2g-evento-hora">{x.hora}</span>}
                        {x.virtual && <span className="r2g-evento-area">{nombreEquipo(x.equipoHora)}</span>}
                        <span className="r2g-evento-nombre">{x.nombre}</span>
                      </ComoEvento>
                    </li>
                  );
                })}
              </ul>
              {sobran > 0 && <button type="button" className="r2g-mes-mas" onClick={() => alVerSemana(d.fecha)}>{sobran === 1 ? '1 más' : `${sobran} más`}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Mes en celular: agenda por día (solo los días con obras), una tabla con un grupo por día
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

// Distribución de equipos del mes, siempre visible arriba (a pedido del usuario, 19-oct-2026). Tocar un equipo filtra sus obras.
function DistribucionEquipos({ equipos, mes, colorDeEquipo, equipoElegido, alElegir }) {
  if (!equipos.length) return null;
  return (
    <section className="r2g-distribucion" aria-label={`Distribución de equipos de ${mes.toLowerCase()}`}>
      <h2 className="r2g-distribucion-titulo"><Users size={16} aria-hidden="true" />Distribución de equipos · {mes}</h2>
      <ul className="r2g-distribucion-lista">
        {equipos.map((e, i) => {
          const clave = String(e.tipoEquipo || e.nombre || '').toUpperCase();
          const [responsable, ...resto] = e.integrantes || [];
          const puesto = equipoElegido === clave;
          return (
            <li key={`${clave}-${i}`}>
              <button type="button" className={clases('r2g-distribucion-equipo', puesto && 'r2g-distribucion-equipo--puesto')}
                style={colorDeEquipo(clave) ? { '--r2g-color': colorDeEquipo(clave) } : undefined}
                onClick={() => alElegir(clave)} aria-pressed={puesto} title={puesto ? 'Ver todos los equipos' : 'Ver solo las obras de este equipo'}>
                <span className="r2g-distribucion-nombre">{nombreEquipo(e.nombre)}</span>
                {responsable && <span className="r2g-distribucion-resp">{oracionNombre(responsable)}</span>}
                {resto.length > 0 && <span className="r2g-distribucion-gente">{resto.map(oracionNombre).join(', ')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Nombres de personas de la hoja («TADEO RIVAS» → «Tadeo Rivas»)
const oracionNombre = (t) => String(t || '').toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
