import React, { useState, useEffect } from 'react';
import { ClipboardList, CheckSquare, Square, Package, User, Calendar, AlertCircle, Edit2, Plus, Minus, Trash2, Save, X, Truck, Send, XCircle, CheckCircle } from 'lucide-react';
import pedidosService from '../services/pedidos.service';
import { Loader, Modal } from '../components/common';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const PedidosPendientesPage = () => {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [editandoCantidad, setEditandoCantidad] = useState(null);
  const [supervisores, setSupervisores] = useState([]);
  const [supervisorSeleccionado, setSupervisorSeleccionado] = useState('');
  const [showModalMarcarListo, setShowModalMarcarListo] = useState(false);
  const [showModalAnular, setShowModalAnular] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [pedidoAAnular, setPedidoAAnular] = useState(null);
  const { user } = useAuth();
  const esAdmin = user?.rol === 'administrador';

  useEffect(() => {
    cargarPedidosPendientes();
  }, []);

  const cargarPedidosPendientes = async () => {
    try {
      setLoading(true);
      const response = await pedidosService.listarPendientes();
      setPedidos(response.data?.pedidos || []);
    } catch (error) {
      console.error('Error al cargar pedidos pendientes:', error);
      toast.error('Error al cargar pedidos pendientes');
    } finally {
      setLoading(false);
    }
  };

  const cargarSupervisores = async () => {
    try {
      const response = await pedidosService.listarSupervisores();
      setSupervisores(response.data?.supervisores || []);
    } catch (error) {
      console.error('Error al cargar supervisores:', error);
      toast.error('Error al cargar supervisores');
    }
  };

  const handleAbrirModalMarcarListo = async () => {
    if (pedidoSeleccionado.progreso_dispersion !== 100) {
      toast.error('Debes completar todos los artículos antes de marcar como listo');
      return;
    }
    await cargarSupervisores();
    setShowModalMarcarListo(true);
  };

  const handleMarcarListo = async () => {
    if (!supervisorSeleccionado) {
      toast.error('Debes seleccionar un supervisor');
      return;
    }

    try {
      setProcesando(true);
      await pedidosService.marcarListo(pedidoSeleccionado.id, supervisorSeleccionado);
      toast.success('Pedido marcado como listo. El supervisor lo recibirá para aprobación.');
      setShowModalMarcarListo(false);
      setShowModal(false);
      setSupervisorSeleccionado('');
      await cargarPedidosPendientes();
    } catch (error) {
      console.error('Error al marcar pedido como listo:', error);
      toast.error(error.response?.data?.message || 'Error al marcar pedido como listo');
    } finally {
      setProcesando(false);
    }
  };

  const handleVerDetalle = async (pedido) => {
    try {
      setLoading(true);
      const response = await pedidosService.obtenerPorId(pedido.id);
      setPedidoSeleccionado(response.data?.pedido);
      setShowModal(true);
    } catch (error) {
      console.error('Error al cargar detalle del pedido:', error);
      toast.error('Error al cargar detalle del pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarArticulo = async (pedidoId, detalleId, dispersado) => {
    try {
      setProcesando(true);
      await pedidosService.marcarDispersado(pedidoId, detalleId, dispersado);
      toast.success(dispersado ? 'Artículo marcado como preparado' : 'Artículo desmarcado');

      const response = await pedidosService.obtenerPorId(pedidoId);
      setPedidoSeleccionado(response.data?.pedido);
      await cargarPedidosPendientes();
    } catch (error) {
      console.error('Error al actualizar artículo:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar artículo');
    } finally {
      setProcesando(false);
    }
  };

  const handleEditarCantidad = (detalleId, cantidadActual) => {
    setEditandoCantidad({ detalleId, cantidad: cantidadActual });
  };

  const handleGuardarCantidad = async () => {
    if (!editandoCantidad || editandoCantidad.cantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    try {
      setProcesando(true);
      await pedidosService.actualizarCantidad(
        pedidoSeleccionado.id,
        editandoCantidad.detalleId,
        editandoCantidad.cantidad
      );
      toast.success('Cantidad actualizada exitosamente');

      const response = await pedidosService.obtenerPorId(pedidoSeleccionado.id);
      setPedidoSeleccionado(response.data?.pedido);
      setEditandoCantidad(null);
      await cargarPedidosPendientes();
    } catch (error) {
      console.error('Error al actualizar cantidad:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar cantidad');
    } finally {
      setProcesando(false);
    }
  };

  const handleEliminarArticulo = async (pedidoId, detalleId) => {
    if (!confirm('¿Estás seguro de eliminar este artículo del pedido?')) {
      return;
    }

    try {
      setProcesando(true);
      await pedidosService.eliminarArticulo(pedidoId, detalleId);
      toast.success('Art�culo eliminado del pedido');

      const response = await pedidosService.obtenerPorId(pedidoId);
      setPedidoSeleccionado(response.data?.pedido);
      await cargarPedidosPendientes();
    } catch (error) {
      console.error('Error al eliminar artículo:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar artículo');
    } finally {
      setProcesando(false);
    }
  };

  const handleAbrirModalAnular = (pedido, e) => {
    e.stopPropagation();
    setPedidoAAnular(pedido);
    setMotivoAnulacion('');
    setShowModalAnular(true);
  };

  const handleAnularPedido = async () => {
    if (!motivoAnulacion || motivoAnulacion.trim().length < 10) {
      toast.error('El motivo de anulación debe tener al menos 10 caracteres');
      return;
    }

    try {
      setProcesando(true);
      const response = await pedidosService.anular(pedidoAAnular.id, motivoAnulacion);
      toast.success(response.message || 'Pedido anulado exitosamente. Stock y solicitudes revertidas.');
      setShowModalAnular(false);
      setPedidoAAnular(null);
      setMotivoAnulacion('');
      await cargarPedidosPendientes();
    } catch (error) {
      console.error('Error al anular pedido:', error);
      toast.error(error.response?.data?.message || 'Error al anular pedido');
    } finally {
      setProcesando(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setPedidoSeleccionado(null);
    setEditandoCantidad(null);
  };

  const getProgresoColor = (porcentaje) => {
    if (porcentaje === 0) return 'bg-red-500';
    if (porcentaje < 50) return 'bg-orange-500';
    if (porcentaje < 100) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleEntregarDirecto = async () => {
    if (!confirm('¿Marcar este pedido como ENTREGADO directamente?\n\nEsto saltará el flujo de supervisor y marcará todos los artículos como preparados automáticamente.')) {
      return;
    }

    try {
      setProcesando(true);
      await pedidosService.entregarDirecto(pedidoSeleccionado.id);
      toast.success('Pedido marcado como entregado exitosamente');
      setShowModal(false);
      await cargarPedidosPendientes();
    } catch (error) {
      console.error('Error al entregar pedido:', error);
      toast.error(error.response?.data?.message || 'Error al entregar pedido');
    } finally {
      setProcesando(false);
    }
  };

  if (loading && pedidos.length === 0) {
    return <Loader fullScreen />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos Pendientes</h1>
        <p className="text-gray-500 mt-1">Gestiona y prepara los pedidos de materiales</p>
      </div>

      {pedidos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <ClipboardList size={64} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay pedidos pendientes</h3>
          <p className="text-gray-500">Todos los pedidos han sido completados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleVerDetalle(pedido)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      {pedido.ubicacionDestino ? (
                        <>
                          {pedido.ubicacionDestino.almacen.includes('Camioneta') ? '🚛' : '📦'} {pedido.ubicacionDestino.almacen}
                        </>
                      ) : (
                        pedido.proyecto || 'Sin especificar'
                      )}
                    </h3>
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                      Pendiente
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={16} />
                      <span className="font-mono">{pedido.ticket_id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      <span>{pedido.usuario?.nombre || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span>{new Date(pedido.fecha_hora).toLocaleDateString('es-MX')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-gray-600">Progreso de preparación</span>
                  <span className="font-semibold text-gray-900">
                    {pedido.progreso_dispersion || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${getProgresoColor(pedido.progreso_dispersion || 0)}`}
                    style={{ width: `${pedido.progreso_dispersion || 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {pedido.detalles?.length || 0} artículos totales
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleAbrirModalAnular(pedido, e)}
                    className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:text-white hover:bg-red-600 border border-red-600 rounded-lg font-medium transition-colors"
                  >
                    <XCircle size={16} />
                    Anular
                  </button>
                  <button className="text-red-700 hover:text-red-900 font-medium">
                    Ver Checklist →
                  </button>
                </div>
              </div>

              {pedido.motivo_rechazo && (
                <div className="mt-3 pt-3 border-t border-red-100 bg-red-50 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-red-800 mb-1">Pedido devuelto - Motivo:</p>
                      <p className="text-sm text-red-700">{pedido.motivo_rechazo}</p>
                    </div>
                  </div>
                </div>
              )}

              {pedido.observaciones && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 font-medium mb-1">Observaciones:</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{pedido.observaciones}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title="Checklist de Preparación"
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
                  <span className="font-medium text-gray-500">Destino:</span>
                  <p className="font-semibold text-gray-900">
                    {pedidoSeleccionado.ubicacionDestino ? (
                      <>
                        {pedidoSeleccionado.ubicacionDestino.almacen.includes('Camioneta') ? '🚛' : '📦'} {pedidoSeleccionado.ubicacionDestino.almacen}
                      </>
                    ) : (
                      pedidoSeleccionado.proyecto || 'Sin especificar'
                    )}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Solicitante:</span>
                  <p className="text-gray-900">{pedidoSeleccionado.usuario?.nombre}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Fecha:</span>
                  <p className="text-gray-900">
                    {new Date(pedidoSeleccionado.fecha_hora).toLocaleDateString('es-MX')}
                  </p>
                </div>
              </div>
            </div>

            {pedidoSeleccionado.motivo_rechazo && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
                  <div className="flex-1">
                    <h4 className="font-bold text-red-900 mb-2">⚠️ Pedido Devuelto por el Supervisor</h4>
                    <div className="bg-white rounded-lg p-3 border border-red-200">
                      <p className="text-sm font-semibold text-red-800 mb-1">Motivo del rechazo:</p>
                      <p className="text-sm text-red-700">{pedidoSeleccionado.motivo_rechazo}</p>
                    </div>
                    <p className="text-xs text-red-600 mt-2 italic">
                      Por favor, revisa y corrige el pedido según las indicaciones antes de reenviarlo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="text-blue-600" size={20} />
                <span className="font-semibold text-blue-900">
                  Progreso: {pedidoSeleccionado.progreso_dispersion || 0}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${pedidoSeleccionado.progreso_dispersion || 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Artículos a Preparar</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {pedidoSeleccionado.detalles?.map((detalle) => (
                  <div
                    key={detalle.id}
                    className={`border-2 rounded-lg p-4 transition-all ${detalle.dispersado
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => handleMarcarArticulo(
                          pedidoSeleccionado.id,
                          detalle.id,
                          !detalle.dispersado
                        )}
                        disabled={procesando}
                        className="mt-1 flex-shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
                      >
                        {detalle.dispersado ? (
                          <CheckSquare size={28} className="text-green-600" />
                        ) : (
                          <Square size={28} className="text-gray-400" />
                        )}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h5 className={`font-semibold ${detalle.dispersado ? 'text-green-900' : 'text-gray-900'}`}>
                              {detalle.articulo?.nombre}
                            </h5>
                            <p className="text-sm text-gray-600">
                              EAN-13: {detalle.articulo?.codigo_ean13}
                            </p>
                          </div>

                          <div className="text-right">
                            {editandoCantidad?.detalleId === detalle.id ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditandoCantidad({
                                    ...editandoCantidad,
                                    cantidad: Math.max(1, editandoCantidad.cantidad - 1)
                                  })}
                                  className="w-8 h-8 border-2 border-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-50"
                                >
                                  <Minus size={16} className="text-blue-600" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={editandoCantidad.cantidad}
                                  onChange={(e) => setEditandoCantidad({
                                    ...editandoCantidad,
                                    cantidad: parseInt(e.target.value) || 1
                                  })}
                                  className="w-16 text-center border-2 border-blue-500 rounded-lg font-bold"
                                />
                                <button
                                  onClick={() => setEditandoCantidad({
                                    ...editandoCantidad,
                                    cantidad: editandoCantidad.cantidad + 1
                                  })}
                                  className="w-8 h-8 border-2 border-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-50"
                                >
                                  <Plus size={16} className="text-blue-600" />
                                </button>
                                <button
                                  onClick={handleGuardarCantidad}
                                  disabled={procesando}
                                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                  <Save size={16} />
                                </button>
                                <button
                                  onClick={() => setEditandoCantidad(null)}
                                  className="p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="text-lg font-bold text-gray-900">
                                    {detalle.cantidad} {detalle.articulo?.unidad || 'uds'}
                                  </p>
                                  {detalle.articulo?.stock_actual !== undefined && (
                                    <p className={`text-sm ${detalle.articulo.stock_actual >= detalle.cantidad
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                      }`}>
                                      Stock: {detalle.articulo.stock_actual}
                                    </p>
                                  )}
                                </div>
                                {!detalle.dispersado && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleEditarCantidad(detalle.id, detalle.cantidad)}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Editar cantidad"
                                    >
                                      <Edit2 size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleEliminarArticulo(pedidoSeleccionado.id, detalle.id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Eliminar art�culo"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
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
                             Preparado por {detalle.dispersadoPor.nombre} el{' '}
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

            {pedidoSeleccionado.progreso_dispersion === 100 && (
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                <button
                  onClick={handleAbrirModalMarcarListo}
                  disabled={procesando}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
                >
                  <Send size={20} />
                  Marcar como Listo para Entrega
                </button>
                <p className="text-sm text-gray-600 text-center">
                  El pedido será enviado al supervisor para su recepción
                </p>

                {esAdmin && (
                  <button
                    onClick={handleEntregarDirecto}
                    disabled={procesando}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
                  >
                    <CheckCircle size={20} />
                    Marcar como Terminado (Admin)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal para seleccionar supervisor */}
      {showModalMarcarListo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Send size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Marcar como Listo</h3>
                <p className="text-sm text-gray-600">
                  Selecciona el supervisor que recibirá el pedido
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supervisor *
              </label>
              <select
                value={supervisorSeleccionado}
                onChange={(e) => setSupervisorSeleccionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
                autoFocus
              >
                <option value="">Selecciona un supervisor...</option>
                {supervisores.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.nombre} - {supervisor.puesto || 'Supervisor'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModalMarcarListo(false);
                  setSupervisorSeleccionado('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleMarcarListo}
                disabled={!supervisorSeleccionado || procesando}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {procesando ? 'Enviando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para anular pedido */}
      {showModalAnular && pedidoAAnular && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Anular Pedido</h3>
                <p className="text-sm text-gray-600">
                  {pedidoAAnular.ticket_id}
                </p>
              </div>
            </div>

            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">
                ⚠️ Esta acción anulará completamente el pedido y:
              </p>
              <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside space-y-1">
                <li>Revertirá el stock de todos los artículos</li>
                <li>Cancelará las solicitudes de compra asociadas</li>
                <li>Esta acción NO puede deshacerse</li>
              </ul>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de anulación *
              </label>
              <textarea
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Escribe el motivo de la anulación (mínimo 10 caracteres)..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                rows={4}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                {motivoAnulacion.length}/10 caracteres mínimos
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModalAnular(false);
                  setPedidoAAnular(null);
                  setMotivoAnulacion('');
                }}
                disabled={procesando}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAnularPedido}
                disabled={motivoAnulacion.trim().length < 10 || procesando}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {procesando ? 'Anulando...' : 'Anular Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidosPendientesPage;
