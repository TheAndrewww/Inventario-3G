// Rediseño 2 · Producción · Avance por área (/avance-produccion), vista encendida.
// Antes: una tarjeta por obra con círculos de 44 px repartidos a lo ancho y etiquetas de 10 px (1.6:1 en oscuro).
// Ahora: una tabla obra × sub-etapa (Manufactura · Soldadura · Pintura) con la columna de cada etapa siempre en el mismo
// lugar; en cada celda «Marcar» (abre la MISMA confirmación «¿Marcar como completado?»), «Hecha» o «—» si no aplica.
// Datos, sondeo de 30 s, búsqueda y manejadores son los de la página.
import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, BarraFiltros, ChipFiltro, Tabla, Estado, Boton, Dialogo, Vacio, ErrorCarga, Cargando,
  plural, fechaExacta, tipoTrabajo, useEsCelular, clases, estadoDe,
} from '../fundacion';
import { agrupar } from './obras';
import { TextoTono } from './PiezasObra';
import './produccion.css';

const GRUPOS = [
  { id: 'atrasadas', titulo: 'Atrasadas' },
  { id: 'semana', titulo: 'Vencen esta semana', nota: 'en 6 días hábiles o menos' },
  { id: 'tiempo', titulo: 'En tiempo' },
];

// Plazo de entrega con los MISMOS umbrales de color de la tarjeta de hoy (rojo atrasada, ámbar en 3 días o menos)
function entregaDe(p) {
  const d = p.diasRestantes;
  if (d === null || d === undefined) return null;
  const tono = d < 0 ? 'mal' : d <= 3 ? 'aviso' : null;
  const texto = d < 0 ? `${plural(-d, 'día', 'días')} tarde` : d === 0 ? 'Vence hoy' : d === 1 ? 'Falta 1 día' : `Faltan ${d} días`;
  return { texto, tono };
}
const grupoDe = (p) => {
  const d = p.diasRestantes;
  if (d !== null && d !== undefined && d < 0) return 'atrasadas';
  if (d !== null && d !== undefined && d <= 6) return 'semana';
  return 'tiempo';
};

export default function VistaAvance({
  proyectosFiltrados, loading, refreshing, errorCarga, busqueda, setBusqueda, cargarProyectos,
  confirmModal, setConfirmModal, procesando, handleMarcarEtapa, handleConfirm,
  ETAPAS_FLOW, isEtapaCompletada, isEtapaActiva, isEtapaVisible, nombreEtapaG3, esProyectoMTO, esUrgenteMTO,
}) {
  const celular = useEsCelular();
  const [soloMfra, setSoloMfra] = useState(false);
  const [soloHerr, setSoloHerr] = useState(false);
  const nombre = (etapa) => nombreEtapaG3(true, etapa);

  // Pendiente en manufactura / en herrería: con las MISMAS reglas que la lista de hoy (filtran lo que ya está cargado)
  const pendMfra = (p) => p.tiene_manufactura && !p.manufactura_completado && !p.manufactura_completado_en;
  const pendHerr = (p) => p.tiene_herreria && !p.herreria_completado && !p.herreria_completado_en;
  const lista = useMemo(() => proyectosFiltrados.filter((p) => (!soloMfra || pendMfra(p)) && (!soloHerr || pendHerr(p))), [proyectosFiltrados, soloMfra, soloHerr]);
  const grupos = useMemo(() => agrupar(lista, grupoDe, GRUPOS), [lista]);
  const activos = (busqueda ? 1 : 0) + (soloMfra ? 1 : 0) + (soloHerr ? 1 : 0);
  const quitar = () => { setBusqueda(''); setSoloMfra(false); setSoloHerr(false); };

  const esUrgente = (p) => (esProyectoMTO(p) ? esUrgenteMTO(p) : (p.prioridad === 1 || (p.diasRestantes !== null && p.diasRestantes < 0)));

  const celda = (p, etapa) => {
    if (!isEtapaVisible(p, etapa.key)) {
      return <span className="r2-prod-sin-dato" title={etapa.key === 'manufactura' ? 'Esta obra no lleva manufactura' : 'Esta obra no lleva herrería'}>—</span>;
    }
    if (isEtapaCompletada(p, etapa.key)) return <Estado tono="ok" texto="Hecha" />;
    if (isEtapaActiva(p, etapa.key)) {
      return (
        <Boton nivel="tonal" tamano="chico" icono={CheckCircle2} alHacer={() => handleMarcarEtapa(p, etapa)}
          aria-label={`Marcar ${nombre(etapa).toLowerCase()} de ${p.nombre}`}>
          Marcar
        </Boton>
      );
    }
    return <span className="r2-prod-sin-dato">Todavía no</span>;
  };
  const sub = (p) => {
    const tipo = tipoTrabajo(p.tipo_proyecto);
    return (
      <span className="r2-prod-obra-sub">
        {[p.cliente, estadoDe('etapa', p.etapa_actual).texto, tipo?.texto].filter(Boolean).join(' · ')}
        {esUrgente(p) && !(p.diasRestantes !== null && p.diasRestantes < 0) && <> · <TextoTono tono="aviso" className="r2-prod-urgente">Urgente</TextoTono></>}
      </span>
    );
  };
  const entrega = (p) => {
    const e = entregaDe(p);
    if (!e) return <span className="r2-prod-sin-dato">Sin fecha</span>;
    return (
      <span className={clases('r2-plazo', e.tono && `r2-tono--${e.tono}`)} title={p.fecha_limite ? fechaExacta(p.fecha_limite) : undefined}>
        {e.tono && <span className="r2-estado-punto" aria-hidden="true" />}{e.texto}
      </span>
    );
  };

  const columnas = [
    { id: 'obra', titulo: 'Obra', celda: (p) => <span className="r2-prod-obra"><span className="r2-prod-obra-nombre">{p.nombre}</span>{sub(p)}</span> },
    { id: 'entrega', titulo: 'Entrega', ancho: 150, celda: entrega },
    ...ETAPAS_FLOW.map((etapa) => ({ id: etapa.key, titulo: nombre(etapa), ancho: 150, sinBoton: true, celda: (p) => celda(p, etapa) })),
  ];

  const vacio = activos
    ? { sinResultados: true, busqueda: busqueda || null, alQuitar: quitar }
    : { titulo: 'No hay obras con manufactura o herrería pendiente', texto: 'Cuando una obra llegue a producción con algo por hacer en el taller, aparecerá aquí para marcarla.' };

  const confirmar = confirmModal.open && confirmModal.etapa;
  const cancelar = () => setConfirmModal({ open: false, proyecto: null, etapa: null });

  return (
    <Pagina titulo="Avance por área" densidad="comoda" className="r2-prod-avance-pagina">
      <EncabezadoPagina titulo="Avance por área"
        dato={loading && !proyectosFiltrados.length ? 'Cargando obras…' : errorCarga && !proyectosFiltrados.length ? 'sin datos'
          : [plural(lista.length, 'obra', 'obras'), refreshing ? 'actualizando…' : null].filter(Boolean).join(' · ')}
        secundarias={[{ texto: 'Actualizar', icono: RefreshCw, cargando: refreshing, alHacer: () => cargarProyectos(false) }]} />
      <BarraFiltros busqueda={{ valor: busqueda, alCambiar: setBusqueda, texto: 'Buscar obra o cliente…' }}
        filtros={[
          <ChipFiltro key="mfra" texto="Pendiente en manufactura" activo={soloMfra} alCambiar={setSoloMfra} cuenta={proyectosFiltrados.filter(pendMfra).length} />,
          <ChipFiltro key="herr" texto="Pendiente en herrería" activo={soloHerr} alCambiar={setSoloHerr} cuenta={proyectosFiltrados.filter(pendHerr).length} />,
        ]}
        activos={activos} alQuitar={quitar} resultados={lista.length} />
      <p className="r2-nota r2-prod-ayuda">Marca la etapa que ya terminó en el taller. Al confirmar ya no se puede deshacer desde aquí.</p>

      {errorCarga && lista.length > 0 && (
        <ErrorCarga mensaje="No se pudo actualizar la lista." motivo={errorCarga} alReintentar={() => cargarProyectos(false)} reintentando={refreshing} />
      )}

      {celular ? (
        <ListaCelular grupos={grupos} loading={loading} errorCarga={errorCarga} vacio={vacio} cargarProyectos={cargarProyectos}
          ETAPAS_FLOW={ETAPAS_FLOW} nombre={nombre} celda={celda} sub={sub} entrega={entrega}
          isEtapaVisible={isEtapaVisible} isEtapaCompletada={isEtapaCompletada} isEtapaActiva={isEtapaActiva} handleMarcarEtapa={handleMarcarEtapa} />
      ) : (
        <Tabla etiqueta="Obras con trabajo de taller" columnas={columnas} grupos={grupos} cargando={loading}
          error={errorCarga ? { mensaje: 'No se pudo cargar la lista de obras.', motivo: errorCarga, alReintentar: () => cargarProyectos() } : null}
          vacio={vacio} />
      )}

      <Dialogo abierto={Boolean(confirmar)} alCerrar={cancelar} titulo="¿Marcar como completado?" tamano="sm"
        pie={(
          <>
            <Boton nivel="fantasma" alHacer={cancelar} deshabilitado={procesando}>Cancelar</Boton>
            <Boton nivel="principal" icono={CheckCircle2} cargando={procesando} alHacer={handleConfirm}>Completar etapa</Boton>
          </>
        )}>
        {confirmar && (
          <div className="r2-prod-confirmar">
            <p className="r2-prod-confirmar-que"><strong>{nombre(confirmModal.etapa)}</strong> — {confirmModal.proyecto?.nombre}</p>
            <p className="r2-prod-confirmar-aviso r2-tono--aviso"><AlertTriangle size={16} aria-hidden="true" />Esta acción no se puede deshacer</p>
          </div>
        )}
      </Dialogo>
    </Pagina>
  );
}

// Celular: renglón de dos líneas (obra y entrega) y debajo las etapas como botones de 44 px con su nombre
function ListaCelular({
  grupos, loading, errorCarga, vacio, cargarProyectos, ETAPAS_FLOW, nombre, sub, entrega,
  isEtapaVisible, isEtapaCompletada, isEtapaActiva, handleMarcarEtapa,
}) {
  const total = grupos.reduce((n, g) => n + g.filas.length, 0);
  if (errorCarga && !total) return <ErrorCarga mensaje="No se pudo cargar la lista de obras." motivo={errorCarga} alReintentar={() => cargarProyectos()} />;
  if (loading && !total) return <Cargando forma="lista" filas={6} etiqueta="Cargando obras…" />;
  if (!total) return <Vacio {...vacio} />;
  return (
    <div className="r2-prod-avance-celular">
      {grupos.filter((g) => g.filas.length).map((g) => (
        <section key={g.id} aria-label={g.titulo}>
          <h2 className="r2-prod-grupo-celular">{g.titulo}<span className="r2-grupo-cuenta">{g.filas.length}</span></h2>
          <ul className="r2-lista">
            {g.filas.map((p) => (
              <li key={p.id} className="r2-prod-avance-fila">
                <div className="r2-prod-avance-cab">
                  <span className="r2-prod-obra">
                    <span className="r2-prod-obra-nombre">{p.nombre}</span>
                    {sub(p)}
                  </span>
                  <span className="r2-prod-avance-entrega">{entrega(p)}</span>
                </div>
                <div className="r2-prod-avance-etapas">
                  {ETAPAS_FLOW.filter((e) => isEtapaVisible(p, e.key)).map((e) => {
                    const hecha = isEtapaCompletada(p, e.key);
                    const activa = !hecha && isEtapaActiva(p, e.key);
                    // Revisión: el botón dice qué hace («Marcar manufactura», como «Marcar» en escritorio) y la etapa que
                    // todavía no toca lo dice con palabras (antes solo su nombre en gris, que parecía un botón apagado)
                    return activa ? (
                      <Boton key={e.key} nivel="tonal" icono={CheckCircle2} alHacer={() => handleMarcarEtapa(p, e)}
                        aria-label={`Marcar ${nombre(e).toLowerCase()} de ${p.nombre}`} className="r2-prod-avance-boton">
                        Marcar {nombre(e).toLowerCase()}
                      </Boton>
                    ) : (
                      <span key={e.key} className={clases('r2-prod-avance-hecha', hecha && 'r2-tono--ok')}>
                        {hecha && <CheckCircle2 size={18} aria-hidden="true" />}{nombre(e)}{hecha ? ' hecha' : ' · todavía no'}
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
