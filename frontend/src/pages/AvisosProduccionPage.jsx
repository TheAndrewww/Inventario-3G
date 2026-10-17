// B1 paso 1 · PLA-12 — Planta › Producción › Avisos (solo con Diseño 3G; App.jsx la protege con SoloConDiseno3G).
// Todo lo que se mandó a Producción, en un solo lugar y solo para verlo: los mensajes no cambian.
// Junta la cola propia de Planta (lo que Planta deja para el grupo Producción y publica Julia) y, desde PLA-14, la
// bitácora de Carla y Julia (lo que Finanzas anota después de cada envío que sí salió), en el mismo formato.
// Filtros por origen, destino y día; la liga puede traer ?destino=… (por ejemplo ?destino=susana,asesor desde
// Operación › Calendario), ?origen=… y ?dia=AAAA-MM-DD.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, RefreshCw } from 'lucide-react';
import api from '../services/api';
import CabG3 from '../diseno-3g/CabG3';
import { useDiseno3G as useDiseno3GR2 } from '../rediseno2/fundacion/useDiseno3G';
import VistaAvisos from '../rediseno2/produccion/VistaAvisos';

const ORIGENES = [
  { id: 'planta', nombre: 'Planta' },
  { id: 'carla', nombre: 'Carla' },
  { id: 'julia', nombre: 'Julia' },
];
const DESTINOS = [
  { id: 'produccion', nombre: 'Grupo Producción' },
  { id: 'charly', nombre: 'Charly' },
  { id: 'susana', nombre: 'Susana' },
  { id: 'asesor', nombre: 'Asesor' },
];
const NOMBRE_ORIGEN = Object.fromEntries(ORIGENES.map((o) => [o.id, o.nombre]));
const NOMBRE_DESTINO = Object.fromEntries(DESTINOS.map((d) => [d.id, d.nombre]));
const ESTADOS = {
  enviado: { clase: 'g3-estado--ok', texto: 'Publicado' },
  pendiente: { clase: 'g3-estado--aviso', texto: 'En cola' },
  error: { clase: 'g3-estado--mal', texto: 'No salió' },
};
const lista = (v) => String(v || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const restarDia = (iso) => new Date(Date.parse(`${iso}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
const nombreDia = (iso, hoy) => {
  if (iso === hoy) return 'Hoy';
  if (iso === restarDia(hoy)) return 'Ayer';
  const f = new Date(`${iso}T12:00:00Z`);
  return `${DIAS_SEMANA[f.getUTCDay()]} ${f.getUTCDate()} ${MESES[f.getUTCMonth()]}`;
};

export default function AvisosProduccionPage() {
  const [params, setParams] = useSearchParams();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const d3 = useDiseno3GR2(); // Rediseño 2: encendido, la vista nueva (abajo, antes del return de siempre)

  const origenes = lista(params.get('origen'));
  const destinos = lista(params.get('destino'));
  const dia = params.get('dia') || '';

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await api.get('/avisos-whatsapp/produccion/avisos', { params: { dias: 7 } });
      setDatos(r.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudieron cargar los avisos.');
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiar = (clave, valor) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(clave, valor); else p.delete(clave);
    setParams(p, { replace: true });
  };
  const alternar = (clave, actuales, id) => {
    const nuevos = actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id];
    cambiar(clave, nuevos.join(','));
  };

  const todos = useMemo(() => datos?.avisos || [], [datos]);
  const hoy = datos?.hoy || '';
  const conectadas = new Set((datos?.fuentes || []).filter((f) => f.conectada).map((f) => f.origen));
  const pasaOrigen = (a) => !origenes.length || origenes.includes(a.origen);
  const pasaDestino = (a) => !destinos.length || destinos.includes(a.destino);
  const pasaDia = (a) => !dia || a.dia === dia;
  const visibles = todos.filter((a) => pasaOrigen(a) && pasaDestino(a) && pasaDia(a));
  const cuenta = (filtro) => todos.filter(filtro).length;
  const diasConAvisos = [...new Set(todos.map((a) => a.dia))].sort().reverse();
  const opcionesDia = hoy ? [...new Set([hoy, restarDia(hoy), ...diasConAvisos, ...(dia ? [dia] : [])])].sort().reverse() : diasConAvisos;
  const filtrando = origenes.length || destinos.length || dia;
  // PLA-14: qué parte de la bitácora todavía no llega (Finanzas la manda con BITACORA_A_PLANTA)
  const faltan = ORIGENES.filter((o) => o.id !== 'planta' && !conectadas.has(o.id));

  // Rediseño 2 (encendido): mismos datos, mismos filtros en la liga y misma carga; otra vista
  if (d3) {
    return (
      <VistaAvisos
        datos={datos} cargando={cargando} error={error} cargar={cargar} origenes={origenes} destinos={destinos} dia={dia}
        cambiar={cambiar} alternar={alternar} setParams={setParams} todos={todos} hoy={hoy} visibles={visibles} cuenta={cuenta}
        opcionesDia={opcionesDia} filtrando={filtrando} faltan={faltan} pasaOrigen={pasaOrigen} pasaDestino={pasaDestino} pasaDia={pasaDia}
        ORIGENES={ORIGENES} DESTINOS={DESTINOS} NOMBRE_ORIGEN={NOMBRE_ORIGEN} NOMBRE_DESTINO={NOMBRE_DESTINO} nombreDia={nombreDia}
      />
    );
  }

  return (
    <div className="p-6">
      <CabG3
        titulo="Avisos a Producción"
        descripcion="Todo lo que se mandó a Producción, en un solo lugar. Los mensajes no cambian: aquí solo se ven."
      >
        <button type="button" className="g3-btn g3-btn--ch" onClick={cargar} aria-busy={cargando ? 'true' : undefined} disabled={cargando}>
          <RefreshCw size={16} aria-hidden="true" /> Actualizar
        </button>
      </CabG3>

      <div className="g3-pila" style={{ gap: 12, marginBottom: 16 }}>
        <div className="g3-grupo" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span className="g3-etiqueta">De</span>
          <div className="g3-chips" role="group" aria-label="Filtrar por quién lo mandó">
            {ORIGENES.map((o) => (
              <button key={o.id} type="button" className="g3-chip" aria-pressed={origenes.includes(o.id)} onClick={() => alternar('origen', origenes, o.id)}>
                {o.nombre} <span className="g3-insignia g3-insignia--neutra">{cuenta((a) => a.origen === o.id && pasaDestino(a) && pasaDia(a))}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="g3-grupo" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span className="g3-etiqueta">Para</span>
          <div className="g3-chips" role="group" aria-label="Filtrar por a quién le llegó">
            {DESTINOS.map((d) => (
              <button key={d.id} type="button" className="g3-chip" aria-pressed={destinos.includes(d.id)} onClick={() => alternar('destino', destinos, d.id)}>
                {d.nombre} <span className="g3-insignia g3-insignia--neutra">{cuenta((a) => a.destino === d.id && pasaOrigen(a) && pasaDia(a))}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="g3-grupo" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <label className="g3-etiqueta" htmlFor="avisos-dia">Día</label>
          <select id="avisos-dia" className="g3-selector" value={dia} onChange={(e) => cambiar('dia', e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Últimos {datos?.dias || 7} días</option>
            {opcionesDia.map((d) => <option key={d} value={d}>{nombreDia(d, hoy)}</option>)}
          </select>
          {filtrando ? (
            <button type="button" className="g3-btn g3-btn--fantasma g3-btn--ch" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Quitar filtros
            </button>
          ) : null}
        </div>
      </div>

      {datos && faltan.length > 0 && (
        <div className="g3-caja g3-caja--info" style={{ marginBottom: 16 }}>
          <Megaphone aria-hidden="true" />
          <div className="g3-caja-cuerpo">
            {faltan.length === 2 ? (
              <span>Por ahora se ven los avisos que manda <strong>Planta</strong> al grupo Producción. Los de Carla y Julia (recordatorios, confirmación del calendario y cita confirmada al asesor) se sumarán aquí.</span>
            ) : (
              <span>Todavía no llegan aquí los avisos de <strong>{faltan[0].nombre}</strong>; se sumarán en cuanto Finanzas los mande.</span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="g3-caja g3-caja--mal" role="alert" style={{ marginBottom: 16 }}>
          <div className="g3-caja-cuerpo"><span>{error}</span></div>
          <div className="g3-caja-acciones"><button type="button" className="g3-btn g3-btn--ch" onClick={cargar}>Reintentar</button></div>
        </div>
      )}

      {cargando && !datos ? (
        <div className="g3-pila" style={{ gap: 8 }} aria-label="Cargando avisos">
          {[0, 1, 2].map((i) => <div key={i} className="g3-esqueleto" style={{ height: 56 }} />)}
        </div>
      ) : visibles.length === 0 && !error ? (
        <div className="g3-vacio">
          <Megaphone aria-hidden="true" />
          <b>{filtrando ? 'Sin avisos con estos filtros' : 'Sin avisos en los últimos días'}</b>
          <p>{filtrando ? 'Prueba con otro día o quita los filtros.' : 'Cuando Planta, Carla o Julia le avisen algo a Producción (etapas, archivos, tickets, cambios de fecha o recordatorios), aparece aquí.'}</p>
          {filtrando ? <button type="button" className="g3-btn g3-btn--tonal" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Quitar filtros</button> : null}
        </div>
      ) : (
        <div className="g3-tabla g3-tabla--tarjetas">
          <table>
            <caption className="g3-oculto-visual">Avisos a Producción</caption>
            <thead>
              <tr>
                <th scope="col">Aviso</th>
                <th scope="col">Cuándo</th>
                <th scope="col">De</th>
                <th scope="col">Para</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => {
                const est = ESTADOS[a.estado] || { clase: 'g3-estado--neutro', texto: a.estado };
                return (
                  <tr key={a.id}>
                    <td className="g3-celda-titulo">
                      {a.titulo}
                      {a.proyecto ? <div className="g3-chico g3-tenue" style={{ fontWeight: 400 }}>{a.proyecto}{a.obra ? ` · ${a.obra}` : ''}</div> : null}
                      <details>
                        <summary className="g3-chico g3-tenue" style={{ cursor: 'pointer' }}>Ver el mensaje</summary>
                        <div style={{ whiteSpace: 'pre-wrap', marginTop: 6, fontWeight: 400 }}>{a.texto}</div>
                      </details>
                    </td>
                    <td data-etq="Cuándo">{nombreDia(a.dia, hoy)} · {a.hora}</td>
                    <td data-etq="De">{NOMBRE_ORIGEN[a.origen] || a.origen}</td>
                    <td data-etq="Para">{NOMBRE_DESTINO[a.destino] || a.destino}</td>
                    <td className="g3-celda-estado" data-etq="Estado">
                      <span className={`g3-estado ${est.clase}`} title={a.error || undefined}>{est.texto}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
