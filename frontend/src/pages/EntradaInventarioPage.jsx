import React, { useState, useRef, useEffect } from 'react';
import { PackagePlus, Search, Trash2, Save, X, Plus, ScanLine } from 'lucide-react';
import articulosService from '../services/articulos.service';
import movimientosService from '../services/movimientos.service';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import EAN13ScannerEntrada from '../components/scanner/EAN13ScannerEntrada';

const EntradaInventarioPage = () => {
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  const [todosArticulos, setTodosArticulos] = useState([]);
  const [articulosFiltrados, setArticulosFiltrados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    fetchArticulos();
  }, []);

  useEffect(() => {
    // Filtrar artículos cuando cambia la búsqueda
    if (busqueda.trim() === '') {
      setArticulosFiltrados(todosArticulos);
    } else {
      const busquedaLower = busqueda.toLowerCase();
      const filtrados = todosArticulos.filter(art =>
        art.nombre.toLowerCase().includes(busquedaLower) ||
        art.descripcion?.toLowerCase().includes(busquedaLower) ||
        art.codigo_ean13?.includes(busqueda) ||
        art.categoria?.nombre.toLowerCase().includes(busquedaLower)
      );
      setArticulosFiltrados(filtrados);
    }
  }, [busqueda, todosArticulos]);


  const fetchArticulos = async () => {
    try {
      setLoading(true);
      const data = await articulosService.getAll();
      const articulosActivos = data.filter(art => art.activo);
      setTodosArticulos(articulosActivos);
      setArticulosFiltrados(articulosActivos);
    } catch (error) {
      console.error('Error al cargar artículos:', error);
      toast.error('Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  };

  const agregarArticulo = (articulo) => {
    // Verificar si el artículo ya está en la lista de seleccionados
    const index = articulosSeleccionados.findIndex(a => a.id === articulo.id);

    if (index !== -1) {
      // Si ya existe, incrementar cantidad en 1
      const nuevosArticulos = [...articulosSeleccionados];
      nuevosArticulos[index].cantidad += 1;
      setArticulosSeleccionados(nuevosArticulos);
      toast.success(`${articulo.nombre} - Cantidad: ${nuevosArticulos[index].cantidad}`);
    } else {
      // Si no existe, agregarlo con cantidad 1
      setArticulosSeleccionados([...articulosSeleccionados, { ...articulo, cantidad: 1 }]);
      toast.success(`${articulo.nombre} agregado`);
    }
  };

  const handleScanArticulo = (articulo) => {
    // Agregar el artículo escaneado a la lista
    agregarArticulo(articulo);
  };

  const handleCantidadChange = (id, nuevaCantidad) => {
    if (nuevaCantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    const nuevosArticulos = articulosSeleccionados.map(art =>
      art.id === id ? { ...art, cantidad: parseFloat(nuevaCantidad) } : art
    );
    setArticulosSeleccionados(nuevosArticulos);
  };

  const handleEliminarArticulo = (id) => {
    setArticulosSeleccionados(articulosSeleccionados.filter(art => art.id !== id));
    toast.success('Artículo eliminado de la lista');
  };

  const handleGuardarEntrada = async () => {
    if (articulosSeleccionados.length === 0) {
      toast.error('Agrega al menos un artículo');
      return;
    }

    try {
      setGuardando(true);

      const articulosParaEnviar = articulosSeleccionados.map(art => ({
        articulo_id: art.id,
        cantidad: art.cantidad,
        observaciones: null
      }));

      await movimientosService.create({
        tipo: 'ajuste_entrada',
        articulos: articulosParaEnviar,
        observaciones: `Entrada de inventario - ${articulosSeleccionados.length} artículo(s)`
      });

      toast.success('Entrada registrada exitosamente');
      setArticulosSeleccionados([]);
      setBusqueda('');
      // Recargar inventario para mostrar nuevos stocks
      fetchArticulos();
    } catch (error) {
      console.error('Error al guardar entrada:', error);
      toast.error(error.message || 'Error al registrar entrada');
    } finally {
      setGuardando(false);
    }
  };

  const handleLimpiar = () => {
    if (articulosSeleccionados.length === 0) return;

    if (window.confirm('¿Deseas limpiar toda la lista de artículos?')) {
      setArticulosSeleccionados([]);
      setBusqueda('');
      toast.success('Lista limpiada');
    }
  };

  const totalArticulos = articulosSeleccionados.reduce((sum, art) => sum + art.cantidad, 0);
  const totalValor = articulosSeleccionados.reduce((sum, art) => sum + (art.cantidad * parseFloat(art.costo_unitario || 0)), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <PackagePlus className="text-green-600" size={36} />
              Entrada de Inventario
            </h1>
            <p className="text-gray-600 mt-1">
              Selecciona artículos del inventario o escanea códigos de barras
            </p>
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="px-6 py-3 rounded-lg transition-colors flex items-center gap-2 font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <ScanLine size={20} />
            Modo Escaneo
          </button>
        </div>
      </div>

      {/* Modal del Scanner de Códigos de Barras */}
      <Modal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        title="Escanear Código de Barras"
        size="lg"
      >
        <EAN13ScannerEntrada
          onClose={() => setShowScanner(false)}
          onScan={handleScanArticulo}
        />
      </Modal>

      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Panel Izquierdo: Lista de Artículos Disponibles */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Inventario Disponible
            </h2>
            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                ref={searchRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, código o categoría..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                disabled={guardando}
              />
            </div>
          </div>

          {/* Lista de Artículos */}
          <div className="flex-1 overflow-y-auto">
            {articulosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Search size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-lg">No se encontraron artículos</p>
                <p className="text-sm mt-2">Intenta con otra búsqueda</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {articulosFiltrados.map((articulo) => (
                  <div
                    key={articulo.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {articulo.imagen_url ? (
                          <img
                            src={`${import.meta.env.VITE_BASE_URL || 'http://localhost:5001'}${articulo.imagen_url}`}
                            alt={articulo.nombre}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                            📦
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {articulo.nombre}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                              {articulo.categoria?.nombre}
                            </span>
                            <span>Stock: {parseFloat(articulo.stock_actual).toFixed(0)} {articulo.unidad}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => agregarArticulo(articulo)}
                        disabled={guardando}
                        className="ml-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Agregar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel Derecho: Artículos Seleccionados para Entrada */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
          <div className="px-6 py-4 bg-green-50 border-b border-green-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Artículos a Ingresar ({articulosSeleccionados.length})
              </h2>
              {articulosSeleccionados.length > 0 && (
                <button
                  onClick={handleLimpiar}
                  disabled={guardando}
                  className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <X size={16} />
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {articulosSeleccionados.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <PackagePlus size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-lg">No hay artículos seleccionados</p>
                <p className="text-sm mt-2">Agrega artículos desde la lista de la izquierda</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {articulosSeleccionados.map((articulo) => (
                  <div key={articulo.id} className="p-4">
                    <div className="flex items-start gap-3">
                      {articulo.imagen_url ? (
                        <img
                          src={`${import.meta.env.VITE_BASE_URL || 'http://localhost:5001'}${articulo.imagen_url}`}
                          alt={articulo.nombre}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-3xl">
                          📦
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1">{articulo.nombre}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {articulo.categoria?.nombre}
                          </span>
                          <span>Stock actual: {parseFloat(articulo.stock_actual).toFixed(0)} {articulo.unidad}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Cantidad a Ingresar
                            </label>
                            <input
                              type="number"
                              value={articulo.cantidad}
                              onChange={(e) => handleCantidadChange(articulo.id, e.target.value)}
                              min="1"
                              step="1"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-center font-semibold"
                              disabled={guardando}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Nuevo Stock
                            </label>
                            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-center font-semibold text-green-700">
                              {(parseFloat(articulo.stock_actual) + articulo.cantidad).toFixed(0)} {articulo.unidad}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleEliminarArticulo(articulo.id)}
                        disabled={guardando}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Eliminar"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen y Botones */}
          {articulosSeleccionados.length > 0 && (
            <div className="border-t border-gray-200 p-6 bg-gray-50 flex-shrink-0">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Artículos</p>
                  <p className="text-2xl font-bold text-gray-900">{articulosSeleccionados.length}</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Total Unidades</p>
                  <p className="text-2xl font-bold text-green-600">{totalArticulos}</p>
                </div>
              </div>
              <button
                onClick={handleGuardarEntrada}
                disabled={guardando}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-lg"
              >
                {guardando ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={24} />
                    Registrar Entrada
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default EntradaInventarioPage;
