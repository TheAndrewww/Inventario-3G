// Rediseño 2 · grupo inventario · «Nuevos por autorizar» (las claves que dio de alta Almacén y esperan a Dirección).
// Escritorio: tabla con los selectores de hoy en el renglón (categoría, almacén, ubicación, sección) y UNA acción visible,
// «Cargar al inventario» (tonal); «Editar» en «⋯». Celular: el renglón abre un cajón con los mismos selectores.
// Mismos manejadores de la página: handleQuickUpdate(…, { mantenerPendiente: true }), handleNuevoAlmacenChange,
// handleAutorizarNuevo, handleEditar. Nada se pide al abrir.
import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { Tabla } from '../fundacion/piezas/Tabla';
import { Boton } from '../fundacion/piezas/Boton';
import { Selector, Campo } from '../fundacion/piezas/Campos';
import { Miniatura } from '../fundacion/piezas/Miniatura';
import { Estado } from '../fundacion/piezas/Estado';
import { Vacio } from '../fundacion/piezas/Estados';
import { Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon } from '../fundacion/piezas/Cajon';
import { Nota } from '../fundacion/piezas/Ayudas';

function selectores(item, p) {
  const almId = p.almacenNuevoDe(item);
  const ubics = p.ubicacionesDeAlmacen(almId);
  const secs = p.seccionesDeAlmacen(almId);
  const autorizando = p.autorizandoNuevos.has(item.id);
  const editando = p.actualizandoArt.has(item.id);
  const cambiarUbicacion = (val) => {
    p.handleQuickUpdate(item, 'ubicacion_id', val, { mantenerPendiente: true });
    const ub = p.todasUbicaciones.find((u) => String(u.id) === String(val));
    if (ub) p.setNuevosAlmacenSel((prev) => ({ ...prev, [item.id]: ub.almacen_id }));
  };
  return {
    almId, autorizando, editando, listo: Boolean(item.ubicacion_id) && Boolean(item.seccion_id),
    categoria: (
      <Selector aria-label={`Categoría de ${item.nombre}`} value={item.categoria_id ?? ''} disabled={editando || autorizando}
        onChange={(e) => p.handleQuickUpdate(item, 'categoria_id', e.target.value, { mantenerPendiente: true })}
        opciones={[{ valor: '', texto: 'Sin categoría' }, ...p.categoriasDeAlmacen(almId).map((c) => ({ valor: c.id, texto: c.nombre }))]} />
    ),
    almacen: (
      <Selector aria-label={`Almacén de ${item.nombre}`} value={almId ?? ''} disabled={autorizando}
        onChange={(e) => p.handleNuevoAlmacenChange(item, e.target.value)}
        opciones={[{ valor: '', texto: 'Elige un almacén' }, ...p.almacenesDisponibles.map((a) => ({ valor: a.id, texto: a.nombre }))]} />
    ),
    ubicacion: (
      <Selector aria-label={`Ubicación de ${item.nombre}`} value={item.ubicacion_id ?? ''} disabled={!almId || editando || autorizando}
        onChange={(e) => cambiarUbicacion(e.target.value)}
        opciones={[{ valor: '', texto: almId ? 'Sin asignar' : 'Elige almacén' }, ...ubics.map((u) => ({ valor: u.id, texto: u.codigo || u.nombre }))]} />
    ),
    seccion: (
      <Selector aria-label={`Sección de ${item.nombre}`} value={item.seccion_id ?? ''} disabled={!almId || editando || autorizando}
        onChange={(e) => p.handleQuickUpdate(item, 'seccion_id', e.target.value, { mantenerPendiente: true })}
        opciones={[{ valor: '', texto: almId ? 'Sin sección' : 'Elige almacén' }, ...secs.map((s) => ({ valor: s.id, texto: s.nombre }))]} />
    ),
  };
}

export default function NuevosPorAutorizar({ filas, p, celular, vacio }) {
  const [abiertoId, setAbiertoId] = useState(null);
  const abierto = filas.find((f) => f.id === abiertoId) || null;
  const imagen = (a) => (a.imagen_url ? p.getImageUrl(a.imagen_url) : null);

  const cargar = (item) => {
    const s = selectores(item, p);
    return (
      <Boton nivel="tonal" tamano="chico" icono={Check} cargando={s.autorizando} deshabilitado={!s.listo || s.autorizando}
        motivo="Asigna ubicación y sección primero" alHacer={() => p.handleAutorizarNuevo(item)}>
        Cargar al inventario
      </Boton>
    );
  };
  const menu = (item) => [{ texto: 'Editar la clave', icono: Pencil, alHacer: () => p.handleEditar(item), deshabilitado: p.autorizandoNuevos.has(item.id) }];

  const columnas = [
    {
      id: 'articulo', titulo: 'Artículo', celda: (a) => (
        <span className="r2-inv-articulo">
          <Miniatura src={imagen(a)} alt={a.nombre} tamano={40} ampliable={false} />
          <span className="r2-inv-articulo-texto">
            <span className="r2-inv-nombre">{a.nombre}</span>
            {a.codigo_ean13 && <span className="r2-inv-desc r2-num">{a.codigo_ean13}</span>}
          </span>
        </span>
      ),
    },
    { id: 'categoria', titulo: 'Categoría', ancho: '17%', sinBoton: true, celda: (a) => selectores(a, p).categoria },
    { id: 'almacen', titulo: 'Almacén', ancho: '15%', sinBoton: true, celda: (a) => selectores(a, p).almacen },
    { id: 'ubicacion', titulo: 'Ubicación', ancho: '14%', sinBoton: true, celda: (a) => selectores(a, p).ubicacion },
    { id: 'seccion', titulo: 'Sección', ancho: '14%', sinBoton: true, celda: (a) => selectores(a, p).seccion },
  ];

  return (
    <>
      <Nota className="r2-inv-ayuda-nuevos">
        Revisa cada clave, asigna almacén, ubicación y sección, y carga la clave al inventario. Mientras editas, la clave sigue en esta lista.
      </Nota>
      <Tabla etiqueta="Nuevos por autorizar" className="r2-inv-nuevos r2-inv-acciones-abajo" densidad="comoda" columnas={columnas} filas={filas}
        alAbrir={celular ? (a) => setAbiertoId(a.id) : undefined}
        accion={celular ? undefined : cargar} masAcciones={celular ? undefined : menu}
        filaCelular={(a) => {
          const s = selectores(a, p);
          return {
            inicio: <Miniatura src={imagen(a)} alt={a.nombre} tamano={40} ampliable={false} />,
            principal: a.nombre,
            secundario: [a.ubicacion?.codigo, a.seccion?.nombre].filter(Boolean).join(' · ') || 'Sin ubicación ni sección',
            debajo: s.listo ? <Estado tono="ok" texto="Lista para cargar" /> : <Estado tono="aviso" texto="Falta ubicación o sección" />,
          };
        }}
        vacio={vacio || <Vacio titulo="No hay claves nuevas por autorizar" texto="Cuando Almacén dé de alta una clave aparecerá aquí para que la revises." />} />

      {celular && (
        <Cajon abierto={Boolean(abierto)} alCerrar={() => setAbiertoId(null)} etiqueta={abierto ? `Autorizar ${abierto.nombre}` : 'Autorizar'}>
          {abierto && (() => {
            const s = selectores(abierto, p);
            return (
              <>
                <CajonCabecera titulo={abierto.nombre} dato={abierto.codigo_ean13} alCerrar={() => setAbiertoId(null)} />
                <CajonCuerpo>
                  <SeccionCajon titulo="Dónde va">
                    <Campo etiqueta="Almacén">{s.almacen}</Campo>
                    <Campo etiqueta="Ubicación">{s.ubicacion}</Campo>
                    <Campo etiqueta="Sección">{s.seccion}</Campo>
                    <Campo etiqueta="Categoría">{s.categoria}</Campo>
                  </SeccionCajon>
                </CajonCuerpo>
                <CajonPie>
                  <Boton nivel="fantasma" icono={Pencil} alHacer={() => { setAbiertoId(null); p.handleEditar(abierto); }}>Editar la clave</Boton>
                  <Boton nivel="principal" icono={Check} cargando={s.autorizando} deshabilitado={!s.listo || s.autorizando}
                    motivo="Asigna ubicación y sección primero" alHacer={() => p.handleAutorizarNuevo(abierto)}>Cargar al inventario</Boton>
                </CajonPie>
              </>
            );
          })()}
        </Cajon>
      )}
    </>
  );
}
