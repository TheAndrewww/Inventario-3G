// Rediseño 2 · Gestión · mínimos de un equipo (ConfigurarStockMinimoModal encendido), en un cajón extra (960 px).
// Antes: un diálogo de 1,280 px con tarjetas de herramientas en dos columnas, cada una con su botón morado, y lo ya
// configurado en una columna angosta a la derecha. Ahora: arriba lo que ya tiene mínimo (lo que se revisa), después lo que se
// va a agregar con su cantidad, y abajo el catálogo para buscar y agregar; «Guardar» al pie dice cuántos van. Mismos
// manejadores y mismas peticiones del modal de siempre.
import { Plus, Pencil, Trash2, X, Wrench } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon, Tabla, Boton, BotonIcono, Busqueda, Miniatura, Entrada, Cargando, Vacio,
  numero, plural,
} from '../fundacion';
import './gestion.css';

export default function CajonMinimosEquipo(p) {
  const {
    camioneta, onClose, cargando, guardando, busqueda, setBusqueda, tiposFiltrados, seleccionadas, stocksConfigurados, agregarSeleccion,
    quitarSeleccion, actualizarCantidad, actualizarObservaciones, guardarTodas, eliminarConfiguracion, editarConfiguracion, obtenerImagenUrl,
  } = p;

  const columnasConfiguradas = [
    {
      id: 'herramienta', titulo: 'Herramienta',
      celda: (s) => (
        <span className="r2g-celda-doble">
          <span className="r2g-fuerte">{s.tipoHerramienta?.nombre}</span>
          <span className="r2g-clave">{s.tipoHerramienta?.prefijo_codigo}</span>
        </span>
      ),
    },
    { id: 'minimo', titulo: 'Mínimo', alinear: 'der', ancho: '90px', celda: (s) => <span className="r2g-num-fuerte">{numero(s.cantidad_minima)}</span> },
    { id: 'nota', titulo: 'Observaciones', ocultarEn: 'celular-ancho', celda: (s) => (s.observaciones ? <span className="r2g-sec">{s.observaciones}</span> : '') },
  ];

  const columnasCatalogo = [
    { id: 'foto', titulo: <span className="r2-solo-lectores">Foto</span>, ancho: '56px', sinBoton: true, celda: (t) => <Miniatura src={obtenerImagenUrl(t)} alt={t.nombre} tamano={40} /> },
    {
      id: 'herramienta', titulo: 'Herramienta',
      celda: (t) => (
        <span className="r2g-celda-doble">
          <span className="r2g-fuerte">{t.nombre}</span>
          {t.descripcion && <span className="r2g-sec r2g-una-linea" title={t.descripcion}>{t.descripcion}</span>}
        </span>
      ),
    },
    { id: 'clave', titulo: 'Clave', ancho: '80px', celda: (t) => <span className="r2g-clave">{t.prefijo_codigo}</span> },
    { id: 'categoria', titulo: 'Categoría', ocultarEn: 'celular-ancho', celda: (t) => t.categoria?.nombre || <span className="r2g-sec">Sin categoría</span> },
    { id: 'disponibles', titulo: 'Disponibles', alinear: 'der', ancho: '110px', celda: (t) => numero(t.unidades_disponibles) },
  ];

  return (
    <Cajon abierto alCerrar={onClose} ancho="extra" etiqueta={`Mínimos de ${camioneta.nombre}`} cambiosSinGuardar={seleccionadas.length > 0}>
      <CajonCabecera titulo={`Mínimos de ${camioneta.nombre}`}
        dato={cargando ? 'Cargando…' : plural(stocksConfigurados.length, 'herramienta con mínimo', 'herramientas con mínimo')} alCerrar={onClose} />
      <CajonCuerpo>
        {cargando && !stocksConfigurados.length && !tiposFiltrados.length ? (
          <SeccionCajon><Cargando forma="tabla" columnas={[3, 1, 2]} filas={6} etiqueta="Cargando los mínimos del equipo…" /></SeccionCajon>
        ) : (
          <>
            <SeccionCajon titulo={`Ya configuradas · ${numero(stocksConfigurados.length)}`}>
              <Tabla etiqueta="Herramientas con mínimo configurado" clave="id" columnas={columnasConfiguradas} filas={stocksConfigurados}
                densidad="compacta" fija={false}
                accion={(s) => <Boton nivel="fantasma" tamano="chico" icono={Pencil} alHacer={() => editarConfiguracion(s)}>Cambiar mínimo</Boton>}
                masAcciones={(s) => [{ texto: 'Quitar este mínimo', icono: Trash2, peligro: true, alHacer: () => eliminarConfiguracion(s.id, s.tipoHerramienta.nombre) }]}
                filaCelular={(s) => ({ principal: s.tipoHerramienta?.nombre, secundario: [s.tipoHerramienta?.prefijo_codigo, s.observaciones].filter(Boolean).join(' · '), derecha: `Mínimo ${numero(s.cantidad_minima)}` })}
                vacio={{ titulo: 'Este equipo todavía no tiene mínimos', texto: 'Agrega abajo las herramientas que siempre debe traer y cuántas.' }} />
            </SeccionCajon>

            {seleccionadas.length > 0 && (
              <SeccionCajon titulo={`Para agregar · ${numero(seleccionadas.length)}`}>
                <ul className="r2g-por-agregar">
                  {seleccionadas.map((sel) => (
                    <li key={sel.tipo.id} className="r2g-por-agregar-fila">
                      <span className="r2g-celda-doble r2g-por-agregar-nombre">
                        <span className="r2g-fuerte">{sel.tipo.nombre}</span>
                        <span className="r2g-clave">{sel.tipo.prefijo_codigo}</span>
                      </span>
                      <label className="r2g-campo-linea">
                        <span className="r2-campo-etiqueta">Cantidad mínima</span>
                        <Entrada type="number" min="1" inputMode="numeric" className="r2g-entrada-num" value={sel.cantidad_minima}
                          onChange={(e) => actualizarCantidad(sel.tipo.id, e.target.value)} />
                      </label>
                      <label className="r2g-campo-linea r2g-campo-linea--crece">
                        <span className="r2-campo-etiqueta">Observaciones</span>
                        <Entrada type="text" value={sel.observaciones} placeholder="Opcional" onChange={(e) => actualizarObservaciones(sel.tipo.id, e.target.value)} />
                      </label>
                      <BotonIcono icono={X} etiqueta={`Quitar ${sel.tipo.nombre} de la lista`} alHacer={() => quitarSeleccion(sel.tipo.id)} />
                    </li>
                  ))}
                </ul>
              </SeccionCajon>
            )}

            <SeccionCajon titulo="Agregar herramientas">
              <Busqueda valor={busqueda} alCambiar={setBusqueda} texto="Buscar por nombre, clave o categoría" />
              <Tabla etiqueta="Herramientas que se pueden agregar" clave="id" columnas={columnasCatalogo} filas={tiposFiltrados} densidad="compacta" fija={false}
                accion={(t) => <Boton nivel="tonal" tamano="chico" icono={Plus} alHacer={() => agregarSeleccion(t)}>Agregar</Boton>}
                filaCelular={(t) => ({
                  inicio: <Miniatura src={obtenerImagenUrl(t)} alt={t.nombre} tamano={40} />,
                  principal: t.nombre,
                  secundario: [t.prefijo_codigo, t.categoria?.nombre || 'Sin categoría', `${numero(t.unidades_disponibles)} disponibles`].join(' · '),
                })}
                vacio={busqueda ? { sinResultados: true, busqueda, alQuitar: () => setBusqueda('') } : { icono: Wrench, titulo: 'Todas las herramientas ya están configuradas', compacto: true }} />
            </SeccionCajon>
          </>
        )}
      </CajonCuerpo>
      <CajonPie resumen={seleccionadas.length ? plural(seleccionadas.length, 'herramienta por agregar', 'herramientas por agregar') : null}>
        <Boton nivel="fantasma" alHacer={onClose}>Cerrar</Boton>
        <Boton nivel="principal" alHacer={guardarTodas} cargando={guardando} deshabilitado={!seleccionadas.length}
          motivo="Agrega al menos una herramienta de la lista de abajo">
          {seleccionadas.length > 1 ? `Guardar ${seleccionadas.length} mínimos` : 'Guardar mínimo'}
        </Boton>
      </CajonPie>
    </Cajon>
  );
}
