// Rediseño 2 · Compras · «Crear artículo» desde una orden nueva, en cajón normal encima de la orden (vista ENCENDIDA de
// ModalNuevoArticulo). Mismos campos, mismo «Crear proveedor nuevo…» rápido y el mismo envío.
import { Check, X, Plus } from 'lucide-react';
import { Cajon, CajonCabecera, CajonCuerpo, CajonPie, Campo, Entrada, Area, Selector, Boton, BotonIcono, Nota } from '../fundacion';
import './compras.css';

const UNIDADES = [
  ['piezas', 'Piezas'], ['metros', 'Metros'], ['litros', 'Litros'], ['kilogramos', 'Kilogramos'],
  ['cajas', 'Cajas'], ['rollos', 'Rollos'], ['bolsas', 'Bolsas'], ['unidades', 'Unidades'],
];


export default function CajonNuevoArticulo({ onClose, formData, handleChange, categorias, ubicaciones, proveedoresList, modoNuevoProveedor,
  nuevoProveedorNombre, setNuevoProveedorNombre, handleCrearProveedorRapido, handleCancelarNuevoProveedor, loading, handleSubmit }) {
  return (
    <Cajon abierto alCerrar={onClose} etiqueta="Crear artículo" cambiosSinGuardar={Boolean(formData.nombre?.trim())}>
      <form className="r2c-forma" onSubmit={handleSubmit}>
        <CajonCabecera titulo="Crear artículo" dato="Se crea con existencia 0 y se agrega a la orden" alCerrar={onClose} />
        <CajonCuerpo>
          <div className="r2c-formulario">
            <Campo etiqueta="Nombre del artículo" requerido className="r2c-campo-doble">
              <Entrada type="text" name="nombre" value={formData.nombre} onChange={handleChange} required placeholder="Por ejemplo: Tornillo hexagonal 1/4" />
            </Campo>
            <Campo etiqueta="Descripción" className="r2c-campo-doble">
              <Area name="descripcion" rows={2} value={formData.descripcion} onChange={handleChange} />
            </Campo>
            <Campo etiqueta="Categoría" requerido>
              <Selector name="categoria_id" value={formData.categoria_id} onChange={handleChange} required>
                <option value="">Elegir categoría…</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Ubicación" requerido>
              <Selector name="ubicacion_id" value={formData.ubicacion_id} onChange={handleChange} required>
                <option value="">Elegir ubicación…</option>
                {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.codigo} · {u.almacen}</option>)}
              </Selector>
            </Campo>
            <div className="r2-campo r2c-campo-doble">
              <span className="r2-campo-etiqueta">Proveedor</span>
              {!modoNuevoProveedor ? (
                <Selector name="proveedor_id" value={formData.proveedor_id} onChange={handleChange}>
                  <option value="">Sin proveedor</option>
                  <option value="nuevo">Crear proveedor nuevo…</option>
                  {proveedoresList.map((pr) => <option key={pr.id} value={pr.id}>{pr.nombre}</option>)}
                </Selector>
              ) : (
                <>
                  <div className="r2c-fila-campo">
                    <Entrada type="text" value={nuevoProveedorNombre} onChange={(e) => setNuevoProveedorNombre(e.target.value)} autoFocus
                      aria-label="Nombre del proveedor nuevo" placeholder="Nombre del proveedor"
                      onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCrearProveedorRapido(); } }} />
                    <Boton nivel="tonal" icono={Check} alHacer={handleCrearProveedorRapido}>Crear</Boton>
                    <BotonIcono icono={X} etiqueta="Cancelar el proveedor nuevo" alHacer={handleCancelarNuevoProveedor} />
                  </div>
                  <p className="r2-campo-ayuda">Escribe el nombre y toca «Crear» (o Enter).</p>
                </>
              )}
            </div>
            <Campo etiqueta="Unidad de medida">
              <Selector name="unidad" value={formData.unidad} onChange={handleChange}>
                {UNIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Costo unitario">
              <Entrada type="number" name="costo_unitario" value={formData.costo_unitario} onChange={handleChange} min="0" step="0.01" placeholder="0.00" />
            </Campo>
            <Campo etiqueta="Existencia mínima">
              <Entrada type="number" name="stock_minimo" value={formData.stock_minimo} onChange={handleChange} min="0" step="1" />
            </Campo>
            <Campo etiqueta="Existencia máxima">
              <Entrada type="number" name="stock_maximo" value={formData.stock_maximo} onChange={handleChange} min="1" step="1" placeholder="Opcional" />
            </Campo>
          </div>
          <Nota className="r2c-nota-pie">Los campos con * son obligatorios.</Nota>
        </CajonCuerpo>
        <CajonPie>
          <Boton nivel="fantasma" alHacer={onClose} deshabilitado={loading}>Cancelar</Boton>
          <Boton nivel="principal" tipo="submit" icono={Plus} cargando={loading}>Crear y agregar</Boton>
        </CajonPie>
      </form>
    </Cajon>
  );
}
