// Rediseño 2 · Producción · Tablero de producción (/produccion), vista encendida.
// Antes: 4 tarjetas de números, 8 controles en dos renglones y una tarjeta de 419 px por obra (15 pantallas).
// Ahora: encabezado con UNA acción («Nuevo proyecto»; lo raro en «Más acciones»), los filtros como tira de cifras, y una
// obra por renglón agrupada por lo que se decide (atrasadas arriba). El detalle y los interruptores de etapa viven en el
// cajón de la obra. Todo lo que pinta sale de la página: mismos datos, mismos filtros, mismos manejadores.
import { useMemo, useState } from 'react';
import { Plus, Monitor, Database, Cloud, FolderOpen, ArrowUpDown } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, BarraFiltros, Tabla, Estado, plural, numero, clases, fechaCita, fechaExacta, tipoTrabajo, useEsCelular,
} from '../fundacion';
import ProyectoCarpetaModal from '../../components/produccion/ProyectoCarpetaModal';
import {
  atrasoDe, etapaDe, pasosDe, problemaDe, fechaMaximaDe, citaDe, grupoDe, agrupar, GRUPOS_TABLERO, horaDe,
} from './obras';
import { Segmentos, TextoTono, FechaMaxima } from './PiezasObra';
import { TiraFiltrosObras } from './TiraFiltrosObras';
import { DialogoOrdenFiltros } from './DialogoOrdenFiltros';
import { CajonObra } from './CajonObra';
import { CajonNuevoProyecto } from './CajonNuevoProyecto';
import './produccion.css';

// Lo que cada renglón necesita, calculado una vez por obra
const leerObra = (p) => {
  const atraso = atrasoDe(p);
  const pasos = pasosDe(p);
  return { p, atraso, pasos, etapa: etapaDe(p), problema: problemaDe(p, pasos, atraso), maxima: fechaMaximaDe(p), cita: citaDe(p), grupo: grupoDe(p, atraso) };
};

function CeldaObra({ o }) {
  const tipo = tipoTrabajo(o.p.tipo_proyecto);
  const sub = [o.p.cliente, tipo?.texto].filter(Boolean).join(' · ');
  return (
    <span className="r2-prod-obra">
      <span className="r2-prod-obra-nombre">{o.p.nombre}</span>
      {sub && <span className="r2-prod-obra-sub r2-prod-una-linea" title={sub}>{sub}</span>}
    </span>
  );
}

// Etapa actual y, debajo, «Urgente» cuando la tarjeta de hoy lo marcaba (urgente sin atraso). Revisión: si la fecha
// máxima ya sale en ámbar o rojo (vence en 3 días o menos), «Urgente» no se repite aquí: un solo aviso por renglón. Sigue
// a la vista cuando la urgencia viene de la prioridad o de una garantía, y siempre en la cabecera del cajón.
function CeldaEtapa({ o }) {
  const urgente = o.atraso.esUrgente && !o.atraso.enRetraso && !o.p.pausado && !o.maxima?.tono;
  return (
    <span className="r2-prod-etapa">
      <Estado tono={o.p.pausado ? 'neutro' : o.etapa.tono} texto={o.p.pausado ? 'Pausada' : o.etapa.texto} />
      {urgente && <TextoTono tono="aviso" className="r2-prod-urgente">Urgente</TextoTono>}
    </span>
  );
}

// Lo que el renglón dice en «Avance» en escritorio: la etapa ya sale en su columna, así que no se repite
// («Pausada» o «Por empezar» dos veces en el mismo renglón). En celular se usa el texto completo.
const textoAvance = (o) => {
  if (o.p.pausado) return { texto: o.p.pausado_motivo ? `Motivo: ${o.p.pausado_motivo}` : 'Sin motivo anotado', tono: 'neutro' };
  if (o.p.etapa_actual === 'pendiente') return { texto: '', tono: null };
  return o.problema;
};

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
  cargarDatos, sincronizarSheets, sincronizarDrive, regresarEtapa, crearProyecto, togglePausa, toggleEtapa,
  filtro, setFiltro, busqueda, setBusqueda, opciones, modalOpen, setModalOpen, proyectoCarpeta, setProyectoCarpeta,
  claveOrdenFiltros, ordenarOpciones,
}) {
  const celular = useEsCelular();
  const [obraId, setObraId] = useState(null);
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
  // El cajón sigue a la obra aunque la lista se recargue (busca la versión más nueva por id)
  const obraAbierta = obraId != null ? proyectos.find((p) => p.id === obraId) || null : null;

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

  const columnas = [
    { id: 'obra', titulo: 'Obra', celda: (o) => <CeldaObra o={o} /> },
    // Anchos que se encogen entre 1440 y 1280 px para que la columna «Obra» no se quede en 170 px (nombres en 3 renglones)
    { id: 'etapa', titulo: 'Etapa actual', ancho: 'clamp(148px, calc(168px - (1440px - 100vw) * 0.125), 168px)', celda: (o) => <CeldaEtapa o={o} /> },
    {
      id: 'avance', titulo: 'Avance', ancho: 'clamp(236px, calc(288px - (1440px - 100vw) * 0.325), 288px)',
      celda: (o) => {
        const t = textoAvance(o);
        return (
          <span className="r2-prod-avance">
            <Segmentos pasos={o.pasos} />
            <TextoTono tono={t.tono} className="r2-prod-problema">{t.texto}</TextoTono>
          </span>
        );
      },
    },
    {
      id: 'cita', titulo: 'Cita', ancho: 'clamp(104px, calc(112px - (1440px - 100vw) * 0.05), 112px)', ocultarEn: 'tableta',
      celda: (o) => (o.cita ? <span className="r2-num" title={fechaExacta(o.cita)}>{fechaCita(o.cita)}</span> : <span className="r2-prod-sin-dato" title="Sin cita en el calendario">—</span>),
    },
    { id: 'maxima', titulo: 'Fecha máxima', ancho: 'clamp(124px, calc(136px - (1440px - 100vw) * 0.075), 136px)', celda: (o) => <FechaMaxima info={o.maxima} /> },
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

      <Tabla etiqueta="Obras" clave={(o) => o.p.id} columnas={columnas} grupos={grupos}
        alAbrir={(o) => setObraId(o.p.id)} etiquetaAbrir={(o) => `Abrir la obra ${o.p.nombre}`} seleccionada={obraId}
        masAcciones={celular ? undefined : (o) => [{ texto: 'Ver carpeta de la obra', icono: FolderOpen, alHacer: () => setProyectoCarpeta(o.p) }]}
        filaCelular={(o) => ({
          principal: o.p.nombre,
          // El problema ya nombra la etapa («Compras · 2 días de atraso»); en celular no se repite
          secundario: <TextoTono tono={o.problema.tono}>{o.problema.texto}</TextoTono>,
          derecha: o.maxima ? <TextoTono tono={o.maxima.tono}>{o.maxima.texto || '—'}</TextoTono> : <span className="r2-prod-sin-dato">Sin fecha</span>,
          debajo: <Segmentos pasos={o.pasos} />,
        })}
        cargando={loading}
        error={sinDatos ? { mensaje: 'No se pudo cargar el tablero de producción.', alReintentar: cargarDatos } : null}
        vacio={vacio} />
      {celular && !loading && <ResumenEtapas estadisticas={estadisticas} className="r2-prod-resumen--pie" />}

      <CajonObra proyecto={obraAbierta} abierto={Boolean(obraAbierta)} alCerrar={() => setObraId(null)}
        onToggleEtapa={toggleEtapa}
        onRegresar={esAlmacen ? undefined : regresarEtapa}
        onTogglePausa={esAlmacen ? undefined : togglePausa}
        etapasPermitidas={esAlmacen ? ['manufactura', 'herreria'] : null}
        alAbrirCarpeta={(p) => setProyectoCarpeta(p)} />

      <CajonNuevoProyecto abierto={modalOpen} alCerrar={() => setModalOpen(false)} onCrear={crearProyecto} />

      <DialogoOrdenFiltros abierto={ordenando} alCerrar={() => setOrdenando(false)} orden={orden} guardar={guardarOrden}
        personalizado={personalizado} alOrdenOriginal={ordenOriginal} />

      {/* Carpeta de producción de la obra (planos y tickets): la misma pieza y la misma petición de hoy al abrirla */}
      <ProyectoCarpetaModal isOpen={!!proyectoCarpeta} onClose={() => setProyectoCarpeta(null)} proyecto={proyectoCarpeta} />
    </Pagina>
  );
}
