// Sofía (7-nov-2026) · la ventana flotante de la asistente de Dirección en las pantallas internas de Planta.
// Ver ventanaSofia.js: sin VITE_SOFIA_FLOTANTE_URL no hace nada (ni pide, ni guarda); con ella, solo en los aparatos
// de Isa (marcados con #sofia o ?sofia=1) pide el guion de Sofía. App.jsx lo monta dentro de PrivateRoute, junto al
// armazón: nunca en las rutas públicas, de TV, de la terminal ni en Entrar.
import { useEffect } from 'react';
import { origenSofia, aparatoDeIsa, rutaSinSofia, ponerSofia } from './ventanaSofia.js';

// Sin la variable, Vite deja `SOFIA = null` fijo y el resto se cae del paquete al compilar.
const DIRECCION = import.meta.env.VITE_SOFIA_FLOTANTE_URL;
const SOFIA = DIRECCION ? origenSofia(DIRECCION) : null;

const almacen = () => {
  try { return window.localStorage; } catch { return null; }
};
const sinAlmacen = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// La marca se lee al arrancar, antes de que el inicio de sesión cambie la dirección (PrivateRoute manda a /login y el
// #sofia se perdería). Solo con la variable puesta.
if (SOFIA && typeof window !== 'undefined') aparatoDeIsa(window.location, almacen() || sinAlmacen);

export default function SofiaFlotante() {
  useEffect(() => {
    if (!SOFIA || rutaSinSofia(window.location.pathname)) return;
    if (aparatoDeIsa(window.location, almacen() || sinAlmacen)) ponerSofia(document, SOFIA, 'planta');
  }, []);
  return null;
}
