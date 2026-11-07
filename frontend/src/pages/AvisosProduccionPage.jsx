// B1 paso 1 · PLA-12 — Planta › Producción › Avisos (solo con Diseño 3G; App.jsx la protege con SoloConDiseno3G).
// Todo lo que se mandó a Producción, en un solo lugar y solo para verlo: los mensajes no cambian.
// Junta la cola propia de Planta (lo que Planta deja para el grupo Producción y publica Julia) y, desde PLA-14, la
// bitácora de Carla y Julia (lo que Finanzas anota después de cada envío que sí salió), en el mismo formato.
// Filtros por origen, destino y día; la liga puede traer ?destino=… (por ejemplo ?destino=susana,asesor desde
// Operación › Calendario), ?origen=… y ?dia=AAAA-MM-DD.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
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

  return (
    <VistaAvisos
      datos={datos} cargando={cargando} error={error} cargar={cargar} origenes={origenes} destinos={destinos} dia={dia}
      cambiar={cambiar} alternar={alternar} setParams={setParams} todos={todos} hoy={hoy} visibles={visibles} cuenta={cuenta}
      opcionesDia={opcionesDia} filtrando={filtrando} faltan={faltan} pasaOrigen={pasaOrigen} pasaDestino={pasaDestino} pasaDia={pasaDia}
      ORIGENES={ORIGENES} DESTINOS={DESTINOS} NOMBRE_ORIGEN={NOMBRE_ORIGEN} NOMBRE_DESTINO={NOMBRE_DESTINO} nombreDia={nombreDia}
    />
  );
}
