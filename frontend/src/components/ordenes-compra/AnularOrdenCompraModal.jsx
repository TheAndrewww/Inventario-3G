import React, { useState } from 'react';
import Modal from '../common/Modal';
import { AlertTriangle, RotateCcw, Package, FileText, XCircle } from 'lucide-react';

const AnularOrdenCompraModal = ({ isOpen, onClose, orden, onAnular }) => {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const handleAnular = async () => {
    if (!motivo || motivo.trim().length === 0) {
      setError('Debes proporcionar un motivo para anular la orden de compra');
      return;
    }

    if (motivo.trim().length < 10) {
      setError('El motivo debe tener al menos 10 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await onAnular(orden.id, motivo);
      setResultado(response.data);

      // Esperar 3 segundos antes de cerrar para que el usuario vea el resultado
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al anular la orden de compra');
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

  if (!orden) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={resultado ? "Orden de Compra Anulada Exitosamente" : "Anular Orden de Compra"}
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
                  ¿Estás seguro de que deseas anular esta orden de compra?
                </h4>
                <p className="text-sm text-red-700 mb-2">
                  Esta acción realizará las siguientes operaciones:
                </p>
                <ul className="text-sm text-red-700 space-y-1 ml-4 list-disc">
                  <li>Revertirá el stock si la orden ya fue recibida (parcial o totalmente)</li>
                  <li>Reactivará automáticamente las solicitudes de compra vinculadas</li>
                  <li>Marcará la orden como cancelada permanentemente</li>
                  <li>Notificará a los usuarios de compras y administradores</li>
                </ul>
                <p className="text-sm text-red-700 mt-2 font-semibold">
                  Esta acción NO se puede deshacer.
                </p>
              </div>
            </div>
          </div>

          {/* Información de la orden */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h5 className="font-semibold text-gray-900 mb-3">Información de la orden</h5>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Ticket ID:</span>
                <span className="ml-2 font-semibold text-gray-900">{orden.ticket_id}</span>
              </div>
              <div>
                <span className="text-gray-600">Estado:</span>
                <span className="ml-2 font-semibold text-gray-900">{orden.estado}</span>
              </div>
              <div>
                <span className="text-gray-600">Proveedor:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {orden.proveedor?.nombre || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Total estimado:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  ${parseFloat(orden.total_estimado || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Total artículos:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {orden.detalles?.length || 0}
                </span>
              </div>
              {orden.solicitudes_origen && orden.solicitudes_origen.length > 0 && (
                <div>
                  <span className="text-gray-600">Solicitudes vinculadas:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {orden.solicitudes_origen.length}
                  </span>
                </div>
              )}
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
              placeholder="Ej: Error en la orden / Proveedor no disponible / Orden duplicada / Cambio de proveedor..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows={4}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Mínimo 10 caracteres. Este motivo se registrará en el historial de la orden.
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
                  Anular Orden
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
                  La orden ha sido anulada y todos los cambios han sido revertidos correctamente.
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
                  <p className="text-sm text-yellow-600 font-medium">Solicitudes Reactivadas</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {resultado.reversiones?.solicitudes_reactivadas?.length || 0}
                  </p>
                  <p className="text-xs text-yellow-700">solicitudes</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-purple-600" size={20} />
                <div>
                  <p className="text-sm text-purple-600 font-medium">Movimientos Creados</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {resultado.reversiones?.movimientos_creados?.length || 0}
                  </p>
                  <p className="text-xs text-purple-700">movimientos</p>
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
                        <p className="font-semibold text-red-600">
                          -{item.cantidad_revertida} unidades
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

          {/* Detalles de solicitudes reactivadas */}
          {resultado.reversiones?.solicitudes_reactivadas && resultado.reversiones.solicitudes_reactivadas.length > 0 && (
            <div>
              <h5 className="font-semibold text-gray-900 mb-3">Solicitudes de Compra Reactivadas</h5>
              <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {resultado.reversiones.solicitudes_reactivadas.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm py-2 border-b border-gray-200 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.ticket_id}</p>
                        <p className="text-xs text-gray-600">{item.articulo}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{item.cantidad} unidades</p>
                        <p className="text-xs text-green-600">
                          Estado: Pendiente
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

export default AnularOrdenCompraModal;
