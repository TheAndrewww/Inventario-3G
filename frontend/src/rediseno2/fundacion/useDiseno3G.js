// Rediseño 2 · el tema y el ancho de pantalla en React.
// Solo el diseño nuevo (16-oct-2026): index.html pone <html data-diseno="3g"> fijo y forzarDiseno3G.js lo mantiene. Los
// ganchos useDiseno3G()/leerDiseno3G() (siempre true) y la vista vieja de cada página se borraron el 7-nov-2026.
// El tema (useTemaR2) se sigue leyendo del atributo y se entera de los cambios con un MutationObserver.
import { useSyncExternalStore } from 'react';

const raiz = () => document.documentElement;

function suscribir(avisar) {
  const observador = new MutationObserver(avisar);
  observador.observe(raiz(), { attributes: true, attributeFilter: ['data-diseno', 'data-g3-tema'] });
  const dejar = window.G3?.alCambiar ? window.G3.alCambiar(avisar) : null;
  return () => { observador.disconnect(); if (dejar) dejar(); };
}

/** Tema guardado del diseño nuevo: 'claro' | 'oscuro' | 'auto'. Sin nada guardado: 'claro'. */
export const leerTemaR2 = () => raiz().getAttribute('data-g3-tema') || 'claro';

export const useTemaR2 = () => useSyncExternalStore(suscribir, leerTemaR2, () => 'claro');

// Ancho de la pantalla por puntos de quiebre del rediseño (DISENO-v2 §3.1):
// 'celular' ≤ 720 · 'celular-ancho' 721–860 · 'tableta' 861–1200 · 'escritorio' ≥ 1201
const CONSULTAS = [
  ['celular', '(max-width: 720px)'],
  ['celular-ancho', '(max-width: 860px)'],
  ['tableta', '(max-width: 1200px)'],
];
function suscribirAncho(avisar) {
  const listas = CONSULTAS.map(([, q]) => window.matchMedia(q));
  listas.forEach((m) => m.addEventListener('change', avisar));
  return () => listas.forEach((m) => m.removeEventListener('change', avisar));
}
const leerAncho = () => {
  for (const [nombre, q] of CONSULTAS) if (window.matchMedia(q).matches) return nombre;
  return 'escritorio';
};
/** 'celular' | 'celular-ancho' | 'tableta' | 'escritorio' */
export const useAnchoR2 = () => useSyncExternalStore(suscribirAncho, leerAncho, () => 'escritorio');
/** true en celular (≤ 720 px), donde las tablas se vuelven renglones de dos líneas. */
export const useEsCelular = () => useAnchoR2() === 'celular';
