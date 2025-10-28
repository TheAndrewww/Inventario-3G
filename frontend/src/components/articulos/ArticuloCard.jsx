import { Package, MapPin, Tag, AlertCircle, Eye, Edit2, Trash2, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

const ArticuloCard = ({ articulo, onView, onEdit, onDelete, canEdit = false }) => {
  const getStockStatus = () => {
    const percentage = (articulo.stock_actual / articulo.stock_minimo) * 100;

    if (articulo.stock_actual <= articulo.stock_minimo) {
      return {
        color: 'red',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        badge: 'bg-red-100 text-red-700',
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'Stock Crítico'
      };
    } else if (percentage < 150) {
      return {
        color: 'yellow',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-700',
        badge: 'bg-yellow-100 text-yellow-700',
        icon: <TrendingDown className="w-4 h-4" />,
        label: 'Stock Bajo'
      };
    }

    return {
      color: 'green',
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      badge: 'bg-green-100 text-green-700',
      icon: <Package className="w-4 h-4" />,
      label: 'Stock Normal'
    };
  };

  const stockStatus = getStockStatus();

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group"
    >
      {/* Header decorativo con gradiente */}
      <div className={`h-2 ${stockStatus.bg} border-b ${stockStatus.border}`}></div>

      <div className="p-7">
        {/* Header con título y badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate mb-1 group-hover:text-blue-600 transition-colors">
              {articulo.nombre}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2 h-10">
              {articulo.descripcion || 'Sin descripción'}
            </p>
          </div>

          {/* Badge de estado de stock */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`ml-3 flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${stockStatus.badge} flex items-center space-x-1`}
          >
            {stockStatus.icon}
            <span className="hidden xl:inline">{stockStatus.label}</span>
          </motion.div>
        </div>

        {/* Grid de información */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Categoría */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 text-gray-500">
              <Tag className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Categoría</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {articulo.categoria?.nombre || 'N/A'}
            </p>
          </div>

          {/* Ubicación */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 text-gray-500">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Ubicación</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {articulo.ubicacion?.codigo || 'N/A'}
            </p>
          </div>
        </div>

        {/* Stock y costo destacados */}
        <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="text-xs text-gray-500 mb-1">Stock Actual</p>
            <p className={`text-2xl font-bold ${stockStatus.text}`}>
              {articulo.stock_actual}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {articulo.unidad} • Mín: {articulo.stock_minimo}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Costo Unitario</p>
            <p className="text-2xl font-bold text-gray-900">
              ${parseFloat(articulo.costo_unitario).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">MXN</p>
          </div>
        </div>

        {/* Footer con ID y acciones */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500 font-mono">
            ID: {articulo.id}
          </div>

          <div className="flex space-x-1">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onView && onView(articulo)}
              className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
              title="Ver detalles"
            >
              <Eye className="w-4 h-4" />
            </motion.button>

            {canEdit && (
              <>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onEdit && onEdit(articulo)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onDelete && onDelete(articulo)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ArticuloCard;
