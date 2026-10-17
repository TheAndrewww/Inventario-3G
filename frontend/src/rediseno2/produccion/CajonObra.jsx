// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): las ramas con g3Activo() en false
// (window.prompt / window.confirm de Pausar y Regresar) ya nunca corren. Ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
// Rediseño 2 · Producción · cajón de una obra (se abre al tocar el renglón del tablero).
// Arriba la decisión (completar la etapa que sigue, pausar o reanudar, ver la carpeta; «Regresar» en «Más acciones»);
// abajo el paso a paso con los MISMOS interruptores de hoy (un toque, mismo onToggleEtapa), las fechas y los datos.
// Los manejadores son los de la página (los del pie de la tarjeta de hoy, TimelineFooter): mismas preguntas, mismas
// peticiones. No pide nada al abrirse; la carpeta se abre con su botón (como hoy, al tocar el nombre).
import { useState } from 'react';
import { CheckCircle2, CalendarClock, ChevronLeft, FolderOpen, Pause, Play } from 'lucide-react';
import {
  Cajon, CajonCabecera, CajonDecision, CajonCuerpo, SeccionCajon, Datos, Estado, Boton, MenuAcciones, Interruptor, Fecha,
  confirmarG3, pedirTextoG3, g3Activo, plural, fechaCita, tipoTrabajo, estadoDe,
} from '../fundacion';
import {
  atrasoDe, etapaDe, pasosDe, citaDe, fechaMaximaDe, etapasMarcables, textoDias, usaTimelineSimplificado, calcularPorcentaje,
  formatDateShort,
} from './obras';
import { FechaMaxima, TextoTono } from './PiezasObra';

const VERBO = {
  diseno: 'Completar diseño',
  compras: 'Completar compras',
  manufactura: 'Completar manufactura',
  herreria: 'Completar herrería',
  instalacion: 'Marcar lista para instalar',
};

function DetallePaso({ paso, proyecto }) {
  if (paso.clave === 'completado') {
    return <span className="r2-prod-paso-detalle">{paso.estado === 'hecha' ? 'Obra cerrada' : 'Se cierra desde el Índice de producción'}</span>;
  }
  if (paso.estado === 'noaplica') {
    return <span className="r2-prod-paso-detalle">{paso.clave === 'manufactura' ? 'No lleva manufactura' : paso.clave === 'herreria' ? 'No lleva herrería' : 'No aplica'}</span>;
  }
  if (paso.simple) return <span className="r2-prod-paso-detalle">Mantenimiento y garantía van directo a instalación</span>;
  const herreria = paso.clave === 'herreria' && !paso.hecho && proyecto.tiene_herreria
    && (proyecto.herreria_armado_completado || proyecto.herreria_pintado_completado)
    ? ` · soldadura ${proyecto.herreria_armado_completado ? 'hecha' : 'pendiente'}, pintura ${proyecto.herreria_pintado_completado ? 'hecha' : 'pendiente'}`
    : '';
  if (paso.estado === 'hecha') {
    return (
      <span className="r2-prod-paso-detalle">
        {paso.clave === 'instalacion' ? 'Marcada' : 'Terminada'}{paso.hechoEn ? <> <Fecha valor={paso.hechoEn} /></> : null}
      </span>
    );
  }
  const fecha = paso.fechaLimite ? formatDateShort(paso.fechaLimite) : null;
  if (paso.activo) {
    const d = textoDias(paso.dias);
    return (
      <span className="r2-prod-paso-detalle">
        {fecha ? `Vence ${fecha}` : 'En curso'}
        {d.texto && <> · <TextoTono tono={d.tono}>{d.texto}</TextoTono></>}
        {herreria}
      </span>
    );
  }
  return <span className="r2-prod-paso-detalle">{fecha ? `Vence ${fecha}` : 'Por hacer'}{herreria}</span>;
}

export function CajonObra({
  proyecto, abierto, alCerrar, onToggleEtapa, onRegresar, onTogglePausa, etapasPermitidas = null, alAbrirCarpeta,
}) {
  const [marcando, setMarcando] = useState(false);
  const [regresando, setRegresando] = useState(false);
  const [pausando, setPausando] = useState(false);
  if (!proyecto) return null;
  const p = proyecto;
  const isPaused = Boolean(p.pausado);
  const simple = usaTimelineSimplificado(p);
  const atraso = atrasoDe(p);
  const etapa = etapaDe(p);
  const pasos = pasosDe(p);
  const cita = citaDe(p);
  const maxima = fechaMaximaDe(p);
  const tipo = tipoTrabajo(p.tipo_proyecto);

  // Pie de la tarjeta de hoy: qué se puede marcar y quién
  const marcables = etapasMarcables(p, etapasPermitidas);
  const conInterruptores = !isPaused && !simple && Boolean(onToggleEtapa) && p.etapa_actual !== 'completado';
  const puedeRegresar = Boolean(onRegresar) && !isPaused && !['pendiente', 'diseno'].includes(p.etapa_actual);
  const siguiente = conInterruptores ? marcables.find((e) => !e.done) : null;

  // Mismos pasos que TimelineFooter: un toque marca o desmarca (sin pregunta), con el mismo candado mientras responde
  const alternar = async (key, done) => {
    if (marcando) return;
    setMarcando(true);
    try {
      await onToggleEtapa(p.id, key, !done);
    } finally {
      setMarcando(false);
    }
  };
  const pausar = async () => {
    if (pausando || !onTogglePausa) return;
    let motivo = '';
    if (!isPaused) {
      motivo = g3Activo()
        ? await pedirTextoG3({
          titulo: `Pausar «${p.nombre}»`,
          etiqueta: '¿Cuál es el motivo de la pausa? (opcional)',
          confirmar: 'Pausar proyecto', cancelar: 'No pausar',
        })
        : window.prompt('¿Cuál es el motivo de la pausa? (opcional)');
      if (motivo === null) return;
    }
    setPausando(true);
    try {
      await onTogglePausa(p.id, motivo);
    } finally {
      setPausando(false);
    }
  };
  const regresar = async () => {
    if (regresando || !onRegresar) return;
    const confirmado = g3Activo()
      ? await confirmarG3({
        titulo: `¿Regresar «${p.nombre}» a la etapa anterior?`,
        datos: [['Etapa actual', estadoDe('etapa', p.etapa_actual).texto]],
        confirmar: 'Regresar etapa', cancelar: 'No regresar',
      })
      : window.confirm(`¿Regresar "${p.nombre}" a la etapa anterior?`);
    if (!confirmado) return;
    setRegresando(true);
    try {
      await onRegresar(p.id);
    } finally {
      setRegresando(false);
    }
  };

  const hayDecision = siguiente || onTogglePausa || alAbrirCarpeta || puedeRegresar;
  const datoCabecera = [p.cliente, tipo?.texto, p.obra_id ? `ID 3G ${p.obra_id}` : null].filter(Boolean).join(' · ');
  const marcable = (clave) => (conInterruptores ? marcables.find((e) => e.key === clave) : null);
  const subPasos = pasos.filter((x) => x.clave === 'manufactura' || x.clave === 'herreria');
  const conProduccion = subPasos.some((x) => x.estado !== 'noaplica');

  const filaPaso = (paso, { sub = false } = {}) => {
    const m = marcable(paso.clave);
    return (
      <li key={paso.clave} className={`r2-prod-paso r2-prod-paso--${paso.estado}${sub ? ' r2-prod-paso--sub' : ''}`}>
        <span className="r2-prod-paso-marca" aria-hidden="true">
          {paso.estado === 'hecha' ? <CheckCircle2 size={20} /> : <span className="r2-prod-paso-punto" />}
        </span>
        <span className="r2-prod-paso-textos">
          <span className="r2-prod-paso-nombre">{paso.nombre}</span>
          <DetallePaso paso={paso} proyecto={p} />
        </span>
        {m && (
          <Interruptor activo={m.done} deshabilitado={marcando} texto={paso.clave === 'instalacion' ? 'Lista' : 'Terminada'}
            alCambiar={() => alternar(m.key, m.done)} className="r2-prod-paso-interruptor" />
        )}
      </li>
    );
  };

  return (
    <Cajon abierto={abierto} alCerrar={alCerrar} ancho="ancho" etiqueta={`Obra ${p.nombre}`}>
      <CajonCabecera titulo={p.nombre} dato={datoCabecera || null} alCerrar={alCerrar}
        estado={(
          <span className="r2-prod-cabecera-estados">
            <Estado tono={isPaused ? 'neutro' : etapa.tono} texto={isPaused ? 'Pausada' : etapa.texto} />
            {atraso.enRetraso && <TextoTono tono="mal">{plural(atraso.dias, 'día', 'días')} de atraso</TextoTono>}
            {!atraso.enRetraso && atraso.esUrgente && <TextoTono tono="aviso">Urgente</TextoTono>}
          </span>
        )} />
      {hayDecision && (
        <CajonDecision nota={!onToggleEtapa ? null : etapasPermitidas ? 'Desde almacén solo se marcan manufactura y herrería.' : null}>
          {siguiente && (
            <Boton nivel="principal" icono={CheckCircle2} cargando={marcando} alHacer={() => alternar(siguiente.key, siguiente.done)} className="r2-prod-decision-principal">
              {VERBO[siguiente.key]}
            </Boton>
          )}
          {onTogglePausa && (
            <Boton nivel={isPaused ? 'principal' : 'contorno'} icono={isPaused ? Play : Pause} cargando={pausando} alHacer={pausar}
              className={isPaused ? 'r2-prod-decision-principal' : undefined}>
              {isPaused ? 'Reanudar obra' : 'Pausar obra'}
            </Boton>
          )}
          {alAbrirCarpeta && (
            <Boton nivel="fantasma" icono={FolderOpen} alHacer={() => alAbrirCarpeta(p)} aria-label="Ver carpeta de la obra">
              Ver carpeta<span className="r2-prod-solo-ancho"> de la obra</span>
            </Boton>
          )}
          {puedeRegresar && (
            <MenuAcciones titulo={p.nombre} acciones={[
              { texto: regresando ? 'Regresando…' : 'Regresar a la etapa anterior', icono: ChevronLeft, alHacer: regresar, deshabilitado: regresando },
            ]} />
          )}
        </CajonDecision>
      )}
      <CajonCuerpo>
        {(isPaused || p.pronostico_whatsapp?.texto || (p.estadoSubEtapas?.ambosCompletados && p.etapa_actual === 'produccion' && !isPaused)) && (
          <SeccionCajon className="r2-prod-avisos-obra">
            {isPaused && (
              <Estado tono="neutro" texto="Obra pausada"
                detalle={<>{p.pausado_motivo ? `Motivo: ${p.pausado_motivo}` : 'Sin motivo anotado'}{p.pausado_en && <> · desde <Fecha valor={p.pausado_en} /></>}</>} />
            )}
            {p.pronostico_whatsapp?.texto && (
              <p className={`r2-prod-pronostico r2-tono--${p.pronostico_whatsapp.respuesta === 'si' ? 'ok' : 'aviso'}`}>
                {p.pronostico_whatsapp.respuesta === 'si' ? <CheckCircle2 size={18} aria-hidden="true" /> : <CalendarClock size={18} aria-hidden="true" />}
                <span>{p.pronostico_whatsapp.texto}</span>
              </p>
            )}
            {!isPaused && p.estadoSubEtapas?.ambosCompletados && p.etapa_actual === 'produccion' && (
              <Estado tono="ok" texto="Producción terminada" detalle="Ya se puede marcar como lista para instalar." />
            )}
          </SeccionCajon>
        )}
        <SeccionCajon titulo="Etapas">
          <ol className="r2-prod-pasos">
            {pasos.filter((x) => x.clave === 'diseno' || x.clave === 'compras').map((x) => filaPaso(x))}
            {conProduccion && (
              <li className="r2-prod-paso-grupo" aria-hidden="true">Producción · manufactura y herrería van en paralelo</li>
            )}
            {conProduccion && subPasos.map((x) => filaPaso(x, { sub: true }))}
            {pasos.filter((x) => x.clave === 'instalacion' || x.clave === 'completado').map((x) => filaPaso(x))}
          </ol>
          {conInterruptores && (
            <p className="r2-nota">Cada interruptor marca o desmarca la etapa al momento; al marcar se avisa al grupo de Producción.</p>
          )}
        </SeccionCajon>
        <SeccionCajon titulo="Fechas">
          <Datos columnas={2} datos={[
            ['Cita agendada', cita ? <span title={cita}>{fechaCita(cita)}</span> : 'Sin cita en el calendario'],
            ['Fecha máxima', maxima ? <FechaMaxima info={maxima} enLinea /> : 'Sin fecha'],
            ['Atraso', atraso.enRetraso ? <TextoTono tono="mal">{plural(atraso.dias, 'día', 'días')}</TextoTono> : 'Sin atraso'],
            ['Avance', `${calcularPorcentaje(p)} %`],
          ]} />
        </SeccionCajon>
        <SeccionCajon titulo="Datos de la obra">
          <Datos columnas={2} datos={[
            ['Cliente', p.cliente],
            ['Tipo', tipo?.texto],
            p.obra_id ? ['ID 3G', <span key="id" className="r2-prod-mono">{p.obra_id}</span>] : null,
            p.es_extensivo ? ['Extensivo', 'Sí'] : null,
            { etiqueta: 'Notas', valor: p.descripcion, ancho: 'doble' },
          ]} />
        </SeccionCajon>
        {!conInterruptores && !simple && p.etapa_actual !== 'completado' && onToggleEtapa && isPaused && (
          <p className="r2-nota">Mientras la obra está pausada no se marcan etapas. Reanúdala para seguir.</p>
        )}
      </CajonCuerpo>
    </Cajon>
  );
}
