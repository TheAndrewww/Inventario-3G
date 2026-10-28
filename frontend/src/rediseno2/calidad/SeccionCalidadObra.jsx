// Rediseño 2 · Producción › detalle de la obra (la carpeta que abre el tablero al tocar el nombre) › «Calidad», solo
// lectura. Solo con PANEL_CALIDAD y para administración y almacén (los que entran a /api/calidad). Apagado no pide nada ni
// pinta nada: el detalle queda como hoy (comprobado con capturas).
// Dice cómo va la hoja de control de calidad de la obra (la llena Charly en la tableta): estado, qué lleva, revisión,
// defectos, observaciones para instalación, lo último que pasó y el reporte de salida en PDF.
import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import {
  SeccionCajon, Estado, Datos, LineaTiempo, Boton, Nota, Pila, plural, avisoG3, motivoLegible,
} from '../fundacion';
import { obraCalidad, reporteCalidadPDF } from '../../services/calidad.service';
import { usePanelCalidad } from './usePanelCalidad';
import './calidad.css';

const ESTADO_HOJA = {
  sin_revisar: { tono: 'neutro', texto: 'Sin revisar' },
  en_revision: { tono: 'info', texto: 'En revisión' },
  con_defectos: { tono: 'mal', texto: 'Con defectos' },
  lista: { tono: 'aviso', texto: 'Lista para avalar' },
  avalada: { tono: 'ok', texto: 'Avalada' },
};
const ATRIBUTOS = {
  lleva_membrana: 'Membrana', lleva_estructura: 'Estructura', lleva_costura: 'Costura', lleva_vulcanizado: 'Vulcanizado',
  lleva_cables: 'Cables', lleva_placas_vertice: 'Placas de vértice', lleva_mecanismo: 'Mecanismo', lleva_rolados: 'Rolados',
  lleva_placas_base: 'Placas base',
};
const EVENTO = {
  marco: 'Marcó un punto', marco_tarde: 'Llegó tarde un cambio', atributos: 'Cambió qué lleva', avalo: 'Avaló', reabrio: 'Reabrió la hoja',
  defecto_reabrio: 'Un defecto reabrió el área', defecto_sin_reabrir: 'Defecto en obra ya entregada', preparado_manual: 'Preparado sin aval',
  espera_calidad: 'Espera el aval', cerro_produccion: 'Pasó a Preparado con el aval', sugerencia_aplicada: 'Se aplicó lo que dijo Carla',
  sugerencia_descartada: 'Se descartó lo que dijo Carla', religo: 'Se volvió a ligar la hoja',
};

const textoQueLleva = (a) => {
  if (!a) return null;
  const si = Object.keys(ATRIBUTOS).filter((k) => a[k] === true).map((k) => ATRIBUTOS[k]);
  if (a.acabado_estructura && a.acabado_estructura !== 'ninguno') si.push(`acabado: ${a.acabado_estructura}`);
  return si.length ? si.join(', ') : 'Nada marcado';
};

export function SeccionCalidadObra({ proyectoId }) {
  const panel = usePanelCalidad();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [abriendo, setAbriendo] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await obraCalidad(proyectoId));
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Error desconocido');
    }
  }, [proyectoId]);
  useEffect(() => { if (panel.activo && proyectoId) cargar(); }, [panel.activo, proyectoId, cargar]);

  if (!panel.activo) return null;

  const verReporte = async () => {
    if (abriendo) return;
    setAbriendo(true);
    try {
      const pdf = await reporteCalidadPDF(proyectoId);
      const url = URL.createObjectURL(pdf);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      avisoG3(`No se pudo abrir el reporte: ${motivoLegible(e?.message)}`, 'mal');
    } finally {
      setAbriendo(false);
    }
  };

  let cuerpo;
  if (error) cuerpo = <Nota>{`No se pudo leer la hoja de calidad: ${motivoLegible(error)}`}</Nota>;
  else if (!datos) cuerpo = <Nota>Leyendo la hoja de calidad…</Nota>;
  else {
    const h = datos.hoja;
    const e = ESTADO_HOJA[h.estado] || ESTADO_HOJA.sin_revisar;
    const defectos = datos.hojas.flatMap((hj) => hj.puntos.filter((p) => p.estado === 'defecto'));
    const c = h.conteos;
    cuerpo = (
      <Pila separacion={12}>
        {datos.obra.esperaCalidad && (
          <Estado tono="aviso" texto="Espera el aval de Calidad" detalle="Manufactura y Herrería terminaron; la obra pasa a Preparado cuando Calidad la avale." />
        )}
        <Estado tono={e.tono} texto={e.texto}
          detalle={h.estado === 'avalada'
            ? `Avaló ${h.avaladaPor || 'Calidad'}`
            : (h.porQueNo?.length ? h.porQueNo.join(' · ') : null)} />
        <Datos columnas={2} datos={[
          ['Qué lleva', textoQueLleva(h.atributos) || 'Falta decir qué lleva'],
          ['Revisión', h.faltanAtributos ? 'Sin empezar' : `${c.ok + c.na} de ${c.total} bien o no aplica`],
          ['Defectos', c.defectos ? `${c.defectos}${c.salenAsi ? ` (${c.salenAsi} salen así)` : ''}` : 'Ninguno'],
          ['Sugerencias de Carla', h.sugerenciasPendientes ? plural(h.sugerenciasPendientes, 'por revisar', 'por revisar') : 'Ninguna'],
          h.observacionesInstalacion ? { etiqueta: 'Para instalación', valor: h.observacionesInstalacion, ancho: 'doble' } : null,
        ].filter(Boolean)} />
        {defectos.length > 0 && (
          <ul className="r2c-defectos" aria-label="Defectos de la hoja">
            {defectos.map((p) => (
              <li key={p.id}>
                <span className="r2c-punto">{p.id}</span>
                <span>
                  {p.texto}
                  {p.nota && <span className="r2c-nota">{p.nota}</span>}
                </span>
                <Estado tono={p.saleAsi ? 'aviso' : 'mal'} texto={p.saleAsi ? 'Sale así' : 'Por corregir'} />
              </li>
            ))}
          </ul>
        )}
        {datos.eventos?.length > 0 && (
          <LineaTiempo eventos={datos.eventos.slice(0, 5).map((ev, i) => ({
            id: `${ev.cuando}-${i}`, texto: EVENTO[ev.tipo] || ev.tipo, detalle: ev.detalle, quien: ev.quien, cuando: ev.cuando,
            tono: ev.tipo === 'avalo' || ev.tipo === 'cerro_produccion' ? 'ok' : ev.tipo === 'defecto_reabrio' ? 'mal' : undefined,
          }))} />
        )}
        {h.id && (
          <div>
            <Boton nivel="contorno" icono={FileText} cargando={abriendo} alHacer={verReporte}>
              {h.estado === 'avalada' ? 'Ver reporte de calidad' : 'Ver vista previa del reporte'}
            </Boton>
          </div>
        )}
      </Pila>
    );
  }
  return <SeccionCajon titulo="Calidad" className="r2c-seccion">{cuerpo}</SeccionCajon>;
}

export default SeccionCalidadObra;
