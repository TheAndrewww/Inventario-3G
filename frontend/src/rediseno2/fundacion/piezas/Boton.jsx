// Rediseño 2 · botones (DISENO-v2 §4.11). Un solo botón «principal» por pantalla (y uno en el pie de un cajón).
//
// <Boton nivel="principal" icono={Plus} alHacer={abrirNueva}>Nueva orden</Boton>
// <Boton nivel="tonal" tamano="chico" alHacer={() => preparar(t)}>Preparar</Boton>
// <Boton nivel="contorno" href="/stock-bajo">Bajo stock mínimo</Boton>          (enlace interno con <Link>, sin precargas)
// <Boton nivel="peligro-lleno" cargando={anulando} alHacer={anular}>Anular ticket</Boton>
// <Boton deshabilitado motivo="Faltan 3 de 8 artículos">Finalizar</Boton>      (dice por qué al pasar el cursor)
// <BotonIcono icono={RefreshCw} etiqueta="Actualizar" alHacer={recargar} />    (solo para lo universal)
//
// Props de Boton: nivel ('principal' | 'tonal' | 'contorno' | 'fantasma' | 'peligro' | 'peligro-lleno'; por omisión
// 'contorno'), tamano ('chico' 32 px | 'normal' 40 px | 'grande' 48 px; en táctil crecen a 44/48), icono (componente de
// lucide), iconoDerecha, alHacer (onClick), href (ruta interna → <Link>; http… → <a>), cargando (aria-busy, no cambia de
// ancho), deshabilitado + motivo, tipo ('button' | 'submit'), anchoCompleto, y cualquier otro atributo (aria-*, form…).
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { clases } from '../formato';

const esExterna = (href) => /^(https?:|mailto:|tel:)/.test(String(href || ''));

export const Boton = forwardRef(function Boton({
  nivel = 'contorno', tamano = 'normal', icono: Icono, iconoDerecha: IconoDer, alHacer, href, cargando = false,
  deshabilitado = false, motivo, tipo = 'button', anchoCompleto = false, className, children, title, ...resto
}, ref) {
  const cls = clases('r2-boton', `r2-boton--${nivel}`, `r2-boton--${tamano}`, anchoCompleto && 'r2-boton--ancho', cargando && 'r2-boton--cargando', className);
  const dentro = (
    <>
      {Icono && <Icono size={tamano === 'chico' ? 16 : 18} aria-hidden="true" className="r2-boton-svg" />}
      {children != null && children !== false && <span className="r2-boton-texto">{children}</span>}
      {IconoDer && <IconoDer size={16} aria-hidden="true" className="r2-boton-svg" />}
    </>
  );
  const titulo = deshabilitado && motivo ? motivo : title;
  if (href && !deshabilitado) {
    if (esExterna(href)) {
      return <a ref={ref} href={href} className={cls} title={titulo} onClick={alHacer} {...resto}>{dentro}</a>;
    }
    return <Link ref={ref} to={href} className={cls} title={titulo} onClick={alHacer} {...resto}>{dentro}</Link>;
  }
  return (
    <button ref={ref} type={tipo} className={cls} onClick={alHacer} disabled={deshabilitado || undefined}
      aria-busy={cargando || undefined} title={titulo} {...resto}>
      {dentro}
    </button>
  );
});

// Solo ícono: siempre con etiqueta (aria-label y texto al pasar el cursor).
export const BotonIcono = forwardRef(function BotonIcono({
  icono: Icono, etiqueta, alHacer, href, tamano = 'normal', nivel = 'fantasma', deshabilitado = false, motivo, className, ...resto
}, ref) {
  const cls = clases('r2-boton-icono', `r2-boton-icono--${tamano}`, `r2-boton-icono--${nivel}`, className);
  const dentro = Icono ? <Icono size={tamano === 'chico' ? 16 : 20} aria-hidden="true" /> : null;
  if (href && !deshabilitado) {
    return esExterna(href)
      ? <a ref={ref} href={href} className={cls} aria-label={etiqueta} title={etiqueta} onClick={alHacer} {...resto}>{dentro}</a>
      : <Link ref={ref} to={href} className={cls} aria-label={etiqueta} title={etiqueta} onClick={alHacer} {...resto}>{dentro}</Link>;
  }
  return (
    <button ref={ref} type="button" className={cls} onClick={alHacer} aria-label={etiqueta}
      title={deshabilitado && motivo ? `${etiqueta}: ${motivo}` : etiqueta} disabled={deshabilitado || undefined} {...resto}>
      {dentro}
    </button>
  );
});
