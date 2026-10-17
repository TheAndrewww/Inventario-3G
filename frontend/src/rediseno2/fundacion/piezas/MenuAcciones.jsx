// Rediseño 2 · «Más acciones» (⋯) (DISENO-v2 §4.11). Menú con posición fija (ninguna caja lo corta), ícono + texto por
// opción; lo destructivo va siempre al final, separado y en rojo. Cada opción llama al MISMO manejador de siempre.
//
// <MenuAcciones titulo={orden.folio} acciones={[
//   { texto: 'Descargar PDF', icono: FileDown, alHacer: () => descargar(orden) },
//   { texto: 'Editar', icono: Pencil, alHacer: () => editar(orden), deshabilitado: !puede, motivo: 'Solo por aprobar' },
//   { texto: 'Ver en Finanzas', href: '/…' },
//   { grupo: 'Pantallas de TV (abren aparte)' },
//   { texto: 'TV Producción', icono: Monitor, href: '/produccion-tv', nuevaPestana: true, titulo: 'Vista TV - Producción' },
//   { texto: 'Anular orden', icono: Ban, alHacer: () => anular(orden), peligro: true },
// ]} />
//
// Props: acciones (lista; null/false se ignoran; '-' es un separador; { grupo } es un título de grupo), etiqueta
// ('Más acciones'), titulo (de qué cosa: «Más acciones: OC-1180» para lectores), tamano ('chico' | 'normal'), icono (por
// omisión los tres puntos). Cada opción: texto, icono, alHacer | href, nuevaPestana (con href: un <a target="_blank"> real,
// como las ligas de siempre), titulo (texto al pasar el cursor), deshabilitado + motivo, peligro.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, MoreHorizontal } from 'lucide-react';
import { clases } from '../formato';

export function MenuAcciones({ acciones, etiqueta = 'Más acciones', titulo, tamano = 'normal', icono = MoreHorizontal, className }) {
  const Icono = icono;
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const boton = useRef(null);
  const menu = useRef(null);
  const navegar = useNavigate();
  const lista = (acciones || []).filter(Boolean);
  // Lo destructivo al final, separado
  const normales = lista.filter((a) => a === '-' || !a.peligro);
  const peligrosas = lista.filter((a) => a !== '-' && a.peligro);
  const visibles = peligrosas.length ? [...normales, '-', ...peligrosas] : normales;
  const limpias = visibles.filter((a, i, arr) => a !== '-' || (i > 0 && i < arr.length - 1 && arr[i - 1] !== '-'));
  const esOpcion = (a) => a !== '-' && !a.grupo;

  useLayoutEffect(() => {
    if (!abierto || !boton.current) return;
    const r = boton.current.getBoundingClientRect();
    const alto = menu.current?.offsetHeight || 0;
    const ancho = menu.current?.offsetWidth || 240;
    const abajo = r.bottom + 6 + alto <= window.innerHeight - 8;
    const left = Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8));
    setPos({ left, top: abajo ? r.bottom + 6 : Math.max(8, r.top - 6 - alto) });
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!menu.current?.contains(e.target) && !boton.current?.contains(e.target)) setAbierto(false); };
    const cerrar = () => setAbierto(false);
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('resize', cerrar);
    window.addEventListener('scroll', cerrar, true);
    // El menú se pinta oculto hasta que se sabe dónde va (useLayoutEffect): el foco entra en el siguiente cuadro, ya visible
    // (verificación: sin esto el foco se quedaba en el botón; Esc no cerraba el menú y, dentro de un cajón, cerraba el cajón)
    const cuadro = window.requestAnimationFrame(() => menu.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus());
    return () => {
      window.cancelAnimationFrame(cuadro);
      document.removeEventListener('pointerdown', fuera, true);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('scroll', cerrar, true);
    };
  }, [abierto]);

  if (!limpias.some(esOpcion)) return null;

  const teclas = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAbierto(false); boton.current?.focus(); return; }
    if (e.key === 'Tab') { setAbierto(false); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const items = [...(menu.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    const i = items.indexOf(document.activeElement);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[j]?.focus();
  };
  const elegir = (a, e) => {
    setAbierto(false);
    if (a.href) { navegar(a.href); return; }
    a.alHacer?.(e);
  };

  return (
    <span className={clases('r2-menu-acciones', className)} onClick={(e) => e.stopPropagation()}>
      <button ref={boton} type="button" className={clases('r2-boton-icono', `r2-boton-icono--${tamano}`, 'r2-boton-icono--fantasma')}
        aria-haspopup="menu" aria-expanded={abierto} aria-label={titulo ? `${etiqueta}: ${titulo}` : etiqueta} title={etiqueta}
        onClick={() => setAbierto((v) => !v)}>
        <Icono size={tamano === 'chico' ? 16 : 20} aria-hidden="true" />
      </button>
      {abierto && (
        <div ref={menu} className="r2-menu" role="menu" aria-label={titulo ? `${etiqueta}: ${titulo}` : etiqueta} onKeyDown={teclas}
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
          {limpias.map((a, i) => {
            if (a === '-') return <div key={`sep-${i}`} className="r2-menu-separador" role="separator" />;
            if (a.grupo) return <div key={`g-${a.grupo}`} className="r2-menu-grupo" role="presentation">{a.grupo}</div>;
            const cuerpo = (
              <>
                {a.icono ? <a.icono size={18} aria-hidden="true" /> : <span className="r2-menu-hueco" aria-hidden="true" />}
                <span className="r2-menu-texto">
                  {a.texto}
                  {a.deshabilitado && a.motivo && <small>{a.motivo}</small>}
                </span>
                {a.nuevaPestana && <ExternalLink size={14} aria-hidden="true" className="r2-menu-fuera" />}
              </>
            );
            // Liga real que abre aparte (<a target="_blank">, igual que hoy): el navegador la abre, no la app
            if (a.href && a.nuevaPestana && !a.deshabilitado) {
              return (
                <a key={`${a.texto}-${i}`} role="menuitem" className="r2-menu-opcion" href={a.href} title={a.titulo}
                  target="_blank" rel="noopener noreferrer" aria-label={`${a.texto} (abre en otra pestaña)`}
                  onClick={() => setAbierto(false)}>
                  {cuerpo}
                </a>
              );
            }
            return (
              <button key={`${a.texto}-${i}`} type="button" role="menuitem" className={clases('r2-menu-opcion', a.peligro && 'r2-menu-opcion--peligro')}
                disabled={a.deshabilitado || undefined} title={a.deshabilitado && a.motivo ? a.motivo : a.titulo}
                onClick={(e) => elegir(a, e)}>
                {cuerpo}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
