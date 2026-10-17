// Rediseño 2 · públicas · piezas de las pantallas de exhibición (Anuncios y Calendario público).
// Se apoyan en las clases de TV de la fundación (r2-piso, r2-tv-*: tokens, escala − / +, encabezado y pie) y agregan lo que
// esas dos pantallas necesitan y la fundación no trae (para la revisión final, ver REPORTE):
//   MarcoPublico      marco de TV con un lugar a la derecha del título (la fecha y la hora del calendario)
//   ControlesPublicos barra de controles escondida que aparece al mover el ratón (no la de escala y giro de la fundación,
//                     porque aquí no hay giro y sí hay mes, actualizar y pantalla completa)
//   BotonControl      botón de esa barra (48 px, con texto; solo ícono para lo universal)
//   SemanaTv          los días en columnas de TV (la pieza SemanaCalendario de «gestion» todavía no existe)
//   EquiposTv         la distribución de equipos como página que rota
// Ninguna pide datos: todo llega de la página.
import { useLayoutEffect, useRef, useState } from 'react';
import { TipoTrabajo, clases } from '../fundacion';

export function MarcoPublico({ tema, escala = 1, titulo, dato, derecha, pie, sinCursor = false, children, className }) {
  return (
    <div className={clases('r2-piso r2-tv r2-pub', className)} data-tema={tema} style={{ '--r2-escala': escala, cursor: sinCursor ? 'none' : undefined }}>
      <div className="r2-tv-lienzo r2-pub-lienzo">
        <header className="r2-tv-encabezado">
          <span className="g3-logo-marca r2-tv-marca" aria-hidden="true">3G</span>
          <h1 className="r2-tv-titulo r2-pub-titulo">{titulo}{dato && <span className="r2-tv-dato">{dato}</span>}</h1>
          {derecha && <div className="r2-pub-derecha">{derecha}</div>}
        </header>
        <main className="r2-tv-cuerpo r2-pub-cuerpo">{children}</main>
        {pie && <footer className="r2-tv-pie">{pie}</footer>}
      </div>
    </div>
  );
}

export function ControlesPublicos({ visibles, posicion = 'abajo', etiqueta, children, className }) {
  return (
    <div
      className={clases('r2-pub-controles', `r2-pub-controles--${posicion}`, !visibles && 'r2-pub-controles--ocultos', className)}
      role="toolbar"
      aria-label={etiqueta}
    >
      {children}
    </div>
  );
}

export function BotonControl({ icono: Icono, texto, alHacer, deshabilitado = false, soloIcono = false, nivel, presionado, girando = false, title }) {
  return (
    <button
      type="button"
      className={clases('r2-pub-control', soloIcono && 'r2-pub-control--icono', nivel && `r2-pub-control--${nivel}`)}
      onClick={alHacer}
      disabled={deshabilitado}
      aria-label={soloIcono ? texto : undefined}
      aria-pressed={presionado}
      title={title || (soloIcono ? texto : undefined)}
    >
      {Icono && <Icono size={22} aria-hidden="true" className={girando ? 'r2-pub-gira' : undefined} />}
      {!soloIcono && <span>{texto}</span>}
    </button>
  );
}

/** Si las obras no caben en la columna: primero la columna se aprieta (letra de 22 px, sin cliente) y, si aun así no caben,
 *  las que sobran se quedan en su lugar invisibles y la columna dice «+2 obras más». Mide al montar y al cambiar de tamaño
 *  (la columna se vuelve a montar cuando cambian sus obras o la escala). */
function useColumnaQueCabe() {
  const ref = useRef(null);
  const [apretada, setApretada] = useState(false);
  const [ocultas, setOcultas] = useState(0);
  useLayoutEffect(() => {
    const caja = ref.current;
    if (!caja) return undefined;
    const medir = () => {
      const alto = caja.clientHeight;
      const hijos = Array.from(caja.children).filter((h) => h.dataset.obra !== undefined);
      if (!hijos.length || caja.scrollHeight <= alto + 1) { setOcultas(0); return; }
      if (!caja.closest('.r2-pub-dia--apretada')) { setApretada(true); return; }
      const reserva = parseFloat(getComputedStyle(caja).getPropertyValue('--r2-pub-reserva')) || 40;
      let caben = 0;
      for (const h of hijos) {
        if (h.offsetTop + h.offsetHeight <= alto - reserva) caben += 1;
        else break;
      }
      setOcultas(hijos.length - caben);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    return () => observador.disconnect();
  }, [apretada]);
  return [ref, apretada, ocultas];
}

export function Equipo({ nombre, color, falla }) {
  if (falla) {
    return (
      <span className="r2-pub-equipo r2-tono--mal">
        <span className="r2-estado-punto" aria-hidden="true" />
        Falla
      </span>
    );
  }
  if (!nombre) return null;
  return (
    <span className="r2-pub-equipo">
      <span className="r2-pub-punto-equipo" style={{ background: color || 'transparent' }} aria-hidden="true" />
      {nombre}
    </span>
  );
}

function ObraTv({ obra, oculta }) {
  return (
    <li className={clases('r2-pub-obra', oculta && 'r2-pub-obra--oculta')} data-obra="" aria-hidden={oculta || undefined}>
      {(obra.hora || obra.equipo || obra.falla) && (
        <p className="r2-pub-obra-meta">
          {obra.hora && <span className="r2-pub-hora">{obra.hora}</span>}
          <Equipo nombre={obra.equipo} color={obra.color} falla={obra.falla} />
        </p>
      )}
      <p className="r2-pub-obra-nombre">{obra.nombre}</p>
      {obra.cliente && <p className="r2-pub-obra-cliente">{obra.cliente}</p>}
      {obra.tipo && <p className="r2-pub-obra-tipo"><TipoTrabajo tipo={obra.tipo} /></p>}
    </li>
  );
}

function DiaTv({ dia, primerPasado }) {
  const [ref, apretada, ocultas] = useColumnaQueCabe();
  const visibles = dia.obras.length - ocultas;
  return (
    <section
      className={clases('r2-pub-dia', dia.esHoy && 'r2-pub-dia--hoy', dia.pasado && 'r2-pub-dia--pasado', primerPasado && 'r2-pub-dia--primer-pasado', apretada && 'r2-pub-dia--apretada')}
      aria-label={`${dia.esHoy ? 'Hoy, ' : ''}${dia.nombreDia} ${dia.fecha}`}
    >
      <header className="r2-pub-dia-cab">
        <span className="r2-pub-dia-nombre">
          {dia.esHoy ? `Hoy · ${dia.nombreDia.toLowerCase()}` : dia.nombreDia}
          {dia.pasado && <span className="r2-pub-dia-nota">Ya pasó</span>}
        </span>
        <span className="r2-pub-dia-fecha">{dia.fecha}</span>
        {dia.esAsueto && <span className="r2-pub-asueto">Asueto</span>}
      </header>
      <ol className="r2-pub-obras" ref={ref}>
        {dia.obras.map((o, i) => <ObraTv key={`${i}-${o.nombre}`} obra={o} oculta={i >= visibles} />)}
        {dia.obras.length === 0 && <li className="r2-pub-sin-obras">{dia.esAsueto ? 'Día de asueto' : 'Sin obras'}</li>}
      </ol>
      {ocultas > 0 && <p className="r2-pub-mas">+{ocultas} {ocultas === 1 ? 'obra más' : 'obras más'}</p>}
    </section>
  );
}

export function SemanaTv({ dias, escala }) {
  return (
    <div className="r2-pub-semana">
      {dias.map((d, i) => (
        <DiaTv
          key={`${d.clave}|${escala}|${d.obras.map((o) => `${o.hora}${o.nombre}${o.cliente}${o.equipo}`).join('|')}`}
          dia={d}
          primerPasado={d.pasado && i > 0 && !dias[i - 1].pasado}
        />
      ))}
    </div>
  );
}

export function EquiposTv({ equipos }) {
  return (
    <ul className="r2-pub-equipos">
      {equipos.map((e) => (
        <li key={e.clave} className="r2-pub-equipo-bloque">
          <p className="r2-pub-equipo-nombre">
            <span className="r2-pub-punto-equipo" style={{ background: e.color || 'transparent' }} aria-hidden="true" />
            {e.nombre}
          </p>
          {e.encargado && <p className="r2-pub-equipo-encargado">{e.encargado}<span className="r2-pub-equipo-etiqueta">encargado</span></p>}
          {e.otros.length > 0 && <p className="r2-pub-equipo-otros">{e.otros.join(' · ')}</p>}
        </li>
      ))}
    </ul>
  );
}
