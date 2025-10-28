import { useState, useEffect } from 'react';
import { useInventario } from '../../context/InventarioContext';
import { usePedido } from '../../context/PedidoContext';
import { Button, Input, Card } from '../common';
import { Search, Plus, Package, AlertCircle, CheckCircle } from 'lucide-react';

const AgregarArticulo = ({ onClose, onArticuloAgregado }) => {
  const { articulos, fetchArticulos, searchArticulos, loading } = useInventario();
  const { agregarArticulo, estaEnCarrito } = usePedido();

  const [searchTerm, setSearchTerm] = useState('');
  const [articuloSeleccionado, setArticuloSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState(null);

  // Cargar artículos al montar
  useEffect(() => {
    if (articulos.length === 0) {
      fetchArticulos();
    }
  }, []);

  // Manejar búsqueda
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.trim()) {
      searchArticulos({ search: value });
    } else {
      fetchArticulos();
    }
  };

  // Seleccionar artículo
  const handleSelectArticulo = (articulo) => {
    setArticuloSeleccionado(articulo);
    setCantidad(1);
    setObservaciones('');
    setError(null);
  };

  // Validar cantidad
  const validarCantidad = () => {
    if (!cantidad || cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return false;
    }

    if (cantidad > articuloSeleccionado.stock_actual) {
      setError(
        `No hay suficiente stock. Disponible: ${articuloSeleccionado.stock_actual} ${articuloSeleccionado.unidad}`
      );
      return false;
    }

    return true;
  };

  // Agregar al carrito
  const handleAgregar = () => {
    if (!articuloSeleccionado) {
      setError('Selecciona un artículo primero');
      return;
    }

    if (!validarCantidad()) {
      return;
    }

    try {
      agregarArticulo(articuloSeleccionado, cantidad, observaciones);

      // Notificar al padre
      if (onArticuloAgregado) {
        onArticuloAgregado(articuloSeleccionado);
      }

      // Limpiar selección
      setArticuloSeleccionado(null);
      setCantidad(1);
      setObservaciones('');
      setError(null);
      setSearchTerm('');

      // Mostrar mensaje de éxito
      alert(`"${articuloSeleccionado.nombre}" agregado al carrito`);

      // Cerrar modal si se proporcionó callback
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Error al agregar el artículo');
    }
  };

  return (
    <div className="space-y-4">
      {/* Búsqueda */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Buscar Artículo
        </label>
        <Input
          placeholder="Nombre o descripción del artículo..."
          value={searchTerm}
          onChange={handleSearch}
          icon={<Search className="w-5 h-5 text-gray-400" />}
        />
      </div>

      {/* Lista de artículos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Artículos Disponibles
        </label>
        <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Cargando artículos...
            </div>
          ) : articulos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No se encontraron artículos
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {articulos.map((articulo) => {
                const yaEnCarrito = estaEnCarrito(articulo.id);
                const stockBajo = articulo.stock_actual <= articulo.stock_minimo;

                return (
                  <button
                    key={articulo.id}
                    onClick={() => handleSelectArticulo(articulo)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      articuloSeleccionado?.id === articulo.id
                        ? 'bg-blue-50 border-l-4 border-blue-600'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">
                            {articulo.nombre}
                          </h4>
                          {yaEnCarrito && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                              En carrito
                            </span>
                          )}
                          {stockBajo && (
                            <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                              Stock bajo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {articulo.descripcion}
                        </p>
                        <div className="flex items-center mt-2 text-xs text-gray-500">
                          <Package className="w-3 h-3 mr-1" />
                          Stock: {articulo.stock_actual} {articulo.unidad} •
                          Costo: ${parseFloat(articulo.costo_unitario).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Formulario de cantidad (solo si hay artículo seleccionado) */}
      {articuloSeleccionado && (
        <Card className="bg-blue-50 border-blue-200">
          <h4 className="font-semibold text-gray-900 mb-3">
            Agregar: {articuloSeleccionado.nombre}
          </h4>

          <div className="space-y-3">
            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad
              </label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={articuloSeleccionado.stock_actual}
                  value={cantidad}
                  onChange={(e) => {
                    setCantidad(parseFloat(e.target.value) || 0);
                    setError(null);
                  }}
                  className="flex-1"
                />
                <span className="text-sm text-gray-600">
                  {articuloSeleccionado.unidad}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Disponible: {articuloSeleccionado.stock_actual}{' '}
                {articuloSeleccionado.unidad}
              </p>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones (opcional)
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                placeholder="Notas sobre este artículo..."
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Subtotal */}
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="text-sm text-gray-700">Subtotal:</span>
              <span className="text-lg font-semibold text-blue-600">
                ${(cantidad * parseFloat(articuloSeleccionado.costo_unitario)).toFixed(2)} MXN
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={handleAgregar}
          disabled={!articuloSeleccionado}
          icon={<Plus className="w-5 h-5" />}
        >
          Agregar al Carrito
        </Button>
      </div>
    </div>
  );
};

export default AgregarArticulo;
