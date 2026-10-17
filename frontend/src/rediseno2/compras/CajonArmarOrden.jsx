// Rediseño 2 · Compras · «Armar orden» con las solicitudes de un proveedor, en cajón ancho (vista ENCENDIDA de
// ModalCrearOrdenDesdeSolicitudes; la usan Solicitudes de compra y la Orden de salida). Mismos campos, mismo buscador de
// productos del proveedor, misma casilla «Herramienta» y el mismo envío (que además descarga el PDF, como hoy).
import { Check, Plus, Search, Trash2, ShoppingCart } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon, Campo, Entrada, Area, Selector, Tabla, Boton, Casilla,
  Lista, FilaLista, Vacio, Nota, dinero, plural, numero,
} from '../fundacion';
import './compras.css';

export default function CajonArmarOrden(p) {
  const {
    onClose, solicitudes, proveedores, proveedorId, setProveedorId, preferido, fechaLlegadaEstimada, setFechaLlegadaEstimada,
    observaciones, setObservaciones, loading, articulosAgrupados, cantidadesEditadas, handleCantidadChange, handleEliminarArticulo,
    articulosExtra, handleCantidadExtraChange, handleQuitarExtra, marcadosHerramienta, toggleHerramienta, busqueda, setBusqueda,
    resultadosBusqueda, handleAgregarArticulo, calcularTotal, handleSubmit,
  } = p;

  const filas = [
    ...articulosAgrupados.map((item) => ({ clave: `s${item.articulo?.id}`, extra: false, articulo: item.articulo, item })),
    ...articulosExtra.map((e) => ({ clave: `e${e.articulo.id}`, extra: true, articulo: e.articulo, cantidad: e.cantidad })),
  ];
  const valorCantidad = (f) => (f.extra ? f.cantidad
    : (f.articulo?.id in cantidadesEditadas ? cantidadesEditadas[f.articulo?.id] : f.item.cantidad_total));
  const costo = (f) => parseFloat(f.articulo?.costo_unitario || 0);

  const columnas = [
    {
      id: 'articulo', titulo: 'Artículo',
      celda: (f) => (
        <span className="r2c-celda-doble">
          <span className="r2c-fuerte">{f.articulo?.nombre}</span>
          {f.extra ? <span className="r2c-sec r2-tono--info">Agregado</span>
            : f.item.solicitudes.length > 1 ? <span className="r2c-sec">{plural(f.item.solicitudes.length, 'solicitud', 'solicitudes')}</span> : null}
        </span>
      ),
    },
    {
      id: 'cantidad', titulo: 'Cantidad', ancho: '160px', sinBoton: true,
      celda: (f) => (
        <span className="r2c-cantidad-celda">
          <input type="number" min="0" step="1" className="r2-entrada r2c-entrada-num" value={valorCantidad(f)}
            aria-label={`Cantidad de ${f.articulo?.nombre}`}
            onChange={(e) => (f.extra ? handleCantidadExtraChange(f.articulo.id, e.target.value) : handleCantidadChange(f.articulo?.id, e.target.value))} />
          <span className="r2c-unidad">{f.articulo?.unidad}</span>
        </span>
      ),
    },
    { id: 'costo', titulo: 'Costo', alinear: 'der', ocultarEn: 'celular-ancho', celda: (f) => dinero(costo(f)) },
    { id: 'subtotal', titulo: 'Subtotal', alinear: 'der', celda: (f) => <span className="r2c-fuerte">{dinero((parseFloat(valorCantidad(f)) || 0) * costo(f))}</span> },
    {
      id: 'herramienta', titulo: 'Herramienta', alinear: 'centro', ancho: '104px', sinBoton: true,
      celda: (f) => {
        const yaEs = !!f.articulo?.es_herramienta;
        return (
          <span title={yaEs ? 'Ya está dado de alta como herramienta' : 'Marcar este artículo como herramienta en el inventario'}>
            <Casilla soloCasilla marcada={yaEs || marcadosHerramienta.has(f.articulo?.id)} deshabilitado={yaEs}
              alCambiar={() => toggleHerramienta(f.articulo?.id)} etiqueta={`${f.articulo?.nombre}: es herramienta`} />
          </span>
        );
      },
    },
  ];

  const total = calcularTotal();
  const dato = [
    plural(solicitudes.length, 'solicitud', 'solicitudes'),
    plural(articulosAgrupados.length, 'artículo', 'artículos'),
    articulosExtra.length ? plural(articulosExtra.length, 'agregado', 'agregados') : null,
  ].filter(Boolean).join(' · ');

  return (
    <Cajon abierto alCerrar={onClose} ancho="ancho" etiqueta="Armar orden de compra"
      cambiosSinGuardar={articulosExtra.length > 0 || Boolean(observaciones?.trim())}>
      <form className="r2c-forma" onSubmit={handleSubmit}>
        <CajonCabecera titulo="Armar orden de compra" dato={dato} alCerrar={onClose} />
        <CajonCuerpo>
          <SeccionCajon>
            <Campo etiqueta="Proveedor (opcional)">
              <Selector value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} vacio="Elegir proveedor…"
                opciones={proveedores.map((pr) => ({ valor: String(pr.id), texto: pr.nombre }))} />
            </Campo>
            {preferido && (
              <p className="r2c-linea-ok"><Check size={16} aria-hidden="true" /> Proveedor preferido de {solicitudes.length === 1 ? 'este artículo' : 'estos artículos'}: {preferido}</p>
            )}
          </SeccionCajon>

          <SeccionCajon titulo="Artículos de la orden" accion={<span className="r2c-total-seccion">Total {dinero(total)}</span>}>
            {articulosAgrupados.length === 0 && (
              <Vacio compacto titulo="No hay artículos de solicitudes en esta orden" texto="Se quitaron todos: cierra y vuelve a armarla." />
            )}
            {filas.length > 0 && (
              <Tabla etiqueta="Artículos de la orden" densidad="compacta" fija={false} clave="clave" columnas={columnas} filas={filas}
                masAcciones={(f) => [{
                  texto: 'Quitar de la orden', icono: Trash2, peligro: true,
                  alHacer: () => (f.extra ? handleQuitarExtra(f.articulo.id) : handleEliminarArticulo(f.articulo?.id)),
                }]}
                filaCelular={(f) => ({
                  principal: f.articulo?.nombre,
                  secundario: `${dinero(costo(f))} c/u${f.extra ? ' · agregado' : ''}`,
                  derecha: (
                    <span className="r2c-cantidad-celda">
                      <input type="number" min="0" step="1" className="r2-entrada r2c-entrada-num" value={valorCantidad(f)}
                        aria-label={`Cantidad de ${f.articulo?.nombre}`}
                        onChange={(e) => (f.extra ? handleCantidadExtraChange(f.articulo.id, e.target.value) : handleCantidadChange(f.articulo?.id, e.target.value))} />
                    </span>
                  ),
                })} />
            )}
          </SeccionCajon>

          <SeccionCajon titulo="Agregar productos de este proveedor">
            <div className="r2-busqueda r2c-busqueda-ancha" role="search">
              <Search size={18} aria-hidden="true" className="r2-busqueda-lupa" />
              <input type="search" className="r2-busqueda-campo" value={busqueda} disabled={!proveedorId} autoComplete="off"
                aria-label="Buscar productos del proveedor" onChange={(e) => setBusqueda(e.target.value)}
                placeholder={proveedorId ? 'Nombre, código o categoría' : 'Primero elige el proveedor'} />
            </div>
            {proveedorId && busqueda.trim().length >= 2 && (resultadosBusqueda.length === 0 ? (
              <Vacio compacto sinResultados busqueda={busqueda} texto="No hay productos de este proveedor con esa búsqueda." />
            ) : (
              <Lista etiqueta="Productos del proveedor">
                {resultadosBusqueda.map((art) => (
                  <FilaLista key={art.id} principal={art.nombre}
                    secundario={`Existencia ${numero(parseFloat(art.stock_actual || 0))} ${art.unidad || ''}`}
                    accion={<Boton nivel="tonal" tamano="chico" icono={Plus} alHacer={() => handleAgregarArticulo(art)} aria-label={`Agregar ${art.nombre}`}>Agregar</Boton>} />
                ))}
              </Lista>
            ))}
            <Nota>Solo aparecen productos que surte el proveedor elegido.</Nota>
          </SeccionCajon>

          <SeccionCajon titulo="Entrega y notas">
            <Campo etiqueta="Fecha de llegada estimada (opcional)">
              <Entrada type="date" value={fechaLlegadaEstimada} onChange={(e) => setFechaLlegadaEstimada(e.target.value)} className="r2c-entrada-media" />
            </Campo>
            <Campo etiqueta="Observaciones">
              <Area rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas para esta orden" />
            </Campo>
          </SeccionCajon>
        </CajonCuerpo>
        <CajonPie resumen={`Total estimado ${dinero(total)}`}>
          <Boton nivel="fantasma" alHacer={onClose} deshabilitado={loading}>Cancelar</Boton>
          <Boton nivel="principal" tipo="submit" icono={ShoppingCart} cargando={loading} deshabilitado={articulosAgrupados.length === 0}
            motivo="La orden necesita al menos un artículo de las solicitudes">Crear orden</Boton>
        </CajonPie>
      </form>
    </Cajon>
  );
}

