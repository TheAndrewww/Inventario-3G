// Rediseño 2 · grupo tickets · piezas comunes de Orden de salida, Tickets pendientes, Historial y Entradas y salidas.
// Solo pintan: no piden nada al servidor y no cambian ningún valor que se manda (los manejadores siguen en cada página).
// Las ayudas de datos (destinoDe, preparados, ordenarPorUbicacion, agruparPorDia…) viven en ./datos.js.
//
//   <Progreso hechos total porcentaje />    → «5 de 8» con su línea fina
//   <CantidadTicket … />                    → − campo + con los MISMOS manejadores de cada página (uno para cada botón)
//   <CampoEscaner … />                      → buscador grande (48 px) donde también escribe la pistola
//   <ListaResultados … />                   → resultados bajo el buscador (foto, nombre, clave, existencia, «Agregar»)
//   <EstadoPistola leyendo activa />        → «Pistola activa» / «Leyendo código…» / «Pistola en pausa»
import { forwardRef } from 'react';
import { Minus, Plus, Search, X, ScanLine } from 'lucide-react';
import { clases, numero, IndicadorPistola, Miniatura, Cargando } from '../fundacion';

// ───────── Piezas ─────────
export function Progreso({ hechos = 0, total = 0, porcentaje, etiqueta = 'preparados', className }) {
  const pct = Math.max(0, Math.min(100, Number(porcentaje ?? (total ? (hechos / total) * 100 : 0)) || 0));
  const completo = total > 0 && hechos >= total;
  return (
    <span className={clases('r2-tk-progreso', completo && 'r2-tk-progreso--completo', className)}
      title={`${numero(hechos)} de ${numero(total)} ${etiqueta} (${Math.round(pct)} %)`}>
      <span className="r2-tk-progreso-texto"><strong>{numero(hechos)}</strong> de {numero(total)}</span>
      <span className="r2-tk-progreso-linea" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
    </span>
  );
}

// − campo + : cada botón llama al manejador de la página (no se recalcula nada aquí).
export function CantidadTicket({
  valor, alMenos, alMas, alEscribir, alSalir, unidad, etiqueta = 'Cantidad', min, menosApagado = false, decimales = false,
  deshabilitado = false, className,
}) {
  return (
    <span className={clases('r2-cantidad r2-tk-cantidad', className)} role="group" aria-label={etiqueta}>
      <button type="button" className="r2-cantidad-boton" aria-label={`Quitar 1 · ${etiqueta}`} onClick={alMenos}
        disabled={deshabilitado || menosApagado || undefined}>
        <Minus size={18} aria-hidden="true" />
      </button>
      <input type="number" inputMode={decimales ? 'decimal' : 'numeric'} min={min} className="r2-cantidad-campo r2-tk-cantidad-campo"
        value={valor ?? ''} aria-label={etiqueta} disabled={deshabilitado || undefined}
        onChange={(e) => alEscribir?.(e.target.value)} onBlur={alSalir ? (e) => alSalir(e.target.value) : undefined} />
      <button type="button" className="r2-cantidad-boton" aria-label={`Agregar 1 · ${etiqueta}`} onClick={alMas} disabled={deshabilitado || undefined}>
        <Plus size={18} aria-hidden="true" />
      </button>
      {unidad && <span className="r2-cantidad-unidad">{unidad}</span>}
    </span>
  );
}

// Buscador grande. La pistola escribe aquí cuando el campo tiene el foco (por eso NO toma el foco solo al abrir: así la
// pistola sigue leyendo por la página como hoy).
export const CampoEscaner = forwardRef(function CampoEscaner(
  { valor, alCambiar, alTecla, alLimpiar, texto, etiqueta, deshabilitado = false, controla, expandido, className }, ref,
) {
  return (
    <div className={clases('r2-tk-escaner', deshabilitado && 'r2-tk-escaner--apagado', className)}>
      <Search size={20} aria-hidden="true" className="r2-tk-escaner-lupa" />
      <input ref={ref} type="text" className="r2-tk-escaner-campo" value={valor} placeholder={texto} aria-label={etiqueta || texto}
        autoComplete="off" spellCheck={false} disabled={deshabilitado || undefined}
        role={controla ? 'combobox' : undefined} aria-controls={controla} aria-expanded={controla ? Boolean(expandido) : undefined}
        aria-autocomplete={controla ? 'list' : undefined}
        onChange={(e) => alCambiar?.(e.target.value)} onKeyDown={alTecla} />
      {valor && alLimpiar && !deshabilitado && (
        <button type="button" className="r2-tk-escaner-limpiar" aria-label="Borrar búsqueda" title="Borrar búsqueda" onClick={alLimpiar}>
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

// Resultados bajo el buscador. items: [{ id, foto, nombre, detalle, apagado, marca }]. Todo el renglón agrega.
export function ListaResultados({ id, items = [], buscando = false, alElegir, vacio, etiqueta = 'Resultados', textoAccion = 'Agregar' }) {
  return (
    <div id={id} className="r2-tk-resultados" role="listbox" aria-label={etiqueta}>
      {buscando ? (
        <Cargando forma="lista" filas={3} etiqueta="Buscando artículos…" />
      ) : items.length ? (
        items.map((it) => (
          <div key={it.id} role="option" aria-selected="false" tabIndex={-1}
            className={clases('r2-tk-resultado', it.apagado && 'r2-tk-resultado--apagado')}
            onClick={() => alElegir(it.original)}>
            <Miniatura src={it.foto} alt={it.nombre} tamano={40} ampliable={false} />
            <span className="r2-tk-resultado-lineas">
              <span className="r2-tk-resultado-nombre">
                <span className="r2-tk-resultado-nombre-texto">{it.nombre}</span>
                {it.marca && <span className="r2-tk-marca">{it.marca}</span>}
              </span>
              {it.detalle && <span className="r2-tk-resultado-detalle">{it.detalle}</span>}
            </span>
            <button type="button" className="r2-boton r2-boton--tonal r2-boton--chico r2-tk-resultado-agregar"
              aria-label={`${textoAccion}: ${it.nombre}`} title={`${textoAccion}: ${it.nombre}`}
              onClick={(e) => { e.stopPropagation(); alElegir(it.original); }}>
              <Plus size={16} aria-hidden="true" className="r2-boton-svg" />
              <span className="r2-boton-texto">{textoAccion}</span>
            </button>
          </div>
        ))
      ) : vacio}
    </div>
  );
}

export function EstadoPistola({ leyendo = false, activa = true, className }) {
  if (leyendo) {
    return (
      <span className={clases('r2-pistola r2-tono--info', className)} role="status">
        <ScanLine size={16} aria-hidden="true" />
        <span className="r2-estado-punto" aria-hidden="true" />
        Leyendo código…
      </span>
    );
  }
  return <IndicadorPistola activa={activa} className={className} />;
}
