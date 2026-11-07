// Diseño 3G — en cada cambio de ruta deja el diseño nuevo encendido.
// Solo el diseño nuevo (16-oct-2026): ya no hay rutas sin diseño ni interruptor. Antes llamaba G3.aplicar(), que todavía
// lee un «actual» guardado y quitaba el atributo; ahora forzarDiseno3G() lo deja puesto sin tocar lo guardado.
import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { forzarDiseno3G } from './forzarDiseno3G';

export default function RutaDiseno3G() {
  const { pathname } = useLocation();
  useLayoutEffect(() => { forzarDiseno3G(); }, [pathname]);
  return null;
}
