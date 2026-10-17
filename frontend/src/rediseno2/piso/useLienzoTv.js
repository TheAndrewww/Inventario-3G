// Rediseño 2 · Piso · medida de la TV para repartir la lista en páginas que SÍ caben (no pide nada al servidor).
//
// La TV está pensada para 1920 × 1080 (DISENO-v2 §3.6). Esta ayuda:
//   - toma el tamaño de la ventana y el giro de la pantalla (90° / 270° cambian ancho por alto, como hoy);
//   - da un `ajuste` para que la misma composición llene una pantalla de otro tamaño (1366, 1440, 4K…) sin cortarse;
//     la escala − / + de siempre se multiplica encima;
//   - dice si el lienzo es `angosto` (TV vertical o celular): ahí cada obra va en un renglón de tres líneas;
//   - calcula cuántos renglones caben por página con la escala real, para que ninguna obra quede fuera de la vista.
//
// const l = useLienzoTv({ rotacion, zoom, altoFila: 116, altoFilaAngosta: 184, grupos: 0 });
//   → { ajuste, angosto, escala: zoom × ajuste, porPagina }
import { useEffect, useState } from 'react';

const leerVentana = () => ({ ancho: window.innerWidth || 1920, alto: window.innerHeight || 1080 });

function useVentana() {
  const [v, setV] = useState(leerVentana);
  useEffect(() => {
    const cambiar = () => setV(leerVentana());
    window.addEventListener('resize', cambiar);
    return () => window.removeEventListener('resize', cambiar);
  }, []);
  return v;
}

// Alto fijo del encabezado (96), la cabecera de columnas (48) y el pie (72), en px de la TV de 1920
const FIJO = 96 + 48 + 72;
const GRUPO = 56;

export function useLienzoTv({ rotacion = 0, zoom = 1, altoFila = 116, altoFilaAngosta = 184, grupos = 0, anchoMinimo = 1200 } = {}) {
  const { ancho: vw, alto: vh } = useVentana();
  const vertical = rotacion === 90 || rotacion === 270;
  const ancho = vertical ? vh : vw;
  const alto = vertical ? vw : vh;
  const angosto = ancho < anchoMinimo;
  const base = angosto ? Math.min(ancho / 1080, alto / 1920) : Math.min(ancho / 1920, alto / 1080);
  // En celular no se baja de 0.7 (letra de datos ≥ 15 px); en una TV 4K sube hasta 2
  const ajuste = Math.max(0.7, Math.min(2, Number.isFinite(base) ? base : 1));
  const escala = (Number(zoom) || 1) * ajuste;
  const fila = (angosto ? altoFilaAngosta : altoFila) * escala;
  // En angosto el encabezado baja las cifras y la hora a su propia línea (unos 96 px más)
  const libre = alto - (FIJO + (angosto ? 96 : 0) + grupos * GRUPO) * escala;
  const porPagina = Math.max(1, Math.floor(libre / fila));
  return { ajuste, angosto, escala, porPagina, ancho, alto };
}
