// Diseño 3G — saber en React si el interruptor está encendido (html[data-diseno="3g"]).
// El atributo lo pone el fragmento de index.html antes de que cargue React; diseno-3g.js avisa si cambia.
import { useSyncExternalStore } from 'react';

const suscribir = (cb) => (window.G3 ? window.G3.alCambiar(cb) : () => {});
const leer = () => document.documentElement.getAttribute('data-diseno') === '3g';

export const useDiseno3G = () => useSyncExternalStore(suscribir, leer, () => false);

// Tema de Diseño 3G: 'claro' | 'oscuro' | 'auto' (Planta no tenía modo oscuro: por omisión, claro)
const leerTema = () => document.documentElement.getAttribute('data-g3-tema') || 'claro';
export const useTemaG3 = () => useSyncExternalStore(suscribir, leerTema, () => 'claro');
