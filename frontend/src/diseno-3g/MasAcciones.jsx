// Diseño 3G — «Más acciones» de un renglón: un solo botón principal a la vista y el resto aquí (g3-menu).
// Solo se monta con el interruptor encendido. Cada opción llama EXACTAMENTE al mismo manejador que el botón de siempre.
// El menú se pinta con position: fixed para que ninguna tabla con desplazamiento lo recorte.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

export default function MasAcciones({ acciones, etiqueta = 'Más acciones', titulo }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const boton = useRef(null);
  const menu = useRef(null);
  const visibles = (acciones || []).filter(Boolean);

  useLayoutEffect(() => {
    if (!abierto || !boton.current) return;
    const r = boton.current.getBoundingClientRect();
    const alto = menu.current?.offsetHeight || 0;
    const ancho = menu.current?.offsetWidth || 220;
    const abajo = r.bottom + 6 + alto <= window.innerHeight - 8;
    const left = Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8));
    setPos({ left, top: abajo ? r.bottom + 6 : Math.max(8, r.top - 6 - alto) });
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!menu.current?.contains(e.target) && !boton.current?.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') { setAbierto(false); boton.current?.focus(); } };
    const cerrar = () => setAbierto(false);
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', cerrar);
    window.addEventListener('scroll', cerrar, true);
    const primero = menu.current?.querySelector('button:not([disabled])');
    primero?.focus();
    return () => {
      document.removeEventListener('pointerdown', fuera, true);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('scroll', cerrar, true);
    };
  }, [abierto]);

  if (!visibles.length) return null;
  const mover = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(menu.current?.querySelectorAll('button:not([disabled])') || [])];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };
  return (
    <span className="g3p-mas" onClick={(e) => e.stopPropagation()}>
      <button ref={boton} type="button" className="g3-btn-icono g3p-mas-boton" aria-haspopup="menu" aria-expanded={abierto}
        aria-label={titulo ? `${etiqueta}: ${titulo}` : etiqueta} title={etiqueta} onClick={() => setAbierto((v) => !v)}>
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {abierto && (
        <div ref={menu} className="g3-menu g3p-mas-menu" role="menu" aria-label={etiqueta} onKeyDown={mover}
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}>
          {visibles.map((a, i) => (a === '-'
            ? <hr key={`hr-${i}`} />
            : (
              <button key={a.texto} type="button" role="menuitem" className={a.peligro ? 'g3-menu-peligro' : undefined}
                disabled={a.disabled} title={a.title}
                onClick={(e) => { setAbierto(false); a.onClick(e); }}>
                {a.icono && <a.icono size={18} aria-hidden="true" />}
                <span>{a.texto}</span>
              </button>
            )))}
        </div>
      )}
    </span>
  );
}
