// Rediseño 2 · fundación · ayuda de vista (no pinta nada ni pide datos).
/** Lleva la pestaña activa a la vista dentro de su fila (solo desplaza la fila, nunca la página). La usa también el
 *  encabezado de página con pestañas de sección (antes la activa podía quedar cortada: «Histor…» en celular). */
export function acomodarActiva(nodo) {
  const a = nodo?.querySelector('[aria-selected="true"], [aria-current="page"]');
  if (!a || nodo.scrollWidth <= nodo.clientWidth) return;
  const izq = a.getBoundingClientRect().left - nodo.getBoundingClientRect().left + nodo.scrollLeft;
  const der = izq + a.offsetWidth;
  if (izq >= nodo.scrollLeft && der <= nodo.scrollLeft + nodo.clientWidth) return;
  nodo.scrollLeft = Math.max(0, izq - (nodo.clientWidth - a.offsetWidth) / 2);
}
