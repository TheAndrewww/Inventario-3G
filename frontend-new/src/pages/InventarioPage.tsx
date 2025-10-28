import React, { useEffect, useState } from 'react';
import { Search, Package, Plus } from 'lucide-react';
import type { Articulo } from '../types';
import articulosService from '../services/articulos.service';
import { usePedido } from '../context/PedidoContext';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';

const InventarioPage: React.FC = () => {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { agregarArticulo } = usePedido();

  useEffect(() => {
    loadArticulos();
  }, []);

  const loadArticulos = async () => {
    try {
      const data = await articulosService.getAll();
      setArticulos(data);
    } catch (error) {
      toast.error('Error al cargar inventario');
    } finally {
      setLoading(false);
    }
  };

  const filteredArticulos = articulos.filter(item =>
    item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toString().includes(searchTerm) ||
    item.categoria?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAgregar = (articulo: Articulo) => {
    agregarArticulo(articulo, 1);
    toast.success(`${articulo.nombre} agregado al pedido`);
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre, ID o categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Package size={20} />
          Categorias
        </button>
        <button className="flex items-center gap-2 px-4 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800">
          <Plus size={20} />
          Nuevo Articulo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Articulo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicacion</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Unit.</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Accion</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredArticulos.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                      📦
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{item.nombre}</div>
                      {item.descripcion && (
                        <div className="text-sm text-gray-500">{item.descripcion}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {item.categoria?.nombre || 'Sin categoria'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.ubicacion?.codigo || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${item.stock_actual <= item.stock_minimo ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.stock_actual}
                    </span>
                    {item.stock_actual <= item.stock_minimo && (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Bajo</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${item.costo_unitario.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={() => handleAgregar(item)}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800"
                  >
                    <Plus size={16} />
                    Agregar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredArticulos.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Package size={64} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">No se encontraron articulos</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventarioPage;
