import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle, MapPin, PackagePlus, PackageMinus, Plus, Trash2, RefreshCw } from 'lucide-react';
import solicitudesCambioService from '../services/solicitudesCambio.service';
import ubicacionesService from '../services/ubicaciones.service';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const TIPO_LABEL = {
  cambio_ubicacion: 'Cambio de ubicación',
  entrada_stock: 'Entrada de stock',
  salida_stock: 'Salida de stock',
  crear_articulo: 'Crear artículo',
  desactivar_articulo: 'Desactivar artículo'
};

const TIPO_ICON = {
  cambio_ubicacion: MapPin,
  entrada_stock: PackagePlus,
  salida_stock: PackageMinus,
  crear_articulo: Plus,
  desactivar_articulo: Trash2
};

const ESTADO_BADGE = {
  pendiente: 'bg-amber-100 text-amber-800 border-amber-300',
  aprobada: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  rechazada: 'bg-red-100 text-red-800 border-red-300'
};

const SolicitudesCambioPage = () => {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'administrador';

  const [solicitudes, setSolicitudes] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [tabActivo, setTabActivo] = useState('pendiente');
  const [loading, setLoading] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);

  const cargar = async () => {
    try {
      setLoading(true);
      const [resSol, resUb] = await Promise.all([
        solicitudesCambioService.listar(),
        ubicacionesService.getAll().catch(() => [])
      ]);
      setSolicitudes(resSol?.data?.solicitudes || []);
      setUbicaciones(Array.isArray(resUb) ? resUb : []);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const aprobar = async (id) => {
    if (!window.confirm('¿Aprobar esta solicitud? El cambio se aplicará inmediatamente.')) return;
    try {
      setProcesandoId(id);
      const res = await solicitudesCambioService.aprobar(id);
      const actualizada = res?.data?.solicitud;
      // Actualización local — sin refetch ni perder scroll
      setSolicitudes(prev => prev.map(s => s.id === id ? (actualizada || { ...s, estado: 'aprobada' }) : s));
      toast.success('Solicitud aprobada y aplicada');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Error al aprobar');
    } finally {
      setProcesandoId(null);
    }
  };

  const rechazar = async (id) => {
    const motivo = window.prompt('Motivo del rechazo (será notificado al solicitante):');
    if (!motivo || !motivo.trim()) return;
    try {
      setProcesandoId(id);
      const res = await solicitudesCambioService.rechazar(id, motivo.trim());
      const actualizada = res?.data?.solicitud;
      setSolicitudes(prev => prev.map(s => s.id === id ? (actualizada || { ...s, estado: 'rechazada', motivo_rechazo: motivo.trim() }) : s));
      toast.success('Solicitud rechazada y solicitante notificado');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Error al rechazar');
    } finally {
      setProcesandoId(null);
    }
  };

  const filtradas = solicitudes.filter(s => s.estado === tabActivo);

  const describirCambio = (s) => {
    switch (s.tipo) {
      case 'cambio_ubicacion': {
        const idAnt = s.snapshot?.ubicacion_id;
        const idNue = s.payload?.ubicacion_id;
        const nomAnt = ubicaciones.find(u => u.id === idAnt)?.codigo || idAnt || 'Sin asignar';
        const nomNue = ubicaciones.find(u => u.id === idNue)?.codigo || idNue || 'Sin asignar';
        return `${nomAnt} → ${nomNue}`;
      }
      case 'entrada_stock':
        return `+${s.payload?.cantidad} (stock actual: ${s.snapshot?.stock_actual ?? '?'})`;
      case 'salida_stock':
        return `−${s.payload?.cantidad} (stock actual: ${s.snapshot?.stock_actual ?? '?'})`;
      case 'crear_articulo':
        return `Nombre: ${s.payload?.nombre || ''}`;
      case 'desactivar_articulo':
        return 'Desactivar artículo';
      default:
        return '';
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes de cambio</h1>
          <p className="text-gray-600 mt-1">
            {esAdmin
              ? 'Aprueba o rechaza los cambios solicitados por almacén'
              : 'Estado de tus solicitudes enviadas al administrador'}
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-gray-200">
        {['pendiente', 'aprobada', 'rechazada'].map(estado => {
          const count = solicitudes.filter(s => s.estado === estado).length;
          return (
            <button
              key={estado}
              onClick={() => setTabActivo(estado)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tabActivo === estado
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {estado}s
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Clock size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay solicitudes {tabActivo}s</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(s => {
            const Icon = TIPO_ICON[s.tipo] || AlertCircle;
            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Icon size={20} className="text-gray-700" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-900">
                          {TIPO_LABEL[s.tipo] || s.tipo}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${ESTADO_BADGE[s.estado]}`}>
                          {s.estado}
                        </span>
                      </div>

                      {s.articulo && (
                        <div className="text-sm text-gray-700 mb-1">
                          <span className="text-gray-500">Artículo:</span>{' '}
                          <strong>{s.articulo.nombre}</strong>
                          {s.articulo.codigo_ean13 && (
                            <span className="text-gray-400 ml-2">{s.articulo.codigo_ean13}</span>
                          )}
                        </div>
                      )}

                      <div className="text-sm text-gray-700">
                        <span className="text-gray-500">Cambio:</span> {describirCambio(s)}
                      </div>

                      {s.observaciones && (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="text-gray-500">Obs.:</span> {s.observaciones}
                        </div>
                      )}

                      <div className="text-xs text-gray-400 mt-2">
                        Solicitado por <strong>{s.solicitante?.nombre || '?'}</strong> · {formatearFecha(s.created_at)}
                        {s.aprobador && (
                          <> · Resuelto por <strong>{s.aprobador.nombre}</strong> el {formatearFecha(s.fecha_resolucion)}</>
                        )}
                      </div>

                      {s.estado === 'rechazada' && s.motivo_rechazo && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                          <strong>Motivo de rechazo:</strong> {s.motivo_rechazo}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones admin solo en pendientes */}
                  {esAdmin && s.estado === 'pendiente' && (
                    <div className="flex gap-2 md:flex-col md:w-40">
                      <button
                        onClick={() => aprobar(s.id)}
                        disabled={procesandoId === s.id}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} /> Aprobar
                      </button>
                      <button
                        onClick={() => rechazar(s.id)}
                        disabled={procesandoId === s.id}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                      >
                        <XCircle size={16} /> Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SolicitudesCambioPage;
