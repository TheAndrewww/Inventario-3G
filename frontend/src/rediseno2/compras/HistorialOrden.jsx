// Rediseño 2 · Compras · historial de una orden de compra (vista ENCENDIDA de components/common/TimelineHistorial).
// Pestaña «Historial» del cajón de la orden: una línea de tiempo sin tarjetas (qué pasó, quién y cuándo) y, plegado, de qué
// solicitudes y pedidos salió la orden. La petición y el «Reintentar» son los de TimelineHistorial.
import { ChevronDown, ChevronRight } from 'lucide-react';
import { LineaTiempo, Cargando, ErrorCarga, Nota, Estado, plural, numero } from '../fundacion';
import { importe, nombreRol } from './comunes';
import './compras.css';

const TONO = { pedido_aprobado: 'ok', orden_recibida: 'ok', orden_enviada: 'info', solicitud_creada: 'aviso' };

export default function HistorialOrden({ loading, historial, recargar, mostrarArbol, setMostrarArbol }) {
  if (loading) return <Cargando forma="lista" filas={5} etiqueta="Cargando el historial…" />;
  if (!historial) {
    return <ErrorCarga mensaje="No se pudo cargar el historial de esta orden." alReintentar={recargar} />;
  }
  const { timeline, arbolDependencias, estadisticas } = historial;
  const sinImportes = historial.importesOcultos === true;
  const ocultos = sinImportes ? { importesOcultos: true } : null;

  const eventos = timeline.map((ev, i) => {
    const d = ev.datos || {};
    const extra = [
      d.ticket_id && `Ticket ${d.ticket_id}`,
      d.proyecto && `Obra ${d.proyecto}`,
      d.articulo && d.articulo,
      d.cantidad && `cantidad ${d.cantidad}`,
      d.prioridad && `prioridad ${String(d.prioridad).toLowerCase()}`,
      d.proveedor && d.proveedor,
      (d.total_estimado || (sinImportes && 'total_estimado' in d)) && `total ${importe(ocultos, d.total_estimado)}`,
    ].filter(Boolean).join(' · ');
    return {
      id: i,
      texto: ev.titulo,
      tono: TONO[ev.tipo],
      detalle: [ev.descripcion, extra].filter(Boolean).join(' — '),
      quien: ev.usuario ? `${ev.usuario.nombre}${ev.usuario.rol ? ` (${nombreRol(ev.usuario.rol)})` : ''}` : null,
      cuando: ev.fecha,
    };
  });

  const solicitudes = arbolDependencias?.solicitudes || [];
  return (
    <div className="r2c-historial-orden">
      <p className="r2c-resumen-linea">
        {[
          plural(timeline.length, 'evento', 'eventos'),
          plural(estadisticas.total_solicitudes, 'solicitud', 'solicitudes'),
          plural(estadisticas.total_pedidos_origen, 'pedido de origen', 'pedidos de origen'),
          plural(estadisticas.usuarios_involucrados, 'persona involucrada', 'personas involucradas'),
        ].join(' · ')}
      </p>
      <LineaTiempo eventos={eventos} vacio="Todavía no hay movimientos en esta orden." />
      {solicitudes.length > 0 ? (
        <section className="r2c-origen">
          <button type="button" className="r2c-plegable" aria-expanded={mostrarArbol} onClick={() => setMostrarArbol(!mostrarArbol)}>
            {mostrarArbol ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
            De dónde salió esta orden <span className="r2-grupo-cuenta">{plural(solicitudes.length, 'solicitud', 'solicitudes')}</span>
          </button>
          {mostrarArbol && (
            <div className="r2c-origen-cuerpo">
              <p className="r2c-parrafo">
                Orden <span className="r2c-folio">{arbolDependencias.orden.ticket_id}</span> · {arbolDependencias.orden.estado} · total {importe(ocultos, arbolDependencias.orden.total_estimado)} · {arbolDependencias.orden.proveedor}
              </p>
              <ul className="r2c-origen-lista">
                {solicitudes.map((s, i) => (
                  <li key={i}>
                    <p className="r2c-parrafo">
                      <span className="r2c-folio">{s.ticket_id}</span> · {s.articulo} · cantidad {numero(s.cantidad)} · <Estado dominio="prioridad" valor={String(s.prioridad || '').toLowerCase()} />
                    </p>
                    {s.pedido_origen && (
                      <p className="r2c-sec">Pedido {s.pedido_origen.ticket_id} · {s.pedido_origen.proyecto} · {s.pedido_origen.usuario}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <Nota className="r2c-nota-pie">Orden creada a mano: no tiene solicitudes de compra asociadas.</Nota>
      )}
    </div>
  );
}
