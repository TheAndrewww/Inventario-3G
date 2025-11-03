import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Users, Package, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import pedidosService from '../services/pedidos.service';
import { Button, Modal } from '../components/common';
import toast from 'react-hot-toast';

const RecibirPedidosPage = () => {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [mostrarModalRechazo, setMostrarModalRechazo] = useState(false);
  const [mostrarModalDetalle, setMostrarModalDetalle] = useState(false);
  const [mostrarModalConfirmarRecepcion, setMostrarModalConfirmarRecepcion] = useState(false);

  const cargarPedidos = async () => {
    try {
      setCargando(true);
      const response = await pedidosService.listarPendientesRecepcion();
      setPedidos(response.data.pedidos || []);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      toast.error('Error al cargar pedidos listos para recibir');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPedidos();
  }, []);

  const handleVerDetalle = async (pedido) => {
    try {
      setCargando(true);
      const response = await pedidosService.obtenerPorId(pedido.id);
      setPedidoSeleccionado(response.data?.pedido);
      setMostrarModalDetalle(true);
    } catch (error) {
      console.error('Error al cargar detalle del pedido:', error);
      toast.error('Error al cargar detalle del pedido');
    } finally {
      setCargando(false);
    }
  };

  const abrirModalConfirmarRecepcion = () => {
    setMostrarModalConfirmarRecepcion(true);
  };

  const cerrarModalConfirmarRecepcion = () => {
    setMostrarModalConfirmarRecepcion(false);
  };

  const handleRecibir = async () => {
    console.log('Confirmación aceptada, recibiendo pedido...');

    try {
      await pedidosService.recibir(pedidoSeleccionado.id);
      toast.success('Pedido recibido y completado exitosamente');
      setMostrarModalConfirmarRecepcion(false);
      setMostrarModalDetalle(false);
      setPedidoSeleccionado(null);
      cargarPedidos();
    } catch (error) {
      console.error('Error al recibir pedido:', error);
      toast.error(error.response?.data?.message || 'Error al recibir el pedido');
    }
  };

  const handleRechazar = async () => {
    if (!motivoRechazo.trim()) {
      toast.error('Debes proporcionar un motivo de rechazo');
      return;
    }

    try {
      await pedidosService.rechazarEntrega(pedidoSeleccionado.id, motivoRechazo);
      toast.success('Pedido rechazado. Volverá a pendientes para correcciones.');
      setMostrarModalRechazo(false);
      setMostrarModalDetalle(false);
      setMotivoRechazo('');
      setPedidoSeleccionado(null);
      cargarPedidos();
    } catch (error) {
      console.error('Error al rechazar pedido:', error);
      toast.error(error.response?.data?.message || 'Error al rechazar el pedido');
    }
  };

  const abrirModalRechazo = () => {
    setMostrarModalRechazo(true);
  };

  const cerrarModalRechazo = () => {
    setMostrarModalRechazo(false);
    setMotivoRechazo('');
  };

  const cerrarModalDetalle = () => {
    setMostrarModalDetalle(false);
    setPedidoSeleccionado(null);
  };

  if (cargando && pedidos.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-700"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recibir Pedidos</h1>
        <p className="text-gray-600 mt-1">
          Revisa y recibe los pedidos preparados por el almacén
        </p>
      </div>

      {pedidos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Clock size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay pedidos listos para recibir
          </h3>
          <p className="text-gray-600">
            Los pedidos preparados aparecerán aquí para su revisión y recepción
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
              onClick={() => handleVerDetalle(pedido)}
            >
              {/* Encabezado del pedido */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      Pedido #{pedido.ticket_id}
                    </h3>
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full flex items-center gap-1">
                      <CheckCircle size={14} />
                      Listo para Recibir
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {pedido.equipo && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users size={16} />
                        <span className="font-medium">Equipo:</span>
                        <span>{pedido.equipo?.nombre || 'N/A'}</span>
                      </div>
                    )}
                    {pedido.proyecto && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Package size={16} />
                        <span className="font-medium">Proyecto:</span>
                        <span>{pedido.proyecto}</span>
                      </div>
                    )}
                    {pedido.ubicacionDestino && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Package size={16} />
                        <span className="font-medium">Destino:</span>
                        <span>
                          {pedido.ubicacionDestino.almacen.includes('Camioneta') ? '🚛' : '📦'} {pedido.ubicacionDestino.almacen}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Package size={16} />
                      <span className="font-medium">Preparado por:</span>
                      <span>{pedido.usuario?.nombre || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock size={16} />
                      <span className="font-medium">Fecha:</span>
                      <span>{new Date(pedido.fecha_hora).toLocaleString('es-MX')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Package size={16} />
                      <span className="font-medium">Total artículos:</span>
                      <span className="font-bold">{pedido.detalles?.length || 0}</span>
                    </div>
                  </div>

                  {pedido.observaciones && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Observaciones:</span> {pedido.observaciones}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button className="text-green-700 hover:text-green-900 font-medium text-sm">
                Ver Checklist Completo →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalle del pedido */}
      <Modal
        isOpen={mostrarModalDetalle}
        onClose={cerrarModalDetalle}
        title="Checklist de Recepción"
        size="xl"
      >
        {pedidoSeleccionado && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-500">ID Ticket:</span>
                  <p className="font-mono font-bold text-gray-900">{pedidoSeleccionado.ticket_id}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Preparado por:</span>
                  <p className="text-gray-900">{pedidoSeleccionado.usuario?.nombre}</p>
                </div>
                {pedidoSeleccionado.proyecto && (
                  <div>
                    <span className="font-medium text-gray-500">Proyecto:</span>
                    <p className="font-semibold text-gray-900">{pedidoSeleccionado.proyecto}</p>
                  </div>
                )}
                {pedidoSeleccionado.ubicacionDestino && (
                  <div>
                    <span className="font-medium text-gray-500">Destino:</span>
                    <p className="font-semibold text-gray-900">
                      {pedidoSeleccionado.ubicacionDestino.almacen.includes('Camioneta') ? '🚛' : '📦'} {pedidoSeleccionado.ubicacionDestino.almacen}
                    </p>
                  </div>
                )}
                {pedidoSeleccionado.equipo && (
                  <div>
                    <span className="font-medium text-gray-500">Equipo:</span>
                    <p className="font-semibold text-gray-900">{pedidoSeleccionado.equipo.nombre}</p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-500">Fecha:</span>
                  <p className="text-gray-900">
                    {new Date(pedidoSeleccionado.fecha_hora).toLocaleString('es-MX')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-green-600" size={24} />
                <div>
                  <p className="font-semibold text-green-900">Pedido Preparado al 100%</p>
                  <p className="text-sm text-green-700">
                    Todos los artículos han sido preparados y están listos para su revisión
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Artículos del Pedido</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {pedidoSeleccionado.detalles?.map((detalle) => (
                  <div
                    key={detalle.id}
                    className="border-2 border-green-300 bg-green-50 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex-shrink-0">
                        <CheckSquare size={28} className="text-green-600" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h5 className="font-semibold text-green-900">
                              {detalle.articulo?.nombre}
                            </h5>
                            <p className="text-sm text-gray-600">
                              EAN-13: {detalle.articulo?.codigo_ean13}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">
                              {detalle.cantidad} {detalle.articulo?.unidad || 'uds'}
                            </p>
                          </div>
                        </div>

                        {detalle.articulo?.ubicacion && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <Package size={14} />
                            <span>
                              {detalle.articulo.ubicacion.codigo} - {detalle.articulo.ubicacion.almacen}
                              {detalle.articulo.ubicacion.pasillo && ` - Pasillo ${detalle.articulo.ubicacion.pasillo}`}
                              {detalle.articulo.ubicacion.estante && ` - Estante ${detalle.articulo.ubicacion.estante}`}
                            </span>
                          </div>
                        )}

                        {detalle.observaciones && (
                          <p className="text-sm text-gray-600 italic mt-2">{detalle.observaciones}</p>
                        )}

                        {detalle.dispersado && detalle.dispersadoPor && (
                          <div className="mt-2 text-sm text-green-700">
                            ✓ Preparado por {detalle.dispersadoPor.nombre} el{' '}
                            {new Date(detalle.fecha_dispersado).toLocaleString('es-MX')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {pedidoSeleccionado.observaciones && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-medium text-gray-700 mb-2">Observaciones:</h5>
                <p className="text-gray-900">{pedidoSeleccionado.observaciones}</p>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  abrirModalConfirmarRecepcion();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <CheckCircle size={20} />
                Recibir Pedido
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  abrirModalRechazo();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                <XCircle size={20} />
                Rechazar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de confirmación de recepción */}
      {mostrarModalConfirmarRecepcion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirmar Recepción</h3>
                <p className="text-sm text-gray-600">
                  ¿Has verificado que todo está correcto?
                </p>
              </div>
            </div>

            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-900 font-medium mb-2">
                Al confirmar la recepción:
              </p>
              <ul className="text-sm text-green-800 space-y-1">
                <li>✓ El pedido se marcará como completado</li>
                <li>✓ Se registrará la entrada al inventario</li>
                <li>✓ El equipo/usuario recibirá notificación</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={cerrarModalConfirmarRecepcion}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleRecibir}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                Sí, Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de rechazo */}
      {mostrarModalRechazo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Rechazar Pedido</h3>
                <p className="text-sm text-gray-600">
                  El pedido volverá a pendientes para correcciones
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de rechazo *
              </label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Explica qué está incorrecto o falta..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 resize-none"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={cerrarModalRechazo}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleRechazar}
                disabled={!motivoRechazo.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecibirPedidosPage;
