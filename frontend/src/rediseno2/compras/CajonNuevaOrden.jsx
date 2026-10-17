// Rediseño 2 · Compras · «Nueva orden de compra» en cajón extra (960 px), vista ENCENDIDA de ModalNuevaOrden.
// Orden de trabajo: proveedor arriba → a la izquierda AGREGAR (catálogo con buscador, «Ver todos» y «Crear artículo»; y si es
// Dirección con proveedor elegido, las sugerencias de ese proveedor) → a la derecha EN ESTA ORDEN (cantidad, costo, quitar,
// total) con la llegada estimada y las observaciones al final → pie con «Crear orden». En celular las dos zonas se alternan.
// Todo el estado, las peticiones y el envío siguen en ModalNuevaOrden (OrdenesCompraPage.jsx).
import { useState } from 'react';
import { Plus, PlusCircle, X, Search, PackagePlus, ListChecks } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonCuerpo, CajonPie, Campo, Entrada, Area, SelectorBuscable, Boton, BotonIcono, Casilla, Pestanas,
  Segmentado, Vacio, Nota, Estado, dinero, cantidad, plural, numero, useEsCelular, clases,
} from '../fundacion';
import './compras.css';

const hoy = () => new Date().toISOString().split('T')[0];

function FilaCatalogo({ articulo, yaAgregado, alElegir, conCategoria }) {
  const bajo = parseFloat(articulo.stock_actual) <= parseFloat(articulo.stock_minimo);
  return (
    <li>
      <button type="button" className="r2c-opcion" disabled={yaAgregado} onClick={() => alElegir(articulo)}
        aria-label={yaAgregado ? `${articulo.nombre}: ya está en la orden` : `Agregar ${articulo.nombre}`}>
        <span className="r2c-opcion-lineas">
          <span className="r2c-fuerte">{articulo.nombre}</span>
          <span className="r2c-sec">
            {[articulo.codigo_ean13 || 'Sin código', conCategoria ? (articulo.categoria?.nombre || 'Sin categoría') : null].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="r2c-opcion-derecha">
          <span className="r2c-num">{dinero(articulo.costo_unitario || 0)}</span>
          <span className={clases('r2c-sec', bajo && 'r2-tono--aviso')}>Existencia {cantidad(articulo.stock_actual, articulo.unidad)}</span>
        </span>
        <span className="r2c-opcion-accion" aria-hidden="true">{yaAgregado ? 'Ya agregado' : <Plus size={18} />}</span>
      </button>
    </li>
  );
}

function Sugerencia({ titulo, detalle, children, alAgregar }) {
  return (
    <li className="r2c-sugerencia">
      <div className="r2c-sugerencia-texto">
        <p className="r2c-fuerte">{titulo}</p>
        <p className="r2c-sec">{detalle}</p>
        {children}
      </div>
      <Boton nivel="tonal" tamano="chico" icono={Plus} alHacer={alAgregar}>Agregar</Boton>
    </li>
  );
}

export default function CajonNuevaOrden(p) {
  const {
    onClose, esDiseñador, esAdmin, proveedores, proveedorId, setProveedorId, articulos, articulosFiltrados, articulosPorCategoria,
    searchTerm, setSearchTerm, mostrarCatalogo, setMostrarCatalogo, articulosSeleccionados, handleSeleccionarArticulo,
    handleRemoverArticulo, handleCantidadChange, handleCostoChange, articulosOrdenes, articulosSolicitudes, articulosBajoStock,
    ordenesSeleccionadas, setOrdenesSeleccionadas, loadingPendientes, handleAgregarDesdeSugerencias, fechaLlegadaEstimada,
    setFechaLlegadaEstimada, observaciones, setObservaciones, loading, handleSubmit, calcularTotal, abrirNuevoArticulo, nuevoArticulo,
  } = p;
  const celular = useEsCelular();
  const [zonaCelular, setZonaCelular] = useState('agregar');
  const [zonaElegida, setZonaElegida] = useState(null);
  const [verObservaciones, setVerObservaciones] = useState(false);
  const haySugerencias = esAdmin && proveedorId && (articulosOrdenes.length > 0 || articulosSolicitudes.length > 0 || articulosBajoStock.length > 0);
  const nSugerencias = articulosOrdenes.length + articulosSolicitudes.length + articulosBajoStock.length;
  const zona = haySugerencias ? (zonaElegida || 'sugerencias') : 'catalogo';
  const enOrden = new Set(articulosSeleccionados.map((i) => i.articulo_id));
  const total = calcularTotal();
  const n = articulosSeleccionados.length;

  const alternarConsolidar = (ordenId, marcar) => {
    const nuevo = new Set(ordenesSeleccionadas);
    if (marcar) nuevo.add(ordenId); else nuevo.delete(ordenId);
    setOrdenesSeleccionadas(nuevo);
  };

  const catalogo = (
    <div className="r2c-zona-agregar">
      <div className="r2c-fila-buscar">
        <div className="r2-busqueda r2c-busqueda-flex" role="search">
          <Search size={18} aria-hidden="true" className="r2-busqueda-lupa" />
          <input type="search" className="r2-busqueda-campo" value={searchTerm} placeholder="Nombre, código de barras o categoría"
            aria-label="Buscar en el catálogo" autoComplete="off"
            onChange={(e) => { setSearchTerm(e.target.value); setMostrarCatalogo(e.target.value.length > 0); }}
            onFocus={() => setMostrarCatalogo(searchTerm.length > 0)} />
        </div>
        <Boton nivel="contorno" icono={ListChecks} alHacer={() => { setSearchTerm(''); setMostrarCatalogo(!mostrarCatalogo); }}>
          {mostrarCatalogo && !searchTerm ? 'Ocultar' : 'Ver todos'}
        </Boton>
      </div>
      {!mostrarCatalogo ? (
        <Vacio compacto icono={Search} titulo="Busca lo que vas a pedir"
          texto="Escribe el nombre, el código de barras o la categoría, o toca «Ver todos». Si no existe, créalo con «Crear artículo»." />
      ) : articulosFiltrados.length === 0 ? (
        <Vacio compacto sinResultados busqueda={searchTerm || undefined} texto="Si no existe en el catálogo, créalo con «Crear artículo»." />
      ) : (
        <>
          <p className="r2c-cuenta-resultados">
            {searchTerm ? plural(articulosFiltrados.length, 'resultado', 'resultados') : plural(articulos.length, 'artículo disponible', 'artículos disponibles')}
          </p>
          {searchTerm ? (
            <ul className="r2c-opciones">
              {articulosFiltrados.map((a) => <FilaCatalogo key={a.id} articulo={a} yaAgregado={enOrden.has(a.id)} alElegir={handleSeleccionarArticulo} conCategoria />)}
            </ul>
          ) : Object.entries(articulosPorCategoria).map(([cat, lista]) => (
            <section key={cat} className="r2c-grupo-opciones">
              <h4 className="r2c-grupo-opciones-titulo">{cat} <span className="r2-grupo-cuenta">{lista.length}</span></h4>
              <ul className="r2c-opciones">
                {lista.map((a) => <FilaCatalogo key={a.id} articulo={a} yaAgregado={enOrden.has(a.id)} alElegir={handleSeleccionarArticulo} />)}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );

  const sugerencias = haySugerencias && (
    <div className="r2c-zona-agregar">
      <Nota>Este proveedor tiene artículos en órdenes por aprobar o rechazadas, en solicitudes y bajo el mínimo.</Nota>
      {articulosOrdenes.length > 0 && (
        <section className="r2c-grupo-opciones">
          <h4 className="r2c-grupo-opciones-titulo">En órdenes por aprobar o rechazadas <span className="r2-grupo-cuenta">{articulosOrdenes.length}</span></h4>
          <ul className="r2c-sugerencias">
            {articulosOrdenes.map((item) => (
              <Sugerencia key={`orden-${item.articulo_id}`} titulo={item.articulo?.nombre}
                detalle={`En ${plural(item.ordenes_count, 'orden', 'órdenes')} · total ${cantidad(item.cantidad_total, item.articulo?.unidad || 'uds')}`}
                alAgregar={() => handleAgregarDesdeSugerencias(item, item.cantidad_total, 'orden')}>
                <div className="r2c-consolidar">
                  {item.ordenes.map((o) => (
                    <Casilla key={o.orden_id} marcada={ordenesSeleccionadas.has(o.orden_id)} alCambiar={(v) => alternarConsolidar(o.orden_id, v)}
                      texto={<span>Consolidar <span className="r2c-folio">{o.orden_ticket}</span> · {cantidad(o.cantidad_solicitada, item.articulo?.unidad)} · {o.orden_estado === 'pendiente_aprobacion' ? 'por aprobar' : 'rechazada'}</span>} />
                  ))}
                </div>
              </Sugerencia>
            ))}
          </ul>
        </section>
      )}
      {articulosSolicitudes.length > 0 && (
        <section className="r2c-grupo-opciones">
          <h4 className="r2c-grupo-opciones-titulo">Con solicitudes pendientes <span className="r2-grupo-cuenta">{articulosSolicitudes.length}</span></h4>
          <ul className="r2c-sugerencias">
            {articulosSolicitudes.map((item) => (
              <Sugerencia key={`solicitud-${item.articulo_id}`} titulo={item.articulo?.nombre}
                detalle={`${plural(item.solicitudes_count, 'solicitud', 'solicitudes')} · total ${cantidad(item.cantidad_total, item.articulo?.unidad || 'uds')}`}
                alAgregar={() => handleAgregarDesdeSugerencias(item, item.cantidad_total, 'solicitud')}>
                <ul className="r2c-sub-lista">
                  {item.solicitudes.map((s) => (
                    <li key={s.solicitud_id}>
                      <span className="r2c-folio">{s.solicitud_ticket}</span> · {cantidad(s.cantidad_solicitada, item.articulo?.unidad)} · <Estado dominio="prioridad" valor={s.prioridad} />
                    </li>
                  ))}
                </ul>
              </Sugerencia>
            ))}
          </ul>
        </section>
      )}
      {articulosBajoStock.length > 0 && (
        <section className="r2c-grupo-opciones">
          <h4 className="r2c-grupo-opciones-titulo">Bajo stock mínimo <span className="r2-grupo-cuenta">{articulosBajoStock.length}</span></h4>
          <ul className="r2c-sugerencias">
            {articulosBajoStock.map((item) => (
              <Sugerencia key={`stock-${item.articulo_id}`} titulo={item.articulo?.nombre}
                detalle={`Existencia ${cantidad(item.stock_actual, item.articulo?.unidad)} · mínimo ${cantidad(item.stock_minimo, item.articulo?.unidad)} · faltan ${numero(item.faltante)} · sugerido ${cantidad(item.cantidad_sugerida, item.articulo?.unidad)}`}
                alAgregar={() => handleAgregarDesdeSugerencias(item, item.cantidad_sugerida, 'bajo_stock')} />
            ))}
          </ul>
        </section>
      )}
      {ordenesSeleccionadas.size > 0 && (
        <p className="r2c-caja r2c-caja--info" role="status">
          {plural(ordenesSeleccionadas.size, 'orden elegida', 'órdenes elegidas')} para consolidar: los artículos repetidos se quitarán de esas órdenes al crear la nueva.
        </p>
      )}
    </div>
  );

  const zonaIzquierda = (
    <section className="r2c-nueva-zona" aria-label="Agregar artículos">
      <div className="r2c-zona-cab">
        <h3 className="r2c-zona-titulo">Agregar artículos {loadingPendientes && <span className="r2c-sec">· buscando sugerencias…</span>}</h3>
        <Boton nivel="fantasma" tamano="chico" icono={PlusCircle} alHacer={abrirNuevoArticulo} title="Crear un artículo nuevo y agregarlo a la orden">Crear artículo</Boton>
      </div>
      {haySugerencias && (
        <Pestanas etiqueta="De dónde agregar" valor={zona} alCambiar={setZonaElegida}
          pestanas={[{ id: 'sugerencias', texto: 'Sugerencias del proveedor', cuenta: nSugerencias }, { id: 'catalogo', texto: 'Catálogo' }]} />
      )}
      {zona === 'sugerencias' ? sugerencias : catalogo}
    </section>
  );

  const zonaDerecha = (
    <section className="r2c-nueva-zona r2c-nueva-zona--orden" aria-label="En esta orden">
      <h3 className="r2c-zona-titulo">En esta orden <span className="r2-grupo-cuenta">{n}</span></h3>
      {n === 0 ? (
        <Vacio compacto icono={PackagePlus} titulo="Todavía no hay artículos" texto="Agrégalos desde el catálogo o desde las sugerencias del proveedor." />
      ) : (
        <ul className="r2c-en-orden">
          {articulosSeleccionados.map((item, index) => {
            const insuficiente = parseFloat(item.cantidad) > parseFloat(item.articulo.stock_actual);
            const subtotal = parseFloat(item.cantidad) * parseFloat(item.costo_unitario || 0);
            return (
              <li key={index} className="r2c-en-orden-fila">
                <div className="r2c-en-orden-cab">
                  <span className="r2c-celda-doble">
                    <span className="r2c-fuerte">{item.articulo.nombre}</span>
                    <span className="r2c-sec">{item.articulo.codigo_ean13 || 'Sin código'} · existencia {cantidad(item.articulo.stock_actual, item.articulo.unidad)}</span>
                  </span>
                  <BotonIcono icono={X} tamano="chico" etiqueta={`Quitar ${item.articulo.nombre}`} alHacer={() => handleRemoverArticulo(index)} />
                </div>
                <div className="r2c-en-orden-campos">
                  <label className="r2c-mini-campo">
                    <span>Cantidad</span>
                    <input type="number" className="r2-entrada r2c-entrada-num" value={item.cantidad} min="0.01" step="0.01" required
                      onChange={(e) => handleCantidadChange(index, e.target.value)} />
                  </label>
                  <label className="r2c-mini-campo">
                    <span>Costo unitario</span>
                    <input type="number" className="r2-entrada r2c-entrada-num" value={item.costo_unitario} min="0" step="0.01" required
                      onChange={(e) => handleCostoChange(index, e.target.value)} />
                  </label>
                  <span className="r2c-mini-campo r2c-mini-campo--total">
                    <span>Subtotal</span>
                    <span className="r2c-num r2c-fuerte">{dinero(subtotal)}</span>
                  </span>
                </div>
                {insuficiente && <p className="r2c-sec r2-tono--info">Cantidad mayor a la existencia actual</p>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="r2c-revisar">
        <Campo etiqueta="Fecha de llegada estimada" ayuda="Se avisará si llega la fecha y la orden no se ha recibido.">
          <Entrada type="date" value={fechaLlegadaEstimada} min={hoy()} onChange={(e) => setFechaLlegadaEstimada(e.target.value)} className="r2c-entrada-media" />
        </Campo>
        {verObservaciones || observaciones ? (
          <Campo etiqueta="Observaciones">
            <Area rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas para esta orden" autoFocus={verObservaciones && !observaciones} />
          </Campo>
        ) : (
          <Boton nivel="fantasma" icono={Plus} alHacer={() => setVerObservaciones(true)} className="r2c-boton-inicio">Agregar observaciones</Boton>
        )}
      </div>
    </section>
  );

  return (
    <>
      <Cajon abierto alCerrar={onClose} ancho="extra" etiqueta="Nueva orden de compra"
        cambiosSinGuardar={n > 0 || Boolean(observaciones?.trim())}>
        <form className="r2c-forma" onSubmit={handleSubmit}>
          <CajonCabecera titulo="Nueva orden de compra" dato={esDiseñador ? 'Modo diseñador: puedes pedir aunque no haya existencia; lo que falte genera solicitudes automáticas.' : undefined} alCerrar={onClose} />
          <div className="r2c-nueva-proveedor">
            <Campo etiqueta="Proveedor (opcional)" ayuda={esAdmin ? 'Al elegirlo aparecen sus pendientes para incluirlos.' : undefined}>
              <SelectorBuscable valor={proveedorId} alCambiar={(v) => setProveedorId(v)} texto="Elegir proveedor…" vacio="Ningún proveedor coincide"
                opciones={[{ valor: '', texto: 'Sin proveedor' }, ...proveedores.map((pr) => ({ valor: String(pr.id), texto: pr.nombre }))]} />
            </Campo>
          </div>
          {celular && (
            <div className="r2c-nueva-segmento">
              <Segmentado etiqueta="Zona" valor={zonaCelular} alCambiar={setZonaCelular} anchoCompleto
                opciones={[{ valor: 'agregar', texto: 'Agregar' }, { valor: 'orden', texto: 'En la orden', cuenta: n }]} />
            </div>
          )}
          <CajonCuerpo className="r2c-nueva-cuerpo">
            {(!celular || zonaCelular === 'agregar') && zonaIzquierda}
            {(!celular || zonaCelular === 'orden') && zonaDerecha}
          </CajonCuerpo>
          <CajonPie resumen={n ? `${plural(n, 'artículo', 'artículos')} · total estimado ${dinero(total)}` : 'Sin artículos todavía'}>
            <Boton nivel="fantasma" alHacer={onClose} deshabilitado={loading}>Cancelar</Boton>
            <Boton nivel="principal" tipo="submit" icono={Plus} cargando={loading} deshabilitado={n === 0} motivo="Agrega al menos un artículo">Crear orden</Boton>
          </CajonPie>
        </form>
      </Cajon>
      {nuevoArticulo}
    </>
  );
}
