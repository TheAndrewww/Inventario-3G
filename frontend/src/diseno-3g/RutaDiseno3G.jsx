// Diseño 3G — en cada cambio de ruta deja el diseño nuevo encendido.
// Solo el diseño nuevo (16-oct-2026): ya no hay rutas sin diseño ni interruptor. Antes llamaba G3.aplicar(), que todavía
// lee un «actual» guardado y quitaba el atributo; ahora forzarDiseno3G() lo deja puesto sin tocar lo guardado.
// VIEJO: se borra a partir del 24-oct-2026 — aplicarTv (diseño de TV de la ola 3): window.G3_TV ya nunca se pone, así
// que no hace nada.
import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { aplicarTv } from './tvG3';
import { forzarDiseno3G } from './forzarDiseno3G';

export default function RutaDiseno3G() {
  const { pathname } = useLocation();
  useLayoutEffect(() => { forzarDiseno3G(); aplicarTv(pathname); }, [pathname]);
  return null;
}
