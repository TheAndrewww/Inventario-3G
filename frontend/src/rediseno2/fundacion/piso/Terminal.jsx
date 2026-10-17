// Rediseño 2 · piezas de la terminal de las áreas (DISENO-v2 §3.6 y §4.16). Tableta de 10–13" usada de pie, a 50–70 cm,
// con guantes: objetivos de 64–80 px, separación mínima de 16 px (48 px entre «Terminar» y cualquier otro botón), fondo
// claro por omisión. Ninguna pieza pide nada: llaman a los manejadores de la página.
//
// <MarcoTerminal area={AREAS.manufactura} dato="20 obras pendientes" hora={hora} alActualizar={() => cargarProyectos(true)}
//   actualizando={cargando} tema={useTemaPiso('terminal')}>
//   <div className="r2-terminal-dos">                         (lista 40 % + ficha 60 % en horizontal)
//     <ul className="r2-terminal-lista">
//       <FilaPiso principal="FAM. ARIZMENDI VALLE" secundario="Fam. Arizmendi Valle" plazo={<Plazo fecha={p.fecha} />}
//         derecha="2 planos" elegida={p.id === elegida} alElegir={() => setElegida(p.id)} />
//     </ul>
//     <section className="r2-terminal-ficha">
//       <BotonPiso icono={FileText} alHacer={() => setPlano(a)}>Patrones de corte</BotonPiso>
//       <BotonTerminar texto="Terminar manufactura de esta obra" confirmacion="Toca otra vez para terminar Manufactura de FAM. ARIZMENDI VALLE"
//         alTerminar={() => completar(p.id)} cargando={completando} />
//     </section>
//   </div>
// </MarcoTerminal>
// <CampoCodigo valor={codigo} alCambiar={setCodigo} ayuda="3 letras, guion, 3 letras, guion, 2 números" error={error} />
// <VisorPlano planos={[{ id, nombre: 'Patrones de corte', src: embedLink }]} elegido={id} alElegir={setId} alCerrar={cerrar} />
//
// MarcoTerminal: area ({nombre, color}), dato, hora ({hora, viejo}), alActualizar, actualizando, tema, encabezado (false en
// la pantalla del código: sin barra del área), pie, children. Clases de acomodo para la pantalla: r2-terminal-dos (lista 40 %
// + ficha 60 %), r2-terminal-columna-lista, r2-terminal-lista, r2-terminal-ficha (pegada a la vista), r2-terminal-ficha-titulo,
// r2-terminal-ficha-dato, r2-terminal-etiqueta, r2-terminal-planos, r2-terminal-separador (48 px antes de «Terminar»).
// FilaPiso: principal (22 px), secundario (18 px), plazo (nodo), derecha, elegida, alElegir. Renglón de 88 px.
// BotonPiso: children, icono, alHacer, nivel ('tonal' | 'contorno' | 'principal' | 'fantasma'), alto (64 | 80), anchoCompleto,
// deshabilitado, motivo, cargando. BotonTerminar: texto, confirmacion (texto del primer toque), alTerminar (el MISMO
// manejador de hoy), toques (2; con 1 es un botón normal: anexo A, 2), segundos (4), cargando, deshabilitado, motivo.
// CampoCodigo: valor, alCambiar(texto), etiqueta, ayuda, error, alEnviar, autoFoco, id.
// VisorPlano: planos [{id, nombre, src}], elegido, alElegir(id), alCerrar, obra (nombre de la obra arriba de los planos).
// Pantalla completa, pestañas entre planos.
import { useEffect, useId, useRef, useState } from 'react';
import { RotateCw, X, Check } from 'lucide-react';
import { HoraDeDatos } from './Tv';
import { useCapa } from '../useCapa';
import { clases } from '../formato';

export function MarcoTerminal({ area, dato, hora, alActualizar, actualizando = false, tema = 'claro', encabezado = true, pie, children, className }) {
  return (
    <div className={clases('r2-piso r2-terminal', className)} data-tema={tema}>
      {encabezado && <header className="r2-terminal-encabezado">
        <span className="r2-piso-punto" style={area?.color ? { background: area.color } : undefined} aria-hidden="true" />
        <h1 className="r2-terminal-area">{area?.nombre || 'Terminal de producción'}</h1>
        {dato && <span className="r2-terminal-dato">{dato}</span>}
        <span className="r2-terminal-derecha">
          {hora && <HoraDeDatos {...hora} />}
          {alActualizar && (
            <BotonPiso icono={RotateCw} nivel="contorno" alHacer={alActualizar} cargando={actualizando}>Actualizar</BotonPiso>
          )}
        </span>
      </header>}
      <main className="r2-terminal-cuerpo">{children}</main>
      {pie && <footer className="r2-terminal-pie">{pie}</footer>}
    </div>
  );
}

export function FilaPiso({ principal, secundario, plazo, derecha, elegida = false, alElegir, className }) {
  return (
    <li className={clases('r2-fila-piso', elegida && 'r2-fila-piso--elegida', className)}>
      <button type="button" className="r2-fila-piso-objetivo" onClick={alElegir} aria-current={elegida ? 'true' : undefined}>
        <span className="r2-fila-piso-lineas">
          <span className="r2-fila-piso-principal">{principal}</span>
          {secundario && <span className="r2-fila-piso-secundario">{secundario}</span>}
          {plazo && <span className="r2-fila-piso-plazo">{plazo}</span>}
        </span>
        {derecha && <span className="r2-fila-piso-derecha">{derecha}</span>}
      </button>
    </li>
  );
}

export function BotonPiso({ children, icono: Icono, alHacer, nivel = 'tonal', alto = 64, anchoCompleto = false, deshabilitado = false, motivo, cargando = false, className, ...resto }) {
  return (
    <button type="button" className={clases('r2-boton-piso', `r2-boton-piso--${nivel}`, alto === 80 && 'r2-boton-piso--alto', anchoCompleto && 'r2-boton-piso--ancho', className)}
      onClick={alHacer} disabled={deshabilitado || undefined} aria-busy={cargando || undefined} title={deshabilitado && motivo ? motivo : undefined} {...resto}>
      {Icono && <Icono size={24} aria-hidden="true" className={cargando ? 'r2-girando' : undefined} />}
      <span>{children}</span>
    </button>
  );
}

// «Terminar» con dos toques (anexo A, 2): el primero lo «arma» por 4 s con cuenta regresiva visible; el segundo llama al
// MISMO manejador de hoy. Si pasan los 4 s, se desarma solo.
export function BotonTerminar({ texto, confirmacion, alTerminar, toques = 2, segundos = 4, cargando = false, deshabilitado = false, motivo, className }) {
  const [armado, setArmado] = useState(false);
  const [quedan, setQuedan] = useState(segundos);
  useEffect(() => {
    if (!armado) return undefined;
    const fin = Date.now() + segundos * 1000;
    setQuedan(segundos);
    const reloj = window.setInterval(() => {
      const q = Math.ceil((fin - Date.now()) / 1000);
      if (q <= 0) setArmado(false); else setQuedan(q);
    }, 250);
    return () => window.clearInterval(reloj);
  }, [armado, segundos]);

  const tocar = () => {
    if (cargando || deshabilitado) return;
    if (toques <= 1 || armado) { setArmado(false); alTerminar?.(); return; }
    setArmado(true);
  };
  return (
    <div className={clases('r2-terminar', className)}>
      <button type="button" className={clases('r2-boton-terminar', armado && 'r2-boton-terminar--armado')} onClick={tocar}
        disabled={deshabilitado || undefined} aria-busy={cargando || undefined} title={deshabilitado && motivo ? motivo : undefined}>
        <Check size={28} aria-hidden="true" />
        <span>{armado ? (confirmacion || `Toca otra vez para confirmar`) : texto}</span>
        {armado && <span className="r2-terminar-cuenta" aria-hidden="true">{quedan}</span>}
      </button>
      <p className="r2-terminar-ayuda" role="status" aria-live="polite">
        {armado ? `Se cancela solo en ${quedan} s si no tocas otra vez.` : (deshabilitado && motivo ? motivo : '')}
      </p>
    </div>
  );
}

export function CampoCodigo({ valor = '', alCambiar, etiqueta = 'Código del área', ayuda, error, alEnviar, autoFoco = true, id, className }) {
  const propio = useId();
  const idc = id || `r2cod${propio.replace(/:/g, '')}`;
  return (
    <div className={clases('r2-campo-codigo', className)}>
      <label htmlFor={idc} className="r2-campo-codigo-etiqueta">{etiqueta}</label>
      <input id={idc} type="text" className="r2-campo-codigo-entrada" value={valor} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        autoFocus={autoFoco} aria-invalid={error ? true : undefined} aria-describedby={[error && `${idc}-e`, ayuda && `${idc}-a`].filter(Boolean).join(' ') || undefined}
        onChange={(e) => alCambiar?.(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') alEnviar?.(); }} />
      {ayuda && <p id={`${idc}-a`} className="r2-campo-codigo-ayuda">{ayuda}</p>}
      {error && <p id={`${idc}-e`} className="r2-campo-codigo-error" role="alert">{error}</p>}
    </div>
  );
}

export function VisorPlano({ planos = [], elegido, alElegir, alCerrar, obra, tema = 'claro' }) {
  const ref = useRef(null);
  useCapa({ abierta: true, ref, alCerrar });
  const actual = planos.find((p) => p.id === elegido) || planos[0];
  return (
    <div ref={ref} className="r2-piso r2-visor-plano" data-tema={tema} role="dialog" aria-modal="true" aria-label={[obra, actual?.nombre || 'Plano'].filter(Boolean).join(': ')}>
      <div className="r2-visor-plano-cab">
        {obra && <p className="r2-visor-plano-obra">{obra}</p>}
        {planos.length > 1 ? (
          <div className="r2-visor-plano-pestanas" role="tablist" aria-label="Planos de la obra">
            {planos.map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={p.id === actual?.id} className="r2-visor-plano-pestana" onClick={() => alElegir?.(p.id)}>
                {p.nombre}
              </button>
            ))}
          </div>
        ) : <h2 className="r2-visor-plano-titulo">{actual?.nombre}</h2>}
        <BotonPiso icono={X} nivel="contorno" alHacer={alCerrar} data-r2-foco="">Cerrar plano</BotonPiso>
      </div>
      {actual && <iframe key={actual.id} className="r2-visor-plano-marco" src={actual.src} title={actual.nombre} allow="autoplay" />}
    </div>
  );
}
