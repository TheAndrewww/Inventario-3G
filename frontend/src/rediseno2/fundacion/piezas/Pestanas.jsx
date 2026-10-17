// Rediseño 2 · pestañas y segmentado (DISENO-v2 §4.7).
// Pestañas: cambian de pantalla o de vista grande. Subrayadas, 44 px; el número va como texto junto al nombre
// («Pendientes 11»), no como insignia. Flechas del teclado. En celular se desplazan de lado y la activa se acomoda a la vista.
// Segmentado: vistas de la MISMA lista (Activas · Completadas · Canceladas; Semana · Mes). Nunca rojo ni verde.
//
// <Pestanas etiqueta="Vistas de conteo" valor={vista} alCambiar={setVista}
//   pestanas={[{ id: 'hoy', texto: 'Conteo de hoy', cuenta: 15 }, { id: 'reportes', texto: 'Reportes' }]} />
// <Pestanas pestanas={[{ id: 'a', texto: 'Pantalla A', href: '/a' }, …]} />   (con href son enlaces y la activa es la ruta)
// <Segmentado etiqueta="Estado de las órdenes" valor={vista} alCambiar={setVista}
//   opciones={[{ valor: 'activas', texto: 'Activas', cuenta: 14 }, { valor: 'completadas', texto: 'Completadas' }]} />
//
// Pestanas: pestanas [{id, texto, cuenta, href, deshabilitado}], valor, alCambiar(id), etiqueta, idPanel (aria-controls).
// Segmentado: opciones [{valor, texto, cuenta, icono}], valor, alCambiar(valor), etiqueta, anchoCompleto, deshabilitado (se ve
// apagado y no acepta toques; p. ej. mientras se guarda).
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clases, numero } from '../formato';
import { acomodarActiva } from '../acomodarActiva';

export function Pestanas({ pestanas = [], valor, alCambiar, etiqueta = 'Vistas', idPanel, className }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  const esActiva = (p) => (p.href ? p.href === pathname : p.id === valor);
  useEffect(() => { acomodarActiva(ref.current); }, [valor, pathname]);

  const teclas = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const items = [...ref.current.querySelectorAll('[role="tab"]:not([disabled])')];
    const i = items.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    items[j].focus();
    items[j].click();
  };

  const conEnlaces = pestanas.some((p) => p.href);
  if (conEnlaces) {
    return (
      <nav ref={ref} className={clases('r2-pestanas', className)} aria-label={etiqueta}>
        {pestanas.map((p) => (
          <Link key={p.id || p.href} to={p.href} className="r2-pestana" aria-current={esActiva(p) ? 'page' : undefined}>
            {p.texto}{p.cuenta != null && <span className="r2-pestana-cuenta">{numero(p.cuenta)}</span>}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <div ref={ref} className={clases('r2-pestanas', className)} role="tablist" aria-label={etiqueta} onKeyDown={teclas}>
      {pestanas.map((p) => {
        const activa = esActiva(p);
        return (
          <button key={p.id} type="button" role="tab" className="r2-pestana" aria-selected={activa} tabIndex={activa ? 0 : -1}
            aria-controls={idPanel} disabled={p.deshabilitado || undefined} onClick={() => alCambiar?.(p.id)}>
            {p.texto}{p.cuenta != null && <span className="r2-pestana-cuenta">{numero(p.cuenta)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Segmentado({ opciones = [], valor, alCambiar, etiqueta = 'Vista', anchoCompleto = false, deshabilitado = false, className }) {
  return (
    <div className={clases('r2-segmentado', anchoCompleto && 'r2-segmentado--ancho', className)} role="radiogroup" aria-label={etiqueta}
      aria-disabled={deshabilitado || undefined}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button key={String(o.valor)} type="button" role="radio" aria-checked={activo} className="r2-segmento"
            disabled={deshabilitado || undefined} onClick={() => alCambiar?.(o.valor)}>
            {o.icono && <o.icono size={16} aria-hidden="true" />}
            <span>{o.texto}</span>
            {o.cuenta != null && <span className="r2-segmento-cuenta">{numero(o.cuenta)}</span>}
          </button>
        );
      })}
    </div>
  );
}
