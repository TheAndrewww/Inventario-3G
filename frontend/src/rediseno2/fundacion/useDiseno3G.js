// Rediseño 2 · el diseño nuevo en React.
// Solo el diseño nuevo (decisión del dueño, 16-oct-2026): useDiseno3G() y leerDiseno3G() devuelven SIEMPRE true (ya no hay
// interruptor; index.html pone <html data-diseno="3g"> fijo y forzarDiseno3G.js lo mantiene). Así no parpadea lo viejo.
// VIEJO: se borra a partir del 24-oct-2026 — en cada página, lo que corre con d3 en false (ver src/diseno-3g/LEEME.md).
// El tema (useTemaR2) se sigue leyendo del atributo y se entera de los cambios con un MutationObserver.
//
// Uso en una página (junto a los demás hooks, NUNCA dentro de un if):
//   const d3 = useDiseno3G();
//   …estado, efectos y manejadores de siempre…
//   if (d3) return <VistaNueva {...estadoYManejadores} />;
//   return (…el JSX de siempre, intacto…);
//
// La exportación vieja (src/diseno-3g/useDiseno3G.js) sigue funcionando igual; las piezas nuevas importan esta.
import { useSyncExternalStore } from 'react';

const raiz = () => document.documentElement;

function suscribir(avisar) {
  const observador = new MutationObserver(avisar);
  observador.observe(raiz(), { attributes: true, attributeFilter: ['data-diseno', 'data-g3-tema'] });
  const dejar = window.G3?.alCambiar ? window.G3.alCambiar(avisar) : null;
  return () => { observador.disconnect(); if (dejar) dejar(); };
}

/** true: el diseño nuevo siempre está encendido (para usar fuera de React). */
export const leerDiseno3G = () => true;
/** Tema guardado del diseño nuevo: 'claro' | 'oscuro' | 'auto'. Sin nada guardado: 'claro'. */
export const leerTemaR2 = () => raiz().getAttribute('data-g3-tema') || 'claro';

export const useDiseno3G = () => true;
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
