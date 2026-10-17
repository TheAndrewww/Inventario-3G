// Rediseño 2 · grupo inventario · categorías, ubicaciones y secciones del almacén.
// <CajonTaxonomia>: lista de lo que hay en el almacén con «Editar» y «Eliminar» (en «⋯») y el botón «Nueva…». Se abre desde
// el pie de cada menú de filtro («Administrar categorías…»). <DialogosTaxonomia>: los tres formularios cortos de hoy
// (nueva/editar categoría, ubicación y sección). Mismos permisos, mismas confirmaciones y mismos manejadores de la página.
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Cajon, CajonCabecera, CajonCuerpo } from '../fundacion/piezas/Cajon';
import { Dialogo } from '../fundacion/piezas/Dialogo';
import { Boton } from '../fundacion/piezas/Boton';
import { Campo, Entrada, Area } from '../fundacion/piezas/Campos';
import { MenuAcciones } from '../fundacion/piezas/MenuAcciones';
import { Vacio } from '../fundacion/piezas/Estados';
import { Lista, FilaLista } from '../fundacion/piezas/FilaLista';
import { confirmarG3 } from '../fundacion/piezas/dialogos';
import { plural } from '../fundacion/formato';

const TEXTOS = {
  categoria: { titulo: 'Categorías', una: 'categoría', varias: 'categorías', nueva: 'Nueva categoría' },
  ubicacion: { titulo: 'Ubicaciones', una: 'ubicación', varias: 'ubicaciones', nueva: 'Nueva ubicación' },
  seccion: { titulo: 'Secciones', una: 'sección', varias: 'secciones', nueva: 'Nueva sección' },
};

export function CajonTaxonomia({ tipo, alCerrar, p, nombreAlmacen }) {
  const t = TEXTOS[tipo] || TEXTOS.categoria;
  let lista = [];
  let puedeCrear = false;
  let puedeEditar = false;
  let nombre = (x) => x.nombre;
  let detalle = () => null;
  let editar = () => {};
  let eliminar = () => {};
  let nueva = () => {};
  const mismo = (x) => x != null && String(x) === String(p.almacenSeleccionado);
  const delAlmacen = p.articulos.filter((a) => a.activo !== false && (mismo(a.ubicacion?.almacen_id) || mismo(a.ubicacion?.almacen_ref?.id)));
  if (tipo === 'categoria') {
    lista = p.categoriasAlmacenSel;
    puedeCrear = p.puedeGestionarTaxonomia;
    puedeEditar = p.esAdministrador;
    detalle = (c) => plural(delAlmacen.filter((a) => a.categoria_id === c.id).length, 'artículo', 'artículos');
    editar = (c) => p.handleAbrirModalCategoria(c);
    nueva = () => p.handleAbrirModalCategoria();
    eliminar = async (c) => {
      if (await confirmarG3({ titulo: `¿Eliminar la categoría «${c.nombre}»?`, confirmar: 'Eliminar categoría', cancelar: 'No eliminar', peligro: true })) p.handleEliminarCategoria(c);
    };
  } else if (tipo === 'ubicacion') {
    lista = p.ubicacionesAlmacenSel;
    puedeCrear = p.puedeGestionarTaxonomia;
    puedeEditar = p.esAdministrador;
    nombre = (u) => u.codigo || u.nombre;
    detalle = (u) => [u.descripcion, plural(delAlmacen.filter((a) => a.ubicacion_id === u.id).length, 'artículo', 'artículos')].filter(Boolean).join(' · ');
    editar = (u) => p.handleAbrirModalUbicacion(u);
    nueva = () => p.handleAbrirModalUbicacion();
    eliminar = async (u) => {
      if (await confirmarG3({ titulo: `¿Eliminar la ubicación «${u.codigo || u.nombre}»?`, confirmar: 'Eliminar ubicación', cancelar: 'No eliminar', peligro: true })) p.handleEliminarUbicacion(u);
    };
  } else {
    lista = p.secciones;
    puedeCrear = p.esAdministrador;
    puedeEditar = p.esAdministrador;
    detalle = (s) => plural(delAlmacen.filter((a) => a.seccion_id === s.id).length, 'artículo', 'artículos');
    editar = (s) => p.handleAbrirModalSeccion(s);
    nueva = () => p.handleAbrirModalSeccion();
    eliminar = async (s) => {
      if (await confirmarG3({ titulo: `¿Eliminar la sección «${s.nombre}»?`, confirmar: 'Eliminar sección', cancelar: 'No eliminar', peligro: true })) p.handleEliminarSeccion(s);
    };
  }
  return (
    <Cajon abierto={Boolean(tipo)} alCerrar={alCerrar} etiqueta={`${t.titulo} de ${nombreAlmacen}`}>
      <CajonCabecera titulo={`${t.titulo} de ${nombreAlmacen}`} dato={plural(lista.length, t.una, t.varias)} alCerrar={alCerrar} />
      {puedeCrear && (
        <div className="r2-cajon-decision">
          <div className="r2-cajon-decision-botones">
            <Boton nivel="principal" icono={Plus} alHacer={nueva}>{t.nueva}</Boton>
          </div>
        </div>
      )}
      <CajonCuerpo>
        {lista.length === 0 ? (
          <Vacio titulo={`Este almacén no tiene ${t.varias}`} texto={puedeCrear ? `Usa «${t.nueva}» para agregar la primera.` : 'Pide a Dirección que las agregue.'} />
        ) : (
          <Lista etiqueta={t.titulo}>
            {lista.map((x) => (
              <FilaLista key={x.id} principal={nombre(x)} secundario={detalle(x)}
                accion={puedeEditar ? (
                  <>
                    <Boton nivel="fantasma" tamano="chico" icono={Pencil} alHacer={() => editar(x)}>Editar</Boton>
                    <MenuAcciones titulo={nombre(x)} acciones={[{ texto: `Eliminar ${t.una}`, icono: Trash2, peligro: true, alHacer: () => eliminar(x) }]} />
                  </>
                ) : null} />
            ))}
          </Lista>
        )}
      </CajonCuerpo>
    </Cajon>
  );
}

export function DialogosTaxonomia({ p }) {
  const pieDe = (cancelar, guardar, texto, cargando, deshabilitado) => (
    <>
      <Boton nivel="fantasma" alHacer={cancelar} deshabilitado={cargando}>Cancelar</Boton>
      <Boton nivel="principal" alHacer={guardar} cargando={cargando} deshabilitado={deshabilitado}>{texto}</Boton>
    </>
  );
  return (
    <>
      <Dialogo abierto={p.modalCategoriaOpen} alCerrar={p.handleCerrarModalCategoria} cerrarConEsc tamano="sm"
        titulo={p.categoriaEditando ? 'Editar categoría' : 'Nueva categoría'}
        pie={pieDe(p.handleCerrarModalCategoria, p.handleGuardarCategoria, p.categoriaEditando ? 'Guardar categoría' : 'Crear categoría',
          p.loadingCategoria, p.loadingCategoria || !p.nombreCategoria.trim())}>
        <Campo etiqueta="Nombre de la categoría" requerido>
          <Entrada type="text" value={p.nombreCategoria} onChange={(e) => p.setNombreCategoria(e.target.value)} disabled={p.loadingCategoria}
            placeholder="Por ejemplo: Tornillos" autoFocus />
        </Campo>
      </Dialogo>

      <Dialogo abierto={p.modalSeccionOpen} alCerrar={p.handleCerrarModalSeccion} cerrarConEsc tamano="sm"
        titulo={p.seccionEditando ? 'Editar sección' : 'Nueva sección'}
        pie={pieDe(p.handleCerrarModalSeccion, p.handleGuardarSeccion, p.seccionEditando ? 'Guardar sección' : 'Crear sección',
          p.loadingSeccion, p.loadingSeccion || !p.nombreSeccion.trim() || (!p.seccionEditando && !p.almacenSeccionForm))}>
        <Campo etiqueta="Nombre de la sección" requerido>
          <Entrada type="text" value={p.nombreSeccion} onChange={(e) => p.setNombreSeccion(e.target.value)} disabled={p.loadingSeccion}
            placeholder="Por ejemplo: Stock, Extras, Reservados" autoFocus />
        </Campo>
      </Dialogo>

      <Dialogo abierto={p.modalUbicacionOpen} alCerrar={p.handleCerrarModalUbicacion} cerrarConEsc tamano="md"
        titulo={p.ubicacionEditando ? 'Editar ubicación' : 'Nueva ubicación'}
        pie={pieDe(p.handleCerrarModalUbicacion, p.handleGuardarUbicacion, p.ubicacionEditando ? 'Guardar ubicación' : 'Crear ubicación',
          p.loadingUbicacion, p.loadingUbicacion || !p.codigoUbicacion.trim())}>
        <div className="r2-inv-rejilla-campos">
          <Campo etiqueta="Código" requerido className="r2-inv-campo-doble">
            <Entrada type="text" value={p.codigoUbicacion} onChange={(e) => p.setCodigoUbicacion(e.target.value)} disabled={p.loadingUbicacion}
              placeholder="Por ejemplo: A-01" autoFocus />
          </Campo>
          <Campo etiqueta="Almacén (texto)">
            <Entrada type="text" value={p.almacenUbicacion} onChange={(e) => p.setAlmacenUbicacion(e.target.value)} disabled={p.loadingUbicacion}
              placeholder="Por ejemplo: Principal" />
          </Campo>
          <Campo etiqueta="Pasillo">
            <Entrada type="text" value={p.pasilloUbicacion} onChange={(e) => p.setPasilloUbicacion(e.target.value)} disabled={p.loadingUbicacion}
              placeholder="Por ejemplo: A" />
          </Campo>
          <Campo etiqueta="Estante">
            <Entrada type="text" value={p.estanteUbicacion} onChange={(e) => p.setEstanteUbicacion(e.target.value)} disabled={p.loadingUbicacion}
              placeholder="Por ejemplo: 01" />
          </Campo>
          <Campo etiqueta="Nivel">
            <Entrada type="number" min="1" value={p.nivelUbicacion} onChange={(e) => p.setNivelUbicacion(e.target.value)} disabled={p.loadingUbicacion}
              placeholder="Por ejemplo: 1" />
          </Campo>
          <Campo etiqueta="Descripción" className="r2-inv-campo-doble">
            <Area rows={2} value={p.descripcionUbicacion} onChange={(e) => p.setDescripcionUbicacion(e.target.value)} disabled={p.loadingUbicacion}
              placeholder="Algo que ayude a encontrarla" />
          </Campo>
        </div>
      </Dialogo>
    </>
  );
}
