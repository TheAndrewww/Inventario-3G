// Rediseño 2 · checklist de preparación de un ticket (cajón ancho en escritorio; pantalla completa en celular).
// Mismos manejadores de PedidosPendientesPage: palomear, editar cantidad (− campo + Guardar / Cancelar en el mismo
// renglón), quitar artículo y completar ticket, cada uno con su confirmación de siempre.
// Los artículos se ORDENAN POR UBICACIÓN solo en la vista (mismo dato, misma petición). La existencia va como número,
// sin color de «alcanza / no alcanza» (DISENO-v2, anexo A 4: hoy ese color sale mal porque compara textos).
import { Check, MapPin, Pencil, Save, Trash2 } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonCuerpo, CajonPie, Boton, MenuAcciones, Fecha, Estado, Nota,
  cantidad, numero, plural, clases,
} from '../fundacion';
import { CantidadTicket, Progreso } from './comunes';
import { destinoDe, preparados, ordenarPorUbicacion } from './datos';

function Ubicacion({ ubicacion }) {
  if (!ubicacion) {
    return (
      <span className="r2-tk-ubicacion r2-tk-ubicacion--sin">
        <span className="r2-tk-ubicacion-codigo">Sin ubicación</span>
      </span>
    );
  }
  const lugar = [
    ubicacion.almacen,
    ubicacion.pasillo ? `Pasillo ${ubicacion.pasillo}` : null,
    ubicacion.estante ? `Estante ${ubicacion.estante}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <span className="r2-tk-ubicacion">
      <span className="r2-tk-ubicacion-codigo"><MapPin size={16} aria-hidden="true" />{ubicacion.codigo}</span>
      {lugar && <span className="r2-tk-ubicacion-lugar">{lugar}</span>}
    </span>
  );
}

export default function ChecklistTicket({ t }) {
  const p = t.pedidoSeleccionado;
  const abierto = Boolean(t.showModal && p);
  const { hechos, total } = preparados(p);
  const faltan = total - hechos;
  const sePuedeCompletar = p && ['pendiente', 'aprobado'].includes(p.estado);
  const listo = p?.progreso_dispersion === 100;
  // Hoy el diálogo dice «Encargado: supervisor o, si no hay, quien pidió». Aquí se dicen las dos cosas con su nombre, porque
  // en celular la lista ya no tiene la columna «Pidió».
  const pidio = p?.usuario?.nombre;
  const encargado = p?.supervisor?.nombre;
  const obs = p ? t.obsOriginales(p.observaciones) : '';
  const detalles = ordenarPorUbicacion(p?.detalles || []);
  const editando = t.editandoCantidad;

  return (
    <Cajon abierto={abierto} alCerrar={t.handleCloseModal} ancho="ancho" etiqueta={p ? `Checklist del ticket ${p.ticket_id}` : 'Checklist'}
      className="r2-tk-checklist">
      {p && (
        <>
          <CajonCabecera titulo={destinoDe(p)} alCerrar={t.handleCloseModal}
            dato={(
              <>
                {p.ticket_id}
                {pidio && <> · Pidió {pidio}</>}
                {encargado && encargado !== pidio && <> · Encargado {encargado}</>}
                {!pidio && !encargado && ' · Encargado -'}
                {' · '}<Fecha valor={p.fecha_hora} />
              </>
            )}
            estado={sePuedeCompletar ? null : <Estado dominio="ticket" valor={p.estado} />}>
            <div className="r2-tk-checklist-avance">
              <Progreso hechos={hechos} total={total} porcentaje={p.progreso_dispersion} />
              <span className="r2-tk-checklist-avance-texto">{faltan > 0 ? `${plural(faltan, 'artículo falta', 'artículos faltan')} por preparar` : 'Todo preparado'}</span>
            </div>
          </CajonCabecera>

          <CajonCuerpo className="r2-tk-checklist-cuerpo">
            {p.revision_requerida && (
              <div className="r2-tk-nota-aviso" role="note">
                <Estado tono="aviso" texto="Por revisar · cierre de obra" />
                {p.revision_motivo && <p>{p.revision_motivo}.</p>}
                <p>El material ya entregado no regresó solo al almacén. Si ya se entregó todo, complétalo; si no, Dirección lo elimina como siempre (al eliminarlo regresa todo su material).</p>
              </div>
            )}

            <section className={obs ? 'r2-tk-checklist-obs' : 'r2-tk-checklist-obs r2-tk-checklist-obs--sin'} aria-label="Observaciones">
              <h3 className="r2-seccion-cajon-titulo">Observaciones</h3>
              {obs ? <p className="r2-tk-checklist-obs-texto">{obs}</p> : <Nota>Sin observaciones.</Nota>}
            </section>

            <section aria-label="Artículos a preparar">
              <h3 className="r2-seccion-cajon-titulo r2-tk-checklist-titulo">
                Artículos a preparar <span className="r2-tk-subtitulo-dato">· por ubicación</span>
              </h3>
              <ul className="r2-lista r2-tk-checklist-lista">
                {detalles.map((d) => {
                  const enEdicion = editando?.detalleId === d.id;
                  const unidad = d.articulo?.unidad || 'uds';
                  return (
                    <li key={d.id} className={clases('r2-tk-renglon-check', d.dispersado && 'r2-tk-renglon-check--hecho')}>
                      <button type="button" className="r2-tk-paloma" aria-pressed={Boolean(d.dispersado)} disabled={t.procesando || undefined}
                        aria-label={`${d.dispersado ? 'Quitar la marca de preparado' : 'Marcar como preparado'}: ${d.articulo?.nombre || ''}`}
                        onClick={() => t.handleMarcarArticulo(p.id, d.id, !d.dispersado)}>
                        <span className="r2-tk-paloma-dibujo" aria-hidden="true">{d.dispersado && <Check size={20} strokeWidth={3} />}</span>
                      </button>

                      <Ubicacion ubicacion={d.articulo?.ubicacion} />

                      <span className="r2-tk-check-articulo">
                        <span className="r2-tk-articulo-nombre">{d.articulo?.nombre}</span>
                        <span className="r2-tk-articulo-clave">Clave {d.articulo?.codigo_ean13}</span>
                        {d.observaciones && <span className="r2-tk-check-nota">{d.observaciones}</span>}
                        {d.dispersado && d.dispersadoPor && (
                          <span className="r2-tk-check-hecho">
                            <Check size={14} aria-hidden="true" /> Preparó {d.dispersadoPor.nombre} · <Fecha valor={d.fecha_dispersado} />
                          </span>
                        )}
                      </span>

                      {enEdicion ? (
                        <span className="r2-tk-check-edicion">
                          <CantidadTicket valor={editando.cantidad} min="1" unidad={cantidad(2, unidad).replace(/^[\d.,\s]+/, '')}
                            etiqueta={`Nueva cantidad de ${d.articulo?.nombre || ''}`}
                            alMenos={t.cantidadMenos} alMas={t.cantidadMas} alEscribir={t.cantidadEscrita} />
                          <span className="r2-tk-check-edicion-botones">
                            <Boton nivel="fantasma" tamano="chico" alHacer={t.cancelarEdicion}>Cancelar</Boton>
                            <Boton nivel="tonal" tamano="chico" icono={Save} cargando={t.procesando} alHacer={t.handleGuardarCantidad}>Guardar</Boton>
                          </span>
                        </span>
                      ) : (
                        <span className="r2-tk-check-cantidad">
                          <span className="r2-tk-check-cantidad-valor">{cantidad(d.cantidad, unidad)}</span>
                          {d.articulo?.stock_actual !== undefined && (
                            <span className="r2-tk-check-hay" title="Existencia en el sistema">Hay {numero(d.articulo.stock_actual)}</span>
                          )}
                        </span>
                      )}

                      <span className="r2-tk-check-mas">
                        {!d.dispersado && !enEdicion && (
                          <MenuAcciones titulo={d.articulo?.nombre} acciones={[
                            { texto: 'Editar cantidad', icono: Pencil, alHacer: () => t.handleEditarCantidad(d.id, d.cantidad) },
                            { texto: 'Quitar artículo del ticket', icono: Trash2, peligro: true, alHacer: () => t.handleEliminarArticulo(p.id, d.id) },
                          ]} />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </CajonCuerpo>

          {sePuedeCompletar && (
            <CajonPie resumen={listo
              ? (
                <span className="r2-tk-pie-lineas">
                  <span className="r2-tk-pie-listo"><Check size={16} aria-hidden="true" /> Los {numero(total)} artículos están preparados</span>
                  <span className="r2-tk-pie-nota">El ticket pasará a Completados.</span>
                </span>
              )
              : <span className="r2-tk-pie-falta">Faltan {numero(faltan)} de {numero(total)}</span>}>
              {/* Como hoy: mientras se guarda algo (palomear, cantidad, completar) el botón espera */}
              <Boton nivel="principal" icono={Check} alHacer={t.handleCompletarTicket} cargando={t.procesando && listo}
                deshabilitado={!listo || t.procesando}
                motivo={listo ? 'Guardando…' : `Faltan ${numero(faltan)} de ${numero(total)} artículos por palomear`}>
                {t.procesando && listo ? 'Completando…' : 'Completar ticket'}
              </Boton>
            </CajonPie>
          )}
        </>
      )}
    </Cajon>
  );
}
