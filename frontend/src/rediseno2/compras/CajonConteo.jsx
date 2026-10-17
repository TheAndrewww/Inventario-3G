// Rediseño 2 · Compras · conteo de una recepción por factura en cajón (vista ENCENDIDA de ConteoRecepcionModal).
// Lo facturado contra lo que realmente se contó; la diferencia con signo y color, y lo que se le reportará a Compras.
// «Cerrar conteo» usa la misma confirmación (con antes → después) y la misma petición de hoy.
import { ClipboardCheck, Clock } from 'lucide-react';
import { Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon, Tabla, Boton, Nota, cantidad, numero, plural } from '../fundacion';
import './compras.css';

export default function CajonConteo({ onClose, conteo, contados, setContados, faltantes, sobrantes, guardando, cerrarConteo }) {
  const columnas = [
    {
      id: 'articulo', titulo: 'Artículo',
      celda: (a) => (
        <span className="r2c-celda-doble">
          <span className="r2c-fuerte">{a.nombre}</span>
          <span className="r2c-sec">Pedido {cantidad(a.cantidad_solicitada, a.unidad)}</span>
        </span>
      ),
    },
    { id: 'facturado', titulo: 'Facturado', alinear: 'der', celda: (a) => cantidad(a.cantidad_recibida, a.unidad) },
    {
      id: 'contado', titulo: 'Contado', alinear: 'der', ancho: '132px', sinBoton: true,
      celda: (a) => (
        <input type="number" step="0.01" min="0" inputMode="decimal" className="r2-entrada r2c-entrada-num" value={contados[a.detalle_id] ?? ''}
          aria-label={`Cantidad contada de ${a.nombre}`} onChange={(e) => setContados((prev) => ({ ...prev, [a.detalle_id]: e.target.value }))} />
      ),
    },
    {
      id: 'diferencia', titulo: 'Diferencia', alinear: 'der', ancho: '112px',
      celda: (a) => {
        const real = parseFloat(contados[a.detalle_id]);
        const dif = Number.isNaN(real) ? 0 : parseFloat((real - a.cantidad_recibida).toFixed(2));
        if (dif === 0) return <span className="r2c-sec">Cuadra</span>;
        return <span className={`r2c-fuerte ${dif < 0 ? 'r2-tono--mal' : 'r2-tono--aviso'}`}>{dif > 0 ? '+' : '−'}{numero(Math.abs(dif))} {dif < 0 ? 'faltan' : 'de más'}</span>;
      },
    },
  ];

  return (
    <Cajon abierto alCerrar={onClose} ancho="ancho" etiqueta={`Conteo de ${conteo.ticket_id}`}>
      <CajonCabecera titulo={`Conteo de ${conteo.ticket_id}`} alCerrar={onClose}
        dato={`${conteo.proveedor || 'Sin proveedor'} · ${conteo.vencido ? 'la ventana para reclamar ya venció' : `${plural(conteo.dias_restantes, 'día', 'días')} para reclamar`}`} />
      <CajonCuerpo>
        <SeccionCajon>
          <Nota>Captura lo que realmente contaste. Lo que difiera de la factura se ajusta en el inventario y se le reporta a Compras para reclamar al proveedor.</Nota>
          <Tabla etiqueta="Artículos a contar" densidad="compacta" fija={false} clave="detalle_id" columnas={columnas} filas={conteo.articulos}
            filaCelular={(a) => ({
              principal: a.nombre,
              secundario: `Facturado ${cantidad(a.cantidad_recibida, a.unidad)}`,
              derecha: columnas[2].celda(a),
              debajo: columnas[3].celda(a),
            })} />
        </SeccionCajon>
        {(faltantes.length > 0 || sobrantes.length > 0) && (
          <SeccionCajon titulo="Se reportará a Compras">
            {faltantes.length > 0 && (
              <p className="r2c-parrafo"><span className="r2c-fuerte r2-tono--mal">Faltantes:</span> {faltantes.map((f) => `${f.nombre} (${numero(Math.abs(f.diferencia))} ${f.unidad})`).join(', ')}</p>
            )}
            {sobrantes.length > 0 && (
              <p className="r2c-parrafo"><span className="r2c-fuerte r2-tono--aviso">De más:</span> {sobrantes.map((s) => `${s.nombre} (${numero(s.diferencia)} ${s.unidad})`).join(', ')}</p>
            )}
          </SeccionCajon>
        )}
      </CajonCuerpo>
      <CajonPie resumen={<span className="r2c-pie-nota"><Clock size={16} aria-hidden="true" /> Si no lo cierras, se cierra solo al cumplir los 7 días</span>}>
        <Boton nivel="fantasma" alHacer={onClose}>Cancelar</Boton>
        <Boton nivel="principal" icono={ClipboardCheck} alHacer={cerrarConteo} cargando={guardando}>Cerrar conteo</Boton>
      </CajonPie>
    </Cajon>
  );
}
