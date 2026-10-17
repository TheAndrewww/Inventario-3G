// Rediseño 2 · grupo inventario · detalle del artículo en un cajón lateral (ArticuloDetalleModal encendido).
// Arriba la decisión (Entrada, Salida o Agregar a la orden según el rol, y «⋯» con Editar, Mejorar foto con IA y
// Desactivar); después lo que se busca: la existencia en grande con su mínimo y máximo, dónde está (aquí se cambian
// ubicación, categoría y sección con los mismos PUT de hoy), compra, último movimiento, unidades (herramientas) y al final
// el código de barras. Las peticiones son las del componente de siempre (último movimiento, unidades, código, IA).
import { PackagePlus, PackageMinus, Plus, Pencil, Sparkles, Ban, RotateCcw, Trash2 } from 'lucide-react';
import { Cajon, CajonCabecera, CajonDecision, CajonCuerpo, SeccionCajon } from '../fundacion/piezas/Cajon';
import { Boton } from '../fundacion/piezas/Boton';
import { MenuAcciones } from '../fundacion/piezas/MenuAcciones';
import { Estado } from '../fundacion/piezas/Estado';
import { Datos } from '../fundacion/piezas/Datos';
import { Fecha } from '../fundacion/piezas/Fecha';
import { Tabla } from '../fundacion/piezas/Tabla';
import { Cargando, Vacio } from '../fundacion/piezas/Estados';
import { Miniatura } from '../fundacion/piezas/Miniatura';
import { Campo, Selector } from '../fundacion/piezas/Campos';
import { Segmentado } from '../fundacion/piezas/Pestanas';
import { dinero, cantidad, numero } from '../fundacion/formato';
import { existencia, estadoExistencia, num, unidadesHerramienta, unidades as textoUnidades, estadoUnidad, ubicacionDe } from './ayudas';
import './inventario.css';

export default function CajonDetalleArticulo({
  articulo, abierto, alCerrar, imagenUrl, canEdit, onEdit, onEntrada, onSalida, puedeGestionarInventario, puedeRegistrarSalida,
  reprocessing, alMejorarFoto, ultimoMovimiento, cargandoMovimiento, unidadesLista, cargandoUnidades, alVerUnidad, codigoBarras,
  detalleUnidad, r2 = {},
}) {
  const a = articulo;
  const herr = a.es_herramienta;
  const est = a.activo === false ? { texto: 'Desactivado', tono: 'neutro' } : a.pendiente_revision ? { texto: 'Nuevo por autorizar', tono: 'info' } : estadoExistencia(a);
  const u = unidadesHerramienta(a);
  const entrar = (fn) => () => { fn(a); alCerrar(); };

  // Decisión según el rol (la de siempre: Entrada y Salida para almacén y Dirección; Agregar a la orden para diseño)
  const mueve = (puedeGestionarInventario && onEntrada) || (puedeRegistrarSalida && onSalida);
  const botones = [];
  if (puedeGestionarInventario && onEntrada) botones.push(<Boton key="e" nivel="tonal" icono={PackagePlus} alHacer={entrar(onEntrada)}>Entrada</Boton>);
  if (puedeRegistrarSalida && onSalida) botones.push(<Boton key="s" nivel="tonal" icono={PackageMinus} alHacer={entrar(onSalida)}>Salida</Boton>);
  if (r2.onAgregar && !mueve) botones.push(<Boton key="a" nivel="principal" icono={Plus} alHacer={() => r2.onAgregar(a)}>Agregar a la orden</Boton>);
  const menu = [
    r2.onAgregar && mueve ? { texto: 'Agregar a la orden de salida', icono: Plus, alHacer: () => r2.onAgregar(a) } : null,
    canEdit && onEdit ? { texto: 'Editar artículo', icono: Pencil, alHacer: entrar(onEdit) } : null,
    canEdit && a.imagen_url ? { texto: reprocessing ? 'Mejorando la foto…' : 'Mejorar la foto con IA', icono: Sparkles, deshabilitado: reprocessing, alHacer: alMejorarFoto } : null,
    r2.onReactivar ? { texto: r2.esAlmacen ? 'Pedir que se reactive' : 'Reactivar artículo', icono: RotateCcw, alHacer: () => r2.onReactivar(a) } : null,
    r2.onDesactivar ? { texto: r2.esAlmacen ? 'Pedir que se desactive' : 'Desactivar artículo', icono: Ban, peligro: true, alHacer: () => r2.onDesactivar(a) } : null,
    r2.onEliminarPermanente ? { texto: 'Eliminar permanentemente', icono: Trash2, peligro: true, alHacer: () => r2.onEliminarPermanente(a) } : null,
  ].filter(Boolean);

  const proveedor = a.proveedores?.find((x) => x.ArticuloProveedor?.es_preferido) || a.proveedor || a.proveedores?.[0];
  const otrosProveedores = (a.proveedores?.length || 0) - (proveedor ? 1 : 0);

  const opciones = (lista, texto, vacio) => [{ valor: '', texto: vacio }, ...lista.map((x) => ({ valor: x.id, texto: texto(x) }))];

  return (
    <Cajon abierto={abierto} alCerrar={alCerrar} etiqueta={`Detalle de ${a.nombre}`}>
      <CajonCabecera titulo={a.nombre} dato={a.sku ? `Clave ${a.sku}` : a.codigo_ean13 || null}
        estado={est ? <Estado tono={est.tono} texto={est.texto} /> : null} alCerrar={alCerrar} />
      {(botones.length > 0 || menu.length > 0) && (
        <CajonDecision>
          {botones}
          {menu.length > 0 && <MenuAcciones acciones={menu} titulo={a.nombre} />}
        </CajonDecision>
      )}
      <CajonCuerpo>
        <SeccionCajon titulo="Existencia">
          <div className="r2-inv-ficha-existencia">
            <div className="r2-inv-ficha-cifra">
              <span className={est && !herr && a.activo !== false && !a.pendiente_revision ? `r2-inv-cifra-grande r2-tono--${est.tono}` : 'r2-inv-cifra-grande'}>
                {herr ? textoUnidades(u.total) : existencia(a)}
              </span>
              <span className="r2-inv-ficha-linea">
                {herr ? `${numero(u.libres)} libres para asignar`
                  : `Mínimo ${num(a.stock_minimo) ? cantidad(num(a.stock_minimo), a.unidad) : '—'} · Máximo ${num(a.stock_maximo) ? cantidad(num(a.stock_maximo), a.unidad) : '—'}`}
              </span>
              {r2.enConteo && <span className="r2-inv-desc">Ya se contó en el ciclo actual del conteo cíclico</span>}
            </div>
            <Miniatura src={imagenUrl} alt={a.nombre} tamano={72} />
          </div>
          {a.descripcion && <p className="r2-inv-ficha-descripcion">{a.descripcion}</p>}
        </SeccionCajon>

        <SeccionCajon titulo="Dónde está">
          {r2.puedeCambiar && r2.alCambiar ? (
            <div className="r2-inv-rejilla-campos">
              <Campo etiqueta="Ubicación">
                <Selector value={a.ubicacion_id ?? ''} disabled={r2.actualizando} onChange={(e) => r2.alCambiar(a, 'ubicacion_id', e.target.value)}
                  opciones={opciones(r2.ubicaciones || [], (x) => x.codigo || x.nombre, 'Sin asignar')} />
              </Campo>
              <Campo etiqueta="Sección">
                <Selector value={a.seccion_id ?? ''} disabled={r2.actualizando} onChange={(e) => r2.alCambiar(a, 'seccion_id', e.target.value)}
                  opciones={opciones(r2.secciones || [], (x) => x.nombre, 'Sin sección')} />
              </Campo>
              <Campo etiqueta="Categoría" className="r2-inv-campo-doble">
                <Selector value={a.categoria_id ?? ''} disabled={r2.actualizando} onChange={(e) => r2.alCambiar(a, 'categoria_id', e.target.value)}
                  opciones={opciones(r2.categorias || [], (x) => x.nombre, 'Sin categoría')} />
              </Campo>
              <Datos datos={[['Almacén', r2.nombreAlmacen || a.ubicacion?.almacen_ref?.nombre || '—']]} />
            </div>
          ) : (
            <Datos columnas={2} datos={[
              ['Almacén', r2.nombreAlmacen || a.ubicacion?.almacen_ref?.nombre],
              ['Ubicación', ubicacionDe(a)],
              ['Sección', a.seccion?.nombre || 'Sin sección'],
              ['Categoría', a.categoria?.nombre || 'Sin categoría'],
            ]} />
          )}
          {a.ubicacion?.descripcion && <p className="r2-nota">{a.ubicacion.descripcion}</p>}
          {!herr && (r2.alCambiarMarcaLocal || r2.marcaLocal === 'extras') && (
            <div className="r2-inv-marca-local">
              <span className="r2-inv-etiqueta">Marca en este equipo</span>
              {r2.alCambiarMarcaLocal ? (
                <Segmentado etiqueta="Marca en este equipo" valor={r2.marcaLocal} alCambiar={(v) => r2.alCambiarMarcaLocal(a.id, v)}
                  opciones={[{ valor: 'stock', texto: 'Stock' }, { valor: 'extras', texto: 'Extras' }]} />
              ) : <span>{r2.marcaLocal === 'extras' ? 'Extras' : 'Stock'}</span>}
              <span className="r2-inv-desc">Solo se guarda en este navegador.</span>
            </div>
          )}
        </SeccionCajon>

        <SeccionCajon titulo="Compra">
          <Datos columnas={2} datos={[
            ['Costo unitario', dinero(num(a.costo_unitario))],
            ['Proveedor', proveedor ? `${proveedor.nombre}${otrosProveedores > 0 ? ` y ${otrosProveedores} más` : ''}` : 'Sin proveedor'],
          ]} />
        </SeccionCajon>

        <SeccionCajon titulo="Último movimiento">
          {cargandoMovimiento ? <Cargando forma="texto" filas={2} etiqueta="Cargando el último movimiento…" />
            : ultimoMovimiento ? (
              <div className="r2-inv-movimiento">
                <p className="r2-inv-movimiento-que">
                  <span>{ultimoMovimiento.tipo_legible}</span>
                  <strong className="r2-num">{cantidad(num(ultimoMovimiento.cantidad), a.unidad)}</strong>
                </p>
                <p className="r2-inv-desc">
                  {ultimoMovimiento.usuario ? `${ultimoMovimiento.usuario.nombre} (${ultimoMovimiento.usuario.rol}) · ` : ''}
                  <Fecha valor={ultimoMovimiento.fecha} />
                  {ultimoMovimiento.ticket_id ? ` · Ticket ${ultimoMovimiento.ticket_id}` : ''}
                </p>
              </div>
            ) : <p className="r2-nota">Sin movimientos registrados.</p>}
        </SeccionCajon>

        {herr && (
          <SeccionCajon titulo={`Unidades${unidadesLista.length ? ` · ${unidadesLista.length}` : ''}`}>
            {cargandoUnidades ? <Cargando forma="lista" filas={3} etiqueta="Cargando las unidades…" /> : (
              <Tabla etiqueta="Unidades de la herramienta" densidad="compacta" filas={unidadesLista} fija={false}
                alAbrir={alVerUnidad} etiquetaAbrir={(x) => `Ver la unidad ${x.codigo_unico}`}
                columnas={[
                  { id: 'codigo', titulo: 'Código', celda: (x) => <span className="r2-inv-unidad-codigo">{x.codigo_unico}</span> },
                  { id: 'estado', titulo: 'Estado', celda: (x) => { const e = estadoUnidad(x.estado); return <Estado tono={e.tono} texto={e.texto} />; } },
                  { id: 'quien', titulo: 'Asignada a', celda: (x) => x.usuarioAsignado?.nombre || x.equipoAsignado?.nombre || '—' },
                ]}
                filaCelular={(x) => { const e = estadoUnidad(x.estado); return { principal: x.codigo_unico, secundario: x.usuarioAsignado?.nombre || x.equipoAsignado?.nombre || 'Sin asignar', debajo: <Estado tono={e.tono} texto={e.texto} /> }; }}
                vacio={<Vacio compacto titulo="No hay unidades registradas para esta herramienta" />} />
            )}
          </SeccionCajon>
        )}

        {!herr && codigoBarras && <SeccionCajon titulo="Código de barras">{codigoBarras}</SeccionCajon>}
      </CajonCuerpo>
      {detalleUnidad}
    </Cajon>
  );
}
