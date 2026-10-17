// Rediseño 2 · mide el alto real de una pieza pegada arriba (encabezado con pestañas, barra de filtros) y se lo da a la
// página para calcular --r2-tope. Si la pieza no está pegada (activo=false), cuenta 0.
import { useLayoutEffect } from 'react';

export function useAltoFijo(ref, poner, activo = true) {
  useLayoutEffect(() => {
    if (!poner) return undefined;
    const nodo = ref.current;
    if (!nodo || !activo) { poner(0); return undefined; }
    const medir = () => {
      const fija = getComputedStyle(nodo).position === 'sticky';
      poner(fija ? Math.round(nodo.getBoundingClientRect().height) : 0);
    };
    medir();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
    ro?.observe(nodo);
    window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir); poner(0); };
  }, [ref, poner, activo]);
}
