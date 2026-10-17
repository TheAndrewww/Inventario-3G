// Rediseño 2 · grupo inventario · nuevo / editar artículo en un cajón ancho (ArticuloFormModal encendido; también lo abre
// Orden de salida). Secciones en el orden en que se piensa: Qué es → Dónde va → Cuánto → Código → Compra → Foto (al final).
// Los campos obligatorios llevan su marca y la ayuda del código aparece una sola vez. Mismo estado, mismas validaciones y
// mismos manejadores del componente de siempre (handleSubmit, handleIngresoInventario, crear categoría/ubicación/proveedor
// al vuelo…). El «modo ingreso» de hoy (elegir un artículo que ya existe para sumarle existencias) se conserva.
import { Plus, X, Check, Save, PackagePlus } from 'lucide-react';
import { Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon } from '../fundacion/piezas/Cajon';
import { Boton, BotonIcono } from '../fundacion/piezas/Boton';
import { Campo, Entrada, Area, Selector, Casilla } from '../fundacion/piezas/Campos';
import { Datos } from '../fundacion/piezas/Datos';
import { Nota } from '../fundacion/piezas/Ayudas';
import { cantidad, numero } from '../fundacion/formato';
import { ImageUpload } from '../../components/common';
import EAN13InputScanner from '../../components/articulos/EAN13InputScanner';
import { num } from './ayudas';
import './inventario.css';

const UNIDADES = [
  { valor: 'piezas', texto: 'Piezas' },
  { valor: 'kg', texto: 'Kilogramos' },
  { valor: 'litros', texto: 'Litros' },
  { valor: 'metros', texto: 'Metros' },
];

// Formulario corto para crear al vuelo (categoría, ubicación o proveedor): dos campos, «Guardar» y «Cancelar»
function CrearAlVuelo({ titulo, campos, alGuardar, alCancelar, guardando, textoGuardar }) {
  const teclas = (e, conEnter) => {
    if (e.key === 'Enter') { e.preventDefault(); if (conEnter) conEnter(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); alCancelar(); }
  };
  return (
    <div className="r2-inv-al-vuelo" role="group" aria-label={titulo}>
      <p className="r2-inv-etiqueta">{titulo}</p>
      <div className="r2-inv-al-vuelo-campos">
        {campos.map((c, i) => (
          <Entrada key={c.etiqueta} type="text" aria-label={c.etiqueta} placeholder={c.ejemplo} value={c.valor} disabled={guardando}
            className="r2-inv-mayusculas" autoFocus={i === 0} onChange={(e) => c.alCambiar(e.target.value)} onKeyDown={(e) => teclas(e, c.alEnter)} />
        ))}
      </div>
      <div className="r2-inv-al-vuelo-botones">
        <Boton nivel="tonal" tamano="chico" icono={Check} alHacer={alGuardar} cargando={guardando}>{textoGuardar}</Boton>
        <Boton nivel="fantasma" tamano="chico" alHacer={alCancelar} deshabilitado={guardando}>Cancelar</Boton>
      </div>
      <p className="r2-campo-ayuda">Guárdalo o cancélalo antes de guardar el artículo.</p>
    </div>
  );
}

export default function CajonFormArticulo({ f }) {
  const fd = f.formData;
  const evento = (name, value) => ({ target: { name, value } });
  const titulo = f.isEdit ? (f.esEdicionLimitada ? 'Editar nombre y foto' : 'Editar artículo')
    : f.modoIngreso ? 'Registrar entrada' : f.esAlmacen ? 'Nueva clave' : 'Nuevo artículo';
  const dato = f.modoIngreso ? 'A un artículo que ya existe'
    : !f.isEdit && f.almacenLimitado ? 'Irá a «Nuevos por autorizar» para que Dirección la complete'
      : f.isEdit ? f.articulo?.nombre : null;
  const sucio = f.modoIngreso ? Boolean(f.cantidadIngreso || f.observacionesIngreso)
    : f.isEdit ? Boolean(f.selectedImage) || ['nombre', 'descripcion', 'codigo_ean13'].some((k) => String(fd[k] ?? '') !== String(f.articulo?.[k] ?? ''))
      : Boolean(fd.nombre.trim() || fd.descripcion.trim() || fd.codigo_ean13 || fd.stock_actual || f.selectedImage);
  const enviar = (e) => (f.modoIngreso ? f.handleIngresoInventario(e) : f.handleSubmit(e));

  const textoPrincipal = f.modoIngreso
    ? (num(f.cantidadIngreso) > 0 ? `Registrar entrada de ${cantidad(num(f.cantidadIngreso), f.articuloSeleccionado?.unidad)}` : 'Registrar entrada')
    : f.isEdit ? 'Guardar cambios' : f.almacenLimitado ? 'Guardar clave' : 'Guardar artículo';

  const ayudaCodigo = (() => {
    if (fd.codigo_ean13 && fd.codigo_tipo) {
      const tipo = f.tiposCodigo.find((t) => t.value === fd.codigo_tipo)?.label;
      if (!f.isEdit && /^[0-9]{13}$/.test(fd.codigo_ean13)) return `Tipo detectado: ${tipo}. Se usará el código que escribiste.`;
      return `Tipo detectado: ${tipo}.${f.isEdit ? ' Cambiarlo reemplaza el código actual del artículo.' : ''}`;
    }
    if (!f.isEdit) return 'Escanéalo o escríbelo. Si lo dejas vacío, se genera uno automáticamente.';
    return 'Escanéalo o escríbelo. Cambiarlo reemplaza el código actual del artículo.';
  })();

  const campoCodigo = (
    <Campo etiqueta={f.isEdit ? 'Código de barras, QR o clave' : 'Código de barras, QR o clave (opcional)'} ayuda={ayudaCodigo}>
      <EAN13InputScanner value={fd.codigo_ean13} onChange={f.handleEAN13Change} onTypeDetected={f.handleTypeDetected} disabled={f.loading} />
    </Campo>
  );

  const campoNombre = (
    <div className="r2-inv-nombre-campo">
      <Campo etiqueta="Nombre" requerido>
        <Entrada type="text" name="nombre" value={fd.nombre} onChange={f.handleChange} className="r2-inv-mayusculas" autoComplete="off"
          placeholder="Por ejemplo: tornillo hexagonal 1/4" required
          onFocus={() => { if (f.articulosFiltrados.length > 0) f.setMostrarAutocomplete(true); }}
          onBlur={() => { setTimeout(() => f.setMostrarAutocomplete(false), 300); }} />
      </Campo>
      {!f.isEdit && f.mostrarAutocomplete && f.articulosFiltrados.length > 0 && (
        <div className="r2-inv-sugerencias" role="listbox" aria-label="Artículos que ya existen">
          <p className="r2-inv-sugerencias-cab">Ya existe: elige uno para registrarle una entrada en lugar de crearlo otra vez</p>
          {f.articulosFiltrados.slice(0, 10).map((art) => (
            <button key={art.id} type="button" role="option" aria-selected="false" className="r2-inv-sugerencia" onClick={() => f.handleSeleccionarArticulo(art)}>
              <span className="r2-fila-lineas">
                <span className="r2-fila-principal">{art.nombre}</span>
                <span className="r2-fila-secundario">Existencia {cantidad(num(art.stock_actual), art.unidad)}{art.categoria ? ` · ${art.categoria.nombre}` : ''}</span>
              </span>
              <span className="r2-inv-sugerencia-accion">Registrar entrada</span>
            </button>
          ))}
          {f.articulosFiltrados.length > 10 && (
            <p className="r2-inv-sugerencias-pie">Se muestran 10 de {numero(f.articulosFiltrados.length)}. Sigue escribiendo para afinar.</p>
          )}
        </div>
      )}
    </div>
  );

  const foto = (
    <ImageUpload currentImage={f.currentImageUrl} onImageSelect={f.handleImageSelect} onImageRemove={f.handleImageRemove} disabled={f.loading} />
  );

  let cuerpo;
  if (f.modoIngreso && f.articuloSeleccionado) {
    const art = f.articuloSeleccionado;
    const despues = num(art.stock_actual) + num(f.cantidadIngreso);
    cuerpo = (
      <>
        <SeccionCajon titulo="Artículo" accion={<Boton nivel="fantasma" tamano="chico" icono={X} alHacer={f.handleCancelarModoIngreso}>Crear uno nuevo</Boton>}>
          <p className="r2-inv-ficha-nombre">{art.nombre}</p>
          {art.descripcion && <p className="r2-nota">{art.descripcion}</p>}
          <Datos columnas={2} datos={[
            ['Existencia', cantidad(num(art.stock_actual), art.unidad)],
            ['Categoría', art.categoria?.nombre || '—'],
            ['Ubicación', art.ubicacion?.codigo || '—'],
          ]} />
        </SeccionCajon>
        <SeccionCajon titulo="Entrada">
          <Campo etiqueta="Cantidad que entra" requerido>
            <Entrada type="number" min="0" step={f.unidadEsEntera(art.unidad) ? '1' : '0.01'} inputMode="decimal" value={f.cantidadIngreso}
              className="r2-inv-cantidad-grande" onChange={(e) => f.cambiarCantidadIngreso(e.target.value)} placeholder="0" required autoFocus />
          </Campo>
          {num(f.cantidadIngreso) > 0 && (
            <p className="r2-inv-previa" role="status">
              <span className="r2-inv-previa-etq">Queda</span>
              <span className="r2-num">{cantidad(num(art.stock_actual), art.unidad)}</span>→<strong className="r2-num">{cantidad(despues, art.unidad)}</strong>
            </p>
          )}
          <Campo etiqueta="Observaciones">
            <Area rows={3} value={f.observacionesIngreso} onChange={(e) => f.setObservacionesIngreso(e.target.value)} className="r2-inv-mayusculas"
              placeholder="Motivo del ingreso, proveedor, etc." />
          </Campo>
        </SeccionCajon>
      </>
    );
  } else if (f.almacenLimitado) {
    cuerpo = (
      <>
        <SeccionCajon titulo="Qué es">
          {(!f.isEdit || !f.almacenLimitado) && campoCodigo}
          {campoNombre}
        </SeccionCajon>
        <SeccionCajon titulo="Foto">{foto}</SeccionCajon>
        <Nota>
          {f.isEdit ? 'Solo puedes cambiar el nombre y la foto del artículo.'
            : 'Solo capturas nombre y foto. La clave nueva se envía a «Nuevos por autorizar» y Dirección completa proveedor, existencia, almacén y mejora la foto.'}
        </Nota>
      </>
    );
  } else {
    const catDelAlmacen = f.categorias.filter((cat) => (
      String(cat.id) === String(fd.categoria_id) || (f.almacenSeleccionadoForm && String(cat.almacen_id) === String(f.almacenSeleccionadoForm))
    ));
    const ubiDelAlmacen = f.ubicaciones.filter((ub) => f.almacenSeleccionadoForm && String(ub.almacen_id || ub.almacen_ref?.id) === String(f.almacenSeleccionadoForm));
    cuerpo = (
      <>
        <SeccionCajon titulo="Qué es">
          {campoNombre}
          <Campo etiqueta="Descripción">
            <Area name="descripcion" rows={2} value={fd.descripcion} onChange={f.handleChange} className="r2-inv-mayusculas"
              placeholder="Medidas, material o para qué se usa" />
          </Campo>
          {f.esAdministrador && (
            <Casilla marcada={fd.es_herramienta || false} alCambiar={f.cambiarEsHerramienta}
              texto="Es una herramienta (crea unidades individuales que se pueden rastrear)" />
          )}
        </SeccionCajon>

        <SeccionCajon titulo="Dónde va">
          <div className="r2-inv-rejilla-campos">
            <Campo etiqueta="Almacén" requerido className="r2-inv-campo-doble">
              <Selector value={f.almacenSeleccionadoForm} onChange={(e) => f.cambiarAlmacenForm(e.target.value)} disabled={f.loading} required
                vacio="Elige un almacén" opciones={f.almacenes.map((al) => ({ valor: al.id, texto: al.nombre }))} />
            </Campo>
            <div className="r2-inv-campo-con-accion">
              {!f.showNuevaCategoria ? (
                <Campo etiqueta="Categoría" requerido>
                  <Selector key={`cat-${f.categorias.length}-${f.almacenSeleccionadoForm}`} name="categoria_id" value={fd.categoria_id}
                    onChange={f.handleChange} disabled={f.loading || (!f.almacenSeleccionadoForm && !fd.categoria_id)} required
                    vacio={(f.almacenSeleccionadoForm || fd.categoria_id) ? 'Elige una categoría' : 'Primero elige un almacén'}
                    opciones={catDelAlmacen.map((c) => ({ valor: c.id, texto: c.nombre }))} />
                </Campo>
              ) : (
                <CrearAlVuelo titulo="Nueva categoría" guardando={f.creandoCategoria} textoGuardar="Guardar categoría"
                  alGuardar={f.handleCrearCategoriaRapido} alCancelar={f.handleCancelarNuevaCategoria}
                  campos={[
                    { etiqueta: 'Nombre de la categoría', ejemplo: 'Nombre (por ejemplo: tornillería)', valor: f.nuevaCategoriaData.nombre,
                      alCambiar: (v) => f.setNuevaCategoriaData((x) => ({ ...x, nombre: v })),
                      alEnter: () => { if (f.nuevaCategoriaData.nombre.trim() && f.nuevaCategoriaData.descripcion.trim()) f.handleCrearCategoriaRapido(); } },
                    { etiqueta: 'Descripción de la categoría', ejemplo: 'Descripción (opcional)', valor: f.nuevaCategoriaData.descripcion,
                      alCambiar: (v) => f.setNuevaCategoriaData((x) => ({ ...x, descripcion: v })),
                      alEnter: () => { if (f.nuevaCategoriaData.nombre.trim()) f.handleCrearCategoriaRapido(); } },
                  ]} />
              )}
              {!f.showNuevaCategoria && f.almacenSeleccionadoForm && (
                <Boton nivel="fantasma" tamano="chico" icono={Plus} alHacer={() => f.handleChange(evento('categoria_id', 'nueva_categoria'))}>Nueva categoría</Boton>
              )}
            </div>
            <div className="r2-inv-campo-con-accion">
              {!f.showNuevaUbicacion ? (
                <Campo etiqueta="Ubicación" requerido>
                  <Selector key={`ubi-${f.ubicaciones.length}-${f.almacenSeleccionadoForm}`} name="ubicacion_id" value={fd.ubicacion_id}
                    onChange={f.handleChange} disabled={f.loading || !f.almacenSeleccionadoForm} required
                    vacio={f.almacenSeleccionadoForm ? 'Elige una ubicación' : 'Primero elige un almacén'}
                    opciones={ubiDelAlmacen.map((ub) => ({ valor: ub.id, texto: `${ub.codigo}${ub.descripcion ? ` · ${ub.descripcion}` : ''}` }))} />
                </Campo>
              ) : (
                <CrearAlVuelo titulo="Nueva ubicación" guardando={f.creandoUbicacion} textoGuardar="Guardar ubicación"
                  alGuardar={f.handleCrearUbicacionRapido} alCancelar={f.handleCancelarNuevaUbicacion}
                  campos={[
                    { etiqueta: 'Código de la ubicación', ejemplo: 'Código (por ejemplo: A-01)', valor: f.nuevaUbicacionData.codigo,
                      alCambiar: (v) => f.setNuevaUbicacionData((x) => ({ ...x, codigo: v })),
                      alEnter: () => { if (f.nuevaUbicacionData.codigo.trim() && f.nuevaUbicacionData.descripcion.trim()) f.handleCrearUbicacionRapido(); } },
                    { etiqueta: 'Descripción de la ubicación', ejemplo: 'Descripción (opcional)', valor: f.nuevaUbicacionData.descripcion,
                      alCambiar: (v) => f.setNuevaUbicacionData((x) => ({ ...x, descripcion: v })),
                      alEnter: () => { if (f.nuevaUbicacionData.codigo.trim()) f.handleCrearUbicacionRapido(); } },
                  ]} />
              )}
              {!f.showNuevaUbicacion && f.almacenSeleccionadoForm && (
                <Boton nivel="fantasma" tamano="chico" icono={Plus} alHacer={() => f.handleChange(evento('ubicacion_id', 'nueva_ubicacion'))}>Nueva ubicación</Boton>
              )}
            </div>
          </div>
        </SeccionCajon>

        <SeccionCajon titulo="Cuánto">
          <div className="r2-inv-rejilla-campos r2-inv-rejilla-campos--cuatro">
            <Campo etiqueta="Unidad">
              <Selector name="unidad" value={fd.unidad} onChange={f.handleChange} opciones={UNIDADES} />
            </Campo>
            <Campo etiqueta="Existencia actual" requerido>
              <Entrada type="number" name="stock_actual" min="0" step={f.unidadEsEntera(fd.unidad) ? '1' : '0.01'} inputMode="decimal"
                value={fd.stock_actual} onChange={f.handleChange} placeholder="100" required />
            </Campo>
            <Campo etiqueta="Mínimo" requerido>
              <Entrada type="number" name="stock_minimo" min="0" step={f.unidadEsEntera(fd.unidad) ? '1' : '0.01'} inputMode="decimal"
                value={fd.stock_minimo} onChange={f.handleChange} placeholder="20" required />
            </Campo>
            <Campo etiqueta="Máximo">
              <Entrada type="number" name="stock_maximo" min="0" step={f.unidadEsEntera(fd.unidad) ? '1' : '0.01'} inputMode="decimal"
                value={fd.stock_maximo} onChange={f.handleChange} placeholder="500" />
            </Campo>
          </div>
        </SeccionCajon>

        <SeccionCajon titulo="Código">{campoCodigo}</SeccionCajon>

        <SeccionCajon titulo="Compra" accion={<Boton nivel="fantasma" tamano="chico" icono={Plus} alHacer={f.handleAgregarProveedor}>Agregar proveedor</Boton>}>
          <Campo etiqueta="Costo unitario" ancho="220px">
            <Entrada type="number" name="costo_unitario" min="0" step="0.01" inputMode="decimal" value={fd.costo_unitario} onChange={f.handleChange} placeholder="0.00" />
          </Campo>
          {f.proveedoresSeleccionados.length === 0 ? (
            <p className="r2-nota">Sin proveedores. Usa «Agregar proveedor» para elegir uno o varios.</p>
          ) : (
            <ul className="r2-lista r2-inv-proveedores" aria-label="Proveedores del artículo">
              {f.proveedoresSeleccionados.map((prov, i) => (
                <li key={i} className="r2-inv-proveedor">
                  <Selector aria-label={`Proveedor ${i + 1}`} value={prov.proveedor_id} required vacio="Elige un proveedor"
                    onChange={(e) => f.handleProveedorChange(i, 'proveedor_id', e.target.value)}
                    opciones={f.proveedores.map((x) => ({ valor: x.id, texto: x.nombre }))} />
                  <Entrada type="number" aria-label={`Costo con el proveedor ${i + 1}`} min="0" step="0.01" placeholder="Costo" inputMode="decimal"
                    value={prov.costo_unitario} onChange={(e) => f.handleProveedorChange(i, 'costo_unitario', e.target.value)} className="r2-inv-proveedor-costo" />
                  <Casilla marcada={prov.es_preferido} alCambiar={() => f.handleMarcarPreferido(i)} texto="Preferido" />
                  <BotonIcono icono={X} etiqueta={`Quitar el proveedor ${i + 1}`} alHacer={() => f.handleEliminarProveedor(i)} />
                </li>
              ))}
            </ul>
          )}
          {f.showNuevoProveedor ? (
            <CrearAlVuelo titulo="Proveedor nuevo" guardando={f.creandoProveedor} textoGuardar="Guardar proveedor"
              alGuardar={f.handleCrearProveedorRapido} alCancelar={f.handleCancelarNuevoProveedor}
              campos={[{ etiqueta: 'Nombre del proveedor nuevo', ejemplo: 'Nombre del proveedor', valor: f.nuevoProveedorNombre,
                alCambiar: f.setNuevoProveedorNombre, alEnter: f.handleCrearProveedorRapido }]} />
          ) : f.puedeCrearProveedores && (
            <Boton nivel="fantasma" tamano="chico" icono={Plus} alHacer={() => f.setShowNuevoProveedor(true)}>Crear proveedor nuevo</Boton>
          )}
        </SeccionCajon>

        <SeccionCajon titulo="Foto">{foto}</SeccionCajon>
      </>
    );
  }

  return (
    <Cajon abierto={f.isOpen} alCerrar={f.handleClose} ancho="ancho" etiqueta={titulo} cambiosSinGuardar={sucio && !f.loading}>
      {/* Formulario con la validación del navegador de siempre (los campos obligatorios avisan antes de mandar) */}
      <form className="r2-inv-form-cajon" onSubmit={enviar}>
        <CajonCabecera titulo={titulo} dato={dato} alCerrar={f.handleClose} />
        <CajonCuerpo>{cuerpo}</CajonCuerpo>
        <CajonPie>
          <Boton nivel="fantasma" alHacer={f.modoIngreso ? f.handleCancelarModoIngreso : f.handleClose} deshabilitado={f.loading}>
            {f.modoIngreso ? 'Volver' : 'Cancelar'}
          </Boton>
          <Boton nivel="principal" tipo="submit" icono={f.modoIngreso ? PackagePlus : Save} cargando={f.loading} deshabilitado={f.loading}>{textoPrincipal}</Boton>
        </CajonPie>
      </form>
    </Cajon>
  );
}
