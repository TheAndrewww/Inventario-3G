// Rediseño 2 · Calendario público (/calendario-publico), vista encendida (DISENO-v2 §5.7).
// TV de oficina vista de lejos todo el día: qué se instala hoy y los próximos días, y quién va.
//   · Encabezado de una línea: «Calendario de instalaciones», qué página se ve y, a la derecha, la fecha y la hora.
//   · Hoy y los 6 días siguientes en 7 columnas a tamaño de TV; la semana que sigue (y lo que quede de las tres semanas de
//     hoy) en páginas que cambian solas cada 20 s; los días de esta semana que ya pasaron, al final; los equipos, en su
//     propia página.
//   · Las obras de cada día por hora. Cada obra: hora, equipo con su NOMBRE y su color, obra, cliente (si es distinto) y
//     tipo; la falla dice «Falla».
//   · Controles escondidos (mes, actualizar, zoom, pantalla completa) que aparecen al mover el ratón. Con las flechas de mes
//     se ven las semanas de ESE mes («Viendo noviembre · …»); de regreso al mes de hoy, otra vez hoy y lo que sigue.
//   · En celular: agenda de un solo hilo (hoy arriba), sin páginas.
// Los datos, el sondeo de 2 minutos, el reloj, la escala guardada y los manejadores son los de la página: aquí solo se pinta.
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Minus, Plus, RefreshCw } from 'lucide-react';
import { AvisosFlotantes, HoraDeDatos, PaginasTv, TipoTrabajo, useEsCelular, usePaginasAuto, useTemaPiso } from '../fundacion';
import { BotonControl, ControlesPublicos, Equipo, EquiposTv, MarcoPublico, SemanaTv } from './PiezasPublicas';
import { usePantallaCompleta, useFactorPantalla } from './ganchos';
import { diasDeSemanas, equiposDe, indiceMesCargado, MES_LARGO, paginasDeDias, semanasDelMes, tresSemanas } from './calendarioDias';
import './publicas.css';

const ZONA = 'America/Mexico_City';
const TRES_MIN = 3 * 60 * 1000;
const primeraMayuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
// Junto al título va en minúscula, como el dato de las demás pantallas («hoy y los próximos 6 días»; revisión final)
const primeraMinuscula = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

function Reloj({ ahora, compacto = false }) {
  // Sin el año, como el reloj del calendario interno en pantalla completa («Viernes 16 de octubre»; revisión final)
  const fecha = ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA }).replace(/,/g, '');
  const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA });
  if (compacto) return <p className="r2-pub-movil-fecha"><span>{primeraMayuscula(fecha)}</span><time className="r2-pub-num">{hora}</time></p>;
  return (
    <p className="r2-pub-reloj">
      <span className="r2-pub-reloj-fecha">{primeraMayuscula(fecha)}</span>
      <time className="r2-pub-reloj-hora">{hora}</time>
    </p>
  );
}

function EsqueletoSemana() {
  return (
    <div className="r2-pub-semana" role="status" aria-busy="true">
      <span className="r2-solo-lectores">Cargando el calendario…</span>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="r2-pub-dia">
          <div className="r2-pub-dia-cab"><span className="r2-hueso r2-pub-hueso-dia" /><span className="r2-hueso r2-pub-hueso-fecha" /></div>
          <div className="r2-pub-obras">
            {Array.from({ length: [3, 2, 3, 1, 2, 3, 1][i] }, (_, j) => (
              <div key={j} className="r2-pub-obra">
                <span className="r2-hueso r2-pub-hueso-hora" />
                <span className="r2-hueso r2-pub-hueso-obra" style={{ width: `${[88, 72, 80][j]}%` }} />
                <span className="r2-hueso r2-pub-hueso-obra" style={{ width: `${[54, 62, 46][j]}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorCalendario({ alReintentar, cargando, movil = false }) {
  return (
    <div className={movil ? 'r2-pub-estado-movil' : 'r2-pub-estado-tv'} role="alert">
      <p className="r2-pub-estado-titulo">No se pudo cargar el calendario</p>
      <p className="r2-pub-estado-texto">La pantalla lo vuelve a intentar sola cada 2 minutos.</p>
      <BotonControl icono={RefreshCw} texto={cargando ? 'Reintentando…' : 'Reintentar'} alHacer={alReintentar} deshabilitado={cargando} girando={cargando} nivel="principal" />
    </div>
  );
}

function AgendaMovil({ dias, equipos }) {
  const futuros = dias.filter((d) => !d.pasado);
  const pasados = dias.filter((d) => d.pasado);
  const pintarDia = (d) => (
    <section key={d.clave} className={`r2-pub-agenda-dia${d.esHoy ? ' r2-pub-agenda-dia--hoy' : ''}`}>
      <h2 className="r2-pub-agenda-titulo">
        <span>{d.esHoy ? `Hoy · ${d.nombreDia.toLowerCase()}` : d.nombreDia} {d.fecha}</span>
        {d.esAsueto && <span className="r2-pub-asueto">Asueto</span>}
      </h2>
      {d.obras.length === 0 ? (
        <p className="r2-pub-agenda-vacio">{d.esAsueto ? 'Día de asueto' : 'Sin obras'}</p>
      ) : (
        <ul className="r2-pub-agenda-obras">
          {d.obras.map((o, i) => (
            <li key={`${i}-${o.nombre}`} className="r2-pub-agenda-obra">
              <span className="r2-pub-agenda-hora">{o.hora || '—'}</span>
              <span className="r2-pub-agenda-cuerpo">
                <span className="r2-pub-agenda-nombre">{o.nombre}</span>
                {o.cliente && <span className="r2-pub-agenda-cliente">{o.cliente}</span>}
                {(o.equipo || o.falla || o.tipo) && (
                  <span className="r2-pub-agenda-meta">
                    <Equipo nombre={o.equipo} color={o.color} falla={o.falla} />
                    {o.tipo && <TipoTrabajo tipo={o.tipo} />}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <>
      {futuros.map(pintarDia)}
      {pasados.length > 0 && (
        <>
          <p className="r2-pub-agenda-separador">Ya pasaron esta semana</p>
          {pasados.map(pintarDia)}
        </>
      )}
      {equipos.length > 0 && (
        <section className="r2-pub-agenda-dia">
          <h2 className="r2-pub-agenda-titulo"><span>Equipos</span></h2>
          <EquiposTv equipos={equipos} />
        </section>
      )}
    </>
  );
}

export default function VistaCalendarioPublico({
  meses, mesActual, calendario, calendarioSiguienteMes, calendarioMesAnterior, distribucionEquipos, loading,
  ultimaActualizacion, horaActual, escala, mostrarControles,
  cargarCalendario, cambiarMes, aumentarEscala, reducirEscala, togglePantallaCompleta,
}) {
  const tema = useTemaPiso('tv');
  const esCelular = useEsCelular();
  const factor = useFactorPantalla();
  const pantallaCompleta = usePantallaCompleta();

  const equiposCrudos = distribucionEquipos?.equipos || [];
  // Mes de hoy: hoy y lo que sigue (el cálculo de la pantalla de hoy). Otro mes (flechas): las semanas de ese mes.
  const iMesVisto = indiceMesCargado({ meses, mesActual, calendario });
  const otroMes = iMesVisto !== horaActual.getMonth();
  const semanas = otroMes
    ? semanasDelMes({ meses, indiceMes: iMesVisto, calendario })
    : tresSemanas({ meses, mesActual, calendario, calendarioSiguienteMes, calendarioMesAnterior, hoy: horaActual });
  const dias = calendario ? diasDeSemanas(semanas, equiposCrudos) : [];
  const equipos = equiposDe(distribucionEquipos);
  const paginas = [
    ...paginasDeDias(dias),
    ...(equipos.length ? [{ id: 'equipos', tipo: 'equipos', titulo: 'Equipos y quién va en cada uno' }] : []),
  ];
  const pag = usePaginasAuto(paginas, 1, 20);
  const pagina = pag.visibles[0];
  const siguiente = pag.total > 1 ? paginas[pag.numero % pag.total] : null;

  const mesNombre = MES_LARGO[meses.indexOf(mesActual)] || String(mesActual || '').toLowerCase();
  const mesVisto = MES_LARGO[iMesVisto] || mesNombre;
  const viejo = Boolean(ultimaActualizacion) && horaActual - ultimaActualizacion > TRES_MIN;
  const estado = calendario ? 'listo' : loading ? 'cargando' : 'error';

  const controlesMes = (movil) => (
    <>
      <span className="r2-pub-control-grupo">
        <BotonControl icono={ChevronLeft} texto="Mes anterior" soloIcono alHacer={() => cambiarMes(-1)} />
        <span className="r2-pub-control-dato r2-pub-control-mes" aria-live="polite">{primeraMayuscula(mesNombre)}</span>
        <BotonControl icono={ChevronRight} texto="Mes siguiente" soloIcono alHacer={() => cambiarMes(1)} />
      </span>
      <BotonControl icono={RefreshCw} texto={loading ? 'Actualizando…' : 'Actualizar'} alHacer={() => cargarCalendario(true)} deshabilitado={loading} girando={loading} soloIcono={movil} />
    </>
  );
  const controlesPantalla = (movil) => (
    <>
      <span className="r2-pub-control-grupo">
        <BotonControl icono={Minus} texto="Reducir zoom" soloIcono alHacer={reducirEscala} deshabilitado={escala <= 30} />
        <span className="r2-pub-control-dato" aria-live="polite" title="Zoom">{escala}%</span>
        <BotonControl icono={Plus} texto="Aumentar zoom" soloIcono alHacer={aumentarEscala} deshabilitado={escala >= 150} />
      </span>
      <BotonControl
        icono={pantallaCompleta ? Minimize2 : Maximize2}
        texto={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
        alHacer={togglePantallaCompleta}
        soloIcono={movil}
      />
    </>
  );

  if (esCelular) {
    const ordenados = paginasDeDias(dias, Number.POSITIVE_INFINITY)[0]?.dias || [];
    return (
      <div className="r2-piso r2-pub-movil" data-tema={tema} style={{ '--r2-escala': escala / 100 }}>
        <AvisosFlotantes />
        <header className="r2-pub-movil-cab">
          <h1 className="r2-pub-movil-titulo">Calendario de instalaciones</h1>
          <Reloj ahora={horaActual} compacto />
          <div className="r2-pub-movil-controles" role="toolbar" aria-label="Mes del calendario">{controlesMes(true)}</div>
          {otroMes && calendario && <p className="r2-pub-movil-aviso">Viendo {mesVisto}</p>}
        </header>
        <main className="r2-pub-movil-cuerpo">
          {estado === 'cargando' && (
            <div className="r2-pub-estado-movil" role="status" aria-busy="true">
              <span className="r2-hueso r2-pub-hueso-movil" /><span className="r2-hueso r2-pub-hueso-movil" /><span className="r2-hueso r2-pub-hueso-movil" />
              <span className="r2-solo-lectores">Cargando el calendario…</span>
            </div>
          )}
          {estado === 'error' && <ErrorCalendario alReintentar={() => cargarCalendario(true)} cargando={loading} movil />}
          {estado === 'listo' && <AgendaMovil dias={ordenados} equipos={equipos} />}
        </main>
        <footer className="r2-pub-movil-pie">
          {(ultimaActualizacion || loading) && <HoraDeDatos hora={ultimaActualizacion} viejo={viejo} />}
          <div className="r2-pub-movil-controles" role="toolbar" aria-label="Tamaño y pantalla completa">{controlesPantalla(true)}</div>
        </footer>
      </div>
    );
  }

  const dato = estado === 'listo' && pagina ? `${otroMes ? `viendo ${mesVisto} · ` : ''}${primeraMinuscula(pagina.titulo)}` : null;
  return (
    <>
      <AvisosFlotantes />
      <MarcoPublico
        tema={tema}
        escala={(escala / 100) * factor}
        titulo="Calendario de instalaciones"
        dato={dato}
        derecha={<Reloj ahora={horaActual} />}
        sinCursor={!mostrarControles}
        pie={estado === 'listo' ? (
          <>
            <HoraDeDatos hora={ultimaActualizacion} viejo={viejo} />
            {siguiente && <span className="r2-pub-sigue">Sigue: {siguiente.titulo}</span>}
            <PaginasTv numero={pag.numero} total={pag.total} segundos={pag.segundos} />
          </>
        ) : null}
      >
        {estado === 'cargando' && <EsqueletoSemana />}
        {estado === 'error' && <ErrorCalendario alReintentar={() => cargarCalendario(true)} cargando={loading} />}
        {estado === 'listo' && pagina?.tipo === 'dias' && <SemanaTv key={pagina.id} dias={pagina.dias} escala={Math.round(escala * factor)} />}
        {estado === 'listo' && pagina?.tipo === 'equipos' && <EquiposTv equipos={equipos} />}
        {estado === 'listo' && !pagina && <p className="r2-tv-vacio">El calendario de {mesVisto} todavía no tiene semanas capturadas.</p>}
      </MarcoPublico>
      <ControlesPublicos visibles={mostrarControles} etiqueta="Controles del calendario">{controlesMes(false)}{controlesPantalla(false)}</ControlesPublicos>
    </>
  );
}
