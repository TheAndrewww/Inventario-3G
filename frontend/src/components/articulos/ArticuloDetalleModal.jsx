import React, { useState, useEffect } from 'react';
import { X, Package, MapPin, DollarSign, Hash, Box, Edit } from 'lucide-react';
import { Modal } from '../common';
import BarcodeDisplay from './BarcodeDisplay';
import { getImageUrl } from '../../utils/imageUtils';

const ArticuloDetalleModal = ({ articulo, isOpen, onClose, onEdit, canEdit = false }) => {
  const [imagenExpandida, setImagenExpandida] = useState(false);

  // Cerrar imagen expandida con tecla Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && imagenExpandida) {
        setImagenExpandida(false);
      }
    };

    if (imagenExpandida) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [imagenExpandida]);

  if (!articulo) return null;

  const stockBajo = parseFloat(articulo.stock_actual) <= parseFloat(articulo.stock_minimo);

  const imagenUrl = getImageUrl(articulo.imagen_url);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles del Artículo">
      <div className="space-y-6">
        {/* Header con imagen y nombre */}
        <div className="border-b pb-4">
          <div className="flex items-start gap-4">
            {/* Imagen del artículo */}
            <div className="flex-shrink-0">
              {imagenUrl ? (
                <img
                  src={imagenUrl}
                  alt={articulo.nombre}
                  className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setImagenExpandida(true)}
                  title="Haz clic para ver la imagen en tamaño completo"
                />
              ) : (
                <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center text-4xl">
                  📦
                </div>
              )}
            </div>

            {/* Información del artículo */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {articulo.nombre}
              </h2>
              {articulo.descripcion && (
                <p className="text-gray-600">{articulo.descripcion}</p>
              )}
              <div className="mt-3">
                <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                  {articulo.categoria?.nombre || 'Sin categoría'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Código de barras */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-4 text-center">
            Código de Barras EAN-13
          </h3>
          <BarcodeDisplay
            articuloId={articulo.id}
            codigoEAN13={articulo.codigo_ean13}
          />
        </div>

        {/* Información del artículo */}
        <div className="grid grid-cols-2 gap-4">
          {/* Stock */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Box size={18} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Stock Actual</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${stockBajo ? 'text-red-600' : 'text-gray-900'}`}>
                {parseFloat(articulo.stock_actual).toFixed(0)}
              </span>
              <span className="text-sm text-gray-500">{articulo.unidad}</span>
            </div>
            {stockBajo && (
              <span className="inline-block mt-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                Stock bajo (mín: {parseFloat(articulo.stock_minimo).toFixed(0)})
              </span>
            )}
          </div>

          {/* Costo */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={18} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Costo Unitario</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              ${parseFloat(articulo.costo_unitario || 0).toFixed(2)}
            </div>
          </div>

          {/* Ubicación */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={18} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Ubicación</span>
            </div>
            <div className="text-sm text-gray-900">
              {articulo.ubicacion?.codigo || 'N/A'}
            </div>
            {articulo.ubicacion?.descripcion && (
              <div className="text-xs text-gray-500 mt-1">
                {articulo.ubicacion.descripcion}
              </div>
            )}
          </div>

          {/* Stock Mínimo */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package size={18} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Stock Mínimo</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {parseFloat(articulo.stock_minimo).toFixed(0)}
              </span>
              <span className="text-sm text-gray-500">{articulo.unidad}</span>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Cerrar
          </button>
          {canEdit && onEdit && (
            <button
              onClick={() => {
                onEdit(articulo);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors"
            >
              <Edit size={18} />
              Editar Artículo
            </button>
          )}
        </div>
      </div>

      {/* Modal de imagen expandida */}
      {imagenExpandida && imagenUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center justify-center p-4"
          onClick={() => setImagenExpandida(false)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setImagenExpandida(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              title="Cerrar (Esc)"
            >
              <X size={32} />
            </button>
            <img
              src={imagenUrl}
              alt={articulo.nombre}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-center mt-4 text-sm">
              {articulo.nombre}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ArticuloDetalleModal;
