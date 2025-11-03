import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Loader2, Search } from 'lucide-react';
import { Modal } from '../common';
import toast from 'react-hot-toast';
import articulosService from '../../services/articulos.service';
import pedidosService from '../../services/pedidos.service';

const CrearPedidoModal = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [proyecto, setProyecto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [articulos, setArticulos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [articulosBusqueda, setArticulosBusqueda] = useState([]);
  const [buscando, setBuscando] = useState(false);

  const buscarArticulos = async (query) => {
    if (!query || query.length < 2) {
      setArticulosBusqueda([]);
      return;
    }

    try {
      setBuscando(true);
      const response = await articulosService.buscar({ busqueda: query, limit: 10 });
      setArticulosBusqueda(response.data?.articulos || []);
    } catch (error) {
      console.error('Error al buscar artículos:', error);
    } finally {
      setBuscando(false);
    }
  };

  const agregarArticulo = (articulo) => {
    // Verificar si ya está agregado
    if (articulos.find(a => a.articulo_id === articulo.id)) {
      toast.error('El artículo ya está en el pedido');
      return;
    }

    setArticulos([...articulos, {
      articulo_id: articulo.id,
      articulo: articulo,
      cantidad: 1,
      observaciones: ''
    }]);

    setBusqueda('');
    setArticulosBusqueda([]);
  };

  const actualizarCantidad = (index, cantidad) => {
    const nuevosArticulos = [...articulos];
    nuevosArticulos[index].cantidad = Math.max(1, parseFloat(cantidad) || 1);
    setArticulos(nuevosArticulos);
  };

  const actualizarObservaciones = (index, obs) => {
    const nuevosArticulos = [...articulos];
    nuevosArticulos[index].observaciones = obs;
    setArticulos(nuevosArticulos);
  };

  const eliminarArticulo = (index) => {
    setArticulos(articulos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (articulos.length === 0) {
      toast.error('Debes agregar al menos un artículo al pedido');
      return;
    }

    if (!proyecto.trim()) {
      toast.error('El nombre del proyecto es requerido');
      return;
    }

    try {
      setLoading(true);

      const data = {
        proyecto: proyecto.trim(),
        observaciones: observaciones.trim() || null,
        articulos: articulos.map(a => ({
          articulo_id: a.articulo_id,
          cantidad: a.cantidad,
          observaciones: a.observaciones || null
        }))
      };

      await pedidosService.crear(data);

      toast.success('Pedido creado exitosamente');

      // Limpiar formulario
      setProyecto('');
      setObservaciones('');
      setArticulos([]);

      if (onSuccess) onSuccess();
      onClose();

    } catch (error) {
      console.error('Error al crear pedido:', error);
      toast.error(error.response?.data?.message || 'Error al crear el pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setProyecto('');
      setObservaciones('');
      setArticulos([]);
      setBusqueda('');
      setArticulosBusqueda([]);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Crear Pedido de Materiales"
      size="large"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Proyecto */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Proyecto <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={proyecto}
            onChange={(e) => setProyecto(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            placeholder="Nombre del proyecto u obra"
            required
            disabled={loading}
          />
        </div>

        {/* Buscar artículos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Agregar Artículos <span className="text-red-600">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                buscarArticulos(e.target.value);
              }}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Buscar artículo por nombre o código..."
              disabled={loading}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />

            {/* Resultados de búsqueda */}
            {busqueda && articulosBusqueda.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {articulosBusqueda.map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => agregarArticulo(art)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium">{art.nombre}</div>
                    <div className="text-sm text-gray-500">
                      Stock: {art.stock_actual} {art.unidad} | {art.categoria?.nombre}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {busqueda && buscando && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
                <Loader2 className="animate-spin mx-auto" size={24} />
              </div>
            )}
          </div>
        </div>

        {/* Lista de artículos agregados */}
        {articulos.length > 0 && (
          <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="font-medium text-gray-700 mb-3">Artículos en el pedido ({articulos.length})</h3>
            <div className="space-y-3">
              {articulos.map((item, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium">{item.articulo.nombre}</div>
                      <div className="text-sm text-gray-500">
                        Stock disponible: {item.articulo.stock_actual} {item.articulo.unidad}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarArticulo(index)}
                      className="text-red-600 hover:text-red-700 ml-2"
                      disabled={loading}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
                      <input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) => actualizarCantidad(index, e.target.value)}
                        min="1"
                        step="0.01"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Observaciones</label>
                      <input
                        type="text"
                        value={item.observaciones}
                        onChange={(e) => actualizarObservaciones(index, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Opcional"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Observaciones generales */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones Generales
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            placeholder="Observaciones del pedido..."
            disabled={loading}
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || articulos.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Save size={18} />
                Crear Pedido
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CrearPedidoModal;
