// Rediseño 2 · contextos internos de la fundación (no los usan los grupos directamente).
//  - ContextoArmazon: el armazón sabe si la pantalla de adentro ya es una vista nueva (<Pagina>) para quitarle la zona
//    heredada (g3-zona), y deja que la página ponga su nombre en la barra del celular.
//  - ContextoPagina: el encabezado, la barra de filtros y la tabla de una misma página se coordinan (qué va pegado arriba,
//    dónde va la acción principal en celular, densidad).
import { createContext, useContext } from 'react';

export const ContextoArmazon = createContext(null);
export const useArmazon = () => useContext(ContextoArmazon);

export const ContextoPagina = createContext(null);
export const usePagina = () => useContext(ContextoPagina);

// Pila de capas abiertas (cajones, diálogos, panel de avisos): Esc cierra solo la de hasta arriba.
const pila = [];
export const pilaCapas = {
  entrar(id) { pila.push(id); },
  salir(id) { const i = pila.lastIndexOf(id); if (i !== -1) pila.splice(i, 1); },
  esArriba(id) { return pila[pila.length - 1] === id; },
};
