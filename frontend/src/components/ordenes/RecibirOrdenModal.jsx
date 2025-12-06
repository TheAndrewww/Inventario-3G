import React, { useState, useEffect } from 'react';
import { X, PackageCheck, AlertCircle, Info, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import ordenesCompraService from '../../services/ordenesCompra.service';

const RecibirOrdenModal = ({ isOpen, onClose, orden, onSuccess }) => {
  const [articulos, setArticulos] = useState([]);
  const [observacionesGenerales, setObservacionesGenerales] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [mostrarModalCompletar, setMostrarModalCompletar] = useState(false);
  const [motivoCompletar, setMotivoCompletar] = useState('');
  const [completando, setCompletando] = useState(false);

  useEffect(() => {
    if (isOpen && orden) {
      // Inicializar artículos con cantidad recibida en 0
      const articulosIniciales = orden.detalles.map(detalle => ({
        detalle_id: detalle.id,
        articulo_id: detalle.articulo.id,
        nombre: detalle.articulo.nombre,
        unidad: detalle.articulo.unidad,
        imagen_url: detalle.articulo.imagen_url,
        cantidad_solicitada: parseFloat(detalle.cantidad_solicitada),
        cantidad_ya_recibida: parseFloat(detalle.cantidad_recibida) || 0,
        cantidad_pendiente: parseFloat(detalle.cantidad_solicitada) - (parseFloat(detalle.cantidad_recibida) || 0),
        cantidad_recibida: '', // Campo vacío por defecto
        observaciones: ''
      }));
      setArticulos(articulosIniciales);
      setObservacionesGenerales('');
      setErrores({});
    }
  }, [isOpen, orden]);

  const handleCantidadChange = (detalleId, valor) => {
    const valorNumerico = parseFloat(valor) || 0;

    setArticulos(articulos.map(art => {
      if (art.detalle_id === detalleId) {
        // Validar que no exceda lo pendiente
        const nuevosErrores = { ...errores };

        if (valorNumerico > art.cantidad_pendiente) {
          nuevosErrores[detalleId] = `Máximo permitido: ${art.cantidad_pendiente} ${art.unidad}`;
        } else if (valorNumerico < 0) {
          nuevosErrores[detalleId] = 'La cantidad debe ser mayor a 0';
        } else {
          delete nuevosErrores[detalleId];
        }

        setErrores(nuevosErrores);

        return {
          ...art,
          cantidad_recibida: valor
        };
      }
      return art;
    }));
  };

  const handleObservacionChange = (detalleId, valor) => {
    setArticulos(articulos.map(art =>
      art.detalle_id === detalleId ? { ...art, observaciones: valor } : art
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Filtrar solo artículos con cantidad recibida > 0
    const articulosConRecepcion = articulos.filter(art =>
      parseFloat(art.cantidad_recibida) > 0
    );

    if (articulosConRecepcion.length === 0) {
      toast.error('Debes ingresar al menos una cantidad recibida');
      return;
    }

    // Validar que no haya errores
    if (Object.keys(errores).length > 0) {
      toast.error('Corrige los errores antes de continuar');
      return;
    }

    try {
      setGuardando(true);

      const data = {
        articulos: articulosConRecepcion.map(art => ({
          detalle_id: art.detalle_id,
          cantidad_recibida: parseFloat(art.cantidad_recibida),
          observaciones: art.observaciones || null
        })),
        observaciones_generales: observacionesGenerales || null
      };

      const response = await ordenesCompraService.recibirMercancia(orden.id, data);

      toast.success(response.message || 'Recepción registrada exitosamente');

      if (onSuccess) {
        onSuccess(response.data);
      }

      onClose();
    } catch (error) {
      console.error('Error al recibir mercancía:', error);

      if (error.response?.data?.errores) {
        // Mostrar errores de validación del backend
        error.response.data.errores.forEach(err => toast.error(err));
      } else {
        toast.error(error.response?.data?.message || 'Error al recibir mercancía');
      }
    } finally {
      setGuardando(false);
    }
  };

  const calcularProgreso = () => {
    const totalSolicitado = articulos.reduce((sum, art) => sum + art.cantidad_solicitada, 0);
    const totalYaRecibido = articulos.reduce((sum, art) => sum + art.cantidad_ya_recibida, 0);
    const totalAhoraRecibido = articulos.reduce((sum, art) => {
      const cantidad = parseFloat(art.cantidad_recibida) || 0;
      return sum + cantidad;
    }, 0);

    const totalRecibido = totalYaRecibido + totalAhoraRecibido;
    const porcentaje = totalSolicitado > 0 ? Math.round((totalRecibido / totalSolicitado) * 100) : 0;

    return {
      porcentaje,
      totalSolicitado,
      totalYaRecibido,
      totalAhoraRecibido,
      totalRecibido
    };
  };

  const handleCompletarManualmente = async () => {
    if (!motivoCompletar.trim()) {
      toast.error('Debe proporcionar un motivo para completar la orden');
      return;
    }

    try {
      setCompletando(true);

      const response = await ordenesCompraService.completarManualmente(orden.id, motivoCompletar);

      toast.success(response.message || 'Orden completada manualmente');

      if (onSuccess) {
        onSuccess(response.data);
      }

      setMostrarModalCompletar(false);
      setMotivoCompletar('');
      onClose();
    } catch (error) {
      console.error('Error al completar orden:', error);
      toast.error(error.response?.data?.message || 'Error al completar la orden');
    } finally {
      setCompletando(false);
    }
  };

  const hayArticulosPendientes = articulos.some(art => art.cantidad_pendiente > 0);

  const progreso = calcularProgreso();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PackageCheck className="text-blue-600" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Recibir Mercancía
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Orden: {orden?.ticket_id} · Proveedor: {orden?.proveedor?.nombre}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={guardando}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progreso de recepción
            </span>
            <span className="text-sm font-bold text-blue-600">
              {progreso.porcentaje}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progreso.porcentaje}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
            <span>Ya recibido: {progreso.totalYaRecibido}</span>
            <span>Ahora: +{progreso.totalAhoraRecibido}</span>
            <span>Total: {progreso.totalRecibido} / {progreso.totalSolicitado}</span>
          </div>
        </div>

        {/* Contenido */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Información importante */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Instrucciones:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Ingresa la cantidad recibida para cada artículo</li>
                  <li>Puedes recibir parcialmente (no es necesario recibir todo)</li>
                  <li>No puedes exceder la cantidad pendiente de cada artículo</li>
                  <li>Deja en blanco los artículos que no recibiste</li>
                </ul>
              </div>
            </div>

            {/* Lista de artículos */}
            <div className="space-y-3">
              {articulos.map((articulo) => (
                <div
                  key={articulo.detalle_id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4 mb-3">
                    {/* Imagen del artículo */}
                    {articulo.imagen_url ? (
                      <img
                        src={articulo.imagen_url}
                        alt={articulo.nombre}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"%3E%3C/rect%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"%3E%3C/circle%3E%3Cpolyline points="21 15 16 10 5 21"%3E%3C/polyline%3E%3C/svg%3E';
                        }}
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </div>
                    )}

                    {/* Información del artículo */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {articulo.nombre}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span>Solicitado: <span className="font-medium">{articulo.cantidad_solicitada} {articulo.unidad}</span></span>
                        <span>Ya recibido: <span className="font-medium">{articulo.cantidad_ya_recibida} {articulo.unidad}</span></span>
                        <span className="text-blue-600 font-medium">
                          Pendiente: {articulo.cantidad_pendiente} {articulo.unidad}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cantidad recibida */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cantidad Recibida <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={articulo.cantidad_recibida}
                          onChange={(e) => handleCantidadChange(articulo.detalle_id, e.target.value)}
                          step="1"
                          min="0"
                          max={articulo.cantidad_pendiente}
                          placeholder="0"
                          disabled={guardando}
                          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-lg font-semibold text-center ${
                            errores[articulo.detalle_id]
                              ? 'border-red-300 focus:ring-red-500 bg-red-50'
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                          {articulo.unidad}
                        </span>
                      </div>
                      {errores[articulo.detalle_id] && (
                        <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
                          <AlertCircle size={14} />
                          <span>{errores[articulo.detalle_id]}</span>
                        </div>
                      )}
                    </div>

                    {/* Observaciones */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Observaciones (opcional)
                      </label>
                      <textarea
                        value={articulo.observaciones}
                        onChange={(e) => handleObservacionChange(articulo.detalle_id, e.target.value)}
                        placeholder="Ej: Llegó dañado, embalaje deteriorado..."
                        rows={2}
                        disabled={guardando}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Observaciones generales */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones Generales
              </label>
              <textarea
                value={observacionesGenerales}
                onChange={(e) => setObservacionesGenerales(e.target.value)}
                placeholder="Observaciones sobre toda la recepción (transportista, condiciones de entrega, etc.)"
                rows={3}
                disabled={guardando}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Footer con botones */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
            {/* Botón de completar orden (solo si hay pendientes) */}
            <div>
              {hayArticulosPendientes && (
                <button
                  type="button"
                  onClick={() => setMostrarModalCompletar(true)}
                  disabled={guardando}
                  className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2 font-medium text-sm"
                >
                  <CheckCircle size={18} />
                  Completar Orden
                </button>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={guardando}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando || Object.keys(errores).length > 0}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
              >
                {guardando ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <PackageCheck size={20} />
                    Registrar Recepción
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal de confirmación para completar orden */}
      {mostrarModalCompletar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-orange-600" size={28} />
                  <h2 className="text-xl font-bold text-gray-900">
                    Completar Orden Manualmente
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setMostrarModalCompletar(false);
                    setMotivoCompletar('');
                  }}
                  disabled={completando}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">⚠️ Atención</p>
                  <p>Esta acción marcará la orden como completada aunque haya artículos pendientes. Use esta opción solo si:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>El proveedor confirmó que no enviará el resto</li>
                    <li>Se decidió no recibir los artículos pendientes</li>
                    <li>Hay un acuerdo especial con el proveedor</li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo para completar la orden <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivoCompletar}
                  onChange={(e) => setMotivoCompletar(e.target.value)}
                  placeholder="Ej: El proveedor informó que no enviará el resto del pedido..."
                  rows={4}
                  disabled={completando}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalCompletar(false);
                  setMotivoCompletar('');
                }}
                disabled={completando}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCompletarManualmente}
                disabled={completando || !motivoCompletar.trim()}
                className="px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
              >
                {completando ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Completando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Completar Orden
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecibirOrdenModal;
