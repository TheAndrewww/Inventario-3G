import React, { useState, useEffect } from 'react';
import {
  Clock,
  Package,
  CheckCircle,
  Send,
  AlertCircle,
  FileText,
  User,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  TrendingUp
} from 'lucide-react';
import ordenesCompraService from '../../services/ordenesCompra.service';
import { Loader } from './index';
import toast from 'react-hot-toast';

const TimelineHistorial = ({ ordenId }) => {
  const [historial, setHistorial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mostrarArbolDependencias, setMostrarArbolDependencias] = useState(false);

  useEffect(() => {
    if (ordenId) {
      fetchHistorial();
    }
  }, [ordenId]);

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      const response = await ordenesCompraService.obtenerHistorial(ordenId);
      setHistorial(response.data);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      toast.error('Error al cargar el historial de trazabilidad');
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (tipo) => {
    const iconos = {
      pedido_creado: { icon: FileText, color: 'bg-blue-100 text-blue-600' },
      pedido_aprobado: { icon: CheckCircle, color: 'bg-green-100 text-green-600' },
      solicitud_creada: { icon: AlertCircle, color: 'bg-orange-100 text-orange-600' },
      orden_creada: { icon: Package, color: 'bg-purple-100 text-purple-600' },
      orden_enviada: { icon: Send, color: 'bg-blue-100 text-blue-600' },
      orden_recibida: { icon: CheckCircle, color: 'bg-green-100 text-green-600' }
    };
    return iconos[tipo] || { icon: Clock, color: 'bg-gray-100 text-gray-600' };
  };

  const formatearFecha = (fecha) => {
    const date = new Date(fecha);
    return {
      fecha: date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      hora: date.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader />
      </div>
    );
  }

  if (!historial) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle size={48} className="mx-auto mb-2 text-gray-300" />
        <p>No se pudo cargar el historial de trazabilidad</p>
      </div>
    );
  }

  const { timeline, arbolDependencias, estadisticas } = historial;

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Eventos</p>
              <p className="text-2xl font-bold text-gray-900">{timeline.length}</p>
            </div>
            <Clock className="text-gray-400" size={24} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Solicitudes</p>
              <p className="text-2xl font-bold text-orange-600">{estadisticas.total_solicitudes}</p>
            </div>
            <AlertCircle className="text-orange-400" size={24} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Pedidos Origen</p>
              <p className="text-2xl font-bold text-blue-600">{estadisticas.total_pedidos_origen}</p>
            </div>
            <FileText className="text-blue-400" size={24} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Usuarios</p>
              <p className="text-2xl font-bold text-purple-600">{estadisticas.usuarios_involucrados}</p>
            </div>
            <User className="text-purple-400" size={24} />
          </div>
        </div>
      </div>

      {/* Timeline de Eventos */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-red-700" />
          Línea de Tiempo
        </h3>

        <div className="relative">
          {/* Línea vertical */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Eventos */}
          <div className="space-y-6">
            {timeline.map((evento, index) => {
              const { icon: IconComponent, color } = getEventIcon(evento.tipo);
              const { fecha, hora } = formatearFecha(evento.fecha);

              return (
                <div key={index} className="relative flex items-start gap-4 pl-2">
                  {/* Icono del evento */}
                  <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
                    <IconComponent size={20} />
                  </div>

                  {/* Contenido del evento */}
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{evento.titulo}</h4>
                        <p className="text-sm text-gray-600 mt-1">{evento.descripcion}</p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-xs font-medium text-gray-900">{fecha}</p>
                        <p className="text-xs text-gray-500">{hora}</p>
                      </div>
                    </div>

                    {/* Usuario */}
                    {evento.usuario && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                        <User size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-600">
                          {evento.usuario.nombre}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                          {evento.usuario.rol}
                        </span>
                      </div>
                    )}

                    {/* Datos adicionales */}
                    {evento.datos && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {evento.datos.ticket_id && (
                            <div>
                              <span className="text-gray-500">Ticket: </span>
                              <span className="font-medium text-gray-900">{evento.datos.ticket_id}</span>
                            </div>
                          )}
                          {evento.datos.proyecto && (
                            <div>
                              <span className="text-gray-500">Proyecto: </span>
                              <span className="font-medium text-gray-900">{evento.datos.proyecto}</span>
                            </div>
                          )}
                          {evento.datos.articulo && (
                            <div>
                              <span className="text-gray-500">Artículo: </span>
                              <span className="font-medium text-gray-900">{evento.datos.articulo}</span>
                            </div>
                          )}
                          {evento.datos.cantidad && (
                            <div>
                              <span className="text-gray-500">Cantidad: </span>
                              <span className="font-medium text-gray-900">{evento.datos.cantidad}</span>
                            </div>
                          )}
                          {evento.datos.prioridad && (
                            <div>
                              <span className="text-gray-500">Prioridad: </span>
                              <span className={`font-medium ${
                                evento.datos.prioridad === 'ALTA' || evento.datos.prioridad === 'urgente'
                                  ? 'text-red-600'
                                  : evento.datos.prioridad === 'MEDIA' || evento.datos.prioridad === 'media'
                                  ? 'text-orange-600'
                                  : 'text-gray-600'
                              }`}>
                                {evento.datos.prioridad}
                              </span>
                            </div>
                          )}
                          {evento.datos.proveedor && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Proveedor: </span>
                              <span className="font-medium text-gray-900">{evento.datos.proveedor}</span>
                            </div>
                          )}
                          {evento.datos.total_estimado && (
                            <div>
                              <span className="text-gray-500">Total: </span>
                              <span className="font-medium text-gray-900">
                                ${parseFloat(evento.datos.total_estimado).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Árbol de Dependencias */}
      {arbolDependencias.solicitudes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <button
            onClick={() => setMostrarArbolDependencias(!mostrarArbolDependencias)}
            className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 hover:text-red-700 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Package size={20} className="text-red-700" />
              Árbol de Dependencias
            </span>
            {mostrarArbolDependencias ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </button>

          {mostrarArbolDependencias && (
            <div className="mt-4 space-y-4">
              {/* Orden de Compra Principal */}
              <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-600 text-white rounded-full p-2">
                    <Package size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-purple-900">
                      Orden de Compra {arbolDependencias.orden.ticket_id}
                    </h4>
                    <p className="text-sm text-purple-700">
                      Estado: {arbolDependencias.orden.estado} • Total: ${parseFloat(arbolDependencias.orden.total_estimado).toFixed(2)}
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      Proveedor: {arbolDependencias.orden.proveedor}
                    </p>
                  </div>
                </div>
              </div>

              {/* Flecha */}
              <div className="flex justify-center">
                <div className="text-gray-400">
                  <ChevronDown size={24} />
                </div>
              </div>

              {/* Solicitudes de Compra */}
              <div className="pl-8 border-l-2 border-orange-300 space-y-3">
                {arbolDependencias.solicitudes.map((solicitud, index) => (
                  <div key={index} className="relative">
                    {/* Línea horizontal */}
                    <div className="absolute -left-8 top-1/2 w-8 h-0.5 bg-orange-300" />

                    <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div className="bg-orange-500 text-white rounded-full p-2 flex-shrink-0">
                          <AlertCircle size={16} />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold text-orange-900">
                            Solicitud {solicitud.ticket_id}
                          </h5>
                          <p className="text-sm text-orange-700">
                            {solicitud.articulo} • Cantidad: {solicitud.cantidad} • Prioridad: {solicitud.prioridad}
                          </p>

                          {/* Pedido Origen si existe */}
                          {solicitud.pedido_origen && (
                            <>
                              <div className="flex justify-start mt-2">
                                <ArrowRight size={16} className="text-orange-400" />
                              </div>

                              <div className="mt-2 bg-blue-50 border border-blue-300 rounded p-2">
                                <div className="flex items-center gap-2">
                                  <div className="bg-blue-500 text-white rounded-full p-1">
                                    <FileText size={12} />
                                  </div>
                                  <div className="text-xs">
                                    <p className="font-semibold text-blue-900">
                                      Pedido {solicitud.pedido_origen.ticket_id}
                                    </p>
                                    <p className="text-blue-700">
                                      {solicitud.pedido_origen.proyecto} • {solicitud.pedido_origen.usuario}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mensaje si no hay dependencias */}
      {arbolDependencias.solicitudes.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Orden sin solicitudes asociadas</h4>
              <p className="text-sm text-blue-700">
                Esta orden de compra fue creada manualmente y no tiene solicitudes de compra asociadas generadas automáticamente.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineHistorial;
