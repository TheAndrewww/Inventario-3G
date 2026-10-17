// Diseño 3G — saber en React si el diseño nuevo está encendido.
// Solo el diseño nuevo (decisión del dueño, 16-oct-2026): siempre está encendido para todos, así que devuelve true desde
// el primer pintado (sin parpadeo de lo viejo). index.html pone html[data-diseno="3g"] fijo y forzarDiseno3G.js lo
// mantiene. VIEJO: se borra a partir del 24-oct-2026 — las ramas con este valor en false (ver LEEME.md).
import { useSyncExternalStore } from 'react';

const suscribir = (cb) => (window.G3 ? window.G3.alCambiar(cb) : () => {});

export const useDiseno3G = () => true;

// Tema de Diseño 3G: 'claro' | 'oscuro' | 'auto' (Planta no tenía modo oscuro: por omisión, claro)
const leerTema = () => document.documentElement.getAttribute('data-g3-tema') || 'claro';
export const useTemaG3 = () => useSyncExternalStore(suscribir, leerTema, () => 'claro');
