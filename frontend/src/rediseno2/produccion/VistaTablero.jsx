// Rediseño 2 · Producción · Tablero de producción (/produccion), vista encendida.
// Encabezado con UNA acción («Nuevo proyecto»; lo raro en «Más acciones») y los filtros como tira de cifras. Debajo, desde el
// 19-oct-2026 (a pedido del usuario: «mantén la estructura anterior con el diseño nuevo»), la tarjeta de siempre por obra
// (botones de etapa ahí mismo, fecha máxima, cita del calendario) agrupada por lo que se decide y con color por urgencia.
// Todo lo que pinta sale de la página: mismos datos, mismos filtros, mismos manejadores.
import { useMemo, useState } from 'react';
import { Plus, Monitor, Database, Cloud, FolderOpen, ArrowUpDown } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, BarraFiltros, Cargando, Vacio, ErrorCarga, plural, numero, clases, useEsCelular,
} from '../fundacion';
import ProyectoCarpetaModal from '../../components/produccion/ProyectoCarpetaModal';
import ProyectoTimeline from '../../components/produccion/ProyectoTimeline';
import { atrasoDe, grupoDe, agrupar, GRUPOS_TABLERO, horaDe } from './obras';
import { TiraFiltrosObras } from './TiraFiltrosObras';
import { DialogoOrdenFiltros } from './DialogoOrdenFiltros';
import { CajonNuevoProyecto } from './CajonNuevoProyecto';
import './produccion.css';

// Estructura de antes con el diseño nuevo (19-oct-2026, a pedido del usuario): una TARJETA por obra con sus botones de
// etapa ahí mismo, la fecha máxima y la cita del calendario (ProyectoTimeline, la misma de siempre), agrupadas por lo que se
// decide. Cada grupo tiene su color (escala de urgencia): Atrasadas rojo → Vencen esta semana ámbar → En tiempo verde →
// Listas para instalar azul → Pausadas y cerradas gris. La obra con prioridad «Urgente» lleva su marca.
const leerObra = (p) => ({ p, grupo: grupoDe(p, atrasoDe(p)) });

// Conteo por etapa que da el servidor: lo que hoy salía en las 4 tarjetas (En diseño, En compras, En producción,
// Completado). Es informativo (no filtra); la tira de arriba cuenta lo que deja ver cada filtro, por eso pueden no coincidir.
function ResumenEtapas({ estadisticas, className }) {
  if (!estadisticas || !Object.keys(estadisticas).length) return null;
  const n = (k) => Number(estadisticas[k]) || 0;
  const partes = [
    ['diseno', n('diseno'), 'en diseño'],
    ['compras', n('compras'), 'en compras'],
    ['produccion', n('produccion'), 'en producción'],
    ['instalacion', n('instalacion'), plural(n('instalacion'), 'lista para instalar', 'listas para instalar', true)],
  ];
  return (
    <p className={clases('r2-prod-resumen', className)}
      title="Conteo del servidor por la etapa en que va cada obra (lo de las tarjetas de antes). Las cifras de arriba cuentan lo que muestra cada filtro, por eso pueden no coincidir.">
      <span>Por etapa actual:</span>
      {partes.map(([k, valor, texto]) => (
        <span key={k}><span className="r2-num r2-prod-resumen-n">{numero(valor)}</span> {texto}</span>
      ))}
    </p>
  );
}

export default function VistaTablero({
  usuario, esAlmacen, proyectos, proyectosVisibles, proyectosFiltrados, estadisticas, loading, sincronizando, ultimaSync,
  cargarDatos, sincronizarSheets, sincronizarDrive, completarEtapa, completarSubEtapa, regresarEtapa, crearProyecto, togglePausa, toggleEtapa,
  filtro, setFiltro, busqueda, setBusqueda, opciones, modalOpen, setModalOpen, proyectoCarpeta, setProyectoCarpeta,
  claveOrdenFiltros, ordenarOpciones,
}) {
  const celular = useEsCelular();
  const [ordenando, setOrdenando] = useState(false);

  // Orden de los filtros por persona: la MISMA clave y la MISMA regla que las píldoras de hoy (FiltrosProyectos)
  const [orden, setOrden] = useState(() => {
    try {
      return ordenarOpciones(opciones, JSON.parse(localStorage.getItem(claveOrdenFiltros(usuario?.id)) || 'null'));
    } catch {
      return opciones;
    }
  });
  const guardarOrden = (nuevas) => {
    setOrden(nuevas);
    try { localStorage.setItem(claveOrdenFiltros(usuario?.id), JSON.stringify(nuevas.map((o) => o.value))); } catch { /* sin almacenamiento: solo esta sesión */ }
  };
  const ordenOriginal = () => { guardarOrden(opciones); try { localStorage.removeItem(claveOrdenFiltros(usuario?.id)); } catch { /* nada */ } };
  const personalizado = orden.some((o, i) => o.value !== opciones[i]?.value);

  const obras = useMemo(() => proyectosFiltrados.map(leerObra), [proyectosFiltrados]);
  const grupos = useMemo(() => agrupar(obras, (o) => o.grupo, GRUPOS_TABLERO), [obras]);

  // Error de la primera carga: la página solo avisa con un mensaje flotante; sin datos ni estadísticas, falló
  const sinDatos = !loading && proyectos.length === 0 && Object.keys(estadisticas || {}).length === 0;
  const filtrando = Boolean(busqueda) || filtro !== 'todos';
  const quitarFiltros = () => { setBusqueda(''); setFiltro('todos'); };

  const dato = sinDatos ? 'sin datos' : loading && proyectos.length === 0 ? 'Cargando obras…' : [
    plural(proyectosVisibles.length, 'obra', 'obras'),
    sincronizando ? 'actualizando…' : ultimaSync ? `datos de las ${horaDe(ultimaSync)}` : null,
  ].filter(Boolean).join(' · ');

  const masAcciones = esAlmacen ? null : [
    { grupo: 'Pantallas de TV (abren aparte)' },
    { texto: 'TV Producción', icono: Monitor, href: '/produccion-tv?diseno=3g', nuevaPestana: true, titulo: 'Vista TV - Producción' },
    { texto: 'TV Preparados', icono: Monitor, href: '/preparados-tv?diseno=3g', nuevaPestana: true, titulo: 'Vista TV - Preparados' },
    { texto: 'TV Manufactura', icono: Monitor, href: '/manufactura-tv?diseno=3g', nuevaPestana: true, titulo: 'Vista TV - Manufactura' },
    { texto: 'TV Herrería', icono: Monitor, href: '/herreria-tv?diseno=3g', nuevaPestana: true, titulo: 'Vista TV - Herrería' },
    '-',
    { texto: sincronizando ? 'Actualizando…' : 'Traer obras del Índice', icono: Database, alHacer: sincronizarSheets, deshabilitado: sincronizando, titulo: 'Actualizar nuevos proyectos desde Google Sheets' },
    { texto: sincronizando ? 'Actualizando…' : 'Actualizar carpetas de Drive', icono: Cloud, alHacer: sincronizarDrive, deshabilitado: sincronizando, titulo: 'Actualizar carpetas y archivos desde Google Drive' },
    '-',
    { texto: 'Ordenar filtros…', icono: ArrowUpDown, alHacer: () => setOrdenando(true) },
  ];

  const vacio = filtrando
    ? { sinResultados: true, busqueda: busqueda || null, alQuitar: quitarFiltros }
    : {
      titulo: 'No hay obras en el tablero',
      texto: esAlmacen ? 'Cuando una obra entre a producción aparecerá aquí.' : 'Las obras llegan del Índice de producción. Si falta alguna, tráelas del Índice o crea un proyecto nuevo.',
      accion: esAlmacen ? null : { texto: 'Traer obras del Índice', icono: Database, alHacer: sincronizarSheets },
    };

  return (
    <Pagina titulo="Tablero de producción" densidad="comoda" className="r2-prod-tablero">
      <EncabezadoPagina titulo="Tablero de producción" dato={dato}
        ayuda={esAlmacen ? 'Vista de almacén: solo obras en producción. En el cajón de cada obra puedes marcar manufactura y herrería.' : null}
        masAcciones={masAcciones || []}
        principal={esAlmacen ? null : { texto: 'Nuevo proyecto', corto: 'Nuevo', icono: Plus, alHacer: () => setModalOpen(true) }} />

      {!esAlmacen && proyectos.length > 0 && (
        <TiraFiltrosObras orden={orden} guardar={guardarOrden} personalizado={personalizado} alOrdenOriginal={ordenOriginal}
          filtro={filtro} setFiltro={setFiltro} proyectos={proyectosVisibles} />
      )}
      <BarraFiltros busqueda={{ valor: busqueda, alCambiar: setBusqueda, texto: celular ? 'Buscar obra…' : 'Buscar obra por nombre…', etiqueta: 'Buscar obra por nombre' }}
        activos={filtrando ? 1 : 0} alQuitar={quitarFiltros} resultados={proyectosFiltrados.length}
        vista={celular ? null : <ResumenEtapas estadisticas={estadisticas} />} />

      {loading && proyectos.length === 0 ? (
        <Cargando forma="lista" filas={6} etiqueta="Cargando obras…" />
      ) : sinDatos ? (
        <ErrorCarga mensaje="No se pudo cargar el tablero de producción." alReintentar={cargarDatos} />
      ) : obras.length === 0 ? (
        <Vacio {...vacio} />
      ) : (
        <div className="r2-prod-tarjetas">
          {grupos.filter((g) => g.filas.length > 0).map((g) => (
            <section key={g.id} className={`r2-prod-grupo r2-prod-grupo--${g.id}`} aria-label={g.titulo}>
              <h2 className="r2-prod-grupo-titulo">
                <span className="r2-prod-grupo-punto" aria-hidden="true" />
                {g.titulo}
                <span className="r2-prod-grupo-n">{g.filas.length}</span>
                {g.nota && <span className="r2-prod-grupo-nota">{g.nota}</span>}
              </h2>
              <div className="r2-prod-grupo-lista">
                {g.filas.map(({ p }) => (
                  <article key={p.id} className={clases('r2-prod-tarjeta', p.prioridad === 1 && 'r2-prod-tarjeta--urgente')}>
                    {p.prioridad === 1 && <span className="r2-prod-tarjeta-prioridad">Prioridad urgente</span>}
                    <ProyectoTimeline
                      proyecto={p}
                      onAbrirCarpeta={() => setProyectoCarpeta(p)}
                      onCompletar={esAlmacen ? undefined : completarEtapa}
                      onRegresar={esAlmacen ? undefined : regresarEtapa}
                      onCompletarSubEtapa={completarSubEtapa}
                      onTogglePausa={esAlmacen ? undefined : togglePausa}
                      onToggleEtapa={toggleEtapa}
                      // Calidad solo cierra producción: no mueve diseño ni compras
                      etapasPermitidas={esAlmacen ? ['manufactura', 'herreria'] : null}
                    />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {celular && !loading && <ResumenEtapas estadisticas={estadisticas} className="r2-prod-resumen--pie" />}

      <CajonNuevoProyecto abierto={modalOpen} alCerrar={() => setModalOpen(false)} onCrear={crearProyecto} />

      <DialogoOrdenFiltros abierto={ordenando} alCerrar={() => setOrdenando(false)} orden={orden} guardar={guardarOrden}
        personalizado={personalizado} alOrdenOriginal={ordenOriginal} />

      {/* Carpeta de producción de la obra (planos y tickets): la misma pieza y la misma petición de hoy al abrirla */}
      <ProyectoCarpetaModal isOpen={!!proyectoCarpeta} onClose={() => setProyectoCarpeta(null)} proyecto={proyectoCarpeta} />
    </Pagina>
  );
}
