// Rediseño 2 · grupo inventario · Conteo cíclico (/conteo-ciclico) encendido. DISENO-v2 §5.3.
// Pestañas propias «Conteo de hoy · Reportes». Conteo: la línea de avance y la lista «Por contar» ordenada por ubicación
// (como se recorre el almacén) con la captura EN EL RENGLÓN: se escribe lo contado y Enter o «Confirmar» (en celular, el
// renglón abre un cajón corto con el campo grande). Reportes: filtros de fechas en una fila, tabla por día y las diferencias
// en un cajón. Todo el estado, los efectos y las peticiones siguen en la página (TabConteo y TabReportes).
import { RefreshCw, CheckCircle2, FastForward, Search, X } from 'lucide-react';
import { Pagina } from '../fundacion/piezas/Pagina';
import { EncabezadoPagina } from '../fundacion/piezas/EncabezadoPagina';
import { Pestanas } from '../fundacion/piezas/Pestanas';
import { TiraCifras } from '../fundacion/piezas/TiraCifras';
import { Tabla } from '../fundacion/piezas/Tabla';
import { Estado } from '../fundacion/piezas/Estado';
import { Fecha } from '../fundacion/piezas/Fecha';
import { Cargando, Vacio, ErrorCarga } from '../fundacion/piezas/Estados';
import { Boton, BotonIcono } from '../fundacion/piezas/Boton';
import { Campo, Entrada } from '../fundacion/piezas/Campos';
import { Datos } from '../fundacion/piezas/Datos';
import { Miniatura } from '../fundacion/piezas/Miniatura';
import { Cajon, CajonCabecera, CajonCuerpo, CajonPie, SeccionCajon } from '../fundacion/piezas/Cajon';
import { useEsCelular } from '../fundacion/useDiseno3G';
import { cantidad, numero, fechaExacta, clases } from '../fundacion/formato';
import { num, conSigno, sinAcentos, motivoLegible } from './ayudas';
import './inventario.css';

export function VistaConteoCiclico({ tab, setTab, children }) {
  return (
    <Pagina titulo="Conteo cíclico" densidad="comoda" className="r2-inv">
      <EncabezadoPagina titulo="Conteo cíclico" />
      <Pestanas etiqueta="Conteo cíclico" valor={tab} alCambiar={setTab} idPanel="r2-conteo-panel" className="r2-inv-pestanas"
        pestanas={[{ id: 'conteo', texto: 'Conteo de hoy' }, { id: 'reportes', texto: 'Reportes' }]} />
      <div id="r2-conteo-panel" role="tabpanel" className="r2-inv-panel">{children}</div>
    </Pagina>
  );
}

// Búsqueda con la referencia de la página (después de confirmar, la página regresa el foco aquí, como hoy)
function BusquedaConRef({ refCampo, valor, alCambiar }) {
  return (
    <div className="r2-busqueda r2-inv-busqueda-conteo" role="search">
      <Search size={18} aria-hidden="true" className="r2-busqueda-lupa" />
      <input ref={refCampo} type="search" className="r2-busqueda-campo" value={valor} placeholder="Buscar por nombre, código o clave"
        aria-label="Buscar artículo del conteo" autoComplete="off" spellCheck={false} onChange={(e) => alCambiar(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && valor) { e.preventDefault(); alCambiar(''); } }} />
      {valor && (
        <button type="button" className="r2-busqueda-limpiar" aria-label="Borrar búsqueda" title="Borrar búsqueda (Esc)" onClick={() => alCambiar('')}>
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function VistaConteoHoy({ c }) {
  const celular = useEsCelular();
  if (c.loading) return <Cargando forma={celular ? 'lista' : 'tabla'} columnas={[1, 3, 1, 1, 1]} filas={8} etiqueta="Cargando el conteo de hoy…" />;
  if (!c.conteo) return <ErrorCarga mensaje="No se pudo cargar el conteo del día." alReintentar={c.cargarConteoHoy} />;

  const k = c.conteo;
  const completado = k.estado === 'completado';
  const sel = c.articuloSeleccionado;
  const ordenados = [...c.pendientes].sort((a, b) => sinAcentos(a.ubicacion?.codigo || 'zzz').localeCompare(sinAcentos(b.ubicacion?.codigo || 'zzz'), 'es', { numeric: true })
    || a.nombre.localeCompare(b.nombre));
  const enter = (e) => { if (e.key === 'Enter') { e.preventDefault(); c.registrarConteo(); } };
  const elegir = (a) => { if (sel?.id !== a.id) c.seleccionarArticulo(a); };

  const progreso = (
    <div className={clases('r2-inv-progreso', completado && 'r2-inv-progreso--listo')}>
      <div className="r2-inv-progreso-texto">
        <p className="r2-inv-progreso-cifra">
          <strong className="r2-num">{numero(k.articulos_contados || 0)} de {numero(k.total_asignados || 0)}</strong> artículos contados
        </p>
        <p className="r2-inv-desc">
          {k.secuencia > 1 ? `Conteo extra n.º ${k.secuencia}` : 'Lista asignada'} <Fecha valor={k.fecha} />
        </p>
      </div>
      <div className="r2-inv-progreso-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.progreso}
        aria-label="Avance del conteo de hoy">
        <span style={{ width: `${c.progreso}%` }} />
      </div>
      <span className="r2-inv-progreso-por r2-num">{c.progreso} %</span>
      <BotonIcono icono={RefreshCw} etiqueta="Actualizar el conteo" alHacer={c.cargarConteoHoy} />
    </div>
  );

  if (completado) {
    return (
      <>
        {progreso}
        <div className="r2-inv-terminado" role="status">
          <CheckCircle2 size={28} aria-hidden="true" className="r2-tono--ok" />
          <div className="r2-inv-terminado-texto">
            <p className="r2-vacio-titulo">Conteo del día terminado</p>
            <p className="r2-vacio-texto">
              Contaste los {numero(k.total_asignados)} artículos{k.secuencia > 1 ? ` del conteo n.º ${k.secuencia}` : ' del día'}. Mañana se asignan artículos nuevos solos.
              ¿Quieres seguir? Genera un conteo extra con otros artículos.
            </p>
          </div>
          <Boton nivel="principal" icono={FastForward} alHacer={c.handleAdelantarConteo} cargando={c.adelantando}>Generar conteo extra</Boton>
        </div>
      </>
    );
  }

  const columnas = [
    { id: 'ubicacion', titulo: 'Ubicación', ancho: '112px', celda: (a) => <span className="r2-num r2-inv-ubic-conteo">{a.ubicacion?.codigo || 'Sin ubicación'}</span> },
    {
      id: 'articulo', titulo: 'Artículo', celda: (a) => (
        <span className="r2-inv-articulo">
          <Miniatura src={a.imagen_url} alt={a.nombre} tamano={40} ampliable={false} />
          <span className="r2-inv-articulo-texto">
            <span className="r2-inv-nombre">{a.nombre}</span>
            {a.codigo_ean13 && <span className="r2-inv-desc r2-num">{a.codigo_ean13}</span>}
          </span>
        </span>
      ),
    },
    { id: 'sistema', titulo: 'En sistema', alinear: 'der', ancho: '128px', celda: (a) => <span className="r2-num">{cantidad(num(a.stock_actual), a.unidad)}</span> },
    {
      id: 'contado', titulo: 'Contado', ancho: '150px', sinBoton: true, celda: (a) => {
        const activo = sel?.id === a.id;
        return (
          <Entrada ref={activo ? c.cantidadInputRef : undefined} type="number" min="0" step="0.01" inputMode="decimal"
            className="r2-inv-contar-campo" aria-label={`Cantidad que contaste de ${a.nombre}`} placeholder="Contar"
            value={activo ? c.cantidadFisica : ''} onFocus={() => elegir(a)}
            onChange={(e) => { if (activo) c.setCantidadFisica(e.target.value); }} onKeyDown={activo ? enter : undefined} />
        );
      },
    },
    {
      id: 'notas', titulo: 'Notas', ancho: '22%', sinBoton: true, ocultarEn: 'tableta', celda: (a) => (sel?.id === a.id ? (
        <Entrada type="text" value={c.observaciones} onChange={(e) => c.setObservaciones(e.target.value)} onKeyDown={enter}
          placeholder="Opcional" aria-label={`Notas del conteo de ${a.nombre}`} />
      ) : null),
    },
  ];

  return (
    <>
      {progreso}
      <div className="r2-inv-conteo-busqueda">
        <BusquedaConRef refCampo={c.searchInputRef} valor={c.busqueda} alCambiar={c.setBusqueda} />
        {c.loadingPendientes && c.pendientes.length > 0 && <span className="r2-inv-desc" role="status">Actualizando…</span>}
      </div>
      <Tabla etiqueta="Artículos por contar" clave="id" fija={false} columnas={columnas}
        grupos={[{ id: 'por-contar', titulo: 'Por contar', filas: ordenados, nota: 'Ordenados por ubicación, como se recorre el almacén' }]}
        alAbrir={elegir} seleccionada={sel?.id} cargando={c.loadingPendientes && !c.pendientes.length}
        accion={(a) => (sel?.id === a.id ? (
          <>
            <Boton nivel="tonal" tamano="chico" alHacer={c.registrarConteo} cargando={c.registrando}
              deshabilitado={c.registrando || c.cantidadFisica === ''} motivo="Escribe la cantidad que contaste">Confirmar</Boton>
            <BotonIcono icono={X} tamano="chico" etiqueta="Dejar de contar este artículo" alHacer={() => c.setArticuloSeleccionado(null)} />
          </>
        ) : null)}
        filaCelular={(a) => ({
          inicio: <Miniatura src={a.imagen_url} alt={a.nombre} tamano={40} ampliable={false} />,
          principal: a.nombre,
          secundario: `${a.ubicacion?.codigo || 'Sin ubicación'}${a.codigo_ean13 ? ` · ${a.codigo_ean13}` : ''}`,
          derecha: cantidad(num(a.stock_actual), a.unidad),
          debajo: <span className="r2-inv-desc">en sistema</span>,
        })}
        vacio={c.busqueda ? <Vacio sinResultados busqueda={c.busqueda} alQuitar={() => c.setBusqueda('')} />
          : <Vacio icono={CheckCircle2} titulo="No hay artículos pendientes" texto="Si el avance no está completo, toca «Actualizar el conteo»." />} />

      {celular && (
        <Cajon abierto={Boolean(sel)} alCerrar={() => c.setArticuloSeleccionado(null)} etiqueta={sel ? `Contar ${sel.nombre}` : 'Contar'}>
          {sel && (
            <>
              <CajonCabecera titulo={sel.nombre} dato={sel.codigo_ean13} alCerrar={() => c.setArticuloSeleccionado(null)} />
              <CajonCuerpo>
                <SeccionCajon>
                  <Datos columnas={2} datos={[['Ubicación', sel.ubicacion?.codigo || 'Sin ubicación'], ['En sistema', cantidad(num(sel.stock_actual), sel.unidad)]]} />
                  <Campo etiqueta="Cantidad que contaste" requerido>
                    <Entrada ref={c.cantidadInputRef} type="number" min="0" step="0.01" inputMode="decimal" value={c.cantidadFisica}
                      className="r2-inv-cantidad-grande" placeholder="0" onChange={(e) => c.setCantidadFisica(e.target.value)} onKeyDown={enter} />
                  </Campo>
                  <Campo etiqueta="Notas">
                    <Entrada type="text" value={c.observaciones} onChange={(e) => c.setObservaciones(e.target.value)} onKeyDown={enter} placeholder="Opcional" />
                  </Campo>
                </SeccionCajon>
              </CajonCuerpo>
              <CajonPie>
                <Boton nivel="fantasma" alHacer={() => c.setArticuloSeleccionado(null)}>Cancelar</Boton>
                <Boton nivel="principal" icono={CheckCircle2} alHacer={c.registrarConteo} cargando={c.registrando}
                  deshabilitado={c.registrando || c.cantidadFisica === ''} motivo="Escribe la cantidad que contaste">Confirmar conteo</Boton>
              </CajonPie>
            </>
          )}
        </Cajon>
      )}
    </>
  );
}

export function VistaReportesConteo({ r }) {
  const celular = useEsCelular();
  const est = r.estadisticas;
  const abierto = r.reportes.find((x) => x.id === r.expandido) || null;
  const cerrar = () => r.toggleResumen(r.expandido);
  const pag = r.pagination;

  const filtros = (
    <div className="r2-inv-filtros-fechas" role="group" aria-label="Filtrar por fechas">
      <Campo etiqueta="Desde">
        <Entrada type="date" value={r.desde} onChange={(e) => r.setDesde(e.target.value)} />
      </Campo>
      <Campo etiqueta="Hasta">
        <Entrada type="date" value={r.hasta} onChange={(e) => r.setHasta(e.target.value)} />
      </Campo>
      <Boton nivel="tonal" alHacer={r.aplicarFiltros}>Filtrar</Boton>
      {(r.desde || r.hasta) && <Boton nivel="fantasma" alHacer={r.limpiarFechas}>Quitar fechas</Boton>}
    </div>
  );

  if (r.loading) {
    return (
      <>
        {filtros}
        <Cargando forma={celular ? 'lista' : 'tabla'} columnas={[2, 1, 1, 1, 1, 1]} filas={7} etiqueta="Cargando los reportes…" />
      </>
    );
  }

  const diferencias = (r.resumen?.articulos || [])
    .filter((a) => num(a.diferencia) !== 0)
    .sort((a, b) => Math.abs(num(b.diferencia)) - Math.abs(num(a.diferencia)));

  return (
    <>
      {est && (
        <TiraCifras etiqueta="Resumen de los conteos"
          cifras={[
            { id: 'dias', valor: est.total_dias, texto: 'Días con conteo' },
            { id: 'contados', valor: est.total_articulos_contados, texto: 'Artículos contados' },
            { id: 'dif', valor: est.total_con_diferencia, texto: 'Con diferencia', tono: num(est.total_con_diferencia) > 0 ? 'mal' : undefined },
            { id: 'exactitud', valor: `${est.porcentaje_exactitud} %`, texto: 'Exactitud' },
          ]} />
      )}
      {filtros}
      <Tabla etiqueta="Conteos por día" densidad="compacta" filas={r.reportes} clave="id" alAbrir={(x) => r.toggleResumen(x.id)} seleccionada={r.expandido}
        etiquetaAbrir={(x) => `Ver las diferencias del conteo del ${fechaExacta(x.fecha)}`}
        columnas={[
          {
            id: 'dia', titulo: 'Día', celda: (x) => (
              <span className="r2-inv-articulo-texto">
                <span className="r2-inv-nombre"><Fecha valor={x.fecha} /></span>
                {x.secuencia > 1 && <span className="r2-inv-desc">Conteo extra n.º {x.secuencia}</span>}
              </span>
            ),
          },
          { id: 'estado', titulo: 'Estado', ancho: '16%', celda: (x) => (x.estado === 'completado' ? <Estado tono="ok" texto="Terminado" /> : <Estado tono="aviso" texto="Pendiente" />) },
          { id: 'contados', titulo: 'Contados', alinear: 'der', ancho: '14%', celda: (x) => `${numero(x.articulos_contados)} de ${numero(x.total_asignados)}` },
          { id: 'faltantes', titulo: 'Faltantes', alinear: 'der', ancho: '12%', celda: (x) => <span className={num(x.stats?.faltantes) ? 'r2-tono--mal r2-inv-cifra' : ''}>{numero(x.stats?.faltantes || 0)}</span> },
          { id: 'sobrantes', titulo: 'Sobrantes', alinear: 'der', ancho: '12%', celda: (x) => <span className={num(x.stats?.sobrantes) ? 'r2-tono--aviso r2-inv-cifra' : ''}>{numero(x.stats?.sobrantes || 0)}</span> },
          { id: 'exactos', titulo: 'Exactos', alinear: 'der', ancho: '12%', ocultarEn: 'celular-ancho', celda: (x) => numero(x.stats?.exactos || 0) },
        ]}
        filaCelular={(x) => ({
          principal: <Fecha valor={x.fecha} />,
          secundario: `${numero(x.articulos_contados)} de ${numero(x.total_asignados)} contados · ${numero(x.stats?.faltantes || 0)} faltantes · ${numero(x.stats?.sobrantes || 0)} sobrantes`,
          debajo: x.estado === 'completado' ? <Estado tono="ok" texto="Terminado" /> : <Estado tono="aviso" texto="Pendiente" />,
        })}
        error={r.errorCargaR2 ? { mensaje: 'No se pudieron cargar los reportes del conteo.', motivo: motivoLegible(r.errorCargaR2), alReintentar: () => r.cargarReportes(r.pagination?.page || 1) } : undefined}
        vacio={<Vacio titulo="No hay conteos registrados" texto={r.desde || r.hasta ? 'Prueba con otras fechas.' : 'Los conteos de cada día aparecerán aquí.'} />} />

      {pag && pag.totalPages > 1 && (
        <nav className="r2-inv-paginas" aria-label="Páginas de reportes">
          <span className="r2-inv-desc">Página {pag.page} de {pag.totalPages}</span>
          {Array.from({ length: pag.totalPages }, (_, i) => i + 1).map((n) => (
            <Boton key={n} nivel={n === pag.page ? 'tonal' : 'fantasma'} tamano="chico" aria-current={n === pag.page ? 'page' : undefined}
              alHacer={() => r.cargarReportes(n)}>{String(n)}</Boton>
          ))}
        </nav>
      )}

      <Cajon abierto={Boolean(abierto)} alCerrar={cerrar} ancho="ancho" etiqueta="Diferencias del conteo">
        {abierto && (
          <>
            <CajonCabecera titulo={`Conteo del ${fechaExacta(abierto.fecha)}`}
              dato={`${numero(abierto.articulos_contados)} de ${numero(abierto.total_asignados)} contados${abierto.secuencia > 1 ? ` · conteo extra n.º ${abierto.secuencia}` : ''}`}
              estado={abierto.estado === 'completado' ? <Estado tono="ok" texto="Terminado" /> : <Estado tono="aviso" texto="Pendiente" />} alCerrar={cerrar} />
            <CajonCuerpo>
              {r.loadingResumen || !r.resumen ? <Cargando forma="ficha" filas={5} etiqueta="Cargando las diferencias…" /> : (
                <>
                  <SeccionCajon titulo="Resultado">
                    <Datos columnas={2} datos={[
                      { etiqueta: 'Artículos contados', valor: numero(r.resumen.estadisticas.total_contados), numero: true },
                      { etiqueta: 'Exactos', valor: numero(r.resumen.estadisticas.exacto), numero: true },
                      { etiqueta: 'Sobrantes', valor: <span className={num(r.resumen.estadisticas.sobrante) ? 'r2-tono--aviso r2-inv-cifra' : ''}>{numero(r.resumen.estadisticas.sobrante)}</span>, numero: true },
                      { etiqueta: 'Faltantes', valor: <span className={num(r.resumen.estadisticas.faltante) ? 'r2-tono--mal r2-inv-cifra' : ''}>{numero(r.resumen.estadisticas.faltante)}</span>, numero: true },
                    ]} />
                  </SeccionCajon>
                  <SeccionCajon titulo={`Artículos con diferencia${diferencias.length ? ` · ${diferencias.length}` : ''}`}>
                    {r.resumen.estadisticas.con_diferencia === 0 && r.resumen.estadisticas.total_contados > 0 ? (
                      <p className="r2-inv-todo-bien"><CheckCircle2 size={18} aria-hidden="true" /> Todo coincide con el sistema.</p>
                    ) : (
                      <Tabla etiqueta="Artículos con diferencia" densidad="compacta" fija={false} filas={diferencias} clave="id"
                        columnas={[
                          { id: 'art', titulo: 'Artículo', celda: (a) => a.articulo?.nombre || `Artículo n.º ${a.articulo_id}` },
                          { id: 'sis', titulo: 'En sistema', alinear: 'der', ancho: '18%', celda: (a) => numero(num(a.cantidad_sistema)) },
                          { id: 'fis', titulo: 'Contado', alinear: 'der', ancho: '16%', celda: (a) => numero(num(a.cantidad_fisica)) },
                          { id: 'dif', titulo: 'Diferencia', alinear: 'der', ancho: '18%', celda: (a) => <span className={clases('r2-inv-cifra', num(a.diferencia) > 0 ? 'r2-tono--aviso' : 'r2-tono--mal')}>{conSigno(a.diferencia)}</span> },
                        ]}
                        filaCelular={(a) => ({
                          principal: a.articulo?.nombre || `Artículo n.º ${a.articulo_id}`,
                          secundario: `En sistema ${numero(num(a.cantidad_sistema))} · contado ${numero(num(a.cantidad_fisica))}`,
                          derecha: <span className={num(a.diferencia) > 0 ? 'r2-tono--aviso' : 'r2-tono--mal'}>{conSigno(a.diferencia)}</span>,
                        })}
                        vacio={<Vacio compacto titulo="Sin diferencias" />} />
                    )}
                  </SeccionCajon>
                </>
              )}
            </CajonCuerpo>
          </>
        )}
      </Cajon>
    </>
  );
}

