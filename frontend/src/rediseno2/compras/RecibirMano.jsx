// Rediseño 2 · Compras · Recepción «Capturar a mano» (vista ENCENDIDA de RecibirOrdenModal). Va DENTRO del cajón «Recibir»
// de la vista de Recepción (ahí está el selector de camino). Una tabla: palomita = llegó completo lo que faltaba; «Otra
// cantidad» cuando llegó distinto; la nota por artículo en «⋯». Pie: «Registrar recepción» y, en «⋯», «Cerrar orden
// incompleta» con el motivo de cada faltante. Todo el estado y las peticiones siguen en RecibirOrdenModal.
import { createPortal } from 'react-dom';
import { Check, PackageCheck, Pencil, MessageSquarePlus, CircleSlash } from 'lucide-react';
import {
  CajonCuerpo, CajonPie, SeccionCajon, Tabla, Casilla, Boton, MenuAcciones, Campo, Area, Selector, Dialogo, Nota, Miniatura,
  cantidad, numero, plural,
} from '../fundacion';
import './compras.css';

function LlegoAhora({ art, errores, guardando, marcarCompleto, activarOtraCantidad, handleCantidadChange, inputsCantidad }) {
  const yaCompleto = art.cantidad_pendiente <= 0;
  if (yaCompleto) return <span className="r2c-sec">Completo</span>;
  if (art.modo === 'otra') {
    return (
      <span className="r2c-llego">
        <span className="r2c-cantidad-celda">
          <input ref={(el) => { inputsCantidad.current[art.detalle_id] = el; }} type="number" step="0.01" min="0" max={art.cantidad_pendiente}
            value={art.cantidad_recibida} placeholder="0" disabled={guardando} inputMode="decimal"
            aria-label={`Cantidad que llegó de ${art.nombre}`} aria-invalid={errores[art.detalle_id] ? true : undefined}
            className="r2-entrada r2c-entrada-num" onChange={(e) => handleCantidadChange(art, e.target.value)} />
          <span className="r2c-unidad">{art.unidad}</span>
        </span>
        {errores[art.detalle_id] && <span className="r2c-error-celda">{errores[art.detalle_id]}</span>}
        <Boton nivel="fantasma" tamano="chico" icono={Check} alHacer={() => marcarCompleto(art)} deshabilitado={guardando}>Llegó completo</Boton>
      </span>
    );
  }
  return (
    <span className="r2c-llego">
      {art.modo === 'completo'
        ? <span className="r2c-fuerte r2-tono--ok">{cantidad(art.cantidad_recibida, art.unidad)}</span>
        : <span className="r2c-sec">Sin recibir</span>}
      <Boton nivel="fantasma" tamano="chico" icono={Pencil} alHacer={() => activarOtraCantidad(art)} deshabilitado={guardando}
        aria-label={`Llegó otra cantidad de ${art.nombre}`}>Otra cantidad</Boton>
    </span>
  );
}

export default function RecibirMano(p) {
  const {
    articulos, observacionesGenerales, setObservacionesGenerales, guardando, errores, togglePalomear, actualizarArticulo,
    handleObservacionChange, togglePalomearTodo, todoPalomeado, palomeados, recibiblesIds, hayArticulosPendientes, progreso,
    handleSubmit, onClose, abrirCerrarIncompleta, alPie,
    mostrarModalCompletar, cerrarDialogoCompletar, faltantesAlCerrar, motivosFaltante, setMotivosFaltante, motivoCompletar,
    setMotivoCompletar, completando, handleCompletarManualmente, motivos,
  } = p;
  const hayErrores = Object.keys(errores).length > 0;
  const requiereComentario = faltantesAlCerrar.some((f) => motivosFaltante[f.detalle_id] === 'otro');

  const columnas = [
    {
      id: 'paloma', titulo: <span className="r2-solo-lectores">Llegó completo</span>, ancho: '56px', sinBoton: true,
      celda: (a) => (
        <Casilla soloCasilla marcada={a.modo !== 'pendiente'} deshabilitado={guardando || a.cantidad_pendiente <= 0}
          alCambiar={() => togglePalomear(a)} etiqueta={a.modo !== 'pendiente' ? `Quitar la palomita de ${a.nombre}` : `${a.nombre}: llegó completo`} />
      ),
    },
    {
      id: 'articulo', titulo: 'Artículo', sinBoton: true,
      celda: (a) => (
        <span className="r2c-articulo-celda r2c-articulo-celda--arriba">
          <Miniatura src={a.imagen_url} alt={a.nombre} tamano={40} />
          <span className="r2c-celda-doble">
            <span className="r2c-fuerte">{a.nombre}</span>
            {a.cantidad_pendiente > 0
              ? <span className="r2c-sec">Falta {cantidad(a.cantidad_pendiente, a.unidad)}</span>
              : <span className="r2c-sec">Ya se recibió completo</span>}
            {a.mostrarNota && a.cantidad_pendiente > 0 && (
              <textarea className="r2-entrada r2-area r2c-nota-renglon" rows={2} value={a.observaciones} disabled={guardando}
                aria-label={`Nota de ${a.nombre}`} placeholder="Por ejemplo: llegó dañado, embalaje roto"
                onChange={(e) => handleObservacionChange(a.detalle_id, e.target.value)} />
            )}
          </span>
        </span>
      ),
    },
    { id: 'pedido', titulo: 'Pedido', alinear: 'der', ocultarEn: 'celular-ancho', celda: (a) => cantidad(a.cantidad_solicitada, a.unidad) },
    { id: 'ya', titulo: 'Ya recibido', alinear: 'der', celda: (a) => cantidad(a.cantidad_ya_recibida, a.unidad) },
    { id: 'ahora', titulo: 'Llegó ahora', alinear: 'der', ancho: '176px', sinBoton: true, celda: (a) => <LlegoAhora art={a} {...p} /> },
  ];

  const dialogo = mostrarModalCompletar && createPortal(
    <Dialogo abierto alCerrar={() => { if (!completando) cerrarDialogoCompletar(); }} cerrarConEsc titulo="Cerrar orden incompleta" tamano="md"
      pie={(
        <>
          <Boton nivel="fantasma" alHacer={cerrarDialogoCompletar} deshabilitado={completando}>Cancelar</Boton>
          <Boton nivel="principal" icono={PackageCheck} alHacer={handleCompletarManualmente} cargando={completando}>Guardar y cerrar</Boton>
        </>
      )}>
      <div className="r2-pila" style={{ gap: 16 }}>
        <p className="r2c-caja r2c-caja--aviso">
          Se guarda lo que capturaste como recibido y la orden se cierra. Lo que faltó queda en Solicitudes para la siguiente
          orden de compra, y el motivo queda registrado para reportarlo al proveedor.
        </p>
        {faltantesAlCerrar.length === 0 ? (
          <p className="r2c-linea-ok"><Check size={16} aria-hidden="true" /> Con lo capturado ya llegó todo: la orden quedará completa.</p>
        ) : (
          <div className="r2-pila" style={{ gap: 12 }}>
            <p className="r2c-fuerte">¿Por qué no llegó completo?</p>
            {faltantesAlCerrar.map((f) => (
              <Campo key={f.detalle_id} etiqueta={f.nombre}
                ayuda={`Llegaron ${numero(f.recibido_total)} de ${cantidad(f.cantidad_solicitada, f.unidad)} · faltan ${numero(f.faltante)}`}>
                <Selector value={motivosFaltante[f.detalle_id] || 'incompleto'} disabled={completando}
                  onChange={(e) => setMotivosFaltante((prev) => ({ ...prev, [f.detalle_id]: e.target.value }))}
                  opciones={motivos.map((m) => ({ valor: m.valor, texto: m.texto }))} />
              </Campo>
            ))}
          </div>
        )}
        <Campo etiqueta="Comentario para el proveedor" requerido={requiereComentario}
          ayuda={requiereComentario ? 'Obligatorio cuando algún motivo es «Otro».' : undefined}>
          <Area rows={3} value={motivoCompletar} onChange={(e) => setMotivoCompletar(e.target.value)} disabled={completando}
            placeholder="Por ejemplo: ya no tiene existencia; 3 piezas venían golpeadas" />
        </Campo>
      </div>
    </Dialogo>,
    document.body,
  );

  return (
    <>
      <form className="r2c-forma" onSubmit={handleSubmit}>
        <CajonCuerpo>
          <SeccionCajon>
            <div className="r2c-progreso-cab">
              <span className="r2c-fuerte">Avance de la orden</span>
              <span className="r2c-num r2c-fuerte">{progreso.porcentaje} %</span>
            </div>
            <div className="r2c-progreso" role="progressbar" aria-valuenow={progreso.porcentaje} aria-valuemin={0} aria-valuemax={100}
              aria-label="Avance de la recepción"><span style={{ width: `${Math.min(100, progreso.porcentaje)}%` }} /></div>
            <p className="r2c-sec">
              Ya recibido {numero(progreso.totalYaRecibido)} · ahora +{numero(progreso.totalAhoraRecibido)} · total {numero(progreso.totalRecibido)} de {numero(progreso.totalSolicitado)}
            </p>
          </SeccionCajon>
          <SeccionCajon titulo="Palomea lo que llegó completo"
            accion={hayArticulosPendientes ? (
              <Boton nivel={todoPalomeado ? 'fantasma' : 'contorno'} tamano="chico" icono={todoPalomeado ? CircleSlash : Check}
                alHacer={togglePalomearTodo} deshabilitado={guardando}>
                {todoPalomeado ? 'Quitar todas las palomitas' : 'Llegó todo completo'}
              </Boton>
            ) : null}>
            <Nota>Solo escribes la cantidad cuando llegó distinta a lo que faltaba.</Nota>
            <Tabla etiqueta="Artículos de la orden" densidad="compacta" fija={false} clave="detalle_id" columnas={columnas} filas={articulos}
              className="r2c-tabla-recibir"
              masAcciones={(a) => (a.cantidad_pendiente > 0 && !a.mostrarNota
                ? [{ texto: 'Agregar nota', icono: MessageSquarePlus, alHacer: () => actualizarArticulo(a.detalle_id, { mostrarNota: true }) }]
                : null)}
              filaCelular={(a) => ({
                inicio: (
                  <Casilla soloCasilla marcada={a.modo !== 'pendiente'} deshabilitado={guardando || a.cantidad_pendiente <= 0}
                    alCambiar={() => togglePalomear(a)} etiqueta={`${a.nombre}: llegó completo`} />
                ),
                principal: a.nombre,
                secundario: (
                  <span>
                    Pedido {cantidad(a.cantidad_solicitada, a.unidad)} · ya {numero(a.cantidad_ya_recibida)}
                    {a.mostrarNota && a.cantidad_pendiente > 0 && (
                      <textarea className="r2-entrada r2-area r2c-nota-renglon" rows={2} value={a.observaciones} disabled={guardando}
                        aria-label={`Nota de ${a.nombre}`} onChange={(e) => handleObservacionChange(a.detalle_id, e.target.value)} />
                    )}
                  </span>
                ),
                derecha: <LlegoAhora art={a} {...p} />,
              })} />
          </SeccionCajon>
          <SeccionCajon>
            <Campo etiqueta="Observaciones de la entrega">
              <Area rows={3} value={observacionesGenerales} onChange={(e) => setObservacionesGenerales(e.target.value)} disabled={guardando}
                placeholder="Transportista, condiciones de la entrega…" />
            </Campo>
          </SeccionCajon>
          {alPie}
        </CajonCuerpo>
        <CajonPie resumen={`${palomeados.length} de ${plural(recibiblesIds.length, 'artículo marcado', 'artículos marcados')}`}>
          {hayArticulosPendientes && (
            <MenuAcciones titulo="Recepción" acciones={[{
              texto: 'Cerrar orden incompleta', icono: CircleSlash, alHacer: abrirCerrarIncompleta, deshabilitado: guardando,
              motivo: 'Registra lo capturado y cierra aunque no haya llegado todo',
            }]} />
          )}
          <Boton nivel="fantasma" alHacer={onClose} deshabilitado={guardando}>Cancelar</Boton>
          <Boton nivel="principal" tipo="submit" icono={PackageCheck} cargando={guardando} deshabilitado={hayErrores}
            motivo="Corrige las cantidades marcadas en rojo">Registrar recepción</Boton>
        </CajonPie>
      </form>
      {dialogo}
    </>
  );
}

