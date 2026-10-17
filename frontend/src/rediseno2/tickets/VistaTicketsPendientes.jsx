// Rediseño 2 · Tickets pendientes (/pedidos-pendientes), vista encendida. La página guarda el estado, las peticiones y
// los manejadores; aquí solo se pinta.
//
// Plano (DISENO-v2 §5.2): pestañas de la sección + «Más acciones» de Dirección (reabrir y anular en masa) → «Por preparar ·
// Completados recientes» y el filtro «Por revisar · cierre de obra» → la lista de trabajo a todo lo ancho, agrupada (lo
// que hay que revisar primero), con «Preparar» por renglón → checklist en cajón (pantalla completa en celular).
import { useEffect, useState } from 'react';
import { Ban, ClipboardList, PackageCheck, RotateCcw, Trash2 } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, Tabla, Boton, Segmentado, ChipFiltro, Fecha, Estado, MenuAcciones,
  Cajon, CajonCabecera, CajonDecision, CajonCuerpo, useEsCelular, numero, plural, clases,
} from '../fundacion';
import { Progreso } from './comunes';
import { destinoDe, preparados } from './datos';
import ChecklistTicket from './ChecklistTicket';
import './tickets.css';

function AnulacionMasiva({ t }) {
  const a = t.anulacionMasiva;
  const reabrir = Boolean(a?.reabrir);
  const total = a?.total || 0;
  const tickets = a?.tickets || [];
  return (
    <Cajon abierto={Boolean(a)} alCerrar={t.cerrarAnulacion} ancho="ancho"
      etiqueta={reabrir ? 'Reabrir tickets anulados' : 'Anular tickets anteriores'}>
      {a && (
        <>
          <CajonCabecera titulo={reabrir ? 'Reabrir tickets anulados' : 'Anular tickets anteriores'}
            dato={plural(total, 'ticket', 'tickets')} alCerrar={t.cerrarAnulacion} />
          <CajonDecision nota={reabrir
            ? 'Vuelven a Tickets pendientes con lo que ya tenían surtido. El inventario no se mueve.'
            : 'No se puede deshacer. El inventario no se mueve.'}>
            <Boton nivel="contorno" alHacer={t.cerrarAnulacion} deshabilitado={t.anulandoTodo}>{reabrir ? 'No reabrir' : 'No anular'}</Boton>
            <Boton nivel={reabrir ? 'principal' : 'peligro-lleno'} icono={reabrir ? RotateCcw : Ban} cargando={t.anulandoTodo}
              alHacer={t.confirmarAnulacionMasiva}>
              {t.anulandoTodo ? 'Procesando…' : `${reabrir ? 'Reabrir' : 'Anular'} ${plural(total, 'ticket', 'tickets')}`}
            </Boton>
          </CajonDecision>
          <CajonCuerpo>
            <section className="r2-seccion-cajon">
              <h3 className="r2-seccion-cajon-titulo">Qué va a pasar</h3>
              {reabrir ? (
                <p className="r2-tk-texto">
                  Se reabrirán <strong>{plural(total, 'ticket', 'tickets')}</strong> de proyectos que siguen abiertos. Vuelven a
                  Pendientes con lo que ya tenían surtido; el inventario no se mueve.
                  {a.solicitudes_a_reabrir > 0 && <> También vuelven <strong>{plural(a.solicitudes_a_reabrir, 'solicitud', 'solicitudes')} de compra</strong>.</>}
                  {' '}Los de proyectos cerrados se quedan anulados.
                </p>
              ) : (
                <p className="r2-tk-texto">
                  Se anularán <strong>{plural(total, 'ticket abierto', 'tickets abiertos')}</strong>. <strong>El inventario no se mueve</strong>:
                  la existencia de cada artículo se queda como está.
                  {a.solicitudes_a_cancelar > 0 && <> También se cancelan <strong>{plural(a.solicitudes_a_cancelar, 'solicitud', 'solicitudes')} de compra</strong> de estos tickets que aún no entraban a una orden.</>}
                  {' '}No se puede deshacer.
                </p>
              )}
            </section>
            <section className="r2-seccion-cajon">
              <h3 className="r2-seccion-cajon-titulo">{reabrir ? 'Tickets que se reabren' : 'Tickets que se anulan'}</h3>
              <Tabla etiqueta="Tickets" densidad="compacta" clave="id" fija={false} filas={tickets} className="r2-tk-tabla-lineas"
                columnas={[
                  {
                    id: 'obra', titulo: 'Obra',
                    celda: (x) => (
                      <span className="r2-tk-obra">
                        <span className="r2-tk-celda-fuerte">{x.proyecto}</span>
                        {x.creado_por && <span className="r2-tk-obra-nota">Pidió {x.creado_por}</span>}
                      </span>
                    ),
                  },
                  { id: 'folio', titulo: 'Folio', celda: (x) => <span className="r2-tk-folio">{x.ticket_id}</span> },
                  { id: 'fecha', titulo: 'Fecha', celda: (x) => <Fecha valor={x.fecha_hora} /> },
                  { id: 'estado', titulo: 'Estado', celda: (x) => <Estado dominio="ticket" valor={x.estado} /> },
                ]}
                filaCelular={(x) => ({
                  principal: x.proyecto,
                  secundario: <>{x.ticket_id}{x.creado_por ? ` · ${x.creado_por}` : ''} · <Fecha valor={x.fecha_hora} /></>,
                  debajo: <Estado dominio="ticket" valor={x.estado} />,
                })} />
            </section>
          </CajonCuerpo>
        </>
      )}
    </Cajon>
  );
}

export default function VistaTicketsPendientes({ t }) {
  const celular = useEsCelular();
  const [vista, setVista] = useState('preparar');
  const [abriendo, setAbriendo] = useState(null);
  useEffect(() => { if (!t.loading) setAbriendo(null); }, [t.loading]);

  const abrir = (p) => {
    setAbriendo(p.id);
    t.handleVerDetalle(p);
  };
  const cargandoInicial = !t.listasCargadas;
  const lista = t.pedidosALaVista;
  const revisar = lista.filter((p) => p.revision_requerida);
  const resto = lista.filter((p) => !p.revision_requerida);
  const abiertoId = t.showModal ? t.pedidoSeleccionado?.id : null;

  const masAcciones = t.esAdmin ? [
    { texto: 'Reabrir tickets anulados', icono: RotateCcw, alHacer: () => t.abrirAnulacionMasiva(true), deshabilitado: t.anulandoTodo, motivo: 'Cargando…' },
    { texto: 'Anular tickets anteriores', icono: Ban, peligro: true, alHacer: () => t.abrirAnulacionMasiva(false), deshabilitado: t.anulandoTodo, motivo: 'Cargando…' },
  ] : [];

  const notaDe = (p) => {
    if (p.revision_requerida && p.revision_motivo) return `${p.revision_motivo}. Decide si se completa o se elimina.`;
    const obs = t.obsOriginales(p.observaciones);
    return obs ? `Observaciones: ${obs}` : null;
  };

  const columnasPendientes = [
    {
      id: 'obra', titulo: 'Obra',
      celda: (p) => (
        <span className="r2-tk-obra">
          <span className="r2-tk-obra-nombre">{destinoDe(p)}</span>
          {notaDe(p) && <span className={p.revision_requerida ? 'r2-tk-obra-nota r2-tk-obra-nota--aviso' : 'r2-tk-obra-nota'}>{notaDe(p)}</span>}
        </span>
      ),
    },
    { id: 'folio', titulo: 'Folio', ancho: 150, celda: (p) => <span className="r2-tk-folio">{p.ticket_id}</span> },
    { id: 'pidio', titulo: 'Pidió', ancho: 180, celda: (p) => p.usuario?.nombre || 'N/A', ocultarEn: 'tableta' },
    { id: 'cuando', titulo: 'Pedido', ancho: 130, celda: (p) => <Fecha valor={p.fecha_hora} /> },
    {
      id: 'prep', titulo: 'Preparados', ancho: 140,
      celda: (p) => { const c = preparados(p); return <Progreso hechos={c.hechos} total={c.total} porcentaje={p.progreso_dispersion} />; },
    },
  ];

  const accionPreparar = (p) => (
    <Boton nivel="tonal" tamano="chico" cargando={abriendo === p.id && t.loading} alHacer={() => abrir(p)}
      aria-label={`Preparar el ticket ${p.ticket_id} de ${destinoDe(p)}`}>
      Preparar
    </Boton>
  );
  const accionesTicket = t.esAdmin ? (p) => [{
    texto: t.eliminandoId === p.id ? 'Eliminando…' : 'Eliminar ticket', icono: Trash2, peligro: true,
    deshabilitado: t.eliminandoId === p.id, alHacer: () => t.handleEliminarTicket(p),
  }] : undefined;

  // Celular: la fecha va primero para que nunca se corte (el folio cede si falta lugar) y debajo el motivo de revisión o las
  // observaciones, que son lo que ayuda a decidir qué preparar primero («Urgente: la cuadrilla espera en obra»).
  const filaCelularPendiente = (p) => {
    const c = preparados(p);
    const nota = notaDe(p);
    return {
      principal: destinoDe(p),
      secundario: (
        <span className="r2-tk-fila-sec">
          <span className="r2-tk-fila-sec-linea"><Fecha valor={p.fecha_hora} /> · <span className="r2-tk-folio">{p.ticket_id}</span></span>
          {nota && <span className={clases('r2-tk-fila-sec-nota', p.revision_requerida && 'r2-tk-fila-sec-nota--aviso')}>{nota}</span>}
        </span>
      ),
      derecha: <Progreso hechos={c.hechos} total={c.total} porcentaje={p.progreso_dispersion} className="r2-tk-progreso--chico" />,
    };
  };

  const errorPendientes = t.errorPendientes && !t.pedidos.length ? {
    mensaje: 'No se pudo cargar la lista de tickets pendientes.',
    motivo: t.errorPendientes?.response?.data?.message || t.errorPendientes?.message, alReintentar: t.cargarDatos,
  } : null;
  const errorCompletados = t.errorCompletados && !t.pedidosCompletados.length ? {
    mensaje: 'No se pudo cargar la lista de tickets completados.',
    motivo: t.errorCompletados?.response?.data?.message || t.errorCompletados?.message, alReintentar: t.cargarDatos,
  } : null;

  return (
    <Pagina titulo="Tickets pendientes" densidad="comoda">
      <EncabezadoPagina pestanas="seccion" titulo="Tickets pendientes" masAcciones={celular ? [] : masAcciones} />

      <div className="r2-tk-vistas" role="group" aria-label="Qué tickets ver">
        <Segmentado etiqueta="Tickets" valor={vista} alCambiar={setVista} anchoCompleto={celular}
          opciones={[
            { valor: 'preparar', texto: 'Por preparar', cuenta: cargandoInicial ? undefined : t.pedidos.length, icono: ClipboardList },
            { valor: 'completados', texto: celular ? 'Completados' : 'Completados recientes', cuenta: cargandoInicial ? undefined : t.pedidosCompletados.length, icono: PackageCheck },
          ]} />
        {vista === 'preparar' && t.porRevisar.length > 0 && (
          <ChipFiltro texto="Por revisar · cierre de obra" cuenta={t.porRevisar.length} activo={t.soloPorRevisar}
            alCambiar={(v) => t.setSoloPorRevisar(v)} />
        )}
        {celular && masAcciones.length > 0 && <MenuAcciones titulo="Tickets pendientes" acciones={masAcciones} className="r2-tk-vistas-mas" />}
      </div>

      {vista === 'preparar' ? (
        <Tabla etiqueta="Tickets por preparar" clave="id" densidad="comoda" columnas={columnasPendientes} className="r2-tk-tabla-lineas"
          grupos={[
            { id: 'revisar', titulo: 'Por revisar · cierre de obra', filas: revisar, nota: 'La obra se cerró con estos tickets abiertos' },
            { id: 'preparar', titulo: 'Por preparar', filas: resto },
          ]}
          alAbrir={abrir} etiquetaAbrir={(p) => `Abrir el checklist de ${destinoDe(p)}, ticket ${p.ticket_id}`}
          seleccionada={abiertoId} accion={accionPreparar} masAcciones={accionesTicket} filaCelular={filaCelularPendiente}
          cargando={cargandoInicial} error={errorPendientes}
          vacio={{ icono: ClipboardList, titulo: 'No hay tickets por preparar', texto: 'Cuando diseño finalice una orden de salida aparecerá aquí.' }} />
      ) : (
        <Tabla etiqueta="Tickets completados recientes" clave="id" densidad="compacta"
          columnas={[
            { id: 'obra', titulo: 'Obra', celda: (p) => <span className="r2-tk-obra-nombre">{destinoDe(p)}</span> },
            { id: 'folio', titulo: 'Folio', ancho: 150, celda: (p) => <span className="r2-tk-folio">{p.ticket_id}</span> },
            { id: 'encargado', titulo: 'Encargado', celda: (p) => p.supervisor?.nombre || p.usuario?.nombre || 'N/A', ocultarEn: 'tableta' },
            { id: 'preparo', titulo: 'Preparó', celda: (p) => p.detalles?.[0]?.dispersadoPor?.nombre || 'N/A', ocultarEn: 'celular-ancho' },
            { id: 'cuando', titulo: 'Completado', ancho: 130, celda: (p) => <Fecha valor={p.updated_at || p.fecha_hora} /> },
            { id: 'articulos', titulo: 'Artículos', alinear: 'der', ancho: 110, celda: (p) => numero(p.detalles?.length || 0) },
          ]}
          filas={t.pedidosCompletados} alAbrir={abrir} seleccionada={abiertoId}
          etiquetaAbrir={(p) => `Ver el ticket ${p.ticket_id} de ${destinoDe(p)}`}
          filaCelular={(p) => ({
            principal: destinoDe(p),
            secundario: <>{p.ticket_id} · <Fecha valor={p.updated_at || p.fecha_hora} /></>,
            derecha: plural(p.detalles?.length || 0, 'artículo', 'artículos'),
          })}
          cargando={cargandoInicial} error={errorCompletados}
          vacio={{ icono: PackageCheck, titulo: 'No hay tickets completados recientes', texto: 'Los últimos 20 tickets entregados aparecen aquí.' }} />
      )}

      <ChecklistTicket t={t} />
      <AnulacionMasiva t={t} />
    </Pagina>
  );
}
