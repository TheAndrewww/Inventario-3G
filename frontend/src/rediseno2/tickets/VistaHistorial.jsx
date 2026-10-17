// Rediseño 2 · Historial (/historial), vista encendida. La página guarda el estado, la carga y el filtro de búsqueda;
// aquí solo se pinta. Plano (DISENO-v2 §5.2): pestañas de la sección → fila de filtros (búsqueda con foco y fecha) →
// tabla compacta que cabe, agrupada por día → detalle en cajón con «Descargar PDF» arriba.
import { Download, History } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, BarraFiltros, Tabla, Boton, Fecha, Estado, Datos,
  Cajon, CajonCabecera, CajonDecision, CajonCuerpo, SeccionCajon,
  cantidad, fechaExacta, numero, useEsCelular,
} from '../fundacion';
import { agruparPorDia, estadoMovimiento, tipoMovimiento } from './datos';
import './tickets.css';

const fechaDe = (m) => m?.created_at || m?.createdAt;

function EstadoMov({ m }) {
  const e = estadoMovimiento(m);
  return <Estado tono={e.tono} texto={e.texto} />;
}

function DetalleMovimiento({ h }) {
  const m = h.selectedMovimiento;
  const abierto = Boolean(h.showModal && m);
  return (
    <Cajon abierto={abierto} alCerrar={h.handleCloseModal} ancho="ancho" etiqueta={m ? `Movimiento ${m.ticket_id}` : 'Movimiento'}>
      {m && (
        <>
          <CajonCabecera titulo={m.ticket_id} dato={m.proyecto || tipoMovimiento(m)} estado={<EstadoMov m={m} />} alCerrar={h.handleCloseModal} />
          <CajonDecision>
            <Boton nivel="principal" icono={Download} alHacer={() => h.descargarPDF(m)}>Descargar PDF</Boton>
          </CajonDecision>
          <CajonCuerpo>
            <SeccionCajon titulo="Datos">
              <Datos columnas={2} datos={[
                ['Tipo', tipoMovimiento(m)],
                ['Pidió', m.usuario?.nombre || 'N/A'],
                ['Fecha', <span key="f" title={fechaExacta(fechaDe(m))}>{fechaExacta(fechaDe(m)) || '—'}</span>],
                m.tipo_pedido ? ['Tipo de pedido', <span key="tp" className="r2-tk-capital">{m.tipo_pedido}</span>] : null,
                m.equipo ? ['Equipo', m.equipo.nombre] : null,
                m.aprobadoPor ? ['Aprobado o rechazado por', m.aprobadoPor.nombre] : null,
                m.fecha_aprobacion ? ['Fecha de aprobación', fechaExacta(m.fecha_aprobacion)] : null,
                m.observaciones ? { etiqueta: 'Observaciones', valor: <span className="r2-tk-texto-libre">{m.observaciones}</span>, ancho: 'doble' } : null,
              ]} />
              {m.motivo_rechazo && (
                <div className="r2-tk-nota-mal" role="note">
                  <Estado tono="mal" texto="Motivo de rechazo" />
                  <p>{m.motivo_rechazo}</p>
                </div>
              )}
            </SeccionCajon>
            <SeccionCajon titulo={`Artículos · ${numero(m.detalles?.length || 0)}`}>
              <Tabla etiqueta="Artículos del movimiento" densidad="compacta" fija={false} clave={(d, i) => d.id ?? i}
                filas={m.detalles || []}
                columnas={[
                  { id: 'articulo', titulo: 'Artículo', celda: (d) => <span className="r2-tk-celda-fuerte">{d.articulo?.nombre || `Artículo ID: ${d.articulo_id}`}</span> },
                  { id: 'cantidad', titulo: 'Cantidad', alinear: 'der', ancho: 120, celda: (d) => cantidad(d.cantidad, d.articulo?.unidad || 'uds') },
                  { id: 'obs', titulo: 'Observaciones', celda: (d) => d.observaciones || <span className="r2-tk-tenue">—</span>, ocultarEn: 'celular-ancho' },
                ]}
                filaCelular={(d) => ({
                  principal: d.articulo?.nombre || `Artículo ID: ${d.articulo_id}`,
                  secundario: d.observaciones || null,
                  derecha: cantidad(d.cantidad, d.articulo?.unidad || 'uds'),
                })}
                vacio={{ titulo: 'Este movimiento no tiene artículos' }} />
            </SeccionCajon>
          </CajonCuerpo>
        </>
      )}
    </Cajon>
  );
}

export default function VistaHistorial({ h }) {
  const celular = useEsCelular();
  const grupos = agruparPorDia(h.filteredMovimientos, fechaDe);
  const total = h.movimientos.length;
  const visibles = h.filteredMovimientos.length;
  const abiertoId = h.showModal ? h.selectedMovimiento?.id : null;
  const error = h.errorCarga && !total ? {
    mensaje: 'No se pudo cargar el historial.', motivo: h.errorCarga?.message, alReintentar: h.fetchHistorial,
  } : null;

  // Celular: tres líneas a todo lo ancho (obra · folio y cuándo · estado). Con el estado a la derecha, «Pendiente de
  // aprobación» se partía en dos y cortaba la fecha.
  const filaCelular = (m) => ({
    principal: m.proyecto || tipoMovimiento(m),
    secundario: (
      <span className="r2-tk-fila-sec">
        <span className="r2-tk-fila-sec-linea"><span className="r2-tk-folio">{m.ticket_id}</span> · <Fecha valor={fechaDe(m)} /></span>
        <EstadoMov m={m} />
      </span>
    ),
  });

  return (
    <Pagina titulo="Historial" densidad="compacta">
      <EncabezadoPagina pestanas="seccion" titulo="Historial" />

      <BarraFiltros
        busqueda={{ valor: h.searchTerm, alCambiar: h.setSearchTerm, texto: 'Buscar folio, persona u obra…', etiqueta: 'Buscar por folio, persona u obra', autoFoco: true }}
        resultados={visibles}
        activos={h.searchTerm ? 1 : 0} alQuitar={() => h.setSearchTerm('')}
        vista={h.loading ? null : (
          <span className="r2-tk-conteo" role="status">
            {h.searchTerm ? `${numero(visibles)} de ${numero(total)} movimientos` : `${numero(total)} movimientos`}
          </span>
        )}
        filtros={[
          <label key="fecha" className="r2-tk-filtro-fecha">
            <span className="r2-tk-filtro-fecha-etiqueta">Fecha</span>
            <input type="date" className="r2-tk-filtro-fecha-campo" aria-label="Fecha" />
          </label>,
        ]} />

      <Tabla etiqueta="Movimientos" clave="id" densidad="compacta"
        columnas={[
          { id: 'folio', titulo: 'Folio', ancho: 150, celda: (m) => <span className="r2-tk-folio">{m.ticket_id}</span> },
          { id: 'obra', titulo: 'Obra', celda: (m) => m.proyecto || <span className="r2-tk-tenue">—</span> },
          { id: 'pidio', titulo: 'Pidió', ancho: 180, celda: (m) => m.usuario?.nombre || 'N/A', ocultarEn: 'tableta' },
          { id: 'cuando', titulo: 'Cuándo', ancho: 120, celda: (m) => <Fecha valor={fechaDe(m)} /> },
          { id: 'tipo', titulo: 'Tipo', ancho: 150, celda: (m) => tipoMovimiento(m), ocultarEn: 'celular-ancho' },
          { id: 'estado', titulo: 'Estado', ancho: 210, celda: (m) => <EstadoMov m={m} /> },
        ]}
        grupos={grupos} alAbrir={h.handleVerDetalles} seleccionada={abiertoId}
        etiquetaAbrir={(m) => `Ver el detalle de ${m.ticket_id}`}
        accion={celular ? undefined : (m) => (
          <Boton nivel="fantasma" tamano="chico" icono={Download} alHacer={() => h.descargarPDF(m)} title="Descargar PDF"
            aria-label={`Descargar PDF de ${m.ticket_id}`} className="r2-tk-pdf">
            PDF
          </Boton>
        )}
        filaCelular={filaCelular} className="r2-tk-tabla-lineas"
        cargando={h.loading} error={error}
        vacio={h.searchTerm
          ? { sinResultados: true, busqueda: h.searchTerm, alQuitar: () => h.setSearchTerm('') }
          : { icono: History, titulo: 'Todavía no hay movimientos', texto: 'Los tickets y movimientos de material aparecerán aquí.' }} />

      <DetalleMovimiento h={h} />
    </Pagina>
  );
}
