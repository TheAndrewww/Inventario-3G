// Rediseño 2 · Gestión · checklist de los equipos, encendido: el catálogo (ChecklistManager), el checklist de un equipo
// (ChecklistEquipoModal), importar desde Excel (ImportarChecklistModal) y enlazar artículos (EnlazarArticulosModal).
// Antes: diálogos con pestañas de colores (azul / ámbar / violeta / verde), secciones en MAYÚSCULAS y el enlace de cada ítem
// dicho solo por el color del ícono. Ahora: cajones con pestañas subrayadas, tablas por sección en oración y el enlace en
// texto («Sin artículos enlazados», «1 artículo enlazado»). Cada componente de siempre conserva su estado, sus cargas y
// sus manejadores; aquí solo se pinta.
import { Upload, Link2, Trash2, Plus, ClipboardList, FileSpreadsheet, Check, ChevronDown, ChevronRight, Package, Sparkles } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonDecision, CajonCuerpo, CajonPie, SeccionCajon, Pestanas, Tabla, Boton, Busqueda, Selector, Casilla,
  Miniatura, Cargando, Vacio, Nota, numero, plural, clases,
} from '../fundacion';
import { oracion } from './comunes';
import './gestion.css';

const textoEnlace = (n) => (n > 0 ? plural(n, 'artículo enlazado', 'artículos enlazados') : 'Sin artículos enlazados');
const nombreItem = (item) => (
  <span className="r2g-celda-doble">
    <span className="r2g-fuerte">{item.nombre}</span>
    {item.especificacion && <span className="r2g-sec">{item.especificacion}</span>}
  </span>
);

// ───────── Catálogo del checklist ─────────
export function CajonCatalogoChecklist({
  onClose, items, cargando, tabActiva, setTabActiva, itemsHerramienta, itemsMaterial, porSeccion, abrirImportar, abrirEnlazar, handleEliminar,
}) {
  const grupos = Object.entries(porSeccion).map(([seccion, lista]) => ({ id: seccion, titulo: oracion(seccion), filas: lista }));
  const columnas = [
    { id: 'item', titulo: 'Ítem', celda: nombreItem },
    { id: 'cantidad', titulo: 'Cantidad', alinear: 'der', ancho: '90px', celda: (i) => <span className="r2g-num-fuerte">{numero(i.cantidad_requerida)}</span> },
    {
      id: 'enlace', titulo: 'Artículos del inventario', ancho: '210px', ocultarEn: 'celular-ancho',
      celda: (i) => { const n = i.articulosVinculados?.length || 0; return <span className={n ? undefined : 'r2g-sec'}>{textoEnlace(n)}</span>; },
    },
  ];
  const tipo = tabActiva === 'herramienta' ? 'herramientas' : 'consumibles';
  return (
    <Cajon abierto alCerrar={onClose} ancho="ancho" etiqueta="Catálogo del checklist">
      <CajonCabecera titulo="Catálogo del checklist" dato={plural(items.length, 'ítem en total', 'ítems en total')} alCerrar={onClose} />
      <CajonDecision nota="Lo que cada equipo debe traer. Enlaza cada ítem con los artículos del inventario que lo cumplen.">
        <Boton nivel="principal" icono={Upload} alHacer={abrirImportar}>Importar desde Excel</Boton>
      </CajonDecision>
      <div className="r2g-cajon-pestanas">
        <Pestanas etiqueta="Tipo de ítem" valor={tabActiva} alCambiar={setTabActiva}
          pestanas={[{ id: 'herramienta', texto: 'Herramientas', cuenta: itemsHerramienta.length }, { id: 'material', texto: 'Consumibles', cuenta: itemsMaterial.length }]} />
      </div>
      <CajonCuerpo>
        <SeccionCajon>
          {cargando ? (
            <Cargando forma="tabla" columnas={[3, 1, 2]} filas={6} etiqueta="Cargando el catálogo…" />
          ) : (
            <Tabla etiqueta={`Catálogo de ${tipo}`} clave="id" columnas={columnas} grupos={grupos} densidad="compacta" fija={false}
              accion={(i) => <Boton nivel="fantasma" tamano="chico" icono={Link2} alHacer={() => abrirEnlazar(i)}>Enlazar</Boton>}
              masAcciones={(i) => [{ texto: 'Eliminar del checklist', icono: Trash2, peligro: true, alHacer: () => handleEliminar(i) }]}
              filaCelular={(i) => ({ principal: i.nombre, secundario: [i.especificacion, `Cantidad ${numero(i.cantidad_requerida)}`, textoEnlace(i.articulosVinculados?.length || 0)].filter(Boolean).join(' · ') })}
              vacio={{ icono: ClipboardList, titulo: `No hay ${tipo} en el catálogo`, texto: 'Impórtalos desde el Excel del checklist.', accion: { texto: 'Importar desde Excel', icono: Upload, alHacer: abrirImportar } }} />
          )}
        </SeccionCajon>
      </CajonCuerpo>
    </Cajon>
  );
}

// ───────── Checklist de un equipo ─────────
export function CajonChecklistEquipo({
  equipo, onClose, cargando, tabActiva, setTabActiva, checklistHerramientas, checklistMateriales, checklistActiva, porSeccion, mostrarAgregar,
  setMostrarAgregar, busqueda, setBusqueda, itemsDisponibles, hayDelTipo, asignarItem, asignarTodos, quitarItem,
}) {
  const tipo = tabActiva === 'herramienta' ? 'herramientas' : 'consumibles';
  const grupos = Object.entries(porSeccion).map(([seccion, lista]) => ({ id: seccion, titulo: oracion(seccion), filas: lista.filter((a) => a.checklistItem) }));
  const columnas = [
    { id: 'item', titulo: 'Ítem', celda: (a) => nombreItem(a.checklistItem) },
    { id: 'cantidad', titulo: 'Cantidad', alinear: 'der', ancho: '90px', celda: (a) => <span className="r2g-num-fuerte">{numero(a.cantidad_requerida)}</span> },
    {
      id: 'enlace', titulo: 'Artículos del inventario', ancho: '210px', ocultarEn: 'celular-ancho',
      celda: (a) => { const n = a.checklistItem?.articulosVinculados?.length || 0; return <span className={n ? undefined : 'r2g-sec'}>{textoEnlace(n)}</span>; },
    },
  ];
  return (
    <Cajon abierto alCerrar={onClose} ancho="ancho" etiqueta={`Checklist de ${equipo.nombre}`}>
      <CajonCabecera titulo={`Checklist de ${equipo.nombre}`}
        dato={`${plural(checklistHerramientas.length, 'herramienta', 'herramientas')} · ${plural(checklistMateriales.length, 'consumible', 'consumibles')}`} alCerrar={onClose} />
      <CajonDecision>
        <Boton nivel={mostrarAgregar ? 'tonal' : 'principal'} icono={mostrarAgregar ? ChevronDown : Plus} alHacer={() => setMostrarAgregar(!mostrarAgregar)}
          aria-expanded={mostrarAgregar}>
          {mostrarAgregar ? 'Ocultar el catálogo' : 'Agregar del catálogo'}
        </Boton>
      </CajonDecision>
      <div className="r2g-cajon-pestanas">
        <Pestanas etiqueta="Tipo de ítem" valor={tabActiva} alCambiar={setTabActiva}
          pestanas={[{ id: 'herramienta', texto: 'Herramientas', cuenta: checklistHerramientas.length }, { id: 'material', texto: 'Consumibles', cuenta: checklistMateriales.length }]} />
      </div>
      <CajonCuerpo>
        {mostrarAgregar && (
          <SeccionCajon titulo={`Agregar ${tipo} del catálogo`}
            accion={itemsDisponibles.length > 0 ? <Boton nivel="tonal" tamano="chico" alHacer={asignarTodos}>Asignar todos ({numero(itemsDisponibles.length)})</Boton> : null}>
            <Busqueda valor={busqueda} alCambiar={setBusqueda} texto={`Buscar ${tabActiva === 'herramienta' ? 'herramienta' : 'consumible'}`} />
            {itemsDisponibles.length === 0 ? (
              <Nota>{hayDelTipo ? `Todos los ${tipo} del catálogo ya están en este equipo.` : `No hay ${tipo} en el catálogo.`}</Nota>
            ) : (
              <ul className="r2g-lista-simple">
                {itemsDisponibles.map((item) => (
                  <li key={item.id} className="r2g-lista-simple-fila">
                    {nombreItem(item)}
                    <span className="r2g-num r2g-sec">Cantidad {numero(item.cantidad_requerida)}</span>
                    <Boton nivel="fantasma" tamano="chico" icono={Plus} alHacer={() => asignarItem(item)}>Asignar</Boton>
                  </li>
                ))}
              </ul>
            )}
          </SeccionCajon>
        )}
        <SeccionCajon titulo={checklistActiva.length ? `${plural(checklistActiva.length, tabActiva === 'herramienta' ? 'herramienta asignada' : 'consumible asignado', tabActiva === 'herramienta' ? 'herramientas asignadas' : 'consumibles asignados')}` : undefined}>
          {cargando ? (
            <Cargando forma="tabla" columnas={[3, 1, 2]} filas={5} etiqueta="Cargando el checklist…" />
          ) : (
            <Tabla etiqueta={`Checklist de ${tipo}`} clave="id" columnas={columnas} grupos={grupos} densidad="compacta" fija={false}
              masAcciones={(a) => [{ texto: 'Quitar del checklist', icono: Trash2, peligro: true, alHacer: () => quitarItem(a.checklistItem.id) }]}
              filaCelular={(a) => ({ principal: a.checklistItem.nombre, secundario: [a.checklistItem.especificacion, `Cantidad ${numero(a.cantidad_requerida)}`, textoEnlace(a.checklistItem.articulosVinculados?.length || 0)].filter(Boolean).join(' · ') })}
              vacio={{ icono: ClipboardList, titulo: `No hay ${tipo} asignados`, texto: 'Agrégalos desde el catálogo.', accion: { texto: `Agregar ${tipo}`, icono: Plus, alHacer: () => setMostrarAgregar(true) } }} />
          )}
        </SeccionCajon>
      </CajonCuerpo>
    </Cajon>
  );
}

// ───────── Importar el checklist desde Excel ─────────
export function CajonImportarChecklist({
  onClose, paso, hojas, totalItems, hojasHerramienta, hojasMaterial, hojasConEquipo, equipos, importando, handleFileChange, setEquipoParaHoja,
  toggleHojaExpanded, handleImportar, resetear,
}) {
  return (
    <Cajon abierto alCerrar={onClose} ancho="ancho" etiqueta="Importar el checklist desde Excel">
      <CajonCabecera titulo="Importar desde Excel"
        dato={paso === 1 ? 'Elige tu archivo' : `${plural(hojas.length, 'hoja', 'hojas')} · ${plural(totalItems, 'ítem detectado', 'ítems detectados')}`} alCerrar={onClose} />
      <CajonCuerpo>
        {paso === 1 && (
          <SeccionCajon>
            <div className="r2g-elegir-archivo">
              <FileSpreadsheet size={32} aria-hidden="true" className="r2g-elegir-archivo-icono" />
              <p className="r2g-parrafo">Se detectan solas las hojas de <b>herramientas</b> y de <b>materiales</b>. Después eliges a qué equipo va cada hoja.</p>
              <label className="r2-boton r2-boton--principal r2-boton--normal r2g-elegir-archivo-boton">
                <Upload size={18} aria-hidden="true" className="r2-boton-svg" />
                <span className="r2-boton-texto">Elegir archivo .xlsx</span>
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="r2-solo-lectores" />
              </label>
            </div>
          </SeccionCajon>
        )}
        {paso === 2 && (
          <>
            <SeccionCajon>
              <p className="r2g-linea">
                <b>{plural(hojasHerramienta.length, 'hoja', 'hojas')}</b> de herramientas · <b>{plural(hojasMaterial.length, 'hoja', 'hojas')}</b> de materiales (stock mínimo)
              </p>
              <Nota>Asigna cada hoja a su equipo. Si la dejas en «Solo catálogo», sus ítems solo se agregan al catálogo.</Nota>
            </SeccionCajon>
            <SeccionCajon titulo="Hojas del archivo">
              <ul className="r2g-hojas">
                {hojas.map((hoja, idx) => (
                  <li key={idx} className="r2g-hoja">
                    <div className="r2g-hoja-cab">
                      <button type="button" className="r2g-hoja-abrir" onClick={() => toggleHojaExpanded(idx)} aria-expanded={hoja.expanded}>
                        {hoja.expanded ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                        <span className="r2g-celda-doble">
                          <span className="r2g-fuerte">{hoja.nombre}</span>
                          <span className="r2g-sec">{hoja.tipo === 'material' ? 'Materiales' : 'Herramientas'} · {plural(hoja.items.length, 'ítem', 'ítems')} · {hoja.equipoNombre || 'sin equipo detectado'}</span>
                        </span>
                      </button>
                      <Selector aria-label={`Equipo para la hoja ${hoja.nombre}`} value={hoja.equipoId} onChange={(e) => setEquipoParaHoja(idx, e.target.value)}
                        className="r2g-hoja-equipo" vacio="Solo catálogo" opciones={equipos.map((eq) => ({ valor: eq.id, texto: eq.nombre }))} />
                    </div>
                    {hoja.expanded && (
                      <ul className="r2g-hoja-items">
                        {hoja.items.map((item, i) => (
                          <li key={i}>
                            <span>{item.nombre}{item.especificacion ? <span className="r2g-sec"> · {item.especificacion}</span> : null}</span>
                            <span className="r2g-num-fuerte">{numero(item.cantidad_requerida)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </SeccionCajon>
          </>
        )}
      </CajonCuerpo>
      {paso === 2 && (
        <CajonPie resumen={hojasConEquipo.length ? plural(hojasConEquipo.length, 'hoja con equipo asignado', 'hojas con equipo asignado') : 'Solo al catálogo'}>
          <Boton nivel="fantasma" alHacer={resetear}>Cambiar archivo</Boton>
          <Boton nivel="principal" icono={Check} alHacer={handleImportar} cargando={importando}>Importar {plural(totalItems, 'ítem', 'ítems')}</Boton>
        </CajonPie>
      )}
    </Cajon>
  );
}

// ───────── Enlazar artículos del inventario a un ítem ─────────
export function CajonEnlazarArticulos({
  item, onClose, cargando, buscando, busqueda, setBusqueda, articulosAMostrar, sugerencias, seleccionados, toggleArticulo, guardando, handleGuardar,
}) {
  return (
    <Cajon abierto alCerrar={onClose} etiqueta={`Enlazar artículos a ${item.nombre}`}>
      <CajonCabecera titulo="Enlazar artículos" dato={[item.nombre, item.especificacion].filter(Boolean).join(' · ')} alCerrar={onClose} />
      <div className="r2g-cajon-busqueda">
        <Busqueda valor={busqueda} alCambiar={setBusqueda} texto="Buscar artículos del inventario" autoFoco />
        {buscando && <span className="r2g-sec" role="status">Buscando…</span>}
      </div>
      <CajonCuerpo>
        <SeccionCajon titulo={!busqueda.trim() && sugerencias.length > 0 ? 'Sugerencias automáticas' : undefined}
          accion={!busqueda.trim() && sugerencias.length > 0 ? <Sparkles size={16} aria-hidden="true" className="r2g-sec" /> : null}>
          {cargando ? (
            <Cargando forma="lista" filas={5} etiqueta="Buscando sugerencias…" />
          ) : articulosAMostrar.length === 0 ? (
            <Vacio icono={Package} titulo={busqueda ? 'No se encontraron artículos' : 'No hay sugerencias automáticas'} texto="Usa el buscador para encontrar artículos del inventario." compacto />
          ) : (
            <ul className="r2g-lista-simple">
              {articulosAMostrar.map((a) => {
                const elegido = seleccionados.has(a.id);
                return (
                  <li key={a.id} className={clases('r2g-lista-simple-fila r2g-elegible', elegido && 'r2g-elegible--si')}>
                    <Casilla marcada={elegido} alCambiar={() => toggleArticulo(a.id)} etiqueta={`Enlazar ${a.nombre}`} soloCasilla />
                    <Miniatura src={a.imagen_url || null} alt={a.nombre} tamano={40} ampliable={false} />
                    <button type="button" className="r2g-elegible-texto" onClick={() => toggleArticulo(a.id)}>
                      <span className="r2g-fuerte">{a.nombre}</span>
                      <span className="r2g-sec">{[a.categoria?.nombre, `existencia ${numero(a.stock_actual)}`].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SeccionCajon>
      </CajonCuerpo>
      <CajonPie resumen={plural(seleccionados.size, 'artículo elegido', 'artículos elegidos')}>
        <Boton nivel="fantasma" alHacer={onClose}>Cancelar</Boton>
        <Boton nivel="principal" icono={Link2} alHacer={handleGuardar} cargando={guardando}>Guardar enlaces</Boton>
      </CajonPie>
    </Cajon>
  );
}
