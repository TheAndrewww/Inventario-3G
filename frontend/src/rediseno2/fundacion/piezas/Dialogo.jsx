// Rediseño 2 · diálogo centrado (solo para confirmar algo corto o para los diálogos de siempre que todavía no se rediseñan:
// components/common/Modal.jsx encendido se pinta con esta pieza, con el mismo título y los mismos hijos).
// El detalle de una cosa va en <Cajon>, no aquí.
//
// <Dialogo abierto={ver} alCerrar={() => setVer(false)} titulo="Tomar fotografía" tamano="lg">…</Dialogo>
//
// Props: abierto, alCerrar, titulo, tamano ('sm' 448 | 'md' 512 | 'lg' 672 | 'xl' 896, los mismos de Modal), cerrarConVelo
// (true), cerrarConEsc (false: los diálogos de siempre no se cerraban con Esc y así se quedan), pie (nodo).
import { useRef } from 'react';
import { X } from 'lucide-react';
import { useCapa } from '../useCapa';
import { clases } from '../formato';

export function Dialogo({ abierto, alCerrar, titulo, tamano = 'md', cerrarConVelo = true, cerrarConEsc = false, pie, className, children }) {
  const ref = useRef(null);
  useCapa({ abierta: abierto, ref, alCerrar: (motivo) => { if (motivo !== 'esc' || cerrarConEsc) alCerrar?.(); } });
  if (!abierto) return null;
  return (
    <div className="r2-capa r2-capa--dialogo" onClick={() => { if (cerrarConVelo) alCerrar?.(); }}>
      <div className="r2-velo" aria-hidden="true" />
      <div ref={ref} className={clases('r2-dialogo', `r2-dialogo--${tamano}`, className)} role="dialog" aria-modal="true"
        aria-label={typeof titulo === 'string' ? titulo : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="r2-dialogo-cabecera">
          <h2 className="r2-dialogo-titulo" tabIndex={-1} data-r2-foco="">{titulo}</h2>
          <button type="button" className="r2-boton-icono r2-boton-icono--normal r2-boton-icono--fantasma" aria-label="Cerrar" title="Cerrar" onClick={alCerrar}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="r2-dialogo-cuerpo">{children}</div>
        {pie && <div className="r2-dialogo-pie">{pie}</div>}
      </div>
    </div>
  );
}
