// Rediseño 2 · Piso · TV «Panel de producción» (/produccion-tv), vista encendida.
// Antes: cinco tarjetas de cifras y una tarjeta de 300 px por obra con su línea de etapas en letra de 12 px; de 18 obras
// se veían 2 y la lista no se movía sola.
// Ahora: un tablero de renglones (como el de salidas de un aeropuerto): una obra por renglón con una celda por etapa
// (palabra de estado grande y su fecha debajo) y la fecha máxima a la derecha. El color solo donde hay problema. Si no
// caben, las páginas cambian solas cada 20 s. Mismos datos, mismo orden (urgencia) y misma actualización cada minuto que
// la página; escala y giro con los mismos manejadores y las mismas claves guardadas.
import { useMemo } from 'react';
import {
  MarcoTv, TablaTv, CeldaTv, ObraTv, PaginasTv, useTemaPiso, usePaginasAuto, useHoraDeDatos, plural,
} from '../fundacion';
import { calcularDiasPorEtapa } from '../../utils/produccion';
import { AvisosPiso } from './AvisosPiso';
import { useLienzoTv } from './useLienzoTv';
import { ETAPAS_TV, celdaEtapa, detalleObra, etapasEnFrase, fechaMaximaDe } from './obrasPiso';
import './piso.css';

function FechaMaxima({ p }) {
  const fm = fechaMaximaDe(p);
  if (!fm) return <CeldaTv texto="Sin fecha" tono="neutro" />;
  return <CeldaTv texto={fm.texto} tono={fm.tono || undefined} fecha={fm.detalle} grande />;
}

function Etapa({ p, etapa, porEtapa }) {
  const c = celdaEtapa(p, etapa, porEtapa);
  if (c.vacia) return <span className="r2-pi-tv-sin" aria-label="No la lleva">—</span>;
  // El sí o el no de Producción por WhatsApp (C7 · PLA-17) va bajo la cita, como en la tarjeta de hoy
  const pron = etapa === 'instalacion' ? p.pronostico_whatsapp?.texto : null;
  return (
    <CeldaTv texto={c.texto} tono={c.tono || undefined}
      fecha={pron ? <span className={p.pronostico_whatsapp.respuesta === 'si' ? 'r2-tono--ok' : 'r2-tono--aviso'}>{pron}</span> : c.detalle} />
  );
}

// TV vertical o celular: la obra en tres líneas (nombre y fecha máxima; cliente; lo que le pasa)
function ObraAngosta({ p }) {
  const f = etapasEnFrase(p);
  const fm = fechaMaximaDe(p);
  const pron = p.pronostico_whatsapp?.texto;
  return (
    <div className="r2-pi-tv-angosta">
      <div className="r2-pi-tv-angosta-cab">
        <ObraTv nombre={p.nombre} detalle={detalleObra(p)} />
        {fm ? <CeldaTv texto={fm.texto} tono={fm.tono || undefined} fecha={fm.detalle} /> : <CeldaTv texto="Sin fecha" tono="neutro" />}
      </div>
      <p className="r2-pi-tv-frase">
        {f.activas.map((a) => <span key={a.id} className={a.tono ? `r2-tono--${a.tono}` : undefined}>{a.texto}</span>)}
        {f.listas && <span className="r2-pi-tv-frase-suave">{f.listas}</span>}
        {f.pendientes && <span className="r2-pi-tv-frase-suave">{f.pendientes}</span>}
        {pron && <span className={p.pronostico_whatsapp.respuesta === 'si' ? 'r2-tono--ok' : 'r2-tono--aviso'}>{pron}</span>}
      </p>
    </div>
  );
}

export default function VistaTvProduccion({
  proyectos, activos, pausadas, estadisticas = {}, cargando, zoom, rotacion, controlesVisibles, alReducir, alAumentar, alRotar,
}) {
  const tema = useTemaPiso('tv');
  const hora = useHoraDeDatos(cargando ? null : proyectos);
  const lienzo = useLienzoTv({ rotacion, zoom, altoFila: 120, altoFilaAngosta: 184 });
  const pag = usePaginasAuto(activos, lienzo.porPagina, 20);

  const columnas = useMemo(() => {
    if (lienzo.angosto) {
      return [{ id: 'obra', titulo: 'De la más urgente a la menos', celda: (p) => <ObraAngosta p={p} /> }];
    }
    return [
      { id: 'obra', titulo: 'Obra', ancho: 'minmax(0, 1fr)', celda: (p) => <ObraTv nombre={p.nombre} detalle={detalleObra(p)} /> },
      ...ETAPAS_TV.map((e) => ({
        id: e.id, titulo: e.nombre, ancho: 'calc(204px * var(--r2-e))',
        celda: (p) => <Etapa p={p} etapa={e.id} porEtapa={calcularDiasPorEtapa(p)} />,
      })),
      { id: 'maxima', titulo: 'Fecha máxima', ancho: 'calc(236px * var(--r2-e))', alinear: 'der', celda: (p) => <FechaMaxima p={p} /> },
    ];
  }, [lienzo.angosto]);

  // Mismas cifras que las tarjetas de hoy (estadisticas del servidor), en una línea y con las palabras del sistema
  const cifras = [
    { valor: estadisticas.diseno || 0, texto: 'en diseño' },
    { valor: estadisticas.compras || 0, texto: 'en compras' },
    { valor: estadisticas.produccion || 0, texto: 'en producción' },
    { valor: estadisticas.instalacion || 0, texto: Number(estadisticas.instalacion) === 1 ? 'lista para instalar' : 'listas para instalar' },
  ];

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
        className={`r2-pi-tv${lienzo.angosto ? ' r2-pi-tv--angosta' : ''}`}
        titulo="Panel de producción"
        dato={cargando ? null : plural(activos.length, 'obra', 'obras')}
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
          filas={pag.visibles}
          vacio={<><b>No hay obras en producción.</b> Cuando una obra entre a diseño aparecerá aquí sola.</>}
        />
      </MarcoTv>
    </div>
  );
}
