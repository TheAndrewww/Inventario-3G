import React, { useState } from 'react';
import Modal from '../common/Modal';
import { AlertTriangle, RotateCcw, Package, FileText, XCircle } from 'lucide-react';

const AnularPedidoModal = ({ isOpen, onClose, pedido, onAnular }) => {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const handleAnular = async () => {
    if (!motivo || motivo.trim().length === 0) {
      setError('Debes proporcionar un motivo para anular el pedido');
      return;
    }

    if (motivo.trim().length < 10) {
      setError('El motivo debe tener al menos 10 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await onAnular(pedido.id, motivo);
      setResultado(response.data);

      // Esperar 3 segundos antes de cerrar para que el usuario vea el resultado
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al anular el pedido');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMotivo('');
    setError('');
    setResultado(null);
    setLoading(false);
    onClose();
  };

  if (!pedido) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={resultado ? "Pedido Anulado Exitosamente" : "Anular Pedido"}
      size="lg"
      closeOnBackdropClick={!loading}
    >
      {!resultado ? (
        <>
          {/* Advertencia */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-semibold text-red-900 mb-2">
                  ¿Estás seguro de que deseas anular este pedido?
                </h4>
                <p className="text-sm text-red-700 mb-2">
                  Esta acción realizará las siguientes operaciones:
                </p>
                <ul className="text-sm text-red-700 space-y-1 ml-4 list-disc">
                  <li>Revertirá el stock de todos los artículos del pedido</li>
                  <li>Cancelará automáticamente las solicitudes de compra generadas</li>
                  <li>Marcará el pedido como cancelado permanentemente</li>
                  <li>Notificará al creador del pedido</li>
                </ul>
                <p className="text-sm text-red-700 mt-2 font-semibold">
                  Esta acción NO se puede deshacer.
                </p>
              </div>
            </div>
          </div>

          {/* Información del pedido */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h5 className="font-semibold text-gray-900 mb-3">Información del pedido</h5>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Ticket ID:</span>
                <span className="ml-2 font-semibold text-gray-900">{pedido.ticket_id}</span>
              </div>
              <div>
                <span className="text-gray-600">Estado:</span>
                <span className="ml-2 font-semibold text-gray-900">{pedido.estado}</span>
              </div>
              <div>
                <span className="text-gray-600">Proyecto:</span>
                <span className="ml-2 font-semibold text-gray-900">{pedido.proyecto || pedido.equipo?.nombre || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Total artículos:</span>
                <span className="ml-2 font-semibold text-gray-900">{pedido.detalles?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Campo de motivo */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Motivo de la anulación <span className="text-red-600">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setError('');
              }}
              placeholder="Ej: El pedido se creó por error / Material solicitado incorrecto / Proyecto cancelado..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows={4}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Mínimo 10 caracteres. Este motivo se registrará en el historial del pedido.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleAnular}
              disabled={loading || !motivo || motivo.trim().length < 10}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Anulando...
                </>
              ) : (
                <>
                  <XCircle size={20} />
                  Anular Pedido
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        /* Resultado de la anulación */
        <div className="space-y-6">
          {/* Mensaje de éxito */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 rounded-full p-2">
                <RotateCcw className="text-white" size={24} />
              </div>
              <div>
                <h4 className="font-semibold text-green-900">
                  {resultado.message}
                </h4>
                <p className="text-sm text-green-700 mt-1">
                  El pedido ha sido anulado y todos los cambios han sido revertidos correctamente.
                </p>
              </div>
            </div>
          </div>

          {/* Resumen de reversiones */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Package className="text-blue-600" size={20} />
                <div>
                  <p className="text-sm text-blue-600 font-medium">Stock Revertido</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {resultado.reversiones?.stock_revertido?.length || 0}
                  </p>
                  <p className="text-xs text-blue-700">artículos</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <FileText className="text-yellow-600" size={20} />
                <div>
                  <p className="text-sm text-yellow-600 font-medium">Solicitudes Canceladas</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {resultado.reversiones?.solicitudes_canceladas?.length || 0}
                  </p>
                  <p className="text-xs text-yellow-700">solicitudes</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-purple-600" size={20} />
                <div>
                  <p className="text-sm text-purple-600 font-medium">Órdenes Afectadas</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {resultado.reversiones?.ordenes_afectadas?.length || 0}
                  </p>
                  <p className="text-xs text-purple-700">órdenes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Detalles de stock revertido */}
          {resultado.reversiones?.stock_revertido && resultado.reversiones.stock_revertido.length > 0 && (
            <div>
              <h5 className="font-semibold text-gray-900 mb-3">Stock Revertido</h5>
              <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  {resultado.reversiones.stock_revertido.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm py-2 border-b border-gray-200 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.nombre}</p>
                        <p className="text-xs text-gray-600">ID: {item.articulo_id}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          +{item.cantidad_revertida} unidades
                        </p>
                        <p className="text-xs text-gray-600">
                          {item.stock_antes} → {item.stock_despues}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Detalles de solicitudes canceladas */}
          {resultado.reversiones?.solicitudes_canceladas && resultado.reversiones.solicitudes_canceladas.length > 0 && (
            <div>
              <h5 className="font-semibold text-gray-900 mb-3">Solicitudes de Compra Canceladas</h5>
              <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {resultado.reversiones.solicitudes_canceladas.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm py-2 border-b border-gray-200 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.ticket_id}</p>
                        <p className="text-xs text-gray-600">{item.articulo}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{item.cantidad} unidades</p>
                        <p className="text-xs text-gray-600">
                          Estado: {item.estado_anterior}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600 text-center">
            Esta ventana se cerrará automáticamente en unos segundos...
          </p>
        </div>
      )}
    </Modal>
  );
};

export default AnularPedidoModal;
