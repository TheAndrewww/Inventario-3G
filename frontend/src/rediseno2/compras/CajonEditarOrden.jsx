// Rediseño 2 · Compras · «Editar orden» en cajón ancho (vista ENCENDIDA de EditarOrdenModal). Mismos campos, mismo
// buscador de artículos (10 resultados) y el mismo envío; la orden se ve primero y se agrega abajo.
import { Search, X, Save, Plus } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon, Campo, Entrada, Area, Selector, Boton, BotonIcono, Nota, dinero,
  cantidad, plural,
} from '../fundacion';
import './compras.css';

export default function CajonEditarOrden({ onClose, orden, proveedores, proveedorId, setProveedorId, fechaLlegadaEstimada,
  setFechaLlegadaEstimada, observaciones, setObservaciones, searchTerm, setSearchTerm, mostrarCatalogo, setMostrarCatalogo,
  articulosFiltrados, handleSeleccionarArticulo, articulosSeleccionados, handleRemoverArticulo, handleCantidadChange,
  handleCostoChange, loading, handleSubmit, calcularTotal }) {
  const n = articulosSeleccionados.length;
  const total = calcularTotal();
  return (
    <Cajon abierto alCerrar={onClose} ancho="ancho" etiqueta={`Editar orden ${orden?.ticket_id || ''}`} cambiosSinGuardar>
      <form className="r2c-forma" onSubmit={handleSubmit}>
        <CajonCabecera titulo={`Editar orden ${orden?.ticket_id || ''}`} dato={orden?.proveedor?.nombre} alCerrar={loading ? undefined : onClose} />
        <CajonCuerpo>
          <SeccionCajon titulo="Proveedor y entrega">
            <div className="r2c-formulario">
              <Campo etiqueta="Proveedor (opcional)">
                <Selector value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} disabled={loading} vacio="Sin proveedor específico"
                  opciones={proveedores.map((p) => ({ valor: p.id, texto: p.nombre }))} />
              </Campo>
              <Campo etiqueta="Llegada estimada (opcional)">
                <Entrada type="date" value={fechaLlegadaEstimada} onChange={(e) => setFechaLlegadaEstimada(e.target.value)} disabled={loading} />
              </Campo>
              <Campo etiqueta="Observaciones (opcional)" className="r2c-campo-doble">
                <Area rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} disabled={loading} placeholder="Notas para esta orden" />
              </Campo>
            </div>
          </SeccionCajon>

          <SeccionCajon titulo={`Artículos · ${n}`} accion={<span className="r2c-total-seccion">Total {dinero(total)}</span>}>
            {n === 0 ? (
              <p className="r2c-caja r2c-caja--aviso" role="status">No hay artículos en la orden: busca y agrega al menos uno para guardarla.</p>
            ) : (
              <ul className="r2c-en-orden">
                {articulosSeleccionados.map((item, index) => (
                  <li key={index} className="r2c-en-orden-fila">
                    <div className="r2c-en-orden-cab">
                      <span className="r2c-celda-doble">
                        <span className="r2c-fuerte">{item.articulo.nombre}</span>
                        <span className="r2c-sec">Unidad: {item.articulo.unidad}</span>
                      </span>
                      <BotonIcono icono={X} tamano="chico" etiqueta={`Quitar ${item.articulo.nombre}`} alHacer={() => handleRemoverArticulo(index)} deshabilitado={loading} />
                    </div>
                    <div className="r2c-en-orden-campos">
                      <label className="r2c-mini-campo">
                        <span>Cantidad</span>
                        <input type="number" className="r2-entrada r2c-entrada-num" value={item.cantidad} min="1" step="1" required disabled={loading}
                          onChange={(e) => handleCantidadChange(index, e.target.value)} />
                      </label>
                      <label className="r2c-mini-campo">
                        <span>Costo unitario</span>
                        <input type="number" className="r2-entrada r2c-entrada-num" value={item.costo_unitario} min="0" step="0.01" disabled={loading}
                          onChange={(e) => handleCostoChange(index, e.target.value)} />
                      </label>
                      <span className="r2c-mini-campo r2c-mini-campo--total">
                        <span>Subtotal</span>
                        <span className="r2c-num r2c-fuerte">{dinero(parseFloat(item.cantidad) * parseFloat(item.costo_unitario))}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SeccionCajon>

          <SeccionCajon titulo="Agregar artículos">
            <div className="r2-busqueda r2c-busqueda-ancha" role="search">
              <Search size={18} aria-hidden="true" className="r2-busqueda-lupa" />
              <input type="search" className="r2-busqueda-campo" value={searchTerm} disabled={loading} autoComplete="off"
                placeholder="Nombre o código del artículo" aria-label="Buscar artículo para agregar"
                onChange={(e) => { setSearchTerm(e.target.value); setMostrarCatalogo(e.target.value.length > 0); }}
                onFocus={() => searchTerm.length > 0 && setMostrarCatalogo(true)} />
            </div>
            {mostrarCatalogo && articulosFiltrados.length > 0 && (
              <ul className="r2c-opciones">
                {articulosFiltrados.slice(0, 10).map((a) => (
                  <li key={a.id}>
                    <button type="button" className="r2c-opcion" onClick={() => handleSeleccionarArticulo(a)} aria-label={`Agregar ${a.nombre}`}>
                      <span className="r2c-opcion-lineas">
                        <span className="r2c-fuerte">{a.nombre}</span>
                        <span className="r2c-sec">Existencia {cantidad(a.stock_actual, a.unidad)}{a.codigo_ean13 ? ` · ${a.codigo_ean13}` : ''}</span>
                      </span>
                      <span className="r2c-opcion-accion" aria-hidden="true"><Plus size={18} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {mostrarCatalogo && articulosFiltrados.length === 0 && <Nota>Ningún artículo coincide con «{searchTerm}».</Nota>}
          </SeccionCajon>
        </CajonCuerpo>
        <CajonPie resumen={n ? `${plural(n, 'artículo', 'artículos')} · total estimado ${dinero(total)}` : null}>
          <Boton nivel="fantasma" alHacer={onClose} deshabilitado={loading}>Cancelar</Boton>
          <Boton nivel="principal" tipo="submit" icono={Save} cargando={loading} deshabilitado={n === 0} motivo="Agrega al menos un artículo">Guardar cambios</Boton>
        </CajonPie>
      </form>
    </Cajon>
  );
}
