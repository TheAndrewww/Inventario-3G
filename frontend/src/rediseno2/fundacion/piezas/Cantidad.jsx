// Rediseño 2 · cantidad con «−» y «+» (DISENO-v2 §4.13): objetivos de 44 px en táctil (40 en escritorio), número tabular
// centrado y la unidad al lado. Solo pinta: el valor que se manda es el que la página ya calculaba.
//
// <Cantidad valor={item.cantidad} alCambiar={(n) => cambiarCantidad(item.id, n)} min={1} max={item.stock} unidad="pzas"
//   etiqueta={`Cantidad de ${item.nombre}`} />
//
// Props: valor, alCambiar(numero | texto mientras se escribe), min, max, paso (1), unidad, etiqueta (lectores),
// deshabilitado, decimales (permite punto decimal al escribir).
import { Minus, Plus } from 'lucide-react';
import { clases } from '../formato';

export function Cantidad({ valor, alCambiar, min, max, paso = 1, unidad, etiqueta = 'Cantidad', deshabilitado = false, decimales = false, className }) {
  const n = Number(valor);
  const valido = Number.isFinite(n);
  const puedeBajar = !deshabilitado && valido && (min == null || n - paso >= min);
  const puedeSubir = !deshabilitado && valido && (max == null || n + paso <= max);
  const redondear = (x) => (decimales ? Math.round(x * 1000) / 1000 : x);
  return (
    <span className={clases('r2-cantidad', className)} role="group" aria-label={etiqueta}>
      <button type="button" className="r2-cantidad-boton" aria-label={`Quitar ${paso}`} disabled={!puedeBajar}
        onClick={() => alCambiar?.(redondear(n - paso))}>
        <Minus size={18} aria-hidden="true" />
      </button>
      <input type="text" inputMode={decimales ? 'decimal' : 'numeric'} className="r2-cantidad-campo" value={valor ?? ''} disabled={deshabilitado}
        aria-label={etiqueta}
        onChange={(e) => {
          const t = e.target.value.replace(',', '.');
          if (t === '' || (decimales ? /^\d*\.?\d*$/.test(t) : /^\d*$/.test(t))) alCambiar?.(t === '' ? '' : (t.endsWith('.') ? t : Number(t)));
        }} />
      <button type="button" className="r2-cantidad-boton" aria-label={`Agregar ${paso}`} disabled={!puedeSubir}
        onClick={() => alCambiar?.(redondear((valido ? n : 0) + paso))}>
        <Plus size={18} aria-hidden="true" />
      </button>
      {unidad && <span className="r2-cantidad-unidad">{unidad}</span>}
    </span>
  );
}
