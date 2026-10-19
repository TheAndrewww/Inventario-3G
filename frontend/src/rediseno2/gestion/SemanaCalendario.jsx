// Rediseño 2 · Gestión · pieza compartida SemanaCalendario (DISENO-v2 §5.6; el Calendario público de `publicas` la usa tal
// cual). Pinta días que la página YA cargó (ver calendario.js → armarDias / diasDeRango); no pide nada.
//
// <SemanaCalendario variante="oficina" dias={diasDeRango(mapa, lunesDe(hoy), 7)} hoy={new Date()}
//   alAbrir={(proyecto, dia) => setProyectoSeleccionado({ proyecto, dia: dia.numero, mes: dia.mesTab })}
//   colorDeEquipo={(equipoHora) => 'rgb(…)'} filtro={(p) => true} />
//
// Variantes:
//  - 'oficina' (escritorio y tableta): 7 columnas a lo ancho; hoy resaltado; cada obra es un bloque con hora, equipo (punto
//    de su color + NOMBRE), obra en 2–3 renglones, cliente solo si es distinto, tipo (mantenimiento o garantía) y la falla con
//    su motivo. Tocar una obra la abre (alAbrir).
//  - 'celular' (encargados en obra): agenda por día («Hoy · viernes 16 oct»), una obra por renglón con la hora a la izquierda.
//  - 'tv' (pantalla completa y calendario público): 7 columnas de lejos, letra de 22 px o más; sin nada que tocar si no hay
//    alAbrir. La escala − / + la pone el marco (--r2-escala).
// Props: variante, dias [{clave, fecha, numero, nombre, mesTab, proyectos, asueto, sinDatos}], hoy (Date), alAbrir(p, dia)
// (opcional), colorDeEquipo(equipoHora) → color CSS o null (si no, el de la hoja: proyecto.colorHora), filtro(p) → bool,
// textoVacio (día sin obras), etiqueta (lectores).
import { AlertTriangle } from 'lucide-react';
import { TipoTrabajo } from '../fundacion/piezas/Estado';
import { clases } from '../fundacion/formato';
import { colorRgb, mismoTexto, nombreEquipo } from './comunes';
import { diaCorto, diaLargo, diaSemanaCorto, minutosDe, mismoDia, relativoDia } from './calendario';
import './gestion.css';

const TIPOS_CON_ETIQUETA = ['MANTENIMIENTO', 'GARANTIA', 'GARANTÍA'];
// TV de 1080 px: caben 5 obras con su cliente; con más, se aprietan (sin cliente) y caben 6 + «y N obras más»
const TV_CABEN = 5;
const TV_CABEN_APRETADO = 6;

function Equipo({ p, colorDeEquipo }) {
  if (p.equipoHora === 'FALLA' || !p.equipoHora) return null;
  const color = colorDeEquipo?.(p.equipoHora) || colorRgb(p.colorHora);
  return (
    <span className="r2g-equipo">
      <span className="r2g-punto" style={color ? { background: color } : undefined} aria-hidden="true" />
      {nombreEquipo(p.equipoHora)}
    </span>
  );
}

function Falla({ p }) {
  if (p.equipoHora !== 'FALLA') return p.nota ? <span className="r2g-obra-nota">{p.nota}</span> : null;
  return (
    <span className="r2g-falla">
      <AlertTriangle size={14} aria-hidden="true" />
      <span><b>Falla</b>{p.nota ? `: ${p.nota}` : ''}</span>
    </span>
  );
}

function Obra({ p, dia, alAbrir, colorDeEquipo, variante }) {
  const cliente = p.cliente && !mismoTexto(p.cliente, p.nombre) ? p.cliente : null;
  const tipo = TIPOS_CON_ETIQUETA.includes(String(p.tipoProyecto || '').toUpperCase()) ? <TipoTrabajo tipo={p.tipoProyecto} /> : null;
  const falla = p.equipoHora === 'FALLA';
  // Taller: lo de producción abre ventas y producción; un pedido de almacén abre su orden (sinAbrir: el rol no ve órdenes)
  if (p.sinAbrir) alAbrir = undefined;
  const Como = alAbrir ? 'button' : 'div';
  const accesible = [p.hora, p.nombre, cliente, falla ? 'falla' : nombreEquipo(p.equipoHora)].filter(Boolean).join(', ');

  if (variante === 'celular') {
    return (
      <li>
        <Como type={alAbrir ? 'button' : undefined} className={clases('r2g-agenda-obra', falla && 'r2g-obra--falla')}
          onClick={alAbrir ? () => alAbrir(p, dia) : undefined} title={alAbrir ? 'Ver la carpeta de ventas de este proyecto' : undefined}
          aria-label={alAbrir ? `${accesible}. Ver la carpeta de ventas` : undefined}>
          <span className="r2g-agenda-hora">{p.hora || '—'}</span>
          <span className="r2g-agenda-cuerpo">
            <span className="r2g-obra-nombre">{p.nombre}</span>
            {cliente && <span className="r2g-obra-cliente">{cliente}</span>}
            {p.etiqueta && <span className="r2g-obra-etiqueta">{p.etiqueta}</span>}
            <span className="r2g-obra-pie">
              <Equipo p={p} colorDeEquipo={colorDeEquipo} />
              {tipo}
            </span>
            <Falla p={p} />
          </span>
        </Como>
      </li>
    );
  }

  const color = !falla && (colorDeEquipo?.(p.equipoHora) || colorRgb(p.colorHora));
  return (
    <li>
      <Como type={alAbrir ? 'button' : undefined} className={clases('r2g-obra', falla && 'r2g-obra--falla')}
        style={color ? { '--r2g-color': color } : undefined}
        onClick={alAbrir ? () => alAbrir(p, dia) : undefined} title={alAbrir ? 'Ver la carpeta de ventas de este proyecto' : undefined}
        aria-label={alAbrir ? `${accesible}. Ver la carpeta de ventas` : undefined}>
        <span className="r2g-obra-cab">
          {p.hora && <span className="r2g-obra-hora">{p.hora}</span>}
          <Equipo p={p} colorDeEquipo={colorDeEquipo} />
        </span>
        <span className="r2g-obra-nombre">{p.nombre}</span>
        {cliente && <span className="r2g-obra-cliente">{cliente}</span>}
        {p.etiqueta && <span className="r2g-obra-etiqueta">{p.etiqueta}</span>}
        {tipo && <span className="r2g-obra-tipo">{tipo}</span>}
        <Falla p={p} />
      </Como>
    </li>
  );
}

const ordenar = (lista) => lista.map((p, i) => ({ p, i })).sort((a, b) => minutosDe(a.p.hora) - minutosDe(b.p.hora) || a.i - b.i).map((x) => x.p);

export default function SemanaCalendario({
  variante = 'oficina', dias = [], hoy = new Date(), alAbrir, colorDeEquipo, filtro, textoVacio = 'Sin obras', etiqueta = 'Obras de la semana', className,
}) {
  const visibles = (d) => ordenar((d.proyectos || []).filter((p) => (filtro ? filtro(p) : true)));

  if (variante === 'celular') {
    return (
      <div className={clases('r2g-agenda', className)} aria-label={etiqueta}>
        {dias.map((d) => {
          const obras = visibles(d);
          const rel = relativoDia(d.fecha, hoy);
          const esHoy = mismoDia(d.fecha, hoy);
          return (
            <section key={d.clave} className={clases('r2g-agenda-dia', esHoy && 'r2g-agenda-dia--hoy')} aria-labelledby={`r2g-dia-${d.clave}`}>
              <h3 id={`r2g-dia-${d.clave}`} className="r2g-agenda-titulo">
                <span>{rel ? <>{rel}<span className="r2g-agenda-sep" aria-hidden="true"> · </span></> : null}{rel ? diaLargo(d.fecha) : diaLargo(d.fecha).replace(/^./, (c) => c.toUpperCase())}</span>
                {d.asueto && <span className="r2g-asueto">Asueto</span>}
                {obras.length > 0 && <span className="r2g-agenda-cuenta">{obras.length === 1 ? '1 obra' : `${obras.length} obras`}</span>}
              </h3>
              {obras.length ? (
                <ul className="r2g-agenda-lista">
                  {obras.map((p, i) => <Obra key={`${d.clave}-${i}`} p={p} dia={d} alAbrir={alAbrir} colorDeEquipo={colorDeEquipo} variante="celular" />)}
                </ul>
              ) : (
                <p className="r2g-dia-vacio">{d.sinDatos ? 'Este día todavía no se carga' : textoVacio}</p>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={clases('r2g-semana', variante === 'tv' ? 'r2g-semana--tv' : 'r2g-semana--oficina', className)} role="list" aria-label={etiqueta}>
      {dias.map((d) => {
        const todas = visibles(d);
        const esHoy = mismoDia(d.fecha, hoy);
        // TV: la columna no se desplaza. Con muchas obras se aprieta (sin cliente) y lo que no cabe se dice («y 2 obras más»)
        const tv = variante === 'tv';
        const lleno = tv && todas.length > TV_CABEN;
        const obras = lleno ? todas.slice(0, TV_CABEN_APRETADO) : todas;
        const sobran = todas.length - obras.length;
        return (
          <section key={d.clave} role="listitem" className={clases('r2g-dia', esHoy && 'r2g-dia--hoy', d.asueto && 'r2g-dia--asueto', lleno && 'r2g-dia--lleno')}
            aria-label={`${diaLargo(d.fecha)}${esHoy ? ', hoy' : ''}${d.asueto ? ', asueto' : ''}: ${todas.length === 1 ? '1 obra' : `${todas.length} obras`}`}>
            {tv ? (
              <header className="r2g-dia-cab">
                <span className="r2g-dia-nombre">{diaCorto(d.fecha)}</span>
                {esHoy && <span className="r2g-dia-hoy">Hoy</span>}
                {d.asueto && <span className="r2g-asueto">Asueto</span>}
              </header>
            ) : (
              // Oficina: como un calendario de pared, el día de la semana chico y el número grande (hoy en círculo)
              <header className="r2g-dia-cab r2g-dia-cab--cal">
                <span className="r2g-dia-semana">{diaSemanaCorto(d.fecha)}</span>
                <span className="r2g-dia-numero">{d.fecha.getDate()}</span>
                {d.asueto && <span className="r2g-asueto">Asueto</span>}
              </header>
            )}
            {obras.length ? (
              <ul className="r2g-dia-obras">
                {obras.map((p, i) => <Obra key={`${d.clave}-${i}`} p={p} dia={d} alAbrir={alAbrir} colorDeEquipo={colorDeEquipo} variante={variante} />)}
              </ul>
            ) : (
              <p className="r2g-dia-vacio">{d.sinDatos ? 'Sin cargar' : textoVacio}</p>
            )}
            {sobran > 0 && <p className="r2g-dia-mas">y {sobran === 1 ? '1 obra más' : `${sobran} obras más`}</p>}
          </section>
        );
      })}
    </div>
  );
}
