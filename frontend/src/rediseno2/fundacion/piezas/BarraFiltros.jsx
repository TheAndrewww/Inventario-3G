// Rediseño 2 · barra de filtros (DISENO-v2 §4.3): UNA sola fila pegada debajo del encabezado al desplazar.
// Orden fijo: búsqueda (crece, máx. 420 px) → filtros (máx. 4) → «Quitar filtros» (solo si hay alguno) → a la derecha vista
// (Segmentado) y orden. Celular: búsqueda a lo ancho + «Filtros (2)» abre un cajón con los mismos controles y «Ver 14
// resultados»; la acción principal del encabezado se acomoda a la derecha de esta fila.
//
// <BarraFiltros
//   busqueda={{ valor: busca, alCambiar: setBusca, texto: 'Buscar folio, proveedor…', autoFoco: true }}
//   filtros={[
//     <FiltroMenu key="estado" etiqueta="Estado" valor={estado} alCambiar={setEstado}
//       opciones={[{ valor: '', texto: 'Todos' }, { valor: 'enviada', texto: 'Enviada', cuenta: 4 }]} />,
//     <ChipFiltro key="urg" texto="Solo urgentes" activo={soloUrg} alCambiar={setSoloUrg} />,
//   ]}
//   activos={(estado ? 1 : 0) + (soloUrg ? 1 : 0)} alQuitar={quitarFiltros}
//   vista={<Segmentado … />} orden={<FiltroMenu etiqueta="Orden" … />} resultados={filtradas.length} />
//
// Props: busqueda {valor, alCambiar(texto), texto (ejemplo), etiqueta (lectores), autoFoco}, filtros (nodos), activos
// (cuántos filtros puestos; muestra «Quitar filtros»), alQuitar, vista (nodo), orden (nodo), resultados (número para el
// botón del cajón en celular), fija (true: se pega arriba).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown, Check } from 'lucide-react';
import { Boton } from './Boton';
import { Cajon, CajonCabecera, CajonCuerpo, CajonPie } from './Cajon';
import { usePagina } from '../contexto';
import { useEsCelular } from '../useDiseno3G';
import { useAltoFijo } from '../useAltoFijo';
import { clases, numero, plural } from '../formato';

export function Busqueda({ valor = '', alCambiar, texto = 'Buscar…', etiqueta, autoFoco = false, alEnter, className }) {
  const ref = useRef(null);
  const celular = useEsCelular();
  useEffect(() => { if (autoFoco && !celular) ref.current?.focus({ preventScroll: true }); }, [autoFoco, celular]);
  return (
    <div className={clases('r2-busqueda', className)} role="search">
      <Search size={18} aria-hidden="true" className="r2-busqueda-lupa" />
      <input ref={ref} type="search" className="r2-busqueda-campo" value={valor} placeholder={texto} aria-label={etiqueta || texto}
        autoComplete="off" spellCheck={false}
        onChange={(e) => alCambiar?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && valor) { e.preventDefault(); e.stopPropagation(); alCambiar?.(''); }
          if (e.key === 'Enter') alEnter?.(valor);
        }} />
      {valor && (
        <button type="button" className="r2-busqueda-limpiar" aria-label="Borrar búsqueda" title="Borrar búsqueda (Esc)"
          onClick={() => { alCambiar?.(''); ref.current?.focus(); }}>
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// Menú de filtro: el botón dice su valor («Estado: Todos ▾»). Puede traer al pie una acción de administrar.
// porOmision: el valor con el que la pantalla abre cuando no es la primera opción (p. ej. «Principal»): con ese valor el
// botón no se pinta como filtro puesto (revisión final).
export function FiltroMenu({ etiqueta, valor, opciones = [], alCambiar, pie, porOmision, className }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const boton = useRef(null);
  const menu = useRef(null);
  const elegida = opciones.find((o) => o.valor === valor) || opciones[0];
  const puesto = porOmision !== undefined ? valor !== porOmision : Boolean(elegida && opciones[0] && elegida !== opciones[0]);

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
    // Igual que MenuAcciones: el foco entra cuando el menú ya es visible (en el siguiente cuadro)
    const cuadro = window.requestAnimationFrame(() => (menu.current?.querySelector('[aria-checked="true"]') || menu.current?.querySelector('[role="menuitemradio"]'))?.focus());
    return () => {
      window.cancelAnimationFrame(cuadro);
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
    <span className={clases('r2-filtro-menu', className)}>
      <button ref={boton} type="button" className={clases('r2-filtro', puesto && 'r2-filtro--puesto')} aria-haspopup="menu" aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}>
        <span className="r2-filtro-etiqueta">{etiqueta}:</span>
        <span className="r2-filtro-valor">{elegida?.texto ?? 'Todos'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {abierto && (
        <div ref={menu} className="r2-menu" role="menu" aria-label={etiqueta} onKeyDown={teclas}
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
          {opciones.map((o) => (
            <button key={String(o.valor)} type="button" role="menuitemradio" aria-checked={o.valor === valor}
              className={clases('r2-menu-opcion', o.valor === valor && 'r2-menu-opcion--elegida')}
              onClick={() => { setAbierto(false); alCambiar?.(o.valor); boton.current?.focus(); }}>
              {o.valor === valor ? <Check size={18} aria-hidden="true" /> : <span className="r2-menu-hueco" aria-hidden="true" />}
              <span className="r2-menu-texto">{o.texto}</span>
              {o.cuenta != null && <span className="r2-menu-cuenta">{numero(o.cuenta)}</span>}
            </button>
          ))}
          {pie && (
            <>
              <div className="r2-menu-separador" role="separator" />
              <button type="button" role="menuitem" className="r2-menu-opcion" onClick={() => { setAbierto(false); pie.alHacer?.(); }}>
                {pie.icono ? <pie.icono size={18} aria-hidden="true" /> : <span className="r2-menu-hueco" aria-hidden="true" />}
                <span className="r2-menu-texto">{pie.texto}</span>
              </button>
            </>
          )}
        </div>
      )}
    </span>
  );
}

// Chip de filtro que se prende y se apaga (con palomita cuando está puesto)
export function ChipFiltro({ texto, activo = false, alCambiar, cuenta, className }) {
  return (
    <button type="button" className={clases('r2-filtro r2-chip', activo && 'r2-filtro--puesto', className)} aria-pressed={activo}
      onClick={() => alCambiar?.(!activo)}>
      {activo && <Check size={16} aria-hidden="true" />}
      <span>{texto}</span>
      {cuenta != null && <span className="r2-chip-cuenta">{numero(cuenta)}</span>}
    </button>
  );
}

export function QuitarFiltros({ alHacer, texto = 'Quitar filtros' }) {
  return <button type="button" className="r2-quitar-filtros" onClick={alHacer}>{texto}</button>;
}

export function BarraFiltros({ busqueda, filtros = [], activos = 0, alQuitar, vista, orden, resultados, fija = true, children, className }) {
  const pagina = usePagina();
  const celular = useEsCelular();
  const ref = useRef(null);
  const [cajon, setCajon] = useState(false);
  useAltoFijo(ref, pagina?.setAltoFil, fija);
  const lista = (Array.isArray(filtros) ? filtros : [filtros]).filter(Boolean);
  const hayControles = lista.length > 0 || vista || orden || children;

  if (celular) {
    return (
      <div ref={ref} className={clases('r2-filtros', fija && 'r2-filtros--fija', className)}>
        <div className="r2-filtros-fila">
          {busqueda && <Busqueda {...busqueda} />}
          {hayControles && (
            <Boton nivel={activos ? 'tonal' : 'contorno'} icono={SlidersHorizontal} alHacer={() => setCajon(true)}
              className={activos ? 'r2-boton-filtros r2-boton-filtros--puestos' : 'r2-boton-filtros'} title="Filtros"
              aria-label={activos ? `Filtros, ${plural(activos, 'puesto', 'puestos')}` : 'Filtros'}>
              {activos ? numero(activos) : null}
            </Boton>
          )}
          <span ref={pagina?.setRanura} className="r2-filtros-ranura" />
        </div>
        {hayControles && (
          <Cajon abierto={cajon} alCerrar={() => setCajon(false)} etiqueta="Filtros">
            <CajonCabecera titulo="Filtros" alCerrar={() => setCajon(false)} />
            <CajonCuerpo>
              <div className="r2-filtros-cajon">
                {vista}
                {lista}
                {orden}
                {children}
              </div>
            </CajonCuerpo>
            <CajonPie>
              {activos > 0 && alQuitar && <Boton nivel="fantasma" alHacer={alQuitar}>Quitar filtros</Boton>}
              <Boton nivel="principal" alHacer={() => setCajon(false)}>
                {resultados != null ? `Ver ${plural(resultados, 'resultado', 'resultados')}` : 'Ver resultados'}
              </Boton>
            </CajonPie>
          </Cajon>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={clases('r2-filtros', fija && 'r2-filtros--fija', className)}>
      <div className="r2-filtros-fila">
        {busqueda && <Busqueda {...busqueda} />}
        {lista}
        {children}
        {activos > 0 && alQuitar && <QuitarFiltros alHacer={alQuitar} />}
        {(vista || orden) && (
          <span className="r2-filtros-derecha">
            {vista}
            {orden}
          </span>
        )}
      </div>
    </div>
  );
}
