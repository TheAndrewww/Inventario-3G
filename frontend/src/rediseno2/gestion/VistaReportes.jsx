// Rediseño 2 · Gestión · Reportes de inventario (/reportes), vista ENCENDIDA. Dirección, por mes: APLICAR los ajustes
// sugeridos de mínimos y máximos y ver la salud del inventario.
// Antes: las 124 sugerencias empezaban en y = 1,294 (después de cifras y tres gráficas), sin encabezado fijo, con la razón
// de cada una escondida al pasar el cursor, casillas de 13 px y «Aplicar» al final. Ahora: «Sugerencias de ajuste» es la
// primera pestaña, la razón está a la vista, los números a la derecha, casillas con área de 44 px y una barra fija abajo
// con «Aplicar N ajustes». El resumen (cifras, estado del stock, más consumidos y valoración) va en su propia pestaña.
// Mismo reporte, mismo período, misma selección, la misma vista previa antes → después y la misma petición de ReportesPage.
import { useState } from 'react';
import { RefreshCw, Check, Sparkles } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, Pestanas, BarraFiltros, FiltroMenu, Selector, Tabla, Estado, BarraAccion, TiraCifras, Seccion, Cargando, ErrorCarga, Vacio,
  Nota, Dialogo, Boton, Casilla, numero, dinero, plural, clases, useEsCelular,
} from '../fundacion';
import { motivoError } from './comunes';
import './gestion.css';

const ESTADO = {
  critico: ['Crítico', 'mal'], bajoMinimo: ['Bajo mínimo', 'aviso'], ok: ['En rango', 'ok'], sobreMaximo: ['Sobre máximo', 'info'], sinMovimiento: ['Sin movimiento', 'neutro'],
};
const ACCION = {
  aumentar_min: 'Aumentar mínimo', reducir_min: 'Reducir mínimo', reducir_max: 'Reducir máximo', definir_max: 'Definir máximo', sin_movimiento: 'Sin movimiento', ok: 'Sin cambio',
};
const PERIODOS = [30, 60, 90, 180, 365];

export default function VistaReportes(p) {
  const {
    data, loading, errorCarga, dias, setDias, cargar, filtroAccion, setFiltroAccion, seleccion, setSeleccion, aplicando, aplicar,
    sugerenciasFiltradas, propuesta, editarValor, valores, toggleSeleccion, seleccionarTodos,
  } = p;
  const [pestana, setPestana] = useState('sugerencias');
  const [corrigiendo, setCorrigiendo] = useState(null); // celular: corregir el mínimo y el máximo de un renglón en un diálogo
  const celular = useEsCelular();
  const { kpis, distribucion, top_consumidos: top = [], resumen_categorias: categorias = [], parametros } = data || {};
  const total = data?.sugerencias?.length || 0;

  const columnas = [
    {
      id: 'articulo', titulo: 'Artículo',
      celda: (s) => {
        const [et, eto] = ESTADO[s.estado] || ESTADO.ok;
        return (
          <span className="r2g-celda-doble">
            <span className="r2g-fuerte">{s.nombre}</span>
            <span className="r2g-articulo-linea"><Estado tono={eto} texto={et} /><span className="r2g-sec">{s.categoria || 'Sin categoría'} · {s.unidad}</span></span>
          </span>
        );
      },
    },
    { id: 'stock', titulo: 'Existencia', alinear: 'der', ancho: '96px', celda: (s) => numero(s.stock_actual) },
    { id: 'consumo', titulo: 'Consumo al mes', alinear: 'der', ancho: '112px', celda: (s) => numero(Number(s.consumo_mensual || 0).toFixed(1)) },
    {
      id: 'minimo', titulo: 'Mínimo', alinear: 'der', ancho: '136px', sinBoton: true,
      celda: (s) => <CampoAjuste actual={s.stock_minimo} valor={propuesta(s).min} editado={valores[s.id]?.min !== undefined}
        sugerido={s.sugerencia.stock_min_sugerido} etiqueta={`Mínimo nuevo de ${s.nombre}`} alCambiar={(t) => editarValor(s.id, 'min', t)} />,
    },
    {
      id: 'maximo', titulo: 'Máximo', alinear: 'der', ancho: '136px', sinBoton: true,
      celda: (s) => <CampoAjuste actual={s.stock_maximo} valor={propuesta(s).max} editado={valores[s.id]?.max !== undefined}
        sugerido={s.sugerencia.stock_max_sugerido} etiqueta={`Máximo nuevo de ${s.nombre}`} alCambiar={(t) => editarValor(s.id, 'max', t)} />,
    },
    {
      id: 'accion', titulo: 'Acción sugerida y razón', ancho: '27%',
      celda: (s) => (
        <span className="r2g-celda-doble r2g-razon">
          <span className="r2g-fuerte">{ACCION[s.sugerencia.accion] || s.sugerencia.accion}</span>
          {s.sugerencia.razon && <span className="r2g-sec">{s.sugerencia.razon}</span>}
        </span>
      ),
    },
  ];

  const formula = `Mínimo sugerido = consumo diario × ${parametros?.lead_time_dias ?? '—'} días · máximo = consumo × ${parametros?.cobertura_dias ?? '—'} días. Puedes corregir cualquier valor antes de aplicar; corregir un renglón lo elige.`;
  const filtroAccionNodo = (
    <FiltroMenu key="accion" etiqueta="Acción" valor={filtroAccion}
      alCambiar={(v) => { setFiltroAccion(v); setSeleccion(new Set()); }}
      opciones={[{ valor: 'todos', texto: 'Todas', cuenta: total }, ...Object.keys(ACCION).filter((k) => k !== 'ok').map((k) => ({
        valor: k, texto: ACCION[k], cuenta: (data?.sugerencias || []).filter((s) => s.sugerencia.accion === k).length,
      }))]} />
  );

  const sugerencias = (
    <>
      {/* Celular: la fórmula se pliega para que la primera sugerencia quede arriba (en escritorio va junto al filtro) */}
      {celular && (
        <details className="r2g-detalles r2g-nota-reporte">
          <summary className="r2g-detalles-resumen">Cómo se calcula la sugerencia</summary>
          <Nota>{formula}</Nota>
        </details>
      )}
      <BarraFiltros filtros={[filtroAccionNodo]} activos={filtroAccion !== 'todos' ? 1 : 0}
        alQuitar={() => { setFiltroAccion('todos'); setSeleccion(new Set()); }} resultados={sugerenciasFiltradas.length}>
        {!celular && <span className="r2g-nota-filtros">{formula}</span>}
      </BarraFiltros>
      {celular ? (
        // Celular: un renglón por artículo con su casilla, lo que se propone, la razón y «Corregir»
        sugerenciasFiltradas.length === 0 ? (
          <Vacio icono={Sparkles} titulo="No hay sugerencias pendientes con este filtro" texto="Cuando el consumo pida otro mínimo o máximo aparecerá aquí." />
        ) : (
          <>
          {/* «Elegir todas» de la cabecera de la tabla (el mismo seleccionarTodos de la página: todas o ninguna) */}
          <div className="r2g-elegir-todas">
            <Casilla marcada={seleccion.size > 0 && seleccion.size === sugerenciasFiltradas.length}
              mixta={seleccion.size > 0 && seleccion.size < sugerenciasFiltradas.length}
              texto={seleccion.size === sugerenciasFiltradas.length ? 'Quitar todas' : `Elegir las ${numero(sugerenciasFiltradas.length)}`}
              alCambiar={() => seleccionarTodos()} />
          </div>
          <ul className="r2g-sugerencias" aria-label="Sugerencias de ajuste">
            {sugerenciasFiltradas.map((s) => {
              const prop = propuesta(s);
              const [et, eto] = ESTADO[s.estado] || ESTADO.ok;
              const elegida = seleccion.has(s.id);
              return (
                <li key={s.id} className={clases('r2g-sugerencia', elegida && 'r2g-sugerencia--elegida')}>
                  <Casilla marcada={elegida} soloCasilla etiqueta={`Elegir ${s.nombre}`} alCambiar={() => toggleSeleccion(s.id)} />
                  <div className="r2g-sugerencia-cuerpo">
                    <span className="r2g-fuerte">{s.nombre}</span>
                    <span className="r2g-linea">
                      <b>{ACCION[s.sugerencia.accion] || s.sugerencia.accion}</b> · mínimo {numero(s.stock_minimo)} → <b>{prop.min || '0'}</b> · máximo {s.stock_maximo !== null && s.stock_maximo !== undefined ? numero(s.stock_maximo) : '—'} → <b>{prop.max || '—'}</b>
                    </span>
                    {s.sugerencia.razon && <span className="r2g-sec">{s.sugerencia.razon}</span>}
                    <span className="r2g-sugerencia-pie">
                      <Estado tono={eto} texto={et} />
                      <span className="r2g-sec r2g-num">Existencia {numero(s.stock_actual)}</span>
                      <Boton nivel="fantasma" tamano="chico" alHacer={() => setCorrigiendo(s)}>Corregir</Boton>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )
      ) : (
      <Tabla etiqueta="Sugerencias de ajuste" clave="id" columnas={columnas} filas={sugerenciasFiltradas} densidad="compacta"
        seleccion={{ elegidas: [...seleccion], alCambiar: (lista) => setSeleccion(new Set(lista)), etiqueta: (s) => `Elegir ${s.nombre}` }}
        filaCelular={(s) => {
          const prop = propuesta(s);
          return {
            principal: s.nombre,
            secundario: `${ACCION[s.sugerencia.accion] || s.sugerencia.accion}: mínimo ${numero(s.stock_minimo)} → ${prop.min || '0'} · máximo ${s.stock_maximo !== null && s.stock_maximo !== undefined ? numero(s.stock_maximo) : '—'} → ${prop.max || '—'}`,
            derecha: `Existencia ${numero(s.stock_actual)}`,
            debajo: s.sugerencia.razon ? <span className="r2g-sec">{s.sugerencia.razon}</span> : null,
          };
        }}
        vacio={{ icono: Sparkles, titulo: 'No hay sugerencias pendientes con este filtro', texto: 'Cuando el consumo pida otro mínimo o máximo aparecerá aquí.' }} />
      )}
      {sugerenciasFiltradas.length > 0 && (
        <BarraAccion
          resumen={seleccion.size ? plural(seleccion.size, 'artículo elegido', 'artículos elegidos') : `${plural(sugerenciasFiltradas.length, 'sugerencia', 'sugerencias')}`}
          falta={seleccion.size ? null : 'Elige los artículos que quieres ajustar'}
          secundaria={seleccion.size ? { texto: 'Quitar selección', alHacer: () => setSeleccion(new Set()) } : undefined}
          principal={{ texto: seleccion.size > 1 ? `Aplicar ${seleccion.size} ajustes` : 'Aplicar ajuste', icono: Check, alHacer: aplicar, cargando: aplicando }} />
      )}
      {/* Celular: los mismos dos campos del renglón (editarValor, que también elige el renglón) en un diálogo */}
      <Dialogo abierto={!!corrigiendo} alCerrar={() => setCorrigiendo(null)} titulo={corrigiendo ? `Corregir ${corrigiendo.nombre}` : ''} tamano="sm" cerrarConEsc
        pie={<Boton nivel="principal" alHacer={() => setCorrigiendo(null)}>Listo</Boton>}>
        {corrigiendo && (
          <div className="r2g-corregir">
            <p className="r2g-linea">{ACCION[corrigiendo.sugerencia.accion] || corrigiendo.sugerencia.accion}{corrigiendo.sugerencia.razon ? `: ${corrigiendo.sugerencia.razon}` : ''}</p>
            <label className="r2-campo"><span className="r2-campo-etiqueta">Mínimo (hoy {numero(corrigiendo.stock_minimo)})</span>
              <CampoAjuste actual={corrigiendo.stock_minimo} valor={propuesta(corrigiendo).min} editado={valores[corrigiendo.id]?.min !== undefined}
                sugerido={corrigiendo.sugerencia.stock_min_sugerido} etiqueta={`Mínimo nuevo de ${corrigiendo.nombre}`} alCambiar={(t) => editarValor(corrigiendo.id, 'min', t)} />
            </label>
            <label className="r2-campo"><span className="r2-campo-etiqueta">Máximo (hoy {corrigiendo.stock_maximo !== null && corrigiendo.stock_maximo !== undefined ? numero(corrigiendo.stock_maximo) : 'sin máximo'})</span>
              <CampoAjuste actual={corrigiendo.stock_maximo} valor={propuesta(corrigiendo).max} editado={valores[corrigiendo.id]?.max !== undefined}
                sugerido={corrigiendo.sugerencia.stock_max_sugerido} etiqueta={`Máximo nuevo de ${corrigiendo.nombre}`} alCambiar={(t) => editarValor(corrigiendo.id, 'max', t)} />
            </label>
            <Nota>Corregir un valor elige el renglón para aplicarlo.</Nota>
          </div>
        )}
      </Dialogo>
    </>
  );

  let cuerpo;
  if (!data && loading) cuerpo = <Cargando forma="tabla" columnas={[3, 1, 1, 1, 1, 1, 3]} filas={10} etiqueta="Cargando el reporte…" />;
  else if (!data && errorCarga) cuerpo = <ErrorCarga mensaje="No se pudo cargar el reporte." motivo={motivoError(errorCarga)} alReintentar={cargar} />;
  else if (!data) cuerpo = null;
  else if (pestana === 'sugerencias') cuerpo = sugerencias;
  else cuerpo = <Resumen kpis={kpis} distribucion={distribucion} top={top} categorias={categorias} />;

  return (
    <Pagina className="r2g-pagina" titulo="Reportes" densidad="compacta" espacioInferior={pestana === 'sugerencias'}>
      <EncabezadoPagina titulo="Reportes de inventario"
        dato={loading && data ? 'Actualizando…' : celular ? 'consumibles' : `consumibles · análisis de ${numero(parametros?.dias_analizados ?? dias)} días`}
        extra={(
          <Selector aria-label="Período del análisis" className="r2g-periodo" value={dias} onChange={(e) => setDias(parseInt(e.target.value, 10))}
            opciones={PERIODOS.map((d) => ({ valor: d, texto: `Últimos ${d} días` }))} />
        )}
        secundarias={[{ texto: 'Actualizar', icono: RefreshCw, alHacer: cargar, cargando: loading && Boolean(data) }]} />
      {data && (
        <Pestanas etiqueta="Reportes" valor={pestana} alCambiar={setPestana} className="r2g-pestanas-pagina"
          pestanas={[{ id: 'sugerencias', texto: 'Sugerencias de ajuste', cuenta: kpis?.sugerencias_pendientes ?? total }, { id: 'resumen', texto: 'Resumen' }]} />
      )}
      {cuerpo}
    </Pagina>
  );
}

// «256 → [  8 ]»: lo de hoy y el campo con lo que se va a aplicar (el sugerido, o lo que se escribió)
function CampoAjuste({ actual, valor, editado, sugerido, etiqueta, alCambiar }) {
  return (
    <span className="r2g-ajuste">
      <span className="r2g-sec r2g-num">{actual !== null && actual !== undefined ? numero(actual) : '—'}</span>
      <span aria-hidden="true" className="r2g-sec">→</span>
      <input type="number" min="0" step="1" inputMode="numeric" className={clases('r2-entrada r2g-ajuste-campo', editado && 'r2g-ajuste-campo--editado')}
        value={valor} placeholder="—" aria-label={etiqueta} title={`Sugerido: ${numero(sugerido)}`} onChange={(e) => alCambiar(e.target.value)} />
    </span>
  );
}

// Resumen: cifras en una línea, estado del stock como barra apilada con leyenda, más consumidos y valoración por categoría
function Resumen({ kpis, distribucion, top, categorias }) {
  const estados = Object.keys(ESTADO).map((k) => ({ id: k, texto: ESTADO[k][0], tono: ESTADO[k][1], valor: distribucion?.[k] || 0 }));
  const totalEstados = estados.reduce((n, e) => n + e.valor, 0);
  const maxTop = Math.max(1, ...top.map((t) => parseFloat(t.consumo_total) || 0));
  return (
    <div className="r2g-resumen">
      <TiraCifras etiqueta="Resumen del inventario" cifras={[
        { id: 'consumibles', valor: kpis.total_consumibles, texto: 'Consumibles' },
        { id: 'bajo', valor: (kpis.articulos_bajo_minimo || 0) + (kpis.articulos_criticos || 0), texto: `Bajo mínimo · ${plural(kpis.articulos_criticos || 0, 'crítico', 'críticos')}`, tono: kpis.articulos_criticos ? 'mal' : null },
        { id: 'sugerencias', valor: kpis.sugerencias_pendientes, texto: 'Sugerencias' },
      ]} informativas={[{ valor: dinero(kpis.valoracion_total), texto: 'Valoración total' }]} />

      <Seccion titulo="Estado del stock" dato={plural(totalEstados, 'consumible', 'consumibles')}>
        {totalEstados === 0 ? <Nota>Sin datos para mostrar.</Nota> : (
          <>
            <div className="r2g-apilada" role="img" aria-label={estados.filter((e) => e.valor).map((e) => `${e.texto}: ${e.valor}`).join(', ')}>
              {estados.filter((e) => e.valor > 0).map((e) => (
                <span key={e.id} className={clases('r2g-apilada-tramo', `r2g-fondo--${e.tono}`)} style={{ flexGrow: e.valor }} title={`${e.texto}: ${numero(e.valor)}`} />
              ))}
            </div>
            <ul className="r2g-leyenda">
              {estados.map((e) => (
                <li key={e.id}>
                  <span className={clases('r2g-leyenda-marca', `r2g-fondo--${e.tono}`)} aria-hidden="true" />
                  <span>{e.texto}</span>
                  <b className="r2g-num">{numero(e.valor)}</b>
                  <span className="r2g-sec r2g-num">{totalEstados ? `${Math.round((e.valor / totalEstados) * 100)} %` : ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Seccion>

      <div className="r2g-dos-zonas r2g-dos-zonas--parejas">
        <Seccion titulo="Más consumidos en el período">
          {top.length === 0 ? <Nota>Sin consumo en este período.</Nota> : (
            <ol className="r2g-barras">
              {top.map((t, i) => {
                const v = parseFloat(t.consumo_total) || 0;
                return (
                  <li key={i} className="r2g-barra-fila" title={`${t.nombre}: ${numero(Math.round(v))} ${t.unidad || ''}`}>
                    <span className="r2g-barra-nombre">{t.nombre}</span>
                    <span className="r2g-barra-valor r2g-num">{numero(Math.round(v))} {t.unidad || ''}</span>
                    <span className="r2g-barra-pista" aria-hidden="true"><span className="r2g-barra" style={{ width: `${(v / maxTop) * 100}%` }} /></span>
                  </li>
                );
              })}
            </ol>
          )}
        </Seccion>
        <Seccion titulo="Valoración por categoría">
          <Tabla etiqueta="Valoración por categoría" clave="categoria" densidad="compacta" fija={false} filas={categorias.slice(0, 10)}
            columnas={[
              { id: 'categoria', titulo: 'Categoría', celda: (c) => c.categoria },
              { id: 'articulos', titulo: 'Artículos', alinear: 'der', ancho: '90px', celda: (c) => numero(c.articulos) },
              { id: 'bajo', titulo: 'Bajo mínimo', alinear: 'der', ancho: '110px', celda: (c) => (c.bajo_minimo ? <span className="r2-tono--aviso r2g-num-fuerte">{numero(c.bajo_minimo)}</span> : <span className="r2g-sec">0</span>) },
              { id: 'valor', titulo: 'Valor', alinear: 'der', ancho: '140px', celda: (c) => <span className="r2g-num-fuerte">{dinero(c.valor)}</span> },
            ]}
            filaCelular={(c) => ({ principal: c.categoria, secundario: `${plural(c.articulos, 'artículo', 'artículos')} · ${numero(c.bajo_minimo || 0)} bajo mínimo`, derecha: dinero(c.valor) })}
            vacio={<Vacio titulo="Sin categorías" compacto />} />
        </Seccion>
      </div>
    </div>
  );
}
