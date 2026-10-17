// Rediseño 2 · Piso · TV de un área: «Manufactura» (/manufactura-tv) y «Herrería» (/herreria-tv), vista encendida.
// Antes: una tarjeta de 240 px por obra con 1,050 px vacíos en medio; fondo rojo, «URGENTE», fecha roja y «0 días
// restantes» en rojo a la vez; se veían 3 obras de 18.
// Ahora: el mismo tablero de renglones de las otras TV, agrupado en Atrasadas → Esta semana → Después, con la entrega del
// área a la derecha en una sola expresión («3 días tarde», «Hoy», «Mañana», «En 4 días») y el color solo ahí. Herrería
// muestra además soldadura y pintura. Mismo filtro y mismo orden de la página (por días del área), páginas solas.
import { useMemo } from 'react';
import {
  MarcoTv, TablaTv, CeldaTv, ObraTv, PaginasTv, useTemaPiso, usePaginasAuto, useHoraDeDatos, plural, clases, AREAS,
} from '../fundacion';
import { AvisosPiso } from './AvisosPiso';
import { useLienzoTv } from './useLienzoTv';
import { detalleObra, entregaDeArea, etapaObra, grupoEntrega, gruposDePagina, GRUPOS_AREA, tipoDe } from './obrasPiso';
import { TituloGrupoTv } from './TituloGrupoTv';
import './piso.css';

// Soldadura y pintura: lo hecho resalta (avance), lo pendiente queda quieto
function Paso({ hecho }) {
  return hecho ? <CeldaTv texto="Lista" tono="ok" /> : <CeldaTv texto="Pendiente" tono="neutro" />;
}

export default function VistaTvArea({
  area, proyectos, lista, cargando, zoom, rotacion, controlesVisibles, alReducir, alAumentar, alRotar,
}) {
  const tema = useTemaPiso('tv');
  const hora = useHoraDeDatos(cargando ? null : proyectos);
  const esHerreria = area === 'herreria';
  const datosArea = AREAS[area] || { nombre: area };

  // La entrega del área de cada obra (la misma cuenta de la tarjeta de hoy) y su grupo, en el orden de la página
  const filas = useMemo(() => lista.map((p) => {
    const entrega = entregaDeArea(p);
    return { p, id: p.id, entrega, grupo: grupoEntrega(entrega) };
  }), [lista]);
  const cuentas = useMemo(() => {
    const c = { atrasadas: 0, semana: 0, despues: 0 };
    filas.forEach((f) => { c[f.grupo] += 1; });
    return c;
  }, [filas]);
  const nGrupos = Object.values(cuentas).filter(Boolean).length;
  const lienzo = useLienzoTv({ rotacion, zoom, altoFila: 120, altoFilaAngosta: 172, grupos: nGrupos });
  const pag = usePaginasAuto(filas, lienzo.porPagina, 20);
  // Cada grupo con su total (el de las cifras del encabezado) y «continúa de la página anterior» si empezó antes
  const grupos = useMemo(() => gruposDePagina(GRUPOS_AREA, filas, pag.visibles, (f) => f.grupo)
    .map((g) => ({ id: g.id, filas: g.filas, titulo: <TituloGrupoTv titulo={g.texto} total={g.total} sigue={g.sigue} /> })), [filas, pag.visibles]);

  const columnas = useMemo(() => {
    const entrega = ({ entrega: e }) => <CeldaTv texto={e.texto} tono={e.tono || undefined} fecha={e.detalle} grande />;
    if (lienzo.angosto) {
      return [
        {
          id: 'obra', titulo: 'De la entrega más próxima a la más lejana', ancho: 'minmax(0, 1fr)',
          celda: (f) => {
            const { p } = f;
            const e = etapaObra(p);
            return (
              <div className="r2-pi-tv-angosta">
                <div className="r2-pi-tv-angosta-cab">
                  <ObraTv nombre={p.nombre} detalle={detalleObra(p)} />
                  {entrega(f)}
                </div>
                <p className="r2-pi-tv-frase">
                  <span className={e.listo ? undefined : 'r2-pi-tv-frase-suave'}>{e.texto}</span>
                  {esHerreria && <span className={p.herreria_armado_completado ? 'r2-tono--ok' : 'r2-pi-tv-frase-suave'}>Soldadura: {p.herreria_armado_completado ? 'lista' : 'pendiente'}</span>}
                  {esHerreria && <span className={p.herreria_pintado_completado ? 'r2-tono--ok' : 'r2-pi-tv-frase-suave'}>Pintura: {p.herreria_pintado_completado ? 'lista' : 'pendiente'}</span>}
                </p>
              </div>
            );
          },
        },
      ];
    }
    return [
      { id: 'obra', titulo: 'Obra', ancho: 'minmax(0, 1fr)', celda: ({ p }) => <ObraTv nombre={p.nombre} detalle={detalleObra(p, { conTipo: false })} /> },
      {
        id: 'tipo', titulo: 'Trabajo', ancho: 'calc(230px * var(--r2-e))',
        celda: ({ p }) => {
          const t = tipoDe(p);
          return <span className="r2-pi-tv-tipo">{t ? <span className={clases('r2-tipo', t.clase ? `r2-tipo--${t.clase}` : 'r2-tipo--neutro')}>{t.texto}</span> : <span className="r2-pi-tv-sin">—</span>}</span>;
        },
      },
      {
        // En qué va la obra (dato que ya llega): «En compras» quiere decir que aún no hay material
        id: 'etapa', titulo: 'La obra va en', ancho: 'calc(250px * var(--r2-e))',
        celda: ({ p }) => { const e = etapaObra(p); return <CeldaTv texto={e.texto} tono={e.listo ? undefined : 'neutro'} />; },
      },
      ...(esHerreria ? [
        { id: 'soldadura', titulo: 'Soldadura', ancho: 'calc(190px * var(--r2-e))', celda: ({ p }) => <Paso hecho={!!p.herreria_armado_completado} /> },
        { id: 'pintura', titulo: 'Pintura', ancho: 'calc(190px * var(--r2-e))', celda: ({ p }) => <Paso hecho={!!p.herreria_pintado_completado} /> },
      ] : []),
      { id: 'entrega', titulo: 'Entrega del área', ancho: 'calc(270px * var(--r2-e))', alinear: 'der', celda: entrega },
    ];
  }, [lienzo.angosto, esHerreria]);

  const cifras = [
    cuentas.atrasadas ? { valor: cuentas.atrasadas, texto: cuentas.atrasadas === 1 ? 'atrasada' : 'atrasadas', tono: 'mal' } : null,
    { valor: cuentas.semana, texto: 'esta semana' },
    { valor: cuentas.despues, texto: 'después' },
  ].filter(Boolean);

  return (
    <div style={{ '--r2-pi-ajuste': lienzo.ajuste }}>
      <AvisosPiso posicion="top-right" />
      <MarcoTv
        className={clases('r2-pi-tv r2-pi-tv--area', lienzo.angosto && 'r2-pi-tv--angosta')}
        titulo={datosArea.nombre}
        area={datosArea}
        dato={cargando ? null : plural(lista.length, 'obra', 'obras')}
        cifras={cargando || !lista.length ? [] : cifras}
        hora={cargando ? { hora: null } : hora}
        escala={zoom}
        rotacion={rotacion}
        tema={tema}
        cargando={cargando}
        controles={{ visibles: controlesVisibles, alReducir, alAumentar, alRotar }}
        pie={<><span className="r2-pi-tv-pie-izq">{lienzo.angosto || cargando || !lista.length ? '' : 'Ordenadas por la entrega del área, la más próxima primero'}</span><PaginasTv {...pag} /></>}
      >
        <TablaTv
          className="r2-pi-tv-tabla"
          clave="id"
          columnas={columnas}
          grupos={grupos}
          vacio={<><b>{`No hay obras en ${datosArea.nombre.toLowerCase()}.`}</b> Cuando una obra llegue a esta área aparecerá aquí sola.</>}
        />
      </MarcoTv>
    </div>
  );
}
