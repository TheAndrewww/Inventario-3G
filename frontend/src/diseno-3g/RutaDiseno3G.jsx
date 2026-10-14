// Diseño 3G — en cada cambio de ruta vuelve a decidir si la pantalla lleva el diseño nuevo (G3.aplicar()).
// Las pantallas públicas (TV, terminal, anuncios, calendario público) están en window.G3_RUTAS_SIN_DISENO (index.html):
// nunca llevan el atributo ni piden la letra, aunque el interruptor esté encendido en ese navegador.
// Ola 3: esas mismas pantallas tienen su diseño para TV solo si la URL de la carga traía ?diseno=3g (tvG3.js); aquí se
// quita en las rutas internas y se regresa en las públicas. Sin ese parámetro no hace nada.
// Con el interruptor apagado no cambia nada (aplicar() no encuentra nada que poner) y no pinta nada.
import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { aplicarTv } from './tvG3';

export default function RutaDiseno3G() {
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.G3?.aplicar(); aplicarTv(pathname); }, [pathname]);
  return null;
}
