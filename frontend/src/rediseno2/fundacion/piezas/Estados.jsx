// Rediseño 2 · cargando, vacío y error (DISENO-v2 §4.10). Estados completos en cada lista.
//
// <Cargando forma="tabla" columnas={6} filas={8} />   esqueleto con la forma real (también 'lista', 'ficha', 'tv', 'texto')
// <Vacio titulo="No hay tickets por preparar" texto="Cuando diseño finalice una orden de salida aparecerá aquí." />
// <Vacio sinResultados busqueda="abrazadera" donde="Principal" alQuitar={quitarFiltros} />
// <ErrorCarga mensaje="No se pudo cargar la lista de órdenes." motivo={error} alReintentar={cargarOrdenes} />
//
// Cargando: forma, columnas (número o lista de anchos relativos), filas, etiqueta (lectores: «Cargando órdenes…»).
// Vacio: icono, titulo, texto, accion ({texto, alHacer | href, icono} o un nodo), sinResultados + busqueda + donde + alQuitar.
// ErrorCarga: titulo, mensaje, motivo (lo que dijo el servidor; «Network Error» y parecidos se dicen en palabras con motivoLegible), alReintentar (la MISMA función de carga de la
// página), sinConexion (texto de sin internet), reintentando.
import { AlertCircle, RotateCw, SearchX, WifiOff } from 'lucide-react';
import { Boton } from './Boton';
import { clases, motivoLegible } from '../formato';

const ANCHOS = [62, 38, 50, 44, 70, 34, 56, 46];

export function Cargando({ forma = 'tabla', columnas = 5, filas = 8, etiqueta = 'Cargando…', className }) {
  const cols = Array.isArray(columnas) ? columnas : Array.from({ length: columnas }, (_, i) => (i === 0 ? 2 : 1));
  const renglones = Array.from({ length: filas }, (_, i) => i);
  let cuerpo;
  if (forma === 'tabla') {
    cuerpo = (
      <div className="r2-esqueleto-tabla" style={{ '--r2-esq-cols': cols.map((c) => `${c}fr`).join(' ') }}>
        <div className="r2-esqueleto-cabecera">{cols.map((_, j) => <span key={j} className="r2-hueso r2-hueso--etiqueta" />)}</div>
        {renglones.map((i) => (
          <div key={i} className="r2-esqueleto-renglon">
            {cols.map((_, j) => <span key={j} className="r2-hueso" style={{ width: `${ANCHOS[(i + j) % ANCHOS.length] + (j === 0 ? 30 : 0)}%` }} />)}
          </div>
        ))}
      </div>
    );
  } else if (forma === 'lista' || forma === 'tv') {
    cuerpo = (
      <div className={clases('r2-esqueleto-lista', forma === 'tv' && 'r2-esqueleto-lista--tv')}>
        {renglones.map((i) => (
          <div key={i} className="r2-esqueleto-fila">
            <span className="r2-esqueleto-lineas">
              <span className="r2-hueso" style={{ width: `${ANCHOS[i % ANCHOS.length]}%` }} />
              <span className="r2-hueso r2-hueso--tenue" style={{ width: `${ANCHOS[(i + 3) % ANCHOS.length] - 10}%` }} />
            </span>
            <span className="r2-hueso r2-hueso--corto" />
          </div>
        ))}
      </div>
    );
  } else if (forma === 'ficha') {
    cuerpo = (
      <div className="r2-esqueleto-ficha">
        <span className="r2-hueso r2-hueso--titulo" />
        {renglones.slice(0, Math.min(filas, 6)).map((i) => (
          <span key={i} className="r2-esqueleto-dato">
            <span className="r2-hueso r2-hueso--etiqueta" />
            <span className="r2-hueso" style={{ width: `${ANCHOS[i % ANCHOS.length]}%` }} />
          </span>
        ))}
      </div>
    );
  } else {
    cuerpo = (
      <div className="r2-esqueleto-texto">
        {renglones.map((i) => <span key={i} className="r2-hueso" style={{ width: `${ANCHOS[i % ANCHOS.length] + 30}%` }} />)}
      </div>
    );
  }
  return (
    <div className={clases('r2-cargando', className)} role="status" aria-live="polite" aria-busy="true">
      <span className="r2-solo-lectores">{etiqueta}</span>
      {cuerpo}
    </div>
  );
}

const accionNodo = (accion) => {
  if (!accion) return null;
  if (accion.texto) {
    return <Boton nivel={accion.nivel || 'tonal'} icono={accion.icono} alHacer={accion.alHacer} href={accion.href}>{accion.texto}</Boton>;
  }
  return accion;
};

export function Vacio({ icono: Icono, titulo, texto, accion, sinResultados = false, busqueda, donde, alQuitar, compacto = false, className }) {
  if (sinResultados) {
    const que = busqueda ? <>coincide con «{busqueda}»</> : 'coincide con los filtros';
    return (
      <div className={clases('r2-vacio', compacto && 'r2-vacio--compacto', className)} role="status">
        <SearchX size={24} aria-hidden="true" className="r2-vacio-icono" />
        <p className="r2-vacio-titulo">{titulo || <>Nada {que}{donde ? <> en {donde}</> : null}</>}</p>
        {texto && <p className="r2-vacio-texto">{texto}</p>}
        {alQuitar && <Boton nivel="tonal" alHacer={alQuitar}>Quitar filtros</Boton>}
      </div>
    );
  }
  return (
    <div className={clases('r2-vacio', compacto && 'r2-vacio--compacto', className)} role="status">
      {Icono && <Icono size={24} aria-hidden="true" className="r2-vacio-icono" />}
      {titulo && <p className="r2-vacio-titulo">{titulo}</p>}
      {texto && <p className="r2-vacio-texto">{texto}</p>}
      {accionNodo(accion)}
    </div>
  );
}

export function ErrorCarga({ titulo, mensaje = 'No se pudo cargar la información.', motivo, alReintentar, reintentando = false, sinConexion, className }) {
  const Icono = sinConexion ? WifiOff : AlertCircle;
  const motivoTexto = motivo ? motivoLegible(motivo) : null;
  return (
    <div className={clases('r2-error-carga', className)} role="alert">
      <Icono size={20} aria-hidden="true" className="r2-error-icono" />
      <div className="r2-error-cuerpo">
        <p className="r2-error-titulo">{titulo || (sinConexion ? 'Sin conexión' : mensaje)}</p>
        {titulo && <p className="r2-error-texto">{mensaje}</p>}
        {sinConexion && <p className="r2-error-texto">{typeof sinConexion === 'string' ? sinConexion : 'Se reintentará al volver la red.'}</p>}
        {motivoTexto && motivoTexto !== mensaje && <p className="r2-error-motivo">{motivoTexto}</p>}
      </div>
      {alReintentar && (
        <Boton nivel="contorno" tamano="chico" icono={RotateCw} cargando={reintentando} alHacer={() => alReintentar()}>Reintentar</Boton>
      )}
    </div>
  );
}
