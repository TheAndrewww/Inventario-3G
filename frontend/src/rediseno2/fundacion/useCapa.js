// Rediseño 2 · comportamiento común de las capas (Cajon, Dialogo, PanelAvisos, VisorPlano):
// Esc cierra solo la capa de hasta arriba, el foco entra a la capa (al título si tiene data-r2-foco) y regresa a lo que la
// abrió al cerrarse, y Tab no se sale de la capa. No pinta nada.
//   const ref = useRef(null);
//   useCapa({ abierta, ref, alCerrar });
import { useEffect, useId, useRef } from 'react';
import { pilaCapas } from './contexto';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useCapa({ abierta, ref, alCerrar }) {
  const id = useId();
  const cerrar = useRef(alCerrar);
  useEffect(() => { cerrar.current = alCerrar; });

  useEffect(() => {
    if (!abierta) return undefined;
    const antes = document.activeElement;
    pilaCapas.entrar(id);
    const nodo = ref.current;
    const foco = nodo?.querySelector('[data-r2-foco]') || nodo?.querySelector(ENFOCABLES) || nodo;
    // después del pintado, para que el nodo ya exista; si un campo con autoFocus ya tomó el foco, se respeta
    const t = window.setTimeout(() => {
      if (nodo && nodo.contains(document.activeElement)) return;
      foco?.focus?.({ preventScroll: true });
    }, 0);
    const tecla = (e) => {
      if (!pilaCapas.esArriba(id)) return;
      if (e.key === 'Escape' && !e.defaultPrevented) {
        // Un menú abierto dentro de la capa se cierra primero (él mismo marca el evento)
        e.preventDefault();
        cerrar.current?.('esc');
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const lista = [...ref.current.querySelectorAll(ENFOCABLES)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!lista.length) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && (document.activeElement === primero || !ref.current.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', tecla);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', tecla);
      pilaCapas.salir(id);
      if (antes && typeof antes.focus === 'function' && document.contains(antes)) antes.focus({ preventScroll: true });
    };
  }, [abierta, id, ref]);
}
