import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { InventarioProvider, useInventario } from '../context/InventarioContext';
import { usePedido } from '../context/PedidoContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Modal } from '../components/common';
import ArticuloForm from '../components/articulos/ArticuloForm';
import ArticuloDetalle from '../components/articulos/ArticuloDetalle';
import toast from 'react-hot-toast';
import {
  Package,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';

const InventarioContent = () => {
  const { user } = useAuth();
  const {
    articulos,
    loading,
    error,
    fetchArticulos,
    crearArticulo,
    actualizarArticulo,
    eliminarArticulo,
    searchArticulos,
  } = useInventario();

  const { agregarArticulo } = usePedido();

  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [articuloSeleccionado, setArticuloSeleccionado] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchArticulos();
  }, []);

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim()) {
      searchArticulos({ search: value });
    } else {
      fetchArticulos();
    }
  };

  const handleCrearArticulo = async (data) => {
    setLoadingModal(true);
    try {
      await crearArticulo(data);
      setModalCrear(false);
      toast.success('¡Artículo creado exitosamente!');
    } catch (err) {
      toast.error(err.message || 'Error al crear artículo');
    } finally {
      setLoadingModal(false);
    }
  };

  const handleEditarArticulo = async (data) => {
    setLoadingModal(true);
    try {
      await actualizarArticulo(articuloSeleccionado.id, data);
      setModalEditar(false);
      setArticuloSeleccionado(null);
      toast.success('¡Artículo actualizado exitosamente!');
    } catch (err) {
      toast.error(err.message || 'Error al actualizar artículo');
    } finally {
      setLoadingModal(false);
    }
  };

  const handleEliminarArticulo = async (articulo) => {
    if (!confirm(`¿Estás seguro de desactivar "${articulo.nombre}"?`)) return;
    try {
      await eliminarArticulo(articulo.id);
      toast.success('Artículo desactivado exitosamente');
    } catch (err) {
      toast.error(err.message || 'Error al desactivar artículo');
    }
  };

  const handleVerDetalle = (articulo) => {
    setArticuloSeleccionado(articulo);
    setModalDetalle(true);
  };

  const handleAbrirEditar = (articulo) => {
    setArticuloSeleccionado(articulo);
    setModalDetalle(false);
    setModalEditar(true);
  };

  const handleAgregarAlPedido = (articulo) => {
    agregarArticulo(articulo, 1, '');
    toast.success(`"${articulo.nombre}" agregado al pedido`);
  };

  const canEdit = user?.rol === 'administrador';

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Barra de búsqueda y acciones */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, ID o categoría..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Package size={20} />
            Categorías
          </button>
          {canEdit && (
            <button
              onClick={() => setModalCrear(true)}
              className="flex items-center gap-2 px-4 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
            >
              <Plus size={20} />
              Nuevo Artículo
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-700"></div>
              <p className="text-gray-600 mt-4">Cargando artículos...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          ) : articulos.length === 0 ? (
            <div className="text-center py-12">
              <Package size={64} className="mx-auto mb-4 text-gray-400" />
              <p className="text-lg text-gray-600">No hay artículos</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Artículo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ubicación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Costo Unit.
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {articulos.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package size={20} className="text-gray-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{item.nombre}</div>
                          <div className="text-sm text-gray-500">{item.descripcion}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {item.categoria?.nombre || 'Sin categoría'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.ubicacion?.codigo || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${
                            item.stock_actual <= item.stock_minimo
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}
                        >
                          {item.stock_actual}
                        </span>
                        {item.stock_actual <= item.stock_minimo && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                            Bajo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${parseFloat(item.costo_unitario).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      <button
                        onClick={() => handleVerDetalle(item)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="Ver detalle"
                      >
                        <Eye size={16} />
                      </button>
                      {canEdit && (
                        <>
                          <button
                            onClick={() => handleAbrirEditar(item)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-blue-700 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleEliminarArticulo(item)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleAgregarAlPedido(item)}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800 transition-colors"
                      >
                        <Plus size={16} />
                        Agregar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modales */}
      <Modal
        isOpen={modalCrear}
        onClose={() => setModalCrear(false)}
        title="Crear Nuevo Artículo"
        size="lg"
      >
        <ArticuloForm
          onSubmit={handleCrearArticulo}
          onCancel={() => setModalCrear(false)}
          loading={loadingModal}
        />
      </Modal>

      <Modal
        isOpen={modalEditar}
        onClose={() => {
          setModalEditar(false);
          setArticuloSeleccionado(null);
        }}
        title="Editar Artículo"
        size="lg"
      >
        <ArticuloForm
          articulo={articuloSeleccionado}
          onSubmit={handleEditarArticulo}
          onCancel={() => {
            setModalEditar(false);
            setArticuloSeleccionado(null);
          }}
          loading={loadingModal}
        />
      </Modal>

      <Modal
        isOpen={modalDetalle}
        onClose={() => {
          setModalDetalle(false);
          setArticuloSeleccionado(null);
        }}
        title="Detalle del Artículo"
        size="lg"
      >
        <ArticuloDetalle
          articulo={articuloSeleccionado}
          onClose={() => {
            setModalDetalle(false);
            setArticuloSeleccionado(null);
          }}
          onEdit={canEdit ? handleAbrirEditar : null}
        />
      </Modal>
    </DashboardLayout>
  );
};

const InventarioPage = () => {
  return (
    <InventarioProvider>
      <InventarioContent />
    </InventarioProvider>
  );
};

export default InventarioPage;
