// Rediseño 2 · Piso · TV «Listos para instalar» (/preparados-tv), vista encendida.
// Antes: «Proyectos completados» con la línea de etapas completa (ya cumplidas, con atrasos viejos en rojo) en cada
// tarjeta; la falla de instalación en una franja de 12 px y la cita en una esquina. Se veían 2 de 6.
// Ahora: arriba de todo, las obras con falla en la instalación (hay que reprogramar) con su motivo; luego una obra por
// renglón con la CITA al frente, la obra, el tipo de trabajo, en qué está y su fecha máxima. Páginas que cambian solas.
// Mismos filtros de la página (instalación, mantenimiento y garantía que van directo, pausadas al pie) y mismo orden.
import { useMemo } from 'react';
import {
  MarcoTv, TablaTv, CeldaTv, ObraTv, PaginasTv, useTemaPiso, usePaginasAuto, useHoraDeDatos, plural, fechaCorta, clases,
} from '../fundacion';
import { getEstadoCierrePreparado } from '../../utils/produccion';
import { AvisosPiso } from './AvisosPiso';
import { useLienzoTv } from './useLienzoTv';
import { citaDe, detalleObra, diaConSemana, diasCalendario, fechaMaximaDe, gruposDePagina, tipoDe, usaTimelineSimplificado } from './obrasPiso';
import { TituloGrupoTv } from './TituloGrupoTv';
import './piso.css';

// La cita en palabras: «Hoy», «Mañana», «Ayer» al frente y el día debajo; si no, el día de la semana y la fecha.
// Sin «en 3 días» debajo: en el mismo renglón la fecha máxima cuenta días HÁBILES («En 1 día» para el mismo lunes) y
// las dos cuentas juntas se contradecían a la vista.
function cita(p) {
  const c = citaDe(p);
  if (!c) return { texto: 'Sin cita', detalle: 'aún no está en el calendario', tono: 'neutro' };
  const d = diasCalendario(c);
  const dia = diaConSemana(c);
  if (d === 0) return { texto: 'Hoy', detalle: dia };
  if (d === 1) return { texto: 'Mañana', detalle: dia };
  if (d === -1) return { texto: 'Ayer', detalle: dia };
  if (d !== null && d < 0) return { texto: dia, detalle: 'ya pasó' };
  return { texto: dia, detalle: '' };
}

// En qué está la obra. Misma cuenta de hoy (getEstadoCierrePreparado): falla → reprogramar; la cita ya pasó → falta
// cerrarla (hoy: el marco rojo); si no, la producción terminada (el nodo «Completado» en verde de hoy).
function estado(p, cierre) {
  if (cierre.falla) return { texto: 'Hay que reprogramar', detalle: cierre.nota || 'Falló la instalación', tono: 'mal' };
  if (cierre.debeCerrar) {
    return { texto: 'Ya se instaló: falta cerrarla', detalle: `la instalación terminó hace ${plural(cierre.diasDesde, 'día', 'días')}`, tono: 'mal' };
  }
  if (usaTimelineSimplificado(p) && !p.instalacion_completado_en) return { texto: 'Va directo a instalación', detalle: 'no pasa por producción' };
  // El día en que producción la terminó (dato que ya llega: produccion_completado_en), en la hora de la planta
  const fin = p.produccion_completado_en ? fechaCorta(p.produccion_completado_en) : '';
  return { texto: 'Producción terminada', detalle: fin ? `el ${fin}` : '' };
}

function Trabajo({ p }) {
  const t = tipoDe(p);
  return (
    <span className="r2-pi-tv-tipo">
      {t ? <span className={clases('r2-tipo', t.clase ? `r2-tipo--${t.clase}` : 'r2-tipo--neutro')}>{t.texto}</span> : <span className="r2-pi-tv-sin">—</span>}
    </span>
  );
}

export default function VistaTvPreparados({
  proyectos, preparados, pausadas, cargando, zoom, rotacion, controlesVisibles, alReducir, alAumentar, alRotar,
}) {
  const tema = useTemaPiso('tv');
  const hora = useHoraDeDatos(cargando ? null : proyectos);

  // Fallas arriba de todo (hay que reprogramar); el resto en el orden de hoy
  const { fallas, resto, cierres } = useMemo(() => {
    const m = new Map(preparados.map((p) => [p.id, getEstadoCierrePreparado(p)]));
    return {
      cierres: m,
      fallas: preparados.filter((p) => m.get(p.id)?.falla),
      resto: preparados.filter((p) => !m.get(p.id)?.falla),
    };
  }, [preparados]);
  const ordenados = useMemo(() => [...fallas, ...resto], [fallas, resto]);
  const lienzo = useLienzoTv({ rotacion, zoom, altoFila: 120, altoFilaAngosta: 184, grupos: fallas.length ? 2 : 0 });
  const pag = usePaginasAuto(ordenados, lienzo.porPagina, 20);
  const porCerrar = preparados.filter((p) => cierres.get(p.id)?.debeCerrar).length;

  // Sin fallas, una sola lista sin título. Con fallas, dos grupos con su total (no solo lo que cabe en esta página) y
  // «continúa de la página anterior» si el grupo empezó antes.
  const grupos = useMemo(() => {
    if (!fallas.length) return [{ id: 'todas', filas: pag.visibles }];
    const conFalla = new Set(fallas.map((p) => p.id));
    return gruposDePagina(
      [{ id: 'fallas', titulo: 'Falla en la instalación' }, { id: 'resto', titulo: 'Por instalar' }],
      ordenados, pag.visibles, (p) => (conFalla.has(p.id) ? 'fallas' : 'resto'),
    ).map((g) => ({ id: g.id, filas: g.filas, titulo: <TituloGrupoTv titulo={g.texto} total={g.total} sigue={g.sigue} /> }));
  }, [pag.visibles, fallas, ordenados]);

  const columnas = useMemo(() => {
    const celdaCita = (p) => { const c = cita(p); return <span className="r2-pi-tv-cita"><CeldaTv texto={c.texto} tono={c.tono} fecha={c.detalle} /></span>; };
    const celdaEstado = (p) => {
      const e = estado(p, cierres.get(p.id) || {});
      const pron = p.pronostico_whatsapp?.texto;
      return <CeldaTv texto={e.texto} tono={e.tono} fecha={pron || e.detalle} />;
    };
    const celdaMaxima = (p) => {
      const c = cierres.get(p.id) || {};
      // Un solo color por renglón: si la obra ya tiene falla o falta cerrarla, la fecha máxima va sin color
      const fm = fechaMaximaDe(p, { sinColor: c.falla || c.debeCerrar });
      return fm ? <CeldaTv texto={fm.texto} tono={fm.tono || undefined} fecha={fm.detalle} /> : <CeldaTv texto="Sin fecha" tono="neutro" />;
    };
    if (lienzo.angosto) {
      return [
        {
          id: 'obra', titulo: 'Obra y su cita', ancho: 'minmax(0, 1fr)',
          celda: (p) => {
            const c = cierres.get(p.id) || {};
            const e = estado(p, c);
            const fm = fechaMaximaDe(p, { sinColor: c.falla || c.debeCerrar });
            return (
              <div className="r2-pi-tv-angosta">
                <div className="r2-pi-tv-angosta-cab">
                  <ObraTv nombre={p.nombre} detalle={detalleObra(p)} />
                  {celdaCita(p)}
                </div>
                <p className="r2-pi-tv-frase">
                  <span className={e.tono ? `r2-tono--${e.tono}` : undefined}>{e.texto}</span>
                  {e.detalle && <span className="r2-pi-tv-frase-suave">{e.detalle}</span>}
                  {fm && <span className={fm.tono ? `r2-tono--${fm.tono}` : 'r2-pi-tv-frase-suave'}>{`Fecha máxima: ${fm.texto.charAt(0).toLowerCase()}${fm.texto.slice(1)}`}</span>}
                </p>
              </div>
            );
          },
        },
      ];
    }
    return [
      { id: 'cita', titulo: 'Cita', ancho: 'calc(260px * var(--r2-e))', celda: celdaCita },
      { id: 'obra', titulo: 'Obra', ancho: 'minmax(0, 1.3fr)', celda: (p) => <ObraTv nombre={p.nombre} detalle={detalleObra(p, { conTipo: false })} /> },
      { id: 'tipo', titulo: 'Trabajo', ancho: 'calc(250px * var(--r2-e))', celda: (p) => <Trabajo p={p} /> },
      { id: 'estado', titulo: 'En qué está', ancho: 'minmax(0, 1fr)', celda: celdaEstado },
      { id: 'maxima', titulo: 'Fecha máxima', ancho: 'calc(236px * var(--r2-e))', alinear: 'der', celda: celdaMaxima },
    ];
  }, [lienzo.angosto, cierres]);

  const cifras = [
    fallas.length ? { valor: fallas.length, texto: 'con falla', tono: 'mal' } : null,
    porCerrar ? { valor: porCerrar, texto: 'por cerrar', tono: 'mal' } : null,
  ].filter(Boolean);

  const pie = (
    <>
      <span className="r2-pi-tv-pie-izq">
        {pausadas.length > 0
          ? <><b>{plural(pausadas.length, 'pausada', 'pausadas')}:</b>{` ${pausadas.map((p) => p.nombre).join(' · ')}`}</>
          : <span>{lienzo.angosto ? '' : 'Sin obras pausadas'}</span>}
      </span>
      <PaginasTv {...pag} />
    </>
  );

  return (
    <div style={{ '--r2-pi-ajuste': lienzo.ajuste }}>
      <AvisosPiso posicion="top-right" />
      <MarcoTv
        className={clases('r2-pi-tv', lienzo.angosto && 'r2-pi-tv--angosta')}
        titulo="Listos para instalar"
        dato={cargando ? null : plural(preparados.length, 'obra', 'obras')}
        cifras={cargando ? [] : cifras}
        hora={cargando ? { hora: null } : hora}
        escala={zoom}
        rotacion={rotacion}
        tema={tema}
        cargando={cargando}
        controles={{ visibles: controlesVisibles, alReducir, alAumentar, alRotar }}
        pie={cargando ? <span /> : pie}
      >
        <TablaTv
          className="r2-pi-tv-tabla"
          clave="id"
          columnas={columnas}
          grupos={grupos}
          vacio={<><b>No hay obras listas para instalar.</b> Cuando producción termine una obra aparecerá aquí sola.</>}
        />
      </MarcoTv>
    </div>
  );
}
