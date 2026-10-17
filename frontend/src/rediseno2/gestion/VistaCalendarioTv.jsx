// Rediseño 2 · Gestión · Calendario en PANTALLA COMPLETA (el modo TV de /calendario), vista ENCENDIDA.
// Se ve de lejos en la oficina: tema oscuro por omisión (usarTemaPiso), letra de 22 px o más, la fecha y la hora en el
// encabezado, hoy y los 6 días siguientes; la semana siguiente es una segunda página que cambia sola cada 20 s; la
// distribución de equipos va al pie. La escala − / + y «Salir» son los manejadores de siempre (calendarioEscala) y solo se
// ven al mover el ratón (mostrarControles de la página). No pide nada.
import { Minimize2, Minus, Plus } from 'lucide-react';
import { useTemaPiso, usePaginasAuto, useHoraDeDatos } from '../fundacion/piso/usePiso';
import { HoraDeDatos, PaginasTv } from '../fundacion/piso/Tv';
import { clases } from '../fundacion/formato';
import SemanaCalendario from './SemanaCalendario';
import { diasDeRango, sumarDias, textoRango, diaCompleto } from './calendario';
import { nombreEquipo } from './comunes';
import './gestion.css';

const dosDigitos = (n) => String(n).padStart(2, '0');

export default function VistaCalendarioTv({
  mapa, hoy, horaActual, calendario, equipos = [], colorDeEquipo, escala = 100, aumentarEscala, reducirEscala, mostrarControles = true,
  togglePantallaCompleta, alAbrir, titulo = 'Calendario de instalaciones',
}) {
  const tema = useTemaPiso('tv');
  const datos = useHoraDeDatos(calendario);
  const semanas = [diasDeRango(mapa, hoy, 7), diasDeRango(mapa, sumarDias(hoy, 7), 7)];
  const pag = usePaginasAuto(semanas, 1, 20);
  const dias = pag.visibles[0] || semanas[0];
  const ahora = horaActual || new Date();
  const primera = pag.numero === 1;

  return (
    <div className={clases('r2-piso r2-tv r2g-tv', !mostrarControles && 'r2g-tv--sin-cursor')} data-tema={tema} style={{ '--r2-escala': escala / 100 }}>
      <div className="r2-tv-lienzo r2g-tv-lienzo">
        <header className="r2-tv-encabezado">
          <span className="g3-logo-marca r2-tv-marca" aria-hidden="true">3G</span>
          <h1 className="r2-tv-titulo">
            {titulo}
            <span className="r2-tv-dato">{primera ? 'hoy y los próximos 6 días' : `del ${textoRango(dias[0].fecha, dias[6].fecha)}`}</span>
          </h1>
          <p className="r2g-tv-reloj">
            <span className="r2g-tv-fecha">{diaCompleto(ahora)}</span>
            <time className="r2g-tv-hora" dateTime={ahora.toISOString()}>{`${ahora.getHours()}:${dosDigitos(ahora.getMinutes())}`}</time>
          </p>
        </header>
        <main className="r2-tv-cuerpo r2g-tv-cuerpo">
          <SemanaCalendario variante="tv" dias={dias} hoy={hoy} alAbrir={alAbrir} colorDeEquipo={colorDeEquipo}
            etiqueta={`Obras del ${textoRango(dias[0].fecha, dias[6].fecha)}`} />
        </main>
        <footer className="r2-tv-pie r2g-tv-pie">
          <ul className="r2g-tv-equipos" aria-label="Distribución de equipos">
            {equipos.map((e, i) => {
              const clave = String(e.tipoEquipo || e.nombre || '').toUpperCase();
              const color = colorDeEquipo?.(clave);
              return (
                <li key={`${clave}-${i}`} className="r2g-equipo">
                  <span className="r2g-punto" style={color ? { background: color } : undefined} aria-hidden="true" />
                  <b>{nombreEquipo(e.nombre)}</b>
                  {e.integrantes?.[0] && <span className="r2g-tv-responsable">{String(e.integrantes[0]).toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())}</span>}
                </li>
              );
            })}
          </ul>
          <span className="r2g-tv-pie-derecha">
            <PaginasTv {...pag} />
            <HoraDeDatos {...datos} />
          </span>
        </footer>
      </div>
      <div className={clases('r2g-tv-controles', !mostrarControles && 'r2g-tv-controles--ocultos')} aria-hidden={!mostrarControles}>
        <button type="button" onClick={togglePantallaCompleta} tabIndex={mostrarControles ? 0 : -1} className="r2g-tv-salir">
          <Minimize2 size={22} aria-hidden="true" /> Salir de pantalla completa
        </button>
        <span className="r2g-tv-control-grupo">
          <button type="button" onClick={reducirEscala} disabled={escala <= 30} aria-label="Reducir zoom" title="Reducir zoom" tabIndex={mostrarControles ? 0 : -1}><Minus size={22} aria-hidden="true" /></button>
          <span className="r2g-tv-control-dato" aria-live="polite">{escala}%</span>
          <button type="button" onClick={aumentarEscala} disabled={escala >= 150} aria-label="Aumentar zoom" title="Aumentar zoom" tabIndex={mostrarControles ? 0 : -1}><Plus size={22} aria-hidden="true" /></button>
        </span>
      </div>
    </div>
  );
}
