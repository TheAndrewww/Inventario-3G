// Pedidos de los encargados a Almacén (23-oct-2026, pedido del jefe). El encargado (GERAS, MIGUEL, MANE…) pide desde su
// tableta reposición de stock o el uso de una herramienta especial; Operación lo deja en Planta por la puerta entre
// sistemas. Aquí Almacén lo atiende: Surtido, Parcial o No se puede (estos dos con nota, que el encargado ve en su
// tableta). Solo Rediseño 2 (desde el 16-oct todos lo ven).
import { useEffect, useState } from 'react';
import { RefreshCw, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagina } from '../rediseno2/fundacion/piezas/Pagina';
import { EncabezadoPagina } from '../rediseno2/fundacion/piezas/EncabezadoPagina';
import { Pestanas } from '../rediseno2/fundacion/piezas/Pestanas';
import { Tabla } from '../rediseno2/fundacion/piezas/Tabla';
import { Estado } from '../rediseno2/fundacion/piezas/Estado';
import { Fecha } from '../rediseno2/fundacion/piezas/Fecha';
import { Boton } from '../rediseno2/fundacion/piezas/Boton';
import { Vacio } from '../rediseno2/fundacion/piezas/Estados';
import { pedirTextoG3, confirmarG3 } from '../rediseno2/fundacion/piezas/dialogos';
import { numero } from '../rediseno2/fundacion/formato';
import pedidosEncargadosService from '../services/pedidosEncargados.service';
import { useAuth } from '../context/AuthContext';

const PESTANAS = [
  { id: 'pendiente', texto: 'Por atender' },
  { id: 'atendidas', texto: 'Atendidos' },
];
const TIPO = { REPOSICION: 'Reposición de stock', HERRAMIENTA_ESPECIAL: 'Herramienta especial' };
const ESTADO = {
  pendiente: ['aviso', 'Por atender'],
  surtida: ['ok', 'Surtido'],
  parcial: ['aviso', 'Surtido en parte'],
  rechazada: ['mal', 'No se pudo'],
};

const motivo = (e) => e?.response?.data?.message || e?.message || 'Error de conexión';
const titulo = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '—');

export default function PedidosEncargadosPage() {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'administrador';
  const [pestana, setPestana] = useState('pendiente');
  const [solicitudes, setSolicitudes] = useState([]);
  const [pendientes, setPendientes] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await pedidosEncargadosService.listar(pestana);
      setSolicitudes(r?.data?.solicitudes || []);
      setPendientes(r?.data?.pendientes ?? null);
      setError(null);
    } catch (e) {
      setError(motivo(e));
    } finally {
      setCargando(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [pestana]);

  const responder = async (s, estado) => {
    let nota = null;
    if (estado !== 'surtida') {
      nota = await pedirTextoG3({
        titulo: estado === 'parcial' ? 'Surtido en parte' : 'No se puede surtir',
        texto: `Pedido de ${titulo(s.encargado)}: «${s.texto}». Lo que escribas lo ve en su tableta.`,
        etiqueta: estado === 'parcial' ? '¿Qué faltó?' : '¿Por qué no se puede?',
      });
      if (nota == null || !String(nota).trim()) return;
    }
    setProcesando(s.id);
    try {
      await pedidosEncargadosService.responder(s.id, estado, nota);
      toast.success(estado === 'surtida' ? 'Marcado como surtido' : 'Respuesta guardada');
      await cargar();
    } catch (e) {
      toast.error(motivo(e));
    } finally {
      setProcesando(null);
    }
  };

  // Solo el administrador: quitar los pedidos de prueba (29-oct-2026)
  const borrar = async (s) => {
    if (!(await confirmarG3({
      titulo: '¿Borrar este pedido?',
      aviso: 'No se puede deshacer.',
      datos: [['Encargado', titulo(s.encargado)], ['Pide', s.texto]],
      pasa: ['Desaparece de esta lista y de la tableta del encargado.'],
      confirmar: 'Borrar pedido', cancelar: 'No borrar', peligro: true,
    }))) return;
    setProcesando(s.id);
    try {
      await pedidosEncargadosService.borrar(s.id);
      toast.success('Pedido borrado');
      await cargar();
    } catch (e) {
      toast.error(motivo(e));
    } finally {
      setProcesando(null);
    }
  };

  const botonBorrar = (s) => (esAdmin ? (
    <Boton nivel="peligro" tamano="chico" icono={Trash2} alHacer={() => borrar(s)} deshabilitado={procesando === s.id}>Borrar</Boton>
  ) : null);

  const acciones = (s) => (s.estado === 'pendiente' ? (
    <>
      <Boton nivel="tonal" tamano="chico" icono={Check} alHacer={() => responder(s, 'surtida')} cargando={procesando === s.id}
        deshabilitado={procesando === s.id}>Surtido</Boton>
      <Boton nivel="contorno" tamano="chico" alHacer={() => responder(s, 'parcial')} deshabilitado={procesando === s.id}>Parcial</Boton>
      <Boton nivel="fantasma" tamano="chico" alHacer={() => responder(s, 'rechazada')} deshabilitado={procesando === s.id}>No se puede</Boton>
      {botonBorrar(s)}
    </>
  ) : botonBorrar(s));

  const estadoDe = (s) => {
    const [tono, texto] = ESTADO[s.estado] || ['neutro', s.estado];
    const quien = s.atendida_por ? ` · ${s.atendida_por}` : '';
    return <Estado tono={tono} texto={`${texto}${s.estado === 'pendiente' ? '' : quien}`} detalle={s.nota_almacen || null} />;
  };

  const columnas = [
    { id: 'encargado', titulo: 'Encargado', ancho: '14%', celda: (s) => <strong>{titulo(s.encargado)}</strong> },
    { id: 'tipo', titulo: 'Tipo', ancho: '16%', celda: (s) => TIPO[s.tipo] || s.tipo },
    {
      id: 'texto', titulo: 'Pide', ancho: '34%', celda: (s) => (
        <span>
          {s.texto}
          {(s.proyecto || s.obra_id) && <span className="r2-inv-desc" style={{ display: 'block' }}>{[s.proyecto, s.obra_id].filter(Boolean).join(' · ')}</span>}
        </span>
      ),
    },
    { id: 'para', titulo: 'Para', celda: (s) => (s.para_fecha ? <Fecha valor={s.para_fecha} modo="corta" /> : 'Sin fecha') },
    { id: 'cuando', titulo: 'Pidió', ocultarEn: 'tableta', celda: (s) => <Fecha valor={s.created_at} /> },
    { id: 'estado', titulo: 'Estado', celda: estadoDe },
  ];

  return (
    <Pagina titulo="Pedidos de encargados" densidad="comoda">
      <EncabezadoPagina titulo="Pedidos de encargados" dato={pendientes == null ? undefined : `${numero(pendientes)} por atender`}
        ayuda="Lo que los encargados piden desde su tableta: reposición de stock y herramientas especiales."
        secundarias={[{ texto: 'Actualizar', icono: RefreshCw, alHacer: () => cargar(), cargando }]} />
      <Pestanas etiqueta="Pedidos por estado" valor={pestana} alCambiar={setPestana}
        pestanas={PESTANAS.map((p) => ({ ...p, cuenta: p.id === 'pendiente' && pendientes != null ? pendientes : undefined }))} />
      <Tabla etiqueta="Pedidos" columnas={columnas} filas={solicitudes} clave="id" cargando={cargando && !solicitudes.length} accion={acciones}
        error={error && !cargando ? { mensaje: 'No se pudieron cargar los pedidos de los encargados.', motivo: error, alReintentar: () => cargar() } : undefined}
        filaCelular={(s) => ({
          principal: `${titulo(s.encargado)} · ${TIPO[s.tipo] || s.tipo}`,
          secundario: s.texto,
          derecha: estadoDe(s),
        })}
        vacio={(
          <Vacio titulo={pestana === 'pendiente' ? 'No hay pedidos por atender' : 'Aún no hay pedidos atendidos'}
            texto={pestana === 'pendiente' ? 'Cuando un encargado pida algo desde su tableta aparecerá aquí.' : 'Cambia de pestaña para ver los demás.'} />
        )} />
    </Pagina>
  );
}
