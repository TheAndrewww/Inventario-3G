// Rediseño 2 · encabezado de página (DISENO-v2 §4.1). Dice qué es la pantalla y tiene LA acción principal.
//
// Simple:
//   <EncabezadoPagina titulo="Tablero de producción" dato="28 obras" ayuda="…(solo si hace falta)…"
//     secundarias={[{ texto: 'Exportar CSV', icono: Download, alHacer: exportar }]}
//     masAcciones={[{ texto: 'Traer obras del Índice', icono: RefreshCw, alHacer: sincronizar }]}
//     principal={{ texto: 'Nuevo proyecto', corto: 'Nuevo', icono: Plus, alHacer: () => setModal(true) }} />
// Con pestañas de sección (Tickets de material, Compras): pestanas="seccion" (salen del menú: mismos permisos y mismo
// orden guardado); la pestaña activa hace de título (hay un h1 oculto para lectores). También acepta una lista propia:
//   pestanas={[{ ruta: '/x', texto: 'X', activa: true }]}.
//
// Props: titulo, dato (texto corto junto al título: «28 obras», «datos de las 10:28»), ayuda, pestanas, principal
// ({texto, corto, icono, alHacer | href, deshabilitado, motivo, cargando}), secundarias (hasta 2, contorno o fantasma:
// [{texto, icono, alHacer | href, nivel}]), masAcciones (lista de MenuAcciones), extra (un nodo a la derecha, p. ej.
// <IndicadorPistola/> o <HoraDeDatos/>).
// Celular: el título vive en la barra superior y aquí no se repite; la acción principal pasa a la derecha de la fila de
// búsqueda de <BarraFiltros> (o a una fila propia si la pantalla no tiene filtros).
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Boton } from './Boton';
import { MenuAcciones } from './MenuAcciones';
import { acomodarActiva } from '../acomodarActiva';
import { useArmazon, usePagina } from '../contexto';
import { pestanasDeRuta } from '../armazon/menuR2';
import { useAnchoR2 } from '../useDiseno3G';
import { useAltoFijo } from '../useAltoFijo';
import { clases } from '../formato';

function AccionPrincipal({ principal, corta = false }) {
  if (!principal) return null;
  return (
    <Boton nivel="principal" icono={principal.icono} alHacer={principal.alHacer} href={principal.href}
      deshabilitado={principal.deshabilitado} motivo={principal.motivo} cargando={principal.cargando}
      aria-label={corta && principal.corto ? principal.texto : undefined}>
      {corta ? (principal.corto || principal.texto) : principal.texto}
    </Boton>
  );
}

export function EncabezadoPagina({ titulo, dato, ayuda, pestanas, principal, secundarias = [], masAcciones = [], extra, className }) {
  const { pathname } = useLocation();
  const armazon = useArmazon();
  const pagina = usePagina();
  const ancho = useAnchoR2();
  const ref = useRef(null);
  const refPestanas = useRef(null);
  const celular = ancho === 'celular';

  const seccion = pestanas === 'seccion' ? pestanasDeRuta(pathname, armazon?.usuario?.rol, armazon?.usuario?.id) : null;
  const lista = (seccion ? seccion.pestanas : Array.isArray(pestanas) ? pestanas : []);
  const conPestanas = lista.length > 1;
  const activa = lista.find((p) => p.activa);
  const tituloReal = titulo || activa?.texto || seccion?.titulo || '';
  useAltoFijo(ref, pagina?.setAltoEnc, conPestanas);
  useEffect(() => { acomodarActiva(refPestanas.current); }, [pathname, ancho, conPestanas]);

  const secundariasVisibles = (secundarias || []).filter(Boolean).slice(0, 2);
  const acciones = (
    <>
      {extra}
      {!celular && secundariasVisibles.map((s) => (
        <Boton key={s.texto} nivel={s.nivel || 'contorno'} icono={s.icono} alHacer={s.alHacer} href={s.href}
          deshabilitado={s.deshabilitado} motivo={s.motivo} cargando={s.cargando}>{s.texto}</Boton>
      ))}
      <MenuAcciones acciones={celular ? [...secundariasVisibles, ...(masAcciones || [])] : masAcciones} />
      <AccionPrincipal principal={principal} corta={celular} />
    </>
  );
  const hayAcciones = Boolean(principal || extra || secundariasVisibles.length || (masAcciones || []).filter(Boolean).length);
  // En celular, con barra de filtros, las acciones van a su ranura (a la derecha de la búsqueda)
  const enRanura = celular && pagina?.ranura;

  return (
    <header ref={ref} className={clases('r2-encabezado', conPestanas && 'r2-encabezado--pestanas', className)}>
      <div className="r2-encabezado-fila">
        {conPestanas ? (
          <>
            <h1 className="r2-solo-lectores">{seccion?.titulo ? `${seccion.titulo}: ${tituloReal}` : tituloReal}</h1>
            <nav ref={refPestanas} className="r2-pestanas r2-pestanas--encabezado" aria-label={seccion?.titulo ? `Pantallas de ${seccion.titulo.toLowerCase()}` : 'Pantallas'}>
              {lista.map((p) => (
                <Link key={p.ruta} to={p.ruta} className="r2-pestana" aria-current={p.activa ? 'page' : undefined}>
                  {p.texto}{p.cuenta != null && <span className="r2-pestana-cuenta">{p.cuenta}</span>}
                </Link>
              ))}
            </nav>
          </>
        ) : (
          <div className="r2-encabezado-titulos">
            <h1 className="r2-encabezado-titulo">{tituloReal}</h1>
            {dato && <span className="r2-encabezado-dato">{dato}</span>}
          </div>
        )}
        {hayAcciones && !enRanura && <div className="r2-encabezado-acciones">{acciones}</div>}
        {hayAcciones && enRanura && createPortal(acciones, pagina.ranura)}
      </div>
      {conPestanas && dato && <p className="r2-encabezado-dato r2-encabezado-dato--debajo">{dato}</p>}
      {ayuda && <p className="r2-encabezado-ayuda">{ayuda}</p>}
    </header>
  );
}
