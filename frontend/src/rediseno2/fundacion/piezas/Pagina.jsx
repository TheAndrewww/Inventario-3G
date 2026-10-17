// Rediseño 2 · raíz de cada vista nueva de oficina. Toda vista encendida empieza con <Pagina>.
// Pone el relleno, el ancho (todo el ancho hasta 1600 px, o 760 px para lectura), la densidad (§3.2) y coordina lo que va
// pegado arriba al desplazar (--r2-tope = barra + encabezado con pestañas + barra de filtros, la suma real). También le dice
// al armazón que esta pantalla ya es nueva (le quita la zona heredada).
//
// <Pagina titulo="Órdenes de compra" densidad="comoda">
//   <EncabezadoPagina pestanas="seccion" principal={{ texto: 'Nueva orden', corto: 'Nueva', icono: Plus, alHacer: abrir }} />
//   <TiraCifras cifras={…} />
//   <BarraFiltros busqueda={…} filtros={…} />
//   <Tabla columnas={…} filas={…} />
// </Pagina>
//
// Props: titulo (nombre de la pantalla en la barra del celular; si no, el del menú), ancho ('completo' | 'lectura'),
// densidad ('comoda' | 'compacta'), espacioInferior (true si hay una BarraAccion fija abajo).
import { useLayoutEffect, useMemo, useState } from 'react';
import { ContextoPagina, useArmazon } from '../contexto';
import { clases } from '../formato';

export function Pagina({ titulo, ancho = 'completo', densidad = 'comoda', espacioInferior = false, className, children }) {
  const armazon = useArmazon();
  const [altoEnc, setAltoEnc] = useState(0);
  const [altoFil, setAltoFil] = useState(0);
  const [ranura, setRanura] = useState(null);
  const registrar = armazon?.registrarPagina;

  useLayoutEffect(() => (registrar ? registrar(titulo) : undefined), [registrar, titulo]);

  const valor = useMemo(() => ({ densidad, setAltoEnc, setAltoFil, ranura, setRanura }), [densidad, ranura]);
  return (
    <ContextoPagina.Provider value={valor}>
      <div className={clases('r2-pagina', `r2-pagina--${ancho}`, `r2-densidad--${densidad}`, espacioInferior && 'r2-pagina--con-barra', className)}
        style={{ '--r2-enc-fijo': `${altoEnc}px`, '--r2-filtros-fijo': `${altoFil}px` }}>
        {children}
      </div>
    </ContextoPagina.Provider>
  );
}
