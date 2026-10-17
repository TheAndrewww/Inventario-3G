// Rediseño 2 · Producción · filtro de menú con VARIAS opciones a la vez (como los chips «De» y «Para» de Avisos, que se
// pueden prender juntos y que la liga trae como ?destino=susana,asesor). Mismo aspecto que FiltroMenu de la fundación.
// Para la revisión final: FiltroMenu de la fundación solo elige una opción.
//
// <FiltroVarios etiqueta="Para" elegidas={['susana', 'asesor']} alAlternar={(id) => …} alLimpiar={() => …}
//   opciones={[{ valor: 'produccion', texto: 'Grupo Producción', cuenta: 12 }]} />
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { clases, numero } from '../fundacion/formato';

export function FiltroVarios({ etiqueta, opciones = [], elegidas = [], alAlternar, alLimpiar, textoTodos = 'Todos' }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const boton = useRef(null);
  const menu = useRef(null);
  const nombres = opciones.filter((o) => elegidas.includes(o.valor)).map((o) => o.texto);
  const valor = !elegidas.length ? textoTodos : nombres.length <= 2 ? nombres.join(' y ') : `${nombres.length} elegidos`;

  useLayoutEffect(() => {
    if (!abierto || !boton.current) return;
    const r = boton.current.getBoundingClientRect();
    const alto = menu.current?.offsetHeight || 0;
    const ancho = menu.current?.offsetWidth || 240;
    const abajo = r.bottom + 6 + alto <= window.innerHeight - 8;
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)), top: abajo ? r.bottom + 6 : Math.max(8, r.top - 6 - alto) });
  }, [abierto]);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!menu.current?.contains(e.target) && !boton.current?.contains(e.target)) setAbierto(false); };
    const cerrar = () => setAbierto(false);
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('resize', cerrar);
    window.addEventListener('scroll', cerrar, true);
    menu.current?.querySelector('[role="menuitemcheckbox"], [role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', fuera, true);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('scroll', cerrar, true);
    };
  }, [abierto]);

  const teclas = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAbierto(false); boton.current?.focus(); return; }
    if (e.key === 'Tab') { setAbierto(false); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(menu.current?.querySelectorAll('[role^="menuitem"]') || [])];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <span className="r2-filtro-menu">
      <button ref={boton} type="button" className={clases('r2-filtro', elegidas.length > 0 && 'r2-filtro--puesto')} aria-haspopup="menu" aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}>
        <span className="r2-filtro-etiqueta">{etiqueta}:</span>
        <span className="r2-filtro-valor">{valor}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {abierto && (
        <div ref={menu} className="r2-menu" role="menu" aria-label={etiqueta} onKeyDown={teclas}
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
          <button type="button" role="menuitemradio" aria-checked={!elegidas.length} className={clases('r2-menu-opcion', !elegidas.length && 'r2-menu-opcion--elegida')}
            onClick={() => { alLimpiar?.(); }}>
            {!elegidas.length ? <Check size={18} aria-hidden="true" /> : <span className="r2-menu-hueco" aria-hidden="true" />}
            <span className="r2-menu-texto">{textoTodos}</span>
          </button>
          <div className="r2-menu-separador" role="separator" />
          {opciones.map((o) => {
            const si = elegidas.includes(o.valor);
            return (
              <button key={o.valor} type="button" role="menuitemcheckbox" aria-checked={si} className={clases('r2-menu-opcion', si && 'r2-menu-opcion--elegida')}
                onClick={() => alAlternar?.(o.valor)}>
                <span className={clases('r2-prod-marca', si && 'r2-prod-marca--si')} aria-hidden="true">{si && <Check size={14} strokeWidth={3} />}</span>
                <span className="r2-menu-texto">{o.texto}</span>
                {o.cuenta != null && <span className="r2-menu-cuenta">{numero(o.cuenta)}</span>}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
