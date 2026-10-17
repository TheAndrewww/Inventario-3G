// Rediseño 2 · Compras · Órdenes de compra (/ordenes-compra), vista ENCENDIDA.
// La pantalla es una bandeja por estado: lo que Dirección tiene que aprobar va arriba con «Aprobar» en el renglón; luego lo
// rechazado (por corregir), lo enviado que falta que llegue y lo recibido en parte. El detalle se abre en un cajón ancho con
// la decisión arriba. Todo el estado, las peticiones y los manejadores siguen en OrdenesCompraPage: aquí solo se pinta.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, Download } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, TiraCifras, BarraFiltros, FiltroMenu, Segmentado, Tabla, Estado, Fecha, Boton,
  useEsCelular,
} from '../fundacion';
import { CajonOrden, DialogoRechazo } from './CajonOrden';
import { importe, OPCIONES_ESTADO_ORDEN, vistaDeEstado, GRUPOS_ORDEN, errorDeCarga, nombreRol } from './comunes';
import Llegada from './Llegada';
import './compras.css';

const CON_PDF = ['enviada', 'parcial', 'recibida'];
const ESPERANDO = ['enviada', 'parcial'];

export default function VistaOrdenes(p) {
  const {
    ordenes, filteredOrdenes, loading, errorCarga, recargar, estadisticas,
    searchTerm, setSearchTerm, filterEstado, setFilterEstado, vistaOrdenes, setVistaOrdenes,
    puedeCrearOrdenes, esDiseñador, esAdmin, abrirNueva, verDetalle, generarPDFOrden,
    aprobar, abrirRechazo, loadingAprobacion, ordenSeleccionada, detalleAbierto, children,
  } = p;
  const celular = useEsCelular();
  const navegar = useNavigate();

  // Cifras de la bandeja: las de la lista que ya llegó (no se piden aparte)
  const cuenta = useMemo(() => {
    const c = {};
    (ordenes || []).forEach((o) => { c[o.estado] = (c[o.estado] || 0) + 1; });
    return c;
  }, [ordenes]);
  const porVista = useMemo(() => {
    const v = { activas: 0, completadas: 0, canceladas: 0 };
    (ordenes || []).forEach((o) => { v[vistaDeEstado(o.estado)] += 1; });
    return v;
  }, [ordenes]);

  const elegirEstado = (estado) => {
    // Un estado vive en una sola vista: se cambia a la suya para que la lista no quede vacía sin razón
    setFilterEstado(estado);
    if (estado) setVistaOrdenes(vistaDeEstado(estado));
  };
  const alternarCifra = (estado) => elegirEstado(filterEstado === estado ? '' : estado);
  const quitarFiltros = () => { setFilterEstado(''); setSearchTerm(''); };
  const activos = (filterEstado ? 1 : 0) + (searchTerm ? 1 : 0);

  const r = estadisticas?.resumen;
  // Mientras no hay lista (cargando o con error) no se pintan ceros que engañan: solo las cifras que ya llegaron aparte
  const sinLista = !(ordenes || []).length && Boolean(loading || errorCarga);
  const cifras = sinLista ? [] : [
    { id: 'pendiente_aprobacion', valor: cuenta.pendiente_aprobacion || 0, texto: 'Por aprobar', tono: cuenta.pendiente_aprobacion ? 'aviso' : null },
    { id: 'enviada', valor: cuenta.enviada || 0, texto: 'Enviadas' },
    { id: 'parcial', valor: cuenta.parcial || 0, texto: 'Recibidas en parte' },
    { id: 'rechazada', valor: cuenta.rechazada || 0, texto: 'Rechazadas', tono: cuenta.rechazada ? 'mal' : null },
  ].map((c) => ({ ...c, activa: filterEstado === c.id, alElegir: () => alternarCifra(c.id), titulo: `Ver solo: ${c.texto.toLowerCase()}` }));
  if (r) {
    cifras.push({
      id: 'solicitudes', valor: r.solicitudesPendientes, texto: 'Solicitudes pendientes',
      tono: r.solicitudesPendientes > 10 ? 'aviso' : null,
      titulo: r.solicitudesPendientes > 10 ? 'Requiere atención · ir a Solicitudes de compra' : 'Ir a Solicitudes de compra',
      alElegir: () => navegar('/solicitudes-compra'),
    });
  }
  const informativas = r ? [
    {
      valor: estadisticas.importesOcultos ? '—' : importe(null, r.totalEstimadoMes),
      texto: `Total de ${new Date().toLocaleDateString('es-MX', { month: 'long' })}`,
    },
  ] : [];

  const grupos = useMemo(() => {
    if (vistaOrdenes !== 'activas') return null;
    const conocidos = new Set(GRUPOS_ORDEN.map((g) => g.id));
    const lista = GRUPOS_ORDEN.map((g) => ({ id: g.id, titulo: g.titulo, filas: filteredOrdenes.filter((o) => o.estado === g.id) }));
    const otras = filteredOrdenes.filter((o) => !conocidos.has(o.estado));
    if (otras.length) lista.push({ id: 'otras', titulo: 'Otras', filas: otras });
    return lista;
  }, [filteredOrdenes, vistaOrdenes]);

  const columnas = [
    { id: 'folio', titulo: 'Folio', ancho: '120px', celda: (o) => <span className="r2c-folio">{o.ticket_id}</span> },
    {
      id: 'proveedor', titulo: 'Proveedor',
      celda: (o) => (
        <span className="r2c-celda-doble">
          <span className="r2c-fuerte">{o.proveedor?.nombre || 'Sin proveedor'}</span>
          <span className="r2c-sec" title={o.creador?.rol ? nombreRol(o.creador.rol) : undefined}>{o.creador?.nombre ? `por ${o.creador.nombre}` : '—'}</span>
        </span>
      ),
    },
    { id: 'total', titulo: 'Total', alinear: 'der', celda: (o) => <span className="r2c-importe">{importe(o, o.total_estimado)}</span> },
    { id: 'estado', titulo: 'Estado', celda: (o) => <Estado dominio="orden" valor={o.estado} /> },
    vistaOrdenes === 'activas' && {
      id: 'llegada', titulo: 'Llegada estimada', ocultarEn: 'celular-ancho',
      celda: (o) => (ESPERANDO.includes(o.estado) && o.fecha_llegada_estimada
        ? <Llegada fecha={o.fecha_llegada_estimada} />
        : <span className="r2c-tenue">—</span>),
    },
    { id: 'fecha', titulo: 'Creada', ocultarEn: 'celular-ancho', celda: (o) => <Fecha valor={o.created_at} /> },
  ].filter(Boolean);

  const accion = celular ? undefined : (o) => {
    if (esAdmin && o.estado === 'pendiente_aprobacion') {
      return (
        <>
          <Boton nivel="tonal" tamano="chico" icono={Check} alHacer={() => aprobar(o)} deshabilitado={loadingAprobacion} motivo="Se está procesando una aprobación o un rechazo"
            aria-label={`Aprobar la orden ${o.ticket_id}`}>Aprobar</Boton>
          <Boton nivel="fantasma" tamano="chico" alHacer={() => abrirRechazo(o)} deshabilitado={loadingAprobacion} aria-label={`Rechazar la orden ${o.ticket_id}`}>Rechazar</Boton>
        </>
      );
    }
    if (CON_PDF.includes(o.estado)) {
      return (
        <Boton nivel="fantasma" tamano="chico" icono={Download} alHacer={() => generarPDFOrden(o)} title="Descargar PDF"
          aria-label={`Descargar el PDF de la orden ${o.ticket_id}`}>PDF</Boton>
      );
    }
    return null;
  };

  const sinFiltros = !searchTerm && !filterEstado;
  const vacio = sinFiltros
    ? {
      titulo: vistaOrdenes === 'activas' ? 'No hay órdenes activas' : vistaOrdenes === 'completadas' ? 'No hay órdenes recibidas' : 'No hay órdenes canceladas',
      texto: vistaOrdenes === 'activas'
        ? (puedeCrearOrdenes ? 'Crea una con «Nueva orden» o ármala desde Solicitudes.' : 'Cuando compras cree una orden aparecerá aquí.')
        : 'Aquí aparecen las de las últimas 50 órdenes que ya se cerraron.',
    }
    : { sinResultados: true, busqueda: searchTerm || undefined, alQuitar: quitarFiltros };

  const vistas = (
    <Segmentado etiqueta="Qué órdenes ver" valor={vistaOrdenes} alCambiar={setVistaOrdenes} anchoCompleto={celular}
      opciones={[
        { valor: 'activas', texto: 'Activas', cuenta: sinLista ? undefined : porVista.activas },
        { valor: 'completadas', texto: 'Completadas', cuenta: sinLista ? undefined : porVista.completadas },
        { valor: 'canceladas', texto: 'Canceladas', cuenta: sinLista ? undefined : porVista.canceladas },
      ]} />
  );

  return (
    <Pagina titulo="Órdenes de compra" densidad="comoda" className="r2c-pagina">
      <EncabezadoPagina pestanas="seccion"
        ayuda={esDiseñador ? 'Puedes crear órdenes aunque no haya existencia: se generan solicitudes automáticas para lo que falte.' : undefined}
        principal={puedeCrearOrdenes ? { texto: 'Nueva orden', corto: 'Nueva', icono: Plus, alHacer: abrirNueva } : undefined} />

      <TiraCifras etiqueta="Órdenes por estado" cifras={cifras} informativas={informativas} />

      <BarraFiltros
        busqueda={{ valor: searchTerm, alCambiar: setSearchTerm, texto: celular ? 'Buscar' : 'Buscar folio, proveedor u observaciones', etiqueta: 'Buscar folio, proveedor u observaciones' }}
        filtros={[
          <FiltroMenu key="estado" etiqueta="Estado" valor={filterEstado} alCambiar={elegirEstado}
            opciones={OPCIONES_ESTADO_ORDEN.map((o) => ({ ...o, cuenta: o.valor ? (cuenta[o.valor] || 0) : undefined }))} />,
        ]}
        activos={activos} alQuitar={quitarFiltros} resultados={filteredOrdenes.length}
        vista={celular ? null : vistas} />
      {/* Revisión final: en celular «Activas · Completadas · Canceladas» queda a la vista (antes vivía dentro del cajón
          «Filtros»), como «Por preparar · Completados» en Tickets */}
      {celular && <div className="r2c-vistas-celular">{vistas}</div>}

      <Tabla etiqueta="Órdenes de compra" clave="id" columnas={columnas}
        grupos={grupos || undefined} filas={grupos ? undefined : filteredOrdenes}
        alAbrir={verDetalle} etiquetaAbrir={(o) => `Abrir la orden ${o.ticket_id}`}
        seleccionada={detalleAbierto ? ordenSeleccionada?.id : undefined}
        accion={accion}
        filaCelular={(o) => ({
          principal: o.ticket_id,
          secundario: o.proveedor?.nombre || 'Sin proveedor',
          derecha: importe(o, o.total_estimado),
          debajo: <Estado dominio="orden" valor={o.estado} />,
        })}
        cargando={loading && !(ordenes || []).length}
        error={errorDeCarga('No se pudo cargar la lista de órdenes.', errorCarga, recargar)}
        vacio={vacio} />

      <CajonOrden {...p} />
      <DialogoRechazo {...p.rechazo} />
      {children}
    </Pagina>
  );
}
