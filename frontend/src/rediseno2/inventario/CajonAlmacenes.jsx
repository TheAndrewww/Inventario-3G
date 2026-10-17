// Rediseño 2 · grupo inventario · «Gestionar almacenes» en un cajón: nuevo almacén arriba, la lista de almacenes con
// «Categorías» (asignar o quitar) y, en «⋯», Renombrar y Eliminar. Mismo estado y mismos manejadores de la página
// (handleCrearAlmacen, handleRenombrarAlmacen, handleEliminarAlmacen y las dos funciones de categorías por almacén).
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react';
import { Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon } from '../fundacion/piezas/Cajon';
import { Boton } from '../fundacion/piezas/Boton';
import { Campo, Entrada, Casilla } from '../fundacion/piezas/Campos';
import { MenuAcciones } from '../fundacion/piezas/MenuAcciones';
import { Vacio } from '../fundacion/piezas/Estados';
import { plural } from '../fundacion/formato';

export default function CajonAlmacenes({ p }) {
  const cerrar = () => {
    p.setModalAlmacenesOpen(false);
    p.setAlmacenEditando(null);
    p.setNuevoNombreAlmacen('');
  };
  const lista = p.almacenesDisponibles;
  return (
    <Cajon abierto={p.modalAlmacenesOpen} alCerrar={cerrar} etiqueta="Gestionar almacenes">
      <CajonCabecera titulo="Gestionar almacenes" dato={plural(lista.length, 'almacén', 'almacenes')} alCerrar={cerrar} />
      <CajonCuerpo>
        <SeccionCajon titulo="Nuevo almacén">
          <div className="r2-inv-fila-campo">
            <Campo etiqueta="Nombre del almacén" className="r2-inv-crece">
              <Entrada type="text" value={p.nuevoNombreAlmacen} placeholder="Por ejemplo: Bodega norte"
                onChange={(e) => p.setNuevoNombreAlmacen(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !p.almacenEditando) p.handleCrearAlmacen(); }} />
            </Campo>
            <Boton nivel="tonal" icono={Plus} alHacer={p.handleCrearAlmacen} cargando={p.loadingAlmacenes && !p.almacenEditando}
              deshabilitado={p.loadingAlmacenes || !p.nuevoNombreAlmacen.trim()}
              motivo="Escribe el nombre del almacén">Crear almacén</Boton>
          </div>
        </SeccionCajon>
        <SeccionCajon titulo="Almacenes">
          {lista.length === 0 ? <Vacio compacto titulo="No hay almacenes registrados" texto="Crea el primero arriba." /> : (
            <ul className="r2-lista r2-inv-almacenes">
              {lista.map((alm) => {
                const editando = p.almacenEditando === alm.id;
                const conCategorias = p.almacenCategoriasExpandido === alm.id;
                return (
                  <li key={alm.id} className="r2-inv-almacen">
                    {editando ? (
                      <div className="r2-inv-fila-campo">
                        <Campo etiqueta={`Nuevo nombre de ${alm.nombre}`} className="r2-inv-crece">
                          <Entrada type="text" value={p.nuevoNombreAlmacen} autoFocus
                            onChange={(e) => p.setNuevoNombreAlmacen(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') p.handleRenombrarAlmacen(alm); }} />
                        </Campo>
                        <Boton nivel="principal" alHacer={() => p.handleRenombrarAlmacen(alm)} cargando={p.loadingAlmacenes}
                          deshabilitado={p.loadingAlmacenes || !p.nuevoNombreAlmacen.trim()}>Guardar nombre</Boton>
                        <Boton nivel="fantasma" deshabilitado={p.loadingAlmacenes}
                          alHacer={() => { p.setAlmacenEditando(null); p.setNuevoNombreAlmacen(''); }}>Cancelar</Boton>
                      </div>
                    ) : (
                      <div className="r2-inv-almacen-fila">
                        <span className="r2-fila-lineas">
                          <span className="r2-fila-principal">{alm.nombre}</span>
                          <span className="r2-fila-secundario">
                            {plural(alm.ubicaciones_count || 0, 'ubicación', 'ubicaciones')} · {plural(alm.categorias?.length || 0, 'categoría', 'categorías')} · {plural(alm.articulos_count || 0, 'artículo', 'artículos')}
                          </span>
                        </span>
                        <Boton nivel="fantasma" tamano="chico" icono={conCategorias ? ChevronDown : ChevronRight}
                          aria-expanded={conCategorias} alHacer={() => p.alternarCategoriasAlmacenR2(alm)}>Categorías</Boton>
                        <MenuAcciones titulo={alm.nombre} acciones={[
                          { texto: 'Renombrar', icono: Pencil, deshabilitado: p.loadingAlmacenes, alHacer: () => { p.setAlmacenEditando(alm.id); p.setNuevoNombreAlmacen(alm.nombre); } },
                          { texto: 'Eliminar almacén', icono: Trash2, peligro: true, deshabilitado: p.loadingAlmacenes, alHacer: () => p.handleEliminarAlmacen(alm) },
                        ]} />
                      </div>
                    )}
                    {!editando && conCategorias && (
                      <div className="r2-inv-almacen-categorias">
                        <p className="r2-inv-etiqueta">Categorías asignadas a este almacén</p>
                        {p.todasLasCategorias.length === 0 ? <p className="r2-nota">Cargando categorías…</p> : (
                          <div className="r2-inv-casillas" aria-busy={p.loadingToggleCategoria || undefined}>
                            {p.todasLasCategorias.map((cat) => {
                              const asignada = alm.categorias?.some((c) => c.id === cat.id);
                              return (
                                <Casilla key={cat.id} marcada={asignada} deshabilitado={p.loadingToggleCategoria}
                                  texto={cat.nombre} alCambiar={() => p.cambiarCategoriaDeAlmacenR2(alm, cat, asignada)} />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SeccionCajon>
      </CajonCuerpo>
      <CajonPie>
        <Boton nivel="fantasma" alHacer={cerrar}>Cerrar</Boton>
      </CajonPie>
    </Cajon>
  );
}
