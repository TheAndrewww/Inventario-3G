import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { InventarioProvider, useInventario } from '../context/InventarioContext';
import { Button, Input, Loader, Modal, Card } from '../components/common';
import ArticuloCard from '../components/articulos/ArticuloCard';
import ArticuloForm from '../components/articulos/ArticuloForm';
import ArticuloDetalle from '../components/articulos/ArticuloDetalle';
import {
  Package,
  Plus,
  Search,
  Filter,
  LogOut,
  AlertCircle,
  Grid3x3,
  List
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InventarioContent = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    articulos,
    loading,
    error,
    pagination,
    fetchArticulos,
    crearArticulo,
    actualizarArticulo,
    eliminarArticulo,
    searchArticulos,
  } = useInventario();

  // Estados para modales
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [articuloSeleccionado, setArticuloSeleccionado] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'

  // Estadísticas
  const [stats, setStats] = useState({
    total: 0,
    stockBajo: 0,
    valorTotal: 0,
  });

  // Cargar artículos al montar el componente
  useEffect(() => {
    fetchArticulos();
  }, []);

  // Calcular estadísticas cuando cambien los artículos
  useEffect(() => {
    if (articulos.length > 0) {
      const stockBajo = articulos.filter(
        (art) => art.stock_actual <= art.stock_minimo
      ).length;

      const valorTotal = articulos.reduce((acc, art) => {
        return acc + parseFloat(art.stock_actual) * parseFloat(art.costo_unitario);
      }, 0);

      setStats({
        total: articulos.length,
        stockBajo,
        valorTotal,
      });
    }
  }, [articulos]);

  // Manejar búsqueda
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Búsqueda con debounce
    if (value.trim()) {
      searchArticulos({ search: value });
    } else {
      fetchArticulos();
    }
  };

  // Cerrar sesión
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Crear artículo
  const handleCrearArticulo = async (data) => {
    setLoadingModal(true);
    try {
      await crearArticulo(data);
      setModalCrear(false);
      // Mensaje de éxito (podrías usar un toast aquí)
      alert('¡Artículo creado exitosamente!');
    } catch (err) {
      alert('Error al crear artículo: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoadingModal(false);
    }
  };

  // Editar artículo
  const handleEditarArticulo = async (data) => {
    setLoadingModal(true);
    try {
      await actualizarArticulo(articuloSeleccionado.id, data);
      setModalEditar(false);
      setArticuloSeleccionado(null);
      alert('¡Artículo actualizado exitosamente!');
    } catch (err) {
      alert('Error al actualizar artículo: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoadingModal(false);
    }
  };

  // Eliminar artículo
  const handleEliminarArticulo = async (articulo) => {
    if (!confirm(`¿Estás seguro de desactivar "${articulo.nombre}"?`)) {
      return;
    }

    try {
      await eliminarArticulo(articulo.id);
      alert('Artículo desactivado exitosamente');
    } catch (err) {
      alert('Error al desactivar artículo: ' + (err.message || 'Error desconocido'));
    }
  };

  // Ver detalle
  const handleVerDetalle = (articulo) => {
    setArticuloSeleccionado(articulo);
    setModalDetalle(true);
  };

  // Abrir modal de edición
  const handleAbrirEditar = (articulo) => {
    setArticuloSeleccionado(articulo);
    setModalDetalle(false); // Cerrar modal de detalle si está abierto
    setModalEditar(true);
  };

  const canEdit = user?.rol === 'administrador';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Inventario 3G
                </h1>
                <p className="text-sm text-gray-600">
                  {user?.nombre} • {user?.rol}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => navigate('/historial')}
              >
                Historial
              </Button>
              <Button
                variant="outline"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => navigate('/pedido')}
              >
                Nuevo Pedido
              </Button>
              <Button
                variant="outline"
                icon={<LogOut className="w-4 h-4" />}
                onClick={handleLogout}
              >
                Salir
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Artículos</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <Package className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Stock Bajo</p>
                <p className="text-3xl font-bold text-orange-600">{stats.stockBajo}</p>
              </div>
              <AlertCircle className="w-12 h-12 text-orange-600 opacity-20" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valor Total</p>
                <p className="text-2xl font-bold text-green-600">
                  ${stats.valorTotal.toFixed(2)}
                </p>
              </div>
              <Package className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </Card>
        </div>

        {/* Barra de búsqueda y acciones */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Búsqueda */}
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Buscar artículos..."
                value={searchTerm}
                onChange={handleSearch}
                icon={<Search className="w-5 h-5 text-gray-400" />}
              />
            </div>

            {/* Acciones */}
            <div className="flex items-center space-x-3">
              {/* Cambiar vista */}
              <div className="flex rounded-lg border border-gray-300">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

              {canEdit && (
                <Button
                  icon={<Plus className="w-5 h-5" />}
                  onClick={() => setModalCrear(true)}
                >
                  Nuevo Artículo
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de artículos */}
        {loading && articulos.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <Loader size="lg" text="Cargando artículos..." />
          </div>
        ) : error ? (
          <Card>
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Error al cargar artículos
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => fetchArticulos()}>
                Reintentar
              </Button>
            </div>
          </Card>
        ) : articulos.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay artículos
              </h3>
              <p className="text-gray-600 mb-4">
                Comienza agregando tu primer artículo al inventario
              </p>
              {canEdit && (
                <Button
                  icon={<Plus className="w-5 h-5" />}
                  onClick={() => setModalCrear(true)}
                >
                  Crear Primer Artículo
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {articulos.map((articulo) => (
              <ArticuloCard
                key={articulo.id}
                articulo={articulo}
                onView={handleVerDetalle}
                onEdit={canEdit ? handleAbrirEditar : null}
                onDelete={canEdit ? handleEliminarArticulo : null}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear Artículo */}
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

      {/* Modal Editar Artículo */}
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

      {/* Modal Detalle Artículo */}
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
    </div>
  );
};

// Wrapper con el Provider
const InventarioPage = () => {
  return (
    <InventarioProvider>
      <InventarioContent />
    </InventarioProvider>
  );
};

export default InventarioPage;
