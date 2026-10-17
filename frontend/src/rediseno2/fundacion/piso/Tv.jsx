// Rediseño 2 · piezas de TV (DISENO-v2 §3.6 y §4.16). Pantallas de 40–55" vistas de 3 a 6 m, sin tocar: letra grande
// (mínimo 22 px), fondo oscuro por omisión, nada interactivo a la vista y páginas que cambian solas. Mismos datos y la misma
// frecuencia de la página; la escala (− / +) y el giro son los manejadores de siempre (mismas claves guardadas).
//
// const tema = useTemaPiso('tv');
// const hora = useHoraDeDatos(proyectos);
// const pag = usePaginasAuto(activos, 8, 20);
// <MarcoTv titulo="Panel de producción" tema={tema} hora={hora} escala={zoomLevel} rotacion={rotacion}
//   cifras={[{ valor: 5, texto: 'en diseño' }, { valor: 1, texto: 'pausada', tono: 'neutro' }]}
//   controles={{ visibles: controlsVisible, alReducir: handleZoomOut, alAumentar: handleZoomIn, alRotar: rotar }}
//   pie={<><span>Pausadas: COLEGIO MONTESSORI</span><PaginasTv {...pag} /></>}>
//   <TablaTv clave="id" filas={pag.visibles} columnas={[
//     { id: 'obra', titulo: 'Obra', ancho: '2.2fr', celda: (p) => <ObraTv nombre={p.nombre} detalle={`${p.cliente} · Tipo B`} /> },
//     { id: 'diseno', titulo: 'Diseño', celda: (p) => <CeldaTv texto="Lista" tono="ok" fecha="3 oct" /> },
//     { id: 'plazo', titulo: 'Fecha máxima', alinear: 'der', celda: (p) => <CeldaTv texto="3 días tarde" tono="mal" fecha="vencía 15 oct" /> },
//   ]} vacio="No hay obras en producción" />
// </MarcoTv>
//
// MarcoTv: titulo, area ({nombre, color}: punto de color del área), dato («18 obras»), cifras [{valor, texto, tono}], hora
// ({hora, viejo} de useHoraDeDatos), escala, rotacion (0/90/180/270, misma cuenta de giro de hoy), controles {visibles,
// alReducir, alAumentar, alRotar}, pie (nodo del pie de 72 px), tema, cargando (esqueleto de 8 renglones).
// TablaTv: columnas [{id, titulo, ancho ('1fr' | '320px'), alinear ('izq'|'der'|'centro'), celda(fila)}], filas, clave,
// grupos [{id, titulo, filas}] (Atrasadas → Esta semana → Después), vacio. Renglón de 104 px.
// CeldaTv: texto (palabra de estado, 28 px), tono, fecha (24 px debajo). ObraTv: nombre (40 px), detalle (26 px).
// PaginasTv: numero, total, segundos → «Página 1 de 3» y la línea de avance.
import { Minus, Plus, RotateCw } from 'lucide-react';
import { horaCorta, numero as fmtNumero, clases } from '../formato';

export function HoraDeDatos({ hora, viejo, className }) {
  if (!hora) return <span className={clases('r2-hora-datos', className)}>Cargando datos…</span>;
  return (
    <span className={clases('r2-hora-datos', viejo && 'r2-hora-datos--vieja', className)} role="status">
      {viejo ? `Sin datos nuevos desde ${horaCorta(hora)}` : `Datos de las ${horaCorta(hora)}`}
    </span>
  );
}

export function ControlesTv({ visibles, escala = 1, rotacion = 0, alReducir, alAumentar, alRotar }) {
  return (
    <div className={clases('r2-tv-controles', !visibles && 'r2-tv-controles--ocultos')} aria-hidden={!visibles}>
      <span className="r2-tv-control-dato" title="Giro de la pantalla">{rotacion}°</span>
      <span className="r2-tv-control-grupo">
        <button type="button" onClick={alReducir} aria-label="Reducir escala" title="Reducir escala" tabIndex={visibles ? 0 : -1}><Minus size={22} aria-hidden="true" /></button>
        <span className="r2-tv-control-dato" aria-live="polite">{Math.round(escala * 100)}%</span>
        <button type="button" onClick={alAumentar} aria-label="Aumentar escala" title="Aumentar escala" tabIndex={visibles ? 0 : -1}><Plus size={22} aria-hidden="true" /></button>
      </span>
      <button type="button" onClick={alRotar} aria-label="Girar 90°" title="Girar 90°" tabIndex={visibles ? 0 : -1}><RotateCw size={22} aria-hidden="true" /></button>
    </div>
  );
}

// El mismo cálculo de giro que usan hoy las pantallas de TV (getRotationStyle)
const estiloGiro = (rotacion) => {
  const vertical = rotacion === 90 || rotacion === 270;
  return {
    transform: rotacion === 0 ? 'none' : `rotate(${rotacion}deg)`,
    width: vertical ? '100vh' : '100vw',
    height: vertical ? '100vw' : '100vh',
    position: 'absolute',
    top: vertical ? 'calc(50% - 50vw)' : 0,
    left: vertical ? 'calc(50% - 50vh)' : 0,
  };
};

export function MarcoTv({ titulo, area, dato, cifras = [], hora, escala = 1, rotacion = 0, controles, pie, tema = 'oscuro', cargando = false, children, className }) {
  return (
    <div className={clases('r2-piso r2-tv', className)} data-tema={tema} style={{ '--r2-escala': escala }}>
      <div className="r2-tv-lienzo" style={estiloGiro(rotacion)}>
        <header className="r2-tv-encabezado">
          {area ? <span className="r2-piso-punto" style={{ background: area.color }} aria-hidden="true" /> : <span className="g3-logo-marca r2-tv-marca" aria-hidden="true">3G</span>}
          <h1 className="r2-tv-titulo">{titulo}{dato && <span className="r2-tv-dato">{dato}</span>}</h1>
          {cifras.length > 0 && (
            <p className="r2-tv-cifras">
              {cifras.filter(Boolean).map((c, i) => (
                <span key={c.texto} className={clases('r2-tv-cifra', c.tono && `r2-tono--${c.tono}`)}>
                  {i > 0 && <span className="r2-tv-sep" aria-hidden="true">·</span>}
                  <b>{typeof c.valor === 'number' ? fmtNumero(c.valor) : c.valor}</b> {c.texto}
                </span>
              ))}
            </p>
          )}
          {hora && <HoraDeDatos {...hora} />}
        </header>
        <main className="r2-tv-cuerpo">
          {cargando ? <EsqueletoTv /> : children}
        </main>
        {pie && <footer className="r2-tv-pie">{pie}</footer>}
      </div>
      {controles && <ControlesTv {...controles} escala={escala} rotacion={rotacion} />}
    </div>
  );
}

function EsqueletoTv() {
  return (
    <div className="r2-tv-esqueleto" role="status" aria-busy="true">
      <span className="r2-solo-lectores">Cargando…</span>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="r2-tv-esqueleto-fila">
          <span className="r2-hueso" style={{ width: `${[52, 40, 61, 47, 56, 44, 58, 38][i]}%` }} />
          <span className="r2-hueso r2-hueso--tenue" style={{ width: '22%' }} />
        </div>
      ))}
    </div>
  );
}

export function ObraTv({ nombre, detalle }) {
  return (
    <span className="r2-tv-obra">
      <span className="r2-tv-obra-nombre">{nombre}</span>
      {detalle && <span className="r2-tv-obra-detalle">{detalle}</span>}
    </span>
  );
}

export function CeldaTv({ texto, tono, fecha, grande = false }) {
  return (
    <span className={clases('r2-tv-celda', tono && `r2-tono--${tono}`, grande && 'r2-tv-celda--grande')}>
      <span className="r2-tv-celda-texto">{tono && tono !== 'neutro' && <span className="r2-estado-punto" aria-hidden="true" />}{texto}</span>
      {fecha && <span className="r2-tv-celda-fecha">{fecha}</span>}
    </span>
  );
}

export function TablaTv({ columnas = [], filas = [], grupos, clave = 'id', vacio = 'No hay obras', className }) {
  const lista = grupos ? grupos.filter((g) => g.filas?.length) : [{ id: '_', filas }];
  const plantilla = columnas.map((c) => c.ancho || '1fr').join(' ');
  const total = lista.reduce((n, g) => n + g.filas.length, 0);
  return (
    <div className={clases('r2-tv-tabla', className)} role="table" style={{ '--r2-tv-cols': plantilla }}>
      <div className="r2-tv-cabecera" role="row">
        {columnas.map((c) => <span key={c.id} role="columnheader" className={clases(c.alinear === 'der' && 'r2-der', c.alinear === 'centro' && 'r2-centro')}>{c.titulo}</span>)}
      </div>
      {total === 0 && <p className="r2-tv-vacio">{vacio}</p>}
      {lista.map((g) => (
        <div key={g.id} role="rowgroup">
          {g.titulo && <div className="r2-tv-grupo" role="row"><span role="cell">{g.titulo}<span className="r2-tv-grupo-cuenta">{g.filas.length}</span></span></div>}
          {g.filas.map((f, i) => (
            <div key={typeof clave === 'function' ? clave(f, i) : f?.[clave] ?? i} className="r2-tv-renglon" role="row">
              {columnas.map((c) => (
                <span key={c.id} role="cell" className={clases('r2-tv-c', c.alinear === 'der' && 'r2-der', c.alinear === 'centro' && 'r2-centro')}>
                  {c.celda ? c.celda(f) : f?.[c.id]}
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PaginasTv({ numero, total, segundos = 20 }) {
  if (!total || total <= 1) return null;
  return (
    <span className="r2-tv-paginas">
      <span>Página {numero} de {total}</span>
      <span className="r2-tv-avance" aria-hidden="true">
        <span key={numero} className="r2-tv-avance-linea" style={{ animationDuration: `${segundos}s` }} />
      </span>
    </span>
  );
}
