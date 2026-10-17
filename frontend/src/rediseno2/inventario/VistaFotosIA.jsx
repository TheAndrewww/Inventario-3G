// Rediseño 2 · grupo inventario · Fotos de artículos con IA (/procesamiento-masivo) encendido. DISENO-v2 §5.3.
// La cola en una tira de cifras (En cola · Procesando · Listas · Fallaron; cada una abre el historial filtrado), la tabla de
// artículos con foto, nombre completo y su último proceso, con casillas; la barra fija de abajo dice qué falta o
// «Procesar 12 fotos». El historial de la cola va en un cajón con duración e intentos en palabras y «Reintentar».
// Mismo estado, mismos manejadores y el mismo sondeo de la página (cada 3 s mientras hay algo en proceso).
import { useState } from 'react';
import { Wand2, History, RefreshCw, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { Pagina } from '../fundacion/piezas/Pagina';
import { EncabezadoPagina } from '../fundacion/piezas/EncabezadoPagina';
import { TiraCifras } from '../fundacion/piezas/TiraCifras';
import { Tabla } from '../fundacion/piezas/Tabla';
import { Estado } from '../fundacion/piezas/Estado';
import { Fecha } from '../fundacion/piezas/Fecha';
import { Boton } from '../fundacion/piezas/Boton';
import { BarraAccion } from '../fundacion/piezas/BarraAccion';
import { Segmentado } from '../fundacion/piezas/Pestanas';
import { MenuAcciones } from '../fundacion/piezas/MenuAcciones';
import { Cargando, Vacio, ErrorCarga } from '../fundacion/piezas/Estados';
import { Miniatura } from '../fundacion/piezas/Miniatura';
import { Nota } from '../fundacion/piezas/Ayudas';
import { Cajon, CajonCabecera, CajonDecision, CajonCuerpo } from '../fundacion/piezas/Cajon';
import { useEsCelular } from '../fundacion/useDiseno3G';
import { numero, plural, duracion } from '../fundacion/formato';
import { num, motivoLegible } from './ayudas';
import './inventario.css';

const ESTADOS = { pending: ['En cola', 'neutro'], processing: ['Procesando', 'info'], completed: ['Lista', 'ok'], failed: ['Falló', 'mal'] };
const estadoCola = (e) => { const par = ESTADOS[e]; return par ? { texto: par[0], tono: par[1] } : { texto: e || '—', tono: 'neutro' }; };

export default function VistaFotosIA({ f }) {
  const celular = useEsCelular();
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [filtroHistorial, setFiltroHistorial] = useState('');
  const sel = f.selectedArticulos;
  const st = f.queueStatus?.stats;
  const abrirHistorial = (filtro = '') => { setFiltroHistorial(filtro); setHistorialAbierto(true); };

  // Último proceso de cada artículo, con lo que ya trajo el historial (los 20 más recientes)
  const ultimo = new Map();
  for (const h of f.historial) {
    const previo = ultimo.get(h.articulo_id);
    if (!previo || new Date(h.created_at) > new Date(previo.created_at)) ultimo.set(h.articulo_id, h);
  }

  // La casilla de la cabecera elige o quita todos (handleSelectAll); una casilla, ese artículo (handleSelectArticulo)
  const alCambiarSeleccion = (lista) => {
    const antes = new Set(sel);
    const ahora = new Set(lista);
    const cambiados = [...lista.filter((id) => !antes.has(id)), ...sel.filter((id) => !ahora.has(id))];
    if (cambiados.length === 1) f.handleSelectArticulo(cambiados[0]);
    else f.handleSelectAll();
  };

  const historial = filtroHistorial ? f.historial.filter((h) => h.estado === filtroHistorial) : f.historial;
  const actual = f.queueStatus?.articuloActual;

  return (
    <Pagina titulo="Fotos con IA" densidad="compacta" espacioInferior className="r2-inv">
      <EncabezadoPagina titulo="Fotos de artículos con IA" dato={plural(f.articulos.length, 'artículo con foto', 'artículos con foto')}
        secundarias={[{ texto: 'Historial de la cola', icono: History, alHacer: () => abrirHistorial('') }]}
        masAcciones={[
          { texto: 'Actualizar el estado de la cola', icono: RefreshCw, alHacer: () => f.fetchQueueStatus() },
          { texto: 'Limpiar la cola antigua', icono: Trash2, peligro: true, alHacer: f.handleLimpiarCola },
        ]} />
      {st ? (
        <TiraCifras etiqueta="Estado de la cola"
          cifras={[
            { id: 'pending', valor: st.pendientes, texto: 'En cola', alElegir: () => abrirHistorial('pending') },
            { id: 'processing', valor: st.procesando, texto: 'Procesando', alElegir: () => abrirHistorial('processing') },
            { id: 'completed', valor: st.completados, texto: 'Listas', alElegir: () => abrirHistorial('completed') },
            { id: 'failed', valor: st.fallidos, texto: 'Fallaron', tono: num(st.fallidos) > 0 ? 'mal' : undefined, alElegir: () => abrirHistorial('failed') },
          ]} />
      ) : <Nota className="r2-inv-nota-cola">Sin datos de la cola todavía.</Nota>}
      {(actual || f.autoRefresh) && (
        <p className="r2-inv-cola-ahora" role="status">
          {actual && (
            <span className="r2-inv-cola-actual">
              <Loader2 size={16} aria-hidden="true" className="r2-girando" />
              <span>Procesando ahora: <strong>{actual.articulo_nombre}</strong> · {duracion(actual.segundos_procesando)} · intento {actual.intentos}</span>
            </span>
          )}
          {f.autoRefresh && <span className="r2-inv-desc">Se actualiza cada 3 segundos mientras hay fotos en proceso</span>}
        </p>
      )}

      {f.errorCargaR2 && !f.loading && !f.articulos.length ? (
        <ErrorCarga mensaje="No se pudieron cargar los artículos con foto." motivo={motivoLegible(f.errorCargaR2)} alReintentar={() => f.fetchArticulos()} />
      ) : f.loading && !f.articulos.length ? (
        <Cargando forma={celular ? 'lista' : 'tabla'} columnas={[1, 3, 2, 2]} filas={9} etiqueta="Cargando los artículos con foto…" />
      ) : (
        <Tabla etiqueta="Artículos con foto" clave="id" filas={f.articulos}
          seleccion={{ elegidas: sel, alCambiar: alCambiarSeleccion, etiqueta: (a) => `Elegir ${a.nombre}` }}
          alAbrir={(a) => f.handleSelectArticulo(a.id)} etiquetaAbrir={(a) => `Elegir o quitar ${a.nombre}`}
          // Celular: la foto (lo que se va a mejorar) a la derecha del renglón, se amplía al tocarla
          accion={celular ? (a) => <Miniatura src={a.imagen_url} alt={a.nombre} tamano={48} /> : undefined}
          columnas={[
            { id: 'foto', titulo: 'Foto', ancho: '72px', sinBoton: true, celda: (a) => <Miniatura src={a.imagen_url} alt={a.nombre} tamano={48} /> },
            {
              id: 'nombre', titulo: 'Artículo', celda: (a) => (
                <span className="r2-inv-articulo-texto">
                  <span className="r2-inv-nombre">{a.nombre}</span>
                  {a.sku && <span className="r2-inv-desc r2-num">Clave {a.sku}</span>}
                </span>
              ),
            },
            { id: 'categoria', titulo: 'Categoría', ancho: '18%', ocultarEn: 'celular-ancho', celda: (a) => a.categoria?.nombre || '—' },
            {
              id: 'ultimo', titulo: 'Último proceso', ancho: '22%', celda: (a) => {
                const h = ultimo.get(a.id);
                if (!h) return <span className="r2-inv-desc" title="No está entre los 20 procesos más recientes">—</span>;
                const e = estadoCola(h.estado);
                return <span className="r2-inv-articulo-texto"><Estado tono={e.tono} texto={e.texto} /><span className="r2-inv-desc"><Fecha valor={h.completed_at || h.created_at} /></span></span>;
              },
            },
          ]}
          filaCelular={(a) => {
            const h = ultimo.get(a.id);
            const e = h ? estadoCola(h.estado) : null;
            return { principal: a.nombre, secundario: a.categoria?.nombre || (a.sku ? `Clave ${a.sku}` : ''), debajo: e ? <Estado tono={e.tono} texto={e.texto} /> : null };
          }}
          vacio={<Vacio titulo="No hay artículos con foto" texto="Cuando un artículo tenga foto aparecerá aquí para mejorarla con IA." />} />
      )}

      <BarraAccion
        resumen={sel.length ? plural(sel.length, 'artículo elegido', 'artículos elegidos') : null}
        falta={sel.length ? null : 'Elige las fotos que quieres mejorar con IA'}
        principal={{ texto: sel.length ? `Procesar ${plural(sel.length, 'foto', 'fotos')}` : 'Procesar fotos', icono: Wand2, alHacer: f.handleProcesarSeleccionados, cargando: f.processing }}
        secundaria={sel.length ? { texto: 'Quitar selección', alHacer: () => f.setSelectedArticulos([]) }
          : (f.articulos.length ? { texto: 'Elegir todos', alHacer: f.handleSelectAll } : null)} />

      <Cajon abierto={historialAbierto} alCerrar={() => setHistorialAbierto(false)} ancho="ancho" etiqueta="Historial de la cola">
        <CajonCabecera titulo="Historial de la cola" dato="Los 20 más recientes" alCerrar={() => setHistorialAbierto(false)} />
        <CajonDecision>
          <Boton nivel="tonal" icono={RefreshCw} alHacer={f.fetchHistorial} cargando={f.loadingHistory}>Actualizar</Boton>
          <MenuAcciones titulo="Historial de la cola" acciones={[{ texto: 'Limpiar la cola antigua', icono: Trash2, peligro: true, alHacer: f.handleLimpiarCola }]} />
        </CajonDecision>
        <CajonCuerpo>
          <div className="r2-inv-cajon-filtros">
            <Segmentado etiqueta="Estado" valor={filtroHistorial} alCambiar={setFiltroHistorial}
              opciones={[{ valor: '', texto: 'Todos' }, ...Object.entries(ESTADOS).map(([k, e]) => ({ valor: k, texto: e[0] === 'Lista' ? 'Listas' : e[0] === 'Falló' ? 'Fallaron' : e[0] }))]} />
          </div>
          {f.loadingHistory && !f.historial.length ? <Cargando forma="lista" filas={6} etiqueta="Cargando el historial…" /> : (
            <Tabla etiqueta="Historial" className="r2-inv-acciones-abajo" densidad="compacta" fija={false} filas={historial} clave="id"
              columnas={[
                {
                  id: 'articulo', titulo: 'Artículo', celda: (h) => (
                    <span className="r2-inv-articulo-texto">
                      <span className="r2-inv-nombre">{h.articulo_nombre}</span>
                      <span className="r2-inv-desc"><Fecha valor={h.created_at} /></span>
                    </span>
                  ),
                },
                { id: 'estado', titulo: 'Estado', ancho: '26%', celda: (h) => { const e = estadoCola(h.estado); return <Estado tono={e.tono} texto={e.texto} detalle={h.error_message || null} />; } },
                { id: 'duracion', titulo: 'Duración', alinear: 'der', ancho: '15%', celda: (h) => (h.duracion_segundos ? duracion(h.duracion_segundos) : '—') },
                { id: 'intentos', titulo: 'Intentos', alinear: 'der', ancho: '12%', celda: (h) => `${numero(h.intentos)} de ${numero(h.max_intentos)}` },
              ]}
              accion={(h) => (h.estado === 'failed' ? <Boton nivel="tonal" tamano="chico" icono={RotateCcw} alHacer={() => f.handleRetryItem(h.id)}>Reintentar</Boton> : null)}
              filaCelular={(h) => {
                const e = estadoCola(h.estado);
                return { principal: h.articulo_nombre, secundario: `${h.duracion_segundos ? duracion(h.duracion_segundos) : 'Sin duración'} · intento ${h.intentos} de ${h.max_intentos}`, debajo: <Estado tono={e.tono} texto={e.texto} detalle={h.error_message || null} /> };
              }}
              vacio={<Vacio titulo={filtroHistorial ? 'Nada con ese estado' : 'Sin historial'} texto="Las fotos que se procesen aparecerán aquí." />} />
          )}
        </CajonCuerpo>
      </Cajon>
    </Pagina>
  );
}
