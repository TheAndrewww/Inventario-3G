import React, { useState, useEffect } from 'react';
import { X, Package, Trash2, Plus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import articulosService from '../../services/articulos.service';
import proveedoresService from '../../services/proveedores.service';
import ordenesCompraService from '../../services/ordenesCompra.service';

const EditarOrdenModal = ({ isOpen, onClose, orden, onSuccess }) => {
  const [articulos, setArticulos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fechaLlegadaEstimada, setFechaLlegadaEstimada] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);

  useEffect(() => {
    if (isOpen && orden) {
      cargarDatos();
    }
  }, [isOpen, orden]);

  const cargarDatos = async () => {
    try {
      // Cargar catálogos
      const [artResult, provResult] = await Promise.allSettled([
        articulosService.getAll(),
        proveedoresService.listar()
      ]);

      // Procesar artículos
      if (artResult.status === 'fulfilled') {
        const artData = artResult.value;
        const articulosArray = Array.isArray(artData) ? artData : [];
        setArticulos(articulosArray);
      }

      // Procesar proveedores
      if (provResult.status === 'fulfilled') {
        const provData = provResult.value;
        const proveedoresArray = Array.isArray(provData)
          ? provData
          : (provData?.data?.proveedores || provData?.data || []);
        setProveedores(proveedoresArray);
      }

      // Pre-cargar datos de la orden
      setProveedorId(orden.proveedor_id || '');
      setObservaciones(orden.observaciones || '');
      setFechaLlegadaEstimada(orden.fecha_llegada_estimada ?
        orden.fecha_llegada_estimada.split('T')[0] : '');

      // Pre-cargar artículos de la orden
      const articulosOrden = orden.detalles.map(detalle => ({
        articulo_id: detalle.articulo.id,
        articulo: detalle.articulo,
        cantidad: parseFloat(detalle.cantidad_solicitada),
        costo_unitario: parseFloat(detalle.costo_unitario)
      }));
      setArticulosSeleccionados(articulosOrden);

    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos');
    }
  };

  const articulosFiltrados = articulos.filter((art) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      art.nombre?.toLowerCase().includes(searchLower) ||
      art.codigo_ean13?.includes(searchTerm)
    );
  });

  const handleSeleccionarArticulo = (articulo) => {
    const yaExiste = articulosSeleccionados.find(item => item.articulo_id === articulo.id);

    if (yaExiste) {
      toast.error('Este artículo ya está en la lista');
      return;
    }

    setArticulosSeleccionados([
      ...articulosSeleccionados,
      {
        articulo_id: articulo.id,
        articulo: articulo,
        cantidad: 1,
        costo_unitario: articulo.costo_unitario || 0
      }
    ]);

    setSearchTerm('');
    setMostrarCatalogo(false);
    toast.success(`${articulo.nombre} agregado`);
  };

  const handleRemoverArticulo = (index) => {
    setArticulosSeleccionados(articulosSeleccionados.filter((_, i) => i !== index));
  };

  const handleCantidadChange = (index, cantidad) => {
    const nuevosArticulos = [...articulosSeleccionados];
    nuevosArticulos[index].cantidad = cantidad;
    setArticulosSeleccionados(nuevosArticulos);
  };

  const handleCostoChange = (index, costo) => {
    const nuevosArticulos = [...articulosSeleccionados];
    nuevosArticulos[index].costo_unitario = costo;
    setArticulosSeleccionados(nuevosArticulos);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (articulosSeleccionados.length === 0) {
      toast.error('Debe agregar al menos un artículo');
      return;
    }

    try {
      setLoading(true);
      const ordenData = {
        articulos: articulosSeleccionados.map(item => ({
          articulo_id: parseInt(item.articulo_id),
          cantidad: parseFloat(item.cantidad),
          costo_unitario: parseFloat(item.costo_unitario)
        })),
        proveedor_id: proveedorId ? parseInt(proveedorId) : undefined,
        observaciones: observaciones.trim() || undefined,
        fecha_llegada_estimada: fechaLlegadaEstimada || undefined
      };

      const response = await ordenesCompraService.actualizarOrden(orden.id, ordenData);

      toast.success('Orden de compra actualizada exitosamente');

      if (onSuccess) {
        onSuccess(response.data?.orden);
      }

      onClose();
    } catch (error) {
      console.error('Error al actualizar orden:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar la orden de compra');
    } finally {
      setLoading(false);
    }
  };

  const calcularTotal = () => {
    return articulosSeleccionados.reduce((sum, item) => {
      const cantidad = parseFloat(item.cantidad) || 0;
      const costo = parseFloat(item.costo_unitario) || 0;
      return sum + (cantidad * costo);
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="text-orange-600" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Editar Orden de Compra
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {orden?.ticket_id}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Proveedor y Fecha */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor (Opcional)
                </label>
                <select
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Sin proveedor específico</option>
                  {proveedores.map((prov) => (
                    <option key={prov.id} value={prov.id}>
                      {prov.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Llegada Estimada (Opcional)
                </label>
                <input
                  type="date"
                  value={fechaLlegadaEstimada}
                  onChange={(e) => setFechaLlegadaEstimada(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones (Opcional)
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                disabled={loading}
                rows={2}
                placeholder="Observaciones sobre la orden..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {/* Buscador de artículos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agregar Artículos
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setMostrarCatalogo(e.target.value.length > 0);
                  }}
                  onFocus={() => searchTerm.length > 0 && setMostrarCatalogo(true)}
                  disabled={loading}
                  placeholder="Buscar artículo por nombre o código..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />

                {/* Catálogo de artículos */}
                {mostrarCatalogo && articulosFiltrados.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {articulosFiltrados.slice(0, 10).map((articulo) => (
                      <button
                        key={articulo.id}
                        type="button"
                        onClick={() => handleSeleccionarArticulo(articulo)}
                        className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900">{articulo.nombre}</div>
                        <div className="text-sm text-gray-600">
                          Stock: {articulo.stock_actual} {articulo.unidad}
                          {articulo.codigo_ean13 && ` • ${articulo.codigo_ean13}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Lista de artículos seleccionados */}
            {articulosSeleccionados.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Artículos en la Orden ({articulosSeleccionados.length})
                </h3>
                <div className="space-y-3">
                  {articulosSeleccionados.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{item.articulo.nombre}</h4>
                          <p className="text-sm text-gray-600">
                            Unidad: {item.articulo.unidad}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoverArticulo(index)}
                          disabled={loading}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Cantidad *
                          </label>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => handleCantidadChange(index, e.target.value)}
                            min="1"
                            step="1"
                            required
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Costo Unitario
                          </label>
                          <input
                            type="number"
                            value={item.costo_unitario}
                            onChange={(e) => handleCostoChange(index, e.target.value)}
                            min="0"
                            step="0.01"
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </div>

                      <div className="mt-2 text-right text-sm font-semibold text-gray-900">
                        Subtotal: ${(parseFloat(item.cantidad) * parseFloat(item.costo_unitario)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                    <span>Total Estimado:</span>
                    <span className="text-orange-600">${calcularTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {articulosSeleccionados.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">No hay artículos en la orden</p>
                  <p>Busca y selecciona al menos un artículo para actualizar la orden</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || articulosSeleccionados.length === 0}
              className="px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <Package size={20} />
                  Actualizar Orden
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarOrdenModal;
