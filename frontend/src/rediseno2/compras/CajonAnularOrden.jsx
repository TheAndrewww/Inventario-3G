// Rediseño 2 · Compras · «Anular orden» en cajón normal (vista ENCENDIDA de AnularOrdenCompraModal). Es la acción más
// destructiva de Compras: dice ANTES qué va a pasar (stock que se revierte, solicitudes que se reactivan, aviso a compras),
// pide el motivo (10 letras o más) y la salida segura es «No anular». Después muestra lo que se revirtió.
import { Ban, CheckCircle2 } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon, Datos, Campo, Area, Boton, Estado, Nota, dinero, numero, plural,
} from '../fundacion';
import './compras.css';

export default function CajonAnularOrden({ onClose, orden, motivo, alCambiarMotivo, error, loading, resultado, handleAnular }) {
  const cerrar = loading ? () => {} : onClose;
  const largo = motivo.trim().length;
  const rev = resultado?.reversiones || {};
  return (
    <Cajon abierto alCerrar={cerrar} etiqueta={resultado ? 'Orden anulada' : `Anular la orden ${orden.ticket_id}`}>
      <CajonCabecera titulo={resultado ? 'Orden anulada' : `Anular la orden ${orden.ticket_id}`}
        dato={orden.proveedor?.nombre || 'Sin proveedor'} estado={<Estado dominio="orden" valor={resultado ? 'cancelada' : orden.estado} />}
        alCerrar={loading ? undefined : onClose} />
      {!resultado ? (
        <>
          <CajonCuerpo>
            {/* Folio, proveedor y estado ya están en la cabecera: aquí solo lo que se anula, en una línea */}
            <SeccionCajon titulo="Lo que se anula">
              <Datos columnas={2} className="r2c-datos-tres" datos={[
                { etiqueta: 'Total estimado', valor: dinero(parseFloat(orden.total_estimado || 0)), numero: true },
                { etiqueta: 'Artículos', valor: numero(orden.detalles?.length || 0), numero: true },
                orden.solicitudes_origen?.length > 0 && { etiqueta: 'Solicitudes vinculadas', valor: numero(orden.solicitudes_origen.length), numero: true },
              ]} />
            </SeccionCajon>
            <SeccionCajon titulo="Qué va a pasar">
              <ul className="r2c-lista-simple r2c-lista-pasos">
                <li>Se revierte el stock si la orden ya se recibió (en parte o completa).</li>
                <li>Las solicitudes de compra vinculadas vuelven a quedar pendientes.</li>
                <li>La orden queda cancelada para siempre.</li>
                <li>Se avisa a compras y a la administración.</li>
              </ul>
              <p className="r2c-caja r2c-caja--mal">Esta acción no se puede deshacer.</p>
            </SeccionCajon>
            <SeccionCajon>
              <Campo etiqueta="Motivo de la anulación" requerido error={error || undefined}
                ayuda={`Queda en el historial de la orden. ${largo} de 10 letras como mínimo.`}>
                <Area rows={4} value={motivo} onChange={(e) => alCambiarMotivo(e.target.value)} disabled={loading}
                  placeholder="Por ejemplo: orden duplicada, el proveedor no tiene existencia, cambio de proveedor" />
              </Campo>
            </SeccionCajon>
          </CajonCuerpo>
          <CajonPie>
            <Boton nivel="fantasma" alHacer={onClose} deshabilitado={loading}>No anular</Boton>
            <Boton nivel="peligro-lleno" icono={Ban} alHacer={handleAnular} cargando={loading} deshabilitado={largo < 10}
              motivo="Escribe el motivo (10 letras o más)">Anular orden</Boton>
          </CajonPie>
        </>
      ) : (
        <CajonCuerpo>
          <SeccionCajon>
            <p className="r2c-linea-ok r2c-linea-ok--grande"><CheckCircle2 size={20} aria-hidden="true" /> {resultado.message}</p>
            <Nota>La orden se anuló y los cambios se revirtieron.</Nota>
            <Datos columnas={2} className="r2c-datos-tres" datos={[
              { etiqueta: 'Stock revertido', valor: plural(rev.stock_revertido?.length || 0, 'artículo', 'artículos'), numero: true },
              { etiqueta: 'Solicitudes reactivadas', valor: numero(rev.solicitudes_reactivadas?.length || 0), numero: true },
              { etiqueta: 'Movimientos creados', valor: numero(rev.movimientos_creados?.length || 0), numero: true },
            ]} />
          </SeccionCajon>
          {rev.stock_revertido?.length > 0 && (
            <SeccionCajon titulo="Stock revertido">
              <ul className="r2c-lista-filas">
                {rev.stock_revertido.map((it, i) => (
                  <li key={i}>
                    <span className="r2c-celda-doble"><span className="r2c-fuerte">{it.nombre}</span><span className="r2c-sec">Artículo {it.articulo_id}</span></span>
                    <span className="r2c-celda-doble r2c-celda-doble--der">
                      <span className="r2c-fuerte r2-tono--mal">−{numero(it.cantidad_revertida)}</span>
                      <span className="r2c-sec">{numero(it.stock_antes)} → {numero(it.stock_despues)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </SeccionCajon>
          )}
          {rev.solicitudes_reactivadas?.length > 0 && (
            <SeccionCajon titulo="Solicitudes reactivadas">
              <ul className="r2c-lista-filas">
                {rev.solicitudes_reactivadas.map((it, i) => (
                  <li key={i}>
                    <span className="r2c-celda-doble"><span className="r2c-folio">{it.ticket_id}</span><span className="r2c-sec">{it.articulo}</span></span>
                    <span className="r2c-celda-doble r2c-celda-doble--der"><span className="r2c-fuerte">{numero(it.cantidad)}</span><Estado dominio="solicitud" valor="pendiente" /></span>
                  </li>
                ))}
              </ul>
            </SeccionCajon>
          )}
          <Nota className="r2c-nota-pie">Este cajón se cierra solo en unos segundos.</Nota>
        </CajonCuerpo>
      )}
    </Cajon>
  );
}
