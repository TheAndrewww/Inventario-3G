// Rediseño 2 · campos (DISENO-v2 §4.13). Etiqueta ARRIBA (13 px seminegrita), ayuda abajo, error abajo en rojo con su
// explicación (aria-invalid + aria-describedby). El texto de ejemplo nunca hace de etiqueta ni va en mayúsculas.
// Alto 40 px en escritorio / 48 px en celular; texto 15 / 16 px (16 evita el acercamiento automático del iPhone).
//
// <Campo etiqueta="Cantidad" ayuda="En piezas" error={errores.cantidad} requerido>
//   <Entrada type="number" value={cant} onChange={(e) => setCant(e.target.value)} inputMode="numeric" />
// </Campo>
// <Campo etiqueta="Almacén"><Selector value={alm} onChange={(e) => setAlm(e.target.value)} opciones={[{ valor: '1', texto: 'Principal' }]} /></Campo>
// <Campo etiqueta="Proveedor"><SelectorBuscable valor={prov} alCambiar={setProv} opciones={proveedores.map((p) => ({ valor: p.id, texto: p.nombre }))} /></Campo>
// <Campo etiqueta="Notas"><Area rows={3} value={nota} onChange={…} /></Campo>
// <Casilla marcada={sel} alCambiar={setSel} texto="Mostrar inactivos" />
// <Interruptor activo={sonido} alCambiar={setSonido} texto="Sonido de notificaciones" />
//
// Campo: etiqueta, ayuda, error, requerido, id (si no, uno propio), ancho ('auto' | 'completo' | CSS), icono (a la izquierda
// dentro del campo), children (un solo control; recibe id, aria-invalid y aria-describedby). Entrada/Area/Selector: los mismos atributos de <input>/<textarea>/
// <select> (value, onChange…); Selector además opciones [{valor, texto}] y vacio (texto de la opción vacía).
// SelectorBuscable: valor, alCambiar(valor), opciones [{valor, texto, detalle}] (las que la página ya cargó), texto
// (ejemplo), vacio («Ningún proveedor coincide»), deshabilitado. Casilla: marcada, alCambiar(bool), texto, mixta,
// soloCasilla (sin texto visible; usa etiqueta), deshabilitado. Interruptor: activo, alCambiar(bool), texto, deshabilitado.
import { Children, cloneElement, forwardRef, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Minus, Search } from 'lucide-react';
import { clases } from '../formato';

export function Campo({ etiqueta, ayuda, error, requerido = false, id, ancho, icono: Icono, className, children }) {
  const propio = useId();
  const idCampo = id || `r2c${propio.replace(/:/g, '')}`;
  const idAyuda = ayuda ? `${idCampo}-ayuda` : null;
  const idError = error ? `${idCampo}-error` : null;
  const describe = [idError, idAyuda].filter(Boolean).join(' ') || undefined;
  const hijo = Children.only(children);
  const control = isValidElement(hijo)
    ? cloneElement(hijo, { id: hijo.props.id || idCampo, 'aria-invalid': error ? true : hijo.props['aria-invalid'], 'aria-describedby': describe, required: requerido || hijo.props.required })
    : hijo;
  return (
    <div className={clases('r2-campo', className)} style={ancho && ancho !== 'auto' && ancho !== 'completo' ? { maxWidth: ancho } : undefined}>
      {etiqueta && (
        <label className="r2-campo-etiqueta" htmlFor={hijo?.props?.id || idCampo}>
          {etiqueta}{requerido && <span className="r2-campo-requerido" aria-hidden="true"> *</span>}
        </label>
      )}
      {Icono ? (
        <span className="r2-entrada-caja">
          <Icono size={18} aria-hidden="true" className="r2-entrada-icono" />
          {control}
        </span>
      ) : control}
      {error && <p className="r2-campo-error" id={idError}>{error}</p>}
      {ayuda && <p className="r2-campo-ayuda" id={idAyuda}>{ayuda}</p>}
    </div>
  );
}

export const Entrada = forwardRef(function Entrada({ className, ...resto }, ref) {
  return <input ref={ref} className={clases('r2-entrada', className)} {...resto} />;
});

export const Area = forwardRef(function Area({ className, rows = 3, ...resto }, ref) {
  return <textarea ref={ref} rows={rows} className={clases('r2-entrada r2-area', className)} {...resto} />;
});

export const Selector = forwardRef(function Selector({ opciones, vacio, className, children, ...resto }, ref) {
  return (
    <span className="r2-selector-caja">
      <select ref={ref} className={clases('r2-entrada r2-selector', className)} {...resto}>
        {vacio != null && <option value="">{vacio}</option>}
        {opciones ? opciones.map((o) => <option key={String(o.valor)} value={o.valor} disabled={o.deshabilitado}>{o.texto}</option>) : children}
      </select>
      <ChevronDown size={18} aria-hidden="true" className="r2-selector-flecha" />
    </span>
  );
});

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Lista larga con búsqueda (obra, proveedor, encargado). Usa SOLO las opciones que la página ya cargó.
export function SelectorBuscable({ valor, alCambiar, opciones = [], texto = 'Escribe para buscar…', vacio = 'Nada coincide', deshabilitado = false, id, className, ...aria }) {
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState('');
  const [activo, setActivo] = useState(0);
  const caja = useRef(null);
  const lista = useRef(null);
  const propio = useId();
  const idLista = `r2sb${propio.replace(/:/g, '')}`;
  const elegida = opciones.find((o) => String(o.valor) === String(valor));
  const filtradas = useMemo(() => {
    const q = norm(busca).trim();
    return q ? opciones.filter((o) => norm(`${o.texto} ${o.detalle || ''}`).includes(q)) : opciones;
  }, [busca, opciones]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!caja.current?.contains(e.target)) { setAbierto(false); setBusca(''); } };
    document.addEventListener('pointerdown', fuera, true);
    return () => document.removeEventListener('pointerdown', fuera, true);
  }, [abierto]);
  useEffect(() => { lista.current?.querySelector('[data-activa]')?.scrollIntoView({ block: 'nearest' }); }, [activo]);

  const elegir = (o) => { alCambiar?.(o.valor); setAbierto(false); setBusca(''); };
  const teclas = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo((i) => Math.min(i + 1, filtradas.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && abierto && filtradas[activo]) { e.preventDefault(); elegir(filtradas[activo]); }
    else if (e.key === 'Escape' && abierto) { e.preventDefault(); e.stopPropagation(); setAbierto(false); setBusca(''); }
  };
  return (
    <div ref={caja} className={clases('r2-buscable', className)}>
      <Search size={18} aria-hidden="true" className="r2-buscable-lupa" />
      <input id={id} type="text" role="combobox" className="r2-entrada r2-buscable-campo" autoComplete="off" disabled={deshabilitado}
        aria-expanded={abierto} aria-controls={idLista} aria-autocomplete="list" {...aria}
        value={abierto ? busca : (elegida?.texto ?? '')} placeholder={elegida ? elegida.texto : texto}
        onFocus={() => { setAbierto(true); setActivo(0); }} onChange={(e) => { setBusca(e.target.value); setAbierto(true); setActivo(0); }}
        onKeyDown={teclas} />
      <ChevronDown size={18} aria-hidden="true" className="r2-selector-flecha" />
      {abierto && (
        <ul ref={lista} id={idLista} role="listbox" className="r2-buscable-lista">
          {filtradas.length === 0 && <li className="r2-buscable-vacio">{vacio}</li>}
          {filtradas.slice(0, 200).map((o, i) => (
            <li key={String(o.valor)} role="option" aria-selected={String(o.valor) === String(valor)} data-activa={i === activo ? '' : undefined}
              className={clases('r2-buscable-opcion', i === activo && 'r2-buscable-opcion--activa')}
              onPointerDown={(e) => e.preventDefault()} onClick={() => elegir(o)}>
              <span>{o.texto}</span>
              {o.detalle && <small>{o.detalle}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Casilla({ marcada = false, alCambiar, texto, etiqueta, mixta = false, soloCasilla = false, deshabilitado = false, className }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = Boolean(mixta); }, [mixta]);
  return (
    <label className={clases('r2-casilla', soloCasilla && 'r2-casilla--sola', deshabilitado && 'r2-casilla--apagada', className)} onClick={(e) => e.stopPropagation()}>
      <input ref={ref} type="checkbox" checked={Boolean(marcada)} disabled={deshabilitado} aria-label={soloCasilla ? (etiqueta || texto) : undefined}
        onChange={(e) => alCambiar?.(e.target.checked)} />
      <span className="r2-casilla-dibujo" aria-hidden="true">
        {mixta ? <Minus size={14} strokeWidth={3} /> : marcada ? <Check size={14} strokeWidth={3} /> : null}
      </span>
      {!soloCasilla && texto && <span className="r2-casilla-texto">{texto}</span>}
    </label>
  );
}

export function Interruptor({ activo = false, alCambiar, texto, etiqueta, deshabilitado = false, className }) {
  return (
    <label className={clases('r2-interruptor', deshabilitado && 'r2-casilla--apagada', className)}>
      {texto && <span className="r2-interruptor-texto">{texto}</span>}
      <input type="checkbox" role="switch" checked={Boolean(activo)} disabled={deshabilitado} aria-label={!texto ? etiqueta : undefined}
        onChange={(e) => alCambiar?.(e.target.checked)} />
      <span className="r2-interruptor-dibujo" aria-hidden="true" />
    </label>
  );
}
