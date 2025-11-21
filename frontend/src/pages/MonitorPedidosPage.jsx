import React, { useState, useEffect } from 'react';
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Eye,
  Truck,
  UserCheck,
  ClipboardList,
  ChevronRight,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import pedidosService from '../services/pedidos.service';
import { Loader, Button, Modal } from '../components/common';
import AnularPedidoModal from '../components/pedidos/AnularPedidoModal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const MonitorPedidosPage = () => {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [pedidoDetalle, setPedidoDetalle] = useState(null);
  const [modalAnular, setModalAnular] = useState(false);
  const [pedidoAAnular, setPedidoAAnular] = useState(null);

  // Configuración de etapas del timeline
  const etapas = [
    {
      id: 'pendiente_aprobacion',
      label: 'Por Aprobar',
      icon: AlertCircle,
      color: 'orange',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-300',
      textColor: 'text-orange-700',
      iconBg: 'bg-orange-100'
    },
    {
      id: 'pendiente',
      label: 'Pendiente',
      icon: Clock,
      color: 'yellow',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-300',
      textColor: 'text-yellow-700',
      iconBg: 'bg-yellow-100'
    },
    {
      id: 'aprobado',
      label: 'Aprobado',
      icon: UserCheck,
      color: 'blue',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-300',
      textColor: 'text-blue-700',
      iconBg: 'bg-blue-100'
    },
    {
      id: 'listo_para_entrega',
      label: 'Listo',
      icon: Package,
      color: 'purple',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-300',
      textColor: 'text-purple-700',
      iconBg: 'bg-purple-100'
    },
    {
      id: 'entregado',
      label: 'Entregado',
      icon: Truck,
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-300',
      textColor: 'text-green-700',
      iconBg: 'bg-green-100'
    }
  ];

  useEffect(() => {
    fetchPedidos();
  }, []);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchPedidos, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchPedidos = async () => {
    try {
      const data = await pedidosService.listar();
      const pedidosArray = data.data?.pedidos || [];
      setPedidos(pedidosArray);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleAnular = async (pedidoId, motivo) => {
    try {
      const response = await pedidosService.anular(pedidoId, motivo);

      toast.success(response.message || 'Pedido anulado exitosamente', {
        duration: 5000
      });

      // Refrescar la lista de pedidos
      await fetchPedidos();

      // Cerrar modal de anulación
      setModalAnular(false);
      setPedidoAAnular(null);

      // Si el modal de detalles estaba abierto, cerrarlo también
      if (pedidoDetalle?.id === pedidoId) {
        setPedidoDetalle(null);
      }

      return response;
    } catch (error) {
      throw error; // Re-lanzar para que el modal lo maneje
    }
  };

  const handleAbrirModalAnular = (pedido) => {
    setPedidoAAnular(pedido);
    setModalAnular(true);
  };

  const pedidosFiltrados = pedidos.filter(pedido => {
    if (searchTerm === '') return true;
    return (
      pedido.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pedido.proyecto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pedido.usuario?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Agrupar pedidos por etapa
  const pedidosPorEtapa = etapas.reduce((acc, etapa) => {
    acc[etapa.id] = pedidosFiltrados.filter(p => {
      if (etapa.id === 'entregado') {
        return p.estado === 'entregado' || p.estado === 'completado';
      }
      return p.estado === etapa.id;
    });
    return acc;
  }, {});

  // Pedidos cancelados (se muestran aparte)
  const pedidosCancelados = pedidosFiltrados.filter(p => p.estado === 'cancelado');

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const created = new Date(date);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    if (diffMins > 0) return `${diffMins}m`;
    return 'ahora';
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-red-700" />
          <h1 className="text-xl font-bold text-gray-900">Monitor de Pedidos</h1>
          <span className="text-sm text-gray-500">
            ({pedidosFiltrados.length} pedidos)
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-48"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-red-700"
            />
            Auto
          </label>
          <Button onClick={fetchPedidos} size="sm" variant="outline">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Timeline Horizontal */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="h-full flex gap-3 overflow-x-auto pb-2">
          {etapas.map((etapa, index) => {
            const Icon = etapa.icon;
            const pedidosEtapa = pedidosPorEtapa[etapa.id] || [];

            return (
              <React.Fragment key={etapa.id}>
                {/* Columna de etapa */}
                <div className="flex-shrink-0 w-64 flex flex-col">
                  {/* Header de etapa */}
                  <div className={`${etapa.bgColor} ${etapa.borderColor} border-2 rounded-t-lg p-3 flex items-center gap-2`}>
                    <div className={`${etapa.iconBg} p-1.5 rounded-full`}>
                      <Icon className={`w-4 h-4 ${etapa.textColor}`} />
                    </div>
                    <span className={`font-semibold ${etapa.textColor}`}>{etapa.label}</span>
                    <span className={`ml-auto ${etapa.iconBg} ${etapa.textColor} px-2 py-0.5 rounded-full text-sm font-bold`}>
                      {pedidosEtapa.length}
                    </span>
                  </div>

                  {/* Lista de pedidos */}
                  <div className={`flex-1 ${etapa.bgColor} ${etapa.borderColor} border-2 border-t-0 rounded-b-lg p-2 overflow-y-auto`}>
                    <div className="space-y-2">
                      {pedidosEtapa.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          Sin pedidos
                        </div>
                      ) : (
                        pedidosEtapa.map(pedido => (
                          <div
                            key={pedido.id}
                            onClick={() => setPedidoDetalle(pedido)}
                            className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-1">
                              <span className="font-semibold text-gray-900 text-sm">
                                {pedido.ticket_id}
                              </span>
                              <span className="text-xs text-gray-500">
                                {getTimeAgo(pedido.created_at)}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 truncate mb-1">
                              {pedido.proyecto || pedido.equipo?.nombre || 'Sin asignar'}
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">
                                {pedido.detalles?.length || 0} artículos
                              </span>
                              <span className="text-gray-500 truncate max-w-[100px]">
                                {pedido.usuario?.nombre?.split(' ')[0]}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Flecha entre etapas */}
                {index < etapas.length - 1 && (
                  <div className="flex-shrink-0 flex items-center justify-center w-8">
                    <div className="flex flex-col items-center">
                      <ArrowRight className="w-6 h-6 text-gray-300" />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Sección de cancelados (si hay) */}
        {pedidosCancelados.length > 0 && (
          <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="font-semibold text-red-700">Cancelados ({pedidosCancelados.length})</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pedidosCancelados.map(pedido => (
                <div
                  key={pedido.id}
                  onClick={() => setPedidoDetalle(pedido)}
                  className="flex-shrink-0 bg-white rounded-lg p-2 shadow-sm border border-red-200 cursor-pointer hover:shadow-md w-48"
                >
                  <div className="font-semibold text-gray-900 text-sm">{pedido.ticket_id}</div>
                  <div className="text-xs text-gray-500 truncate">{pedido.proyecto || 'Sin proyecto'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Detalle */}
      {pedidoDetalle && (
        <Modal
          isOpen={!!pedidoDetalle}
          onClose={() => setPedidoDetalle(null)}
          title={`Pedido ${pedidoDetalle.ticket_id}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Timeline del pedido individual */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 overflow-x-auto">
              {etapas.map((etapa, index) => {
                const Icon = etapa.icon;
                const etapaIndex = etapas.findIndex(e => {
                  if (e.id === 'entregado') {
                    return pedidoDetalle.estado === 'entregado' || pedidoDetalle.estado === 'completado';
                  }
                  return e.id === pedidoDetalle.estado;
                });
                const isActive = index <= etapaIndex;
                const isCurrent = etapas[etapaIndex]?.id === etapa.id ||
                  (etapa.id === 'entregado' && (pedidoDetalle.estado === 'entregado' || pedidoDetalle.estado === 'completado'));

                return (
                  <React.Fragment key={etapa.id}>
                    <div className="flex flex-col items-center">
                      <div className={`p-2 rounded-full ${isActive ? etapa.iconBg : 'bg-gray-200'} ${isCurrent ? 'ring-2 ring-offset-2 ring-' + etapa.color + '-400' : ''}`}>
                        <Icon className={`w-4 h-4 ${isActive ? etapa.textColor : 'text-gray-400'}`} />
                      </div>
                      <span className={`text-xs mt-1 ${isActive ? etapa.textColor : 'text-gray-400'} font-medium`}>
                        {etapa.label}
                      </span>
                    </div>
                    {index < etapas.length - 1 && (
                      <div className={`flex-1 h-1 mx-2 rounded ${index < etapaIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Estado cancelado */}
            {pedidoDetalle.estado === 'cancelado' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700 font-medium">Este pedido fue cancelado</span>
              </div>
            )}

            {/* Info General */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Proyecto/Equipo:</span>
                <p className="font-medium">{pedidoDetalle.proyecto || pedidoDetalle.equipo?.nombre || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Tipo:</span>
                <p className="font-medium capitalize">{pedidoDetalle.tipo_pedido || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Creado por:</span>
                <p className="font-medium">{pedidoDetalle.usuario?.nombre || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Fecha:</span>
                <p className="font-medium">{formatDate(pedidoDetalle.created_at)}</p>
              </div>
            </div>

            {/* Observaciones */}
            {pedidoDetalle.observaciones && (
              <div className="text-sm">
                <span className="text-gray-500">Observaciones:</span>
                <p className="bg-gray-50 p-2 rounded mt-1">{pedidoDetalle.observaciones}</p>
              </div>
            )}

            {/* Artículos */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Artículos ({pedidoDetalle.detalles?.length || 0})</h4>
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Artículo</th>
                      <th className="text-center p-2">Cant.</th>
                      <th className="text-center p-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidoDetalle.detalles?.map((detalle, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{detalle.articulo?.nombre || `Artículo ${detalle.articulo_id}`}</td>
                        <td className="text-center p-2">{detalle.cantidad}</td>
                        <td className="text-center p-2">
                          {detalle.dispersado ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-600 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {/* Botón de anular (solo para supervisores/admin y si el pedido no está entregado/cancelado) */}
              <div>
                {user && ['supervisor', 'administrador'].includes(user.rol) &&
                  pedidoDetalle.estado !== 'entregado' &&
                  pedidoDetalle.estado !== 'completado' &&
                  pedidoDetalle.estado !== 'cancelado' && (
                    <Button
                      onClick={() => {
                        handleAbrirModalAnular(pedidoDetalle);
                      }}
                      variant="danger"
                      className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                    >
                      <RotateCcw size={16} />
                      Anular Pedido
                    </Button>
                  )}
              </div>

              <Button onClick={() => setPedidoDetalle(null)} variant="outline">
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Anulación */}
      <AnularPedidoModal
        isOpen={modalAnular}
        onClose={() => {
          setModalAnular(false);
          setPedidoAAnular(null);
        }}
        pedido={pedidoAAnular}
        onAnular={handleAnular}
      />
    </div>
  );
};

export default MonitorPedidosPage;
