// Diseño 3G para las pantallas públicas de TV y terminal (ola 3).
// Esas rutas siguen en window.G3_RUTAS_SIN_DISENO (index.html): la preferencia guardada del navegador NUNCA las enciende.
// Su diseño propio para TV se enciende SOLO si la URL de esa carga trae ?diseno=3g (y &tema=oscuro para fondo oscuro):
// lo decide un <script> en línea de index.html, que pone html[data-g3-tv="claro|oscuro"] y window.G3_TV. No se guarda ni
// se lee nada de localStorage (son equipos compartidos). Sin el parámetro, la pantalla es exactamente la de hoy.
// Al navegar dentro de la app, RutaDiseno3G quita el atributo en las rutas internas y lo regresa en las públicas.
import { useSyncExternalStore } from 'react';

// Misma lista que index.html (window.G3_RUTAS_SIN_DISENO): TV, terminal, anuncios y calendario público.
export const RUTAS_TV = /^\/(produccion-tv|preparados-tv|manufactura-tv|herreria-tv|anuncios|calendario-publico|terminal)(\/|$)/;

export function aplicarTv(pathname) {
  const t = window.G3_TV;
  if (t !== 'claro' && t !== 'oscuro') return; // sin ?diseno=3g en esta carga: no hace nada
  const d = document.documentElement;
  const poner = RUTAS_TV.test(pathname);
  if (poner === d.hasAttribute('data-g3-tv')) return;
  if (poner) d.setAttribute('data-g3-tv', t); else d.removeAttribute('data-g3-tv');
  window.dispatchEvent(new Event('g3:tv'));
}

const suscribir = (cb) => { window.addEventListener('g3:tv', cb); return () => window.removeEventListener('g3:tv', cb); };
const leer = () => document.documentElement.getAttribute('data-g3-tv'); // 'claro' | 'oscuro' | null
// null = la pantalla de siempre; 'claro' u 'oscuro' = Diseño 3G para TV.
export const useTvG3 = () => useSyncExternalStore(suscribir, leer, () => null);

// Tipo de trabajo con su nombre completo y su color (Instalación azul, Mantenimiento turquesa, Garantía lila).
// Cualquier otro valor sale tal cual, en gris (no se inventa nada).
export function tipoTv(tipo) {
  const t = String(tipo || '').toUpperCase().trim();
  if (!t) return null;
  if (t === 'MTO' || t === 'MANTENIMIENTO') return { texto: 'Mantenimiento', clase: 'g3tv-etq--mantenimiento' };
  if (t === 'GTIA' || t === 'GARANTIA' || t === 'GARANTÍA') return { texto: 'Garantía', clase: 'g3tv-etq--garantia' };
  if (t === 'INSTALACION' || t === 'INSTALACIÓN') return { texto: 'Instalación', clase: 'g3tv-etq--instalacion' };
  if (t === 'A' || t === 'B' || t === 'C') return { texto: `Tipo ${t}`, clase: '' };
  return { texto: String(tipo).trim(), clase: '' };
}
