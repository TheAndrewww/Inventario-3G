// Rediseño 2 · grupo inventario · «Generar etiquetas» en un cajón ancho.
// Filtros en una fila (buscar · tipo · etiquetado · ubicación), lista con casillas (por artículo y, en herramientas, por
// unidad) y al pie «Generar PDF de N etiquetas». Los filtros, la selección y el PDF son los de la página (mismo estado y
// mismos manejadores: handleSeleccionarTodosEtiquetas, handleToggleArticuloEtiqueta, handleToggleHerramientaEtiquetas,
// handleToggleUnidadEtiqueta, handleSeleccionarTodasUnidades, handleGenerarEtiquetas).
import { ChevronDown, ChevronRight, FileDown } from 'lucide-react';
import { Cajon, CajonCabecera, CajonCuerpo, CajonPie } from '../fundacion/piezas/Cajon';
import { Busqueda } from '../fundacion/piezas/BarraFiltros';
import { Segmentado } from '../fundacion/piezas/Pestanas';
import { Selector, Casilla } from '../fundacion/piezas/Campos';
import { Boton, BotonIcono } from '../fundacion/piezas/Boton';
import { Estado } from '../fundacion/piezas/Estado';
import { Vacio } from '../fundacion/piezas/Estados';
import { Miniatura } from '../fundacion/piezas/Miniatura';
import { plural, clases } from '../fundacion/formato';
import { existencia, ubicacionPorRevisar, unidades as textoUnidades, num } from './ayudas';

// Mismo filtro que la página (activos → tipo → ubicación → etiquetado → búsqueda)
function filtrar(p, conEtiquetado = true) {
  let lista = p.articulos.filter((a) => a.activo);
  if (p.filtroTipoEtiquetas === 'consumibles') lista = lista.filter((a) => !a.es_herramienta);
  else if (p.filtroTipoEtiquetas === 'herramientas') lista = lista.filter((a) => a.es_herramienta);
  if (p.filtroUbicacionEtiquetas !== 'todos') lista = lista.filter((a) => a.ubicacion_id === parseInt(p.filtroUbicacionEtiquetas, 10));
  if (conEtiquetado) {
    if (p.filtroEstadoEtiquetado === 'etiquetados') lista = lista.filter((a) => a.etiquetado === true);
    else if (p.filtroEstadoEtiquetado === 'sin_etiquetar') lista = lista.filter((a) => !a.etiquetado);
  }
  const q = p.busquedaEtiquetas.toLowerCase();
  return q.length > 0 ? lista.filter((a) => a.nombre.toLowerCase().includes(q) || a.codigo_ean13?.toLowerCase().includes(q)) : lista;
}

export default function CajonEtiquetas({ p }) {
  const abierto = p.modalEtiquetasOpen;
  const lista = abierto ? filtrar(p) : [];
  // El texto del botón se calcula como hoy (sin el filtro de etiquetado; ver «errores que ya existían»)
  const paraTexto = abierto ? filtrar(p, false) : [];
  const todos = paraTexto.length > 0 && paraTexto.every((a) => p.articulosSeleccionadosEtiquetas.includes(a.id));
  const nArt = p.articulosSeleccionadosEtiquetas.length;
  const nUni = p.unidadesSeleccionadasEtiquetas.length;
  const total = nArt + nUni;
  const cerrar = () => p.setModalEtiquetasOpen(false);

  const marca = (a) => {
    if (a.pendiente_revision) return <Estado tono="info" texto="Pendiente de autorizar" />;
    if (ubicacionPorRevisar(a)) return <Estado tono="aviso" texto="Ubicación por revisar" />;
    if (a.etiquetado) return <Estado tono="ok" texto="Etiquetado" />;
    return null;
  };

  return (
    <Cajon abierto={abierto} alCerrar={cerrar} ancho="ancho" etiqueta="Generar etiquetas">
      <CajonCabecera titulo="Generar etiquetas" dato="Elige los artículos y las unidades de herramienta que quieres imprimir." alCerrar={cerrar} />
      <div className="r2-inv-etq-filtros">
        <Busqueda valor={p.busquedaEtiquetas} alCambiar={p.setBusquedaEtiquetas} texto="Buscar por nombre o código" />
        <div className="r2-inv-etq-fila">
          <Segmentado etiqueta="Tipo de artículo" valor={p.filtroTipoEtiquetas} alCambiar={p.setFiltroTipoEtiquetas}
            opciones={[{ valor: 'todos', texto: 'Todos' }, { valor: 'consumibles', texto: 'Consumibles' }, { valor: 'herramientas', texto: 'Herramientas' }]} />
          <Segmentado etiqueta="Etiquetado" valor={p.filtroEstadoEtiquetado} alCambiar={p.setFiltroEstadoEtiquetado}
            opciones={[{ valor: 'todos', texto: 'Todos' }, { valor: 'sin_etiquetar', texto: 'Sin etiquetar' }, { valor: 'etiquetados', texto: 'Ya etiquetados' }]} />
          <span className="r2-inv-etq-ubicacion">
            <Selector aria-label="Ubicación" value={p.filtroUbicacionEtiquetas} onChange={(e) => p.setFiltroUbicacionEtiquetas(e.target.value)}
              opciones={[{ valor: 'todos', texto: 'Todas las ubicaciones' },
                ...p.todasUbicaciones.filter((u) => u.activo !== false).map((u) => ({ valor: u.id, texto: `${u.codigo} · ${u.almacen || ''}` }))]} />
          </span>
        </div>
        <div className="r2-inv-etq-resumen">
          <span>{plural(lista.length, 'artículo', 'artículos')} en la lista</span>
          <Boton nivel="fantasma" tamano="chico" alHacer={p.handleSeleccionarTodosEtiquetas}>{todos ? 'Quitar todos' : 'Elegir todos'}</Boton>
        </div>
      </div>
      <CajonCuerpo className="r2-inv-etq-cuerpo">
        {lista.length === 0 ? (
          <Vacio sinResultados busqueda={p.busquedaEtiquetas || undefined} texto="Cambia los filtros para ver más artículos." />
        ) : (
          <ul className="r2-lista r2-inv-etq-lista" aria-label="Artículos para etiquetar">
            {lista.map((a) => {
              const herr = a.es_herramienta;
              const abiertaH = p.herramientasExpandidasEtiquetas[a.id];
              const us = p.unidadesCargadasEtiquetas[a.id] || [];
              const elegido = p.articulosSeleccionadosEtiquetas.includes(a.id);
              return (
                <li key={a.id} className="r2-inv-etq-item">
                  <div className={clases('r2-fila r2-inv-etq-fila-art', elegido && 'r2-fila--elegida')}>
                    <span className="r2-fila-inicio">
                      {herr ? (
                        <BotonIcono icono={abiertaH ? ChevronDown : ChevronRight} etiqueta={abiertaH ? 'Ocultar unidades' : 'Ver unidades'}
                          alHacer={() => p.handleToggleHerramientaEtiquetas(a.id)} aria-expanded={Boolean(abiertaH)} />
                      ) : (
                        <Casilla marcada={elegido} alCambiar={() => p.handleToggleArticuloEtiqueta(a.id)} etiqueta={`Elegir ${a.nombre}`} soloCasilla />
                      )}
                    </span>
                    <Miniatura src={a.imagen_url ? p.getImageUrl(a.imagen_url) : null} alt={a.nombre} tamano={40} ampliable={false} />
                    <span className="r2-fila-lineas">
                      <span className="r2-fila-principal">{a.nombre}</span>
                      <span className="r2-fila-secundario">
                        {herr ? `Herramienta · ${textoUnidades(num(a.stock_actual))}` : `Código ${a.codigo_ean13 || '—'} · ${existencia(a)}`}
                      </span>
                    </span>
                    <span className="r2-fila-derecha">{marca(a)}</span>
                  </div>
                  {herr && abiertaH && (
                    <div className="r2-inv-etq-unidades">
                      {us.length === 0 ? <p className="r2-nota">Cargando unidades…</p> : (
                        <>
                          <div className="r2-inv-etq-unidades-cab">
                            <span>{plural(us.length, 'unidad', 'unidades')} · {us.filter((u) => p.unidadesSeleccionadasEtiquetas.includes(u.id)).length} elegidas</span>
                            <Boton nivel="fantasma" tamano="chico" alHacer={() => p.handleSeleccionarTodasUnidades(a.id)}>
                              {us.every((u) => p.unidadesSeleccionadasEtiquetas.includes(u.id)) ? 'Quitar todas' : 'Elegir todas'}
                            </Boton>
                          </div>
                          {us.map((u) => (
                            <div key={u.id} className="r2-inv-etq-unidad">
                              <Casilla marcada={p.unidadesSeleccionadasEtiquetas.includes(u.id)} alCambiar={() => p.handleToggleUnidadEtiqueta(u.id)}
                                className="r2-inv-etq-unidad-casilla"
                                texto={(
                                  <>
                                    <span className="r2-inv-unidad-codigo">{u.codigo_unico}</span>
                                    <span className="r2-inv-desc">n.º {u.id}</span>
                                  </>
                                )} />
                              <span className="r2-inv-etq-unidad-estado">
                                {u.etiquetado ? <Estado tono="ok" texto="Etiquetado" /> : (
                                  <Estado tono={u.estado === 'disponible' ? 'ok' : u.estado === 'asignada' ? 'info' : 'neutro'}
                                    texto={u.estado === 'disponible' ? 'Disponible' : u.estado === 'asignada' ? 'Asignada' : u.estado} />
                                )}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CajonCuerpo>
      <CajonPie resumen={total ? `${plural(nArt, 'artículo', 'artículos')} · ${plural(nUni, 'unidad', 'unidades')}` : 'Nada elegido todavía'}>
        <Boton nivel="fantasma" alHacer={cerrar} deshabilitado={p.loadingEtiquetas}>Cancelar</Boton>
        <Boton nivel="principal" icono={FileDown} alHacer={p.handleGenerarEtiquetas} cargando={p.loadingEtiquetas}
          deshabilitado={total === 0 || p.loadingEtiquetas} motivo="Elige al menos un artículo o una unidad">
          {total ? `Generar PDF de ${plural(total, 'etiqueta', 'etiquetas')}` : 'Generar PDF'}
        </Boton>
      </CajonPie>
    </Cajon>
  );
}
