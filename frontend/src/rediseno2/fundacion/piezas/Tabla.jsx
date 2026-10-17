// Rediseño 2 · tabla (DISENO-v2 §4.4): la lista de trabajo de casi todas las pantallas. Una <table> real, sin caja propia ni
// barra interna: se desplaza la página y la cabecera se pega arriba (top: var(--r2-tope)). Todo el renglón abre el detalle
// (la primera celda lleva un <button> real para el teclado). Números a la derecha y tabulares. En celular (≤ 720 px) cada
// renglón se pinta con <FilaLista> usando filaCelular(fila).
//
// <Tabla etiqueta="Órdenes de compra" clave="id"
//   columnas={[
//     { id: 'folio', titulo: 'Folio', celda: (o) => o.folio, ordenable: true },
//     { id: 'proveedor', titulo: 'Proveedor', celda: (o) => o.proveedor?.nombre },
//     { id: 'creo', titulo: 'Creada por', celda: (o) => o.creador?.nombre, ocultarEn: 'tableta' },
//     { id: 'total', titulo: 'Total', alinear: 'der', celda: (o) => dinero(o.total) },
//     { id: 'estado', titulo: 'Estado', celda: (o) => <Estado dominio="orden" valor={o.estado} /> },
//     { id: 'fecha', titulo: 'Fecha', celda: (o) => <Fecha valor={o.created_at} /> },
//   ]}
//   grupos={[{ id: 'aprobar', titulo: 'Por aprobar', filas: porAprobar }, { id: 'resto', titulo: 'Enviadas', filas: enviadas }]}
//   alAbrir={(o) => setOrden(o)} seleccionada={orden?.id}
//   accion={(o) => o.estado === 'pendiente_aprobacion' && <Boton nivel="tonal" tamano="chico" alHacer={() => aprobar(o)}>Aprobar</Boton>}
//   masAcciones={(o) => [{ texto: 'Descargar PDF', alHacer: () => pdf(o) }, { texto: 'Anular', peligro: true, alHacer: () => anular(o) }]}
//   filaCelular={(o) => ({ principal: o.folio, secundario: o.proveedor?.nombre, derecha: dinero(o.total), debajo: <Estado … /> })}
//   cargando={cargando} error={error && { mensaje: 'No se pudo cargar la lista de órdenes.', motivo: error, alReintentar: cargar }}
//   vacio={{ titulo: 'No hay órdenes', texto: 'Las órdenes que se creen aparecerán aquí.' }} />
//
// Props: columnas [{id, titulo, alinear ('izq'|'der'|'centro'), ancho (CSS), ocultarEn ('tableta' ≤ 1200 | 'celular-ancho'
// ≤ 860), celda(fila), ordenable, sinBoton (la celda ya trae sus propios controles)}], filas | grupos [{id, titulo, filas,
// plegado, nota}], clave ('id' o función), densidad ('comoda' | 'compacta'; por omisión la de la Pagina), alAbrir(fila),
// etiquetaAbrir(fila), accion(fila) (una sola acción visible), masAcciones(fila) (lista de MenuAcciones), seleccion
// {elegidas (lista de claves), alCambiar(lista), etiqueta(fila)}, seleccionada (clave del renglón abierto), filaCelular(fila)
// → {inicio, principal, secundario, derecha, debajo}, cargando, error ({mensaje, motivo, alReintentar}), vacio (nodo o
// {titulo, texto, accion}), orden {columna, direccion: 'asc'|'desc'}, alOrdenar(idColumna), fija (cabecera pegada, true),
// nombreFila(fila) (de qué renglón es el «⋯» para lectores: «Más acciones: OC-1180»; si no, el texto de la primera columna).
import { Children, isValidElement, useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { MenuAcciones } from './MenuAcciones';
import { Lista, FilaLista } from './FilaLista';
import { Cargando, Vacio, ErrorCarga } from './Estados';
import { Casilla } from './Campos';
import { usePagina } from '../contexto';
import { useEsCelular } from '../useDiseno3G';
import { clases } from '../formato';

const INTERACTIVOS = 'button, a, input, select, textarea, label, [role="menu"], [role="menuitem"], [data-r2-no-abrir]';
// Texto plano de una celda sencilla (cadena, número o JSX con texto adentro); null si no se puede saber sin pintarla
const textoDe = (nodo, n = 0) => {
  if (nodo == null || typeof nodo === 'boolean' || n > 6) return '';
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return nodo.map((x) => textoDe(x, n + 1)).join(' ');
  if (isValidElement(nodo)) return Children.toArray(nodo.props?.children).map((x) => textoDe(x, n + 1)).join(' ');
  return '';
};
const nombreDe = (nombreFila, columnas, f) => {
  const t = (nombreFila ? nombreFila(f) : textoDe(columnas[0]?.celda ? columnas[0].celda(f) : f?.[columnas[0]?.id])) || '';
  const limpio = String(t).replace(/\s+/g, ' ').trim();
  return limpio || undefined;
};
const claveDe = (clave, fila, i) => (typeof clave === 'function' ? clave(fila, i) : fila?.[clave] ?? i);

function vacioNodo(vacio) {
  if (!vacio) return <Vacio titulo="No hay registros" />;
  if (vacio.titulo || vacio.texto || vacio.sinResultados) return <Vacio {...vacio} />;
  return vacio;
}

export function Tabla({
  columnas = [], filas, grupos, clave = 'id', densidad, alAbrir, etiquetaAbrir, accion, masAcciones, seleccion,
  seleccionada, filaCelular, cargando = false, error, vacio, orden, alOrdenar, fija = true, etiqueta, nombreFila, className,
}) {
  const pagina = usePagina();
  const celular = useEsCelular();
  const [plegados, setPlegados] = useState(() => new Set((grupos || []).filter((g) => g.plegado).map((g) => g.id)));
  const dens = densidad || pagina?.densidad || 'comoda';
  const listaGrupos = (grupos ? grupos : [{ id: '_', titulo: null, filas: filas || [] }]).filter((g) => (g.filas || []).length);
  const total = listaGrupos.reduce((n, g) => n + g.filas.length, 0);
  const elegidas = new Set(seleccion?.elegidas || []);
  const hayAcciones = Boolean(accion || masAcciones);

  if (error && !total) return <ErrorCarga {...error} />;
  if (cargando && !total) {
    return <Cargando forma={celular ? 'lista' : 'tabla'} columnas={columnas.map((c, i) => (i === 0 ? 2 : 1))} filas={8} etiqueta={etiqueta ? `Cargando ${etiqueta.toLowerCase()}…` : 'Cargando…'} />;
  }
  if (!total) return <div className="r2-tabla-vacia">{vacioNodo(vacio)}</div>;

  const alternarGrupo = (id) => setPlegados((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarFila = (k) => {
    const n = new Set(elegidas);
    if (n.has(k)) n.delete(k); else n.add(k);
    seleccion.alCambiar([...n]);
  };
  const todasLasClaves = listaGrupos.flatMap((g) => g.filas.map((f, i) => claveDe(clave, f, i)));
  const todasElegidas = todasLasClaves.length > 0 && todasLasClaves.every((k) => elegidas.has(k));
  const algunas = !todasElegidas && todasLasClaves.some((k) => elegidas.has(k));

  // ───── Celular: renglones de dos líneas ─────
  if (celular) {
    const fila = (f, i) => {
      const k = claveDe(clave, f, i);
      const c = filaCelular ? filaCelular(f) : {
        principal: columnas[0]?.celda(f), secundario: columnas[1]?.celda(f),
        derecha: columnas.find((col, j) => j > 1 && col.alinear === 'der')?.celda(f),
      };
      const unaAccion = accion?.(f);
      const otras = masAcciones?.(f);
      return (
        <FilaLista key={k} seleccionada={k === seleccionada || elegidas.has(k)}
          inicio={seleccion ? <Casilla marcada={elegidas.has(k)} alCambiar={() => alternarFila(k)} etiqueta={seleccion.etiqueta?.(f) || 'Elegir'} soloCasilla /> : c.inicio}
          principal={c.principal} secundario={c.secundario} derecha={c.derecha} debajoDerecha={c.debajo}
          alAbrir={alAbrir ? () => alAbrir(f) : undefined} etiqueta={etiquetaAbrir?.(f)}
          accion={(unaAccion || (otras && otras.filter(Boolean).length)) ? (
            <>{unaAccion}{otras && <MenuAcciones acciones={otras} titulo={nombreFila ? nombreDe(nombreFila, columnas, f) : (textoDe(c.principal).trim() || undefined)} />}</>
          ) : null} />
      );
    };
    return (
      <div className={clases('r2-tabla-celular', className)}>
        {listaGrupos.map((g) => (g.titulo ? (
          <section key={g.id} className="r2-lista-seccion">
            <button type="button" className="r2-grupo-boton r2-grupo-boton--celular" aria-expanded={!plegados.has(g.id)} onClick={() => alternarGrupo(g.id)}>
              {plegados.has(g.id) ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
              <span>{g.titulo}</span><span className="r2-grupo-cuenta">{g.filas.length}</span>
            </button>
            {g.nota && !plegados.has(g.id) && <p className="r2-grupo-nota">{g.nota}</p>}
            {!plegados.has(g.id) && <Lista etiqueta={g.titulo}>{g.filas.map(fila)}</Lista>}
          </section>
        ) : <Lista key={g.id} etiqueta={etiqueta}>{g.filas.map(fila)}</Lista>))}
      </div>
    );
  }

  // ───── Escritorio y tableta: tabla real ─────
  const nCols = columnas.length + (seleccion ? 1 : 0) + (hayAcciones ? 1 : 0);
  const clsCol = (c) => clases(
    c.alinear === 'der' && 'r2-der', c.alinear === 'centro' && 'r2-centro',
    c.ocultarEn === 'tableta' && 'r2-ocultar-tableta', c.ocultarEn === 'celular-ancho' && 'r2-ocultar-celular-ancho',
  );
  const indiceAbrir = columnas.findIndex((c) => !c.sinBoton);

  const renglon = (f, i) => {
    const k = claveDe(clave, f, i);
    const abrir = alAbrir ? (e) => {
      if (e.target.closest(INTERACTIVOS) && !e.target.closest('.r2-celda-abrir')) return;
      if (window.getSelection?.().toString()) return; // estaba seleccionando texto
      alAbrir(f);
    } : undefined;
    const otras = masAcciones?.(f);
    return (
      <tr key={k} className={clases('r2-renglon', alAbrir && 'r2-renglon--abre', (k === seleccionada) && 'r2-renglon--abierto', elegidas.has(k) && 'r2-renglon--elegido')}
        onClick={abrir}>
        {seleccion && (
          <td className="r2-celda-casilla">
            <Casilla marcada={elegidas.has(k)} alCambiar={() => alternarFila(k)} etiqueta={seleccion.etiqueta?.(f) || 'Elegir renglón'} soloCasilla />
          </td>
        )}
        {columnas.map((c, j) => {
          const contenido = c.celda ? c.celda(f) : f?.[c.id];
          return (
            <td key={c.id} className={clsCol(c)}>
              {alAbrir && j === indiceAbrir ? (
                <button type="button" className="r2-celda-abrir" onClick={(e) => { e.stopPropagation(); alAbrir(f); }}
                  aria-label={etiquetaAbrir?.(f)}>
                  {contenido}
                </button>
              ) : contenido}
            </td>
          );
        })}
        {hayAcciones && (
          <td className="r2-celda-acciones">
            <span className="r2-celda-acciones-dentro">
              {accion?.(f)}
              {otras && <MenuAcciones acciones={otras} tamano="chico" titulo={nombreDe(nombreFila, columnas, f)} />}
            </span>
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className={clases('r2-tabla-marco', className)}>
      <table className={clases('r2-tabla', `r2-tabla--${dens}`, fija && 'r2-tabla--fija')} aria-label={etiqueta}>
        <colgroup>
          {seleccion && <col style={{ width: 52 }} />}
          {columnas.map((c) => <col key={c.id} className={clsCol(c)} style={c.ancho ? { width: c.ancho } : undefined} />)}
          {hayAcciones && <col style={{ width: 1 }} />}
        </colgroup>
        <thead>
          <tr>
            {seleccion && (
              <th scope="col" className="r2-celda-casilla">
                <Casilla marcada={todasElegidas} mixta={algunas} soloCasilla etiqueta={todasElegidas ? 'Quitar todos' : 'Elegir todos'}
                  alCambiar={() => seleccion.alCambiar(todasElegidas ? [] : todasLasClaves)} />
              </th>
            )}
            {columnas.map((c) => {
              const activa = orden?.columna === c.id;
              const sort = activa ? (orden.direccion === 'desc' ? 'descending' : 'ascending') : undefined;
              return (
                <th key={c.id} scope="col" className={clsCol(c)} aria-sort={c.ordenable ? (sort || 'none') : undefined}>
                  {c.ordenable && alOrdenar ? (
                    <button type="button" className="r2-ordenar" onClick={() => alOrdenar(c.id)}>
                      {c.titulo}
                      {activa ? (orden.direccion === 'desc' ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" />)
                        : <ArrowUpDown size={14} aria-hidden="true" className="r2-ordenar-tenue" />}
                    </button>
                  ) : c.titulo}
                </th>
              );
            })}
            {hayAcciones && <th scope="col" className="r2-celda-acciones"><span className="r2-solo-lectores">Acciones</span></th>}
          </tr>
        </thead>
        {listaGrupos.map((g) => (
          <tbody key={g.id}>
            {g.titulo && (
              <tr className="r2-grupo">
                <th colSpan={nCols} scope="rowgroup">
                  <button type="button" className="r2-grupo-boton" aria-expanded={!plegados.has(g.id)} onClick={() => alternarGrupo(g.id)}>
                    {plegados.has(g.id) ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                    <span>{g.titulo}</span><span className="r2-grupo-cuenta">{g.filas.length}</span>
                  </button>
                  {g.nota && <span className="r2-grupo-nota">{g.nota}</span>}
                </th>
              </tr>
            )}
            {!plegados.has(g.id) && g.filas.map(renglon)}
          </tbody>
        ))}
      </table>
    </div>
  );
}
