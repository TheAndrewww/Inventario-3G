// Rediseño 2 · grupo inventario · la tabla de artículos de Inventario.
// Es una tabla real con las MISMAS clases de la Tabla de la fundación (r2-tabla, r2-renglon, r2-grupo…), armada aquí porque
// Inventario necesita dos cosas que la pieza común no trae: renglones hijos (las unidades de una herramienta, que se
// despliegan debajo sin contar en el grupo) y columnas con ancho ajustable (las de hoy, guardadas en la misma preferencia
// del navegador). En celular cada artículo es un renglón de dos líneas con <FilaLista>. Anotado «para la revisión final».
//
// No pide nada: todo lo que hace llama a los manejadores de la página (abrir detalle, entrada, salida, desplegar unidades…).
import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, Download, Printer, Loader2 } from 'lucide-react';
import { Lista, FilaLista } from '../fundacion/piezas/FilaLista';
import { MenuAcciones } from '../fundacion/piezas/MenuAcciones';
import { Boton } from '../fundacion/piezas/Boton';
import { Estado } from '../fundacion/piezas/Estado';
import { Miniatura } from '../fundacion/piezas/Miniatura';
import { Entrada } from '../fundacion/piezas/Campos';
import { clases } from '../fundacion/formato';
import AuthenticatedImage from '../../components/common/AuthenticatedImage';
import { existencia, minimoDe, estadoExistencia, ubicacionPorRevisar, ubicacionDe, unidadesHerramienta, unidades, estadoUnidad, num } from './ayudas';

const INTERACTIVOS = 'button, a, input, select, textarea, label, [role="menu"], [role="menuitem"]';

// Columnas de la tabla de escritorio. «clave» es la clave de la preferencia de anchos de hoy (inventario_col_widths_v3).
const COLUMNAS = [
  { id: 'articulo', titulo: 'Artículo', clave: 'articulo', nuevo: null, min: 200, max: 640 },
  { id: 'clave', titulo: 'Clave', fijo: 112, ocultar: 'tableta' },
  { id: 'ubicacion', titulo: 'Ubicación', clave: 'ubicacion', nuevo: 108, min: 88, max: 260 },
  { id: 'existencia', titulo: 'Existencia', clave: 'stockTotal', nuevo: 132, min: 112, max: 240, der: true },
  { id: 'minimo', titulo: 'Mínimo', fijo: 84, der: true, ocultar: 'tableta' },
  { id: 'categoria', titulo: 'Categoría', clave: 'categoria', nuevo: 140, min: 96, max: 320 },
  { id: 'seccion', titulo: 'Sección', clave: 'seccion', nuevo: 104, min: 88, max: 260, ocultar: 'tableta' },
];

const ocultarCls = (c) => (c.ocultar === 'tableta' ? 'r2-ocultar-tableta' : null);

// Ancho de cada columna: el que la persona ajustó (si lo cambió) o el nuevo por omisión; si no cabe, todas se reducen
// en la misma proporción para que nunca haya desplazamiento de lado.
function anchosDe(colWidths, porOmision, disponible, anchoAcciones, tableta) {
  const visibles = COLUMNAS.filter((c) => !(tableta && c.ocultar === 'tableta'));
  const propio = (c) => {
    if (c.fijo) return c.fijo;
    const guardado = colWidths?.[c.clave];
    const ajustado = guardado != null && guardado !== porOmision?.[c.clave];
    if (!ajustado) return c.nuevo;
    return Math.min(c.max, Math.max(c.min, guardado));
  };
  const anchos = Object.fromEntries(visibles.map((c) => [c.id, propio(c)]));
  if (!disponible) return anchos;
  const libreArticulo = anchos.articulo == null ? 240 : 0;
  const suma = Object.values(anchos).reduce((a, b) => a + (b || 0), 0) + anchoAcciones + libreArticulo;
  if (suma > disponible) {
    const ajustables = visibles.filter((c) => !c.fijo && anchos[c.id] != null);
    const fijos = visibles.filter((c) => c.fijo).reduce((a, c) => a + c.fijo, 0) + anchoAcciones + libreArticulo;
    const sumaAjustables = ajustables.reduce((a, c) => a + anchos[c.id], 0);
    const factor = Math.max(0.4, (disponible - fijos) / sumaAjustables);
    for (const c of ajustables) anchos[c.id] = Math.max(72, Math.floor(anchos[c.id] * factor));
  }
  return anchos;
}

function useAnchoDe(ref) {
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo) return undefined;
    const medir = () => setAncho(Math.round(nodo.getBoundingClientRect().width));
    medir();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
    ro?.observe(nodo);
    return () => ro?.disconnect();
  }, [ref]);
  return ancho;
}

// Celda «Artículo»: foto chica, nombre y una línea con la descripción (o en qué almacén está, si es de otro).
function CeldaArticulo({ item, otroAlmacen, encontrado }) {
  const imagen = item.imagenUrl;
  let segunda = item.descripcion;
  if (otroAlmacen) segunda = `En el almacén ${otroAlmacen}`;
  return (
    <span className="r2-inv-articulo">
      <Miniatura src={imagen} alt={item.nombre} tamano={40} ampliable={false} />
      <span className="r2-inv-articulo-texto">
        <span className="r2-inv-nombre">{item.nombre}</span>
        {encontrado ? <span className="r2-inv-desc r2-tono--ok">Encontrada por su código</span>
          : segunda ? <span className={clases('r2-inv-desc', otroAlmacen && 'r2-inv-desc--otro')}>{segunda}</span> : null}
      </span>
    </span>
  );
}

// Celda «Existencia»: número con su unidad y, debajo, su estado (Agotado / Bajo mínimo); en ajuste rápido, un campo.
function CeldaExistencia({ item, ajuste, p, celular }) {
  if (item.es_herramienta) {
    const u = unidadesHerramienta(item);
    const abierta = p.herramientasExpandidas[item.id];
    const cargando = p.loadingUnidades[item.id];
    return (
      <button type="button" className="r2-inv-unidades-boton" aria-expanded={Boolean(abierta)} aria-busy={cargando || undefined}
        disabled={cargando} onClick={(e) => p.handleToggleHerramienta(item.id, e)}
        title={abierta ? 'Ocultar las unidades' : 'Ver las unidades'}>
        {cargando ? <Loader2 size={16} className="r2-girando" aria-hidden="true" />
          : abierta ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <span className="r2-inv-unidades-texto">
          <span className="r2-num">{unidades(u.total)}</span>
          <span className={clases('r2-inv-unidades-libres', u.total > 0 && u.libres === 0 && 'r2-tono--mal')}>{u.libres} libres</span>
        </span>
      </button>
    );
  }
  if (ajuste) {
    const editado = p.stocksEditados[item.id] !== undefined;
    return (
      <span className="r2-inv-ajuste">
        <Entrada type="number" min="0" step={p.unidadEsEntera(item.unidad) ? '1' : 'any'} inputMode="decimal"
          aria-label={`Existencia nueva de ${item.nombre}`}
          value={p.stocksEditados[item.id] ?? String(num(item.stock_actual))}
          onChange={(e) => p.handleStockEditChange(item, e.target.value)} disabled={p.guardandoStocks}
          className={clases('r2-inv-ajuste-campo', editado && 'r2-inv-ajuste-campo--editado')} />
        {!celular && editado && <span className="r2-inv-ajuste-antes">antes {existencia(item)}</span>}
      </span>
    );
  }
  const est = estadoExistencia(item);
  const reciente = p.recienActualizados.has(item.id);
  return (
    <span className="r2-inv-existencia">
      <span className={clases('r2-inv-existencia-valor', est && `r2-tono--${est.tono}`)}>{existencia(item)}</span>
      {reciente ? <Estado tono="ok" texto="Actualizado" className="r2-inv-existencia-estado" />
        : est ? <Estado tono={est.tono} texto={est.texto} sinPunto className="r2-inv-existencia-estado" /> : null}
    </span>
  );
}

function CeldaUbicacion({ item, enConteo }) {
  const revisar = ubicacionPorRevisar(item);
  return (
    <span className="r2-inv-ubicacion">
      {revisar ? <Estado tono="aviso" texto={`${ubicacionDe(item)} · por revisar`} /> : <span className="r2-num">{ubicacionDe(item)}</span>}
      {enConteo && <span className="r2-inv-desc" title="Ya se contó en el ciclo actual del conteo cíclico">Contado</span>}
    </span>
  );
}

function marcaDe(item, p) {
  if (item.activo === false) return <Estado tono="neutro" texto="Desactivado" />;
  if (item.pendiente_revision) return <Estado tono="info" texto="Nuevo por autorizar" />;
  if (p.buscandoGlobalActivo && p.esDeOtroAlmacen(item)) return null;
  return null;
}

// Botones visibles del renglón (como mucho dos juntos: Entrada y Salida son una sola decisión) + «⋯» con lo demás
function AccionesRenglon({ item, acciones, celular }) {
  const { botones = [], menu = [] } = acciones(item, { celular }) || {};
  return (
    <span className="r2-celda-acciones-dentro">
      {botones.map((b) => (
        <Boton key={b.texto} nivel={b.nivel || 'fantasma'} tamano="chico" icono={b.icono} alHacer={b.alHacer}
          deshabilitado={b.deshabilitado} motivo={b.motivo} aria-label={b.etiqueta}>{b.texto}</Boton>
      ))}
      {menu.filter(Boolean).length > 0 && <MenuAcciones acciones={menu} tamano="chico" titulo={item.nombre} />}
    </span>
  );
}

function RenglonesUnidades({ item, p, visibles }) {
  const lista = p.unidadesHerramientas[item.id] || [];
  if (!p.herramientasExpandidas[item.id]) return null;
  if (lista.length === 0) {
    return (
      <tr className="r2-inv-subrenglon">
        <td colSpan={visibles.length + 1} className="r2-inv-subvacio">No hay unidades registradas para esta herramienta.</td>
      </tr>
    );
  }
  return lista.map((u) => {
    const est = estadoUnidad(u.estado);
    const abrir = (e) => p.handleVerDetalleUnidad(u, item.id, e);
    const celda = (c) => {
      if (c.id === 'articulo') {
        return (
          <button type="button" className="r2-celda-abrir r2-inv-unidad-abrir" onClick={(e) => { e.stopPropagation(); abrir(e); }}
            aria-label={`Ver la unidad ${u.codigo_unico}`}>
            <span className="r2-inv-unidad-codigo">{u.codigo_unico}</span>
            <span className="r2-inv-desc">Unidad n.º {u.id}</span>
          </button>
        );
      }
      if (c.id === 'clave') {
        return (
          <AuthenticatedImage src={`/herramientas-renta/unidades/${u.id}/barcode`} alt={`Código de ${u.codigo_unico}`}
            className="r2-inv-unidad-barras" placeholderClassName="r2-inv-unidad-barras r2-inv-unidad-barras--hueco" placeholderText="" />
        );
      }
      if (c.id === 'ubicacion') return <span className="r2-inv-desc">{u.usuarioAsignado?.nombre || u.equipoAsignado?.nombre || ''}</span>;
      if (c.id === 'existencia') return <Estado tono={est.tono} texto={est.texto} />;
      return null;
    };
    return (
      <tr key={`u-${u.id}`} className="r2-renglon r2-renglon--abre r2-inv-subrenglon"
        onClick={(e) => { if (!e.target.closest(INTERACTIVOS) || e.target.closest('.r2-celda-abrir')) abrir(e); }}>
        {visibles.map((c) => <td key={c.id} className={clases(c.der && 'r2-der', ocultarCls(c))}>{celda(c)}</td>)}
        <td className="r2-celda-acciones">
          <span className="r2-celda-acciones-dentro">
            <Boton nivel="fantasma" tamano="chico" icono={Eye} alHacer={abrir}>Ver detalle</Boton>
            <MenuAcciones tamano="chico" titulo={u.codigo_unico} acciones={[
              { texto: 'Descargar código', icono: Download, alHacer: () => p.handleDescargarCodigoBarras(u.id, u.codigo_unico) },
              { texto: 'Imprimir código', icono: Printer, alHacer: () => p.handleImprimirCodigoBarras(u.id, u.codigo_unico, item.nombre) },
            ]} />
          </span>
        </td>
      </tr>
    );
  });
}

export default function TablaArticulos({ grupos, p, acciones, celular, tableta, abiertoId, vacio }) {
  const marco = useRef(null);
  const disponible = useAnchoDe(marco);
  const [plegados, setPlegados] = useState(() => new Set());
  const alternar = (id) => setPlegados((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ajuste = p.modoAjusteStock && p.puedeAjustarStock;
  const conImagen = (a) => ({ ...a, imagenUrl: a.imagen_url ? p.getImageUrl(a.imagen_url) : null });
  const otroAlmacen = (a) => (p.buscandoGlobalActivo && p.esDeOtroAlmacen(a) ? (a.ubicacion?.almacen_ref?.nombre || 'otro') : null);
  const lista = grupos.filter((g) => g.filas.length);

  if (!lista.length) return <div className="r2-tabla-vacia">{vacio}</div>;

  // ───── Celular: renglones de dos líneas; las acciones con texto van en una tercera línea ─────
  if (celular) {
    return (
      <div className="r2-tabla-celular r2-inv-celular">
        {lista.map((g) => (
          <section key={g.id} className="r2-lista-seccion">
            <button type="button" className="r2-grupo-boton r2-grupo-boton--celular" aria-expanded={!plegados.has(g.id)} onClick={() => alternar(g.id)}>
              {plegados.has(g.id) ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
              <span>{g.titulo}</span><span className="r2-grupo-cuenta">{g.filas.length}</span>
            </button>
            {g.nota && !plegados.has(g.id) && <p className="r2-grupo-nota">{g.nota}</p>}
            {!plegados.has(g.id) && (
              <Lista etiqueta={g.titulo}>
                {g.filas.map((a0) => {
                  const a = conImagen(a0);
                  const est = estadoExistencia(a);
                  const otro = otroAlmacen(a);
                  const secundario = [otro ? `En ${otro}` : ubicacionDe(a), a.categoria?.nombre].filter(Boolean).join(' · ');
                  const filas = [
                    <FilaLista key={a.id} seleccionada={a.id === abiertoId || a.id === p.articuloEncontradoPorCodigo}
                      className="r2-inv-fila"
                      inicio={<Miniatura src={a.imagenUrl} alt={a.nombre} tamano={40} ampliable={false} />}
                      principal={a.nombre} secundario={secundario}
                      derecha={a.es_herramienta ? unidades(unidadesHerramienta(a).total)
                        : ajuste ? <CeldaExistencia item={a} ajuste p={p} celular /> : existencia(a)}
                      debajoDerecha={marcaDe(a, p) || (est && !ajuste ? <Estado tono={est.tono} texto={est.texto} sinPunto /> : null)}
                      alAbrir={() => p.handleVerDetalle(a0)} etiqueta={`Ver ${a.nombre}`}
                      accion={<AccionesRenglon item={a0} acciones={acciones} celular />} />,
                  ];
                  if (a.es_herramienta && p.herramientasExpandidas[a.id]) {
                    const us = p.unidadesHerramientas[a.id] || [];
                    if (!us.length) filas.push(<li key={`v-${a.id}`} className="r2-inv-subvacio">No hay unidades registradas.</li>);
                    for (const u of us) {
                      const eu = estadoUnidad(u.estado);
                      filas.push(
                        <FilaLista key={`u-${u.id}`} className="r2-inv-fila-unidad" principal={u.codigo_unico}
                          secundario={u.usuarioAsignado?.nombre || u.equipoAsignado?.nombre || `Unidad n.º ${u.id}`}
                          debajoDerecha={<Estado tono={eu.tono} texto={eu.texto} />}
                          alAbrir={(e) => p.handleVerDetalleUnidad(u, a.id, e || { stopPropagation() {} })}
                          accion={<MenuAcciones titulo={u.codigo_unico} acciones={[
                            { texto: 'Ver detalle', icono: Eye, alHacer: (e) => p.handleVerDetalleUnidad(u, a.id, e) },
                            { texto: 'Descargar código', icono: Download, alHacer: () => p.handleDescargarCodigoBarras(u.id, u.codigo_unico) },
                            { texto: 'Imprimir código', icono: Printer, alHacer: () => p.handleImprimirCodigoBarras(u.id, u.codigo_unico, a.nombre) },
                          ]} />} />,
                      );
                    }
                  }
                  return filas;
                })}
              </Lista>
            )}
          </section>
        ))}
      </div>
    );
  }

  // ───── Escritorio y tableta: tabla real, cabecera pegada, columnas ajustables ─────
  const anchoAcciones = p.anchoAcciones || 120;
  const anchos = anchosDe(p.colWidths, p.colWidthsPorOmision, disponible, anchoAcciones, tableta);
  const visibles = COLUMNAS.filter((c) => !(tableta && c.ocultar === 'tableta'));
  const nCols = visibles.length + 1;

  const iniciarAjuste = (c, e) => {
    if (!c.clave) return;
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.closest('th');
    const inicioX = e.clientX;
    const inicioAncho = Math.round(th.getBoundingClientRect().width);
    const mover = (ev) => {
      const siguiente = Math.min(c.max, Math.max(c.min, inicioAncho + ev.clientX - inicioX));
      p.setColWidths((prev) => ({ ...prev, [c.clave]: siguiente }));
    };
    const soltar = () => {
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', soltar);
  };

  return (
    <div ref={marco} className="r2-tabla-marco r2-inv-marco">
      <table className="r2-tabla r2-tabla--compacta r2-tabla--fija r2-inv-tabla" aria-label="Artículos">
        <colgroup>
          {visibles.map((c) => <col key={c.id} className={ocultarCls(c)} style={anchos[c.id] ? { width: anchos[c.id] } : undefined} />)}
          <col style={{ width: anchoAcciones }} />
        </colgroup>
        <thead>
          <tr>
            {visibles.map((c) => (
              <th key={c.id} scope="col" className={clases(c.der && 'r2-der', ocultarCls(c), c.clave && 'r2-inv-th-ajustable')}>
                <span className="r2-inv-th-texto">{c.titulo}</span>
                {c.clave && (
                  <span className="r2-inv-th-asa" role="separator" aria-orientation="vertical" aria-label={`Ajustar el ancho de ${c.titulo}`}
                    title="Arrastra para ajustar el ancho" onMouseDown={(e) => iniciarAjuste(c, e)} />
                )}
              </th>
            ))}
            <th scope="col" className="r2-celda-acciones"><span className="r2-solo-lectores">Acciones</span></th>
          </tr>
        </thead>
        {lista.map((g) => (
          <tbody key={g.id}>
            <tr className="r2-grupo">
              <th colSpan={nCols} scope="rowgroup">
                <button type="button" className="r2-grupo-boton" aria-expanded={!plegados.has(g.id)} onClick={() => alternar(g.id)}>
                  {plegados.has(g.id) ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                  <span>{g.titulo}</span><span className="r2-grupo-cuenta">{g.filas.length}</span>
                </button>
                {g.nota && <span className="r2-grupo-nota">{g.nota}</span>}
              </th>
            </tr>
            {!plegados.has(g.id) && g.filas.map((a0) => {
              const a = conImagen(a0);
              const abrir = (e) => {
                if (e.target.closest(INTERACTIVOS) && !e.target.closest('.r2-celda-abrir')) return;
                if (window.getSelection?.().toString()) return;
                p.handleVerDetalle(a0);
              };
              const encontrado = p.articuloEncontradoPorCodigo === a.id;
              const marca = marcaDe(a, p);
              return [
                <tr key={a.id} onClick={abrir}
                  className={clases('r2-renglon r2-renglon--abre', (a.id === abiertoId || encontrado) && 'r2-renglon--abierto',
                    p.recienActualizados.has(a.id) && 'r2-inv-renglon--reciente')}>
                  {visibles.map((c, j) => {
                    let contenido = null;
                    if (c.id === 'articulo') contenido = <CeldaArticulo item={a} otroAlmacen={otroAlmacen(a)} encontrado={encontrado} />;
                    if (c.id === 'clave') {
                      contenido = (
                        <span className="r2-inv-clave">
                          <span className="r2-num" title={a.codigo_ean13 ? `Código ${a.codigo_ean13}` : undefined}>{a.sku || a.codigo_ean13 || '—'}</span>
                          {marca}
                        </span>
                      );
                    }
                    if (c.id === 'ubicacion') contenido = <CeldaUbicacion item={a} enConteo={p.articulosEnConteo.has(a.id)} />;
                    if (c.id === 'existencia') contenido = <CeldaExistencia item={a} ajuste={ajuste} p={p} />;
                    if (c.id === 'minimo') contenido = a.es_herramienta ? '—' : minimoDe(a);
                    if (c.id === 'categoria') contenido = <span className="r2-inv-texto-celda">{a.categoria?.nombre || 'Sin categoría'}</span>;
                    if (c.id === 'seccion') contenido = <span className="r2-inv-texto-celda">{a.seccion?.nombre || p.todasSecciones.find((s) => s.id === a.seccion_id)?.nombre || 'Sin sección'}</span>;
                    return (
                      <td key={c.id} className={clases(c.der && 'r2-der', ocultarCls(c))}>
                        {j === 0 ? (
                          <button type="button" className="r2-celda-abrir" onClick={(e) => { e.stopPropagation(); p.handleVerDetalle(a0); }}
                            aria-label={`Ver ${a.nombre}`}>
                            {contenido}
                          </button>
                        ) : contenido}
                      </td>
                    );
                  })}
                  <td className="r2-celda-acciones"><AccionesRenglon item={a0} acciones={acciones} /></td>
                </tr>,
                a.es_herramienta ? <RenglonesUnidades key={`us-${a.id}`} item={a} p={p} visibles={visibles} /> : null,
              ];
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

