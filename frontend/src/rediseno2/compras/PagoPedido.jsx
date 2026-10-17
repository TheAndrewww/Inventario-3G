// Rediseño 2 · Compras · sección «Pago y pedido» dentro del cajón de la orden (vista ENCENDIDA de FranjaPagoPedido).
// La historia la manda Finanzas (Julia) y, si está prendido, la recepción de Planta: la página la pide igual que hoy; aquí
// solo se pinta como una línea de tiempo sin tarjetas.
import { SeccionCajon, Estado, LineaTiempo, Nota, fechaCita } from '../fundacion';
import { soloDia } from './comunes';

export default function PagoPedido({ datos }) {
  const actual = datos.actual;
  const eventos = datos.seguimiento.map((s) => {
    const partes = [
      s.fechaEstimada ? `llega aprox. ${fechaCita(soloDia(s.fechaEstimada))}` : null,
      s.folioFactura ? `factura ${s.folioFactura}` : null,
      s.nota || null,
    ].filter(Boolean);
    return {
      id: s.id,
      texto: s.texto,
      tono: s.tono,
      cuando: s.fecha,
      detalle: (partes.length || s.fotos?.length) ? (
        <>
          {partes.join(' · ')}
          {s.fotos?.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="r2c-enlace">
              {s.fotos.length > 1 ? `Ver foto ${i + 1} de la factura` : 'Ver la foto de la factura'}
            </a>
          ))}
        </>
      ) : null,
    };
  });
  return (
    <SeccionCajon titulo="Pago y pedido" accion={actual ? <Estado tono={actual.tono || 'neutro'} texto={actual.texto} /> : null}>
      {actual?.fechaEstimada && <Nota>Llegada estimada según Finanzas (Julia): <strong>{fechaCita(soloDia(actual.fechaEstimada))}</strong></Nota>}
      <LineaTiempo eventos={eventos} />
    </SeccionCajon>
  );
}
