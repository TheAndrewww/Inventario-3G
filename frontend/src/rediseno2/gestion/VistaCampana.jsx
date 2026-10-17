// Rediseño 2 · Gestión · Campaña de control (/control-campana), vista ENCENDIDA. Dirección califica cada semana a 13 áreas
// (bien o mal, con nota); compras, encargados y almacén solo leen.
// Antes: el trimestre actual aparecía debajo de los tres pasados, la semana de hoy era igual a las demás, las 169 celdas eran
// <td> sin teclado y calificar la semana costaba 39 clics. Ahora: el trimestre actual primero con la columna «Esta semana»
// resaltada; los pasados en un renglón de resumen que se abre; cada celda es un botón con nombre («Diseño, semana 41:
// bien»); y «Calificar semana 42» abre la lista de las 13 áreas: al guardar una se abre sola la siguiente sin calificar.
// Cada calificación usa el MISMO diálogo y la misma petición de ControlCampanaPage (handleCellClick → handleSave).
import { useEffect, useRef, useState } from 'react';
import { Check, X, Download, ClipboardCheck, ChevronDown, ChevronRight, Trash2, Eye } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, Segmentado, Boton, Dialogo, Cajon, CajonCabecera, CajonCuerpo, SeccionCajon, Estado, Area, Cargando, ErrorCarga,
  Nota, numero, clases, useEsCelular,
} from '../fundacion';
import { oracion, motivoError } from './comunes';
import './gestion.css';

const NOMBRE_TRIMESTRE = { 1: '1.er trimestre', 2: '2.º trimestre', 3: '3.er trimestre', 4: '4.º trimestre' };
// Color de identidad de cada área (el mismo tono de hoy, con los tokens del sistema) + su nombre en oración
const COLOR_AREA = {
  ventas_dlba: 'var(--g3-ok)', ventas_vrj: 'var(--g3-info)', diseno: 'var(--g3-tinta-3)', manufactura: 'var(--g3-tinta-3)', herreria: 'var(--g3-tinta-3)',
  equipo1: 'var(--g3-info)', equipo2: 'var(--g3-ok)', equipo3: 'var(--g3-tinta-2)', equipo4: 'var(--g3-aviso)', operacion: 'var(--g3-garantia)',
  logistica: 'var(--g3-mantenimiento)', almacen: 'var(--g3-aviso)', calidad: 'var(--g3-instalacion)',
};
const estadoCelda = (c) => (c?.status === 'good' ? ['Bien', 'ok'] : c?.status === 'bad' ? ['Mal', 'mal'] : ['Sin calificar', null]);

export default function VistaCampana(p) {
  const {
    esSoloLectura, data, loading, errorCarga, recargar, modalOpen, setModalOpen, selectedCell, modalData, setModalData, saving, ocultos,
    toggleTrimestre, soloActual, guardarOcultos, handleCellClick, handleSave, handleDelete, exportarComentarios, getCellKey,
    getQuarterTotal, getAreaSubtotal, getPct, formatCalif, QUARTERS, AREAS, semanaHoy, trimestreHoy,
  } = p;
  const celular = useEsCelular();
  const [verSemana, setVerSemana] = useState(false);
  const [siguiendo, setSiguiendo] = useState(false); // calificando la semana área por área desde el cajón
  const anterior = useRef({ modalOpen, saving });
  const nombreArea = (a) => oracion(a.name);

  // Al guardar (o borrar) una calificación desde «Calificar semana», se abre sola el área siguiente sin calificar
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = { modalOpen, saving };
    if (!siguiendo || !antes.modalOpen || modalOpen) return;
    if (!antes.saving) { setSiguiendo(false); return; } // cerró sin guardar
    const i = AREAS.findIndex((a) => a.id === selectedCell?.area?.id);
    const siguiente = AREAS.slice(i + 1).find((a) => !data[getCellKey(trimestreHoy, a.id, semanaHoy)]?.status);
    if (siguiente) handleCellClick(trimestreHoy, siguiente, semanaHoy);
    else setSiguiendo(false);
  }, [modalOpen, saving, siguiendo, AREAS, selectedCell, data, getCellKey, trimestreHoy, semanaHoy, handleCellClick]);

  const actual = QUARTERS.find((q) => q.id === trimestreHoy) || QUARTERS[QUARTERS.length - 1];
  const orden = [actual, ...QUARTERS.filter((q) => q.id !== actual.id)];
  const otros = QUARTERS.filter((q) => q.id !== actual.id).map((q) => q.id);
  const modo = ocultos.length === 0 ? 'todos' : (otros.every((id) => ocultos.includes(id)) && !ocultos.includes(actual.id) ? 'actual' : null);
  const calificadasHoy = AREAS.filter((a) => data[getCellKey(actual.id, a.id, semanaHoy)]?.status).length;

  const celda = (q, a, w) => {
    const c = data[getCellKey(q.id, a.id, w)];
    const [texto, tono] = estadoCelda(c);
    return (
      <button type="button" className={clases('r2g-celda-campana', tono && `r2g-celda-campana--${tono}`, !tono && !c?.note && w > semanaHoy && 'r2g-celda-campana--futura')}
        aria-label={`${nombreArea(a)}, semana ${w}: ${texto.toLowerCase()}${c?.note ? ', con nota' : ''}`} title={c?.note || undefined}
        onClick={() => handleCellClick(q.id, a, w)}>
        {c?.status === 'good' && <Check size={18} strokeWidth={2.75} aria-hidden="true" />}
        {c?.status === 'bad' && <X size={18} strokeWidth={2.75} aria-hidden="true" />}
        {c?.note && <span className="r2g-celda-nota" aria-hidden="true" />}
      </button>
    );
  };

  const calif = (good, bad) => { const pct = getPct(good, bad); return { pct, texto: formatCalif(pct) }; };
  const tonoCalif = (pct) => (pct === null ? null : pct >= 80 ? 'ok' : pct >= 50 ? 'aviso' : 'mal');

  const rejilla = (q) => {
    const esActual = q.id === actual.id;
    const totalQ = calif(getQuarterTotal(q.id, 'good'), getQuarterTotal(q.id, 'bad'));
    return (
      <section key={q.id} className="r2g-trimestre" aria-labelledby={`r2g-trim-${q.id}`}>
        <div className="r2g-trimestre-cab">
          <h2 id={`r2g-trim-${q.id}`} className="r2g-trimestre-titulo">{NOMBRE_TRIMESTRE[q.id]}{esActual && <span className="r2g-sec"> · el actual</span>}</h2>
          <span className="r2g-linea">
            <b className="r2-tono--ok">{numero(getQuarterTotal(q.id, 'good'))}</b> bien · <b className="r2-tono--mal">{numero(getQuarterTotal(q.id, 'bad'))}</b> mal · calificación <b className={tonoCalif(totalQ.pct) ? `r2-tono--${tonoCalif(totalQ.pct)}` : undefined}>{totalQ.texto}</b>
          </span>
          <Boton nivel="fantasma" tamano="chico" icono={ChevronDown} alHacer={() => toggleTrimestre(q.id)}>Ocultar</Boton>
        </div>
        <div className="r2g-campana-marco">
          <table className="r2g-campana">
            <caption className="r2-solo-lectores">{`${NOMBRE_TRIMESTRE[q.id]}: calificación por área y semana`}</caption>
            <thead>
              <tr>
                <th scope="col" className="r2g-campana-area">Área</th>
                {q.weeks.map((w) => (
                  <th key={w} scope="col" className={clases('r2g-campana-semana', w === semanaHoy && 'r2g-campana-hoy')}>
                    <span>S{w}</span>{w === semanaHoy && <span className="r2g-campana-hoy-texto">Esta semana</span>}
                  </th>
                ))}
                <th scope="col" className="r2g-campana-total">Bien</th>
                <th scope="col" className="r2g-campana-total">Mal</th>
                <th scope="col" className="r2g-campana-total">Calificación</th>
              </tr>
            </thead>
            <tbody>
              {AREAS.map((a) => {
                const ca = calif(getAreaSubtotal(a.id, q.id, 'good'), getAreaSubtotal(a.id, q.id, 'bad'));
                return (
                  <tr key={a.id}>
                    <th scope="row" className="r2g-campana-area">
                      <span className="r2g-equipo r2g-equipo--area"><span className="r2g-punto" style={{ background: COLOR_AREA[a.id] }} aria-hidden="true" />{nombreArea(a)}</span>
                    </th>
                    {q.weeks.map((w) => <td key={w} className={clases('r2g-campana-celda', w === semanaHoy && 'r2g-campana-hoy')}>{celda(q, a, w)}</td>)}
                    <td className="r2g-campana-total r2g-num">{numero(getAreaSubtotal(a.id, q.id, 'good'))}</td>
                    <td className="r2g-campana-total r2g-num">{numero(getAreaSubtotal(a.id, q.id, 'bad'))}</td>
                    <td className={clases('r2g-campana-total r2g-num-fuerte', tonoCalif(ca.pct) && `r2-tono--${tonoCalif(ca.pct)}`)}>{ca.texto}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="r2g-campana-area">Total del trimestre</th>
                <td colSpan={q.weeks.length} />
                <td className="r2g-campana-total r2g-num-fuerte">{numero(getQuarterTotal(q.id, 'good'))}</td>
                <td className="r2g-campana-total r2g-num-fuerte">{numero(getQuarterTotal(q.id, 'bad'))}</td>
                <td className={clases('r2g-campana-total r2g-num-fuerte', tonoCalif(totalQ.pct) && `r2-tono--${tonoCalif(totalQ.pct)}`)}>{totalQ.texto}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    );
  };

  const resumenPlegado = (q) => {
    const t = calif(getQuarterTotal(q.id, 'good'), getQuarterTotal(q.id, 'bad'));
    return (
      <li key={q.id}>
        <button type="button" className="r2g-trimestre-plegado" aria-expanded="false" onClick={() => toggleTrimestre(q.id)}>
          <ChevronRight size={18} aria-hidden="true" />
          <span className="r2g-fuerte">{NOMBRE_TRIMESTRE[q.id]}</span>
          <span className="r2g-linea r2g-crece">
            <b>{numero(getQuarterTotal(q.id, 'good'))}</b> bien · <b>{numero(getQuarterTotal(q.id, 'bad'))}</b> mal
          </span>
          <span className="r2g-linea">calificación <b className={tonoCalif(t.pct) ? `r2-tono--${tonoCalif(t.pct)}` : undefined}>{t.texto}</b></span>
          <span className="r2g-enlace">Mostrar</span>
        </button>
      </li>
    );
  };

  // Esta semana, área por área (el celular la ve primero; el cajón «Calificar semana» usa la misma lista)
  const listaSemana = (alElegir) => (
    <ul className="r2g-lista-simple r2g-semana-areas">
      {AREAS.map((a) => {
        const c = data[getCellKey(actual.id, a.id, semanaHoy)];
        const [texto, tono] = estadoCelda(c);
        return (
          <li key={a.id}>
            <button type="button" className="r2g-semana-area" onClick={() => alElegir(a)}>
              <span className="r2g-equipo r2g-equipo--area"><span className="r2g-punto" style={{ background: COLOR_AREA[a.id] }} aria-hidden="true" />{nombreArea(a)}</span>
              <span className="r2g-semana-area-derecha">
                {tono ? <Estado tono={tono} texto={texto} /> : <span className="r2g-sec">Sin calificar</span>}
                {c?.note && <span className="r2g-sec r2g-una-linea r2g-semana-nota" title={c.note}>{c.note}</span>}
              </span>
              <ChevronRight size={18} aria-hidden="true" className="r2g-sec" />
            </button>
          </li>
        );
      })}
    </ul>
  );

  let cuerpo;
  if (loading) {
    cuerpo = <Cargando forma="tabla" columnas={[3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]} filas={13} etiqueta="Cargando la campaña…" />;
  } else if (errorCarga) {
    cuerpo = <ErrorCarga mensaje="No se pudo cargar la campaña de control." motivo={motivoError(errorCarga)} alReintentar={recargar} />;
  } else {
    const visibles = orden.filter((q) => !ocultos.includes(q.id));
    const plegados = orden.filter((q) => ocultos.includes(q.id));
    cuerpo = (
      <>
        {celular && (
          <section className="r2g-trimestre" aria-labelledby="r2g-esta-semana">
            <div className="r2g-trimestre-cab">
              <h2 id="r2g-esta-semana" className="r2g-trimestre-titulo">Semana {semanaHoy}<span className="r2g-sec"> · {calificadasHoy} de {AREAS.length} calificadas</span></h2>
            </div>
            {listaSemana((a) => handleCellClick(actual.id, a, semanaHoy))}
          </section>
        )}
        {visibles.map(rejilla)}
        {plegados.length > 0 && (
          <section className="r2g-trimestre" aria-label="Trimestres ocultos">
            <ul className="r2g-trimestres-plegados">{plegados.map(resumenPlegado)}</ul>
          </section>
        )}
      </>
    );
  }

  const area = selectedCell ? AREAS.find((a) => a.id === selectedCell.area?.id) || selectedCell.area : null;
  const hayAlgo = selectedCell && (data[selectedCell.key] || modalData.note);
  const opciones = [
    { valor: null, texto: 'Sin calificar' },
    { valor: 'good', texto: 'Bien', icono: Check },
    { valor: 'bad', texto: 'Mal', icono: X },
  ];

  return (
    <Pagina className="r2g-pagina" titulo="Campaña de control" densidad="compacta">
      <EncabezadoPagina titulo="Campaña de control 2026" dato={celular ? undefined : `semana ${semanaHoy} · ${NOMBRE_TRIMESTRE[actual.id]}`}
        ayuda={esSoloLectura ? 'Cada semana se califica a cada área como bien o mal, con una nota opcional. Solo lectura: toca un cuadro para ver su calificación y su nota.' : 'Cada semana se califica a cada área como bien o mal, con una nota opcional.'}
        secundarias={[{ texto: 'Exportar comentarios', icono: Download, alHacer: exportarComentarios }]}
        principal={esSoloLectura ? undefined : { texto: `Calificar semana ${semanaHoy}`, corto: `Semana ${semanaHoy}`, icono: ClipboardCheck, alHacer: () => setVerSemana(true) }} />
      <div className="r2g-campana-barra">
        <Segmentado etiqueta="Trimestres que se ven" valor={modo} alCambiar={(v) => (v === 'actual' ? soloActual() : guardarOcultos([]))}
          opciones={[{ valor: 'actual', texto: 'Trimestre actual' }, { valor: 'todos', texto: 'Todos' }]} />
        <span className="r2g-leyenda-campana" aria-hidden="true">
          <span className="r2g-celda-campana r2g-celda-campana--ok r2g-celda-campana--muestra"><Check size={14} strokeWidth={2.75} /></span>Bien
          <span className="r2g-celda-campana r2g-celda-campana--mal r2g-celda-campana--muestra"><X size={14} strokeWidth={2.75} /></span>Mal
          <span className="r2g-celda-campana r2g-celda-campana--muestra"><span className="r2g-celda-nota" /></span>Con nota
        </span>
      </div>
      {cuerpo}

      {/* Calificar la semana: las 13 áreas; cada una abre el diálogo de siempre y al guardar sigue la siguiente */}
      <Cajon abierto={verSemana} alCerrar={() => { setVerSemana(false); setSiguiendo(false); }} etiqueta={`Calificar la semana ${semanaHoy}`}>
        <CajonCabecera titulo={`Calificar semana ${semanaHoy}`} dato={`${calificadasHoy} de ${AREAS.length} áreas calificadas · ${NOMBRE_TRIMESTRE[actual.id]}`}
          alCerrar={() => { setVerSemana(false); setSiguiendo(false); }} />
        <CajonCuerpo>
          <SeccionCajon>
            <Nota>Toca un área para calificarla. Al guardar, se abre sola la siguiente que falte.</Nota>
            {listaSemana((a) => { setSiguiendo(true); handleCellClick(actual.id, a, semanaHoy); })}
          </SeccionCajon>
        </CajonCuerpo>
      </Cajon>

      {/* Diálogo de la celda: el mismo estado (modalData) y los mismos manejadores (handleSave, handleDelete) */}
      <Dialogo abierto={modalOpen && !!selectedCell} alCerrar={() => setModalOpen(false)} cerrarConVelo={false} tamano="sm"
        titulo={area ? `${nombreArea(area)} · semana ${selectedCell.week}` : ''}
        pie={esSoloLectura ? (
          <Boton nivel="principal" alHacer={() => setModalOpen(false)}>Cerrar</Boton>
        ) : (
          <div className="r2g-dialogo-pie-campana">
            <Boton nivel="peligro" tamano="chico" icono={Trash2} alHacer={handleDelete} deshabilitado={saving || !hayAlgo} motivo="No hay calificación ni nota que eliminar">Eliminar calificación</Boton>
            <span className="r2g-crece" />
            <Boton nivel="fantasma" alHacer={() => setModalOpen(false)}>Cancelar</Boton>
            <Boton nivel="principal" alHacer={handleSave} cargando={saving}>Guardar</Boton>
          </div>
        )}>
        {selectedCell && (
          <div className="r2g-dialogo-campana">
            {esSoloLectura && <p className="r2g-linea"><Eye size={16} aria-hidden="true" className="r2g-icono-linea" />Solo lectura</p>}
            <div className="r2g-tres-opciones" role="radiogroup" aria-label="Calificación">
              {opciones.map((o) => {
                const elegida = modalData.status === o.valor;
                return (
                  <button key={String(o.valor)} type="button" role="radio" aria-checked={elegida} disabled={esSoloLectura}
                    className={clases('r2g-opcion-campana', elegida && 'r2g-opcion-campana--elegida', elegida && o.valor === 'good' && 'r2g-opcion-campana--ok', elegida && o.valor === 'bad' && 'r2g-opcion-campana--mal')}
                    onClick={() => !esSoloLectura && setModalData({ ...modalData, status: o.valor })}>
                    {o.icono && <o.icono size={18} strokeWidth={2.5} aria-hidden="true" />}
                    {o.texto}
                  </button>
                );
              })}
            </div>
            <label className="r2-campo">
              <span className="r2-campo-etiqueta">Nota</span>
              <Area rows={4} value={modalData.note} readOnly={esSoloLectura} onChange={(e) => setModalData({ ...modalData, note: e.target.value })}
                placeholder={esSoloLectura ? 'Sin nota' : 'Escribe una nota que explique la calificación (opcional)'} />
            </label>
            {siguiendo && !esSoloLectura && <Nota>Al guardar se abre la siguiente área sin calificar.</Nota>}
          </div>
        )}
      </Dialogo>
    </Pagina>
  );
}
