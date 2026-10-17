// VIEJO: se borra a partir del 24-oct-2026 — todo el archivo (diseño de TV de la ola 3): html[data-g3-tv] ya nunca se pone; las
// TV y la terminal llevan el rediseño 2 (rediseno2/fundacion/piso).
// Diseño 3G para TV — piezas comunes de las pantallas públicas (ola 3). Solo se montan con html[data-g3-tv]
// (useTvG3() de tvG3.js); apagado cada pantalla pinta lo de siempre. Ninguna pieza pide nada al servidor: los datos, los
// manejadores y la frecuencia de actualización son los de cada pantalla.
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

// Barra de título: cuadro 3G (o el ícono del área) + título + subtítulo + lo de la derecha (estado «En vivo», botones).
export function BarraTv({ titulo, subtitulo, icono: Icono, derecha }) {
  return (
    <header className="g3tv-barra">
      {Icono
        ? <span className="g3tv-area-ico" aria-hidden="true"><Icono /></span>
        : <span className="g3tv-marca" aria-hidden="true">3G</span>}
      <div className="g3tv-titulos">
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {derecha && <div className="g3tv-barra-der">{derecha}</div>}
    </header>
  );
}

// «En vivo»: dice cada cuánto se actualiza (el mismo intervalo de la pantalla).
export const VivoTv = ({ children }) => <span className="g3tv-vivo">{children}</span>;

// Zoom y giro: los mismos botones y manejadores de siempre (aparecen al mover el mouse, igual que hoy).
export function ControlesTv({ visibles, rotacion, zoom, onReducir, onAumentar, onRotar }) {
  return (
    <div className={`g3tv-controles${visibles ? '' : ' g3tv-controles--ocultos'}`}>
      <div className="g3tv-ctrl">
        <span title="Giro de la pantalla">{rotacion}°</span>
      </div>
      <div className="g3tv-ctrl">
        <button type="button" onClick={onReducir} title="Reducir escala" aria-label="Reducir escala"><ZoomOut size={22} aria-hidden="true" /></button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={onAumentar} title="Aumentar escala" aria-label="Aumentar escala"><ZoomIn size={22} aria-hidden="true" /></button>
      </div>
      <div className="g3tv-ctrl">
        <button type="button" onClick={onRotar} title="Girar 90°" aria-label="Girar 90°"><RotateCw size={22} aria-hidden="true" /></button>
      </div>
    </div>
  );
}

export const CargandoTv = ({ children = 'Cargando…' }) => <div className="g3tv-cargando" role="status">{children}</div>;
