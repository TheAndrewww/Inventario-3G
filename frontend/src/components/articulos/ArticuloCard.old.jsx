import { Package, MapPin, Tag, AlertCircle, Eye, Edit2, Trash2 } from 'lucide-react';
import { Button, Card } from '../common';

const ArticuloCard = ({ articulo, onView, onEdit, onDelete, canEdit = false }) => {
  const getStockColor = () => {
    if (articulo.stock_actual <= articulo.stock_minimo) {
      return 'text-red-600 bg-red-50';
    }
    return 'text-green-600 bg-green-50';
  };

  const getStockIcon = () => {
    if (articulo.stock_actual <= articulo.stock_minimo) {
      return <AlertCircle className="w-4 h-4" />;
    }
    return null;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
              {articulo.nombre}
            </h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {articulo.descripcion || 'Sin descripción'}
            </p>
          </div>
          {canEdit && (
            <div className="ml-2">
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${articulo.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {articulo.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          )}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Categoría */}
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Categoría</p>
              <p className="text-sm font-medium text-gray-900">
                {articulo.categoria?.nombre || 'N/A'}
              </p>
            </div>
          </div>

          {/* Ubicación */}
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Ubicación</p>
              <p className="text-sm font-medium text-gray-900">
                {articulo.ubicacion?.codigo || 'N/A'}
              </p>
            </div>
          </div>

          {/* Stock */}
          <div className="flex items-center space-x-2">
            <Package className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Stock</p>
              <p className={`text-sm font-bold flex items-center ${getStockColor()}`}>
                {getStockIcon()}
                <span className="ml-1">{articulo.stock_actual} {articulo.unidad}</span>
              </p>
            </div>
          </div>

          {/* Costo */}
          <div>
            <p className="text-xs text-gray-500">Costo Unitario</p>
            <p className="text-sm font-medium text-gray-900">
              ${parseFloat(articulo.costo_unitario).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Footer con acciones */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            ID: {articulo.id} • Mínimo: {articulo.stock_minimo}
          </div>

          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<Eye className="w-4 h-4" />}
              onClick={() => onView && onView(articulo)}
            >
              Ver
            </Button>

            {canEdit && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Edit2 className="w-4 h-4" />}
                  onClick={() => onEdit && onEdit(articulo)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 className="w-4 h-4 text-red-600" />}
                  onClick={() => onDelete && onDelete(articulo)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ArticuloCard;
