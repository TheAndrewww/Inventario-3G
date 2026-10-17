// Rediseño 2 · Compras · ficha de una orden de compra en cajón ancho (la abre el renglón o la liga ?orden=OC-…).
// La DECISIÓN va arriba según el estado y el rol (los mismos permisos de hoy): Aprobar / Rechazar / Editar / Eliminar /
// Anular / Descargar PDF. Debajo, dos pestañas: «Orden» (datos, pago y pedido, artículos con lo recibido) e «Historial»
// (la línea de tiempo de siempre: se pide solo al abrir esa pestaña, como hoy).
import { useState } from 'react';
import { Check, X, Pencil, Trash2, Ban, Download } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonDecision, CajonCuerpo, SeccionCajon, Datos, Tabla, Estado, Boton, MenuAcciones, Pestanas,
  Dialogo, Campo, Area, Nota, cantidad, fechaCita, fechaExacta, useEsCelular,
} from '../fundacion';
import { TimelineHistorial } from '../../components/common';
import { importe, soloDia, nombreRol } from './comunes';

const CON_PDF = ['enviada', 'parcial', 'recibida'];

function FichaOrden({ orden, esAdmin, puedeAnularOrdenes, puedeReabrirOrdenes, aprobar, abrirRechazo, eliminar, abrirAnular,
  abrirEditar, loadingAprobacion, generarPDFOrden, franjaPago, cerrarDetalle }) {
  const [pestana, setPestana] = useState('orden');
  const celular = useEsCelular();
  const estado = orden.estado;
  const porAprobar = estado === 'pendiente_aprobacion';
  const rechazada = estado === 'rechazada';
  const anulable = esAdmin && puedeAnularOrdenes && !['cancelada', 'rechazada', 'pendiente_aprobacion'].includes(estado);
  const incompleta = orden.cierre_incompleto?.faltantes?.length > 0;
  const hayRecibido = (orden.detalles || []).some((d) => parseFloat(d.cantidad_recibida) > 0) || ['parcial', 'recibida'].includes(estado);

  // Decisión de esta orden en este estado y para este rol
  let decision = null;
  if (porAprobar && esAdmin) {
    decision = (
      <>
        <Boton nivel="principal" icono={Check} alHacer={() => aprobar(orden)} cargando={loadingAprobacion}>{celular ? 'Aprobar' : 'Aprobar orden'}</Boton>
        <Boton nivel="contorno" icono={X} alHacer={() => abrirRechazo(orden)} deshabilitado={loadingAprobacion}>Rechazar</Boton>
        <MenuAcciones titulo={orden.ticket_id} acciones={[{ texto: 'Editar orden', icono: Pencil, alHacer: () => abrirEditar(orden) }]} />
      </>
    );
  } else if (rechazada && (puedeReabrirOrdenes || puedeAnularOrdenes)) {
    decision = (
      <>
        {puedeReabrirOrdenes && <Boton nivel="principal" icono={Pencil} alHacer={() => abrirEditar(orden)}>Editar orden</Boton>}
        {puedeAnularOrdenes && (
          <MenuAcciones titulo={orden.ticket_id} acciones={[
            { texto: loadingAprobacion ? 'Eliminando…' : 'Eliminar orden', icono: Trash2, alHacer: () => eliminar(orden), peligro: true, deshabilitado: loadingAprobacion },
          ]} />
        )}
      </>
    );
  } else if (CON_PDF.includes(estado) || anulable) {
    decision = (
      <>
        {CON_PDF.includes(estado) && <Boton nivel="tonal" icono={Download} alHacer={() => generarPDFOrden(orden)}>Descargar PDF</Boton>}
        {anulable && <MenuAcciones titulo={orden.ticket_id} acciones={[{ texto: 'Anular orden', icono: Ban, alHacer: () => abrirAnular(orden), peligro: true }]} />}
      </>
    );
  }
  const notaDecision = porAprobar && !esAdmin ? 'Esta orden está pendiente de aprobación por un administrador.' : null;

  const datos = [
    ['Proveedor', orden.proveedor?.nombre || 'Sin proveedor'],
    { etiqueta: 'Total estimado', valor: importe(orden, orden.total_estimado), numero: true },
    ['Creada por', orden.creador ? `${orden.creador.nombre}${orden.creador.rol ? ` · ${nombreRol(orden.creador.rol)}` : ''}` : '—'],
    ['Creada', orden.created_at ? <span title={fechaExacta(orden.created_at)}>{fechaCita(orden.created_at)}</span> : '—'],
    orden.fecha_llegada_estimada && ['Llegada estimada', fechaCita(soloDia(orden.fecha_llegada_estimada))],
    orden.fecha_aprobacion && ['Aprobada', <span key="a" title={fechaExacta(orden.fecha_aprobacion)}>{fechaCita(orden.fecha_aprobacion)}</span>],
    orden.fecha_envio && ['Enviada al proveedor', <span key="e" title={fechaExacta(orden.fecha_envio)}>{fechaCita(orden.fecha_envio)}</span>],
  ];

  const columnas = [
    { id: 'articulo', titulo: 'Artículo', celda: (d) => d.articulo?.nombre },
    { id: 'pedido', titulo: 'Pedido', alinear: 'der', celda: (d) => cantidad(d.cantidad_solicitada, d.articulo?.unidad) },
    hayRecibido && {
      id: 'recibido', titulo: 'Recibido', alinear: 'der',
      celda: (d) => {
        const rec = parseFloat(d.cantidad_recibida) || 0;
        const ped = parseFloat(d.cantidad_solicitada) || 0;
        return <span className={rec >= ped && ped > 0 ? 'r2-tono--ok r2c-fuerte' : rec > 0 ? 'r2-tono--aviso r2c-fuerte' : undefined}>{cantidad(rec, d.articulo?.unidad)}</span>;
      },
    },
    { id: 'costo', titulo: 'Costo', alinear: 'der', ocultarEn: 'celular-ancho', celda: (d) => importe(orden, d.costo_unitario) },
    { id: 'subtotal', titulo: 'Subtotal', alinear: 'der', celda: (d) => importe(orden, d.subtotal) },
  ].filter(Boolean);

  return (
    <>
      <CajonCabecera titulo={`Orden ${orden.ticket_id}`} dato={orden.proveedor?.nombre || 'Sin proveedor'}
        estado={<Estado dominio="orden" valor={estado} detalle={estado === 'recibida' && incompleta ? 'Cerrada incompleta' : undefined} />}
        alCerrar={cerrarDetalle} />
      <CajonDecision nota={notaDecision}>{decision}</CajonDecision>
      {!decision && notaDecision && <div className="r2c-decision-sola"><Nota>{notaDecision}</Nota></div>}
      <div className="r2c-cajon-pestanas">
        <Pestanas etiqueta={`Secciones de la orden ${orden.ticket_id}`} valor={pestana} alCambiar={setPestana}
          pestanas={[{ id: 'orden', texto: 'Orden' }, { id: 'historial', texto: 'Historial' }]} />
      </div>
      <CajonCuerpo>
        {pestana === 'orden' ? (
          <>
            {rechazada && orden.motivo_rechazo && (
              <SeccionCajon titulo="Motivo del rechazo">
                <p className="r2c-caja r2c-caja--mal">{orden.motivo_rechazo}</p>
              </SeccionCajon>
            )}
            <SeccionCajon titulo="Datos">
              <Datos columnas={2} datos={datos} />
            </SeccionCajon>
            {orden.observaciones && (
              <SeccionCajon titulo="Observaciones">
                <p className="r2c-parrafo">{orden.observaciones}</p>
              </SeccionCajon>
            )}
            {franjaPago}
            {incompleta && (
              <SeccionCajon titulo="Cerrada incompleta">
                <Nota>
                  Cerró {orden.cierre_incompleto.cerrado_por} · <span title={fechaExacta(orden.cierre_incompleto.fecha)}>{fechaCita(orden.cierre_incompleto.fecha)}</span>
                </Nota>
                <ul className="r2c-lista-simple">
                  {orden.cierre_incompleto.faltantes.map((f, i) => (
                    <li key={i}>
                      <span className="r2c-fuerte">{f.nombre}</span>: llegaron {f.recibido} de {f.solicitado} {f.unidad} (faltaron {f.faltante})
                      {f.motivo_texto ? <span className="r2c-tenue"> · {f.motivo_texto}</span> : null}
                    </li>
                  ))}
                </ul>
                {orden.cierre_incompleto.comentario && <Nota>Comentario: {orden.cierre_incompleto.comentario}</Nota>}
              </SeccionCajon>
            )}
            <SeccionCajon titulo={`Artículos · ${(orden.detalles || []).length}`}
              accion={<span className="r2c-total-seccion">Total {importe(orden, orden.total_estimado)}</span>}>
              <Tabla etiqueta={`Artículos de la orden ${orden.ticket_id}`} densidad="compacta" fija={false} clave="id"
                columnas={columnas} filas={orden.detalles || []}
                filaCelular={(d) => ({
                  principal: d.articulo?.nombre,
                  secundario: `Pedido ${cantidad(d.cantidad_solicitada, d.articulo?.unidad)}${hayRecibido ? ` · recibido ${cantidad(d.cantidad_recibida || 0, d.articulo?.unidad)}` : ''}`,
                  derecha: importe(orden, d.subtotal),
                })}
                vacio={{ titulo: 'Esta orden no tiene artículos' }} />
            </SeccionCajon>
            {orden.solicitudes_origen?.length > 0 && (
              <SeccionCajon titulo="Solicitudes generadas automáticamente">
                <ul className="r2c-lista-simple">
                  {orden.solicitudes_origen.map((s) => (
                    <li key={s.id}><span className="r2c-folio">{s.ticket_id}</span> · {s.articulo?.nombre} · {cantidad(s.cantidad_solicitada, s.articulo?.unidad)}</li>
                  ))}
                </ul>
              </SeccionCajon>
            )}
          </>
        ) : (
          <div className="r2c-historial">
            <TimelineHistorial ordenId={orden.id} />
          </div>
        )}
      </CajonCuerpo>
    </>
  );
}

export function CajonOrden(p) {
  const orden = p.ordenSeleccionada;
  const abierto = Boolean(p.detalleAbierto && orden);
  return (
    <Cajon abierto={abierto} alCerrar={p.cerrarDetalle} ancho="ancho" etiqueta={orden ? `Orden ${orden.ticket_id}` : 'Orden'}>
      {abierto && <FichaOrden key={orden.id} orden={orden} {...p} />}
    </Cajon>
  );
}

// Rechazar: el motivo es obligatorio (como hoy) y se guarda en la orden.
export function DialogoRechazo({ abierto, orden, motivo, setMotivo, confirmar, cerrar, cargando }) {
  if (!abierto || !orden) return null;
  const listo = Boolean(motivo?.trim());
  return (
    <Dialogo abierto alCerrar={cerrar} cerrarConEsc titulo={`Rechazar la orden ${orden.ticket_id}`} tamano="md"
      pie={(
        <>
          <Boton nivel="fantasma" alHacer={cerrar}>Cancelar</Boton>
          <Boton nivel="peligro-lleno" icono={X} alHacer={confirmar} cargando={cargando} deshabilitado={!listo}
            motivo="Escribe el motivo del rechazo">Rechazar orden</Boton>
        </>
      )}>
      <div className="r2-pila" style={{ gap: 16 }}>
        <Nota>{orden.proveedor?.nombre || 'Sin proveedor'} · {importe(orden, orden.total_estimado)}. El motivo queda guardado en la orden.</Nota>
        <Campo etiqueta="Motivo del rechazo" requerido>
          <Area rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
            placeholder="Por ejemplo: el precio no coincide con la cotización" />
        </Campo>
      </div>
    </Dialogo>
  );
}
