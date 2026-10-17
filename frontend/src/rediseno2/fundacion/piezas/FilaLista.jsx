// Rediseño 2 · renglón de dos líneas (DISENO-v2 §4.5): para celular y para listas que no son tabla (avisos, notificaciones,
// la lista de la terminal en celular). Todo el renglón es un solo objetivo táctil (mín. 64 px). Va dentro de <Lista>.
//
// <Lista etiqueta="Órdenes">
//   <FilaLista principal="OC-1180" secundario="Aceros y Tensores del Bajío" derecha={dinero(1184424)}
//     debajoDerecha={<Estado dominio="orden" valor="pendiente_aprobacion" />} alAbrir={() => abrir(o)} />
// </Lista>
//
// FilaLista: inicio (casilla, <Miniatura/> de 40 px o nada), principal (16 px seminegrita), secundario (15 px, se corta con
// «…»), derecha (el dato clave a la derecha: número, plazo o importe), debajoDerecha (debajo: el estado), accion (nodo de
// 44 px; si no hay y el renglón abre, se pinta «›»), alAbrir | href, seleccionada, etiqueta (lectores).
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { clases } from '../formato';

export function Lista({ etiqueta, children, className }) {
  return <ul className={clases('r2-lista', className)} aria-label={etiqueta}>{children}</ul>;
}

export function GrupoLista({ titulo, cuenta, children }) {
  return (
    <li className="r2-lista-grupo">
      <div className="r2-lista-grupo-titulo">{titulo}{cuenta != null && <span className="r2-grupo-cuenta"> · {cuenta}</span>}</div>
      <ul className="r2-lista">{children}</ul>
    </li>
  );
}

export function FilaLista({ inicio, principal, secundario, derecha, debajoDerecha, accion, alAbrir, href, seleccionada = false, etiqueta, className }) {
  const abre = Boolean(alAbrir || href);
  const cuerpo = (
    <>
      <span className="r2-fila-lineas">
        <span className="r2-fila-principal">{principal}</span>
        {secundario && <span className="r2-fila-secundario">{secundario}</span>}
      </span>
      {(derecha || debajoDerecha) && (
        <span className="r2-fila-derecha">
          {derecha && <span className="r2-fila-dato">{derecha}</span>}
          {debajoDerecha && <span className="r2-fila-debajo">{debajoDerecha}</span>}
        </span>
      )}
      {abre && !accion && <ChevronRight size={20} aria-hidden="true" className="r2-fila-flecha" />}
    </>
  );
  return (
    <li className={clases('r2-fila', seleccionada && 'r2-fila--elegida', abre && 'r2-fila--abre', className)}>
      {inicio && <span className="r2-fila-inicio">{inicio}</span>}
      {href ? (
        <Link to={href} className="r2-fila-objetivo" aria-label={etiqueta}>{cuerpo}</Link>
      ) : alAbrir ? (
        <button type="button" className="r2-fila-objetivo" onClick={alAbrir} aria-label={etiqueta}>{cuerpo}</button>
      ) : (
        <span className="r2-fila-objetivo">{cuerpo}</span>
      )}
      {accion && <span className="r2-fila-accion">{accion}</span>}
    </li>
  );
}
