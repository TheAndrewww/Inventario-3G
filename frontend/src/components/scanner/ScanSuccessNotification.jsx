import React, { useEffect, useState } from 'react';
import { CheckCircle, Package, X } from 'lucide-react';
import { getImageUrl } from '../../utils/imageUtils';

/**
 * Componente de notificación visual cuando se escanea y agrega un artículo exitosamente
 */
const ScanSuccessNotification = ({ articulo, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Auto-cerrar después de 3 segundos
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Esperar animación antes de desmontar
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!articulo) return null;

  const imagenUrl = articulo.imagen_url ? getImageUrl(articulo.imagen_url) : null;

  return (
    <div
      className={`fixed top-20 right-4 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <div className="bg-white rounded-lg shadow-2xl border-2 border-green-500 p-4 min-w-[320px] max-w-md">
        <div className="flex items-start gap-3">
          {/* Icono de éxito */}
          <div className="flex-shrink-0 bg-green-100 rounded-full p-2">
            <CheckCircle className="text-green-600" size={24} />
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-bold text-green-800 text-sm">
                ✓ Artículo agregado al pedido
              </h4>
              <button
                onClick={() => {
                  setVisible(false);
                  setTimeout(onClose, 300);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Info del artículo */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
              {imagenUrl ? (
                <img
                  src={imagenUrl}
                  alt={articulo.nombre}
                  className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package size={24} className="text-gray-400" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">
                  {articulo.nombre}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {articulo.codigo_ean13}
                </p>
                <p className="text-xs text-green-600 font-medium mt-1">
                  Stock disponible: {articulo.stock_actual} {articulo.unidad}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-3000"
            style={{
              width: visible ? '0%' : '100%',
              transition: 'width 3s linear',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ScanSuccessNotification;
